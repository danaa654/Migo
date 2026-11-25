import { Banknote, Receipt, Ticket, Trophy } from 'lucide-react';
import { DailyBars, Delta, Empty, Kpi, Legend, Meter, Panel, peso, pesoShort, th } from './ui';

export type RevenueData = {
    trend: { date: string; services: Record<string, number>; rides: number; subscriptions: number }[];
    services: { service: string; trips: number; fare: number; avg_fare: number | null; share: number | null }[];
    totals: Totals;
    previous: Totals;
};
type Totals = { ride_fare: number; trips: number; avg_fare: number | null; subscription_gross: number; subscription_payments: number; combined: number };

export const SERVICE_COLORS: Record<string, string> = { MIGOMOTO: '#1B7F5C', MIGOCARS: '#3B6FA8', MIGODALA: '#E8731A' };
const SUBSCRIPTION_COLOR = '#C9A227';
const SERVICE_NAMES: Record<string, string> = { MIGOMOTO: 'MigoMoto', MIGOCARS: 'MigoCars', MIGODALA: 'MigoDala' };
export const serviceName = (s: string) => SERVICE_NAMES[s] ?? s;

export default function RevenueTab({ data, service }: { data: RevenueData; service: string | null }) {
    const { totals: t, previous: p } = data;
    const names = Object.keys(SERVICE_COLORS);
    const busiest = data.services.find((s) => s.trips > 0);

    return (
        <div className="space-y-5">
            <section aria-label="Revenue key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi icon={Banknote} label="Ride fare value" value={peso(t.ride_fare)} note={<Delta now={t.ride_fare} before={p.ride_fare} />} tone="good" />
                <Kpi icon={Ticket} label="Subscription income" value={peso(t.subscription_gross)} note={<>Gross, before Xendit fees · <Delta now={t.subscription_gross} before={p.subscription_gross} /></>} tone="good" />
                <Kpi icon={Receipt} label="Average fare" value={t.avg_fare === null ? '—' : peso(t.avg_fare)} note={`${t.trips} completed trip${t.trips === 1 ? '' : 's'}`} />
                <Kpi icon={Trophy} label="Busiest service" value={busiest ? serviceName(busiest.service) : '—'} note={busiest ? `${busiest.trips} completed trips` : 'No completed trips'} />
            </section>

            <p className="rounded-xl bg-m-mint px-3 py-2 text-xs text-m-forest">
                Ride fare value counts <b>completed</b> bookings only, by the day the ride was requested.
                {service ? ` The service filter (${serviceName(service)}) applies to ride fares only; subscription income is not tied to a service.` : ' Subscription income is shown gross because the Xendit fee is not stored.'}
            </p>

            <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Ride fare value per day" className="xl:col-span-2" aside="Completed bookings">
                    <Legend items={names.map((n) => ({ name: serviceName(n), color: SERVICE_COLORS[n]! }))} />
                    <DailyBars
                        title="Ride fare value per day by service"
                        rows={data.trend.map((d) => ({ label: d.date, parts: names.map((n) => d.services[n] ?? 0) }))}
                        colors={names.map((n) => SERVICE_COLORS[n]!)}
                        names={names.map(serviceName)}
                        format={pesoShort}
                    />
                </Panel>
                <Panel title="Subscription income per day" aside="Gross">
                    <Legend items={[{ name: 'Verified payments', color: SUBSCRIPTION_COLOR }]} />
                    <DailyBars title="Subscription income per day" rows={data.trend.map((d) => ({ label: d.date, parts: [d.subscriptions] }))} colors={[SUBSCRIPTION_COLOR]} names={['Subscription income']} format={pesoShort} />
                </Panel>
            </div>

            <Panel title="By service">
                {data.services.every((s) => s.trips === 0) ? (
                    <Empty text="No completed trips in this range." />
                ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                            {data.services.map((s) => (
                                <Meter key={s.service} label={serviceName(s.service)} value={peso(s.fare)} share={s.share ?? 0} color={SERVICE_COLORS[s.service]} right={s.share === null ? undefined : `${s.share}%`} />
                            ))}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left">
                                    <tr>
                                        <th className={th}>Service</th>
                                        <th className={`${th} text-right`}>Trips</th>
                                        <th className={`${th} text-right`}>Avg. fare</th>
                                        <th className={`${th} text-right`}>Fare value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.services.map((s) => (
                                        <tr key={s.service} className="border-t border-m-line">
                                            <td className="px-3 py-2 font-medium text-m-ink">{serviceName(s.service)}</td>
                                            <td className="px-3 py-2 text-right">{s.trips}</td>
                                            <td className="px-3 py-2 text-right">{s.avg_fare === null ? '—' : peso(s.avg_fare)}</td>
                                            <td className="px-3 py-2 text-right font-semibold">{peso(s.fare)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Panel>
        </div>
    );
}

