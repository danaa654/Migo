<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class RiderSubscription extends Model
{
    protected $fillable = ['rider_id', 'subscription_plan_id', 'plan_name_snapshot', 'duration_snapshot', 'price_snapshot',
        'subscription_type', 'status', 'starts_at', 'expires_at', 'subscription_payment_id', 'trial_identity'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'expires_at' => 'datetime', 'price_snapshot' => 'float'];
    }

    public function isTrial(): bool
    {
        return $this->subscription_type === 'trial';
    }

    /** Rows that grant access right now. Judged by the timestamps, so the scheduler is only needed for notices. */
    public function scopeEffective(Builder $q, ?CarbonInterface $at = null): Builder
    {
        $at ??= now();

        return $q->whereIn('status', ['active', 'scheduled'])->where('starts_at', '<=', $at)->where('expires_at', '>', $at);
    }
}
