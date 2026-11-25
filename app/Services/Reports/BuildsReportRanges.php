<?php

namespace App\Services\Reports;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Small helpers shared by every Reports tab. Daily / hourly grouping is done in PHP so the buckets follow the app
 * timezone (Asia/Manila) and behave the same on SQLite and MySQL.
 */
trait BuildsReportRanges
{
    /** One zero-filled row per calendar day in the range, keyed by Y-m-d. */
    protected function dayMap(CarbonInterface $from, CarbonInterface $to, array $template): array
    {
        $days = [];
        for ($d = $from->copy()->startOfDay(); $d->lte($to); $d = $d->copy()->addDay()) {
            $days[$d->toDateString()] = ['date' => $d->toDateString()] + $template;
        }

        return $days;
    }

    protected function dayOf(mixed $value): string
    {
        return Carbon::parse($value, config('app.timezone'))->toDateString();
    }

    protected function stamp(CarbonInterface $d): string
    {
        return $d->format('Y-m-d H:i:s');
    }

    protected function pct(int|float $part, int|float $whole): ?float
    {
        return $whole > 0 ? round($part / $whole * 100, 1) : null;
    }

    protected function iso(mixed $value): ?string
    {
        return $value ? Carbon::parse($value, config('app.timezone'))->toIso8601String() : null;
    }
}
