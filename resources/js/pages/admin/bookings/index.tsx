import {
    Bike,
    Ban,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    CircleSlash,
    Loader2,
    MapPinned,
    RefreshCw,
    Route,
    Search,
    UserCheck,
    type LucideIcon,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import DispatchMap, {
    type MapBooking,
    type MapRider,
} from '@/components/admin/dispatch-map';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Active = {
    id: string;
    service?: string;
    reference: string;
    status: string;
    passenger: string | null;
    rider: string | null;
    pickup: string;
    destination: string;
    radius_km: number | null;
    offers_sent: number;
    offers_open: number;
    waiting_s: number | null;
    fare: number | null;
    lat: number | null;
    lng: number | null;
};
type RiderRow = {
    id: string;
    name: string;
    status: string;
    lat: number | null;
    lng: number | null;
    location_age_s: number | null;
    stale: boolean;
};
type Closed = {
    id: string;
    reference: string;
    status: string;
    passenger: string | null;
    pickup: string;
    destination: string;
    at: string | null;
};
type HistoryRow = {
    id: string;
    reference: string;
    status: string;
    passenger: string | null;
    rider: string | null;
    assigned_at: string;
    time_to_assign_s: number | null;
};
type Live = {
    counts: {
        searching: number;
        assigned: number;
        in_progress: number;
        riders_available: number;
        riders_on_trip: number;
        unmatched_24h: number;
        cancelled_24h: number;
    };
    active: Active[];
    riders: RiderRow[];
    unmatched: Closed[];
    cancelled: Closed[];
    history: HistoryRow[];
    freshness_s: number;
};
type Detail = {
    timeline: {
        previous_status: string | null;
        new_status: string;
        actor_type: string;
        actor_name: string | null;
        remarks: string | null;
        created_at: string;
    }[];
    offers: {
        full_name: string;
        distance_to_pickup: number;
        estimated_pickup_time: number;
        offer_status: string;
        notified_at: string | null;
        responded_at: string | null;
    }[];
};

const BASE = '/admin/bookings';
const xsrf = () =>
    decodeURIComponent(
        document.cookie
            .split('; ')
            .find((c) => c.startsWith('XSRF-TOKEN='))
            ?.split('=')
            .slice(1)
            .join('=') ?? '',
    );
const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const th = 'px-4 py-2.5';
const td = 'px-4 py-3 align-middle';

async function api(method: 'GET' | 'POST', path: string, body?: unknown) {
    try {
        const r = await fetch(`${BASE}/${path}`, {
            method,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrf(),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await r.json().catch(() => ({}));
        return {
            ok: r.ok,
            status: r.status,
            data: data as Record<string, any>,
        };
    } catch {
        return {
            ok: false,
            status: 0,
            data: { message: 'Network problem.' } as Record<string, any>,
        };
    }
}

const tones: Record<string, string> = {
    pending: 'bg-[#F59E0B]/10 text-m-amber',
    searching_for_rider: 'bg-m-red/10 text-m-red',
    rider_assigned: 'bg-[#7C3AED]/10 text-m-purple',
    rider_arrived: 'bg-[#7C3AED]/10 text-m-purple',
    in_progress: 'bg-m-forest/10 text-m-accent-hover',
    completed: 'bg-m-green/10 text-m-green',
    no_rider_found: 'bg-[#F59E0B]/10 text-m-amber',
    cancelled_by_passenger: 'bg-m-solid/10 text-m-ink',
    cancelled_by_rider: 'bg-m-solid/10 text-m-ink',
    online_available: 'bg-m-green/10 text-m-green',
    on_trip: 'bg-m-forest/10 text-m-accent-hover',
    accepting_booking: 'bg-[#F59E0B]/10 text-m-amber',
    sent: 'bg-m-forest/10 text-m-accent-hover',
    accepted: 'bg-m-green/10 text-m-green',
    declined: 'bg-m-solid/10 text-m-ink',
    expired: 'bg-[#F59E0B]/10 text-m-amber',
    cancelled: 'bg-m-solid/10 text-m-ink',
    lost_to_another_rider: 'bg-m-page text-m-muted',
};
const Badge = ({ s }: { s: string }) => (
    <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap capitalize ${tones[s] ?? 'bg-m-page text-m-muted'}`}
    >
        {s.replace(/_/g, ' ')}
    </span>
);

const duration = (s: number | null) =>
    s == null ? '—' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
const peso = (n: number | null) => (n == null ? '—' : `₱${n.toFixed(2)}`);

/** One stop on the dispatch flow. Opens the matching tab below. */
function FlowStage({
    icon: Icon,
    label,
    value,
    tone,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    value: number | undefined;
    tone: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={`Show ${label.toLowerCase()}`}
            className={`group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-m-page ${ring}`}
        >
            <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transform-none ${tone}`}
            >
                <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-sm leading-snug font-semibold text-m-ink">
                {label}
            </span>
            <span
                className={`text-2xl leading-none font-bold ${value ? 'text-m-ink' : 'text-m-faint'}`}
            >
                {value == null ? '—' : value.toLocaleString()}
            </span>
        </button>
    );
}

function Stat({
    icon: Icon,
    label,
    value,
    tone,
    active,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    value: number | undefined;
    tone: string;
    active?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-m-card px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${ring} ${active ? 'border-m-accent ring-2 ring-m-accent/25' : 'border-m-line'}`}
        >
            <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
            >
                <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 text-sm font-semibold text-m-ink">
                {label}
            </span>
            <span className="ml-auto text-2xl leading-none font-bold text-m-ink">
                {value == null ? '—' : value.toLocaleString()}
            </span>
        </button>
    );
}

const Empty = ({ text }: { text: string }) => (
    <p className="px-4 py-10 text-center text-sm text-m-muted">{text}</p>
);
const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-m-line bg-m-page text-xs font-semibold tracking-wide text-m-muted uppercase">
                <tr>
                    {head.map((h) => (
                        <th key={h} className={th}>
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-m-line">{children}</tbody>
        </table>
    </div>
);

type Tab = 'active' | 'riders' | 'unmatched' | 'cancelled' | 'history';

export default function DispatchMonitor() {
    const [data, setData] = useState<Live | null>(null);
    const [error, setError] = useState(false);
    const [tab, setTab] = useState<Tab>('active');
    const listRef = useRef<HTMLElement>(null);
    const goTo = (t: Tab) => {
        setTab(t);
        listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
        null,
    );
    const [cancel, setCancel] = useState<Active | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [open, setOpen] = useState<string | null>(null);
    const [detail, setDetail] = useState<
        Record<string, Detail | 'loading' | 'error'>
    >({});

    const refresh = useCallback(async () => {
        const r = await api('GET', 'live');
        if (r.ok) {
            setData(r.data as unknown as Live);
            setError(false);
        } else setError(true);
    }, []);

    useEffect(() => {
        void refresh();
        const t = setInterval(() => {
            if (!document.hidden) void refresh();
        }, 4000);
        return () => clearInterval(t);
    }, [refresh]);

    const mapRiders = useMemo<MapRider[]>(
        () =>
            (data?.riders ?? [])
                .filter((r) => r.lat != null && r.lng != null)
                .map((r) => ({
                    id: r.id,
                    name: r.name,
                    status: r.status,
                    lat: r.lat as number,
                    lng: r.lng as number,
                    stale: r.stale,
                })),
        [data?.riders],
    );
    const mapBookings = useMemo<MapBooking[]>(
        () =>
            (data?.active ?? [])
                .filter((b) => b.lat != null && b.lng != null)
                .map((b) => ({
                    id: b.id,
                    reference: b.reference,
                    status: b.status,
                    lat: b.lat as number,
                    lng: b.lng as number,
                })),
        [data?.active],
    );

    const doCancel = async () => {
        if (!cancel) return;
        setBusy(cancel.id);
        const r = await api('POST', `${cancel.id}/cancel`, { reason });
        setBusy(null);
        setNotice({
            ok: r.ok,
            text:
                r.data.message ??
                (r.data.errors?.reason?.[0] as string) ??
                'Could not cancel the booking.',
        });
        if (r.ok) {
            setCancel(null);
            setReason('');
            void refresh();
        }
    };

    const doRetry = async (id: string) => {
        setBusy(id);
        const r = await api('POST', `${id}/retry`);
        setBusy(null);
        setNotice({
            ok: r.ok,
            text: r.data.message ?? 'Could not restart the search.',
        });
        void refresh();
    };

    const toggle = async (id: string) => {
        if (open === id) return setOpen(null);
        setOpen(id);
        if (detail[id] && detail[id] !== 'error') return;
        setDetail((d) => ({ ...d, [id]: 'loading' }));
        const r = await api('GET', `${id}/history`);
        setDetail((d) => ({
            ...d,
            [id]: r.ok ? (r.data as unknown as Detail) : 'error',
        }));
    };

    const c = data?.counts;
    const tabs: { key: Tab; label: string; n?: number }[] = [
        { key: 'active', label: 'Active bookings', n: data?.active.length },
        { key: 'riders', label: 'Online riders', n: data?.riders.length },
        { key: 'unmatched', label: 'Unmatched', n: c?.unmatched_24h },
        { key: 'cancelled', label: 'Cancelled', n: c?.cancelled_24h },
        { key: 'history', label: 'Assignment history' },
    ];

    return (
        <AdminLayout title="Booking Management">
            <section className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-m-deep via-m-forest to-m-forest px-5 py-4 text-white shadow-sm sm:px-6">
                <div
                    className="pointer-events-none absolute -top-24 -right-20 size-60 rounded-full bg-[#4ADE9B]/30 blur-3xl"
                    aria-hidden
                />
                <svg
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-8 w-full opacity-20"
                    viewBox="0 0 1200 70"
                    preserveAspectRatio="none"
                    aria-hidden
                >
                    <path
                        d="M0 50 C200 10 400 70 600 38 S1000 10 1200 40"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeDasharray="14 12"
                        fill="none"
                    />
                </svg>
                <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0">
                        <h2 className="text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">
                            Live Dispatch Monitor
                        </h2>
                        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
                            Updates every few seconds. Riders are assigned only
                            when a rider accepts; administrators cannot assign a
                            rider.
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span
                            role="status"
                            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"
                        >
                            <span className="relative flex size-2">
                                <span
                                    className={`absolute inline-flex size-full rounded-full opacity-75 motion-reduce:animate-none ${error ? 'bg-[#F87171]' : 'animate-ping bg-[#4ADE9B]'}`}
                                />
                                <span
                                    className={`relative inline-flex size-2 rounded-full ${error ? 'bg-[#F87171]' : 'bg-[#4ADE9B]'}`}
                                />
                            </span>
                            {error
                                ? 'Reconnecting…'
                                : data
                                  ? 'Live'
                                  : 'Connecting…'}
                        </span>
                        <button
                            type="button"
                            onClick={refresh}
                            className={`inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 ${ring}`}
                        >
                            <RefreshCw className="size-3.5" aria-hidden />
                            Refresh
                        </button>
                    </div>
                </div>
            </section>

            {error && (
                <p
                    role="alert"
                    className="mb-4 rounded-md border border-m-red/30 bg-m-red/5 px-4 py-2 text-sm text-m-red"
                >
                    Cannot reach the server. Showing the last data received;
                    retrying...
                </p>
            )}
            {notice && (
                <p
                    role="status"
                    className={`mb-4 rounded-md border px-4 py-2 text-sm ${notice.ok ? 'border-m-green/30 bg-m-green/5 text-m-green' : 'border-m-red/30 bg-m-red/5 text-m-red'}`}
                >
                    {notice.text}
                </p>
            )}

            <section aria-labelledby="flow-title" className="mb-5">
                <div className="mb-2 flex flex-wrap items-end justify-between gap-1">
                    <h3
                        id="flow-title"
                        className="text-base font-extrabold text-m-ink"
                    >
                        Dispatch flow
                    </h3>
                    <p className="text-xs text-m-muted">
                        Select a stage to open its bookings below
                    </p>
                </div>
                <div className="flex flex-col rounded-2xl border border-m-line bg-m-card p-1.5 shadow-sm sm:flex-row sm:items-center">
                    <FlowStage
                        icon={Search}
                        label="Searching for a rider"
                        value={c?.searching}
                        tone="bg-m-red/10 text-m-red"
                        onClick={() => goTo('active')}
                    />
                    <ChevronRight
                        className="hidden size-4 shrink-0 text-m-faint sm:block"
                        aria-hidden
                    />
                    <FlowStage
                        icon={UserCheck}
                        label="Assigned (heading to pickup)"
                        value={c?.assigned}
                        tone="bg-[#7C3AED]/10 text-m-purple"
                        onClick={() => goTo('active')}
                    />
                    <ChevronRight
                        className="hidden size-4 shrink-0 text-m-faint sm:block"
                        aria-hidden
                    />
                    <FlowStage
                        icon={Route}
                        label="Trips in progress"
                        value={c?.in_progress}
                        tone="bg-m-forest/10 text-m-accent-hover"
                        onClick={() => goTo('active')}
                    />
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                    <Stat
                        icon={Bike}
                        label="Available riders (fresh GPS)"
                        value={c?.riders_available}
                        tone="bg-m-green/10 text-m-green"
                        active={tab === 'riders'}
                        onClick={() => goTo('riders')}
                    />
                    <Stat
                        icon={Bike}
                        label="Riders on a trip"
                        value={c?.riders_on_trip}
                        tone="bg-m-forest/10 text-m-accent-hover"
                        active={tab === 'riders'}
                        onClick={() => goTo('riders')}
                    />
                    <Stat
                        icon={CircleSlash}
                        label="Unmatched (24 h)"
                        value={c?.unmatched_24h}
                        tone="bg-[#F59E0B]/10 text-m-amber"
                        active={tab === 'unmatched'}
                        onClick={() => goTo('unmatched')}
                    />
                    <Stat
                        icon={Ban}
                        label="Cancelled (24 h)"
                        value={c?.cancelled_24h}
                        tone="bg-m-solid/10 text-m-ink"
                        active={tab === 'cancelled'}
                        onClick={() => goTo('cancelled')}
                    />
                </div>
            </section>

            <section
                className="mb-5 rounded-2xl border border-m-line bg-m-card p-4 shadow-sm"
                aria-label="Live map"
            >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-base font-semibold">
                        <MapPinned
                            className="size-4 text-m-accent"
                            aria-hidden
                        />
                        Operations map
                    </h3>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-m-muted">
                        <li>
                            <span className="mr-1 inline-block size-2.5 rounded-full bg-[#16A36A]" />
                            Available rider
                        </li>
                        <li>
                            <span className="mr-1 inline-block size-2.5 rounded-full bg-m-forest" />
                            On trip
                        </li>
                        <li>
                            <span className="mr-1 inline-block size-2.5 rounded-full bg-[#F59E0B]" />
                            Accepting
                        </li>
                        <li>
                            <span className="mr-1 inline-block size-2.5 rounded-full bg-[#9CA3AF]" />
                            Stale GPS (over {data?.freshness_s ?? 60}s, not
                            matched)
                        </li>
                        <li>
                            <span className="mr-1 inline-block size-2.5 rounded-full bg-[#DC2626]" />
                            Searching pickup
                        </li>
                        <li>
                            <span className="mr-1 inline-block size-2.5 rounded-full bg-[#7C3AED]" />
                            Assigned pickup
                        </li>
                    </ul>
                </div>
                <div className="overflow-hidden rounded-xl">
                    <DispatchMap riders={mapRiders} bookings={mapBookings} />
                </div>
            </section>

            <section
                ref={listRef}
                className="scroll-mt-20 rounded-2xl border border-m-line bg-m-card shadow-sm"
            >
                <div
                    role="tablist"
                    className="flex flex-wrap gap-1.5 border-b border-m-line p-3"
                >
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            role="tab"
                            aria-selected={tab === t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${ring} ${tab === t.key ? 'bg-m-forest text-white shadow-sm' : 'text-m-muted hover:bg-m-page hover:text-m-ink'}`}
                        >
                            {t.label}
                            {t.n != null && (
                                <span
                                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${tab === t.key ? 'bg-white/20' : 'bg-m-page'}`}
                                >
                                    {t.n}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {!data ? (
                    <div className="flex justify-center py-10">
                        <Loader2
                            className="size-5 animate-spin text-m-muted"
                            aria-label="Loading"
                        />
                    </div>
                ) : (
                    <>
                        {tab === 'active' &&
                            (data.active.length === 0 ? (
                                <Empty text="No active ride requests right now." />
                            ) : (
                                <Table
                                    head={[
                                        'Booking',
                                        'Passenger',
                                        'Rider',
                                        'Status',
                                        'Search',
                                        'Waiting',
                                        'Fare',
                                        '',
                                    ]}
                                >
                                    {data.active.map((b) => (
                                        <tr
                                            key={b.id}
                                            className={
                                                b.status === 'searching_for_rider'
                                                    ? 'bg-m-red/[0.04]'
                                                    : undefined
                                            }
                                        >
                                            <td className={td}>
                                                <p className="font-medium">
                                                    {b.reference}
                                                    {b.service && (
                                                        <span className="ml-2 rounded-full bg-m-mint px-2 py-0.5 text-[11px] font-semibold text-m-accent">
                                                            {b.service}
                                                        </span>
                                                    )}
                                                </p>
                                                <p
                                                    className="max-w-[220px] truncate text-xs text-m-muted"
                                                    title={`${b.pickup} → ${b.destination}`}
                                                >
                                                    {b.pickup} → {b.destination}
                                                </p>
                                            </td>
                                            <td className={td}>
                                                {b.passenger ?? '—'}
                                            </td>
                                            <td className={td}>
                                                {b.rider ?? '—'}
                                            </td>
                                            <td className={td}>
                                                <Badge s={b.status} />
                                            </td>
                                            <td className={`${td} text-xs`}>
                                                {b.status ===
                                                'searching_for_rider'
                                                    ? `${b.radius_km ?? '—'} km · ${b.offers_open} open / ${b.offers_sent} offered`
                                                    : '—'}
                                            </td>
                                            <td className={td}>
                                                {duration(b.waiting_s)}
                                            </td>
                                            <td className={td}>
                                                {peso(b.fare)}
                                            </td>
                                            <td className={`${td} text-right`}>
                                                {b.status !== 'in_progress' && (
                                                    <button
                                                        type="button"
                                                        disabled={busy === b.id}
                                                        onClick={() => {
                                                            setCancel(b);
                                                            setReason('');
                                                            setNotice(null);
                                                        }}
                                                        className={`rounded-md border border-m-red/40 px-3 py-1.5 text-xs font-medium text-m-red hover:bg-m-red/5 disabled:opacity-50 ${ring}`}
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </Table>
                            ))}

                        {tab === 'riders' &&
                            (data.riders.length === 0 ? (
                                <Empty text="No riders are online." />
                            ) : (
                                <Table
                                    head={[
                                        'Rider',
                                        'Status',
                                        'Last GPS',
                                        'Matching',
                                    ]}
                                >
                                    {data.riders.map((r) => (
                                        <tr key={r.id}>
                                            <td className={`${td} font-medium`}>
                                                {r.name}
                                            </td>
                                            <td className={td}>
                                                <Badge s={r.status} />
                                            </td>
                                            <td className={td}>
                                                {r.location_age_s == null
                                                    ? 'No location'
                                                    : `${duration(r.location_age_s)} ago`}
                                            </td>
                                            <td className={`${td} text-xs`}>
                                                {r.status !==
                                                'online_available' ? (
                                                    'Not offered new bookings'
                                                ) : r.stale ? (
                                                    <span className="text-m-amber">
                                                        Excluded: GPS is out of
                                                        date
                                                    </span>
                                                ) : (
                                                    <span className="text-m-green">
                                                        Eligible
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </Table>
                            ))}

                        {(tab === 'unmatched' || tab === 'cancelled') &&
                            ((tab === 'unmatched'
                                ? data.unmatched
                                : data.cancelled
                            ).length === 0 ? (
                                <Empty
                                    text={
                                        tab === 'unmatched'
                                            ? 'No unmatched bookings in the last 24 hours.'
                                            : 'No cancelled bookings in the last 24 hours.'
                                    }
                                />
                            ) : (
                                <Table
                                    head={[
                                        'Booking',
                                        'Passenger',
                                        'Status',
                                        tab === 'unmatched'
                                            ? 'Timed out'
                                            : 'Cancelled',
                                        '',
                                    ]}
                                >
                                    {(tab === 'unmatched'
                                        ? data.unmatched
                                        : data.cancelled
                                    ).map((b) => (
                                        <tr key={b.id}>
                                            <td className={td}>
                                                <p className="font-medium">
                                                    {b.reference}
                                                </p>
                                                <p
                                                    className="max-w-[240px] truncate text-xs text-m-muted"
                                                    title={`${b.pickup} → ${b.destination}`}
                                                >
                                                    {b.pickup} → {b.destination}
                                                </p>
                                            </td>
                                            <td className={td}>
                                                {b.passenger ?? '—'}
                                            </td>
                                            <td className={td}>
                                                <Badge s={b.status} />
                                            </td>
                                            <td className={td}>
                                                {formatDate(b.at, true)}
                                            </td>
                                            <td className={`${td} text-right`}>
                                                {tab === 'unmatched' && (
                                                    <button
                                                        type="button"
                                                        disabled={busy === b.id}
                                                        onClick={() =>
                                                            doRetry(b.id)
                                                        }
                                                        className={`rounded-md border border-m-accent/40 px-3 py-1.5 text-xs font-medium text-m-accent-hover hover:bg-m-mint disabled:opacity-50 ${ring}`}
                                                    >
                                                        {busy === b.id
                                                            ? 'Restarting...'
                                                            : 'Search again'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </Table>
                            ))}

                        {tab === 'history' &&
                            (data.history.length === 0 ? (
                                <Empty text="No bookings have been assigned yet." />
                            ) : (
                                <Table
                                    head={[
                                        'Booking',
                                        'Passenger',
                                        'Rider',
                                        'Assigned',
                                        'Time to assign',
                                        'Now',
                                        '',
                                    ]}
                                >
                                    {data.history.map((h) => (
                                        <HistoryRowView
                                            key={h.id}
                                            h={h}
                                            open={open === h.id}
                                            detail={detail[h.id]}
                                            onToggle={() => toggle(h.id)}
                                        />
                                    ))}
                                </Table>
                            ))}
                    </>
                )}
            </section>

            <Dialog
                open={!!cancel}
                onOpenChange={(o) => {
                    if (!o && busy == null) setCancel(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Cancel booking {cancel?.reference}?
                        </DialogTitle>
                        <DialogDescription>
                            The passenger and any rider who was offered or
                            assigned this booking will be told it was cancelled
                            by an administrator. This is recorded in the booking
                            history and audit log.
                        </DialogDescription>
                    </DialogHeader>
                    <label
                        className="block text-sm font-medium"
                        htmlFor="cancel-reason"
                    >
                        Reason (required)
                    </label>
                    <textarea
                        id="cancel-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={200}
                        rows={3}
                        className="w-full rounded-md border border-m-line px-3 py-2 text-sm outline-none focus:border-m-accent focus:ring-2 focus:ring-m-accent/20"
                    />
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={() => setCancel(null)}
                            disabled={busy != null}
                            className={`rounded-md border border-m-line px-4 py-2 text-sm font-medium hover:bg-m-page ${ring}`}
                        >
                            Keep booking
                        </button>
                        <button
                            type="button"
                            onClick={doCancel}
                            disabled={busy != null || reason.trim().length < 3}
                            className={`rounded-md bg-[#DC2626] px-4 py-2 text-sm font-medium text-white hover:bg-[#B91C1C] disabled:opacity-50 ${ring}`}
                        >
                            {busy ? 'Cancelling...' : 'Cancel booking'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}

function HistoryRowView({
    h,
    open,
    detail,
    onToggle,
}: {
    h: HistoryRow;
    open: boolean;
    detail: Detail | 'loading' | 'error' | undefined;
    onToggle: () => void;
}) {
    return (
        <>
            <tr>
                <td className={`${td} font-medium`}>{h.reference}</td>
                <td className={td}>{h.passenger ?? '—'}</td>
                <td className={td}>{h.rider ?? '—'}</td>
                <td className={td}>{formatDate(h.assigned_at, true)}</td>
                <td className={td}>{duration(h.time_to_assign_s)}</td>
                <td className={td}>
                    <Badge s={h.status} />
                </td>
                <td className={`${td} text-right`}>
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={open}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-m-accent-hover hover:bg-m-mint ${ring}`}
                    >
                        Details{' '}
                        {open ? (
                            <ChevronUp className="size-3.5" aria-hidden />
                        ) : (
                            <ChevronDown className="size-3.5" aria-hidden />
                        )}
                    </button>
                </td>
            </tr>
            {open && (
                <tr>
                    <td colSpan={7} className="bg-m-page px-4 py-4">
                        {detail === 'loading' || !detail ? (
                            <Loader2
                                className="size-4 animate-spin text-m-muted"
                                aria-label="Loading"
                            />
                        ) : detail === 'error' ? (
                            <p className="text-sm text-m-red">
                                Could not load the details.
                            </p>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-2">
                                <div>
                                    <p className="mb-2 text-xs font-semibold tracking-wide text-m-muted uppercase">
                                        Status timeline
                                    </p>
                                    <ol className="space-y-2 text-sm">
                                        {detail.timeline.map((t, i) => (
                                            <li
                                                key={i}
                                                className="rounded-md border border-m-line bg-m-card px-3 py-2"
                                            >
                                                <p>
                                                    <Badge s={t.new_status} />{' '}
                                                    <span className="ml-1 text-xs text-m-muted">
                                                        {formatDate(
                                                            t.created_at,
                                                            true,
                                                        )}
                                                    </span>
                                                </p>
                                                <p className="mt-1 text-xs text-m-muted">
                                                    by {t.actor_type}
                                                    {t.actor_name
                                                        ? ` (${t.actor_name})`
                                                        : ''}
                                                    {t.remarks
                                                        ? ` · ${t.remarks}`
                                                        : ''}
                                                </p>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                                <div>
                                    <p className="mb-2 text-xs font-semibold tracking-wide text-m-muted uppercase">
                                        Rider offers ({detail.offers.length})
                                    </p>
                                    {detail.offers.length === 0 ? (
                                        <p className="text-sm text-m-muted">
                                            No offers were sent.
                                        </p>
                                    ) : (
                                        <ul className="space-y-2 text-sm">
                                            {detail.offers.map((o, i) => (
                                                <li
                                                    key={i}
                                                    className="flex items-center justify-between gap-2 rounded-md border border-m-line bg-m-card px-3 py-2"
                                                >
                                                    <span className="min-w-0 truncate">
                                                        {o.full_name}{' '}
                                                        <span className="text-xs text-m-muted">
                                                            ·{' '}
                                                            {
                                                                o.distance_to_pickup
                                                            }{' '}
                                                            m · ~
                                                            {
                                                                o.estimated_pickup_time
                                                            }{' '}
                                                            min
                                                        </span>
                                                    </span>
                                                    <Badge s={o.offer_status} />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}