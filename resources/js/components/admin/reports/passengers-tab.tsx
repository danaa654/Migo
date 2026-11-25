import { Repeat, UserPlus, Users, XCircle } from 'lucide-react';
import { DailyBars, Delta, Kpi, Meter, Panel, pct, Row, SplitBar } from './ui';

export type PassengersData = {
    signups: number;
    previous_signups: number;
    total_passengers: number;
    by_status: Record<string, number>;
    bookers: number;
    one_time: number;
    repeat: number;
    repeat_rate: number | null;
    avg_bookings: number | null;
    cancelled: number;
    cancellation_rate: number | null;
    buckets: { label: string; passengers: number }[];
    trend: { date: string; signups: number }[];
};

const STATUS_LABELS: Record<string, string> = { active: 'Active', suspended: 'Suspended', deactivated: 'Deactivated' };

export default function PassengersTab({ data }: { data: PassengersData }) {
    const maxBucket = Math.max(1, ...data.buckets.map((b) => b.passengers));

    return (
        <div className="space-y-5">
            <section aria-label="Passenger key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi icon={UserPlus} label="New sign-ups" value={data.signups} note={<Delta now={data.signups} before={data.previous_signups} />} tone="good" />
                <Kpi icon={Users} label="Passengers who booked" value={data.bookers} note={data.avg_bookings === null ? undefined : `${data.avg_bookings} bookings each on average`} />
                <Kpi icon={Repeat} label="Repeat bookers" value={pct(data.repeat_rate)} note={`${data.repeat} of ${data.bookers} booked 2+ times`} tone="good" />
                <Kpi icon={XCircle} label="Cancellation rate" value={pct(data.cancellation_rate)} note={`${data.cancelled} cancelled by passengers`} tone={data.cancellation_rate !== null && data.cancellation_rate >= 20 ? 'warn' : 'default'} />
            </section>

            <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="New sign-ups per day" className="xl:col-span-2" aside="Passenger accounts created">
                    <DailyBars title="New passenger sign-ups per day" rows={data.trend.map((d) => ({ label: d.date, parts: [d.signups] }))} colors={['#1B7F5C']} names={['Sign-ups']} />
                </Panel>
                <Panel title="Accounts now" aside={`${data.total_passengers} total`}>
                    <dl className="space-y-2.5">
                        {Object.entries(data.by_status).map(([k, v]) => (
                            <Row key={k} k={STATUS_LABELS[k] ?? k} v={v} />
                        ))}
                    </dl>
                </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Repeat versus one-time bookers" aside="Bookings requested in range">
                    <SplitBar parts={[{ name: 'One-time', value: data.one_time, color: '#9CA3AF' }, { name: 'Repeat (2+)', value: data.repeat, color: '#1B7F5C' }]} />
                </Panel>
                <Panel title="How often passengers book" aside="Passengers by bookings in range">
                    <div className="space-y-3">
                        {data.buckets.map((b) => (
                            <Meter key={b.label} label={b.label === '1' ? '1 booking' : `${b.label} bookings`} value={b.passengers} share={(b.passengers / maxBucket) * 100} />
                        ))}
                    </div>
                </Panel>
            </div>
        </div>
    );
}
