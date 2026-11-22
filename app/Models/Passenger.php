<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Customer profile (existing `passengers` table). account_status: active | suspended | deactivated. */
class Passenger extends Model
{
    use HasUuids;

    protected $fillable = ['user_id', 'full_name', 'email', 'phone', 'account_status'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
