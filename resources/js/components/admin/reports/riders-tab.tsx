import { Ban, BadgeCheck, BellOff, Hourglass, Radio } from 'lucide-react';
import { DailyBars, Delta, Empty, Kpi, Legend, Meter, Panel, pct, peso, Row, th } from './ui';

type RiderRow = {
    rider_id: string;
    name: string;
    finished: number;
    completed: number;
    cancelled_by_rider: number;
    cancelled_by_passenger: number;
    completion_rate: number | null;
    cancel_rate: number | null;
    fare: number;
};
export type RidersData = {
    now: { online: number; pending_approval: number; suspended: number; active: number; total: number };
    newly_approved: number;
    previous_newly_approved: number;
    performance: { riders_with_trips: number; finished: number; completion_rate: number | null; rider_cancel_rate: number | null };
    top: RiderRow[];
    watch: RiderRow[];
    offers: { total: number; accepted: number; declined: number; expired: number; lost: number; cancelled: number; expiry_rate: number | null; response_rate: number | null };
    trend: { date: string; offers: number; expired: number }[];
};

const OFFER_COLORS = { accepted: '#1B7F5C', declined: '#3B6FA8', expired: '#B45309', lost: '#6B7280', cancelled: '#9CA3AF' };

function RiderTable({ rows, empty }: { rows: RiderRow[]; empty: string }) {
    if (rows.length === 0) return <Empty text={empty} />;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-left">
                    <tr>
                        <th className={th}>Rider</th>
                        <th className={`${th} text-right`}>Completed</th>
                        <th className={`${th} text-right`}>Completion</th>
                        <th className={`${th} text-right`}>Cancelled by rider</th>
                        <th className={`${th} text-right`}>Fare value</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.rider_id} className="border-t border-m-line">
                            <td className="px-3 py-2 font-medium text-m-ink">{r.name}</td>
                            <td className="px-3 py-2 text-right">{r.completed}<span className="text-m-muted"> / {r.finished}</span></td>
                            <td className="px-3 py-2 text-right">{pct(r.completion_rate)}</td>
                            <td className="px-3 py-2 text-right">
                                {r.cancelled_by_rider}
                                <span className={r.cancel_rate !== null && r.cancel_rate >= 25 ? 'font-semibold text-red-700' : 'text-m-muted'}> ({pct(r.cancel_rate)})</span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">{peso(r.fare)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function RidersTab({ data }: { data: RidersData }) {
    const { now, performance: perf, offers: o } = data;
    const statuses: { key: keyof typeof OFFER_COLORS; label: string }[] = [
        { key: 'accepted', label: 'Accepted' },
        { key: 'declined', label: 'Declined' },
        { key: 'expired', label: 'Expired, no response' },
        { key: 'lost', label: 'Lost to another rider' },
        { key: 'cancelled', label: 'Cancelled' },
    ];

    return (
        <div className="space-y-5">
            <section aria-label="Rider key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi icon={Radio} label="Online now" value={now.online} note={`${now.active} accredited and active`} tone="good" />
                <Kpi icon={BadgeCheck} label="Newly approved" value={data.newly_approved} note={<Delta now={data.newly_approved} before={data.previous_newly_approved} />} />
                <Kpi icon={Hourglass} label="Pending approval" value={now.pending_approval} note="Right now, not date-filtered" tone={now.pending_approval > 0 ? 'warn' : 'default'} />
                <Kpi icon={Ban} label="Suspended" value={now.suspended} note="Right now, not date-filtered" tone={now.suspended > 0 ? 'alert' : 'default'} />
            </section>

            <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Top riders by completed trips" className="xl:col-span-2" aside="Completed / finished trips in range">
                    <RiderTable rows={data.top} empty="No finished trips with a rider in this range." />
                </Panel>
                <Panel title="Trip results">
                    <dl className="space-y-2.5">
                        <Row k="Riders with finished trips" v={perf.riders_with_trips} />
                        <Row k="Finished trips" v={perf.finished} />
                        <Row k="Completion rate" v={pct(perf.completion_rate)} />
                        <Row k="Cancelled by rider" v={pct(perf.rider_cancel_rate)} />
                    </dl>
                    <p className="mt-3 text-xs text-m-muted">Rates are completed or rider-cancelled trips out of trips that have ended. Trips still in progress are left out.</p>
                </Panel>
            </div>

            <Panel title="Highest rider cancellation rate" aside="At least 3 finished trips">
                <RiderTable rows={data.watch} empty="No rider has cancelled a trip in this range." />
            </Panel>

            <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Offers that expire without a response" icon={BellOff} className="xl:col-span-2" aside="Per day">
                    <Legend items={[{ name: 'Answered or other', color: '#3B6FA8' }, { name: 'Expired, no response', color: '#B45309' }]} />
                    <DailyBars
                        title="Offers sent and expired per day"
                        // Expired offers are part of the offers sent, so the blue part is everything else.
                        rows={data.trend.map((d) => ({ label: d.date, parts: [d.offers - d.expired, d.expired] }))}
                        colors={['#3B6FA8', '#B45309']}
                        names={['Answered or other', 'Expired, no response']}
                    />
                </Panel>
                <Panel title="Offer outcomes">
                    {o.total === 0 ? (
                        <Empty text="No ride offers in this range." />
                    ) : (
                        <>
                            <p className="text-3xl font-extrabold text-m-ink">{pct(o.expiry_rate)}</p>
                            <p className="mb-4 text-xs text-m-muted">of {o.total} offers expired unanswered · reply rate {pct(o.response_rate)} (accepted or declined, out of those plus expired)</p>
                            <div className="space-y-3">
                                {statuses.map((s) => (
                                    <Meter key={s.key} label={s.label} value={o[s.key]} share={(o[s.key] / o.total) * 100} color={OFFER_COLORS[s.key]} />
                                ))}
                            </div>
                        </>
                    )}
                </Panel>
            </div>
        </div>
    );
}
