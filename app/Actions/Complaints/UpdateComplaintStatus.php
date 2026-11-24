<?php

namespace App\Actions\Complaints;

use App\Models\AdminProfile;
use App\Models\Complaint;
use App\Services\Complaints\ComplaintPenaltyService;
use App\Support\SupportCategories;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The only place that changes a report's status (complaint, support request or incident report). Each change runs in one transaction on a locked row,
 * re-checks the current state, writes the decision to audit_logs (subject_type = 'complaint') and notifies
 * whoever filed the complaint through the existing notifications table.
 *
 * Flow: pending -> under_investigation -> resolved. A pending or investigated complaint may be rejected.
 * Resolved and rejected complaints are final.
 */
class UpdateComplaintStatus
{
    public function __construct(private ComplaintPenaltyService $penalties) {}

    public function investigate(Complaint $complaint, AdminProfile $admin): Complaint
    {
        $noun = SupportCategories::noun($complaint->report_type);
        $support = $complaint->report_type === Complaint::TYPE_SUPPORT;

        return $this->apply($complaint, $admin, 'investigation_started', function (Complaint $c) use ($admin, $noun) {
            if ($c->complaint_status !== 'pending') {
                throw new ComplaintStatusException("Only a pending {$noun} can be started.");
            }

            return ['complaint_status' => 'under_investigation', 'assigned_to' => $admin->id];
        }, null, ucfirst($noun).($support ? ' in progress' : ' under investigation'),
            $support ? 'Our support team is now working on your request.' : "Your {$noun} is now being investigated by our support team.");
    }

    /**
     * @param  array{severity: string, action: string}|null  $finding  Pass it when the complaint is UPHELD: the penalty
     *                                                                  is recorded in the same transaction as the resolution.
     */
    public function resolve(Complaint $complaint, AdminProfile $admin, string $note, ?array $finding = null): Complaint
    {
        $noun = SupportCategories::noun($complaint->report_type);
        $support = $complaint->report_type === Complaint::TYPE_SUPPORT;

        if ($support && $finding) {
            throw new ComplaintStatusException('A support request cannot carry penalty points.');
        }

        $intro = match (true) {
            $support => 'Our support team answered your request.',
            (bool) $finding => 'We reviewed your report, found it valid and took action.',
            $complaint->report_type === Complaint::TYPE_INCIDENT => 'We reviewed your incident report and recorded the outcome.',
            default => 'We reviewed your report and did not find a violation.',
        };

        return $this->apply($complaint, $admin, 'resolved', function (Complaint $c) use ($note, $admin, $noun) {
            if ($c->complaint_status !== 'under_investigation') {
                throw new ComplaintStatusException("Start working on this {$noun} before resolving it.");
            }

            return ['complaint_status' => 'resolved', 'resolution_note' => $note, 'resolved_at' => now(), 'assigned_to' => $c->assigned_to ?? $admin->id];
        }, $note, ucfirst($noun).' resolved', $intro.' Resolution: '.$note, $finding
            ? fn (Complaint $c) => $this->penalties->record($c, $admin, $finding['severity'], $finding['action'])
            : null);
    }

    public function reject(Complaint $complaint, AdminProfile $admin, string $reason): Complaint
    {
        $noun = SupportCategories::noun($complaint->report_type);

        return $this->apply($complaint, $admin, 'rejected', function (Complaint $c) use ($reason, $admin, $noun) {
            if (! $c->isOpen()) {
                throw new ComplaintStatusException("This {$noun} is already closed.");
            }

            return ['complaint_status' => 'rejected', 'resolution_note' => $reason, 'resolved_at' => now(), 'assigned_to' => $c->assigned_to ?? $admin->id];
        }, $reason, ucfirst($noun).' rejected', "Your {$noun} was not accepted. Reason: ".$reason);
    }

    /** @param callable(Complaint): array<string, mixed> $changes  Validates the transition and returns the columns to update. */
    private function apply(Complaint $complaint, AdminProfile $admin, string $event, callable $changes, ?string $reason, string $title, string $message, ?callable $after = null): Complaint
    {
        return DB::transaction(function () use ($complaint, $admin, $event, $changes, $reason, $title, $message, $after) {
            $locked = Complaint::query()->lockForUpdate()->findOrFail($complaint->id);
            $before = $locked->complaint_status;

            $locked->forceFill($changes($locked))->save();

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'admin_id' => $admin->id,
                'action' => 'complaint.'.$event,
                'description' => $reason ?? "{$before} -> {$locked->complaint_status}",
                'subject_type' => 'complaint',
                'subject_id' => $locked->id,
                'created_at' => now(),
            ]);

            // The reporter id is the rider's or passenger's profile id; their login account is user_id on that row.
            $table = $locked->reporter_type === 'rider' ? 'riders' : 'passengers';
            $userId = DB::table($table)->where('id', $locked->reporter_id)->value('user_id');
            if ($userId) {
                DB::table('notifications')->insert([
                    'id' => (string) Str::uuid(),
                    'user_id' => $userId,
                    'title' => $title,
                    'message' => $message,
                    'notification_type' => 'complaint_'.$event,
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            }

            // Extra work that must succeed or fail together with the status change (the penalty for an upheld complaint).
            if ($after) {
                $after($locked);
            }

            return $locked;
        });
    }
}