<?php

namespace App\Actions\Passengers;

use App\Models\AdminProfile;
use App\Models\Passenger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The only place that changes a passenger's account_status (active | suspended | deactivated).
 * Each change runs in one transaction on a locked row, re-checks the current state, writes the decision to
 * audit_logs (subject_type = 'passenger') and notifies the passenger through the existing notifications table.
 *
 * A passenger's trip that is already in progress is NOT touched: it finishes normally. Suspension only blocks
 * new bookings (CustomerBookingController, DispatchService and TripService::retry check account_status).
 */
class UpdatePassengerStatus
{
    public function suspend(Passenger $passenger, AdminProfile $admin, string $reason): Passenger
    {
        return $this->apply($passenger, $admin, 'suspended', function (Passenger $p) use ($reason) {
            if ($p->isSuspended()) {
                throw new PassengerStatusException('This passenger account is already suspended.');
            }
            if ($p->isDeactivated()) {
                throw new PassengerStatusException('A deactivated account must be reactivated before it can be suspended.');
            }

            return ['account_status' => 'suspended', 'suspension_reason' => $reason];
        }, $reason, 'Account suspended', 'Your account has been suspended and you cannot book rides. Reason: '.$reason);
    }

    public function deactivate(Passenger $passenger, AdminProfile $admin, string $reason): Passenger
    {
        return $this->apply($passenger, $admin, 'deactivated', function (Passenger $p) use ($reason) {
            if ($p->isDeactivated()) {
                throw new PassengerStatusException('This passenger account is already deactivated.');
            }

            return ['account_status' => 'deactivated', 'suspension_reason' => $reason];
        }, $reason, 'Account deactivated', 'Your account has been deactivated and you cannot book rides. Reason: '.$reason);
    }

    public function reactivate(Passenger $passenger, AdminProfile $admin): Passenger
    {
        return $this->apply($passenger, $admin, 'reactivated', function (Passenger $p) {
            if ($p->isActive()) {
                throw new PassengerStatusException('This passenger account is already active.');
            }

            return ['account_status' => 'active', 'suspension_reason' => null];
        }, null, 'Account reactivated', 'Your account has been reactivated. You can book rides again.');
    }

    /** @param callable(Passenger): array<string, mixed> $changes  Validates the transition and returns the columns to update. */
    private function apply(Passenger $passenger, AdminProfile $admin, string $event, callable $changes, ?string $reason, string $title, string $message): Passenger
    {
        return DB::transaction(function () use ($passenger, $admin, $event, $changes, $reason, $title, $message) {
            $locked = Passenger::query()->lockForUpdate()->findOrFail($passenger->id);
            $before = $locked->account_status;

            $locked->forceFill($changes($locked))->save();

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'admin_id' => $admin->id,
                'action' => 'passenger.'.$event,
                // The reader can see "from -> to" even when no reason was typed (reactivation).
                'description' => $reason ?? "{$before} -> {$locked->account_status}",
                'subject_type' => 'passenger',
                'subject_id' => $locked->id,
                'created_at' => now(),
            ]);

            if ($locked->user_id) {
                DB::table('notifications')->insert([
                    'id' => (string) Str::uuid(),
                    'user_id' => $locked->user_id,
                    'title' => $title,
                    'message' => $message,
                    'notification_type' => 'passenger_'.$event,
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            }

            return $locked;
        });
    }
}