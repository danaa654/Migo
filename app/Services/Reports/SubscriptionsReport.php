<?php

namespace App\Services\Reports;

use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Reports > Subscriptions. Money is GROSS (verified payments, before Xendit fees). The service filter does not apply:
 * subscriptions are not tied to a ride service. "Active now" numbers ignore the date range on purpose.
 */
class SubscriptionsReport
{
    use BuildsReportRanges;

    /** A pending checkout older than this is treated as abandoned (SubscriptionService reuses younger ones). */
    private const ABANDONED_AFTER_MINUTES = 30;

    private function effective(?string $type = null)
    {
        $now = $this->stamp(now());

        return DB::table('rider_subscriptions')
            ->whereIn('status', ['active', 'scheduled'])->where('starts_at', '<=', $now)->where('expires_at', '>', $now)
            ->when($type, fn ($q, $t) => $q->where('subscription_type', $t));
    }

    /** Trials started in the range, and how many of those riders have paid since. */
    private function trials(CarbonInterface $from, CarbonInterface $to): array
    {
        $base = DB::table('rider_subscriptions as t')
            ->where('t.subscription_type', 'trial')
            ->whereBetween('t.starts_at', [$this->stamp($from), $this->stamp($to)]);

        $started = (int) (clone $base)->count();
        $converted = (int) (clone $base)->whereExists(fn ($q) => $q->select(DB::raw(1))->from('subscription_payments as p')
            ->whereColumn('p.rider_id', 't.rider_id')->where('p.status', 'verified')
            ->whereColumn(DB::raw('COALESCE(p.verified_at, p.created_at)'), '>=', 't.starts_at'))->count();

        return ['started' => $started, 'converted' => $converted, 'rate' => $this->pct($converted, $started)];
    }

    private function failed(CarbonInterface $from, CarbonInterface $to): array
    {
        $range = [$this->stamp($from), $this->stamp($to)];
        $failed = DB::table('subscription_payments')->where('status', 'failed')->whereBetween('created_at', $range)
            ->selectRaw('count(*) as n, coalesce(sum(amount), 0) as value')->first();
        $abandoned = (int) DB::table('subscription_payments')->where('status', 'pending')->whereBetween('created_at', $range)
            ->where('created_at', '<', $this->stamp(now()->subMinutes(self::ABANDONED_AFTER_MINUTES)))->count();

        return [
            'failed' => (int) ($failed->n ?? 0),
            'failed_value' => round((float) ($failed->value ?? 0), 2),
            'abandoned' => $abandoned,
        ];
    }

    public function build(CarbonInterface $from, CarbonInterface $to, CarbonInterface $prevFrom, CarbonInterface $prevTo): array
    {
        $range = [$this->stamp($from), $this->stamp($to)];
        $days = $this->dayMap($from, $to, ['gross' => 0.0, 'new' => 0, 'renewals' => 0, 'expirations' => 0]);

        // ---- revenue per plan + payment method (verified payments in the range)
        $payments = DB::table('subscription_payments')->where('status', 'verified')
            ->whereBetween(DB::raw('COALESCE(verified_at, created_at)'), $range)
            ->get(['subscription_plan_id', 'plan_name_snapshot', 'amount', 'payment_method', 'verified_at', 'created_at']);

        $plans = SubscriptionPlan::orderBy('sort_order')->orderBy('id')->get();
        $byPlan = [];
        foreach ($plans as $p) {
            $byPlan['id:'.$p->id] = ['id' => $p->id, 'name' => $p->name, 'color' => $p->color, 'price' => (float) $p->price,
                'duration' => $p->durationLabel(), 'is_active' => (bool) $p->is_active, 'purchases' => 0, 'gross' => 0.0];
        }
        $methods = [];
        foreach ($payments as $p) {
            // A deleted plan keeps its payments through the snapshot name.
            $key = $p->subscription_plan_id && isset($byPlan['id:'.$p->subscription_plan_id]) ? 'id:'.$p->subscription_plan_id : 'name:'.$p->plan_name_snapshot;
            $byPlan[$key] ??= ['id' => null, 'name' => $p->plan_name_snapshot, 'color' => null, 'price' => null, 'duration' => null, 'is_active' => false, 'purchases' => 0, 'gross' => 0.0];
            $byPlan[$key]['purchases']++;
            $byPlan[$key]['gross'] += (float) $p->amount;

            $m = SubscriptionPayment::METHODS[$p->payment_method] ?? ($p->payment_method ?: 'Unknown');
            $methods[$m] ??= ['method' => $m, 'payments' => 0, 'gross' => 0.0];
            $methods[$m]['payments']++;
            $methods[$m]['gross'] += (float) $p->amount;

            $day = $this->dayOf($p->verified_at ?? $p->created_at);
            if (isset($days[$day])) {
                $days[$day]['gross'] += (float) $p->amount;
            }
        }

        // ---- first purchases vs renewals (a renewal = the rider already had an earlier paid subscription)
        $isRenewal = "exists (select 1 from rider_subscriptions e where e.rider_id = s.rider_id and e.subscription_type = 'paid' and e.id < s.id)";
        $bought = DB::table('rider_subscriptions as s')->where('s.subscription_type', 'paid')->whereBetween('s.created_at', $range)
            ->selectRaw("s.created_at, {$isRenewal} as is_renewal")->get();
        $new = $renewals = 0;
        foreach ($bought as $b) {
            $day = $this->dayOf($b->created_at);
            if ((int) $b->is_renewal === 1) {
                $renewals++;
                if (isset($days[$day])) {
                    $days[$day]['renewals']++;
                }
            } else {
                $new++;
                if (isset($days[$day])) {
                    $days[$day]['new']++;
                }
            }
        }

        // ---- expirations: periods that ended in the range. A paid one is "renewed" when the rider has another paid
        // period that starts at or after its end (a queued renewal starts exactly when the old one ends).
        $until = $to->lt(now()) ? $to : now();
        $renewed = "exists (select 1 from rider_subscriptions n where n.rider_id = s.rider_id and n.subscription_type = 'paid' and n.id <> s.id and n.status <> 'cancelled' and n.starts_at >= s.expires_at)";
        $ended = DB::table('rider_subscriptions as s')->where('s.status', '<>', 'cancelled')
            ->whereBetween('s.expires_at', [$this->stamp($from), $this->stamp($until)])
            ->selectRaw("s.subscription_type, s.expires_at, {$renewed} as renewed")->get();
        $paidEnded = $paidRenewed = $trialsEnded = 0;
        foreach ($ended as $e) {
            $day = $this->dayOf($e->expires_at);
            if ($e->subscription_type === 'trial') {
                $trialsEnded++;
            } else {
                $paidEnded++;
                if ((int) $e->renewed === 1) {
                    $paidRenewed++;
                }
            }
            if (isset($days[$day])) {
                $days[$day]['expirations']++;
            }
        }

        $planRows = collect($byPlan)->map(fn ($p) => array_merge($p, ['gross' => round($p['gross'], 2)]))->values()->all();

        $trials = $this->trials($from, $to);
        $prevTrials = $this->trials($prevFrom, $prevTo);
        $failed = $this->failed($from, $to);
        $prevFailed = $this->failed($prevFrom, $prevTo);
        $gross = round((float) $payments->sum('amount'), 2);

        return [
            'now' => [
                'active_paid' => (int) $this->effective('paid')->count(),
                'active_trials' => (int) $this->effective('trial')->count(),
                'expiring_soon' => (int) $this->effective('paid')->where('expires_at', '<=', $this->stamp(now()->addDays(7)))->count(),
                'riders_with_access' => (int) $this->effective()->distinct()->count('rider_id'),
            ],
            'trials' => $trials,
            'previous_trials' => $prevTrials,
            'gross' => $gross,
            'previous_gross' => round((float) DB::table('subscription_payments')->where('status', 'verified')
                ->whereBetween(DB::raw('COALESCE(verified_at, created_at)'), [$this->stamp($prevFrom), $this->stamp($prevTo)])->sum('amount'), 2),
            'purchases' => $payments->count(),
            'by_plan' => $planRows,
            'methods' => collect($methods)->map(fn ($m) => array_merge($m, ['gross' => round($m['gross'], 2)]))->sortByDesc('gross')->values()->all(),
            'lifecycle' => [
                'new' => $new,
                'renewals' => $renewals,
                'paid_ended' => $paidEnded,
                'paid_renewed' => $paidRenewed,
                'paid_lapsed' => $paidEnded - $paidRenewed,
                'renewal_rate' => $this->pct($paidRenewed, $paidEnded),
                'trials_ended' => $trialsEnded,
            ],
            'failed' => $failed,
            'previous_failed' => $prevFailed,
            'trend' => array_map(fn ($d) => ['gross' => round($d['gross'], 2)] + $d, array_values($days)),
        ];
    }
}
