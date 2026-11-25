import { Clock, Inbox, MessageSquareWarning, ShieldAlert } from 'lucide-react';
import { DailyBars, Kpi, Legend, Meter, Panel, Pill, pct, hoursText, Row } from './ui';

export type SupportData = {
    total: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    reporters: Record<string, number>;
    categories: { key: string; label: string; count: number }[];
    resolution: { closed: number; avg_hours: number | null; median_hours: number | null; within_24h: number | null; by_type: Record<string, number | null> };
    open_now: number;
    oldest_open_days: number | null;
    penalties: { total: number; points: number; suspensions: number; active_suspensions: number; lifted: number; by_action: Record<string, number>; subjects: Record<string, number> };
    trend: { date: string; complaint: number; support: number; incident: number }[];
};

const TYPE_LABELS: Record<string, string> = { complaint: 'Complaints', support: 'Support requests', incident: 'Incident reports' };
const TYPE_COLORS: Record<string, string> = { complaint: '#B45309', support: '#3B6FA8', incident: '#C0392B' };
const STATUS: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800' },
    under_investigation: { label: 'Under investigation', cls: 'bg-sky-100 text-sky-800' },
    resolved: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800' },
    rejected: { label: 'Rejected', cls: 'bg-slate-200 text-slate-700' },
};
const ACTIONS: Record<string, string> = {
    none: 'Points only',
    warning: 'Warning',
    final_warning: 'Final warning',
    suspend_7: '7-day suspension',
    suspend_30: '30-day suspension',
    suspend_indefinite: 'Suspended until review',
};
const TYPES = ['complaint', 'support', 'incident'];

export default function SupportTab({ data }: { data: SupportData }) {
    const r = data.resolution;
    const p = data.penalties;
    const maxCat = Math.max(1, ...data.categories.map((c) => c.count));

    return (
        <div className="space-y-5">
            <section aria-label="Support key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi icon={Inbox} label="Reports filed" value={data.total} note={`${data.by_type.incident ?? 0} incident report${(data.by_type.incident ?? 0) === 1 ? '' : 's'}`} />
                <Kpi
                    icon={MessageSquareWarning}
                    label="Open now"
                    value={data.open_now}
                    note={data.oldest_open_days === null ? 'Nothing waiting' : `Oldest waiting ${data.oldest_open_days} day${data.oldest_open_days === 1 ? '' : 's'}`}
                    tone={data.open_now > 0 ? 'warn' : 'good'}
                />
                <Kpi icon={Clock} label="Average time to close" value={hoursText(r.avg_hours)} note={r.closed === 0 ? 'No closed reports in range' : `Median ${hoursText(r.median_hours)} · ${r.closed} closed`} />
                <Kpi icon={ShieldAlert} label="Suspensions from upheld complaints" value={p.suspensions} note={`${p.active_suspensions} in force now`} tone={p.suspensions > 0 ? 'alert' : 'default'} />
            </section>

            <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Reports filed per day" className="xl:col-span-2">
                    <Legend items={TYPES.map((t) => ({ name: TYPE_LABELS[t]!, color: TYPE_COLORS[t]! }))} />
                    <DailyBars
                        title="Reports filed per day by type"
                        rows={data.trend.map((d) => ({ label: d.date, parts: [d.complaint, d.support, d.incident] }))}
                        colors={TYPES.map((t) => TYPE_COLORS[t]!)}
                        names={TYPES.map((t) => TYPE_LABELS[t]!)}
                    />
                </Panel>
                <Panel title="By status">
                    {data.total === 0 ? (
                        <p className="py-4 text-center text-sm text-m-muted">No reports in this range.</p>
                    ) : (
                        <dl className="space-y-2.5">
                            {Object.entries(STATUS).map(([k, s]) => (
                                <div key={k} className="flex items-center justify-between text-sm">
                                    <dt><Pill className={s.cls}>{s.label}</Pill></dt>
                                    <dd className="font-semibold text-m-ink">{data.by_status[k] ?? 0}</dd>
                                </div>
                            ))}
                            <div className="border-t border-m-line pt-2.5">
                                <Row k="Filed by riders" v={data.reporters.rider ?? 0} />
                                <Row k="Filed by passengers" v={data.reporters.passenger ?? 0} />
                            </div>
                        </dl>
                    )}
                </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Most common categories" className="lg:col-span-1">
                    {data.categories.length === 0 ? (
                        <p className="py-4 text-center text-sm text-m-muted">No reports in this range.</p>
                    ) : (
                        <div className="space-y-3">
                            {data.categories.map((c) => (
                                <Meter key={c.key} label={c.label} value={c.count} share={(c.count / maxCat) * 100} />
                            ))}
                        </div>
                    )}
                </Panel>
                <Panel title="How long reports take to close">
                    <dl className="space-y-2.5">
                        <Row k="Average" v={hoursText(r.avg_hours)} />
                        <Row k="Median" v={hoursText(r.median_hours)} />
                        <Row k="Closed within 24 hours" v={pct(r.within_24h)} />
                        {TYPES.map((t) => (
                            <Row key={t} k={`Average · ${TYPE_LABELS[t]}`} v={hoursText(r.by_type[t] ?? null)} />
                        ))}
                    </dl>
                    <p className="mt-3 text-xs text-m-muted">Time from filing to resolved or rejected, for reports filed in this range.</p>
                </Panel>
                <Panel title="Penalties from upheld complaints">
                    {p.total === 0 ? (
                        <p className="py-4 text-center text-sm text-m-muted">No complaints were upheld with a penalty in this range.</p>
                    ) : (
                        <dl className="space-y-2.5">
                            {Object.entries(ACTIONS).map(([k, label]) => (
                                <Row key={k} k={label} v={p.by_action[k] ?? 0} />
                            ))}
                            <div className="border-t border-m-line pt-2.5">
                                <Row k="Penalty points given" v={p.points} />
                                <Row k="Suspensions lifted" v={p.lifted} />
                                <Row k="Against riders" v={p.subjects.rider ?? 0} />
                                <Row k="Against passengers" v={p.subjects.passenger ?? 0} />
                            </div>
                        </dl>
                    )}
                </Panel>
            </div>
        </div>
    );
}
