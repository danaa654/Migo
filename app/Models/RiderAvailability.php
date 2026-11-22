<?php

namespace App\Models;

use App\Enums\RiderAvailabilityStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderAvailability extends Model
{
    protected $table = 'rider_availability';

    protected $fillable = ['rider_id', 'availability_status', 'is_online', 'last_active_at'];

    protected function casts(): array
    {
        return ['is_online' => 'boolean', 'last_active_at' => 'datetime', 'availability_status' => RiderAvailabilityStatus::class];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }
}
