<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** Penalty points and the chosen action for one upheld complaint (see ComplaintPenaltyService). */
class ComplaintPenalty extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['complaint_id', 'subject_type', 'subject_id', 'severity', 'points', 'action',
        'suspension_ends_at', 'suspension_lifted_at', 'suspension_reason', 'expires_at', 'decided_by', 'created_at'];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'suspension_ends_at' => 'datetime',
            'suspension_lifted_at' => 'datetime',
            'expires_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }
}
