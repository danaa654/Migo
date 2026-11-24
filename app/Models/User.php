<?php

namespace App\Models;

use App\Concerns\HasTeams;
use App\Enums\AccountRole;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string|null $email
 * @property string|null $google_id
 * @property string|null $phone E.164
 * @property Carbon|null $phone_verified_at
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property bool $has_password
 * @property AccountRole|null $role
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property int|null $current_team_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team|null $currentTeam
 * @property-read Collection<int, Team> $ownedTeams
 * @property-read Collection<int, Membership> $teamMemberships
 * @property-read Collection<int, Team> $teams
 */
#[Fillable(['name', 'email', 'password', 'current_team_id'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token', 'google_id'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasTeams, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'password' => 'hashed',
            'has_password' => 'boolean',
            'role' => AccountRole::class,
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function adminProfile(): HasOne
    {
        return $this->hasOne(AdminProfile::class);
    }

    /** Biker profile / application (only bikers have one). */
    public function rider(): HasOne
    {
        return $this->hasOne(Rider::class);
    }

    /** Customer profile (only customers have one). */
    public function passenger(): HasOne
    {
        return $this->hasOne(Passenger::class);
    }

    /**
     * The account type stored in the database. Rows created before the role column existed
     * fall back to the column default (customer), which is the least-privileged role.
     */
    public function accountRole(): AccountRole
    {
        return $this->role ?? AccountRole::Customer;
    }

    /** An administrator is only valid with an ACTIVE admin profile; the role column alone is not enough. */
    public function isActiveAdmin(): bool
    {
        $profile = $this->adminProfile;

        return $this->accountRole() === AccountRole::Admin
            && $profile?->isActive() === true
            && in_array($profile->role, AdminProfile::ROLES, true);
    }

    /** An active staff member who may open one admin-portal area (riders, bookings, support, staff ...). */
    public function canAccessAdminArea(string $area): bool
    {
        return $this->isActiveAdmin() && $this->adminProfile->hasArea($area);
    }

    /** Where this user's dashboard lives, decided entirely by the stored role. */
    public function dashboardPath(): string
    {
        // Staff land on the first area their admin role allows (Support Staff have no dashboard).
        if ($this->accountRole() === AccountRole::Admin && $this->adminProfile) {
            return $this->adminProfile->homePath();
        }

        return $this->accountRole()->dashboardPath();
    }

    /**
     * Customers who signed in by phone for the first time have no name yet; they must save their full name
     * on /customer/profile before they can use the customer pages or book.
     */
    public function needsProfileCompletion(): bool
    {
        return $this->accountRole() === AccountRole::Customer && trim((string) $this->name) === '';
    }

    /**
     * How this customer signs in, for the profile page. Legacy customers that registered with an email and password
     * keep "password"; Google and phone customers have a random, unusable password.
     *
     * @return list<string>
     */
    public function signInMethods(): array
    {
        $methods = [];
        if ($this->google_id) {
            $methods[] = 'google';
        }
        if ($this->phone && $this->phone_verified_at) {
            $methods[] = 'phone';
        }
        if ($this->email && $this->email_verified_at && ! $this->has_password && ! $this->google_id) {
            $methods[] = 'email';
        }
        if ($this->canChangePassword()) {
            $methods[] = 'password';
        }

        return $methods;
    }

    /** Only accounts with a real, user-chosen password can change it (a Google sign-in later does not take it away). */
    public function canChangePassword(): bool
    {
        return $this->email !== null && $this->has_password;
    }

    /**
     * Passwordless customers (Google / phone / email code) may add a password if they have a verified email,
     * because the password login uses the email address as the identifier.
     */
    public function canSetPassword(): bool
    {
        return $this->email !== null && $this->email_verified_at !== null && ! $this->has_password;
    }
}