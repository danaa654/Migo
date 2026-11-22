<?php

namespace App\Actions\Riders;

use App\Models\AdminProfile;
use App\Models\Rider;
use App\Models\RiderAccreditationHistory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Application review + account actions. (Accreditation stages live in RiderAccreditation.)
 * The only place that changes a rider's verification status (application_status) or account status (account_status).
 * Each change runs in one transaction on a locked row, re-checks the current state, writes the decision to
 * audit_logs and notifies the rider through the existing notifications table.
 */
class UpdateRiderStatus
{
    /** Online application documents an administrator must have received before approving (column => label). */
    public const REQUIRED_UPLOADS = [
        'license_document' => "driver's license",
        'registration_document' => 'motorcycle registration (OR/CR)',
        'official_receipt' => 'official receipt',
        'nbi_clearance' => 'NBI clearance',
    ];

    public function approve(Rider $rider, AdminProfile $admin): Rider
    {
        return $this->apply($rider, $admin, 'approved', function (Rider $r) {
            if ($r->application_status === 'approved') {
                throw new RiderStatusException('This rider is already approved.');
            }
            $missing = array_keys(array_filter(self::REQUIRED_UPLOADS, fn ($label, $column) => blank($r->{$column}), ARRAY_FILTER_USE_BOTH));
            if ($missing) {
                throw new RiderStatusException('Cannot approve: the rider has not uploaded: '.implode(', ', array_map(fn ($c) => self::REQUIRED_UPLOADS[$c], $missing)).'.');
            }

            return ['application_status' => 'approved', 'rejection_reason' => null, 'reviewed_at' => now(), 'reviewed_by' => null];
        }, null, 'Application approved', 'Your online application has been approved. Next, visit the Migo office for face-to-face document verification. You can accept bookings only after final accreditation.');
    }

    public function reject(Rider $rider, AdminProfile $admin, string $reason): Rider
    {
        return $this->apply($rider, $admin, 'rejected', function (Rider $r) use ($reason) {
            if ($r->application_status !== 'pending') {
                throw new RiderStatusException('Only pending applications can be rejected.');
            }

            return ['application_status' => 'rejected', 'rejection_reason' => $reason, 'reviewed_at' => now(), 'reviewed_by' => null];
        }, $reason, 'Registration rejected', 'Your rider registration was not approved. Reason: '.$reason);
    }

    public function suspend(Rider $rider, AdminProfile $admin, string $reason): Rider
    {
        return $this->apply($rider, $admin, 'suspended', function (Rider $r) use ($reason) {
            if ($r->isSuspended()) {
                throw new RiderStatusException('This rider account is already suspended.');
            }

            return ['account_status' => 'suspended', 'suspension_reason' => $reason];
        }, $reason, 'Account suspended', 'Your rider account has been suspended and you cannot accept service requests. Reason: '.$reason);
    }

    public function reactivate(Rider $rider, AdminProfile $admin): Rider
    {
        return $this->apply($rider, $admin, 'reactivated', function (Rider $r) {
            if (! $r->isSuspended()) {
                throw new RiderStatusException('Only suspended accounts can be reactivated.');
            }

            return ['account_status' => 'active', 'suspension_reason' => null];
        }, null, 'Account reactivated', 'Your rider account has been reactivated.');
    }

    /** @param callable(Rider): array<string, mixed> $changes  Validates the transition and returns the columns to update. */
    private function apply(Rider $rider, AdminProfile $admin, string $event, callable $changes, ?string $reason, string $title, string $message): Rider
    {
        return DB::transaction(function () use ($rider, $admin, $event, $changes, $reason, $title, $message) {
            $locked = Rider::query()->lockForUpdate()->findOrFail($rider->id);
            $before = in_array($event, ['approved', 'rejected'], true) ? $locked->application_status : $locked->account_status;
            $update = $changes($locked);

            // Verification decisions record who reviewed; account actions leave the review columns alone.
            if (array_key_exists('reviewed_by', $update)) {
                $update['reviewed_by'] = $admin->id;
            }
            $locked->forceFill($update)->save();

            // Same decision in the accreditation history (application / account stage), keyed to the previous status.
            RiderAccreditationHistory::create([
                'rider_id' => $locked->id,
                'stage' => in_array($event, ['approved', 'rejected'], true) ? 'application' : 'account',
                'action' => 'rider.'.$event,
                'from_status' => $before,
                'to_status' => in_array($event, ['approved', 'rejected'], true) ? $locked->application_status : $locked->account_status,
                'actor_id' => $admin->id,
                'remarks' => $reason,
            ]);

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'admin_id' => $admin->id,
                'action' => 'rider.'.$event,
                'description' => $reason,
                'subject_type' => 'rider',
                'subject_id' => $locked->id,
                'created_at' => now(),
            ]);

            // Reuses the notifications table; user_id targets the rider (NULL rows remain the admin feed).
            if ($locked->user_id) {
                DB::table('notifications')->insert([
                    'id' => (string) Str::uuid(),
                    'user_id' => $locked->user_id,
                    'title' => $title,
                    'message' => $message,
                    'notification_type' => 'rider_'.$event,
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            }

            return $locked;
        });
    }
}
