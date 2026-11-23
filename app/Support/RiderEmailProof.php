<?php

namespace App\Support;

use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Str;

/**
 * Remembers, in the visitor's own session, which email address has just been proven with an emailed code during
 * rider registration. The registration request only accepts an email that matches this proof, so a rider account
 * can never be created with an email the applicant cannot open. The proof lasts 30 minutes and is removed once the
 * account has been created.
 */
final class RiderEmailProof
{
    private const KEY = 'rider_verified_email';

    private const TTL_SECONDS = 1800;

    public static function mark(Session $session, string $email): void
    {
        $session->put(self::KEY, ['email' => Str::lower(trim($email)), 'at' => time()]);
    }

    public static function isVerified(Session $session, string $email): bool
    {
        $proof = $session->get(self::KEY);

        return is_array($proof)
            && ($proof['email'] ?? null) === Str::lower(trim($email))
            && (time() - (int) ($proof['at'] ?? 0)) <= self::TTL_SECONDS;
    }

    public static function forget(Session $session): void
    {
        $session->forget(self::KEY);
    }
}
