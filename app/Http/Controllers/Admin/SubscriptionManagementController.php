<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RiderSubscription;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Services\Subscriptions\SubscriptionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin > Subscription Management. Payments are confirmed by PayMongo (webhook), so admins only READ them here.
 * Permissions are enforced by the "admin.area:" route middleware:
 *  - subscriptions         read subscriptions, payments (without proof) and plans (Administrator, Operations Admin, Support Staff)
 *  - subscriptions_manage  create / edit / (de)activate plans (Administrator only)
 */
class SubscriptionManagementController extends Controller
{
    private const PER_PAGE = 15;

    private const TABS = ['overview', 'subscriptions', 'payments', 'plans'];

    public function index(Request $request): Response
    {
        $admin = $request->user()->adminProfile;
        $tab = in_array($request->query('tab'), self::TABS, true) ? $request->query('tab') : 'overview';

        return Inertia::render('admin/subscriptions', [
            'tab' => $tab,
            'status' => $request->session()->get('status'),
            'canManage' => (bool) $admin?->hasArea('subscriptions_manage'),
            'stats' => $this->stats(),
            'subscriptions' => $tab === 'subscriptions' ? $this->subscriptions($request) : null,
            'payments' => $tab === 'payments' ? $this->payments($request) : null,
            'plans' => in_array($tab, ['plans', 'subscriptions'], true) ? $this->plans() : null,
            'filters' => [
                'status' => (string) $request->query('status', ''),
                'plan' => (string) $request->query('plan', ''),
                'search' => trim((string) $request->query('search', '')),
                'from' => (string) $request->query('from', ''),
                'to' => (string) $request->query('to', ''),
            ],
        ]);
    }

    // ------------------------------------------------------------------ plans

    public function storePlan(Request $request, SubscriptionService $subs): RedirectResponse
    {
        $plan = SubscriptionPlan::create($this->planData($request) + ['sort_order' => (int) SubscriptionPlan::max('sort_order') + 1]);
        $subs->auditPlan($request->user()->adminProfile, 'subscription.plan_created', "Plan {$plan->name} created at ₱{$plan->price}", $plan->id);

        return back()->with('status', "Plan {$plan->name} created.");
    }

    /** Editing a plan never changes existing subscriptions: they keep their own snapshot of name, duration and price. */
    public function updatePlan(Request $request, SubscriptionPlan $plan, SubscriptionService $subs): RedirectResponse
    {
        $plan->update($this->planData($request));
        $subs->auditPlan($request->user()->adminProfile, 'subscription.plan_updated', "Plan {$plan->name} updated (₱{$plan->price}, {$plan->durationLabel()})", $plan->id);

        return back()->with('status', "Plan {$plan->name} updated. Existing subscriptions keep their original price and duration.");
    }

    public function togglePlan(Request $request, SubscriptionPlan $plan, SubscriptionService $subs): RedirectResponse
    {
        $plan->update(['is_active' => ! $plan->is_active]);
        $subs->auditPlan($request->user()->adminProfile, 'subscription.plan_'.($plan->is_active ? 'activated' : 'deactivated'), "Plan {$plan->name}", $plan->id);

        return back()->with('status', "Plan {$plan->name} ".($plan->is_active ? 'activated.' : 'deactivated. It can no longer be purchased.'));
    }

    private function planData(Request $request): array
    {
        $d = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'duration_value' => ['required', 'integer', 'min:1', 'max:120'],
            'duration_unit' => ['required', Rule::in(SubscriptionPlan::UNITS)],
            'price' => ['required', 'numeric', 'min:1', 'max:1000000'],
        ]);

        return $d + ['is_active' => $request->boolean('is_active', true)];
    }

    // ------------------------------------------------------------------ data for the tabs

    private function stats(): array
    {
        $eff = fn (?string $type = null) => RiderSubscription::effective()->when($type, fn ($q, $t) => $q->where('subscription_type', $t));

        return [
            'active_riders' => (int) $eff()->distinct()->count('rider_id'),
            'active_trials' => (int) $eff('trial')->count(),
            'active_paid' => (int) $eff('paid')->count(),
            'expiring_soon' => (int) $eff('paid')->where('expires_at', '<=', now()->addDays(7))->count(),
            'expired' => (int) RiderSubscription::where('expires_at', '<=', now())->count(),
            'pending_payments' => (int) SubscriptionPayment::where('status', 'pending')->count(),
            // Verified payments only: pending and rejected ones are never revenue.
            'revenue' => (float) SubscriptionPayment::where('status', 'verified')->sum('amount'),
            'trials_started' => (int) RiderSubscription::where('subscription_type', 'trial')->count(),
            'trials_converted' => (int) DB::table('rider_subscriptions as t')->where('t.subscription_type', 'trial')
                ->whereExists(fn ($q) => $q->select(DB::raw(1))->from('subscription_payments as p')->whereColumn('p.rider_id', 't.rider_id')->where('p.status', 'verified'))
                ->count(),
        ];
    }

    private function like(string $s): string
    {
        return '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_substr($s, 0, 100)).'%';
    }

    private function subscriptions(Request $request)
    {
        $status = (string) $request->query('status', '');
        $plan = (int) $request->query('plan', 0);
        $search = trim((string) $request->query('search', ''));
        $now = now()->format('Y-m-d H:i:s');
        $soon = now()->addDays(7)->format('Y-m-d H:i:s');

        return DB::table('rider_subscriptions as s')
            ->join('riders as r', 'r.id', '=', 's.rider_id')
            ->select('s.id', 's.rider_id', 'r.full_name', 'r.email', 's.plan_name_snapshot', 's.duration_snapshot', 's.price_snapshot',
                's.subscription_type', 's.status', 's.starts_at', 's.expires_at')
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w->whereRaw("r.full_name like ? escape '!'", [$this->like($search)])->orWhereRaw("r.email like ? escape '!'", [$this->like($search)])))
            ->when($plan > 0, fn ($q) => $q->where('s.subscription_plan_id', $plan))
            ->when($status === 'active', fn ($q) => $q->whereIn('s.status', ['active', 'scheduled'])->where('s.starts_at', '<=', $now)->where('s.expires_at', '>', $now))
            ->when($status === 'trial', fn ($q) => $q->where('s.subscription_type', 'trial')->whereIn('s.status', ['active', 'scheduled'])->where('s.expires_at', '>', $now))
            ->when($status === 'paid', fn ($q) => $q->where('s.subscription_type', 'paid')->whereIn('s.status', ['active', 'scheduled'])->where('s.starts_at', '<=', $now)->where('s.expires_at', '>', $now))
            ->when($status === 'expiring', fn ($q) => $q->where('s.subscription_type', 'paid')->whereIn('s.status', ['active', 'scheduled'])->where('s.expires_at', '>', $now)->where('s.expires_at', '<=', $soon))
            ->when($status === 'expired', fn ($q) => $q->where('s.expires_at', '<=', $now))
            ->when($status === 'scheduled', fn ($q) => $q->where('s.starts_at', '>', $now))
            ->orderByDesc('s.starts_at')->orderByDesc('s.id')
            ->paginate(self::PER_PAGE)->withQueryString()
            ->through(function ($s) {
                $ends = \Illuminate\Support\Carbon::parse($s->expires_at);
                $state = $ends->lte(now()) ? 'expired' : (\Illuminate\Support\Carbon::parse($s->starts_at)->gt(now()) ? 'scheduled'
                    : ($s->subscription_type === 'paid' && $ends->lte(now()->addDays(7)) ? 'expiring' : 'active'));

                return [
                    'id' => $s->id, 'rider_id' => $s->rider_id, 'rider' => $s->full_name, 'email' => $s->email,
                    'plan' => $s->plan_name_snapshot, 'duration' => $s->duration_snapshot, 'price' => (float) $s->price_snapshot,
                    'type' => $s->subscription_type, 'state' => $state,
                    'starts_at' => \Illuminate\Support\Carbon::parse($s->starts_at)->toIso8601String(), 'expires_at' => $ends->toIso8601String(),
                ];
            });
    }

    private function payments(Request $request)
    {
        $status = in_array($request->query('status'), ['pending', 'verified', 'failed', 'cancelled', 'refunded'], true) ? $request->query('status') : null;
        $search = trim((string) $request->query('search', ''));
        $from = $this->date($request->query('from'));
        $to = $this->date($request->query('to'));

        return DB::table('subscription_payments as p')
            ->join('riders as r', 'r.id', '=', 'p.rider_id')
            ->leftJoin('admin_profiles as a', 'a.id', '=', 'p.verified_by')
            ->select('p.id', 'r.full_name', 'r.email', 'p.plan_name_snapshot', 'p.duration_snapshot', 'p.amount', 'p.payment_method',
                'p.provider_payment_id', 'p.status', 'p.rejection_reason', 'p.verified_at', 'p.created_at',
                'p.rider_subscription_id', 'a.full_name as reviewer')
            ->when($status, fn ($q, $s) => $q->where('p.status', $s))
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w->whereRaw("r.full_name like ? escape '!'", [$this->like($search)])->orWhereRaw("p.provider_payment_id like ? escape '!'", [$this->like($search)])))
            ->when($from, fn ($q, $d) => $q->where('p.created_at', '>=', $d.' 00:00:00'))
            ->when($to, fn ($q, $d) => $q->where('p.created_at', '<=', $d.' 23:59:59'))
            ->orderByRaw("case p.status when 'pending' then 0 else 1 end")->orderByDesc('p.created_at')
            ->paginate(self::PER_PAGE)->withQueryString()
            ->through(fn ($p) => [
                'id' => $p->id, 'rider' => $p->full_name, 'email' => $p->email, 'plan' => $p->plan_name_snapshot, 'duration' => $p->duration_snapshot,
                'amount' => (float) $p->amount, 'method' => SubscriptionPayment::METHODS[$p->payment_method] ?? $p->payment_method,
                'reference' => $p->provider_payment_id, 'status' => $p->status,
                'rejection_reason' => $p->rejection_reason, 'reviewer' => $p->reviewer,
                'verified_at' => $p->verified_at ? \Illuminate\Support\Carbon::parse($p->verified_at)->toIso8601String() : null,
                'created_at' => \Illuminate\Support\Carbon::parse($p->created_at)->toIso8601String(),
            ]);
    }

    private function plans(): array
    {
        $counts = DB::table('rider_subscriptions')->where('subscription_type', 'paid')->selectRaw('subscription_plan_id, count(*) as n')->groupBy('subscription_plan_id')->pluck('n', 'subscription_plan_id');

        return SubscriptionPlan::orderBy('sort_order')->orderBy('id')->get()->map(fn (SubscriptionPlan $p) => [
            'id' => $p->id, 'name' => $p->name, 'description' => $p->description, 'duration_value' => $p->duration_value,
            'duration_unit' => $p->duration_unit, 'duration' => $p->durationLabel(), 'price' => $p->price,
            'monthly' => $p->monthlyEquivalent(), 'is_active' => $p->is_active, 'subscribers' => (int) ($counts[$p->id] ?? 0),
        ])->all();
    }

    private function date(mixed $v): ?string
    {
        return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : null;
    }
}
