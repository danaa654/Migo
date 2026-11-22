<?php

namespace App\Models;

use App\Enums\OfferStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderBookingOffer extends Model
{
    protected $fillable = ['booking_id', 'rider_id', 'distance_to_pickup', 'estimated_pickup_time', 'offer_status',
        'notified_at', 'expires_at', 'responded_at'];

    protected function casts(): array
    {
        return ['offer_status' => OfferStatus::class, 'notified_at' => 'datetime', 'expires_at' => 'datetime', 'responded_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }
}
