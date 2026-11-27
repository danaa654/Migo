<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The staff profile behind an account whose users.role is "admin". The profile role decides WHICH admin-portal
 * areas that person may open (see AREAS). Everyone here signs in through the Admin Login.
 */
class AdminProfile extends Model
{
    use HasUuids;

    public const ROLE_SUPER_ADMIN = 'super_admin';   // the Administrator: creates staff accounts, changes settings

    public const ROLE_ADMIN = 'admin';               // legacy full admin (no staff-account creation)

    public const ROLE_OPERATIONS = 'operations_admin';

    public const ROLE_SUPPORT = 'support_staff';

    public const ROLES = [self::ROLE_SUPER_ADMIN, self::ROLE_ADMIN, self::ROLE_OPERATIONS, self::ROLE_SUPPORT];

    /** The only account types an Administrator can create from the Staff Accounts page. */
    public const CREATABLE_ROLES = [self::ROLE_OPERATIONS, self::ROLE_SUPPORT];

    /**
     * Admin-portal areas per role. Routes are protected with the "admin.area:<area>" middleware.
     *  - riders:         rider applications, document verification, orientation, inspection, accreditation
     *  - subscriptions:  subscription management
     *  - bookings:       live booking / dispatch monitor
     *  - support_dashboard: Support Staff landing page (report counts only, no rider or booking data)
     *  - support:        tickets, complaints, incident reports
     *  - passengers:     passenger list and details (read-only; Support Staff have this one only)
     *  - passengers_manage: suspend / deactivate / reactivate a passenger (Administrator only)
     *  - staff:          creating and suspending Operations Admin / Support Staff accounts (Administrator only)
     */
    private const AREAS = [
        self::ROLE_SUPER_ADMIN => ['dashboard', 'riders', 'subscriptions', 'subscriptions_verify', 'subscriptions_manage', 'bookings', 'passengers', 'passengers_manage', 'support', 'reports', 'notifications', 'settings', 'staff'],
        self::ROLE_ADMIN => ['dashboard', 'riders', 'subscriptions', 'subscriptions_verify', 'subscriptions_manage', 'bookings', 'passengers', 'passengers_manage', 'support', 'reports', 'notifications', 'settings'],
        self::ROLE_OPERATIONS => ['dashboard', 'riders', 'subscriptions', 'subscriptions_verify', 'bookings', 'notifications'],
        self::ROLE_SUPPORT => ['support_dashboard', 'support', 'passengers', 'subscriptions'],
    ];

    private const LABELS = [
        self::ROLE_SUPER_ADMIN => 'Administrator',
        self::ROLE_ADMIN => 'Administrator',
        self::ROLE_OPERATIONS => 'Operations Admin',
        self::ROLE_SUPPORT => 'Support Staff',
    ];

    protected $fillable = ['user_id', 'full_name', 'email', 'role', 'status'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /** @return list<string> */
    public function areas(): array
    {
        return self::AREAS[$this->role] ?? [];
    }

    public function hasArea(string $area): bool
    {
        return in_array($area, $this->areas(), true);
    }

    public function roleLabel(): string
    {
        return self::LABELS[$this->role] ?? 'Staff';
    }

    /** Public URL of the staff member's chosen profile photo, or null when none was uploaded. */
    public function avatarUrl(): ?string
    {
        return $this->avatar_path ? '/storage/'.ltrim($this->avatar_path, '/') : null;
    }

    /** The first page this staff member lands on after signing in. */
    public function homePath(): string
    {
        if ($this->hasArea('dashboard')) {
            return '/admin/dashboard';
        }

        return $this->hasArea('support_dashboard') ? '/admin/support/dashboard' : '/admin/complaints';
    }
}