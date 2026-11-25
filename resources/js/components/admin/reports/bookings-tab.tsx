import { Empty, mins, Panel, peso, Row, th } from './ui';

export type Summary = {
    total: number;
    completed: number;
    completion_rate: number | null;
    fare_value: number;
    by_status: Record<string, number>;
    cancelled: number;
    unmatched: number;
};
export type BookingsData = {
    trend: { date: string; requested: number; completed: number; cancelled: number }[];
    by_hour: number[];
    by_service: { service: string; total: number; completed: number; fare_value: number }[];
    timings: { avg_match_minutes: number | null; avg_pickup_minutes: number | null; avg_trip_minutes: number | null; avg_distance_km: number | null };
};

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

/** Simple CSS bars (same content as before; only the colours and card style were matched to the other tabs). */
function Bars({ values, labels, title }: { values: number[]; labels: string[]; title: string }) {
    const max = Math.max(1, ...values);

    return (
        <div>
            <div className="flex h-36 items-end gap-0.5" role="img" aria-label={title}>
                {values.map((v, i) => (
                    <div
                        key={i}
                        title={`${labels[i]}: ${v}`}
                        className="min-w-[2px] flex-1 rounded-t bg-gradient-to-t from-m-forest to-m-green"
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

export default function BookingsTab({ data, byStatus }: { data: BookingsData; byStatus: Record<string, number> }) {
    return (
        <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Bookings per day" className="lg:col-span-2">
                    {data.trend.length > 0 && <Bars title="Bookings per day" values={data.trend.map((d) => d.requested)} labels={data.trend.map((d) => d.date)} />}
                </Panel>
                <Panel title="Dispatch timings">
                    <dl className="space-y-2.5">
                        <Row k="Avg. time to match a rider" v={mins(data.timings.avg_match_minutes)} />
                        <Row k="Avg. rider pickup time" v={mins(data.timings.avg_pickup_minutes)} />
                        <Row k="Avg. trip time" v={mins(data.timings.avg_trip_minutes)} />
                        <Row k="Avg. trip distance" v={data.timings.avg_distance_km === null ? '—' : `${data.timings.avg_distance_km} km`} />
                    </dl>
                </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Bookings by status">
                    {Object.keys(byStatus).length === 0 ? (
                        <Empty text="No bookings in this range." />
                    ) : (
                        <dl className="space-y-2.5">
                            {Object.entries(byStatus).map(([k, v]) => (
                                <Row key={k} k={STATUS_LABELS[k] ?? k} v={v} />
                            ))}
                        </dl>
                    )}
                </Panel>
                <Panel title="Peak hours">
                    <Bars title="Bookings by hour of day" values={data.by_hour} labels={data.by_hour.map((_, h) => `${h}:00`)} />
                </Panel>
                <Panel title="By service">
                    <table className="w-full text-sm">
                        <thead className="text-left">
                            <tr>
                                <th className={`${th} px-0`}>Service</th>
                                <th className={`${th} text-right`}>Total</th>
                                <th className={`${th} text-right`}>Done</th>
                                <th className={`${th} px-0 text-right`}>Fare value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.by_service.map((s) => (
                                <tr key={s.service} className="border-t border-m-line">
                                    <td className="py-2">{s.service}</td>
                                    <td className="py-2 text-right">{s.total}</td>
                                    <td className="py-2 text-right">{s.completed}</td>
                                    <td className="py-2 text-right">{peso(s.fare_value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>
            </div>
        </div>
    );
}
