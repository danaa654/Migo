<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row of the Support Center inbox (existing `complaints` table). report_type says what it is:
 * complaint (about a person), support (help request, never names anyone) or incident (safety report).
 * complaint_status: pending -> under_investigation -> resolved | rejected (a pending one may also be rejected).
 */
class Complaint extends Model
{
    use HasUuids;

    public const OPEN = ['pending', 'under_investigation'];

    public const TYPE_COMPLAINT = 'complaint';

    public const TYPE_SUPPORT = 'support';

    public const TYPE_INCIDENT = 'incident';

    public const TYPES = [self::TYPE_COMPLAINT, self::TYPE_SUPPORT, self::TYPE_INCIDENT];

    protected $fillable = ['reporter_id', 'reporter_type', 'report_type', 'complaint_category', 'description', 'complaint_status',
        'booking_id', 'against_type', 'against_id', 'assigned_to', 'resolution_note', 'resolved_at',
        'occurred_at', 'incident_location'];

    protected $attributes = ['report_type' => self::TYPE_COMPLAINT];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime', 'occurred_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(AdminProfile::class, 'assigned_to');
    }

    public function isOpen(): bool
    {
        return in_array($this->complaint_status, self::OPEN, true);
    }

    /** Incidents are safety reports: flagged and listed first for staff. */
    public function isSafety(): bool
    {
        return $this->report_type === self::TYPE_INCIDENT;
    }

    /** Only complaints and incidents can add penalty points, and only when they name a person. */
    public function canCarryPenalty(): bool
    {
        return $this->report_type !== self::TYPE_SUPPORT && $this->against_type && $this->against_id;
    }
}
