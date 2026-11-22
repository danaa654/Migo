<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderLocation extends Model
{
    protected $fillable = ['rider_id', 'latitude', 'longitude', 'heading', 'speed', 'accuracy', 'last_location_update'];

    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'heading' => 'float', 'speed' => 'float',
            'accuracy' => 'float', 'last_location_update' => 'datetime'];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }
}
