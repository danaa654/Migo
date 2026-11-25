import { router, useForm } from '@inertiajs/react';
import { Check, CheckCircle2, Clock, CreditCard, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Notifications } from '@/components/biker-notifications';
import { elapsedPct, fmtDate, leftLabel, planIcon, planTheme } from '@/components/biker-plan';
import BikerShell from '@/components/biker-shell';
import { colorFor, planStyle } from '@/lib/plan-color';

type Plan = { id: number; name: string; color: string | null; description: string | null; duration: string; price: number; monthly: number | null };
type Props = {
    account: { name: string; email: string };
    notifications: Notifications;
    status?: string | null;
    required: boolean;
    access: { allowed: boolean; code: string; message: string; type: 'paid' | 'trial' | null };
    trial: { starts_at: string; expires_at: string; active: boolean; day: number; daily_limit: number; used_today: number } | null;
    paid: { plan: string; color: string | null; duration: string; amount: number; starts_at: string; expires_at: string } | null;
    next: { plan: string; color: string | null; starts_at: string; expires_at: string } | null;
    plans: Plan[];
    hasPending: boolean;
    returnedFromCheckout: boolean;
    payments: { id: number; plan: string; amount: number; method: string; status: string; reason: string | null; created_at: string }[];
    history: { id: number; plan: string; type: string; starts_at: string; expires_at: string; ended: boolean }[];
};

const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const PILL: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    verified: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    refunded: 'bg-slate-200 text-slate-700',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-slate-200 text-slate-700',
};
const panel = 'rounded-2xl border border-[var(--b-line)] bg-[var(--b-card)] p-5 shadow-sm';

/** EMV chip drawn with CSS. */
function Chip() {
    return (
        <span aria-hidden className="relative block h-7 w-10 overflow-hidden rounded-md bg-gradient-to-br from-[#F6DE8C] via-[#E3B93C] to-[#B8860B] shadow-inner ring-1 ring-black/20">
            <span className="absolute inset-x-0 top-1/2 h-px bg-black/25" />
            <span className="absolute inset-y-0 left-1/3 w-px bg-black/25" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-black/25" />
        </span>
    );
}

/** Contactless symbol. */
function Contactless({ className = '' }: { className?: string }) {
    return (
        <svg aria-hidden viewBox="0 0 24 24" className={`size-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 8c2.2 2.2 2.2 5.8 0 8" />
            <path d="M12 5.5c3.6 3.6 3.6 9.4 0 13" />
            <path d="M16 3c5 5 5 13 0 18" />
        </svg>
    );
}

/** Soft circles so the flat gradient feels like a printed card. */
function Shine({ strong = false }: { strong?: boolean }) {
    return (
        <>
            <span aria-hidden className={`pointer-events-none absolute -top-16 -right-10 size-48 rounded-full ${strong ? 'bg-white/30' : 'bg-white/10'}`} />
            <span aria-hidden className={`pointer-events-none absolute -right-20 -bottom-24 size-56 rounded-full ${strong ? 'bg-white/20' : 'bg-white/[0.07]'}`} />
        </>
    );
}

export default function BikerSubscription(p: Props) {
    const [plan, setPlan] = useState<Plan | null>(null);
    const form = useForm<{ subscription_plan_id: number | '' }>({ subscription_plan_id: '' });

    // After paying, the provider confirms to the server a moment later. Keep refreshing (about 2 minutes) until it does.
    useEffect(() => {
        if (!p.hasPending) return;
        let n = 0;
        const t = setInterval(() => {
            n += 1;
            if (n > 30) return clearInterval(t);
            router.reload({ only: ['hasPending', 'access', 'trial', 'paid', 'next', 'payments', 'history', 'status', 'notifications', 'bikerSubscription'] });
        }, 4000);
        return () => clearInterval(t);
    }, [p.hasPending]);

    const choose = (pl: Plan) => {
        form.clearErrors();
        form.setData('subscription_plan_id', pl.id);
        setPlan(pl);
    };
    // The server opens a hosted checkout and the browser is sent there. No file is uploaded.
    const submit = () => form.post('/biker/subscription/payments', { preserveScroll: true });
    const hasPaid = !!p.paid;
    const trialLive = !!p.trial?.active && !hasPaid;

    return (
        <BikerShell account={p.account} canBook active="subscription" notifications={p.notifications} progress={{ cleared: 6, total: 6 }}>
            <div className="flex flex-col gap-6">
                {p.status && (
                    <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        <CheckCircle2 className="size-4" /> {p.status}
                    </div>
                )}

                {/* Current subscription: yellow for Basic, blue for Standard, black for Premium */}
                <section aria-labelledby="current-plan">
                    <h2 id="current-plan" className="sr-only">
                        Your subscription
                    </h2>

                    {p.required && hasPaid && p.paid ? (
                        <div className="relative overflow-hidden rounded-2xl p-5 shadow-md" style={planTheme(p.paid.plan, p.paid.color).card}>
                            <Shine strong={!planTheme(p.paid.plan, p.paid.color).onDark} />
                            <div className="relative flex flex-col gap-4">
                                <p className="flex flex-wrap items-center gap-3 text-2xl font-extrabold">
                                    <span className="flex size-11 items-center justify-center rounded-xl" style={{ background: planTheme(p.paid.plan, p.paid.color).soft }}>
                                        {(() => {
                                            const PlanIcon = planIcon(p.paid.plan);

                                            return <PlanIcon className="size-6" aria-hidden />;
                                        })()}
                                    </span>
                                    {p.paid.plan}
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">Active</span>
                                </p>
                                <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
                                    <div>
                                        <dt className="text-xs font-medium opacity-70">Started</dt>
                                        <dd className="font-bold">{when(p.paid.starts_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium opacity-70">Expires</dt>
                                        <dd className="font-bold">{when(p.paid.expires_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium opacity-70">Time left</dt>
                                        <dd className="font-bold">{leftLabel(p.paid.expires_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium opacity-70">Paid</dt>
                                        <dd className="font-bold">{peso(p.paid.amount)}</dd>
                                    </div>
                                </dl>
                                <div
                                    className="h-2 overflow-hidden rounded-full"
                                    style={{ background: planTheme(p.paid.plan, p.paid.color).track }}
                                    role="progressbar"
                                    aria-label="Subscription time used"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round(elapsedPct(p.paid.starts_at, p.paid.expires_at))}
                                >
                                    <div className="h-full rounded-full" style={{ width: `${elapsedPct(p.paid.starts_at, p.paid.expires_at)}%`, background: planTheme(p.paid.plan, p.paid.color).bar }} />
                                </div>
                                <p className="text-sm font-medium opacity-80">Booking access: unlimited while active. You keep 100% of every fare.</p>
                                {p.next && (
                                    <p className="rounded-lg px-3 py-2 text-sm font-medium" style={{ background: planTheme(p.paid.plan, p.paid.color).soft }}>
                                        Renewal queued: {p.next.plan} starts {when(p.next.starts_at)}.
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className={`${panel} flex flex-col gap-3`}>
                            {!p.required && <p className="text-sm text-[var(--b-muted)]">Subscriptions are switched off right now. You can accept bookings freely.</p>}

                            {p.required && trialLive && p.trial && (
                                <>
                                    <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-[var(--b-ink)]">
                                        Free Trial
                                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">Day {p.trial.day} of 3</span>
                                    </p>
                                    <p className="text-sm text-[var(--b-body)]">
                                        {p.trial.used_today} of {p.trial.daily_limit} bookings used today · {Math.max(0, p.trial.daily_limit - p.trial.used_today)} remaining today
                                    </p>
                                    <p className="flex items-center gap-1 text-sm text-[var(--b-muted)]">
                                        <Clock className="size-4 shrink-0" /> Expires {when(p.trial.expires_at)} ({leftLabel(p.trial.expires_at)}). Your daily allowance resets at 12:00 AM.
                                    </p>
                                </>
                            )}

                            {p.required && !hasPaid && !trialLive && (
                                <p className="flex items-start gap-2 text-sm text-[var(--b-body)]">
                                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /> {p.access.message}
                                </p>
                            )}
                        </div>
                    )}
                </section>

                {/* Plans: one card per plan */}
                <section className="space-y-3">
                    <h2 className="text-base font-bold text-[var(--b-ink)]">{hasPaid ? 'Renew early (your remaining time is kept)' : 'Choose a plan'}</h2>
                    {p.hasPending && (
                        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {p.returnedFromCheckout
                                ? 'Thank you! We are confirming your payment. This page updates by itself.'
                                : 'You have a checkout that is not paid yet. If you already paid, this page updates by itself in a moment.'}
                        </p>
                    )}
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {p.plans.map((pl, i) => {
                            const hex = colorFor(pl.name, pl.color, i);
                            const t = planStyle(hex);
                            const Icon = planIcon(pl.name);
                            const current = hasPaid && p.paid?.plan === pl.name;

                            return (
                                <article
                                    key={pl.id}
                                    style={current ? { borderColor: hex, boxShadow: `0 0 0 2px ${hex}66` } : undefined}
                                    className={`group flex flex-col overflow-hidden rounded-2xl border bg-[var(--b-card)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                                        current ? '' : 'border-[var(--b-line)]'
                                    }`}
                                >
                                    <div className="relative aspect-[1.7/1] p-4" style={t.card}>
                                        <Shine strong={!t.onDark} />
                                        <div className="relative flex h-full flex-col justify-between">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-[11px] font-extrabold tracking-[0.25em]">MIGO</p>
                                                    <p className="flex items-center gap-1 text-[11px] font-bold tracking-widest uppercase" style={{ color: t.accent }}>
                                                        <Icon className="size-3" aria-hidden /> {pl.name}
                                                    </p>
                                                </div>
                                                <Contactless className="opacity-80" />
                                            </div>
                                            <div className="flex items-end justify-between gap-3">
                                                <div>
                                                    <Chip />
                                                    <p className="mt-2 text-3xl leading-none font-extrabold tracking-tight">{peso(pl.price)}</p>
                                                </div>
                                                <div className="text-right text-xs opacity-90">
                                                    <p className="font-semibold">{pl.duration}</p>
                                                    {pl.monthly !== null && <p className="opacity-80">about {peso(pl.monthly)} / mo</p>}
                                                </div>
                                            </div>
                                        </div>
                                        {current && (
                                            <span className="absolute top-3 right-12 rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={t.pill}>Current plan</span>
                                        )}
                                    </div>
                                    <div className="flex flex-1 flex-col p-4">
                                        {pl.description && <p className="text-sm text-[var(--b-body)]">{pl.description}</p>}
                                        <ul className="mt-2 space-y-1.5 text-sm text-[var(--b-body)]">
                                            <li className="flex items-center gap-2">
                                                <Check className="size-4 shrink-0 text-m-green" aria-hidden /> Unlimited eligible bookings
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="size-4 shrink-0 text-m-green" aria-hidden /> No commission, you keep 100% of fares
                                            </li>
                                        </ul>
                                        <button
                                            onClick={() => choose(pl)}
                                            className="mt-4 w-full rounded-xl bg-[var(--b-forest)] px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {hasPaid ? 'Renew' : 'Subscribe'}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                {/* History */}
                <div className="grid gap-5 lg:grid-cols-2">
                    <section className={panel}>
                        <h2 className="mb-2 text-base font-bold text-[var(--b-ink)]">Payment history</h2>
                        {p.payments.length === 0 ? (
                            <p className="text-sm text-[var(--b-muted)]">No payments yet.</p>
                        ) : (
                            <ul className="divide-y divide-[var(--b-line)] text-sm">
                                {p.payments.map((x) => (
                                    <li key={x.id} className="py-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-[var(--b-ink)]">
                                                {x.plan} · {peso(x.amount)}
                                            </span>
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL[x.status] ?? ''}`}>
                                                {x.status === 'verified' ? 'paid' : x.status === 'pending' ? 'awaiting payment' : x.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--b-muted)]">
                                            {x.method} · {when(x.created_at)}
                                        </p>
                                        {x.reason && <p className="text-xs text-red-700">Reason: {x.reason}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <section className={panel}>
                        <h2 className="mb-2 text-base font-bold text-[var(--b-ink)]">Subscription history</h2>
                        {p.history.length === 0 ? (
                            <p className="text-sm text-[var(--b-muted)]">Nothing yet.</p>
                        ) : (
                            <ul className="divide-y divide-[var(--b-line)] text-sm">
                                {p.history.map((h) => (
                                    <li key={h.id} className="py-2.5">
                                        <p className="font-medium text-[var(--b-ink)]">
                                            {h.plan}{' '}
                                            <span className="text-xs text-[var(--b-muted)]">
                                                ({h.type === 'trial' ? 'trial' : 'paid'}
                                                {h.ended ? ', ended' : ''})
                                            </span>
                                        </p>
                                        <p className="text-xs text-[var(--b-muted)]">
                                            {fmtDate(h.starts_at)} → {fmtDate(h.expires_at)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>

            {/* Pay dialog: summary, then the provider's secure hosted page */}
            {plan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`Pay for ${plan.name}`}>
                    <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-[var(--b-card)] shadow-xl">
                        <div className="relative p-5" style={planStyle(colorFor(plan.name, plan.color)).card}>
                            <Shine />
                            <button onClick={() => setPlan(null)} aria-label="Close" className="absolute top-3 right-3 rounded-full p-1 hover:bg-white/15">
                                <X className="size-5" />
                            </button>
                            <p className="relative flex items-center gap-2 text-sm font-bold">
                                <CreditCard className="size-4" /> {plan.name} · {plan.duration}
                            </p>
                            <p className="relative mt-1 text-3xl font-extrabold">{peso(plan.price)}</p>
                        </div>
                        <div className="p-5">
                            <p className="rounded-lg bg-[var(--b-page)] p-3 text-xs text-[var(--b-body)]">
                                You will pay on a secure payment page with the methods available there (for example GCash, Maya, card or QR Ph). MIGO never sees your card or wallet details. Your subscription starts automatically once the payment is confirmed.
                            </p>
                            {form.errors.subscription_plan_id && <p className="mt-2 text-xs text-red-600">{form.errors.subscription_plan_id}</p>}
                            <div className="mt-4 flex justify-end gap-2">
                                <button onClick={() => setPlan(null)} className="rounded-lg border border-[var(--b-line)] px-3 py-2 text-sm text-[var(--b-ink)]">
                                    Cancel
                                </button>
                                <button onClick={submit} disabled={form.processing} className="rounded-lg bg-[var(--b-forest)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                    {form.processing ? 'Opening checkout…' : `Pay ${peso(plan.price)}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </BikerShell>
    );
}