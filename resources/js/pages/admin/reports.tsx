import { router } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';

type Summary = {
    total: number;
    completed: number;
    completion_rate: number | null;
    fare_value: number;
    by_status: Record<string, number>;
    cancelled: number;
    unmatched: number;
};
type Report = {
    trend: { date: string; requested: number; completed: number; cancelled: number }[];
    by_hour: number[];
    by_service: { service: string; total: number; completed: number; fare_value: number }[];
    timings: {
        avg_match_minutes: number | null;
        avg_pickup_minutes: number | null;
        avg_trip_minutes: number | null;
        avg_distance_km: number | null;
    };
} | null;
type Props = {
    filters: { tab: string; preset: string; from: string; to: string; service: string | null };
    services: string[];
    summary: {
        current: Summary;
        previous: Summary;
        active_riders: number | null;
        open_complaints: number | null;
    };
    report: Report;
};

const PRESETS = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: 'month', label: 'This month' },
    { key: 'custom', label: 'Custom' },
];
const TABS = [
    { key: 'bookings', label: 'Bookings & Dispatch', built: true },
    { key: 'revenue', label: 'Revenue', built: false },
    { key: 'riders', label: 'Riders', built: false },
    { key: 'passengers', label: 'Passengers', built: false },
    { key: 'support', label: 'Support & Safety', built: false },
    { key: 'subscriptions', label: 'Subscriptions', built: false },
];
const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    searching_for_rider: 'Searching for rider',
    rider_assigned: 'Rider assigned',
    rider_arrived: 'Rider arrived',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled_by_passenger: 'Cancelled by passenger',
    cancelled_by_rider: 'Cancelled by rider',
    no_rider_found: 'No rider found',
    expired: 'Expired',
};

const peso = (n: number) =>
    '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mins = (n: number | null) => (n === null ? '—' : `${n} min`);

function change(now: number, before: number) {
    if (before === 0) return now === 0 ? 'no change' : 'new';
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct > 0 ? '+' : ''}${pct}% vs previous`;
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
    return (
        <div className="rounded-lg border border-m-line bg-m-card p-4 shadow-sm">
            <p className="text-xs font-medium text-m-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-m-ink">{value}</p>
            {note && <p className="mt-1 text-xs text-m-muted">{note}</p>}
        </div>
    );
}

/** Simple CSS bars, so no chart library is needed yet. */
function Bars({ values, labels, title }: { values: number[]; labels: string[]; title: string }) {
    const max = Math.max(1, ...values);
    return (
        <div>
            <div className="flex h-36 items-end gap-0.5" role="img" aria-label={title}>
                {values.map((v, i) => (
                    <div
                        key={i}
                        title={`${labels[i]}: ${v}`}
                        className="min-w-[2px] flex-1 rounded-t bg-m-forest/80"
                        style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                    />
                ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-m-muted">
                <span>{labels[0]}</span>
                <span>{labels[labels.length - 1]}</span>
            </div>
        </div>
    );
}

export default function Reports({ filters, services, summary, report }: Props) {
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const { current, previous } = summary;

    const go = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, ...patch };
        router.get(
            '/admin/reports',
            {
                tab: next.tab,
                preset: next.preset,
                service: next.service ?? undefined,
                ...(next.preset === 'custom' ? { from: next.from, to: next.to } : {}),
            },
            { preserveState: true, preserveScroll: true, replace: true, only: ['filters', 'summary', 'report'] },
        );
    };

    return (
        <AdminLayout title="Reports and Analytics">
            <div className="space-y-5">
                {/* Filter bar: shared by every tab */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-m-line bg-m-card p-3 shadow-sm">
                    <div className="flex flex-wrap gap-1">
                        {PRESETS.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => go({ preset: p.key })}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                    filters.preset === p.key
                                        ? 'bg-m-forest text-white'
                                        : 'text-m-ink hover:bg-m-line/50'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {filters.preset === 'custom' && (
                        <div className="flex items-center gap-2 text-sm">
                            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-m-line px-2 py-1" />
                            <span>to</span>
                            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-m-line px-2 py-1" />
                            <button onClick={() => go({ from, to })} className="rounded-md bg-m-forest px-3 py-1.5 font-medium text-white">
                                Apply
                            </button>
                        </div>
                    )}
                    <select
                        value={filters.service ?? ''}
                        onChange={(e) => go({ service: e.target.value || null })}
                        className="ml-auto rounded-md border border-m-line bg-transparent px-2 py-1.5 text-sm"
                    >
                        <option value="">All services</option>
                        {services.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Summary cards */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <Card label="Total bookings" value={String(current.total)} note={change(current.total, previous.total)} />
                    <Card
                        label="Completion rate"
                        value={current.completion_rate === null ? '—' : `${current.completion_rate}%`}
                        note={`${current.completed} completed`}
                    />
                    <Card label="Total fare value" value={peso(current.fare_value)} note={change(current.fare_value, previous.fare_value)} />
                    <Card label="Active riders" value={summary.active_riders === null ? '—' : String(summary.active_riders)} note="Accredited and active now" />
                    <Card label="Open complaints" value={summary.open_complaints === null ? '—' : String(summary.open_complaints)} note="Right now, not date-filtered" />
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-1 border-b border-m-line">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            disabled={!t.built}
                            onClick={() => go({ tab: t.key })}
                            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                                filters.tab === t.key
                                    ? 'border-m-forest text-m-forest'
                                    : 'border-transparent text-m-muted'
                            } ${t.built ? 'hover:text-m-ink' : 'cursor-not-allowed opacity-50'}`}
                            title={t.built ? undefined : 'Coming in a later phase'}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {report && filters.tab === 'bookings' && (
                    <div className="space-y-5">
                        <div className="grid gap-5 lg:grid-cols-3">
                            <section className="rounded-lg border border-m-line bg-m-card p-4 shadow-sm lg:col-span-2">
                                <h2 className="mb-3 text-sm font-semibold">Bookings per day</h2>
                                {report.trend.length > 0 && (
                                    <Bars
                                        title="Bookings per day"
                                        values={report.trend.map((d) => d.requested)}
                                        labels={report.trend.map((d) => d.date)}
                                    />
                                )}
                            </section>
                            <section className="rounded-lg border border-m-line bg-m-card p-4 shadow-sm">
                                <h2 className="mb-3 text-sm font-semibold">Dispatch timings</h2>
                                <dl className="space-y-2 text-sm">
                                    <Row k="Avg. time to match a rider" v={mins(report.timings.avg_match_minutes)} />
                                    <Row k="Avg. rider pickup time" v={mins(report.timings.avg_pickup_minutes)} />
                                    <Row k="Avg. trip time" v={mins(report.timings.avg_trip_minutes)} />
                                    <Row k="Avg. trip distance" v={report.timings.avg_distance_km === null ? '—' : `${report.timings.avg_distance_km} km`} />
                                </dl>
                            </section>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-3">
                            <section className="rounded-lg border border-m-line bg-m-card p-4 shadow-sm">
                                <h2 className="mb-3 text-sm font-semibold">Bookings by status</h2>
                                <dl className="space-y-2 text-sm">
                                    {Object.entries(current.by_status).length === 0 && <p className="text-m-muted">No bookings in this range.</p>}
                                    {Object.entries(current.by_status).map(([k, v]) => (
                                        <Row key={k} k={STATUS_LABELS[k] ?? k} v={String(v)} />
                                    ))}
                                </dl>
                            </section>
                            <section className="rounded-lg border border-m-line bg-m-card p-4 shadow-sm">
                                <h2 className="mb-3 text-sm font-semibold">Peak hours</h2>
                                <Bars
                                    title="Bookings by hour of day"
                                    values={report.by_hour}
                                    labels={report.by_hour.map((_, h) => `${h}:00`)}
                                />
                            </section>
                            <section className="rounded-lg border border-m-line bg-m-card p-4 shadow-sm">
                                <h2 className="mb-3 text-sm font-semibold">By service</h2>
                                <table className="w-full text-sm">
                                    <thead className="text-left text-xs text-m-muted">
                                        <tr>
                                            <th className="pb-1 font-medium">Service</th>
                                            <th className="pb-1 text-right font-medium">Total</th>
                                            <th className="pb-1 text-right font-medium">Done</th>
                                            <th className="pb-1 text-right font-medium">Fare value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.by_service.map((s) => (
                                            <tr key={s.service} className="border-t border-m-line">
                                                <td className="py-1.5">{s.service}</td>
                                                <td className="py-1.5 text-right">{s.total}</td>
                                                <td className="py-1.5 text-right">{s.completed}</td>
                                                <td className="py-1.5 text-right">{peso(s.fare_value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function Row({ k, v }: { k: string; v: string }) {
    return (
        <div className="flex justify-between gap-3">
            <dt className="text-m-muted">{k}</dt>
            <dd className="font-medium text-m-ink">{v}</dd>
        </div>
    );
}