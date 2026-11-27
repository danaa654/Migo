import { Link, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    PauseCircle,
    Search,
    SearchX,
    UserCheck,
    UserX,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    PassengerActionDialog,
    PassengerStatusBadge,
    actionDefs,
    allowedActions,
    displayName,
    methodsText,
    type PassengerAction,
    type PassengerRef,
} from '@/components/admin/passenger-shared';
import {
    PassengerProfileDialog,
    type PassengerProfile,
} from '@/components/admin/passenger-profile';
import { Avatar } from '@/components/admin/rider-shared';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Row = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    sign_in_methods: string[];
    account_status: string;
    bookings_count: number;
    completed_count: number;
    cancelled_count: number;
    last_booking_at: string | null;
    created_at: string | null;
};
type Filters = {
    search: string;
    status: string | null;
    sort: string;
    direction: 'asc' | 'desc';
};
type Props = {
    stats: { total: number; active: number; suspended: number; deactivated: number };
    passengers: {
        data: Row[];
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
    filters: Filters;
    canManage: boolean;
};

const BASE = '/admin/passengers';
const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const control =
    'rounded-lg border border-m-line bg-m-page2 px-3 py-2.5 text-sm outline-none transition-colors focus:border-m-accent focus:ring-2 focus:ring-m-accent/20';
const th = 'px-4 py-3 whitespace-nowrap';
const td = 'px-4 py-3.5 align-middle';

/** Passenger IDs are time-ordered, so the first characters are identical for everyone. Show the tail instead. */
const idTail = (id: string) => id.slice(-8).toUpperCase();

const sortOptions: [string, string, string][] = [
    ['created_at', 'desc', 'Newest registered'],
    ['created_at', 'asc', 'Oldest registered'],
    ['full_name', 'asc', 'Name (A–Z)'],
    ['full_name', 'desc', 'Name (Z–A)'],
    ['bookings_count', 'desc', 'Most bookings'],
    ['last_booking_at', 'desc', 'Latest booking'],
    ['account_status', 'asc', 'Account status'],
];

function SummaryChip({
    icon: Icon,
    label,
    value,
    tone,
    active,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    value: number;
    tone: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-m-card px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${ring} ${active ? 'border-m-accent ring-2 ring-m-accent/25' : 'border-m-line'}`}
        >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-m-ink">{label}</span>
            <span className="ml-auto text-2xl leading-none font-bold text-m-ink">
                {value.toLocaleString()}
            </span>
        </button>
    );
}

export default function PassengerIndex({ stats, passengers, filters, canManage }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [dialog, setDialog] = useState<{ passenger: PassengerRef; action: PassengerAction } | null>(null);
    const [profile, setProfile] = useState<PassengerProfile | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasFilter = !!(filters.search || filters.status);

    /** Filters, sort and page all live in the URL, so refresh and back/forward keep working. */
    const visit = (next: Partial<Filters> & { page?: number }) => {
        const q = { ...filters, ...next };
        const params: Record<string, string | number> = {};
        if (q.search) params.search = q.search;
        if (q.status) params.status = q.status;
        if (q.sort !== 'created_at' || q.direction !== 'desc') {
            params.sort = q.sort;
            params.direction = q.direction;
        }
        if (next.page && next.page > 1) params.page = next.page;
        router.get(BASE, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['passengers', 'filters', 'stats'],
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
        visit({ search: '', status: null });
    };
    const toggleStatus = (s: string) => visit({ status: filters.status === s ? null : s });
    const sortBy = (col: string) =>
        visit({
            sort: col,
            direction: filters.sort === col && filters.direction === 'asc' ? 'desc' : 'asc',
        });

    const SortHead = ({ col, children }: { col: string; children: string }) => {
        const on = filters.sort === col;
        const Icon = !on ? ArrowUpDown : filters.direction === 'asc' ? ArrowUp : ArrowDown;
        return (
            <th
                scope="col"
                className={th}
                aria-sort={on ? (filters.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
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
        const { current_page: c, last_page: l } = passengers;
        const set = new Set([1, l, c - 1, c, c + 1].filter((p) => p >= 1 && p <= l));
        return [...set].sort((a, b) => a - b);
    })();

    /** The customer's own profile photo; clicking it opens the quick profile. */
    const avatarBtn = (r: Row, size?: string) => (
        <button
            type="button"
            onClick={() => setProfile(r)}
            aria-label={`Quick view profile of ${displayName(r)}`}
            title="Quick view profile"
            className={`shrink-0 rounded-full transition hover:ring-2 hover:ring-m-accent/40 ${ring}`}
        >
            <Avatar name={r.full_name ?? ''} url={r.avatar_url} size={size} />
        </button>
    );

    const viewBtn = (r: Row, full = false) => (
        <Link
            href={`${BASE}/${r.id}`}
            className={`inline-flex items-center justify-center rounded-md border border-m-accent px-3 py-1.5 text-xs font-medium whitespace-nowrap text-m-accent hover:bg-m-mint ${full ? 'flex-1' : ''} ${ring}`}
        >
            View
        </Link>
    );

    /** Suspend / deactivate / reactivate live in one menu so every row has the same, single-line action area. */
    const moreMenu = (r: Row) => {
        const items = canManage ? allowedActions(r.account_status) : [];
        if (items.length === 0) return null;
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={`More actions for ${displayName(r)}`}
                        className={`inline-flex size-8 items-center justify-center rounded-md border border-m-line text-m-muted hover:bg-m-page hover:text-m-ink data-[state=open]:bg-m-page ${ring}`}
                    >
                        <MoreHorizontal className="size-4" aria-hidden />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                    {items.map((a, i) => {
                        const Icon = actionDefs[a].icon;
                        return (
                            <div key={a}>
                                {a === 'deactivate' && i > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                    onSelect={() => setDialog({ passenger: r, action: a })}
                                    className={`cursor-pointer gap-2 ${a === 'deactivate' ? 'text-m-red focus:text-m-red' : ''}`}
                                >
                                    <Icon className="size-4" aria-hidden />
                                    {actionDefs[a].label}
                                </DropdownMenuItem>
                            </div>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    return (
        <AdminLayout title="Passenger Management">
            <div className="mb-5">
                <h2 className="text-xl font-extrabold tracking-tight text-m-ink">Passenger Management</h2>
                <p className="mt-1 max-w-2xl text-sm text-m-muted">
                    View registered passengers and their trip history.
                    {canManage
                        ? ' Suspend or deactivate an account when needed; passengers sign up on their own.'
                        : ' You have read-only access.'}
                </p>
            </div>

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryChip icon={Users} label="Total Passengers" value={stats.total} tone="bg-m-mint text-m-accent" active={!filters.status} onClick={() => visit({ status: null })} />
                <SummaryChip icon={UserCheck} label="Active" value={stats.active} tone="bg-m-green/10 text-m-green" active={filters.status === 'active'} onClick={() => toggleStatus('active')} />
                <SummaryChip icon={PauseCircle} label="Suspended" value={stats.suspended} tone="bg-m-solid/10 text-m-ink" active={filters.status === 'suspended'} onClick={() => toggleStatus('suspended')} />
                <SummaryChip icon={UserX} label="Deactivated" value={stats.deactivated} tone="bg-m-red/10 text-m-red" active={filters.status === 'deactivated'} onClick={() => toggleStatus('deactivated')} />
            </section>

            <section className="rounded-2xl border border-m-line bg-m-card shadow-sm">
                <div className="grid gap-3 border-b border-m-line p-4 md:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div className="relative md:col-span-3 xl:col-span-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-m-muted" aria-hidden />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, email, phone or Passenger ID"
                            aria-label="Search passengers"
                            className={`${control} w-full pl-9`}
                        />
                    </div>
                    <select
                        aria-label="Filter by account status"
                        value={filters.status ?? ''}
                        onChange={(e) => visit({ status: e.target.value || null })}
                        className={control}
                    >
                        <option value="">All account statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="deactivated">Deactivated</option>
                    </select>
                    <select
                        aria-label="Sort passengers"
                        value={`${filters.sort}:${filters.direction}`}
                        onChange={(e) => {
                            const [sort, direction] = e.target.value.split(':');
                            visit({ sort, direction: direction as 'asc' | 'desc' });
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

                {hasFilter && passengers.data.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-m-line bg-m-mint/40 px-4 py-2 text-xs text-m-body">
                        <p>
                            {passengers.total.toLocaleString()} result
                            {passengers.total === 1 ? '' : 's'}
                            {filters.search ? ` for “${filters.search}”` : ''}
                            {filters.status ? ` · ${filters.status}` : ''}
                        </p>
                        <button
                            type="button"
                            onClick={clear}
                            className={`rounded font-semibold text-m-accent hover:underline ${ring}`}
                        >
                            Clear filters
                        </button>
                    </div>
                )}

                {passengers.data.length === 0 ? (
                    <div className="px-4 py-14 text-center">
                        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-m-mint text-m-accent">
                            {hasFilter ? <SearchX className="size-7" aria-hidden /> : <Users className="size-7" aria-hidden />}
                        </span>
                        <h3 className="mt-3 text-base font-semibold">
                            {hasFilter ? 'No passengers match your search' : 'No passengers yet'}
                        </h3>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-m-muted">
                            {hasFilter
                                ? 'Try a different name, email, phone or Passenger ID, or clear the filters.'
                                : 'Passengers appear here after they sign in on the customer page.'}
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
                            <table className="w-full min-w-[980px] text-left text-sm">
                                <thead className="bg-m-page text-xs font-semibold text-m-muted">
                                    <tr>
                                        <th scope="col" className={th}>ID</th>
                                        <SortHead col="full_name">Passenger</SortHead>
                                        <SortHead col="phone">Contact</SortHead>
                                        <SortHead col="bookings_count">Trips</SortHead>
                                        <SortHead col="last_booking_at">Last booking</SortHead>
                                        <SortHead col="created_at">Registered</SortHead>
                                        <SortHead col="account_status">Status</SortHead>
                                        <th scope="col" className={`${th} text-right`}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-m-line">
                                    {passengers.data.map((r) => (
                                        <tr key={r.id} className="transition-colors hover:bg-m-page/60">
                                            <td className={`${td} font-mono text-xs text-m-muted`} title={r.id}>
                                                {idTail(r.id)}
                                            </td>
                                            <td className={td}>
                                                <div className="flex items-center gap-3">
                                                    {avatarBtn(r)}
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={`${BASE}/${r.id}`}
                                                            className={`block truncate font-medium hover:text-m-accent ${r.full_name ? '' : 'text-m-muted italic'} ${ring}`}
                                                        >
                                                            {displayName(r)}
                                                        </Link>
                                                        <p className="truncate text-xs text-m-muted">{r.email ?? 'No email'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`${td} whitespace-nowrap`}>
                                                <p>{r.phone ?? '—'}</p>
                                                <p className="text-xs text-m-muted">{methodsText(r.sign_in_methods)}</p>
                                            </td>
                                            <td className={`${td} whitespace-nowrap`}>
                                                <p className="font-semibold tabular-nums">{r.bookings_count}</p>
                                                <p className="text-xs text-m-muted tabular-nums">
                                                    {r.completed_count} done, {r.cancelled_count} cancelled
                                                </p>
                                            </td>
                                            <td className={`${td} whitespace-nowrap ${r.last_booking_at ? '' : 'text-m-muted'}`}>
                                                {formatDate(r.last_booking_at)}
                                            </td>
                                            <td className={`${td} whitespace-nowrap`}>{formatDate(r.created_at)}</td>
                                            <td className={td}><PassengerStatusBadge status={r.account_status} /></td>
                                            <td className={td}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {viewBtn(r)}
                                                    {moreMenu(r)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <ul className="divide-y divide-m-line md:hidden">
                            {passengers.data.map((r) => (
                                <li key={r.id} className="space-y-3 p-4">
                                    <div className="flex items-center gap-3">
                                        {avatarBtn(r, 'size-11')}
                                        <div className="min-w-0 flex-1">
                                            <p className={`truncate font-semibold ${r.full_name ? '' : 'text-m-muted italic'}`}>{displayName(r)}</p>
                                            <p className="font-mono text-xs text-m-muted" title={r.id}>{idTail(r.id)}</p>
                                        </div>
                                        <PassengerStatusBadge status={r.account_status} />
                                    </div>
                                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                                        <dt className="text-m-muted">Email</dt>
                                        <dd className="break-all">{r.email ?? '—'}</dd>
                                        <dt className="text-m-muted">Contact</dt>
                                        <dd>{r.phone ?? '—'} <span className="text-xs text-m-muted">({methodsText(r.sign_in_methods)})</span></dd>
                                        <dt className="text-m-muted">Trips</dt>
                                        <dd>{r.bookings_count} ({r.completed_count} done, {r.cancelled_count} cancelled)</dd>
                                        <dt className="text-m-muted">Last booking</dt>
                                        <dd>{formatDate(r.last_booking_at)}</dd>
                                    </dl>
                                    <div className="flex items-center gap-1.5">
                                        {viewBtn(r, true)}
                                        {moreMenu(r)}
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-col items-center justify-between gap-3 border-t border-m-line px-4 py-3 text-sm sm:flex-row">
                            <p className="text-m-muted">
                                Showing {passengers.from}–{passengers.to} of {passengers.total.toLocaleString()} passengers
                            </p>
                            {passengers.last_page > 1 && (
                                <nav aria-label="Pagination" className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={passengers.current_page <= 1}
                                        onClick={() => visit({ page: passengers.current_page - 1 })}
                                        aria-label="Previous page"
                                        className={`rounded-md border border-m-line p-1.5 hover:bg-m-page disabled:opacity-40 ${ring}`}
                                    >
                                        <ChevronLeft className="size-4" />
                                    </button>
                                    {pages.map((p, i) => (
                                        <span key={p} className="flex items-center gap-1">
                                            {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-m-muted">…</span>}
                                            <button
                                                type="button"
                                                onClick={() => visit({ page: p })}
                                                aria-current={p === passengers.current_page ? 'page' : undefined}
                                                className={`min-w-8 rounded-md border px-2 py-1 ${ring} ${p === passengers.current_page ? 'border-m-accent bg-m-forest text-white' : 'border-m-line hover:bg-m-page'}`}
                                            >
                                                {p}
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        type="button"
                                        disabled={passengers.current_page >= passengers.last_page}
                                        onClick={() => visit({ page: passengers.current_page + 1 })}
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

            <PassengerProfileDialog
                passenger={profile}
                onClose={() => setProfile(null)}
            />

            <PassengerActionDialog
                passenger={dialog?.passenger ?? null}
                action={dialog?.action ?? null}
                onClose={() => setDialog(null)}
            />
        </AdminLayout>
    );
}