<?php

namespace App\Services\Reports;

use App\Enums\OfferStatus;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Reports > Riders. "Right now" numbers (online, suspended, pending approval) ignore the date range; everything else
 * follows the range and, where it makes sense, the service filter (trips and offers are matched to their booking).
 */
class RidersReport
{
    use BuildsReportRanges;

    /** Bookings that ended, so a rate has a fair denominator. In-progress ones are left out. */
    private const FINISHED = ['completed', 'cancelled_by_rider', 'cancelled_by_passenger'];

    private function newlyApproved(CarbonInterface $from, CarbonInterface $to): int
    {
        return (int) DB::table('riders')->where('application_status', 'approved')
            ->whereBetween('reviewed_at', [$this->stamp($from), $this->stamp($to)])->count();
    }

    public function build(CarbonInterface $from, CarbonInterface $to, ?string $service, CarbonInterface $prevFrom, CarbonInterface $prevTo): array
    {
        $range = [$this->stamp($from), $this->stamp($to)];

        $trips = DB::table('bookings as b')->join('riders as r', 'r.id', '=', 'b.rider_id')
            ->whereNotNull('b.rider_id')
            ->whereBetween(DB::raw('COALESCE(b.requested_at, b.created_at)'), $range)
            ->whereIn('b.booking_status', self::FINISHED)
            ->when($service, fn ($q, $s) => $q->where('b.service_type', $s))
            ->groupBy('b.rider_id', 'r.full_name')
            ->selectRaw("b.rider_id, r.full_name, count(*) as finished,
                sum(case when b.booking_status = 'completed' then 1 else 0 end) as completed,
                sum(case when b.booking_status = 'cancelled_by_rider' then 1 else 0 end) as cancelled_by_rider,
                sum(case when b.booking_status = 'cancelled_by_passenger' then 1 else 0 end) as cancelled_by_passenger,
                sum(case when b.booking_status = 'completed' then coalesce(b.final_fare, b.estimated_fare, 0) else 0 end) as fare")
            ->get()
            ->map(fn ($r) => [
                'rider_id' => $r->rider_id,
                'name' => $r->full_name,
                'finished' => (int) $r->finished,
                'completed' => (int) $r->completed,
                'cancelled_by_rider' => (int) $r->cancelled_by_rider,
                'cancelled_by_passenger' => (int) $r->cancelled_by_passenger,
                'completion_rate' => $this->pct((int) $r->completed, (int) $r->finished),
                'cancel_rate' => $this->pct((int) $r->cancelled_by_rider, (int) $r->finished),
                'fare' => round((float) $r->fare, 2),
            ]);

        $finished = (int) $trips->sum('finished');
        $completed = (int) $trips->sum('completed');
        $riderCancelled = (int) $trips->sum('cancelled_by_rider');

        // ---- offers: how often a rider simply does not answer in time
        $offerRows = DB::table('rider_booking_offers as o')->join('bookings as b', 'b.id', '=', 'o.booking_id')
            ->whereBetween(DB::raw('COALESCE(o.notified_at, o.created_at)'), $range)
            ->when($service, fn ($q, $s) => $q->where('b.service_type', $s))
            ->get(['o.offer_status', 'o.notified_at', 'o.created_at']);

        $days = $this->dayMap($from, $to, ['offers' => 0, 'expired' => 0]);
        $byStatus = [];
        foreach ($offerRows as $o) {
            $st = (string) $o->offer_status;
            $byStatus[$st] = ($byStatus[$st] ?? 0) + 1;
            $day = $this->dayOf($o->notified_at ?? $o->created_at);
            if (isset($days[$day])) {
                $days[$day]['offers']++;
                if ($st === OfferStatus::Expired->value) {
                    $days[$day]['expired']++;
                }
            }
        }
        $offers = $offerRows->count();
        $expired = (int) ($byStatus[OfferStatus::Expired->value] ?? 0);
        $answered = (int) (($byStatus[OfferStatus::Accepted->value] ?? 0) + ($byStatus[OfferStatus::Declined->value] ?? 0));

        $counts = DB::table('riders')->selectRaw("
            sum(case when application_status = 'pending' then 1 else 0 end) as pending,
            sum(case when account_status = 'suspended' then 1 else 0 end) as suspended,
            sum(case when application_status = 'approved' and accreditation_status = 'accredited' and account_status = 'active' then 1 else 0 end) as active,
            count(*) as total")->first();

        $ranked = $trips->sortByDesc('completed')->values();

        return [
            'now' => [
                'online' => (int) DB::table('rider_availability')->where('is_online', true)->count(),
                'pending_approval' => (int) ($counts->pending ?? 0),
                'suspended' => (int) ($counts->suspended ?? 0),
                'active' => (int) ($counts->active ?? 0),
                'total' => (int) ($counts->total ?? 0),
            ],
            'newly_approved' => $this->newlyApproved($from, $to),
            'previous_newly_approved' => $this->newlyApproved($prevFrom, $prevTo),
            'performance' => [
                'riders_with_trips' => $trips->count(),
                'finished' => $finished,
                'completion_rate' => $this->pct($completed, $finished),
                'rider_cancel_rate' => $this->pct($riderCancelled, $finished),
            ],
            'top' => $ranked->take(10)->all(),
            // Needs 3+ finished trips so one cancelled trip does not read as 100%.
            'watch' => $trips->filter(fn ($r) => $r['finished'] >= 3 && $r['cancelled_by_rider'] > 0)
                ->sortByDesc('cancel_rate')->values()->take(5)->all(),
            'offers' => [
                'total' => $offers,
                'accepted' => (int) ($byStatus[OfferStatus::Accepted->value] ?? 0),
                'declined' => (int) ($byStatus[OfferStatus::Declined->value] ?? 0),
                'expired' => $expired,
                'lost' => (int) ($byStatus[OfferStatus::LostToAnotherRider->value] ?? 0),
                'cancelled' => (int) ($byStatus[OfferStatus::Cancelled->value] ?? 0),
                'expiry_rate' => $this->pct($expired, $offers),
                'response_rate' => $this->pct($answered, $answered + $expired),
            ],
            'trend' => array_values($days),
        ];
    }
}
