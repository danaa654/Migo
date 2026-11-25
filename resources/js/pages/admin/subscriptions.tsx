import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    BadgeCheck,
    CalendarClock,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    CreditCard,
    Gift,
    Layers,
    LayoutDashboard,
    Plus,
    Search,
    TrendingUp,
    Users,
    Wallet,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { colorFor, isHex, PLAN_PRESETS, planStyle } from '@/lib/plan-color';

type Page<T> = { data: T[]; current_page: number; last_page: number; from: number | null; to: number | null; total: number };
type Sub = { id: number; rider: string; email: string | null; plan: string; duration: string; price: number; type: string; state: string; starts_at: string; expires_at: string };
type Pay = { id: number; rider: string; email: string | null; plan: string; duration: string; amount: number; method: string; reference: string | null; status: string; rejection_reason: string | null; reviewer: string | null; verified_at: string | null; created_at: string };
type Plan = { id: number; name: string; color: string | null; description: string | null; duration_value: number; duration_unit: string; duration: string; price: number; monthly: number | null; is_active: boolean; subscribers: number };
type Overview = {
    by_plan: { id: number; name: string; color: string | null; price: number; duration: string; is_active: boolean; active: number; purchases: number; revenue: number }[];
    monthly: { label: string; total: number }[];
    recent: { rider: string; plan: string; amount: number; method: string; at: string | null }[];
    failed_30d: number;
};
type Props = {
    tab: 'overview' | 'subscriptions' | 'payments' | 'plans';
    status?: string | null;
    canManage: boolean;
    stats: Record<string, number>;
    overview: Overview | null;
    planColors: Record<string, string>;
    subscriptions: Page<Sub> | null;
    payments: Page<Pay> | null;
    plans: Plan[] | null;
    filters: { status: string; plan: string; search: string; from: string; to: string };
};

const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—');
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' }) : '—');

const TABS: [Props['tab'], string, LucideIcon][] = [
    ['overview', 'Overview', LayoutDashboard],
    ['subscriptions', 'Rider subscriptions', Users],
    ['payments', 'Payments', CreditCard],
    ['plans', 'Plans', Layers],
];

const PILL: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800', scheduled: 'bg-sky-100 text-sky-800', expiring: 'bg-amber-100 text-amber-800', expired: 'bg-slate-200 text-slate-700',
    pending: 'bg-amber-100 text-amber-800', verified: 'bg-emerald-100 text-emerald-800', failed: 'bg-red-100 text-red-800', cancelled: 'bg-slate-200 text-slate-700', refunded: 'bg-slate-200 text-slate-700',
};
const box = 'rounded-2xl border border-m-line bg-m-card shadow-sm';
const input = 'rounded-lg border border-m-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-m-forest/40';
const th = 'px-4 py-3 text-[11px] font-semibold tracking-wide text-m-muted uppercase';

function PlanChip({ name, colors }: { name: string; colors: Record<string, string> }) {
    const st = planStyle(colorFor(name, colors[name]));

    return <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-black/10" style={st.chip}>{name}</span>;
}

function Shine() {
    return (
        <>
            <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/15" />
            <span aria-hidden className="pointer-events-none absolute -right-20 -bottom-24 size-56 rounded-full bg-white/10" />
        </>
    );
}

function Chip() {
    return (
        <span aria-hidden className="relative block h-6 w-9 overflow-hidden rounded-md bg-gradient-to-br from-[#F6DE8C] via-[#E3B93C] to-[#B8860B] shadow-inner ring-1 ring-black/20">
            <span className="absolute inset-x-0 top-1/2 h-px bg-black/25" />
            <span className="absolute inset-y-0 left-1/3 w-px bg-black/25" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-black/25" />
        </span>
    );
}

/** A plan shown like its card, in the colour the admin chose for it. */
function PlanCard({ color, name, price, caption, inactive, children }: { color: string; name: string; price: number; caption: string; inactive?: boolean; children?: React.ReactNode }) {
    const st = planStyle(color);

    return (
        <div className={`relative flex flex-col overflow-hidden rounded-2xl p-5 shadow-md ${inactive ? 'opacity-60' : ''}`} style={st.card}>
            <Shine />
            <div className="relative flex items-center justify-between">
                <p className="text-xs font-extrabold tracking-[0.2em] uppercase">MIGO · {name}</p>
                {inactive && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.soft }}>Inactive</span>}
            </div>
            <div className="relative mt-6 flex items-end justify-between gap-3">
                <Chip />
                <div className="text-right">
                    <p className="text-3xl leading-none font-extrabold">{peso(price)}</p>
                    <p className="mt-1 text-xs opacity-80">{caption}</p>
                </div>
            </div>
            {children && <div className="relative mt-4">{children}</div>}
        </div>
    );
}

type KpiTone = 'default' | 'good' | 'warn' | 'alert';
const KPI_TONE: Record<KpiTone, string> = {
    default: 'bg-m-mint text-m-forest',
    good: 'bg-emerald-100 text-emerald-700',
    warn: 'bg-amber-100 text-amber-700',
    alert: 'bg-red-100 text-red-700',
};
function Kpi({ icon: Icon, label, value, note, tone = 'default', onClick }: { icon: LucideIcon; label: string; value: string | number; note?: string; tone?: KpiTone; onClick?: () => void }) {
    const body = (
        <>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${KPI_TONE[tone]}`}><Icon className="size-5" aria-hidden /></span>
            <div className="min-w-0">
                <p className="text-xs font-medium text-m-muted">{label}</p>
                <p className="text-2xl leading-tight font-extrabold text-m-ink">{value}</p>
                {note && <p className="text-xs text-m-muted">{note}</p>}
            </div>
        </>
    );

    return onClick ? (
        <button onClick={onClick} className={`${box} flex items-center gap-3 p-4 text-left transition hover:shadow-md`}>{body}</button>
    ) : (
        <div className={`${box} flex items-center gap-3 p-4`}>{body}</div>
    );
}

function Pager<T>({ page, go }: { page: Page<T>; go: (n: number) => void }) {
    if (page.total === 0) return null;

    return (
        <div className="flex items-center justify-between border-t border-m-line px-4 py-3 text-sm text-m-muted">
            <span>Showing {page.from}–{page.to} of {page.total}</span>
            <div className="flex gap-1">
                <button disabled={page.current_page <= 1} onClick={() => go(page.current_page - 1)} className="rounded-lg border border-m-line p-1.5 hover:bg-m-mint disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
                <button disabled={page.current_page >= page.last_page} onClick={() => go(page.current_page + 1)} className="rounded-lg border border-m-line p-1.5 hover:bg-m-mint disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
            </div>
        </div>
    );
}

function SearchBox({ value, set, onEnter, placeholder }: { value: string; set: (v: string) => void; onEnter: () => void; placeholder: string }) {
    return (
        <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-m-muted" aria-hidden />
            <input value={value} onChange={(e) => set(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter()} placeholder={placeholder} className={`${input} w-full pl-8`} />
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-m-muted">{text}</td></tr>;
}

export default function Subscriptions(p: Props) {
    const [search, setSearch] = useState(p.filters.search);
    const [editing, setEditing] = useState<Plan | 'new' | null>(null);
    const plan = useForm({ name: '', description: '', color: '#F5C542', duration_value: 3, duration_unit: 'month', price: 599, is_active: true });

    const go = (patch: Record<string, string | number | undefined>) =>
        router.get('/admin/subscriptions', { tab: p.tab, status: p.filters.status || undefined, plan: p.filters.plan || undefined, search: p.filters.search || undefined, from: p.filters.from || undefined, to: p.filters.to || undefined, ...patch }, { preserveState: true, preserveScroll: true, replace: true });
    const tab = (k: string) => router.get('/admin/subscriptions', { tab: k }, { preserveScroll: true });
    const post = (url: string) => router.post(url, {}, { preserveScroll: true });
    const conv = p.stats.trials_started > 0 ? Math.round((p.stats.trials_converted / p.stats.trials_started) * 100) : 0;

    const openPlan = (pl: Plan | 'new') => {
        plan.clearErrors();
        if (pl === 'new') plan.setData({ name: '', description: '', color: '#F5C542', duration_value: 3, duration_unit: 'month', price: 599, is_active: true });
        else plan.setData({ name: pl.name, description: pl.description ?? '', color: colorFor(pl.name, pl.color), duration_value: pl.duration_value, duration_unit: pl.duration_unit, price: pl.price, is_active: pl.is_active });
        setEditing(pl);
    };
    const savePlan = () => {
        const done = { preserveScroll: true, onSuccess: () => setEditing(null) };
        editing === 'new' ? plan.post('/admin/subscriptions/plans', done) : plan.put(`/admin/subscriptions/plans/${(editing as Plan).id}`, done);
    };

    const o = p.overview;
    const maxMonth = Math.max(1, ...(o?.monthly ?? []).map((m) => m.total));
    const needsAttention = p.stats.pending_payments > 0 || p.stats.expiring_soon > 0 || (o?.failed_30d ?? 0) > 0;

    return (
        <AdminLayout title="Subscription Management">
            <div className="space-y-5">
                {p.status && (
                    <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        <CheckCircle2 className="size-4" /> {p.status}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex flex-wrap gap-1.5 rounded-2xl border border-m-line bg-m-card p-1.5 shadow-sm" role="tablist">
                    {TABS.map(([k, label, Icon]) => (
                        <button key={k} role="tab" aria-selected={p.tab === k} onClick={() => tab(k)} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${p.tab === k ? 'bg-m-forest text-white shadow' : 'text-m-muted hover:bg-m-mint hover:text-m-ink'}`}>
                            <Icon className="size-4" aria-hidden /> {label}
                            {k === 'payments' && p.stats.pending_payments > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[11px] text-white">{p.stats.pending_payments}</span>}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW */}
                {p.tab === 'overview' && o && (
                    <div className="space-y-5">
                        <section aria-label="Plans" className="grid gap-4 md:grid-cols-3">
                            {o.by_plan.map((pl, i) => (
                                <PlanCard key={pl.id} color={colorFor(pl.name, pl.color, i)} name={pl.name} price={pl.price} caption={pl.duration} inactive={!pl.is_active}>
                                    <div className="grid grid-cols-3 gap-2 rounded-xl p-3 text-center" style={{ background: planStyle(colorFor(pl.name, pl.color, i)).soft }}>
                                        <div><p className="text-lg font-extrabold">{pl.active}</p><p className="text-[11px] opacity-80">Active</p></div>
                                        <div><p className="text-lg font-extrabold">{pl.purchases}</p><p className="text-[11px] opacity-80">Purchases</p></div>
                                        <div><p className="text-lg font-extrabold">{peso(pl.revenue).replace('.00', '')}</p><p className="text-[11px] opacity-80">Gross</p></div>
                                    </div>
                                </PlanCard>
                            ))}
                        </section>

                        <section aria-label="Key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Kpi icon={Wallet} label="Gross revenue" value={peso(p.stats.revenue)} note="Paid payments, before Xendit fees" tone="good" />
                            <Kpi icon={Users} label="Riders with access now" value={p.stats.active_riders} />
                            <Kpi icon={BadgeCheck} label="Active paid subscriptions" value={p.stats.active_paid} tone="good" />
                            <Kpi icon={Gift} label="Active free trials" value={p.stats.active_trials} />
                        </section>

                        <div className="grid gap-5 xl:grid-cols-3">
                            <section className={`${box} p-5 xl:col-span-2`} aria-label="Revenue by month">
                                <div className="flex items-center justify-between">
                                    <h2 className="flex items-center gap-2 text-sm font-bold text-m-ink"><TrendingUp className="size-4 text-m-forest" aria-hidden /> Gross revenue, last 6 months</h2>
                                    <span className="text-xs text-m-muted">Paid payments only</span>
                                </div>
                                <div className="mt-4 flex h-44 items-end gap-3">
                                    {o.monthly.map((m) => (
                                        <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                                            <span className="text-[11px] font-semibold text-m-muted">{m.total > 0 ? peso(m.total).replace('.00', '') : ''}</span>
                                            <div className="flex w-full flex-1 items-end">
                                                <div className="w-full rounded-t-lg bg-gradient-to-t from-m-forest to-m-green" style={{ height: `${Math.max(m.total > 0 ? 6 : 2, (m.total / maxMonth) * 100)}%`, opacity: m.total > 0 ? 1 : 0.25 }} />
                                            </div>
                                            <span className="text-xs font-medium text-m-muted">{m.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className={`${box} p-5`} aria-label="Needs attention">
                                <h2 className="flex items-center gap-2 text-sm font-bold text-m-ink"><AlertTriangle className="size-4 text-amber-600" aria-hidden /> Needs attention</h2>
                                <ul className="mt-3 space-y-2 text-sm">
                                    {p.stats.pending_payments > 0 && <li><button onClick={() => router.get('/admin/subscriptions', { tab: 'payments', status: 'pending' })} className="flex w-full items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-amber-900 hover:bg-amber-100"><span>Payments awaiting payment</span><b>{p.stats.pending_payments}</b></button></li>}
                                    {p.stats.expiring_soon > 0 && <li><button onClick={() => router.get('/admin/subscriptions', { tab: 'subscriptions', status: 'expiring' })} className="flex w-full items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-amber-900 hover:bg-amber-100"><span>Expiring in 7 days</span><b>{p.stats.expiring_soon}</b></button></li>}
                                    {o.failed_30d > 0 && <li><button onClick={() => router.get('/admin/subscriptions', { tab: 'payments', status: 'failed' })} className="flex w-full items-center justify-between rounded-xl bg-red-50 px-3 py-2 text-red-900 hover:bg-red-100"><span>Failed checkouts (30 days)</span><b>{o.failed_30d}</b></button></li>}
                                    {!needsAttention && <li className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800"><CheckCircle2 className="size-4" /> All clear</li>}
                                </ul>
                                <div className="mt-4 border-t border-m-line pt-4">
                                    <div className="flex items-center justify-between text-sm"><span className="text-m-muted">Trial to paid</span><b className="text-m-ink">{conv}%</b></div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-m-line" role="progressbar" aria-valuenow={conv} aria-valuemin={0} aria-valuemax={100} aria-label="Trial to paid conversion"><div className="h-full rounded-full bg-m-forest" style={{ width: `${conv}%` }} /></div>
                                    <p className="mt-1 text-xs text-m-muted">{p.stats.trials_converted} of {p.stats.trials_started} trial riders</p>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
                                    <div className="rounded-xl bg-m-mint p-2"><p className="text-lg font-extrabold text-m-ink">{p.stats.expired}</p><p className="text-xs text-m-muted">Expired</p></div>
                                    <div className="rounded-xl bg-m-mint p-2"><p className="text-lg font-extrabold text-m-ink">{p.stats.expiring_soon}</p><p className="text-xs text-m-muted">Expiring soon</p></div>
                                </div>
                            </section>
                        </div>

                        <section className={box} aria-label="Latest payments">
                            <div className="flex items-center justify-between p-5 pb-3">
                                <h2 className="flex items-center gap-2 text-sm font-bold text-m-ink"><ClipboardCheck className="size-4 text-m-forest" aria-hidden /> Latest paid payments</h2>
                                <button onClick={() => router.get('/admin/subscriptions', { tab: 'payments', status: 'verified' })} className="text-xs font-semibold text-m-forest hover:underline">View all</button>
                            </div>
                            <ul className="divide-y divide-m-line">
                                {o.recent.map((r, i) => (
                                    <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                        <span className="flex size-9 items-center justify-center rounded-full bg-m-mint text-xs font-bold text-m-forest">{r.rider.slice(0, 1).toUpperCase()}</span>
                                        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-m-ink">{r.rider}</p><p className="text-xs text-m-muted">{r.method} · {when(r.at)}</p></div>
                                        <PlanChip name={r.plan} colors={p.planColors} />
                                        <b className="w-24 text-right text-m-ink">{peso(r.amount)}</b>
                                    </li>
                                ))}
                                {o.recent.length === 0 && <li className="px-5 py-8 text-center text-sm text-m-muted">No paid payments yet.</li>}
                            </ul>
                        </section>
                    </div>
                )}

                {/* RIDER SUBSCRIPTIONS */}
                {p.tab === 'subscriptions' && p.subscriptions && (
                    <div className={box}>
                        <div className="flex flex-wrap items-center gap-2 p-4">
                            <select value={p.filters.status} onChange={(e) => go({ status: e.target.value || undefined, page: 1 })} className={input} aria-label="Status">
                                <option value="">All statuses</option><option value="active">Active</option><option value="trial">Free trials</option><option value="paid">Paid</option><option value="expiring">Expiring soon</option><option value="scheduled">Queued renewals</option><option value="expired">Expired</option>
                            </select>
                            <select value={p.filters.plan} onChange={(e) => go({ plan: e.target.value || undefined, page: 1 })} className={input} aria-label="Plan">
                                <option value="">All plans</option>
                                {(p.plans ?? []).map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                            </select>
                            <SearchBox value={search} set={setSearch} onEnter={() => go({ search: search || undefined, page: 1 })} placeholder="Search rider, press Enter" />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-y border-m-line bg-m-mint/50 text-left"><tr><th className={th}>Rider</th><th className={th}>Plan</th><th className={th}>Status</th><th className={th}>Period</th></tr></thead>
                                <tbody>
                                    {p.subscriptions.data.map((s) => {
                                        const a = new Date(s.starts_at).getTime();
                                        const b = new Date(s.expires_at).getTime();
                                        const pct = b > a ? Math.min(100, Math.max(0, ((Date.now() - a) / (b - a)) * 100)) : 100;
                                        const barColor = planStyle(colorFor(s.plan, p.planColors[s.plan])).solid;

                                        return (
                                            <tr key={s.id} className="border-b border-m-line last:border-0 hover:bg-m-mint/40">
                                                <td className="px-4 py-3"><p className="font-semibold text-m-ink">{s.rider}</p><p className="text-xs text-m-muted">{s.email}</p></td>
                                                <td className="px-4 py-3">{s.type === 'trial' ? <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-800">Free trial</span> : <PlanChip name={s.plan} colors={p.planColors} />}<p className="mt-1 text-xs text-m-muted">{s.type === 'trial' ? '3-day trial' : `${s.duration} · ${peso(s.price)}`}</p></td>
                                                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PILL[s.state]}`}>{s.type === 'trial' && s.state === 'active' ? 'trial' : s.state}</span></td>
                                                <td className="min-w-56 px-4 py-3">
                                                    <p className="text-xs text-m-body">{day(s.starts_at)} → <b>{day(s.expires_at)}</b></p>
                                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-m-line"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} /></div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {p.subscriptions.data.length === 0 && <Empty text="No subscriptions match these filters." />}
                                </tbody>
                            </table>
                        </div>
                        <Pager page={p.subscriptions} go={(n) => go({ page: n })} />
                    </div>
                )}

                {/* PAYMENTS */}
                {p.tab === 'payments' && p.payments && (
                    <div className={box}>
                        <div className="flex flex-wrap items-center gap-2 p-4">
                            <select value={p.filters.status} onChange={(e) => go({ status: e.target.value || undefined, page: 1 })} className={input} aria-label="Payment status">
                                <option value="">All payments</option><option value="pending">Awaiting payment</option><option value="verified">Paid</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
                            </select>
                            <label className="flex items-center gap-1.5 text-xs text-m-muted">From <input type="date" value={p.filters.from} onChange={(e) => go({ from: e.target.value || undefined, page: 1 })} className={input} /></label>
                            <label className="flex items-center gap-1.5 text-xs text-m-muted">To <input type="date" value={p.filters.to} onChange={(e) => go({ to: e.target.value || undefined, page: 1 })} className={input} /></label>
                            <SearchBox value={search} set={setSearch} onEnter={() => go({ search: search || undefined, page: 1 })} placeholder="Rider or payment ID, press Enter" />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-y border-m-line bg-m-mint/50 text-left"><tr><th className={th}>Rider</th><th className={th}>Plan</th><th className={`${th} text-right`}>Amount</th><th className={th}>Method</th><th className={th}>Submitted</th><th className={th}>Status</th></tr></thead>
                                <tbody>
                                    {p.payments.data.map((x) => (
                                        <tr key={x.id} className="border-b border-m-line align-top last:border-0 hover:bg-m-mint/40">
                                            <td className="px-4 py-3"><p className="font-semibold text-m-ink">{x.rider}</p><p className="text-xs text-m-muted">{x.email}</p></td>
                                            <td className="px-4 py-3"><PlanChip name={x.plan} colors={p.planColors} /><p className="mt-1 text-xs text-m-muted">{x.duration}</p></td>
                                            <td className="px-4 py-3 text-right font-bold text-m-ink">{peso(x.amount)}</td>
                                            <td className="px-4 py-3">{x.method}<p className="max-w-44 truncate font-mono text-[11px] text-m-muted" title={x.reference ?? ''}>{x.reference ?? 'Awaiting provider'}</p></td>
                                            <td className="px-4 py-3 whitespace-nowrap">{when(x.created_at)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PILL[x.status] ?? ''}`}>
                                                    {x.status === 'verified' ? <CheckCircle2 className="size-3" /> : x.status === 'failed' ? <XCircle className="size-3" /> : x.status === 'pending' ? <CalendarClock className="size-3" /> : null}
                                                    {x.status === 'verified' ? 'paid' : x.status === 'pending' ? 'awaiting payment' : x.status}
                                                </span>
                                                {x.status === 'verified' && <p className="mt-1 text-xs text-m-muted">{when(x.verified_at)}</p>}
                                                {x.rejection_reason && <p className="mt-1 max-w-48 text-xs text-m-muted">{x.rejection_reason}</p>}
                                            </td>
                                        </tr>
                                    ))}
                                    {p.payments.data.length === 0 && <Empty text="No payments match these filters." />}
                                </tbody>
                            </table>
                        </div>
                        <Pager page={p.payments} go={(n) => go({ page: n })} />
                    </div>
                )}

                {/* PLANS */}
                {p.tab === 'plans' && p.plans && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-m-muted">Editing a plan never changes existing subscriptions: each keeps the name, duration and price it was bought with.</p>
                            {p.canManage && <button onClick={() => openPlan('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-m-forest px-3.5 py-2 text-sm font-semibold text-white shadow hover:brightness-110"><Plus className="size-4" />Add plan</button>}
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            {p.plans.map((pl, i) => {
                                const hex = colorFor(pl.name, pl.color, i);

                                return (
                                    <PlanCard key={pl.id} color={hex} name={pl.name} price={pl.price} caption={`${pl.duration}${pl.monthly !== null ? ` · about ${peso(pl.monthly)} / mo` : ''}`} inactive={!pl.is_active}>
                                        {pl.description && <p className="text-sm opacity-90">{pl.description}</p>}
                                        <p className="mt-2 text-xs opacity-80">{pl.subscribers} purchase(s)</p>
                                        {p.canManage && (
                                            <div className="mt-4 flex gap-2">
                                                <button onClick={() => openPlan(pl)} className="rounded-lg border border-current/40 px-3 py-1.5 text-xs font-bold hover:bg-black/10">Edit</button>
                                                <button onClick={() => post(`/admin/subscriptions/plans/${pl.id}/toggle`)} className="rounded-lg border border-current/40 px-3 py-1.5 text-xs font-bold hover:bg-black/10">{pl.is_active ? 'Deactivate' : 'Activate'}</button>
                                            </div>
                                        )}
                                    </PlanCard>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {editing && (
                <Modal title={editing === 'new' ? 'Add plan' : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
                    <div className="space-y-2 text-sm">
                        <Field label="Name" error={plan.errors.name}><input value={plan.data.name} onChange={(e) => plan.setData('name', e.target.value)} className="w-full rounded-lg border border-m-line bg-transparent p-2" /></Field>
                        <Field label="Description" error={plan.errors.description}><textarea value={plan.data.description} onChange={(e) => plan.setData('description', e.target.value)} rows={2} className="w-full rounded-lg border border-m-line bg-transparent p-2" /></Field>
                        <Field label="Card color" error={plan.errors.color}>
                            <div className="flex flex-wrap items-center gap-2">
                                {PLAN_PRESETS.map((c) => (
                                    <button key={c.hex} type="button" title={c.name} aria-label={c.name} aria-pressed={plan.data.color.toLowerCase() === c.hex.toLowerCase()} onClick={() => plan.setData('color', c.hex)} className={`size-8 rounded-full ring-offset-2 ring-offset-m-card transition ${plan.data.color.toLowerCase() === c.hex.toLowerCase() ? 'ring-2 ring-m-forest' : 'ring-1 ring-black/15 hover:scale-110'}`} style={{ background: c.hex }} />
                                ))}
                                <label className="flex items-center gap-1.5 text-xs text-m-muted">
                                    <input type="color" value={isHex(plan.data.color) ? plan.data.color : '#F5C542'} onChange={(e) => plan.setData('color', e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-full border border-m-line bg-transparent p-0" aria-label="Pick any color" /> Custom
                                </label>
                            </div>
                            <div className="mt-2 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold" style={planStyle(isHex(plan.data.color) ? plan.data.color : '#F5C542').card}>
                                <span>{plan.data.name || 'Plan name'}</span><span>{peso(plan.data.price || 0)}</span>
                            </div>
                        </Field>
                        <div className="grid grid-cols-3 gap-2">
                            <Field label="Length" error={plan.errors.duration_value}><input type="number" min={1} value={plan.data.duration_value} onChange={(e) => plan.setData('duration_value', Number(e.target.value))} className="w-full rounded-lg border border-m-line bg-transparent p-2" /></Field>
                            <Field label="Unit" error={plan.errors.duration_unit}><select value={plan.data.duration_unit} onChange={(e) => plan.setData('duration_unit', e.target.value)} className="w-full rounded-lg border border-m-line bg-transparent p-2"><option value="day">days</option><option value="month">months</option><option value="year">years</option></select></Field>
                            <Field label="Price (₱)" error={plan.errors.price}><input type="number" min={1} step="0.01" value={plan.data.price} onChange={(e) => plan.setData('price', Number(e.target.value))} className="w-full rounded-lg border border-m-line bg-transparent p-2" /></Field>
                        </div>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={plan.data.is_active} onChange={(e) => plan.setData('is_active', e.target.checked)} /> Available for purchase</label>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="rounded-lg border border-m-line px-3 py-1.5 text-sm">Cancel</button>
                        <button disabled={plan.processing} onClick={savePlan} className="rounded-lg bg-m-forest px-3 py-1.5 text-sm font-semibold text-white">Save plan</button>
                    </div>
                </Modal>
            )}
        </AdminLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-semibold">{label}</label>
            {children}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl bg-m-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-3 font-bold">{title}</h3>
                {children}
            </div>
        </div>
    );
}
