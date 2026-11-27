import { Link, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Award,
    Bike,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Clock,
    FileSearch,
    GraduationCap,
    PauseCircle,
    Search,
    SearchX,
    Wrench,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    AccountBadge,
    AccreditationBadge,
    ActionButtons,
    Avatar,
    RiderActionDialog,
    VerificationBadge,
    shortId,
    type RiderAction,
    type RiderRef,
} from '@/components/admin/rider-shared';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Row = {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    profile_picture_url: string | null;
    vehicle_type: string | null;
    application_status: string;
    accreditation_status: string;
    account_status: string;
    created_at: string | null;
};
type Filters = {
    search: string;
    verification: string | null;
    accreditation: string | null;
    account: string | null;
    /** Pipeline stage: documents | orientation | inspection (the other stages use the status filters). */
    stage: string | null;
    sort: string;
    direction: 'asc' | 'desc';
};
type Props = {
    stats: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        suspended: number;
        pending_documents: number;
        pending_orientation: number;
        pending_inspection: number;
        for_final_approval: number;
        accredited: number;
    };
    riders: {
        data: Row[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number | null;
        to: number | null;
    };
    filters: Filters;
};

const BASE = '/admin/riders';
const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const control = `rounded-lg border border-m-line bg-m-page2 px-3 py-2.5 text-sm outline-none transition-colors focus:border-m-accent focus:ring-2 focus:ring-m-accent/20`;
const th = 'px-4 py-2.5';
const td = 'px-4 py-3 align-middle';

const sortOptions: [string, string, string][] = [
    ['created_at', 'desc', 'Newest registered'],
    ['created_at', 'asc', 'Oldest registered'],
    ['full_name', 'asc', 'Name (A–Z)'],
    ['full_name', 'desc', 'Name (Z–A)'],
    ['email', 'asc', 'Email (A–Z)'],
    ['application_status', 'asc', 'Application status'],
    ['accreditation_status', 'asc', 'Accreditation status'],
    ['account_status', 'asc', 'Account status'],
];

type StageProps = {
    icon: LucideIcon;
    label: string;
    value: number;
    tone: string;
    active?: boolean;
    onClick?: () => void;
};

/** One stop on the accreditation pipeline. Clickable only when the server can filter by it. */
function PipelineStage({
    icon: Icon,
    label,
    value,
    tone,
    active,
    onClick,
}: StageProps) {
    const body = (
        <>
            <span className="relative">
                <span
                    className={`flex size-14 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:-translate-y-1 group-hover:-rotate-3 motion-reduce:transform-none ${tone} ${active ? 'ring-2 ring-m-accent ring-offset-2 ring-offset-m-card' : ''}`}
                >
                    <Icon className="size-6" aria-hidden />
                </span>
                <span
                    className={`absolute -top-2 -right-3 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-m-card px-1.5 text-xs font-bold ${value > 0 ? 'bg-m-forest text-white' : 'bg-m-line2 text-m-card'}`}
                >
                    {value.toLocaleString()}
                </span>
            </span>
            <span className="mt-3 block text-xs leading-snug font-semibold text-m-ink">
                {label}
            </span>
        </>
    );
    const base = 'group relative z-10 flex flex-col items-center px-1 text-center';
    return onClick ? (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            title={`Filter riders: ${label}`}
            className={`${base} cursor-pointer rounded-lg ${ring}`}
        >
            {body}
        </button>
    ) : (
        <div className={base}>{body}</div>
    );
}

function SummaryChip({
    icon: Icon,
    label,
    value,
    tone,
    active,
    onClick,
}: StageProps) {
    const inner = (
        <>
            <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
            >
                <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-m-ink">{label}</span>
            <span className="ml-auto text-2xl leading-none font-bold text-m-ink">
                {value.toLocaleString()}
            </span>
        </>
    );
    const base = `flex w-full items-center gap-3 rounded-xl border bg-m-card px-4 py-3 text-left shadow-sm transition-all ${active ? 'border-m-accent ring-2 ring-m-accent/25' : 'border-m-line'}`;
    return onClick ? (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`${base} cursor-pointer hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${ring}`}
        >
            {inner}
        </button>
    ) : (
        <div className={base}>{inner}</div>
    );
}

/** Donut showing how much of the rider base is fully accredited. */
function AccreditedRing({
    accredited,
    total,
}: {
    accredited: number;
    total: number;
}) {
    const r = 54;
    const c = 2 * Math.PI * r;
    const pct = total > 0 ? Math.min(accredited / total, 1) : 0;
    return (
        <div
            className="relative size-20 shrink-0"
            role="img"
            aria-label={`${accredited} of ${total} riders fully accredited`}
        >
            <svg viewBox="0 0 140 140" className="size-full -rotate-90">
                <circle
                    cx="70"
                    cy="70"
                    r={r}
                    fill="none"
                    strokeWidth="16"
                    className="stroke-white/15"
                />
                <circle
                    cx="70"
                    cy="70"
                    r={r}
                    fill="none"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray={`${pct * c} ${c}`}
                    className="stroke-[#4ADE9B] transition-[stroke-dasharray] duration-700"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <span className="text-xl leading-none font-extrabold">
                    {accredited.toLocaleString()}
                </span>
                <span className="mt-0.5 text-[8px] tracking-wider text-white/75 uppercase">
                    of {total.toLocaleString()}
                </span>
            </div>
        </div>
    );
}

export default function RiderIndex({ stats, riders, filters }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [dialog, setDialog] = useState<{
        rider: RiderRef;
        action: RiderAction;
    } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasFilter = !!(
        filters.search ||
        filters.verification ||
        filters.accreditation ||
        filters.account ||
        filters.stage
    );

    /** Re-queries the server (filters, sort and page all live in the URL, so refresh and back/forward keep working). */
    const visit = (next: Partial<Filters> & { page?: number }) => {
        const q = { ...filters, ...next };
        const params: Record<string, string | number> = {};
        if (q.search) params.search = q.search;
        if (q.verification) params.verification = q.verification;
        if (q.accreditation) params.accreditation = q.accreditation;
        if (q.account) params.account = q.account;
        if (q.stage) params.stage = q.stage;
        if (q.sort !== 'created_at' || q.direction !== 'desc') {
            params.sort = q.sort;
            params.direction = q.direction;
        }
        if (next.page && next.page > 1) params.page = next.page;
        router.get(BASE, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['riders', 'filters', 'stats'],
        });
    };

    useEffect(() => {
        if (search.trim() === filters.search) return;
        timer.current = setTimeout(() => visit({ search: search.trim() }), 350);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const clear = () => {
        setSearch('');
        visit({
            search: '',
            verification: null,
            accreditation: null,
            account: null,
            stage: null,
        });
    };
    /** Pipeline / summary shortcuts: replace the status filters with exactly one. */
    const only = (
        f: Partial<Pick<Filters, 'verification' | 'accreditation' | 'account' | 'stage'>>,
    ) =>
        visit({
            verification: null,
            accreditation: null,
            account: null,
            stage: null,
            ...f,
        });
    const toggle = (
        key: 'verification' | 'accreditation' | 'account' | 'stage',
        value: string,
    ) => (filters[key] === value ? only({}) : only({ [key]: value }));

    const sortBy = (col: string) =>
        visit({
            sort: col,
            direction:
                filters.sort === col && filters.direction === 'asc'
                    ? 'desc'
                    : 'asc',
        });
    const SortHead = ({ col, children }: { col: string; children: string }) => {
        const on = filters.sort === col;
        const Icon = !on
            ? ArrowUpDown
            : filters.direction === 'asc'
              ? ArrowUp
              : ArrowDown;
        return (
            <th
                scope="col"
                className={th}
                aria-sort={
                    on
                        ? filters.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                        : 'none'
                }
            >
                <button
                    type="button"
                    onClick={() => sortBy(col)}
                    className={`inline-flex items-center gap-1 rounded font-semibold hover:text-m-accent ${ring} ${on ? 'text-m-accent' : ''}`}
                >
                    {children}
                    <Icon className="size-3.5" aria-hidden />
                </button>
            </th>
        );
    };

    const pages = (() => {
        const { current_page: c, last_page: l } = riders;
        const set = new Set(
            [1, l, c - 1, c, c + 1].filter((p) => p >= 1 && p <= l),
        );
        return [...set].sort((a, b) => a - b);
    })();

    const actions = (r: Row) => (
        <ActionButtons
            rider={r}
            onAction={(a) => setDialog({ rider: r, action: a })}
        />
    );
    const viewBtn = (r: Row) => (
        <Link
            href={`${BASE}/${r.id}`}
            className={`inline-block rounded-md border border-m-accent px-3 py-1.5 text-xs font-medium text-m-accent hover:bg-m-mint ${ring}`}
        >
            View Details
        </Link>
    );

    const awaiting =
        stats.pending +
        stats.pending_documents +
        stats.pending_orientation +
        stats.pending_inspection +
        stats.for_final_approval;

    return (
        <AdminLayout title="Rider Management">
            {/* Hero */}
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
                            Rider Management
                        </h2>
                        <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/80 sm:text-sm">
                            Review applications, run the face-to-face
                            accreditation process and manage rider accounts.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    toggle('verification', 'pending')
                                }
                                className={`inline-flex items-center gap-2 rounded-lg bg-[#4ADE9B] px-3 py-1.5 text-xs font-bold text-[#04301C] transition-transform hover:-translate-y-0.5 motion-reduce:transform-none ${ring}`}
                            >
                                <Clock className="size-3.5" aria-hidden />
                                Review pending applications
                                <span className="rounded-full bg-[#04301C]/15 px-1.5 py-0.5 text-[11px]">
                                    {stats.pending.toLocaleString()}
                                </span>
                            </button>
                            {hasFilter && (
                                <button
                                    type="button"
                                    onClick={clear}
                                    className={`inline-flex items-center rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 ${ring}`}
                                >
                                    Show all riders
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <AccreditedRing
                            accredited={stats.accredited}
                            total={stats.total}
                        />
                        <div className="hidden gap-2 sm:flex">
                            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5">
                                <p className="text-[10px] text-white/75">
                                    Awaiting action
                                </p>
                                <p className="text-lg leading-tight font-extrabold">
                                    {awaiting.toLocaleString()}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5">
                                <p className="text-[10px] text-white/75">
                                    Approved
                                </p>
                                <p className="text-lg leading-tight font-extrabold">
                                    {stats.approved.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Accreditation pipeline */}
            <section aria-labelledby="pipeline-title" className="mb-6">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-1">
                    <h3
                        id="pipeline-title"
                        className="text-lg font-extrabold text-m-ink"
                    >
                        Accreditation pipeline
                    </h3>
                    <p className="text-xs text-m-muted">
                        Select a stage to filter the list below
                    </p>
                </div>
                <div className="relative rounded-2xl border border-m-line bg-m-card px-3 pt-7 pb-5 shadow-sm">
                    <div
                        className="absolute top-[3.1rem] right-14 left-14 hidden border-t-2 border-dashed border-m-line2/70 lg:block"
                        aria-hidden
                    />
                    <div className="grid grid-cols-2 gap-x-2 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
                        <PipelineStage
                            icon={Clock}
                            label="Application Review"
                            value={stats.pending}
                            tone="bg-[#F59E0B]/10 text-[#F59E0B]"
                            active={filters.verification === 'pending'}
                            onClick={() => toggle('verification', 'pending')}
                        />
                        <PipelineStage
                            icon={FileSearch}
                            label="Document Verification"
                            value={stats.pending_documents}
                            tone="bg-[#F59E0B]/10 text-[#F59E0B]"
                            active={filters.stage === 'documents'}
                            onClick={() => toggle('stage', 'documents')}
                        />
                        <PipelineStage
                            icon={GraduationCap}
                            label="Orientation"
                            value={stats.pending_orientation}
                            tone="bg-m-mint text-m-accent"
                            active={filters.stage === 'orientation'}
                            onClick={() => toggle('stage', 'orientation')}
                        />
                        <PipelineStage
                            icon={Wrench}
                            label="Motorcycle Inspection"
                            value={stats.pending_inspection}
                            tone="bg-m-mint text-m-accent"
                            active={filters.stage === 'inspection'}
                            onClick={() => toggle('stage', 'inspection')}
                        />
                        <PipelineStage
                            icon={ClipboardCheck}
                            label="Final Approval"
                            value={stats.for_final_approval}
                            tone="bg-[#7C3AED]/10 text-m-purple"
                            active={filters.accreditation === 'for_final_approval'}
                            onClick={() =>
                                toggle('accreditation', 'for_final_approval')
                            }
                        />
                        <PipelineStage
                            icon={Award}
                            label="Fully Accredited"
                            value={stats.accredited}
                            tone="bg-m-green/10 text-m-green"
                            active={filters.accreditation === 'accredited'}
                            onClick={() => toggle('accreditation', 'accredited')}
                        />
                    </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <SummaryChip
                        icon={Bike}
                        label="Total Registered Riders"
                        value={stats.total}
                        tone="bg-m-mint text-m-accent"
                        active={!hasFilter}
                        onClick={clear}
                    />
                    <SummaryChip
                        icon={XCircle}
                        label="Rejected Riders"
                        value={stats.rejected}
                        tone="bg-m-red/10 text-m-red"
                        active={filters.verification === 'rejected'}
                        onClick={() => toggle('verification', 'rejected')}
                    />
                    <SummaryChip
                        icon={PauseCircle}
                        label="Suspended Riders"
                        value={stats.suspended}
                        tone="bg-m-solid/10 text-m-ink"
                        active={filters.account === 'suspended'}
                        onClick={() => toggle('account', 'suspended')}
                    />
                </div>
            </section>

            {/* Riders */}
            <section className="rounded-2xl border border-m-line bg-m-card shadow-sm">
                <div className="grid gap-3 border-b border-m-line p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
                    <div className="relative md:col-span-2 xl:col-span-1">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-m-muted"
                            aria-hidden
                        />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, email or Rider ID"
                            aria-label="Search riders"
                            className={`${control} w-full pl-9`}
                        />
                    </div>
                    <select
                        aria-label="Filter by application status"
                        value={filters.verification ?? ''}
                        onChange={(e) =>
                            visit({ verification: e.target.value || null })
                        }
                        className={control}
                    >
                        <option value="">All application statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select
                        aria-label="Filter by accreditation status"
                        value={filters.accreditation ?? ''}
                        onChange={(e) =>
                            visit({ accreditation: e.target.value || null })
                        }
                        className={control}
                    >
                        <option value="">All accreditation statuses</option>
                        <option value="not_accredited">Not Accredited</option>
                        <option value="for_final_approval">
                            For Final Approval
                        </option>
                        <option value="accredited">Accredited</option>
                        <option value="revoked">Revoked</option>
                    </select>
                    <select
                        aria-label="Filter by account status"
                        value={filters.account ?? ''}
                        onChange={(e) =>
                            visit({ account: e.target.value || null })
                        }
                        className={control}
                    >
                        <option value="">All account statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    <select
                        aria-label="Sort riders"
                        value={`${filters.sort}:${filters.direction}`}
                        onChange={(e) => {
                            const [sort, direction] = e.target.value.split(':');
                            visit({
                                sort,
                                direction: direction as 'asc' | 'desc',
                            });
                        }}
                        className={control}
                    >
                        {sortOptions.map(([s, d, l]) => (
                            <option key={l} value={`${s}:${d}`}>
                                {l}
                            </option>
                        ))}
                    </select>
                </div>

                {riders.data.length === 0 ? (
                    <div className="px-4 py-14 text-center">
                        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-m-mint text-m-accent">
                            {hasFilter ? (
                                <SearchX className="size-7" aria-hidden />
                            ) : (
                                <Bike className="size-7" aria-hidden />
                            )}
                        </span>
                        <h3 className="mt-3 text-base font-semibold">
                            {hasFilter
                                ? 'No riders match your search'
                                : 'No riders registered yet'}
                        </h3>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-m-muted">
                            {hasFilter
                                ? 'Try a different name, email or Rider ID, or clear the filters.'
                                : 'Riders will appear here as soon as they register through the rider registration page.'}
                        </p>
                        {hasFilter && (
                            <button
                                type="button"
                                onClick={clear}
                                className={`mt-4 rounded-md border border-m-accent px-4 py-2 text-sm font-medium text-m-accent hover:bg-m-mint ${ring}`}
                            >
                                Clear search and filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[1100px] text-left text-sm">
                                    <thead className="bg-m-page text-xs font-semibold text-m-muted">
                                        <tr>
                                            <th scope="col" className={th}>
                                                Rider ID
                                            </th>
                                            <SortHead col="full_name">
                                                Rider
                                            </SortHead>
                                            <SortHead col="email">
                                                Email Address
                                            </SortHead>
                                            <SortHead col="phone">
                                                Contact Number
                                            </SortHead>
                                            <SortHead col="created_at">
                                                Registered
                                            </SortHead>
                                            <SortHead col="application_status">
                                                Application
                                            </SortHead>
                                            <SortHead col="accreditation_status">
                                                Accreditation
                                            </SortHead>
                                            <SortHead col="account_status">
                                                Account
                                            </SortHead>
                                            <th scope="col" className={th}>
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-m-line">
                                        {riders.data.map((r) => (
                                            <tr
                                                key={r.id}
                                                className="transition-colors hover:bg-m-page/60"
                                            >
                                                <td
                                                    className={`${td} font-mono text-xs`}
                                                    title={r.id}
                                                >
                                                    {shortId(r.id)}
                                                </td>
                                                <td className={td}>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={r.full_name}
                                                            url={
                                                                r.profile_picture_url
                                                            }
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">
                                                                {r.full_name}
                                                            </p>
                                                            {r.vehicle_type && (
                                                                <p className="text-xs text-m-muted">
                                                                    {
                                                                        r.vehicle_type
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td
                                                    className={`${td} break-all`}
                                                >
                                                    {r.email}
                                                </td>
                                                <td
                                                    className={`${td} whitespace-nowrap`}
                                                >
                                                    {r.phone}
                                                </td>
                                                <td
                                                    className={`${td} whitespace-nowrap`}
                                                >
                                                    {formatDate(r.created_at)}
                                                </td>
                                                <td className={td}>
                                                    <VerificationBadge
                                                        status={
                                                            r.application_status
                                                        }
                                                    />
                                                </td>
                                                <td className={td}>
                                                    <AccreditationBadge
                                                        status={
                                                            r.accreditation_status
                                                        }
                                                    />
                                                </td>
                                                <td className={td}>
                                                    <AccountBadge
                                                        status={
                                                            r.account_status
                                                        }
                                                    />
                                                </td>
                                                <td className={td}>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {viewBtn(r)}
                                                        {actions(r)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                        </div>

                        <ul className="divide-y divide-m-line md:hidden">
                            {riders.data.map((r) => (
                                <li key={r.id} className="space-y-3 p-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                            name={r.full_name}
                                            url={r.profile_picture_url}
                                            size="size-11"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold">
                                                {r.full_name}
                                            </p>
                                            <p
                                                className="font-mono text-xs text-m-muted"
                                                title={r.id}
                                            >
                                                {shortId(r.id)}
                                            </p>
                                        </div>
                                    </div>
                                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                                        <dt className="text-m-muted">Email</dt>
                                        <dd className="break-all">{r.email}</dd>
                                        <dt className="text-m-muted">Contact</dt>
                                        <dd>{r.phone}</dd>
                                        <dt className="text-m-muted">
                                            Registered
                                        </dt>
                                        <dd>{formatDate(r.created_at)}</dd>
                                        <dt className="text-m-muted">
                                            Application
                                        </dt>
                                        <dd>
                                            <VerificationBadge
                                                status={r.application_status}
                                            />
                                        </dd>
                                        <dt className="text-m-muted">
                                            Accreditation
                                        </dt>
                                        <dd>
                                            <AccreditationBadge
                                                status={r.accreditation_status}
                                            />
                                        </dd>
                                        <dt className="text-m-muted">
                                            Account
                                        </dt>
                                        <dd>
                                            <AccountBadge
                                                status={r.account_status}
                                            />
                                        </dd>
                                    </dl>
                                    <div className="flex flex-wrap gap-1.5">
                                        {viewBtn(r)}
                                        {actions(r)}
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-col items-center justify-between gap-3 border-t border-m-line px-4 py-3 text-sm sm:flex-row">
                            <p className="text-m-muted">
                                Showing {riders.from}–{riders.to} of{' '}
                                {riders.total.toLocaleString()} riders
                            </p>
                            {riders.last_page > 1 && (
                                <nav
                                    aria-label="Pagination"
                                    className="flex items-center gap-1"
                                >
                                    <button
                                        type="button"
                                        disabled={riders.current_page <= 1}
                                        onClick={() =>
                                            visit({
                                                page: riders.current_page - 1,
                                            })
                                        }
                                        aria-label="Previous page"
                                        className={`rounded-md border border-m-line p-1.5 hover:bg-m-page disabled:opacity-40 ${ring}`}
                                    >
                                        <ChevronLeft className="size-4" />
                                    </button>
                                    {pages.map((p, i) => (
                                        <span
                                            key={p}
                                            className="flex items-center gap-1"
                                        >
                                            {i > 0 && p - pages[i - 1] > 1 && (
                                                <span className="px-1 text-m-muted">
                                                    …
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    visit({ page: p })
                                                }
                                                aria-current={
                                                    p === riders.current_page
                                                        ? 'page'
                                                        : undefined
                                                }
                                                className={`min-w-8 rounded-md border px-2 py-1 ${ring} ${p === riders.current_page ? 'border-m-accent bg-m-forest text-white' : 'border-m-line hover:bg-m-page'}`}
                                            >
                                                {p}
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        type="button"
                                        disabled={
                                            riders.current_page >=
                                            riders.last_page
                                        }
                                        onClick={() =>
                                            visit({
                                                page: riders.current_page + 1,
                                            })
                                        }
                                        aria-label="Next page"
                                        className={`rounded-md border border-m-line p-1.5 hover:bg-m-page disabled:opacity-40 ${ring}`}
                                    >
                                        <ChevronRight className="size-4" />
                                    </button>
                                </nav>
                            )}
                        </div>
                    </>
                )}
            </section>

            <RiderActionDialog
                rider={dialog?.rider ?? null}
                action={dialog?.action ?? null}
                onClose={() => setDialog(null)}
            />
        </AdminLayout>
    );
}