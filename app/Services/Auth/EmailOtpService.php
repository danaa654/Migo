<?php

namespace App\Services\Auth;

use App\Exceptions\OtpException;
use App\Mail\LoginOtpMail;
use App\Models\EmailLoginOtp;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

/**
 * Creates and checks emailed one-time codes. Mirrors PhoneOtpService: the code is never returned, logged or stored;
 * the stored value is HMAC-SHA256(email|code) keyed with APP_KEY.
 */
class EmailOtpService
{
    public const TTL_MINUTES = 10;

    public const MAX_ATTEMPTS = 5;

    public const RESEND_COOLDOWN_SECONDS = 60;

    public const MAX_SENDS_PER_WINDOW = 3;

    public const SEND_WINDOW_MINUTES = 10;

    public const IP_MAX_SENDS_PER_WINDOW = 10;

    /**
     * @param  string  $email  already lower-cased and validated
     * @return int seconds until the next resend is allowed
     *
     * @throws OtpException
     */
    public function send(string $email, ?string $ip): int
    {
        $now = now();

        $latest = EmailLoginOtp::where('email', $email)->latest('id')->first();
        if ($latest) {
            $wait = $latest->created_at->timestamp + self::RESEND_COOLDOWN_SECONDS - $now->timestamp;
            if ($wait > 0) {
                throw OtpException::throttled($wait);
            }
        }

        $windowStart = $now->copy()->subMinutes(self::SEND_WINDOW_MINUTES);
        $recent = EmailLoginOtp::where('email', $email)->where('created_at', '>=', $windowStart)->orderBy('created_at')->get(['created_at']);
        if ($recent->count() >= self::MAX_SENDS_PER_WINDOW) {
            $wait = $recent->first()->created_at->timestamp + self::SEND_WINDOW_MINUTES * 60 - $now->timestamp;
            throw OtpException::throttled($wait);
        }

        $ipKey = 'email-otp-send-ip:'.($ip ?? 'unknown');
        if (RateLimiter::tooManyAttempts($ipKey, self::IP_MAX_SENDS_PER_WINDOW)) {
            throw OtpException::throttled(RateLimiter::availableIn($ipKey));
        }
        RateLimiter::hit($ipKey, self::SEND_WINDOW_MINUTES * 60);

        $code = str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);

        $otp = DB::transaction(function () use ($email, $code, $ip, $now) {
            // Earlier unused codes for this email stop working the moment a new one is issued.
            EmailLoginOtp::where('email', $email)->whereNull('consumed_at')->update(['consumed_at' => $now]);

            return EmailLoginOtp::create([
                'email' => $email,
                'code_hash' => $this->hash($email, $code),
                'expires_at' => $now->copy()->addMinutes(self::TTL_MINUTES),
                'attempts' => 0,
                'ip_address' => $ip,
            ]);
        });

        try {
            Mail::to($email)->send(new LoginOtpMail($code, self::TTL_MINUTES));
        } catch (Throwable $e) {
            $otp->delete(); // a failed email must not count against the person's limits
            report($e);

            throw new OtpException('Hindi maipadala ang code ngayon. Subukan ulit mamaya.', 503);
        }

        return self::RESEND_COOLDOWN_SECONDS;
    }

    /**
     * Checks the code. Single use, expires, max attempts per code. Throws OtpException on any failure.
     *
     * @throws OtpException
     */
    public function verify(string $email, string $code): void
    {
        // The transaction only decides; exceptions are thrown after it commits so the attempt counter is never rolled back.
        [$result, $left] = DB::transaction(function () use ($email, $code) {
            $otp = EmailLoginOtp::where('email', $email)
                ->whereNull('consumed_at')
                ->where('expires_at', '>', now())
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $otp) {
                return ['expired', 0];
            }

            $otp->attempts++;

            if (hash_equals($otp->code_hash, $this->hash($email, $code))) {
                $otp->consumed_at = now();
                $otp->save();

                return ['ok', 0];
            }

            if ($otp->attempts >= self::MAX_ATTEMPTS) {
                $otp->consumed_at = now(); // too many wrong tries: this code is dead
                $otp->save();

                return ['locked', 0];
            }

            $otp->save();

            return ['wrong', self::MAX_ATTEMPTS - $otp->attempts];
        });

        match ($result) {
            'ok' => null,
            'wrong' => throw new OtpException("Mali ang code. {$left} subok na lang ang natitira."),
            'locked' => throw new OtpException('Masyadong maraming maling subok. Mag-request ng bagong code.'),
            default => throw new OtpException('Expired na o wala nang bisa ang code. Mag-request ng bago.'),
        };
    }

    private function hash(string $email, string $code): string
    {
        return hash_hmac('sha256', $email.'|'.$code, (string) config('app.key'));
    }
}
