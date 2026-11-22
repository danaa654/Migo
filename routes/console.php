<?php

use App\Models\TeamInvitation;
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
