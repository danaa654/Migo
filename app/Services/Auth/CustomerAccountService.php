<?php

namespace App\Services\Auth;

use App\Enums\AccountRole;
use App\Exceptions\CustomerSignInException;
use App\Models\Passenger;
use App\Models\Rider;
use App\Models\User;
use App\Support\PhilippinePhone;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Finds, links or creates the CUSTOMER account behind a Google or phone sign-in.
 *
 * Rules that always hold:
 *  - the role is set here, on the server, to "customer"; it is never read from the request;
 *  - a rider/admin identity (email or phone) is never signed in through the customer flows;
 *  - an existing customer is linked (google_id / phone added), never duplicated;
 *  - no existing row is deleted.
 */
class CustomerAccountService
{
    public const RIDER_EMAIL_MESSAGE = 'This email is a rider/admin account. Please use the Rider login.';

    public const RIDER_PHONE_MESSAGE = 'Please use the Rider login.';

    /** @throws CustomerSignInException */
    public function signInWithGoogle(string $googleId, string $email, ?string $name): User
    {
        $email = Str::lower(trim($email));

        return $this->retryOnce(fn () => DB::transaction(function () use ($googleId, $email, $name) {
            $user = User::where('google_id', $googleId)->first();
            if ($user) {
                $this->assertCustomer($user, self::RIDER_EMAIL_MESSAGE);
                $this->ensurePassenger($user);

                return $user;
            }

            $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
            if ($user) {
                $this->assertCustomer($user, self::RIDER_EMAIL_MESSAGE);
                $user->forceFill(['google_id' => $googleId, 'email_verified_at' => $user->email_verified_at ?? now()])->save();
                $this->ensurePassenger($user);

                return $user;
            }

            // A rider application that has no login yet must still never become a customer.
            if (Rider::whereRaw('LOWER(email) = ?', [$email])->exists()) {
                throw new CustomerSignInException(self::RIDER_EMAIL_MESSAGE);
            }

            $user = $this->newCustomer(['name' => trim((string) $name), 'email' => $email, 'google_id' => $googleId, 'email_verified_at' => now()]);

            // A legacy passengers row with this email and no login is linked instead of duplicated.
            $legacy = Passenger::whereRaw('LOWER(email) = ?', [$email])->whereNull('user_id')->first();
            if ($legacy) {
                $legacy->update(['user_id' => $user->id]);
            } else {
                Passenger::create(['user_id' => $user->id, 'full_name' => $user->name, 'email' => $email, 'phone' => '', 'account_status' => 'active']);
            }

            return $user;
        }));
    }

    /** @param  string  $phone  E.164 (already verified by an OTP) */
    public function signInWithPhone(string $phone): User
    {
        return $this->retryOnce(fn () => DB::transaction(function () use ($phone) {
            $local = PhilippinePhone::toLocal($phone);
            $variants = PhilippinePhone::variants($phone);

            $user = User::where('phone', $phone)->first();
            if ($user) {
                $this->assertCustomer($user, self::RIDER_PHONE_MESSAGE);
                $user->forceFill(['phone_verified_at' => $user->phone_verified_at ?? now()])->save();
                $this->ensurePassenger($user, $local);

                return $user;
            }

            if (Rider::whereIn('phone', $variants)->exists()) {
                throw new CustomerSignInException(self::RIDER_PHONE_MESSAGE);
            }

            // Link to an existing customer whose profile already has this number (legacy format 09XXXXXXXXX).
            $matches = Passenger::whereIn('phone', $variants)->with('user')->get();
            if ($matches->count() > 1) {
                throw new CustomerSignInException('Ginagamit ang numerong ito sa mahigit isang account. Mag-login gamit ang Google o makipag-ugnayan sa support.');
            }

            if ($matches->count() === 1) {
                $passenger = $matches->first();
                $owner = $passenger->user;

                if ($owner && $owner->accountRole() !== AccountRole::Customer) {
                    throw new CustomerSignInException(self::RIDER_PHONE_MESSAGE);
                }

                if ($owner && $owner->phone === null) {
                    $owner->forceFill(['phone' => $phone, 'phone_verified_at' => now()])->save();

                    return $owner;
                }

                if (! $owner) {
                    // Orphan profile (no login yet): give it one instead of creating a second profile.
                    $user = $this->newCustomer(['name' => (string) $passenger->full_name, 'phone' => $phone, 'phone_verified_at' => now()]);
                    $passenger->update(['user_id' => $user->id]);

                    return $user;
                }
                // The owner already has a different verified number: this is a different person's old number, fall through.
            }

            $user = $this->newCustomer(['name' => '', 'phone' => $phone, 'phone_verified_at' => now()]);
            Passenger::create(['user_id' => $user->id, 'full_name' => '', 'email' => null, 'phone' => $local, 'account_status' => 'active']);

            return $user;
        }));
    }

    /** Adds or confirms the phone of a signed-in customer (profile page). Returns false when the number is not usable. */
    public function attachVerifiedPhone(User $user, string $phone): bool
    {
        $takenByOther = User::where('phone', $phone)->where('id', '!=', $user->id)->exists()
            || Rider::whereIn('phone', PhilippinePhone::variants($phone))->exists();

        if ($takenByOther) {
            return false;
        }

        DB::transaction(function () use ($user, $phone) {
            $user->forceFill(['phone' => $phone, 'phone_verified_at' => now()])->save();
            $passenger = $this->ensurePassenger($user);
            $passenger->update(['phone' => PhilippinePhone::toLocal($phone)]); // keep Passenger.phone in sync
        });

        return true;
    }

    public function isPhoneAvailableFor(User $user, string $phone): bool
    {
        return ! User::where('phone', $phone)->where('id', '!=', $user->id)->exists()
            && ! Rider::whereIn('phone', PhilippinePhone::variants($phone))->exists();
    }

    /** @param array<string, mixed> $attributes */
    private function newCustomer(array $attributes): User
    {
        $user = new User(['name' => $attributes['name'] ?? '', 'email' => $attributes['email'] ?? null, 'password' => Str::random(64)]); // random, unusable
        $user->forceFill([
            'role' => AccountRole::Customer->value, // set on the server only
            'google_id' => $attributes['google_id'] ?? null,
            'phone' => $attributes['phone'] ?? null,
            'phone_verified_at' => $attributes['phone_verified_at'] ?? null,
            'email_verified_at' => $attributes['email_verified_at'] ?? null,
        ])->save();

        return $user;
    }

    private function ensurePassenger(User $user, ?string $localPhone = null): Passenger
    {
        $passenger = $user->passenger;

        if (! $passenger) {
            $passenger = Passenger::create([
                'user_id' => $user->id,
                'full_name' => (string) $user->name,
                'email' => $user->email,
                'phone' => $localPhone ?? ($user->phone ? PhilippinePhone::toLocal($user->phone) : ''),
                'account_status' => 'active',
            ]);
            $user->setRelation('passenger', $passenger);
        } elseif ($localPhone !== null && ($passenger->phone === '' || $passenger->phone === null)) {
            $passenger->update(['phone' => $localPhone]);
        }

        return $passenger;
    }

    private function assertCustomer(User $user, string $message): void
    {
        if ($user->accountRole() !== AccountRole::Customer) {
            throw new CustomerSignInException($message);
        }
    }

    /** Two first-time sign-ins racing each other can hit a unique index once; the second pass simply finds the row. */
    private function retryOnce(callable $callback): mixed
    {
        try {
            return $callback();
        } catch (UniqueConstraintViolationException) {
            return $callback();
        }
    }
}
