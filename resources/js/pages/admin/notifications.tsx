import { router } from '@inertiajs/react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Row = {
    id: string;
    title: string;
    message: string;
    category: 'support' | 'incidents' | 'operations';
    is_read: boolean;
    created_at: string;
    has_link: boolean;
};
type Filters = { filter: 'all' | 'unread'; category: string | null; search: string };
type Props = {
    notifications: {
        data: Row[];
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
    unread: number;
    filters: Filters;
    categories: string[];
};

const CATEGORY_LABELS: Record<string, string> = {
    support: 'Complaints & requests',
    incidents: 'Incidents',
    operations: 'Riders & bookings',
};
const CATEGORY_STYLES: Record<string, string> = {
    support: 'bg-amber-100 text-amber-800',
    incidents: 'bg-red-100 text-red-800',
    operations: 'bg-emerald-100 text-emerald-800',
};

export default function Notifications({ notifications, unread, filters, categories }: Props) {
    const [search, setSearch] = useState(filters.search);
    const first = useRef(true);

    const go = (patch: Partial<Filters> & { page?: number }) => {
        const next = { ...filters, ...patch };
        router.get(
            '/admin/notifications',
            {
                filter: next.filter === 'unread' ? 'unread' : undefined,
                category: next.category ?? undefined,
                search: next.search || undefined,
                page: patch.page && patch.page > 1 ? patch.page : undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    // Search as you type (waits a moment so it doesn't reload on every key).
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const t = setTimeout(() => go({ search }), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const post = (url: string) => router.post(url, {}, { preserveScroll: true });
    const { data, current_page, last_page, from, to, total } = notifications;

    return (
        <AdminLayout title="Notifications">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-m-line bg-m-card p-3 shadow-sm">
                    <div className="flex gap-1">
                        {(['all', 'unread'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => go({ filter: f, page: 1 })}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                    filters.filter === f ? 'bg-m-forest text-white' : 'text-m-ink hover:bg-m-line/50'
                                }`}
                            >
                                {f === 'all' ? 'All' : `Unread (${unread})`}
                            </button>
                        ))}
                    </div>
                    {categories.length > 1 && (
                        <select
                            value={filters.category ?? ''}
                            onChange={(e) => go({ category: e.target.value || null, page: 1 })}
                            className="rounded-md border border-m-line bg-transparent px-2 py-1.5 text-sm"
                        >
                            <option value="">All types</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {CATEGORY_LABELS[c]}
                                </option>
                            ))}
                        </select>
                    )}
                    <div className="relative ml-auto">
                        <Search className="pointer-events-none absolute left-2 top-2 size-4 text-m-muted" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search notifications"
                            className="w-56 rounded-md border border-m-line bg-transparent py-1.5 pl-8 pr-2 text-sm"
                        />
                    </div>
                    <button
                        onClick={() => post('/admin/notifications/read-all')}
                        disabled={unread === 0}
                        className="inline-flex items-center gap-1.5 rounded-md border border-m-line px-3 py-1.5 text-sm font-medium hover:bg-m-line/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <CheckCheck className="size-4" /> Mark all as read
                    </button>
                </div>

                <div className="rounded-lg border border-m-line bg-m-card shadow-sm">
                    {data.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-m-muted">
                            <Bell className="size-8" />
                            {filters.filter === 'unread' || filters.category || filters.search
                                ? 'No notifications match these filters.'
                                : 'No notifications yet.'}
                        </div>
                    ) : (
                        <ul className="divide-y divide-m-line">
                            {data.map((n) => (
                                <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.is_read ? '' : 'bg-m-forest/5'}`}>
                                    <span
                                        className={`mt-2 size-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-m-forest'}`}
                                        aria-label={n.is_read ? 'Read' : 'Unread'}
                                    />
                                    <button
                                        onClick={() => post(`/admin/notifications/${n.id}/open`)}
                                        className="min-w-0 flex-1 text-left"
                                        title={n.has_link ? 'Open the related page' : 'Mark as read'}
                                    >
                                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-m-ink">
                                            {n.title}
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[n.category]}`}>
                                                {CATEGORY_LABELS[n.category]}
                                            </span>
                                        </p>
                                        <p className="mt-0.5 text-sm text-m-muted">{n.message}</p>
                                        <p className="mt-1 text-[11px] text-m-muted">{formatDate(n.created_at, true)}</p>
                                    </button>
                                    <button
                                        onClick={() => post(`/admin/notifications/${n.id}/${n.is_read ? 'unread' : 'read'}`)}
                                        className="shrink-0 rounded-md px-2 py-1 text-xs text-m-muted hover:bg-m-line/50"
                                    >
                                        {n.is_read ? 'Mark unread' : 'Mark read'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {total > 0 && (
                    <div className="flex items-center justify-between text-sm text-m-muted">
                        <span>
                            {from}–{to} of {total}
                        </span>
                        <div className="flex gap-1">
                            <button
                                disabled={current_page <= 1}
                                onClick={() => go({ page: current_page - 1 })}
                                className="rounded-md border border-m-line p-1.5 disabled:opacity-40"
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="size-4" />
                            </button>
                            <button
                                disabled={current_page >= last_page}
                                onClick={() => go({ page: current_page + 1 })}
                                className="rounded-md border border-m-line p-1.5 disabled:opacity-40"
                                aria-label="Next page"
                            >
                                <ChevronRight className="size-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}