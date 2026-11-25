<?php

use App\Models\TeamInvitation;
use App\Services\Complaints\ComplaintPenaltyService;
use Illuminate\Support\Facades\Schedule;

Schedule::call(function () {
    TeamInvitation::query()
        ->whereNotNull('expires_at')
        ->where('expires_at', '<', now())
        ->delete();
})->daily()->description('Delete expired team invitations');

// Real-time dispatch: expire stale ride offers, widen the rider search radius, offer to newly eligible riders
// and time out unmatched bookings. Runs every 5 seconds (keep `php artisan schedule:work` running locally).
Schedule::command('dispatch:tick')
    ->everyFiveSeconds()
    ->withoutOverlapping()
    ->runInBackground()
    ->description('Dispatch tick: offer expiry, search expansion, no-rider timeout');

// Lift timed suspensions that came from an upheld complaint once their end date has passed.
Schedule::call(fn () => app(ComplaintPenaltyService::class)->liftExpiredSuspensions())
    ->everyFiveMinutes()
    ->name('complaints:lift-suspensions')
    ->withoutOverlapping()
    ->description('Lift ended complaint suspensions');

// Subscriptions: start queued renewals, mark ended trials / subscriptions as expired, send reminders (once each).
// Booking access itself is checked live from the timestamps, so this only drives status labels and notifications.
Schedule::command('subscriptions:tick')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->description('Subscription expiry and reminders');
