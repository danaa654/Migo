<?php

namespace App\Http\Controllers;

use App\Models\RiderSubscription;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Services\Subscriptions\PayMongoClient;
use App\Services\Subscriptions\XenditClient;
use App\Services\Subscriptions\SubscriptionService;
use App\Support\BikerShellData;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** Rider side: see my subscription / trial, pick a plan, submit a payment. Everything is decided by the server. */
class BikerSubscriptionController extends Controller
{
    public function index(Request $request, SubscriptionService $subs): Response
    {
        $rider = $request->user()->rider;
        abort_unless($rider, 404);

        // Webhook safety net: if Xendit could not reach us, confirm any paid checkout by asking Xendit directly.
        $subs->reconcileXendit($rider, app(XenditClient::class));

        $access = $subs->access($rider);
        $trial = RiderSubscription::where('rider_id', $rider->id)->where('subscription_type', 'trial')->first();
        $paid = RiderSubscription::where('rider_id', $rider->id)->where('subscription_type', 'paid')->effective()->orderByDesc('expires_at')->first();
        $next = RiderSubscription::where('rider_id', $rider->id)->where('subscription_type', 'paid')->where('starts_at', '>', now())->orderBy('starts_at')->first();
        $iso = fn ($d) => $d?->toIso8601String();
        // Length of THIS rider's trial, as it was when it started (the setting may have changed since).
        $trialDays = $trial ? max(1, (int) ceil($trial->starts_at->diffInHours($trial->expires_at) / 24)) : 1;

        return Inertia::render('biker/biker-subscription', BikerShellData::props($request->user()) + [
            'status' => $request->session()->get('status'),
            'required' => $subs->required(),
            'access' => ['allowed' => $access['allowed'], 'code' => $access['code'], 'message' => $access['message'], 'type' => $access['type']],
            'trial' => $trial ? [
                'starts_at' => $iso($trial->starts_at), 'expires_at' => $iso($trial->expires_at), 'active' => $trial->expires_at->isFuture(),
                'day' => min($trialDays, max(1, (int) floor($trial->starts_at->diffInHours(now()) / 24) + 1)),
                'total_days' => $trialDays,
                'daily_limit' => $subs->trialDailyLimit(),
                'used_today' => $subs->acceptedToday($rider),
            ] : null,
            'paid' => $paid ? ['plan' => $paid->plan_name_snapshot, 'color' => SubscriptionPlan::whereKey($paid->subscription_plan_id)->value('color'), 'duration' => $paid->duration_snapshot, 'amount' => $paid->price_snapshot,
                'starts_at' => $iso($paid->starts_at), 'expires_at' => $iso($paid->expires_at)] : null,
            'next' => $next ? ['plan' => $next->plan_name_snapshot, 'color' => SubscriptionPlan::whereKey($next->subscription_plan_id)->value('color'), 'starts_at' => $iso($next->starts_at), 'expires_at' => $iso($next->expires_at)] : null,
            'plans' => SubscriptionPlan::where('is_active', true)->orderBy('sort_order')->get()->map(fn (SubscriptionPlan $p) => [
                'id' => $p->id, 'name' => $p->name, 'color' => $p->color, 'description' => $p->description, 'duration' => $p->durationLabel(), 'price' => $p->price, 'monthly' => $p->monthlyEquivalent(),
            ]),
            // A checkout that was opened in the last 30 minutes and not paid yet: the page keeps refreshing until PayMongo confirms.
            'hasPending' => SubscriptionPayment::where('rider_id', $rider->id)->where('status', 'pending')->where('created_at', '>=', now()->subMinutes(30))->exists(),
            'returnedFromCheckout' => $request->boolean('paid'),
            'payments' => SubscriptionPayment::where('rider_id', $rider->id)->latest()->limit(20)->get()->map(fn (SubscriptionPayment $p) => [
                'id' => $p->id, 'plan' => $p->plan_name_snapshot, 'amount' => $p->amount, 'method' => SubscriptionPayment::METHODS[$p->payment_method] ?? $p->payment_method,
                'status' => $p->status, 'reason' => $p->rejection_reason, 'created_at' => $iso($p->created_at),
            ]),
            'history' => RiderSubscription::where('rider_id', $rider->id)->orderByDesc('starts_at')->limit(20)->get()->map(fn (RiderSubscription $s) => [
                'id' => $s->id, 'plan' => $s->plan_name_snapshot, 'type' => $s->subscription_type, 'starts_at' => $iso($s->starts_at), 'expires_at' => $iso($s->expires_at),
                'ended' => $s->expires_at->isPast(),
            ]),
        ]);
    }

    /** Opens a hosted checkout (Xendit by default) for the chosen plan. There is no file upload: the gateway confirms the payment. */
    public function store(Request $request, SubscriptionService $subs): SymfonyResponse
    {
        $rider = $request->user()->rider;
        abort_unless($rider, 404);

        $gateway = config('payments.driver') === 'paymongo' ? app(PayMongoClient::class) : app(XenditClient::class);

        $data = $request->validate(['subscription_plan_id' => ['required', 'integer', 'exists:subscription_plans,id']]);

        $url = $subs->startCheckout(
            $rider,
            SubscriptionPlan::findOrFail($data['subscription_plan_id']),
            $gateway,
            route('biker.subscription', ['paid' => 1]),
            route('biker.subscription'),
        );

        return Inertia::location($url); // full-page redirect to the provider's hosted checkout
    }
}