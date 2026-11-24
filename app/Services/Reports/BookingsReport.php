<?php

namespace App\Services\Reports;

use App\Enums\BookingStatus;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Reports > Bookings & Dispatch. Counts use SQL aggregates; per-day, per-hour and duration figures are grouped in
 * PHP so they follow the app timezone (Asia/Manila) and work the same on SQLite and MySQL.
 */
class BookingsReport
{
    /** Statuses where the booking is still in progress (not finished yet). */
    private const ACTIVE = ['pending', 'searching_for_rider', 'rider_assigned', 'rider_arrived', 'in_progress'];

    private const CANCELLED = ['cancelled_by_passenger', 'cancelled_by_rider'];

    private const UNMATCHED = ['no_rider_found', 'expired'];

    /** A booking belongs to the day it was requested (falls back to created_at for old rows). */
    private function base(CarbonInterface $from, CarbonInterface $to, ?string $service)
    {
        return DB::table('bookings')
            ->whereBetween(DB::raw('COALESCE(requested_at, created_at)'), [$from->format('Y-m-d H:i:s'), $to->format('Y-m-d H:i:s')])
            ->when($service, fn ($q, $s) => $q->where('service_type', $s));
    }

    /** Headline numbers for the summary cards (also used for the previous period). */
    public function summary(CarbonInterface $from, CarbonInterface $to, ?string $service): array
    {
        $counts = $this->base($from, $to, $service)
            ->selectRaw('booking_status, count(*) as total')
            ->groupBy('booking_status')
            ->pluck('total', 'booking_status')
            ->map(fn ($n) => (int) $n);

        $total = (int) $counts->sum();
        $completed = (int) ($counts[BookingStatus::Completed->value] ?? 0);
        $active = (int) $counts->only(self::ACTIVE)->sum();
        $finished = $total - $active;

        $fare = $this->base($from, $to, $service)
            ->where('booking_status', BookingStatus::Completed->value)
            ->selectRaw('coalesce(sum(coalesce(final_fare, estimated_fare, 0)), 0) as fare')
            ->value('fare');

        return [
            'total' => $total,
            'completed' => $completed,
            'completion_rate' => $finished > 0 ? round($completed / $finished * 100, 1) : null,
            'fare_value' => round((float) $fare, 2),
            'by_status' => $counts->all(),
            'cancelled' => (int) $counts->only(self::CANCELLED)->sum(),
            'unmatched' => (int) $counts->only(self::UNMATCHED)->sum(),
        ];
    }

    /** Everything the Bookings & Dispatch tab draws. */
    public function build(CarbonInterface $from, CarbonInterface $to, ?string $service): array
    {
        $rows = $this->base($from, $to, $service)
            ->select('booking_status', 'service_type', 'estimated_distance', 'requested_at', 'created_at',
                'assigned_at', 'arrived_at', 'started_at', 'completed_at', 'final_fare', 'estimated_fare')
            ->get();

        $tz = config('app.timezone');
        $days = [];
        for ($d = $from->copy()->startOfDay(); $d->lte($to); $d = $d->addDay()) {
            $days[$d->toDateString()] = ['date' => $d->toDateString(), 'requested' => 0, 'completed' => 0, 'cancelled' => 0];
        }
        $hours = array_fill(0, 24, 0);
        $services = [];
        $match = $pickup = $trip = $distance = [];

        foreach ($rows as $r) {
            $requested = Carbon::parse($r->requested_at ?? $r->created_at, $tz);
            $day = $requested->toDateString();
            $status = $r->booking_status;

            if (isset($days[$day])) {
                $days[$day]['requested']++;
                if ($status === BookingStatus::Completed->value) {
                    $days[$day]['completed']++;
                } elseif (in_array($status, self::CANCELLED, true)) {
                    $days[$day]['cancelled']++;
                }
            }
            $hours[(int) $requested->format('G')]++;

            $key = $r->service_type ?: 'UNKNOWN';
            $services[$key] ??= ['service' => $key, 'total' => 0, 'completed' => 0, 'fare_value' => 0.0];
            $services[$key]['total']++;

            if ($status === BookingStatus::Completed->value) {
                $services[$key]['completed']++;
                $services[$key]['fare_value'] += (float) ($r->final_fare ?? $r->estimated_fare ?? 0);
                if ($r->estimated_distance !== null) {
                    $distance[] = (float) $r->estimated_distance;
                }
            }
            if ($r->assigned_at) {
                $match[] = $this->minutes($requested, $r->assigned_at, $tz);
            }
            if ($r->assigned_at && $r->arrived_at) {
                $pickup[] = $this->minutes($r->assigned_at, $r->arrived_at, $tz);
            }
            if ($r->started_at && $r->completed_at) {
                $trip[] = $this->minutes($r->started_at, $r->completed_at, $tz);
            }
        }

        return [
            'trend' => array_values($days),
            'by_hour' => $hours,
            'by_service' => array_values(array_map(fn ($s) => $s + ['fare_value' => round($s['fare_value'], 2)], $services)),
            'timings' => [
                'avg_match_minutes' => $this->avg($match),
                'avg_pickup_minutes' => $this->avg($pickup),
                'avg_trip_minutes' => $this->avg($trip),
                'avg_distance_km' => $this->avg($distance),
            ],
        ];
    }

    private function minutes(mixed $a, mixed $b, string $tz): float
    {
        $a = $a instanceof CarbonInterface ? $a : Carbon::parse($a, $tz);
        $b = $b instanceof CarbonInterface ? $b : Carbon::parse($b, $tz);

        return max(0, $a->diffInSeconds($b, false)) / 60;
    }

    private function avg(array $values): ?float
    {
        return $values === [] ? null : round(array_sum($values) / count($values), 1);
    }
}