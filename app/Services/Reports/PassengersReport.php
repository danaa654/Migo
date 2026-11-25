<?php

namespace App\Services\Reports;

use App\Enums\BookingStatus;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Reports > Passengers. Sign-ups are not affected by the service filter; booking behaviour is. Bookers are passengers
 * with at least one booking requested in the range (guests with no passenger_id are not counted).
 */
class PassengersReport
{
    use BuildsReportRanges;

    private function signups(CarbonInterface $from, CarbonInterface $to): int
    {
        return (int) DB::table('passengers')->whereBetween('created_at', [$this->stamp($from), $this->stamp($to)])->count();
    }

    public function build(CarbonInterface $from, CarbonInterface $to, ?string $service, CarbonInterface $prevFrom, CarbonInterface $prevTo): array
    {
        $range = [$this->stamp($from), $this->stamp($to)];

        // ---- sign-ups per day
        $days = $this->dayMap($from, $to, ['signups' => 0]);
        foreach (DB::table('passengers')->whereBetween('created_at', $range)->pluck('created_at') as $created) {
            $day = $this->dayOf($created);
            if (isset($days[$day])) {
                $days[$day]['signups']++;
            }
        }

        // ---- booking behaviour, one row per passenger
        $active = "'".implode("','", BookingStatus::ACTIVE)."'";
        $bookers = DB::table('bookings')->whereNotNull('passenger_id')
            ->whereBetween(DB::raw('COALESCE(requested_at, created_at)'), $range)
            ->when($service, fn ($q, $s) => $q->where('service_type', $s))
            ->groupBy('passenger_id')
            ->selectRaw("passenger_id, count(*) as total,
                sum(case when booking_status not in ({$active}) then 1 else 0 end) as finished,
                sum(case when booking_status = 'completed' then 1 else 0 end) as completed,
                sum(case when booking_status = 'cancelled_by_passenger' then 1 else 0 end) as cancelled")
            ->get();

        $buckets = ['1' => 0, '2' => 0, '3-4' => 0, '5+' => 0];
        foreach ($bookers as $b) {
            $n = (int) $b->total;
            $buckets[$n >= 5 ? '5+' : ($n >= 3 ? '3-4' : (string) $n)]++;
        }
        $count = $bookers->count();
        $oneTime = $buckets['1'];
        $finished = (int) $bookers->sum('finished');
        $cancelled = (int) $bookers->sum('cancelled');

        $status = DB::table('passengers')->selectRaw('account_status, count(*) as n')->groupBy('account_status')->pluck('n', 'account_status')
            ->map(fn ($n) => (int) $n)->all();

        $new = $this->signups($from, $to);

        return [
            'signups' => $new,
            'previous_signups' => $this->signups($prevFrom, $prevTo),
            'total_passengers' => (int) array_sum($status),
            'by_status' => $status,
            'bookers' => $count,
            'one_time' => $oneTime,
            'repeat' => $count - $oneTime,
            'repeat_rate' => $this->pct($count - $oneTime, $count),
            'avg_bookings' => $count > 0 ? round((int) $bookers->sum('total') / $count, 1) : null,
            'cancelled' => $cancelled,
            'cancellation_rate' => $this->pct($cancelled, $finished),
            'buckets' => collect($buckets)->map(fn ($n, $k) => ['label' => $k, 'passengers' => $n])->values()->all(),
            'trend' => array_values($days),
        ];
    }
}
