<?php

namespace App\Http\Controllers\CustomerAuth;

use App\Exceptions\CustomerSignInException;
use App\Exceptions\OtpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendEmailOtpRequest;
use App\Http\Requests\Auth\VerifyEmailOtpRequest;
use App\Services\Auth\CustomerAccountService;
use App\Services\Auth\EmailOtpService;
use App\Support\BookingResume;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

/** Public customer sign-in by emailed code. JSON endpoints used by the email OTP screen on /login. */
class EmailOtpController extends Controller
{
    public function send(SendEmailOtpRequest $request, EmailOtpService $otp): JsonResponse
    {
        try {
            $cooldown = $otp->send($request->emailAddress(), $request->ip());
        } catch (OtpException $e) {
            return response()->json(['message' => $e->getMessage(), 'retry_after' => $e->retryAfter], $e->status);
        }

        // Identical answer for registered and unregistered emails (and for rider emails): nothing to enumerate.
        return response()->json(['message' => 'Kung valid ang email, nagpadala kami ng 6-digit code.', 'resend_in' => $cooldown]);
    }

    public function verify(VerifyEmailOtpRequest $request, EmailOtpService $otp, CustomerAccountService $accounts): JsonResponse
    {
        try {
            $otp->verify($request->emailAddress(), $request->code());
            $user = $accounts->signInWithEmail($request->emailAddress());
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
