<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Append-only log of every accreditation decision (who, what, from/to status, remarks). */
class RiderAccreditationHistory extends Model
{
    protected $table = 'rider_accreditation_history';

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(AdminProfile::class, 'actor_id');
    }
}
