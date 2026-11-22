<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Orientation schedule + attendance. Created and updated only by App\Actions\Riders\RiderAccreditation; every change is also logged in rider_accreditation_history. */
class RiderOrientation extends Model
{
    protected $table = 'rider_orientations';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['scheduled_at' => 'datetime', 'attended' => 'boolean', 'attendance_recorded_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(AdminProfile::class, 'facilitator_id');
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(AdminProfile::class, 'completed_by');
    }
}
