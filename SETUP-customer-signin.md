# Migo (Migo): customer sign-in with Google and phone OTP

Every file in this download sits at the path it has in your project. Copy them over (replace the changed ones).

## 1. Commands

```bash
composer require laravel/socialite
php artisan migrate                # additive only. Do NOT use migrate:fresh: it would wipe the existing customers.
php artisan config:clear
php artisan wayfinder:generate     # refreshes resources/js/routes and actions (the old register.customer routes disappear)
npm run build                      # or: npm run dev
php artisan test tests/Feature/Auth
```

Delete these (the customer registration, nothing else):

```bash
rm app/Http/Controllers/Registration/CustomerRegistrationController.php
rm app/Http/Requests/Registration/RegisterCustomerRequest.php
rm resources/js/pages/auth/register-customer.tsx
rm resources/js/pages/auth/register.tsx          # the account-type chooser
```

## 2. Two files I could not see, so paste these yourself

`config/services.php`, add inside the returned array:

```php
'google' => [
    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect' => env('GOOGLE_REDIRECT_URI'),
],
```

`.env.example` (and your `.env`), add:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# SMS for OTP: "log" writes the code to storage/logs/laravel.log (local/dev only, refuses to run in production)
SMS_DRIVER=log
# Real SMS (Philippines): SMS_DRIVER=semaphore
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=
```

Optional: you can also remove `Features::registration()` from `config/fortify.php`. It is not required: Fortify's generic `POST /register` now answers 404 (see `CreateNewUser`).

## 3. Google Cloud Console

1. Open https://console.cloud.google.com, create (or pick) a project.
2. **APIs & Services > OAuth consent screen** (now called _Google Auth Platform_): app name "Migo", your support email, audience **External**, developer contact email.
3. Scopes: only `openid`, `email`, `profile` (the defaults; no verification needed).
4. **Audience / Test users**: while the app is in **Testing**, only the Google accounts you list here can sign in. Add yourself and every teammate's Gmail. Anyone else sees "Access blocked".
5. **Credentials > Create credentials > OAuth client ID > Web application**.
6. **Authorized redirect URIs**, one entry per environment, matched exactly (scheme, host, port, path; no wildcards):
    - `http://localhost:8000/auth/google/callback` for local work
    - the current tunnel URL while testing, for example `https://something.trycloudflare.com/auth/google/callback`. A quick tunnel changes every run, so add the new URL each time (it can take a minute to apply) and remove old ones. A named Cloudflare tunnel keeps one stable URL.
7. Copy the Client ID and Client secret into `.env`. When you test through a tunnel, set `APP_URL` **and** `GOOGLE_REDIRECT_URI` to the tunnel URL, then `php artisan config:clear`.

## 4. What changed (paths)

**New:** `app/Support/PhilippinePhone.php`, `app/Exceptions/OtpException.php`, `app/Exceptions/CustomerSignInException.php`, `app/Models/LoginOtp.php`, `app/Services/Auth/PhoneOtpService.php`, `app/Services/Auth/CustomerAccountService.php`, `app/Services/Sms/{SmsSender,LogSmsSender,SemaphoreSmsSender}.php`, `config/sms.php`, `app/Http/Controllers/CustomerAuth/{GoogleController,PhoneOtpController,CustomerPhoneController}.php`, `app/Http/Requests/Auth/{SendOtpRequest,VerifyOtpRequest}.php`, `app/Http/Middleware/EnsureCustomerProfileComplete.php`, `database/migrations/2026_11_30_000000_add_phone_and_google_to_users_table.php`, `database/migrations/2026_11_30_000001_create_login_otps_table.php`, `resources/js/lib/post-json.ts`, `resources/js/components/{phone-otp-flow,migo-customer-login}.tsx`, `tests/Support/FakeSmsSender.php`, `tests/Feature/Auth/*` (5 files).

**Changed:** `routes/web.php`, `bootstrap/app.php` (alias `customer.profile`), `app/Models/User.php`, `app/Providers/{AppServiceProvider,FortifyServiceProvider}.php`, `app/Actions/Fortify/CreateNewUser.php`, `app/Http/Controllers/CustomerProfileController.php`, `app/Http/Requests/Customer/UpdateCustomerProfileRequest.php`, `resources/js/pages/auth/login.tsx`, `resources/js/pages/auth/register-biker.tsx` (back link), `resources/js/pages/customer/{customer-profile,customer-dashboard}.tsx`, `resources/js/pages/{welcome,legal}.tsx`, `resources/js/components/migo-login-form.tsx` (footer link).

**Untouched:** admin login, `authenticateUsing`, rider registration, dispatch, booking and admin features.

## 5. Decisions you should know about

- **Schema (additive, nothing deleted):** `users.google_id`, `users.phone` (E.164, unique), `users.phone_verified_at`, table `login_otps`. `users.email` and `passengers.email` become nullable so a phone-only customer needs no email; `users.password` stays NOT NULL (random unusable hash). Rolling back only restores NOT NULL if no email-less row exists.
- **Single source of truth for the phone:** `users.phone` (E.164). `passengers.phone` keeps the existing `09XXXXXXXXX` format and is synced from it. Legacy customers whose number is only on their passenger row are linked at their first OTP sign-in (exactly one match; two or more matches are refused instead of guessing).
- **First-time phone customers** get `name = ''` until they save their full name on `/customer/profile`; `customer.profile` middleware sends them there from the dashboard and booking pages.
- **Existing customers with a password** can still sign in through the Rider / Driver form (I did not touch `authenticateUsing`). Say so if you want that blocked.
- **Google users** with `email_verified = false` are refused; this prevents taking over an account by an unverified address.
- The OTP is HMAC-SHA256 (keyed with APP_KEY), compared with `hash_equals`; the log driver throws when `APP_ENV=production`.
- **Email-assumption check:** `verified` middleware is only on the legacy `{current_team}/dashboard` route that customers never reach; no mail notifications are sent to customers; passkeys, 2FA and teams are not used by customer routes. `DashboardController` calls `strtolower($user->email)`, unreachable for customers.
- Semaphore: fields used are `apikey`, `number`, `message` (+ optional `sendername`). Confirm against their current docs and your account before going live.

## 6. Manual test plan

1. **Google:** open `/login`, press _Continue with Google_ with a test-user account. Expect `/customer/dashboard`, a new `users` row (role customer, google_id) and a `passengers` row. Sign out, repeat: no duplicate. Try a Google account whose email is a rider's: back on `/login?tab=rider` with "This email is a rider/admin account. Please use the Rider login."
2. **OTP (log driver):** `SMS_DRIVER=log`, enter `09171234567`, _Send OTP_, run `tail -f storage/logs/laravel.log`, read `[SMS:log] ...`, type or paste the 6 digits. First time: redirected to the profile to enter a full name, then the dashboard.
3. **Wrong code:** enter a wrong code 5 times: the 5th kills the code, the right digits no longer work, request a new one. **Expired:** wait 5 minutes then verify. **Resend:** button counts down 60 s; a second send inside 60 s and a 4th within 10 minutes are refused.
4. **Same number, existing customer:** use the number on an old customer's profile; you land in that customer's account, not a new one.
5. **Rider:** `/login` > _Rider / Driver_ tab, email + password lands on `/biker/dashboard`. `/register` opens the rider form; `/register/customer` is 404.
6. **Admin:** `/admin/login` works exactly as before; a rider email there is rejected.
7. **Phone screen:** open the tunnel URL on a phone: numeric keypad, boxes auto-advance, SMS autofill/paste fills all six.
