import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarDays,
    ChevronRight,
    CircleCheck,
    Clock,
    CreditCard,
    MessageSquareWarning,
    RefreshCw,
    SearchCheck,
    ShieldAlert,
    Users,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
    ComplaintStatusBadge,
    ReporterBadge,
    SafetyBadge,
    TypeBadge,
} from '@/components/admin/complaint-shared';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';
import { adminRoleTheme } from '@/lib/admin-role-theme';

type Report = {
    id: string;
    category_label: string;
    report_type: string;
    is_safety: boolean;
    status: string;
    reporter_type: string;
    reporter_name: string | null;
    created_at: string | null;
};
type Props = {
    stats: {
        pending: number;
        under_investigation: number;
        open_incidents: number;
        resolved_this_week: number;
    } | null;
    reports: Report[] | null;
};

const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const td = 'px-4 py-2 align-middle';

function Stat({
    icon: Icon,
    label,
    sub,
    value,
    tone,
}: {
    icon: LucideIcon;
    label: string;
    sub: string;
    value: number | null | undefined;
    tone: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-m-line bg-m-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}
            >
                <Icon className="size-5" />
            </span>
            <div className="min-w-0">
                <p className="text-xs font-medium text-m-body2">{label}</p>
                {value == null ? (
                    <p className="mt-1 text-sm font-medium text-m-muted">
                        Data not yet available
                    </p>
                ) : (
                    <p className="text-xl leading-tight font-bold text-m-ink">
                        {value.toLocaleString()}
                    </p>
                )}
                <p className="text-[11px] text-m-muted">{sub}</p>
            </div>
        </div>
    );
}

export default function SupportDashboard({ stats, reports }: Props) {
    const { admin } = usePage().props as unknown as {
        admin: { role: string; areas?: string[] } | null;
    };
    const theme = adminRoleTheme(admin?.role);
    const [refreshing, setRefreshing] = useState(false);
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const refresh = () =>
        router.reload({
            only: ['stats', 'reports', 'adminNotifications'],
            onStart: () => setRefreshing(true),
            onFinish: () => setRefreshing(false),
        });

    const quick: [string, string, LucideIcon, string][] = [
        ['Open Support Center', '/admin/complaints', MessageSquareWarning, 'support'],
        ['Manage Passengers', '/admin/passengers', Users, 'passengers'],
        ['Subscription Management', '/admin/subscriptions', CreditCard, 'subscriptions'],
    ];
    const visibleQuick = quick.filter(([, , , area]) =>
        admin?.areas?.includes(area),
    );

    return (
        <AdminLayout title="Dashboard">
            <section
                className={`relative mb-4 min-h-32 overflow-hidden rounded-2xl border border-m-line bg-linear-to-br ${theme.banner} px-5 py-4 shadow-sm`}
            >
                <img
                    src="/img/header-banner.webp"
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto max-w-[80%] [mask-image:linear-gradient(to_right,transparent,black_30%)] object-cover object-right select-none sm:block dark:opacity-30"
                />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2
                            className={`text-xl font-extrabold ${theme.bannerTitle}`}
                        >
                            {theme.greeting}
                        </h2>
                        <p className="mt-0.5 text-sm text-m-body2">
                            {theme.tagline}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-m-ink">
                                <CalendarDays className="size-4 text-m-accent" />
                                {today}
                            </p>
                            <button
                                type="button"
                                onClick={refresh}
                                disabled={refreshing}
                                className="inline-flex items-center gap-1.5 rounded-full border border-m-line bg-m-card/80 px-3 py-1.5 text-xs font-semibold text-m-body shadow-sm backdrop-blur transition hover:bg-m-card disabled:opacity-60"
                            >
                                <RefreshCw
                                    className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`}
                                />{' '}
                                {refreshing ? 'Refreshing…' : 'Refresh Data'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                    icon={Clock}
                    label="Pending Reports"
                    sub="Waiting for review"
                    value={stats?.pending}
                    tone="bg-[#F59E0B]/15 text-[#F59E0B]"
                />
                <Stat
                    icon={SearchCheck}
                    label="Under Investigation"
                    sub="Being handled"
                    value={stats?.under_investigation}
                    tone="bg-[#7C3AED]/10 text-m-purple"
                />
                <Stat
                    icon={ShieldAlert}
                    label="Open Safety Incidents"
                    sub="Needs attention first"
                    value={stats?.open_incidents}
                    tone="bg-m-red/10 text-m-red"
                />
                <Stat
                    icon={CircleCheck}
                    label="Resolved This Week"
                    sub="Last 7 days"
                    value={stats?.resolved_this_week}
                    tone="bg-m-green/10 text-m-green"
                />
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[1fr_280px]">
                <section className="overflow-hidden rounded-xl border border-m-line bg-m-card shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-m-ink">
                            <MessageSquareWarning className="size-5 text-m-accent" />
                            Needs Attention
                        </h2>
                        <Link
                            href="/admin/complaints"
                            className="inline-flex items-center gap-1.5 rounded-full border border-m-accent px-3 py-1 text-xs font-semibold text-m-accent transition hover:bg-m-mint"
                        >
                            Open Support Center{' '}
                            <ArrowRight className="size-3.5" />
                        </Link>
                    </div>

                    {reports === null ? (
                        <p className="px-4 py-8 text-center text-sm text-m-muted">
                            Data not yet available.
                        </p>
                    ) : reports.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-m-muted">
                            No open reports. You&rsquo;re all caught up.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-left text-[13px]">
                                <thead className="bg-m-mint/60 text-xs font-semibold text-m-body">
                                    <tr>
                                        {[
                                            'Report',
                                            'Reported By',
                                            'Filed',
                                            'Status',
                                            'Action',
                                        ].map((c) => (
                                            <th
                                                key={c}
                                                scope="col"
                                                className="px-4 py-2"
                                            >
                                                {c}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-m-line">
                                    {reports.map((r) => (
                                        <tr key={r.id}>
                                            <td className={td}>
                                                <p className="font-medium text-m-ink">
                                                    {r.category_label}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                                    <TypeBadge
                                                        type={r.report_type}
                                                    />
                                                    {r.is_safety && (
                                                        <SafetyBadge />
                                                    )}
                                                    <span className="font-mono text-[11px] text-m-muted">
                                                        {shortId(r.id)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={td}>
                                                <p>
                                                    {r.reporter_name ??
                                                        'Unknown'}
                                                </p>
                                                <div className="mt-1">
                                                    <ReporterBadge
                                                        type={r.reporter_type}
                                                    />
                                                </div>
                                            </td>
                                            <td
                                                className={`${td} whitespace-nowrap`}
                                            >
                                                {formatDate(r.created_at, true)}
                                            </td>
                                            <td className={td}>
                                                <ComplaintStatusBadge
                                                    status={r.status}
                                                />
                                            </td>
                                            <td className={td}>
                                                <Link
                                                    href={`/admin/complaints/${r.id}`}
                                                    className="inline-block rounded-full border border-m-accent px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-m-accent transition hover:bg-m-mint"
                                                >
                                                    Review
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <aside className="rounded-xl border border-m-line bg-m-card shadow-sm xl:sticky xl:top-20">
                    <h2 className="flex items-center gap-2 border-b border-m-line px-4 py-3 text-sm font-bold text-m-ink">
                        <Zap className="size-5 text-m-accent" />
                        Quick Actions
                    </h2>
                    <div className="space-y-2 p-3">
                        {visibleQuick.map(([label, href, Icon]) => (
                            <Link
                                key={href}
                                href={href}
                                className="flex items-center gap-2.5 rounded-lg border border-m-line bg-m-card px-3 py-2.5 text-[13px] font-semibold text-m-ink shadow-sm transition hover:-translate-y-0.5 hover:border-m-accent hover:shadow-md"
                            >
                                <Icon className="size-5 shrink-0 text-m-accent" />
                                <span className="flex-1">{label}</span>
                                <ChevronRight className="size-4 text-m-muted" />
                            </Link>
                        ))}
                    </div>
                </aside>
            </div>
        </AdminLayout>
    );
}