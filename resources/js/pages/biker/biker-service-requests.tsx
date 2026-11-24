import { Link, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Flag,
    MapPin,
    Star,
    User,
} from 'lucide-react';
import BikerShell from '@/components/biker-shell';
import type { Notifications } from '@/components/biker-notifications';

type Trip = {
    id: string;
    reference: string | null;
    pickup: string;
    destination: string;
    status: string;
    distance: number | null;
    fare: number | null;
    passenger: string | null;
    rating: number | null;
    date: string | null;
};
type Paged = {
    data: Trip[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
};
type Filter = 'all' | 'active' | 'completed' | 'cancelled';
type Props = {
    account: { name: string; email: string };
    notifications: Notifications;
    requests: Paged | null;
    counts: Record<Filter, number>;
    filter: Filter;
};

const BASE = '/biker/service-requests';

const TABS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
];

const STATUS: Record<string, { label: string; tone: string }> = {
    rider_assigned: {
        label: 'Heading to pickup',
        tone: 'bg-[#2563EB]/10 text-[#2563EB]',
    },
    rider_arrived: {
        label: 'At pickup',
        tone: 'bg-[#2563EB]/10 text-[#2563EB]',
    },
    in_progress: {
        label: 'In progress',
        tone: 'bg-[#F59E0B]/15 text-m-amber',
    },
    completed: { label: 'Completed', tone: 'bg-m-green/10 text-m-greentext' },
    cancelled_by_rider: {
        label: 'Cancelled by you',
        tone: 'bg-m-red/10 text-m-redtext',
    },
    cancelled_by_passenger: {
        label: 'Cancelled by passenger',
        tone: 'bg-m-red/10 text-m-redtext',
    },
};
const statusOf = (s: string) =>
    STATUS[s] ?? {
        label: s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
        tone: 'bg-m-soft text-m-muted',
    };

const peso = (n: number | null) =>
    n == null ? '—' : `₱${Number(n).toFixed(2)}`;
const when = (iso: string | null) => {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime())
        ? d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
        : '—';
};

const empty: Record<Filter, string> = {
    all: 'Trips you accept will show up here. Go online to start receiving ride requests.',
    active: 'You have no trip in progress right now.',
    completed: 'No completed trips yet.',
    cancelled: 'No cancelled trips. Keep it up!',
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--b-accent)]';

/** Restricted: the server only serves this page to accredited bikers. Trip history with filters and pagination. */
export default function BikerServiceRequests({
    account,
    notifications,
    requests,
    counts,
    filter,
}: Props) {
    const go = (status: Filter, page = 1) =>
        router.get(
            BASE,
            {
                ...(status !== 'all' ? { status } : {}),
                ...(page > 1 ? { page } : {}),
            },
            { preserveScroll: true, preserveState: true },
        );

    return (
        <BikerShell
            account={account}
            canBook
            active="requests"
            notifications={notifications}
            progress={{ cleared: 6, total: 6 }}
        >
            <div className="flex flex-col gap-4">
                <section className="rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-[var(--b-ink)]">
                        Service Requests
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--b-muted)]">
                        Your trip history: every booking assigned to you.
                    </p>
                    <div
                        role="tablist"
                        aria-label="Filter trips"
                        className="mt-4 flex gap-1 overflow-x-auto"
                    >
                        {TABS.map((t) => {
                            const on = filter === t.key;
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    onClick={() => go(t.key)}
                                    className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${ring} ${
                                        on
                                            ? 'bg-m-forest text-white'
                                            : 'text-[var(--b-body)] hover:bg-[var(--b-mint)]'
                                    }`}
                                >
                                    {t.label}
                                    <span
                                        className={`rounded-full px-1.5 text-xs ${on ? 'bg-white/20' : 'bg-[var(--b-page)] text-[var(--b-muted)]'}`}
                                    >
                                        {counts[t.key]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] shadow-sm">
                    {requests === null ? (
                        <p className="p-6 text-sm text-[var(--b-muted)]">
                            Service request data is not yet available. Please try
                            again in a moment.
                        </p>
                    ) : requests.data.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-12 text-center">
                            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--b-mint)] text-[var(--b-accent)]">
                                <ClipboardList className="size-6" aria-hidden />
                            </span>
                            <p className="mt-3 font-semibold text-[var(--b-ink)]">
                                Nothing here yet
                            </p>
                            <p className="mt-1 max-w-sm text-sm text-[var(--b-muted)]">
                                {empty[filter]}
                            </p>
                            {filter === 'all' && (
                                <a
                                    href="/biker/dispatch"
                                    className={`mt-4 rounded-full bg-m-forest px-4 py-1.5 text-xs font-bold text-white hover:bg-m-forest-hover ${ring}`}
                                >
                                    Go to Ride requests
                                </a>
                            )}
                        </div>
                    ) : (
                        <ul className="divide-y divide-[var(--b-line)]">
                            {requests.data.map((t) => {
                                const st = statusOf(t.status);
                                return (
                                    <li
                                        key={t.id}
                                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                                    >
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-[var(--b-ink)]">
                                                    {t.reference ?? 'Booking'}
                                                </span>
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.tone}`}
                                                >
                                                    {st.label}
                                                </span>
                                            </div>
                                            <p className="flex items-start gap-1.5 text-sm">
                                                <MapPin
                                                    className="mt-0.5 size-4 shrink-0 text-m-green"
                                                    aria-hidden
                                                />
                                                <span>{t.pickup}</span>
                                            </p>
                                            <p className="flex items-start gap-1.5 text-sm">
                                                <MapPin
                                                    className="mt-0.5 size-4 shrink-0 text-m-red"
                                                    aria-hidden
                                                />
                                                <span>{t.destination}</span>
                                            </p>
                                            <p className="flex flex-wrap items-center gap-x-3 text-xs text-[var(--b-muted)]">
                                                <span>{when(t.date)}</span>
                                                {t.distance != null && (
                                                    <span>
                                                        {t.distance.toFixed(1)} km
                                                    </span>
                                                )}
                                                {t.passenger && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <User
                                                            className="size-3"
                                                            aria-hidden
                                                        />
                                                        {t.passenger}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start sm:gap-1">
                                            <span className="text-base font-bold text-[var(--b-ink)]">
                                                {peso(t.fare)}
                                            </span>
                                            {t.passenger && (
                                                <Link
                                                    href={`/biker/complaints?booking=${t.id}`}
                                                    className={`inline-flex items-center gap-1 rounded-md border border-[var(--b-line)] px-2.5 py-1 text-xs font-medium text-[var(--b-body)] transition hover:bg-[var(--b-page)] ${ring}`}
                                                >
                                                    <Flag className="size-3" aria-hidden />
                                                    Report passenger
                                                </Link>
                                            )}
                                            {t.rating != null && (
                                                <span
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-m-amber"
                                                    aria-label={`Rated ${t.rating} out of 5`}
                                                >
                                                    <Star
                                                        className="size-3.5 fill-[#F59E0B] text-[#F59E0B]"
                                                        aria-hidden
                                                    />
                                                    {t.rating}/5
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {requests && requests.last_page > 1 && (
                        <nav
                            aria-label="Pagination"
                            className="flex items-center justify-between gap-3 border-t border-[var(--b-line)] px-5 py-3 text-sm"
                        >
                            <span className="text-[var(--b-muted)]">
                                {requests.from}–{requests.to} of {requests.total}
                            </span>
                            <span className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={requests.current_page <= 1}
                                    onClick={() =>
                                        go(filter, requests.current_page - 1)
                                    }
                                    className={`inline-flex items-center gap-1 rounded-md border border-[var(--b-line)] px-3 py-1.5 font-semibold transition hover:bg-[var(--b-page)] disabled:opacity-40 ${ring}`}
                                >
                                    <ChevronLeft className="size-4" aria-hidden />{' '}
                                    Prev
                                </button>
                                <button
                                    type="button"
                                    disabled={
                                        requests.current_page >= requests.last_page
                                    }
                                    onClick={() =>
                                        go(filter, requests.current_page + 1)
                                    }
                                    className={`inline-flex items-center gap-1 rounded-md border border-[var(--b-line)] px-3 py-1.5 font-semibold transition hover:bg-[var(--b-page)] disabled:opacity-40 ${ring}`}
                                >
                                    Next{' '}
                                    <ChevronRight className="size-4" aria-hidden />
                                </button>
                            </span>
                        </nav>
                    )}
                </section>
            </div>
        </BikerShell>
    );
}
