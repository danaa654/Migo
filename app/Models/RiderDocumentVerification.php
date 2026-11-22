<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Face-to-face document check. Rows are append-only: they are created by App\Actions\Riders\RiderAccreditation and never rewritten. */
class RiderDocumentVerification extends Model
{
    protected $table = 'rider_document_verifications';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['documents_checked' => 'array', 'verified_at' => 'datetime'];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(AdminProfile::class, 'verified_by');
    }
}
