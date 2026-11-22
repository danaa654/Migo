<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\ServiceType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A ride request (existing `bookings` table). rider_id is the ASSIGNED rider.
 * booking_status values: see App\Enums\BookingStatus (stored lowercase snake_case).
 */
class Booking extends Model
{
    use HasUuids;

    /** Statuses that count as "in progress" (a customer may have only one at a time). */
    public const ACTIVE = BookingStatus::ACTIVE;

    protected $fillable = ['passenger_id', 'rider_id', 'pickup_location', 'destination', 'booking_status', 'booking_date',
        'pickup_lat', 'pickup_lng', 'destination_lat', 'destination_lng', 'booking_reference', 'estimated_distance',
        'estimated_duration', 'estimated_fare', 'requested_at', 'service_type', 'passenger_count', 'notes', 'recipient_name',
        'recipient_phone', 'item_description', 'package_size'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['service_type' => ServiceType::class, 'passenger_count' => 'integer', 'pickup_lat' => 'float', 'pickup_lng' => 'float', 'destination_lat' => 'float', 'destination_lng' => 'float',
            'estimated_distance' => 'float', 'estimated_fare' => 'float', 'final_fare' => 'float',
            'current_search_radius_km' => 'float', 'requested_at' => 'datetime', 'search_started_at' => 'datetime',
            'last_expansion_at' => 'datetime', 'assigned_at' => 'datetime', 'arrived_at' => 'datetime',
            'started_at' => 'datetime', 'completed_at' => 'datetime', 'cancelled_at' => 'datetime'];
    }

    public function status(): BookingStatus
    {
        return BookingStatus::from($this->booking_status);
    }

    /** MIGOMOTO, MIGOCARS or MIGODALA (rows created before services existed are MigoMoto). */
    public function service(): ServiceType
    {
        return $this->service_type ?? ServiceType::MigoMoto;
    }

    public function passenger(): BelongsTo
    {
        return $this->belongsTo(Passenger::class);
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function offers(): HasMany
    {
        return $this->hasMany(RiderBookingOffer::class);
    }
}
