<?php

namespace App\Http\Controllers\CustomerAuth;

use App\Exceptions\OtpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendOtpRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Services\Auth\CustomerAccountService;
use App\Services\Auth\PhoneOtpService;
use Illuminate\Http\JsonResponse;

/** A signed-in customer adds or confirms the phone number on their profile (same OTP engine as the login). */
class CustomerPhoneController extends Controller
{
    private const UNAVAILABLE = 'Hindi magagamit ang numerong ito. Gumamit ng ibang number.';

    public function send(SendOtpRequest $request, PhoneOtpService $otp, CustomerAccountService $accounts): JsonResponse
    {
        if (! $accounts->isPhoneAvailableFor($request->user(), $request->e164())) {
            return response()->json(['message' => self::UNAVAILABLE], 422);
        }

        try {
            $cooldown = $otp->send($request->e164(), $request->ip());
        } catch (OtpException $e) {
            return response()->json(['message' => $e->getMessage(), 'retry_after' => $e->retryAfter], $e->status);
        }

        return response()->json(['message' => 'Nagpadala kami ng 6-digit code.', 'resend_in' => $cooldown]);
    }

    public function verify(VerifyOtpRequest $request, PhoneOtpService $otp, CustomerAccountService $accounts): JsonResponse
    {
        try {
            $otp->verify($request->e164(), $request->code());
        } catch (OtpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        if (! $accounts->attachVerifiedPhone($request->user(), $request->e164())) {
            return response()->json(['message' => self::UNAVAILABLE], 422);
        }

        return response()->json(['ok' => true]);
    }
}
