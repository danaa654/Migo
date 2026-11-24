import { Link, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    Clock,
    MessageSquareWarning,
    Search,
    SearchCheck,
    SearchX,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    ActionButtons,
    ComplaintActionDialog,
    ComplaintStatusBadge,
    ReporterBadge,
    SafetyBadge,
    TypeBadge,
    type ComplaintAction,
    type ComplaintRef,
} from '@/components/admin/complaint-shared';
import { shortId } from '@/components/admin/rider-shared';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Row = {
    id: string;
    category: string;
    category_label: string;
    report_type: string;
    is_safety: boolean;
    excerpt: string;
    status: string;
    reporter_type: string;
    reporter_name: string | null;
    has_booking: boolean;
    created_at: string | null;
};
type Filters = {
    search: string;
    status: string | null;
    type: string | null;
    kind: string | null;
    category: string | null;
    sort: string;
    direction: 'asc' | 'desc';
};
type Props = {
    stats: {
        total: number;
        pending: number;
        under_investigation: number;
        resolved: number;
        rejected: number;
        complaints: number;
        support: number;
        incidents: number;
        open_incidents: number;
    };
    complaints: {
        data: Row[];
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
    categories: { key: string; label: string }[];
    filters: Filters;
};

const BASE = '/admin/complaints';
const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const control =
    'rounded-lg border border-m-line bg-m-page2 px-3 py-2.5 text-sm outline-none transition-colors focus:border-m-accent focus:ring-2 focus:ring-m-accent/20';
const th = 'px-4 py-2.5 font-semibold';
const td = 'px-4 py-3 align-middle';

const sortOptions: [string, string, string][] = [
    ['priority', 'desc', 'Needs attention first'],
    ['created_at', 'desc', 'Newest filed'],
    ['created_at', 'asc', 'Oldest filed'],
    ['complaint_status', 'asc', 'Status'],
    ['complaint_category', 'asc', 'Category'],
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

export default function ComplaintIndex({ stats, complaints, categories, filters }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [dialog, setDialog] = useState<{ complaint: ComplaintRef; action: ComplaintAction } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasFilter = !!(filters.search || filters.status || filters.type || filters.kind || filters.category);

    /** Filters, sort and page all live in the URL, so refresh and back/forward keep working. */
    const visit = (next: Partial<Filters> & { page?: number }) => {
        const q = { ...filters, ...next };
        const params: Record<string, string | number> = {};
        if (q.search) params.search = q.search;
        if (q.status) params.status = q.status;
        if (q.type) params.type = q.type;
        if (q.kind) params.kind = q.kind;
        if (q.category) params.category = q.category;
        if (q.sort !== 'priority') {
            params.sort = q.sort;
            params.direction = q.direction;
        }
        if (next.page && next.page > 1) params.page = next.page;
        router.get(BASE, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['complaints', 'filters', 'stats', 'categories'],
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
        visit({ search: '', status: null, type: null, kind: null, category: null });
    };
    const toggleStatus = (s: string) => visit({ status: filters.status === s ? null : s });

    const pages = (() => {
        const { current_page: c, last_page: l } = complaints;
        const set = new Set([1, l, c - 1, c, c + 1].filter((p) => p >= 1 && p <= l));
        return [...set].sort((a, b) => a - b);
    })();

    const viewBtn = (r: Row) => (
        <Link
            href={`${BASE}/${r.id}`}
            className={`inline-block rounded-md border border-m-accent px-3 py-1.5 text-xs font-medium text-m-accent hover:bg-m-mint ${ring}`}
        >
            Review
        </Link>
    );
    const actions = (r: Row) => (
        <ActionButtons
            complaint={{ id: r.id, status: r.status }}
            onAction={(a) => setDialog({ complaint: { id: r.id, status: r.status }, action: a })}
        />
    );

    return (
        <AdminLayout title="Support Center">
            <div className="mb-5">
                <h2 className="text-xl font-extrabold tracking-tight text-m-ink">Support Center</h2>
                <p className="mt-1 max-w-2xl text-sm text-m-muted">
                    Every report in one inbox: complaints, support requests and incident reports. Each has a type, a status and a staff member who handles it. Incident (safety) reports are listed first.
                </p>
            </div>

            {stats.open_incidents > 0 && (
                <p role="status" className="mb-4 rounded-lg border border-m-red/30 bg-m-red/5 px-4 py-3 text-sm font-medium text-m-redtext">
                    {stats.open_incidents} open incident {stats.open_incidents === 1 ? 'report needs' : 'reports need'} attention (safety).{' '}
                    <button type="button" onClick={() => visit({ kind: 'incident', status: null })} className={`underline ${ring}`}>
                        Show them
                    </button>
                </p>
            )}

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryChip icon={MessageSquareWarning} label="Total" value={stats.total} tone="bg-m-mint text-m-accent" active={!filters.status} onClick={() => visit({ status: null })} />
                <SummaryChip icon={Clock} label="Pending" value={stats.pending} tone="bg-[#F59E0B]/10 text-[#F59E0B]" active={filters.status === 'pending'} onClick={() => toggleStatus('pending')} />
                <SummaryChip icon={SearchCheck} label="Investigating" value={stats.under_investigation} tone="bg-[#7C3AED]/10 text-m-purple" active={filters.status === 'under_investigation'} onClick={() => toggleStatus('under_investigation')} />
                <SummaryChip icon={CircleCheck} label="Resolved" value={stats.resolved} tone="bg-m-green/10 text-m-green" active={filters.status === 'resolved'} onClick={() => toggleStatus('resolved')} />
                <SummaryChip icon={XCircle} label="Rejected" value={stats.rejected} tone="bg-m-red/10 text-m-red" active={filters.status === 'rejected'} onClick={() => toggleStatus('rejected')} />
            </section>

            <section className="rounded-2xl border border-m-line bg-m-card shadow-sm">
                <div className="grid gap-3 border-b border-m-line p-4 md:grid-cols-4 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
                    <div className="relative md:col-span-4 xl:col-span-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-m-muted" aria-hidden />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, category, details, location or ID"
                            aria-label="Search reports"
                            className={`${control} w-full pl-9`}
                        />
                    </div>
                    <select aria-label="Filter by type" value={filters.kind ?? ''} onChange={(e) => visit({ kind: e.target.value || null })} className={control}>
                        <option value="">All types</option>
                        <option value="complaint">Complaints ({stats.complaints})</option>
                        <option value="support">Support requests ({stats.support})</option>
                        <option value="incident">Incident reports ({stats.incidents})</option>
                    </select>
                    <select aria-label="Filter by reporter" value={filters.type ?? ''} onChange={(e) => visit({ type: e.target.value || null })} className={control}>
                        <option value="">Passengers and riders</option>
                        <option value="passenger">Passengers</option>
                        <option value="rider">Riders</option>
                    </select>
                    <select aria-label="Filter by category" value={filters.category ?? ''} onChange={(e) => visit({ category: e.target.value || null })} className={control}>
                        <option value="">All categories</option>
                        {categories.map((c) => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                    </select>
                    <select
                        aria-label="Sort reports"
                        value={`${filters.sort}:${filters.direction}`}
                        onChange={(e) => {
                            const [sort, direction] = e.target.value.split(':');
                            visit({ sort, direction: direction as 'asc' | 'desc' });
                        }}
                        className={control}
                    >
                        {sortOptions.map(([s, d, l]) => (
                            <option key={l} value={`${s}:${d}`}>{l}</option>
                        ))}
                    </select>
                </div>

                {complaints.data.length === 0 ? (
                    <div className="px-4 py-14 text-center">
                        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-m-mint text-m-accent">
                            {hasFilter ? <SearchX className="size-7" aria-hidden /> : <MessageSquareWarning className="size-7" aria-hidden />}
                        </span>
                        <h3 className="mt-3 text-base font-semibold">
                            {hasFilter ? 'No reports match your search' : 'No reports yet'}
                        </h3>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-m-muted">
                            {hasFilter
                                ? 'Try different words, or clear the filters.'
                                : 'Reports appear here once passengers or riders send them.'}
                        </p>
                        {hasFilter && (
                            <button type="button" onClick={clear} className={`mt-4 rounded-md border border-m-accent px-4 py-2 text-sm font-medium text-m-accent hover:bg-m-mint ${ring}`}>
                                Clear search and filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-[1100px] text-left text-sm">
                                <thead className="bg-m-page text-xs text-m-muted">
                                    <tr>
                                        <th scope="col" className={th}>Report ID</th>
                                        <th scope="col" className={th}>Type</th>
                                        <th scope="col" className={th}>Filed by</th>
                                        <th scope="col" className={th}>Category</th>
                                        <th scope="col" className={th}>Details</th>
                                        <th scope="col" className={th}>Filed</th>
                                        <th scope="col" className={th}>Status</th>
                                        <th scope="col" className={th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-m-line">
                                    {complaints.data.map((r) => (
                                        <tr key={r.id} className="transition-colors hover:bg-m-page/60">
                                            <td className={`${td} font-mono text-xs`} title={r.id}>{shortId(r.id)}</td>
                                            <td className={td}>
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <TypeBadge type={r.report_type} />
                                                    {r.is_safety && <SafetyBadge />}
                                                </div>
                                            </td>
                                            <td className={td}>
                                                <p className={`font-medium ${r.reporter_name ? '' : 'text-m-muted italic'}`}>{r.reporter_name ?? 'Unknown'}</p>
                                                <ReporterBadge type={r.reporter_type} />
                                            </td>
                                            <td className={td}>{r.category_label}</td>
                                            <td className={`${td} max-w-xs`}>
                                                <p className="line-clamp-2">{r.excerpt}</p>
                                                {r.has_booking && <p className="mt-0.5 text-xs text-m-muted">Linked to a booking</p>}
                                            </td>
                                            <td className={`${td} whitespace-nowrap`}>{formatDate(r.created_at, true)}</td>
                                            <td className={td}><ComplaintStatusBadge status={r.status} /></td>
                                            <td className={td}>
                                                <div className="flex flex-wrap gap-1.5">{viewBtn(r)}{actions(r)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <ul className="divide-y divide-m-line md:hidden">
                            {complaints.data.map((r) => (
                                <li key={r.id} className="space-y-2 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                                                <TypeBadge type={r.report_type} />
                                                {r.is_safety && <SafetyBadge />}
                                                <span>{r.category_label}</span>
                                            </p>
                                            <p className="text-xs text-m-muted">
                                                {r.reporter_name ?? 'Unknown'} · <span className="capitalize">{r.reporter_type}</span> · {formatDate(r.created_at)}
                                            </p>
                                        </div>
                                        <ComplaintStatusBadge status={r.status} />
                                    </div>
                                    <p className="line-clamp-3 text-sm">{r.excerpt}</p>
                                    <div className="flex flex-wrap gap-1.5">{viewBtn(r)}{actions(r)}</div>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-col items-center justify-between gap-3 border-t border-m-line px-4 py-3 text-sm sm:flex-row">
                            <p className="text-m-muted">
                                Showing {complaints.from}–{complaints.to} of {complaints.total.toLocaleString()} reports
                            </p>
                            {complaints.last_page > 1 && (
                                <nav aria-label="Pagination" className="flex items-center gap-1">
                                    <button type="button" disabled={complaints.current_page <= 1} onClick={() => visit({ page: complaints.current_page - 1 })} aria-label="Previous page" className={`rounded-md border border-m-line p-1.5 hover:bg-m-page disabled:opacity-40 ${ring}`}>
                                        <ChevronLeft className="size-4" />
                                    </button>
                                    {pages.map((p, i) => (
                                        <span key={p} className="flex items-center gap-1">
                                            {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-m-muted">…</span>}
                                            <button
                                                type="button"
                                                onClick={() => visit({ page: p })}
                                                aria-current={p === complaints.current_page ? 'page' : undefined}
                                                className={`min-w-8 rounded-md border px-2 py-1 ${ring} ${p === complaints.current_page ? 'border-m-accent bg-m-forest text-white' : 'border-m-line hover:bg-m-page'}`}
                                            >
                                                {p}
                                            </button>
                                        </span>
                                    ))}
                                    <button type="button" disabled={complaints.current_page >= complaints.last_page} onClick={() => visit({ page: complaints.current_page + 1 })} aria-label="Next page" className={`rounded-md border border-m-line p-1.5 hover:bg-m-page disabled:opacity-40 ${ring}`}>
                                        <ChevronRight className="size-4" />
                                    </button>
                                </nav>
                            )}
                        </div>
                    </>
                )}
            </section>

            <ComplaintActionDialog
                complaint={dialog?.complaint ?? null}
                action={dialog?.action ?? null}
                onClose={() => setDialog(null)}
            />
        </AdminLayout>
    );
}