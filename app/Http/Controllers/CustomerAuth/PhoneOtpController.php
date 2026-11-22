<?php

namespace App\Http\Controllers\CustomerAuth;

use App\Exceptions\CustomerSignInException;
use App\Exceptions\OtpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendOtpRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Services\Auth\CustomerAccountService;
use App\Services\Auth\PhoneOtpService;
use App\Support\BookingResume;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

/** Public customer sign-in by phone. JSON endpoints used by the OTP screen on /login. */
class PhoneOtpController extends Controller
{
    public function send(SendOtpRequest $request, PhoneOtpService $otp): JsonResponse
    {
        try {
            $cooldown = $otp->send($request->e164(), $request->ip());
        } catch (OtpException $e) {
            return response()->json(['message' => $e->getMessage(), 'retry_after' => $e->retryAfter], $e->status);
        }

        // Identical answer for registered and unregistered numbers (and for rider numbers): nothing to enumerate.
        return response()->json(['message' => 'Kung valid ang numero, nagpadala kami ng 6-digit code.', 'resend_in' => $cooldown]);
    }

    public function verify(VerifyOtpRequest $request, PhoneOtpService $otp, CustomerAccountService $accounts): JsonResponse
    {
        try {
            $otp->verify($request->e164(), $request->code());
            $user = $accounts->signInWithPhone($request->e164());
        } catch (OtpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        } catch (CustomerSignInException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        Auth::login($user);
        $request->session()->regenerate();      // new session id on every login (fixation)
        $request->session()->forget('url.intended');

        return response()->json(['redirect' => BookingResume::pathFor($user, $request->session())]);
    }
}
