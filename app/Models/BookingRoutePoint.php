<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingRoutePoint extends Model
{
    public $timestamps = false;

    protected $fillable = ['booking_id', 'latitude', 'longitude', 'speed', 'recorded_at'];

    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'speed' => 'float', 'recorded_at' => 'datetime'];
    }
}
