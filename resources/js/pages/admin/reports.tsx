import { router } from '@inertiajs/react';
import { Banknote, Bike, CalendarRange, CreditCard, LifeBuoy, ListChecks, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import BookingsTab from '@/components/admin/reports/bookings-tab';
import type { BookingsData, Summary } from '@/components/admin/reports/bookings-tab';
import PassengersTab from '@/components/admin/reports/passengers-tab';
import type { PassengersData } from '@/components/admin/reports/passengers-tab';
import RevenueTab from '@/components/admin/reports/revenue-tab';
import type { RevenueData } from '@/components/admin/reports/revenue-tab';
import RidersTab from '@/components/admin/reports/riders-tab';
import type { RidersData } from '@/components/admin/reports/riders-tab';
import SubscriptionsTab from '@/components/admin/reports/subscriptions-tab';
import type { SubscriptionsData } from '@/components/admin/reports/subscriptions-tab';
import SupportTab from '@/components/admin/reports/support-tab';
import type { SupportData } from '@/components/admin/reports/support-tab';
import { box, Delta, peso } from '@/components/admin/reports/ui';
import AdminLayout from '@/layouts/admin-layout';

type TabKey = 'bookings' | 'revenue' | 'riders' | 'passengers' | 'support' | 'subscriptions';
type Filters = { tab: TabKey; preset: string; from: string; to: string; service: string | null };
type Props = {
    filters: Filters;
    services: string[];
    summary: {
        current: Summary;
        previous: Summary;
        active_riders: number | null;
        open_complaints: number | null;
    };
    /** Shape depends on filters.tab (the server only builds the active tab). */
    report: BookingsData | RevenueData | RidersData | PassengersData | SupportData | SubscriptionsData | null;
};

const PRESETS = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: 'month', label: 'This month' },
    { key: 'custom', label: 'Custom' },
];
const TABS: { key: TabKey; label: string; icon: LucideIcon; usesService: boolean }[] = [
    { key: 'bookings', label: 'Bookings & Dispatch', icon: ListChecks, usesService: true },
    { key: 'revenue', label: 'Revenue', icon: Banknote, usesService: true },
    { key: 'riders', label: 'Riders', icon: Bike, usesService: true },
    { key: 'passengers', label: 'Passengers', icon: Users, usesService: true },
    { key: 'support', label: 'Support & Safety', icon: LifeBuoy, usesService: false },
    { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard, usesService: false },
];

function Card({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
    return (
        <div className={`${box} p-4`}>
            <p className="text-xs font-medium text-m-muted">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-m-ink">{value}</p>
            {note && <p className="mt-1 text-xs text-m-muted">{note}</p>}
        </div>
    );
}

const input = 'rounded-lg border border-m-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-m-forest/40';

export default function Reports({ filters, services, summary, report }: Props) {
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const { current, previous } = summary;
    const activeTab = TABS.find((t) => t.key === filters.tab) ?? TABS[0]!;

    const go = (patch: Partial<Filters>) => {
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
                <div className={`${box} flex flex-wrap items-center gap-3 p-3`}>
                    <CalendarRange className="ml-1 size-4 text-m-forest" aria-hidden />
                    <div className="flex flex-wrap gap-1">
                        {PRESETS.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => go({ preset: p.key })}
                                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                                    filters.preset === p.key ? 'bg-m-forest text-white shadow' : 'text-m-muted hover:bg-m-mint hover:text-m-ink'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {filters.preset === 'custom' && (
                        <div className="flex items-center gap-2 text-sm">
                            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={input} />
                            <span>to</span>
                            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={input} />
                            <button onClick={() => go({ from, to })} className="rounded-lg bg-m-forest px-3 py-1.5 font-semibold text-white">
                                Apply
                            </button>
                        </div>
                    )}
                    <select
                        value={filters.service ?? ''}
                        onChange={(e) => go({ service: e.target.value || null })}
                        disabled={!activeTab.usesService}
                        title={activeTab.usesService ? undefined : `The service filter does not apply to ${activeTab.label}`}
                        className={`${input} ml-auto disabled:cursor-not-allowed disabled:opacity-50`}
                        aria-label="Service"
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
                    <Card label="Total bookings" value={String(current.total)} note={<Delta now={current.total} before={previous.total} />} />
                    <Card
                        label="Completion rate"
                        value={current.completion_rate === null ? '—' : `${current.completion_rate}%`}
                        note={`${current.completed} completed`}
                    />
                    <Card label="Total fare value" value={peso(current.fare_value)} note={<Delta now={current.fare_value} before={previous.fare_value} />} />
                    <Card label="Active riders" value={summary.active_riders === null ? '—' : String(summary.active_riders)} note="Accredited and active now" />
                    <Card label="Open complaints" value={summary.open_complaints === null ? '—' : String(summary.open_complaints)} note="Right now, not date-filtered" />
                </div>

                {/* Tabs */}
                <div className={`${box} flex flex-wrap gap-1.5 p-1.5`} role="tablist">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            role="tab"
                            aria-selected={filters.tab === t.key}
                            onClick={() => go({ tab: t.key })}
                            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                                filters.tab === t.key ? 'bg-m-forest text-white shadow' : 'text-m-muted hover:bg-m-mint hover:text-m-ink'
                            }`}
                        >
                            <t.icon className="size-4" aria-hidden /> {t.label}
                        </button>
                    ))}
                </div>

                {report && filters.tab === 'bookings' && <BookingsTab data={report as BookingsData} byStatus={current.by_status} />}
                {report && filters.tab === 'revenue' && <RevenueTab data={report as RevenueData} service={filters.service} />}
                {report && filters.tab === 'riders' && <RidersTab data={report as RidersData} />}
                {report && filters.tab === 'passengers' && <PassengersTab data={report as PassengersData} />}
                {report && filters.tab === 'support' && <SupportTab data={report as SupportData} />}
                {report && filters.tab === 'subscriptions' && <SubscriptionsTab data={report as SubscriptionsData} />}
            </div>
        </AdminLayout>
    );
}
