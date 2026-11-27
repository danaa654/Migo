<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Customer profile (existing `passengers` table). account_status: active | suspended | deactivated. */
class Passenger extends Model
{
    use HasUuids;

    protected $fillable = ['user_id', 'full_name', 'email', 'phone', 'account_status', 'suspension_reason', 'avatar_path'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function isActive(): bool
    {
        return $this->account_status === 'active';
    }

    public function isSuspended(): bool
    {
        return $this->account_status === 'suspended';
    }

    public function isDeactivated(): bool
    {
        return $this->account_status === 'deactivated';
    }
}