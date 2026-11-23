<?php

namespace App\Http\Controllers\Registration;

use App\Exceptions\OtpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendEmailOtpRequest;
use App\Http\Requests\Auth\VerifyEmailOtpRequest;
use App\Models\Passenger;
use App\Models\Rider;
use App\Models\User;
use App\Services\Auth\EmailOtpService;
use App\Support\RiderEmailProof;
use Illuminate\Http\JsonResponse;

/** Rider registration step: prove the applicant can open the email address before the application can be submitted. */
class RiderEmailOtpController extends Controller
{
    private const TAKEN_MESSAGE = 'This email is already registered. Sign in instead, or use a different email.';

    public function send(SendEmailOtpRequest $request, EmailOtpService $otp): JsonResponse
    {
        $email = $request->emailAddress();

        // Registration forms already tell the applicant when an email is taken (the final unique rules do the same).
        if ($this->taken($email)) {
            return response()->json(['message' => self::TAKEN_MESSAGE], 422);
        }

        try {
            $cooldown = $otp->send($email, $request->ip());
        } catch (OtpException $e) {
            return response()->json(['message' => $e->getMessage(), 'retry_after' => $e->retryAfter], $e->status);
        }

        return response()->json(['message' => 'Nagpadala kami ng 6-digit code sa email mo.', 'resend_in' => $cooldown]);
    }

    public function verify(VerifyEmailOtpRequest $request, EmailOtpService $otp): JsonResponse
    {
        $email = $request->emailAddress();

        if ($this->taken($email)) {
            return response()->json(['message' => self::TAKEN_MESSAGE], 422);
        }

        try {
            $otp->verify($email, $request->code());
        } catch (OtpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        RiderEmailProof::mark($request->session(), $email);

        return response()->json(['verified' => true, 'email' => $email]);
    }

    private function taken(string $email): bool
    {
        return User::whereRaw('LOWER(email) = ?', [$email])->exists()
            || Rider::whereRaw('LOWER(email) = ?', [$email])->exists()
            || Passenger::whereRaw('LOWER(email) = ?', [$email])->exists();
    }
}
