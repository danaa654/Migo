<?php

namespace App\Http\Controllers\CustomerAuth;

use App\Exceptions\CustomerSignInException;
use App\Http\Controllers\Controller;
use App\Services\Auth\CustomerAccountService;
use App\Support\BookingResume;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirect;
use Throwable;

class GoogleController extends Controller
{
    public function redirect(): SymfonyRedirect
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(Request $request, CustomerAccountService $accounts): RedirectResponse
    {
        try {
            $google = Socialite::driver('google')->user();
        } catch (Throwable $e) {
            report($e);

            return $this->back('Hindi nakumpleto ang Google sign-in. Subukan ulit.');
        }

        $email = (string) $google->getEmail();
        $raw = is_array($google->user ?? null) ? $google->user : [];
        $verified = filter_var($raw['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);

        // Never link or create an account from an email Google itself has not verified.
        if ($email === '' || ! $verified || (string) $google->getId() === '') {
            return $this->back('Hindi ma-verify ng Google ang email na ito. Gumamit ng ibang account o phone number.');
        }

        try {
            $user = $accounts->signInWithGoogle((string) $google->getId(), $email, $google->getName());
        } catch (CustomerSignInException $e) {
            return $this->back($e->getMessage(), rider: true);
        }

        Auth::login($user);
        $request->session()->regenerate();
        $request->session()->forget('url.intended');

        return redirect(BookingResume::pathFor($user, $request->session()));
    }

    private function back(string $message, bool $rider = false): RedirectResponse
    {
        return redirect($rider ? '/login?tab=rider' : '/login')->withErrors(['google' => $message]);
    }
}
