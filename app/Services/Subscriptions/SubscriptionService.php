<?php

namespace App\Services\Subscriptions;

use App\Models\AdminProfile;
use App\Models\Booking;
use App\Models\DispatchSetting;
use App\Models\Rider;
use App\Models\RiderSubscription;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use Carbon\CarbonInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * All subscription rules live here: free trial, booking access, payment verification, renewal stacking, expiry
 * and reminders. Controllers and the dispatch engine only call this class.
 */
class SubscriptionService
{
    /** Defaults, used until an administrator saves trial_hours / trial_daily_limit in Admin Settings. */
    public const TRIAL_HOURS = 72;

    public const TRIAL_DAILY_LIMIT = 3;

    public const TZ = 'Asia/Manila';

    /** Master switch (dispatch_settings.subscription_required). "0" lets every accredited rider through, for testing. */
    public function required(): bool
    {
        return DispatchSetting::get('subscription_required', '1') === '1';
    }

    // ------------------------------------------------------------------ free trial

    /** Trial length from Admin Settings. Read when a trial STARTS, so running trials keep the length they were given. */
    public function trialHours(): int
    {
        return max(1, min(720, (int) DispatchSetting::get('trial_hours', (string) self::TRIAL_HOURS)));
    }

    /** Accepted bookings per Philippine day during a trial. Read live, so a change applies to running trials too. */
    public function trialDailyLimit(): int
    {
        return max(1, min(50, (int) DispatchSetting::get('trial_daily_limit', (string) self::TRIAL_DAILY_LIMIT)));
    }

    /** 72 -> "3 days", 24 -> "1 day", 36 -> "36 hours". */
    public static function trialLengthLabel(int $hours): string
    {
        if ($hours % 24 === 0) {
            $days = intdiv($hours, 24);

            return $days.($days === 1 ? ' day' : ' days');
        }

        return $hours.($hours === 1 ? ' hour' : ' hours');
    }

    /** Starts the one free trial of a newly accredited rider. Returns null when not eligible or already used. */
    public function startTrial(Rider $rider): ?RiderSubscription
    {
        if ($rider->application_status !== 'approved' || $rider->accreditation_status !== 'accredited' || $rider->account_status !== 'active') {
            return null;
        }
        // Identity = the rider's licence number (verified in person during accreditation); falls back to the rider id.
        $identity = hash('sha256', Str::lower(trim((string) $rider->license_number)) ?: (string) $rider->id);
        $hours = $this->trialHours();
        $limit = $this->trialDailyLimit();

        try {
            return DB::transaction(function () use ($rider, $identity, $hours, $limit) {
                if (RiderSubscription::where('trial_identity', $identity)->exists()) {
                    return null;
                }
                $now = now();
                $trial = RiderSubscription::create([
                    'rider_id' => $rider->id, 'plan_name_snapshot' => 'Free Trial', 'duration_snapshot' => $hours.' hours',
                    'price_snapshot' => 0, 'subscription_type' => 'trial', 'status' => 'active',
                    'starts_at' => $now, 'expires_at' => $now->copy()->addHours($hours), 'trial_identity' => $identity,
                ]);
                $this->notify($rider, 'subscription_trial_started', 'Your free trial has started',
                    'Your MIGO free trial is now active! You can accept up to '.$limit.($limit === 1 ? ' booking' : ' bookings').' per day for '.self::trialLengthLabel($hours).'. Enjoy your ride with MIGO!');

                return $trial;
            });
        } catch (QueryException) {
            return null; // unique(trial_identity): a concurrent request already created it
        }
    }

    // ------------------------------------------------------------------ booking access

    /** Start / end of today in Philippine time, converted to the app timezone the database values use. */
    public function todayBounds(?CarbonInterface $at = null): array
    {
        $local = ($at ? Carbon::instance($at) : now())->copy()->setTimezone(self::TZ);
        $appTz = config('app.timezone');

        return [$local->copy()->startOfDay()->setTimezone($appTz), $local->copy()->endOfDay()->setTimezone($appTz)];
    }

    /**
     * Bookings the rider accepted today (Philippine day), read from the existing bookings table. A booking the
     * passenger cancelled before the trip started does not count (the allowance is restored automatically, exactly
     * once, because nothing is ever incremented). Rider cancellations still count.
     */
    public function acceptedToday(Rider $rider, bool $lock = false): int
    {
        [$from, $to] = $this->todayBounds();

        $q = Booking::query()->where('rider_id', $rider->id)->whereNotNull('assigned_at')
            ->whereBetween('assigned_at', [$from->format('Y-m-d H:i:s'), $to->format('Y-m-d H:i:s')])
            ->whereNot(fn ($w) => $w->where('booking_status', 'cancelled_by_passenger')->whereNull('started_at'));

        // Inside the accept transaction the rows are locked so two simultaneous accepts cannot both pass the limit.
        return $lock ? $q->lockForUpdate()->get(['id'])->count() : $q->count();
    }

    /**
     * Can this rider accept a NEW booking now? Never cancels or affects a trip already in progress.
     *
     * @return array{allowed: bool, code: string, message: string, type: string|null, subscription: RiderSubscription|null, used_today: int, remaining_today: int|null}
     */
    public function access(Rider $rider, bool $lock = false): array
    {
        $none = ['type' => null, 'subscription' => null, 'used_today' => 0, 'remaining_today' => null];

        if (! $this->required()) {
            return ['allowed' => true, 'code' => 'ok', 'message' => 'Subscription not required.'] + $none;
        }

        $paid = RiderSubscription::where('rider_id', $rider->id)->where('subscription_type', 'paid')->effective()->orderByDesc('expires_at')->first();
        if ($paid) {
            return ['allowed' => true, 'code' => 'ok', 'message' => 'Active subscription.', 'type' => 'paid', 'subscription' => $paid, 'used_today' => 0, 'remaining_today' => null];
        }

        $trial = RiderSubscription::where('rider_id', $rider->id)->where('subscription_type', 'trial')->effective()->first();
        if ($trial) {
            $used = $this->acceptedToday($rider, $lock);
            $limit = $this->trialDailyLimit();
            $left = max(0, $limit - $used);
            $base = ['type' => 'trial', 'subscription' => $trial, 'used_today' => $used, 'remaining_today' => $left];

            return $left > 0
                ? ['allowed' => true, 'code' => 'ok', 'message' => 'Free trial active.'] + $base
                : ['allowed' => false, 'code' => 'trial_daily_limit', 'message' => 'Your free trial limit of '.$limit.($limit === 1 ? ' booking' : ' bookings').' for today has been reached. Your booking allowance will reset at 12:00 AM.'] + $base;
        }

        if (SubscriptionPayment::where('rider_id', $rider->id)->where('status', 'pending')->where('created_at', '>=', now()->subMinutes(30))->exists()) {
            return ['allowed' => false, 'code' => 'payment_pending', 'message' => 'We are confirming your payment. Booking access starts as soon as the payment is confirmed.'] + $none;
        }
        if (RiderSubscription::where('rider_id', $rider->id)->where('subscription_type', 'trial')->exists()) {
            $paidBefore = RiderSubscription::where('rider_id', $rider->id)->where('subscription_type', 'paid')->exists();

            return $paidBefore
                ? ['allowed' => false, 'code' => 'subscription_expired', 'message' => 'Your subscription has expired. Renew your plan to continue accepting new bookings.'] + $none
                : ['allowed' => false, 'code' => 'trial_expired', 'message' => 'Your free trial has expired. Subscribe to a MIGO plan to continue accepting new bookings.'] + $none;
        }

        return ['allowed' => false, 'code' => 'no_subscription', 'message' => 'Subscribe to a MIGO plan to accept new bookings.'] + $none;
    }

    /** Called right after a booking was accepted: tells a trial rider when today's limit has just been used up. */
    public function afterAccept(Rider $rider): void
    {
        $a = $this->access($rider);
        if ($a['type'] === 'trial' && $a['remaining_today'] === 0) {
            $key = 'daily_limit:'.now()->setTimezone(self::TZ)->toDateString();
            if ($this->once($a['subscription'], $key)) {
                $this->notify($rider, 'subscription_trial_limit', 'Daily free trial limit reached',
                    'You have reached your free trial booking limit for today. Your booking allowance will reset at 12:00 AM.');
            }
        }
    }

    // ------------------------------------------------------------------ payments

    /**
     * Rider presses "Pay": we store a pending payment (price and plan copied from the plan) and open a hosted
     * checkout (Xendit / PayMongo). Nothing is activated here; only the verified provider webhook activates a subscription.
     * Returns the checkout URL to send the rider to.
     */
    public function startCheckout(Rider $rider, SubscriptionPlan $plan, CheckoutGateway $gateway, string $successUrl, string $cancelUrl): string
    {
        if (! $plan->is_active) {
            throw ValidationException::withMessages(['subscription_plan_id' => 'This plan is no longer available.']);
        }

        // Earlier unpaid checkouts are closed so the rider can always start again. (If one of them was paid after
        // all, its webhook still activates it: see activate().)
        SubscriptionPayment::where('rider_id', $rider->id)->where('status', 'pending')
            ->update(['status' => 'cancelled', 'rejection_reason' => 'Replaced by a new checkout.']);

        $payment = SubscriptionPayment::create([
            'rider_id' => $rider->id, 'subscription_plan_id' => $plan->id, 'plan_name_snapshot' => $plan->name,
            'duration_snapshot' => $plan->durationLabel(), 'duration_value' => $plan->duration_value, 'duration_unit' => $plan->duration_unit,
            'amount' => $plan->price, 'payment_method' => $gateway->name(), 'provider' => $gateway->name(), 'status' => 'pending',
        ]);

        try {
            $session = $gateway->createCheckout($payment, $rider, $successUrl, $cancelUrl);
        } catch (\Throwable $e) {
            report($e);
            $payment->forceFill(['status' => 'failed', 'rejection_reason' => 'Checkout could not be created.'])->save();
            throw ValidationException::withMessages(['subscription_plan_id' => 'Payments are unavailable right now. Please try again in a moment.']);
        }

        $payment->forceFill(['provider_session_id' => $session['id'], 'checkout_url' => $session['url']])->save();

        return $session['url'];
    }

    /**
     * Safety net for a missed webhook: for this rider's recent unpaid Xendit checkouts, ask Xendit whether the
     * invoice was paid and activate it the same way the webhook would (same amount check, same activate()).
     * Throttled to one Xendit lookup round per rider every 8 seconds. Returns how many payments were activated.
     */
    public function reconcileXendit(Rider $rider, XenditClient $xendit): int
    {
        if (! \Illuminate\Support\Facades\Cache::add('xendit-reconcile:'.$rider->id, 1, 8)) {
            return 0;
        }

        $activated = 0;
        SubscriptionPayment::where('rider_id', $rider->id)->where('provider', 'xendit')
            ->whereNotNull('provider_session_id')->where('created_at', '>=', now()->subHours(3))
            ->where(fn ($q) => $q->where('status', 'pending')
                ->orWhere(fn ($q) => $q->where('status', 'cancelled')->where('rejection_reason', 'Replaced by a new checkout.')))
            ->orderByDesc('id')->limit(5)->get()
            ->each(function (SubscriptionPayment $payment) use ($xendit, &$activated) {
                $invoice = $xendit->fetchInvoice((string) $payment->provider_session_id);
                if (! $invoice || ! in_array(strtoupper((string) ($invoice['status'] ?? '')), ['PAID', 'SETTLED'], true)) {
                    return;
                }
                $paid = (float) ($invoice['paid_amount'] ?? $invoice['amount'] ?? 0);
                if (abs($paid - (float) $payment->amount) > 0.01) {
                    report(new \RuntimeException("Xendit amount mismatch on payment #{$payment->id}: got {$paid}"));

                    return;
                }
                try {
                    $this->activate($payment, null, [
                        'method' => strtolower((string) ($invoice['payment_channel'] ?? $invoice['payment_method'] ?? 'xendit')),
                        'provider_payment_id' => $invoice['payment_id'] ?? $invoice['id'] ?? null,
                    ]);
                    $activated++;
                } catch (ValidationException) {
                    // already activated (webhook arrived first)
                }
            });

        return $activated;
    }

    /**
     * Called by the payment webhook once the gateway confirms the money was collected. Activates (or queues) the
     * subscription in one transaction. Safe to call twice: the second call finds the payment already verified.
     *
     * @param  array{method?: string|null, provider_payment_id?: string|null}  $meta
     */
    public function activate(SubscriptionPayment $payment, ?AdminProfile $admin = null, array $meta = []): RiderSubscription
    {
        return DB::transaction(function () use ($payment, $admin, $meta) {
            $p = SubscriptionPayment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($p->status === 'verified') {
                throw ValidationException::withMessages(['payment' => 'This payment was already processed.']);
            }
            // pending, cancelled and failed rows are all accepted: if the gateway says it was paid, the rider paid.
            $rider = Rider::findOrFail($p->rider_id);
            $now = now();

            // Renewal before expiry starts right after the paid time the rider still has; paid periods never overlap.
            $lastEnd = RiderSubscription::where('rider_id', $rider->id)->where('subscription_type', 'paid')
                ->whereIn('status', ['active', 'scheduled'])->where('expires_at', '>', $now)->max('expires_at');
            $starts = $lastEnd ? Carbon::parse($lastEnd) : $now->copy();
            $expires = $this->addDuration($starts, $p->duration_value, $p->duration_unit);

            $sub = RiderSubscription::create([
                'rider_id' => $rider->id, 'subscription_plan_id' => $p->subscription_plan_id, 'plan_name_snapshot' => $p->plan_name_snapshot,
                'duration_snapshot' => $p->duration_snapshot, 'price_snapshot' => $p->amount, 'subscription_type' => 'paid',
                'status' => $starts->lte($now) ? 'active' : 'scheduled', 'starts_at' => $starts, 'expires_at' => $expires,
                'subscription_payment_id' => $p->id,
            ]);
            $p->forceFill([
                'status' => 'verified', 'verified_by' => $admin?->id, 'verified_at' => $now, 'rider_subscription_id' => $sub->id,
                'rejection_reason' => null,
                'payment_method' => isset($meta['method']) && $meta['method'] ? mb_substr((string) $meta['method'], 0, 30) : $p->payment_method,
                'provider_payment_id' => $meta['provider_payment_id'] ?? $p->provider_payment_id,
            ])->save();

            if ($admin) {
                $this->audit($admin, 'subscription.payment_verified', 'Payment #'.$p->id.' activated; '.$p->plan_name_snapshot.' until '.$expires->toDateTimeString(), $p->id);
            }
            $this->notify($rider, 'subscription_activated', 'Subscription activated',
                'Your MIGO subscription has been activated successfully. You can now receive unlimited eligible passenger bookings until '.$expires->copy()->setTimezone(self::TZ)->format('F j, Y g:i A').'.');

            // Admin feed (user_id NULL): informational, shows up in Notifications.
            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(), 'title' => 'Subscription payment received',
                'message' => ($rider->full_name ?: 'A rider').' paid ₱'.number_format($p->amount, 2).' for the '.$p->plan_name_snapshot.' plan.',
                'notification_type' => 'subscription_payment_received', 'is_read' => false, 'created_at' => now(),
                'data' => json_encode(['url' => '/admin/subscriptions?tab=payments']),
            ]);

            return $sub;
        });
    }

    /** Calendar-based: months/years never overflow (Jan 31 + 1 month = Feb 28/29). */
    public function addDuration(CarbonInterface $from, int $value, string $unit): Carbon
    {
        $c = Carbon::instance($from)->copy();

        return match ($unit) {
            'day' => $c->addDays($value),
            'year' => $c->addYearsNoOverflow($value),
            default => $c->addMonthsNoOverflow($value),
        };
    }

    // ------------------------------------------------------------------ scheduler

    /** Run by `subscriptions:tick`. Safe to run any number of times. */
    public function tick(): array
    {
        $now = now();
        $stats = ['activated' => 0, 'expired' => 0, 'reminders' => 0];

        $stats['activated'] = RiderSubscription::where('status', 'scheduled')->where('starts_at', '<=', $now)->where('expires_at', '>', $now)->update(['status' => 'active']);

        RiderSubscription::where('status', 'active')->where('expires_at', '<=', $now)->get()->each(function (RiderSubscription $s) use (&$stats) {
            $s->forceFill(['status' => 'expired'])->save();
            $stats['expired']++;
            $rider = Rider::find($s->rider_id);
            if (! $rider || ! $this->once($s, 'expired')) {
                return;
            }
            // A paid period that ended while the next one is already running needs no "expired" message.
            if (! $s->isTrial() && RiderSubscription::where('rider_id', $s->rider_id)->where('subscription_type', 'paid')->effective()->exists()) {
                return;
            }
            $s->isTrial()
                ? $this->notify($rider, 'subscription_trial_expired', 'Free trial ended', 'Your MIGO free trial has ended. Choose a subscription plan to continue receiving bookings.')
                : $this->notify($rider, 'subscription_expired', 'Subscription expired', 'Your MIGO subscription has expired. Renew your plan to continue receiving new passenger bookings.');
        });

        // Reminders: only the tightest threshold that applies, once per subscription.
        RiderSubscription::effective($now)->get()->each(function (RiderSubscription $s) use ($now, &$stats) {
            $rider = Rider::find($s->rider_id);
            $hours = $now->diffInHours($s->expires_at, false);
            if (! $rider || $hours <= 0) {
                return;
            }
            if ($s->isTrial()) {
                if ($hours <= 24 && $this->once($s, 'trial_expiring')) {
                    $this->notify($rider, 'subscription_trial_expiring', 'Free trial ending soon', 'Your MIGO free trial will expire soon. Subscribe to continue receiving passenger bookings.');
                    $stats['reminders']++;
                }

                return;
            }
            // Skip when a renewal already follows this period.
            if (RiderSubscription::where('rider_id', $s->rider_id)->where('subscription_type', 'paid')->whereIn('status', ['active', 'scheduled'])->where('starts_at', '>=', $s->expires_at)->exists()) {
                return;
            }
            foreach ([1, 3, 7] as $days) {
                if ($hours <= $days * 24) {
                    if ($this->once($s, 'expiring_'.$days.'d')) {
                        $this->notify($rider, 'subscription_expiring', 'Subscription ending soon',
                            'Your MIGO subscription will expire on '.$s->expires_at->copy()->setTimezone(self::TZ)->format('F j, Y').'. Renew now to avoid interruption to your booking eligibility.');
                        $stats['reminders']++;
                    }
                    break;
                }
            }
        });

        return $stats;
    }

    // ------------------------------------------------------------------ helpers

    /** True the first time a notice is recorded for this subscription; false if it was already sent. */
    private function once(RiderSubscription $s, string $notice): bool
    {
        return DB::table('subscription_notice_log')->insertOrIgnore(['rider_subscription_id' => $s->id, 'notice' => $notice, 'created_at' => now()]) > 0;
    }

    private function notify(Rider $rider, string $type, string $title, string $message): void
    {
        if (! $rider->user_id) {
            return;
        }
        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $rider->user_id, 'title' => $title, 'message' => $message,
            'notification_type' => $type, 'is_read' => false, 'created_at' => now(),
        ]);
    }

    private function audit(AdminProfile $admin, string $action, string $description, int|string $subjectId): void
    {
        DB::table('audit_logs')->insert([
            'id' => (string) Str::uuid(), 'admin_id' => $admin->id, 'action' => $action, 'description' => $description,
            'subject_type' => 'subscription_payment', 'subject_id' => (string) $subjectId, 'created_at' => now(),
        ]);
    }

    public function auditPlan(AdminProfile $admin, string $action, string $description, int $planId): void
    {
        DB::table('audit_logs')->insert([
            'id' => (string) Str::uuid(), 'admin_id' => $admin->id, 'action' => $action, 'description' => $description,
            'subject_type' => 'subscription_plan', 'subject_id' => (string) $planId, 'created_at' => now(),
        ]);
    }
}