<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Physical motorcycle inspection. Rows are append-only: they are created by App\Actions\Riders\RiderAccreditation and never rewritten. */
class MotorcycleInspection extends Model
{
    protected $table = 'motorcycle_inspections';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['safety_equipment' => 'array', 'roadworthy' => 'boolean', 'registration_expiry' => 'date', 'inspected_at' => 'datetime'];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function inspector(): BelongsTo
    {
        return $this->belongsTo(AdminProfile::class, 'inspector_id');
    }

    public function reinspectionOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reinspection_of_id');
    }
}
