<?php

namespace App\Services\Reports;

use App\Enums\BookingStatus;
use App\Enums\ServiceType;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Reports > Revenue. Two separate money streams, never mixed up:
 *  - Ride fare value: COMPLETED bookings only (final_fare, else estimated_fare), by the day the ride was requested,
 *    the same rule the Bookings & Dispatch tab uses. The service filter applies to this stream only.
 *  - Subscription income: VERIFIED payments, GROSS (the Xendit fee is not stored). Not affected by the service filter.
 */
class RevenueReport
{
    use BuildsReportRanges;

    private function rides(CarbonInterface $from, CarbonInterface $to, ?string $service)
    {
        return DB::table('bookings')
            ->whereBetween(DB::raw('COALESCE(requested_at, created_at)'), [$this->stamp($from), $this->stamp($to)])
            ->where('booking_status', BookingStatus::Completed->value)
            ->when($service, fn ($q, $s) => $q->where('service_type', $s));
    }

    private function payments(CarbonInterface $from, CarbonInterface $to)
    {
        return DB::table('subscription_payments')
            ->where('status', 'verified')
            ->whereBetween(DB::raw('COALESCE(verified_at, created_at)'), [$this->stamp($from), $this->stamp($to)]);
    }

    /** Headline money numbers for one period (also used for the previous period). */
    public function totals(CarbonInterface $from, CarbonInterface $to, ?string $service): array
    {
        $r = $this->rides($from, $to, $service)
            ->selectRaw('count(*) as trips, coalesce(sum(coalesce(final_fare, estimated_fare, 0)), 0) as fare')
            ->first();
        $s = $this->payments($from, $to)->selectRaw('count(*) as n, coalesce(sum(amount), 0) as gross')->first();

        $trips = (int) ($r->trips ?? 0);
        $fare = round((float) ($r->fare ?? 0), 2);
        $gross = round((float) ($s->gross ?? 0), 2);

        return [
            'ride_fare' => $fare,
            'trips' => $trips,
            'avg_fare' => $trips > 0 ? round($fare / $trips, 2) : null,
            'subscription_gross' => $gross,
            'subscription_payments' => (int) ($s->n ?? 0),
            'combined' => round($fare + $gross, 2),
        ];
    }

    public function build(CarbonInterface $from, CarbonInterface $to, ?string $service, CarbonInterface $prevFrom, CarbonInterface $prevTo): array
    {
        $keys = array_column(ServiceType::cases(), 'value');
        $zero = array_fill_keys($keys, 0.0);

        $days = $this->dayMap($from, $to, ['services' => $zero, 'rides' => 0.0, 'subscriptions' => 0.0]);
        $svc = [];
        foreach ($keys as $k) {
            $svc[$k] = ['service' => $k, 'trips' => 0, 'fare' => 0.0];
        }

        $rides = $this->rides($from, $to, $service)
            ->get(['service_type', 'requested_at', 'created_at', 'final_fare', 'estimated_fare']);
        foreach ($rides as $r) {
            $fare = (float) ($r->final_fare ?? $r->estimated_fare ?? 0);
            $day = $this->dayOf($r->requested_at ?? $r->created_at);
            $key = $r->service_type ?: 'UNKNOWN';

            if (isset($days[$day])) {
                $days[$day]['rides'] += $fare;
                if (isset($days[$day]['services'][$key])) {
                    $days[$day]['services'][$key] += $fare;
                }
            }
            $svc[$key] ??= ['service' => $key, 'trips' => 0, 'fare' => 0.0];
            $svc[$key]['trips']++;
            $svc[$key]['fare'] += $fare;
        }

        foreach ($this->payments($from, $to)->get(['amount', 'verified_at', 'created_at']) as $p) {
            $day = $this->dayOf($p->verified_at ?? $p->created_at);
            if (isset($days[$day])) {
                $days[$day]['subscriptions'] += (float) $p->amount;
            }
        }

        $totalFare = array_sum(array_column($svc, 'fare'));
        $services = collect($svc)
            ->map(fn ($s) => [
                'service' => $s['service'],
                'trips' => $s['trips'],
                'fare' => round($s['fare'], 2),
                'avg_fare' => $s['trips'] > 0 ? round($s['fare'] / $s['trips'], 2) : null,
                'share' => $this->pct($s['fare'], $totalFare),
            ])
            ->sortByDesc('trips')->values()->all();

        $round = fn (array $d) => [
            'date' => $d['date'],
            'services' => array_map(fn ($v) => round($v, 2), $d['services']),
            'rides' => round($d['rides'], 2),
            'subscriptions' => round($d['subscriptions'], 2),
        ];

        return [
            'trend' => array_map($round, array_values($days)),
            'services' => $services,
            'totals' => $this->totals($from, $to, $service),
            'previous' => $this->totals($prevFrom, $prevTo, $service),
        ];
    }
}
