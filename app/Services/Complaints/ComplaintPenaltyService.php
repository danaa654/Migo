<?php

namespace App\Services\Complaints;

use App\Actions\Complaints\ComplaintStatusException;
use App\Actions\Passengers\PassengerStatusException;
use App\Actions\Passengers\UpdatePassengerStatus;
use App\Actions\Riders\RiderStatusException;
use App\Actions\Riders\UpdateRiderStatus;
use App\Models\AdminProfile;
use App\Models\Complaint;
use App\Models\ComplaintPenalty;
use App\Models\Passenger;
use App\Models\Rider;
use App\Support\SupportCategories;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Penalty points for UPHELD complaints and incident reports only (support requests never carry points).
 * Filing, investigating or rejecting a report never adds points.
 *
 *  - Severity: minor = 1 point, serious = 3 points (suggested from the complaint category, the admin can change it).
 *  - Points count for 90 days, then stop counting.
 *  - Suggested action from the active total: 1 warning, 2 final warning, 3 suspend 7 days, 4-5 suspend 30 days,
 *    6+ suspend until an administrator reviews. It is only a suggestion: the administrator picks the action.
 *  - A timed suspension is lifted automatically by liftExpiredSuspensions() (scheduled in routes/console.php).
 *
 * The person the complaint is against only ever hears the outcome, never who reported them or what they wrote.
 */
class ComplaintPenaltyService
{
    public const POINTS = ['minor' => 1, 'serious' => 3];

    public const EXPIRY_DAYS = 90;

    /** Categories that start as "serious" (both passenger and rider category keys). */
    public const SERIOUS_CATEGORIES = ['harassment', 'unsafe_driving', 'unsafe_conduct', 'property_damage', 'false_booking'];

    /** action key => label. */
    public const ACTIONS = [
        'none' => 'Points only (no extra action)',
        'warning' => 'Written warning',
        'final_warning' => 'Final warning',
        'suspend_7' => 'Suspend for 7 days',
        'suspend_30' => 'Suspend for 30 days',
        'suspend_indefinite' => 'Suspend until an administrator reviews',
    ];

    /** action key => days (null = no end date). */
    private const SUSPENSIONS = ['suspend_7' => 7, 'suspend_30' => 30, 'suspend_indefinite' => null];

    public function __construct(
        private UpdateRiderStatus $riders,
        private UpdatePassengerStatus $passengers,
    ) {}

    /** Incident reports are safety reports, so they start as serious. Complaints depend on the category. */
    public function suggestedSeverity(string $category, string $reportType = Complaint::TYPE_COMPLAINT): string
    {
        if ($reportType === Complaint::TYPE_INCIDENT) {
            return 'serious';
        }

        return in_array($category, self::SERIOUS_CATEGORIES, true) ? 'serious' : 'minor';
    }

    public function suggestedAction(int $totalPoints): string
    {
        return match (true) {
            $totalPoints >= 6 => 'suspend_indefinite',
            $totalPoints >= 4 => 'suspend_30',
            $totalPoints >= 3 => 'suspend_7',
            $totalPoints === 2 => 'final_warning',
            $totalPoints === 1 => 'warning',
            default => 'none',
        };
    }

    public function activePoints(string $type, string $id): int
    {
        return (int) ComplaintPenalty::query()
            ->where('subject_type', $type)->where('subject_id', $id)
            ->where('expires_at', '>', now())
            ->sum('points');
    }

    /** What the admin sees before upholding: the party's current points and the suggested action per severity. */
    public function preview(Complaint $complaint): array
    {
        $active = $this->activePoints($complaint->against_type, $complaint->against_id);

        return [
            'can_uphold' => true,
            'suggested_severity' => $this->suggestedSeverity($complaint->complaint_category, $complaint->report_type),
            'active_points' => $active,
            'points' => self::POINTS,
            'suggestions' => collect(self::POINTS)->map(fn ($p) => $this->suggestedAction($active + $p))->all(),
            'actions' => collect(self::ACTIONS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'expiry_days' => self::EXPIRY_DAYS,
        ];
    }

    /** Runs inside UpdateComplaintStatus's transaction, so the resolution and the penalty succeed or fail together. */
    public function record(Complaint $complaint, AdminProfile $admin, string $severity, string $action): ComplaintPenalty
    {
        if ($complaint->report_type === Complaint::TYPE_SUPPORT) {
            throw new ComplaintStatusException('A support request cannot carry penalty points.');
        }
        if (! $complaint->against_type || ! $complaint->against_id) {
            throw new ComplaintStatusException('This report has no one recorded as the person it is against, so it cannot be upheld.');
        }
        $table = $complaint->against_type === 'rider' ? 'riders' : 'passengers';
        $subject = DB::table($table)->where('id', $complaint->against_id)->first(['id', 'user_id']);
        if (! $subject) {
            throw new ComplaintStatusException('The person this complaint is against no longer exists, so it cannot be upheld.');
        }

        $points = self::POINTS[$severity];
        $total = $this->activePoints($complaint->against_type, $complaint->against_id) + $points;
        $isSuspension = array_key_exists($action, self::SUSPENSIONS);
        $days = self::SUSPENSIONS[$action] ?? null;
        $label = $this->categoryLabel($complaint->complaint_category);

        $reason = "Complaint upheld ({$label}). Active penalty points: {$total}. "
            .($days ? "Suspension: {$days} days." : 'Suspension: until an administrator reviews your account.');

        $penalty = ComplaintPenalty::create([
            'complaint_id' => $complaint->id,
            'subject_type' => $complaint->against_type,
            'subject_id' => $complaint->against_id,
            'severity' => $severity,
            'points' => $points,
            'action' => $action,
            'suspension_ends_at' => $isSuspension && $days ? now()->addDays($days) : null,
            'suspension_reason' => $isSuspension ? $reason : null,
            'expires_at' => now()->addDays(self::EXPIRY_DAYS),
            'decided_by' => $admin->id,
            'created_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'id' => (string) Str::uuid(),
            'admin_id' => $admin->id,
            'action' => 'complaint.penalty_applied',
            'description' => ucfirst($severity)." (+{$points}), ".self::ACTIONS[$action].". {$complaint->against_type} now has {$total} active point(s).",
            'subject_type' => 'complaint',
            'subject_id' => $complaint->id,
            'created_at' => now(),
        ]);

        // A suspension notifies the person through the existing suspend action. Otherwise send the outcome here.
        $suspended = $isSuspension && $this->suspend($complaint->against_type, $complaint->against_id, $admin, $reason);
        if (! $suspended && $subject->user_id) {
            $this->notifyOutcome($subject->user_id, $complaint, $label, $action, $total);
        }

        return $penalty;
    }

    /** Lifts timed suspensions whose end date passed. Returns how many accounts were reactivated. */
    public function liftExpiredSuspensions(): int
    {
        $lifted = 0;

        ComplaintPenalty::query()
            ->whereNotNull('suspension_ends_at')->whereNull('suspension_lifted_at')
            ->where('suspension_ends_at', '<=', now())
            ->get()
            ->each(function (ComplaintPenalty $p) use (&$lifted) {
                $admin = $p->decided_by ? AdminProfile::find($p->decided_by) : null;
                $account = $p->subject_type === 'rider' ? Rider::find($p->subject_id) : Passenger::find($p->subject_id);

                // Only lift the suspension this penalty created: if staff suspended the account again for another
                // reason in the meantime, its reason text differs and the account is left alone.
                if ($admin && $account && $account->isSuspended() && $account->suspension_reason === $p->suspension_reason) {
                    try {
                        $p->subject_type === 'rider'
                            ? $this->riders->reactivate($account, $admin)
                            : $this->passengers->reactivate($account, $admin);
                        $lifted++;
                    } catch (RiderStatusException|PassengerStatusException) {
                        // Already active: nothing to lift.
                    }
                }

                $p->forceFill(['suspension_lifted_at' => now()])->save();
            });

        return $lifted;
    }

    private function suspend(string $type, string $id, AdminProfile $admin, string $reason): bool
    {
        try {
            $type === 'rider'
                ? $this->riders->suspend(Rider::findOrFail($id), $admin, $reason)
                : $this->passengers->suspend(Passenger::findOrFail($id), $admin, $reason);

            return true;
        } catch (RiderStatusException|PassengerStatusException) {
            return false; // already suspended or deactivated: the points still count
        }
    }

    private function notifyOutcome(int|string $userId, Complaint $complaint, string $label, string $action, int $total): void
    {
        $ref = $complaint->booking_id ? DB::table('bookings')->where('id', $complaint->booking_id)->value('booking_reference') : null;
        $message = 'A report about '.($ref ? "trip {$ref}" : 'a recent trip')." was reviewed and upheld ({$label}). "
            .match ($action) {
                'warning' => 'This is a written warning. ',
                'final_warning' => 'This is your final warning: another upheld report may lead to suspension. ',
                default => '',
            }
            ."Your active penalty points: {$total}. Points expire after ".self::EXPIRY_DAYS.' days.';

        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'title' => $action === 'final_warning' ? 'Final warning' : 'A report about you was upheld',
            'message' => $message,
            'notification_type' => 'complaint_penalty',
            'is_read' => false,
            'created_at' => now(),
        ]);
    }

    private function categoryLabel(string $category): string
    {
        return SupportCategories::label($category);
    }
}
