<?php

namespace App\Models;

use App\Enums\VehicleType;
use Database\Factories\RiderFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Biker profile + application (existing `riders` table; "Rider" is the administrator-facing label).
 * application_status (verification): pending | approved | rejected. account_status: active | suspended.
 * The two are independent: an approved rider can have a suspended account.
 *
 * Accreditation adds one status column per process (document_verification_status, orientation_status,
 * inspection_status, accreditation_status). They are NOT mass-assignable: only App\Actions\Riders\RiderAccreditation
 * changes them, after checking the acting staff member, so a rider can never edit their own accreditation.
 */
class Rider extends Model
{
    /** @use HasFactory<RiderFactory> */
    use HasFactory, HasUuids;

    public const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'];

    protected $fillable = [
        'user_id', 'full_name', 'email', 'phone', 'address', 'profile_picture',
        'license_number', 'license_expiry', 'motorcycle_plate_number', 'vehicle_type', 'application_status',
        'account_status', 'rejection_reason', 'suspension_reason', 'reviewed_at', 'reviewed_by',
        'license_document', 'registration_document', 'official_receipt', 'nbi_clearance',
    ];

    protected function casts(): array
    {
        return [
            'license_expiry' => 'date', 'reviewed_at' => 'datetime', 'vehicle_type' => VehicleType::class,
            'accredited_at' => 'datetime', 'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isApproved(): bool
    {
        return $this->application_status === 'approved';
    }

    public function isSuspended(): bool
    {
        return $this->account_status === 'suspended';
    }

    public function isAccredited(): bool
    {
        return $this->accreditation_status === 'accredited';
    }

    /**
     * Restricted rider functions (service requests, bookings, ...) need an approved application, FINAL accreditation
     * (documents verified in person, orientation completed, motorcycle inspection passed) and an ACTIVE account.
     * Initial application approval alone never grants booking privileges.
     */
    public function canAcceptRequests(): bool
    {
        return $this->isApproved() && $this->isAccredited() && $this->account_status === 'active';
    }

    public function documentVerifications(): HasMany
    {
        return $this->hasMany(RiderDocumentVerification::class)->orderBy('id');
    }

    public function orientations(): HasMany
    {
        return $this->hasMany(RiderOrientation::class)->orderBy('id');
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(MotorcycleInspection::class)->orderBy('id');
    }

    public function accreditationHistory(): HasMany
    {
        return $this->hasMany(RiderAccreditationHistory::class)->orderBy('id');
    }

    public function latestDocumentVerification(): HasOne
    {
        return $this->hasOne(RiderDocumentVerification::class)->latestOfMany();
    }

    public function latestOrientation(): HasOne
    {
        return $this->hasOne(RiderOrientation::class)->latestOfMany();
    }

    public function latestInspection(): HasOne
    {
        return $this->hasOne(MotorcycleInspection::class)->latestOfMany();
    }
}
