import { Link, usePage } from '@inertiajs/react';
import { Award, CalendarClock, Crown, Gift, Medal, Sparkles, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { colorFor, planStyle } from '@/lib/plan-color';

/** Shared by the Biker sidebar, the dashboard and the Subscription page. Comes from HandleInertiaRequests ("bikerSubscription"). */
export type BikerSubscription = {
    required: boolean;
    kind: 'paid' | 'trial' | null;
    plan: string | null;
    /** The plan's card colour (#RRGGBB) when the admin set one. */
    color?: string | null;
    starts_at: string | null;
    expires_at: string | null;
};

export function useBikerSubscription(): BikerSubscription | null {
    const { props } = usePage();

    return (props as unknown as { bikerSubscription?: BikerSubscription | null }).bikerSubscription ?? null;
}

/** Yellow gold used for the rider's chosen plan. Dark brown text keeps it readable in light and dark mode. */
export const GOLD = 'bg-gradient-to-br from-[#FCE38A] via-[#F5C542] to-[#D9A116] text-[#4A3300]';

/** Card colours follow the plan's own colour (set by the admin); without one: Basic yellow, Standard blue, Premium black. */
export function planTheme(plan: string | null, color?: string | null) {
    return planStyle(colorFor(plan, color));
}

export function planIcon(plan: string | null): LucideIcon {
    const n = (plan ?? '').toLowerCase();
    if (n.includes('premium')) return Crown;
    if (n.includes('standard')) return Award;
    if (n.includes('basic')) return Medal;
    if (n.includes('trial')) return Gift;

    return Sparkles;
}

export const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });

/** Whole days left (rounded up). 0 when ended. */
export const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export const leftLabel = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'Ended';
    const h = Math.floor(ms / 3_600_000);

    return h >= 48 ? `${Math.floor(h / 24)} days left` : `${Math.max(1, h)} hours left`;
};

/** 0-100: how much of the period has already passed. */
export function elapsedPct(startIso: string, endIso: string) {
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    if (e <= s) return 100;

    return Math.min(100, Math.max(0, ((Date.now() - s) / (e - s)) * 100));
}

/** Sidebar block. Expanded: gold card with plan name and end date. Collapsed (desktop): a small icon tile. */
export function SidebarPlan({ sub, collapsed = false }: { sub: BikerSubscription | null; collapsed?: boolean }) {
    if (!sub || !sub.required) return null;
    const paid = sub.kind === 'paid';
    const Icon = planIcon(sub.kind ? sub.plan : null);
    const t = planTheme(sub.plan, sub.color);
    const label = sub.kind
        ? `${sub.plan}${sub.expires_at ? ` · expires ${fmtDate(sub.expires_at)}` : ''}`
        : 'No active plan. Tap to subscribe';

    return (
        <>
            <div className={collapsed ? 'lg:hidden' : ''}>
                <SidebarPlanFull sub={sub} />
            </div>
            {collapsed && (
                <Link
                    href="/biker/subscription"
                    title={label}
                    aria-label={label}
                    style={paid ? t.card : undefined}
                    className={`mx-auto hidden size-10 items-center justify-center rounded-xl shadow-sm lg:flex ${
                        paid ? '' : 'border border-dashed border-[#D9A116] bg-[#FFF8DC] text-[#6B4A00]'
                    }`}
                >
                    <Icon className="size-5" aria-hidden />
                </Link>
            )}
        </>
    );
}

function SidebarPlanFull({ sub }: { sub: BikerSubscription | null }) {
    if (!sub || !sub.required) return null;
    const Icon = planIcon(sub.plan);
    const t = planTheme(sub.plan, sub.color);

    if (sub.kind === 'paid' && sub.plan && sub.expires_at) {
        return (
            <Link
                href="/biker/subscription"
                title="View my subscription"
                style={t.card}
                className="block rounded-xl p-3 shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B]"
            >
                <p className="flex items-center gap-2 text-[13px] font-extrabold">
                    <Icon className="size-4" aria-hidden /> {sub.plan}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold opacity-80">Expires {fmtDate(sub.expires_at)}</p>
                <p className="text-[11px] font-medium opacity-70">{leftLabel(sub.expires_at)}</p>
            </Link>
        );
    }

    if (sub.kind === 'trial' && sub.expires_at) {
        return (
            <Link
                href="/biker/subscription"
                className="block rounded-xl border border-sky-300 bg-sky-50 p-3 text-sky-900 shadow-sm transition hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100"
            >
                <p className="flex items-center gap-2 text-[13px] font-bold">
                    <Gift className="size-4" aria-hidden /> Free Trial
                </p>
                <p className="mt-0.5 text-[11px] opacity-80">{leftLabel(sub.expires_at)}</p>
            </Link>
        );
    }

    return (
        <Link
            href="/biker/subscription"
            className="block rounded-xl border border-dashed border-[#D9A116] bg-[#FFF8DC] p-3 text-[#6B4A00] shadow-sm transition hover:bg-[#FFF1BD] dark:bg-[#3A2E08] dark:text-[#F5D77A]"
        >
            <p className="flex items-center gap-2 text-[13px] font-bold">
                <TriangleAlert className="size-4" aria-hidden /> No active plan
            </p>
            <p className="mt-0.5 text-[11px] opacity-80">Tap to subscribe</p>
        </Link>
    );
}

/** Small pill for the top bar on phones, where the sidebar is hidden. */
export function PlanChip({ sub }: { sub: BikerSubscription | null }) {
    if (!sub || !sub.required) return null;
    const Icon = planIcon(sub.kind ? sub.plan : null);
    const paid = sub.kind === 'paid';

    return (
        <Link
            href="/biker/subscription"
            style={paid ? planTheme(sub.plan, sub.color).card : undefined}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold lg:hidden ${
                paid ? '' : 'border border-[var(--b-line)] bg-[var(--b-card)] text-[var(--b-ink)]'
            }`}
        >
            <Icon className="size-3" aria-hidden /> {sub.kind ? sub.plan : 'Subscribe'}
        </Link>
    );
}

/** Dashboard card: plan, status, expiry date and a time-used bar. */
export function DashboardSubscriptionCard({ sub }: { sub: BikerSubscription }) {
    const active = sub.kind !== null && !!sub.expires_at && !!sub.starts_at;
    const paid = sub.kind === 'paid';
    const Icon = planIcon(sub.kind ? sub.plan : null);
    const days = active && sub.expires_at ? daysLeft(sub.expires_at) : 0;
    const soon = active && days <= 7;
    const t = planTheme(sub.plan, sub.color);

    return (
        <section className="relative overflow-hidden rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] p-4 shadow-sm">
            {paid && <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: t.solid }} />}
            <div className="flex flex-wrap items-center gap-4">
                <span
                    style={paid ? t.card : undefined}
                    className={`flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                        paid ? '' : active ? 'bg-sky-100 text-sky-800' : 'bg-[#FFF1BD] text-[#6B4A00]'
                    }`}
                >
                    {active ? <Icon className="size-6" aria-hidden /> : <CalendarClock className="size-6" aria-hidden />}
                </span>

                <div className="min-w-0 flex-1">
                    {active && sub.expires_at && sub.starts_at ? (
                        <>
                            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--b-ink)]">
                                {paid ? `${sub.plan} plan` : 'Free Trial'}
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Active</span>
                                {soon && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                        {paid ? 'Renew soon' : 'Ends soon'}
                                    </span>
                                )}
                            </p>
                            <p className="mt-0.5 text-sm text-[var(--b-body)]">
                                Expires <span className="font-semibold">{fmtDate(sub.expires_at)}</span> · {leftLabel(sub.expires_at)}
                            </p>
                            <div
                                className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-[var(--b-line)]"
                                role="progressbar"
                                aria-label="Subscription time used"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(elapsedPct(sub.starts_at, sub.expires_at))}
                            >
                                <div
                                    className={`h-full rounded-full ${paid ? '' : 'bg-sky-500'}`}
                                    style={{ width: `${elapsedPct(sub.starts_at, sub.expires_at)}%`, ...(paid ? { background: t.solid } : {}) }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-bold text-[var(--b-ink)]">No active subscription</p>
                            <p className="mt-0.5 text-sm text-[var(--b-body)]">Subscribe to a plan to keep receiving passenger bookings.</p>
                        </>
                    )}
                </div>

                <Link
                    href="/biker/subscription"
                    className="inline-flex items-center rounded-full border border-m-forest bg-m-card/70 px-4 py-1.5 text-xs font-bold text-m-forest transition hover:bg-m-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent dark:text-m-ink"
                >
                    {active ? (paid ? 'Manage / Renew' : 'Choose a plan') : 'Subscribe'}
                </Link>
            </div>
        </section>
    );
}