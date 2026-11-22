import { Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    Bike,
    CalendarClock,
    CalendarDays,
    ChevronRight,
    ClipboardCheck,
    Map,
    MessageSquareWarning,
    RefreshCw,
    UserCog,
    Users,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Rider = {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    application_status: string;
    created_at: string;
};
type Booking = {
    id: string;
    passenger_name: string | null;
    rider_name: string | null;
    pickup_location: string;
    destination: string;
    booking_status: string;
    booked_at: string;
};
type Complaint = {
    id: string;
    reporter_name: string | null;
    reporter_type: string;
    complaint_category: string;
    complaint_status: string;
    created_at: string;
};
type Props = {
    stats: {
        riders: { total: number; pending: number; approved: number } | null;
        passengers: number | null;
        bookings: number | null;
        openComplaints: number | null;
    };
    riders: Rider[] | null;
    bookings: Booking[] | null;
    complaints: Complaint[] | null;
};

const tones: Record<string, string> = {
    pending: 'bg-[#F59E0B]/10 text-m-amber',
    approved: 'bg-m-green/10 text-m-green',
    completed: 'bg-m-green/10 text-m-green',
    resolved: 'bg-m-green/10 text-m-green',
    rejected: 'bg-m-red/10 text-m-red',
    cancelled: 'bg-m-red/10 text-m-red',
    accepted: 'bg-m-forest/10 text-m-accent-hover',
    ongoing: 'bg-m-forest/10 text-m-accent-hover',
    under_investigation: 'bg-m-solid/10 text-m-ink',
};
const Badge = ({ s }: { s: string }) => (
    <span
        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap capitalize ${tones[s] ?? 'bg-m-page text-m-muted'}`}
    >
        {s.replace('_', ' ')}
    </span>
);

const initialsOf = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?';

function Stat({
    icon: Icon,
    label,
    sub,
    value,
    tone = 'text-m-accent bg-m-mint',
}: {
    icon: LucideIcon;
    label: string;
    sub: string;
    value: number | null | undefined;
    tone?: string;
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

function Panel({
    title,
    icon: Icon,
    href,
    linkText,
    children,
}: {
    title: string;
    icon: LucideIcon;
    href: string;
    linkText: string;
    children: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-m-line bg-m-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-m-ink">
                    <Icon className="size-5 text-m-accent" />
                    {title}
                </h2>
                <Link
                    href={href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-m-accent px-3 py-1 text-xs font-semibold text-m-accent transition hover:bg-m-mint"
                >
                    {linkText} <ArrowRight className="size-3.5" />
                </Link>
            </div>
            {children}
        </section>
    );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="relative overflow-hidden px-4 pt-4 pb-12 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-m-mint text-m-accent">
                <CalendarClock className="size-6" />
            </span>
            <p className="mt-2 text-sm font-bold text-m-ink">{title}</p>
            <p className="mt-0.5 text-xs text-m-muted">{hint}</p>
            <svg
                aria-hidden
                viewBox="0 0 800 60"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-9 w-full"
            >
                <path
                    d="M0 60 L0 30 C150 0 300 55 450 30 C600 5 700 25 800 12 L800 60Z"
                    className="fill-m-forest/15"
                />
                <path
                    d="M0 60 L0 42 C200 20 350 60 520 38 C650 22 740 40 800 30 L800 60Z"
                    className="fill-m-forest/25"
                />
            </svg>
        </div>
    );
}

function DataTable<T>({
    cols,
    rows,
    render,
    empty,
    emptyHint,
}: {
    cols: string[];
    rows: T[] | null;
    render: (r: T) => ReactNode;
    empty: string;
    emptyHint?: string;
}) {
    if (rows === null)
        return (
            <p className="px-4 py-8 text-center text-sm text-m-muted">
                Data not yet available.
            </p>
        );
    if (rows.length === 0)
        return emptyHint ? (
            <EmptyState title={empty} hint={emptyHint} />
        ) : (
            <p className="px-4 py-8 text-center text-sm text-m-muted">
                {empty}
            </p>
        );
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="bg-m-mint/60 text-xs font-semibold text-m-body">
                    <tr>
                        {cols.map((c) => (
                            <th key={c} scope="col" className="px-4 py-2">
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-m-line">
                    {rows.map(render)}
                </tbody>
            </table>
        </div>
    );
}

const td = 'px-4 py-2 align-middle';
const action =
    'inline-block rounded-full border border-m-accent px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-m-accent transition hover:bg-m-mint';
const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export default function Dashboard({
    stats,
    riders,
    bookings,
    complaints,
}: Props) {
    const [refreshing, setRefreshing] = useState(false);
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const refresh = () =>
        router.reload({
            only: [
                'stats',
                'riders',
                'bookings',
                'complaints',
                'adminNotifications',
            ],
            onStart: () => setRefreshing(true),
            onFinish: () => setRefreshing(false),
        });

    const quick: [string, string, LucideIcon][] = [
        ['Review Rider Applications', '/admin/riders', ClipboardCheck],
        ['Manage Passengers', '/admin/passengers', UserCog],
        ['Monitor Bookings', '/admin/bookings', Map],
        ['Review Complaints', '/admin/complaints', MessageSquareWarning],
    ];

    return (
        <AdminLayout title="Dashboard">
            <section className="relative mb-4 min-h-32 overflow-hidden rounded-2xl border border-m-line bg-linear-to-br from-m-mint via-m-mint to-[#C9E6D3] px-5 py-4 shadow-sm dark:to-[#244A3B]">
                <img
                    src="/img/header-banner.webp"
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto max-w-[80%] [mask-image:linear-gradient(to_right,transparent,black_30%)] object-cover object-right select-none sm:block dark:opacity-30"
                />

                <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-m-forest dark:text-m-ink">
                            Welcome Back, Admin!
                        </h2>
                        <p className="mt-0.5 text-sm text-m-body2">
                            Here&rsquo;s an overview of your Migo management
                            system.
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
                    icon={Bike}
                    label="Total Riders"
                    sub="Registered Riders"
                    value={stats.riders?.total}
                />
                <Stat
                    icon={ClipboardCheck}
                    label="Pending Applications"
                    sub="Awaiting Approval"
                    value={stats.riders?.pending}
                    tone="bg-[#F59E0B]/15 text-[#F59E0B]"
                />
                <Stat
                    icon={Users}
                    label="Total Passengers"
                    sub="Registered Passengers"
                    value={stats.passengers}
                />
                <Stat
                    icon={MessageSquareWarning}
                    label="Open Complaints"
                    sub="Needs Attention"
                    value={stats.openComplaints}
                    tone="bg-m-red/10 text-m-red"
                />
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="space-y-4">
                    <Panel
                        title="Recent Rider Applications"
                        icon={Users}
                        href="/admin/riders"
                        linkText="View All Riders"
                    >
                        <DataTable
                            cols={[
                                'Rider Name',
                                'Email Address',
                                'Contact Number',
                                'Date Applied',
                                'Application Status',
                                'Action',
                            ]}
                            rows={riders}
                            empty="No rider applications yet."
                            render={(r) => (
                                <tr key={r.id}>
                                    <td className={`${td} font-medium`}>
                                        <span className="flex items-center gap-3">
                                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-m-mint text-[10px] font-bold text-m-accent ring-1 ring-m-line">
                                                {initialsOf(r.full_name)}
                                            </span>
                                            {r.full_name}
                                        </span>
                                    </td>
                                    <td className={td}>{r.email}</td>
                                    <td className={td}>{r.phone}</td>
                                    <td className={`${td} whitespace-nowrap`}>
                                        {formatDate(r.created_at)}
                                    </td>
                                    <td className={td}>
                                        <Badge s={r.application_status} />
                                    </td>
                                    <td className={td}>
                                        <Link
                                            href={`/admin/riders/${r.id}`}
                                            className={action}
                                        >
                                            View Details
                                        </Link>
                                    </td>
                                </tr>
                            )}
                        />
                    </Panel>

                    <Panel
                        title="Recent Booking Activities"
                        icon={Map}
                        href="/admin/bookings"
                        linkText="View All Bookings"
                    >
                        <DataTable
                            cols={[
                                'Booking ID',
                                'Passenger Name',
                                'Rider Name',
                                'Pickup Location',
                                'Destination',
                                'Booking Date',
                                'Booking Status',
                            ]}
                            rows={bookings}
                            empty="No bookings recorded yet."
                            emptyHint="New bookings will appear here once customers book a ride."
                            render={(b) => (
                                <tr key={b.id}>
                                    <td className={`${td} font-mono text-xs`}>
                                        {shortId(b.id)}
                                    </td>
                                    <td className={td}>
                                        {b.passenger_name ?? '—'}
                                    </td>
                                    <td className={td}>
                                        {b.rider_name ?? 'Unassigned'}
                                    </td>
                                    <td className={td}>{b.pickup_location}</td>
                                    <td className={td}>{b.destination}</td>
                                    <td className={`${td} whitespace-nowrap`}>
                                        {formatDate(b.booked_at, true)}
                                    </td>
                                    <td className={td}>
                                        <Badge s={b.booking_status} />
                                    </td>
                                </tr>
                            )}
                        />
                    </Panel>

                    <Panel
                        title="Recent Complaints"
                        icon={MessageSquareWarning}
                        href="/admin/complaints"
                        linkText="View All Complaints"
                    >
                        <DataTable
                            cols={[
                                'Complaint ID',
                                'Reported By',
                                'Complaint Category',
                                'Date Submitted',
                                'Status',
                                'Action',
                            ]}
                            rows={complaints}
                            empty="No complaints submitted."
                            render={(c) => (
                                <tr key={c.id}>
                                    <td className={`${td} font-mono text-xs`}>
                                        {shortId(c.id)}
                                    </td>
                                    <td className={td}>
                                        {c.reporter_name ?? 'Unknown'}{' '}
                                        <span className="text-xs text-m-muted capitalize">
                                            ({c.reporter_type})
                                        </span>
                                    </td>
                                    <td className={td}>
                                        {c.complaint_category}
                                    </td>
                                    <td className={`${td} whitespace-nowrap`}>
                                        {formatDate(c.created_at)}
                                    </td>
                                    <td className={td}>
                                        <Badge s={c.complaint_status} />
                                    </td>
                                    <td className={td}>
                                        <Link
                                            href={`/admin/complaints/${c.id}`}
                                            className={action}
                                        >
                                            Review Complaint
                                        </Link>
                                    </td>
                                </tr>
                            )}
                        />
                    </Panel>
                </div>

                <aside className="rounded-xl border border-m-line bg-m-card shadow-sm xl:sticky xl:top-20">
                    <h2 className="flex items-center gap-2 border-b border-m-line px-4 py-3 text-sm font-bold text-m-ink">
                        <Zap className="size-5 text-m-accent" />
                        Quick Actions
                    </h2>
                    <div className="space-y-2 p-3">
                        {quick.map(([label, href, Icon]) => (
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