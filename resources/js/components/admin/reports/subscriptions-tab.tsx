import { BadgeCheck, CalendarClock, CircleAlert, Gift, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import { colorFor, planStyle } from '@/lib/plan-color';
import { DailyBars, Delta, Kpi, Legend, Meter, Panel, pct, peso, pesoShort, Row } from './ui';

export type SubscriptionsData = {
    now: { active_paid: number; active_trials: number; expiring_soon: number; riders_with_access: number };
    trials: Trials;
    previous_trials: Trials;
    gross: number;
    previous_gross: number;
    purchases: number;
    by_plan: { id: number | null; name: string; color: string | null; price: number | null; duration: string | null; is_active: boolean; purchases: number; gross: number }[];
    methods: { method: string; payments: number; gross: number }[];
    lifecycle: { new: number; renewals: number; paid_ended: number; paid_renewed: number; paid_lapsed: number; renewal_rate: number | null; trials_ended: number };
    failed: Failed;
    previous_failed: Failed;
    trend: { date: string; gross: number; new: number; renewals: number; expirations: number }[];
};
type Trials = { started: number; converted: number; rate: number | null };
type Failed = { failed: number; failed_value: number; abandoned: number };

const RENEWAL = '#1B7F5C';
const NEW = '#3B6FA8';
const EXPIRED = '#B45309';
const GOLD = '#C9A227';

/** A compact version of the plan card from Subscription Management, in the colour the admin chose for the plan. */
function PlanTile({ plan, index }: { plan: SubscriptionsData['by_plan'][number]; index: number }) {
    const st = planStyle(colorFor(plan.name, plan.color, index));

    return (
        <div className={`relative overflow-hidden rounded-2xl p-5 shadow-md ${plan.id !== null && !plan.is_active ? 'opacity-60' : ''}`} style={st.card}>
            <span aria-hidden className="pointer-events-none absolute -top-14 -right-10 size-40 rounded-full bg-white/15" />
            <span aria-hidden className="pointer-events-none absolute -right-16 -bottom-20 size-48 rounded-full bg-white/10" />
            <div className="relative flex items-center justify-between">
                <p className="text-xs font-extrabold tracking-[0.2em] uppercase">MIGO · {plan.name}</p>
                {plan.id === null ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.soft }}>Removed plan</span>
                ) : (
                    !plan.is_active && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.soft }}>Inactive</span>
                )}
            </div>
            <div className="relative mt-5">
                <p className="text-3xl leading-none font-extrabold">{peso(plan.gross)}</p>
                <p className="mt-1 text-xs opacity-80">gross in this range{plan.duration ? ` · ${plan.duration}` : ''}</p>
            </div>
            <div className="relative mt-4 rounded-xl p-3 text-center" style={{ background: st.soft }}>
                <p className="text-lg font-extrabold">{plan.purchases}</p>
                <p className="text-[11px] opacity-80">{plan.purchases === 1 ? 'Purchase' : 'Purchases'}</p>
            </div>
        </div>
    );
}

export default function SubscriptionsTab({ data }: { data: SubscriptionsData }) {
    const { now, trials, previous_trials: pt, lifecycle: l, failed, previous_failed: pf } = data;
    const maxMethod = Math.max(1, ...data.methods.map((m) => m.gross));
    const rateDiff = trials.rate !== null && pt.rate !== null ? Math.round((trials.rate - pt.rate) * 10) / 10 : null;

    return (
        <div className="space-y-5">
            <section aria-label="Subscription key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi icon={BadgeCheck} label="Active paid subscriptions" value={now.active_paid} note={`${now.expiring_soon} expiring in 7 days`} tone="good" />
                <Kpi icon={Gift} label="Active free trials" value={now.active_trials} note="Right now, not date-filtered" />
                <Kpi
                    icon={TrendingUp}
                    label="Trial-to-paid conversion"
                    value={pct(trials.rate)}
                    note={`${trials.converted} of ${trials.started} trials started in range${rateDiff === null ? '' : ` · ${rateDiff > 0 ? '+' : ''}${rateDiff} pts vs previous`}`}
                    tone="good"
                />
                <Kpi icon={Wallet} label="Gross revenue" value={peso(data.gross)} note={<>{data.purchases} payment{data.purchases === 1 ? '' : 's'} · <Delta now={data.gross} before={data.previous_gross} /></>} tone="good" />
            </section>

            <section aria-label="Revenue per plan" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.by_plan.map((p, i) => (
                    <PlanTile key={`${p.id ?? p.name}`} plan={p} index={i} />
                ))}
            </section>

            <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Renewals versus expirations" icon={RefreshCw} className="xl:col-span-2" aside="Per day">
                    <Legend items={[{ name: 'First purchases', color: NEW }, { name: 'Renewals', color: RENEWAL }, { name: 'Periods ended', color: EXPIRED }]} />
                    <DailyBars
                        title="First purchases, renewals and expirations per day"
                        rows={data.trend.map((d) => ({ label: d.date, parts: [d.new, d.renewals, d.expirations] }))}
                        colors={[NEW, RENEWAL, EXPIRED]}
                        names={['First purchases', 'Renewals', 'Periods ended']}
                    />
                </Panel>
                <Panel title="Renewal picture" icon={CalendarClock}>
                    <dl className="space-y-2.5">
                        <Row k="First purchases" v={l.new} />
                        <Row k="Renewals" v={l.renewals} />
                        <Row k="Paid periods that ended" v={l.paid_ended} />
                        <Row k="…of which renewed" v={l.paid_renewed} />
                        <Row k="…of which lapsed" v={l.paid_lapsed} />
                        <Row k="Renewal rate" v={pct(l.renewal_rate)} />
                        <Row k="Free trials that ended" v={l.trials_ended} />
                    </dl>
                    <p className="mt-3 text-xs text-m-muted">A paid period counts as renewed when the rider has another paid period starting at or after its end.</p>
                </Panel>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Gross revenue per day" className="xl:col-span-2" aside="Verified payments, before Xendit fees">
                    <DailyBars title="Subscription gross revenue per day" rows={data.trend.map((d) => ({ label: d.date, parts: [d.gross] }))} colors={[GOLD]} names={['Gross revenue']} format={pesoShort} height="h-40" />
                </Panel>
                <div className="space-y-5">
                    <Panel title="Payment methods">
                        {data.methods.length === 0 ? (
                            <p className="py-4 text-center text-sm text-m-muted">No payments in this range.</p>
                        ) : (
                            <div className="space-y-3">
                                {data.methods.map((m) => (
                                    <Meter key={m.method} label={m.method} value={peso(m.gross)} share={(m.gross / maxMethod) * 100} right={`${m.payments}×`} />
                                ))}
                            </div>
                        )}
                    </Panel>
                    <Panel title="Checkouts not completed" icon={CircleAlert}>
                        <dl className="space-y-2.5">
                            <Row k="Failed checkouts" v={<>{failed.failed} <span className="font-normal text-m-muted">({peso(failed.failed_value)})</span></>} />
                            <Row k="Abandoned (unpaid after 30 min)" v={failed.abandoned} />
                        </dl>
                        <p className="mt-3 text-xs">
                            <Delta now={failed.failed} before={pf.failed} lowerIsBetter />
                        </p>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
