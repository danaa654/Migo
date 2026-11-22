<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Contracts\Session\Session;

/**
 * A guest who opens the public /book page and then signs in as a customer is sent back to the booking page
 * instead of the dashboard. The mark expires after 30 minutes and is consumed by the first sign-in.
 */
final class BookingResume
{
    private const KEY = 'resume_booking_at';

    private const TTL_SECONDS = 1800;

    public static function mark(Session $session): void
    {
        $session->put(self::KEY, time());
    }

    /** Where to send a user who has just signed in. Riders and admins never resume a booking. */
    public static function pathFor(User $user, Session $session): string
    {
        $markedAt = (int) $session->pull(self::KEY, 0);
        $path = $user->dashboardPath();

        $resume = $markedAt > 0
            && (time() - $markedAt) <= self::TTL_SECONDS
            && str_starts_with($path, '/customer');

        return $resume ? '/customer/book' : $path;
    }
}
