import { Head, Link, router, usePage } from '@inertiajs/react';
import { ThemeToggle } from '@/components/theme-toggle';
import {
    Bell,
    Bike,
    CalendarDays,
    ChartBar,
    LayoutDashboard,
    LogOut,
    Map,
    Menu,
    MessageSquareWarning,
    Settings,
    Users,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type Shared = {
    admin: { full_name: string; email: string; role: string } | null;
    adminNotifications: {
        unread: number;
        latest: {
            id: string;
            title: string;
            message: string;
            is_read: boolean | number;
            created_at: string;
        }[];
    } | null;
};

const nav: { label: string; href: string; icon: LucideIcon }[] = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Rider Management', href: '/admin/riders', icon: Bike },
    { label: 'Passenger Management', href: '/admin/passengers', icon: Users },
    { label: 'Booking Management', href: '/admin/bookings', icon: Map },
    {
        label: 'Complaint Management',
        href: '/admin/complaints',
        icon: MessageSquareWarning,
    },
    { label: 'Reports and Analytics', href: '/admin/reports', icon: ChartBar },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    { label: 'Admin Settings', href: '/admin/settings', icon: Settings },
];

export const formatDate = (s?: string | null, time = false) => {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T') + (s.includes('T') ? '' : 'Z')); // DB timestamps are stored in UTC
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(
        'en-PH',
        time
            ? { dateStyle: 'medium', timeStyle: 'short' }
            : { dateStyle: 'medium' },
    );
};

function useDropdown() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const click = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', click);
        document.addEventListener('keydown', key);
        return () => {
            document.removeEventListener('mousedown', click);
            document.removeEventListener('keydown', key);
        };
    }, [open]);
    return { open, setOpen, ref };
}

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const logout = () => router.post('/logout');

export default function AdminLayout({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    const { url, props } = usePage();
    const { admin, adminNotifications } = props as unknown as Shared;
    const [collapsed, setCollapsed] = useState(false);
    const [drawer, setDrawer] = useState(false);
    const bell = useDropdown();
    const path = url.split('?')[0];
    const initials = (admin?.full_name ?? 'A')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const toggle = () =>
        window.innerWidth < 1024
            ? setDrawer(!drawer)
            : setCollapsed(!collapsed);
    const active = (href: string) =>
        href === '/admin/dashboard'
            ? path === href
            : path === href || path.startsWith(href + '/');

    return (
        <>
            <Head title={title}>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <div
                className="min-h-screen bg-m-page text-m-body"
                style={{ fontFamily: 'Inter, Arial, sans-serif' }}
            >
                {drawer && (
                    <div
                        className="fixed inset-0 z-30 bg-m-solid/40 lg:hidden"
                        onClick={() => setDrawer(false)}
                        aria-hidden
                    />
                )}

                <aside
                    className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col overflow-hidden border-r border-m-line bg-m-card shadow-xl transition-transform lg:translate-x-0 lg:shadow-none ${drawer ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-16' : 'lg:w-56'}`}
                    aria-label="Sidebar"
                >
                    {/* Sidebar artwork (public/img/side.png): fills the sidebar height; the right edge of the file is cropped out. */}
                    <img
                        src="/img/side.png"
                        alt=""
                        aria-hidden
                        draggable={false}
                        className={`pointer-events-none absolute inset-0 size-full object-cover object-left select-none dark:opacity-10 ${collapsed ? 'lg:hidden' : ''}`}
                    />

                    <div className="relative z-10 p-0">
                        <div
                            className={`flex items-center justify-between gap-2 rounded-br-[1.5rem] bg-linear-to-br from-[#1B5240] via-[#17483A] to-[#0F2F25] px-3 py-3 shadow-md ${collapsed ? 'lg:justify-center lg:rounded-br-2xl lg:px-2' : ''}`}
                        >
                            <Link
                                href="/admin/dashboard"
                                aria-label="Migo admin dashboard"
                                className={`flex min-w-0 items-center gap-3 rounded-lg text-left ${ring}`}
                            >
                                <img
                                    src="/favi.png"
                                    alt=""
                                    className="size-10 shrink-0 rounded-lg bg-white object-contain p-0.5 shadow-sm ring-2 ring-white/30"
                                />
                                <span
                                    className={`min-w-0 leading-tight ${collapsed ? 'lg:hidden' : ''}`}
                                >
                                    <span className="block text-base font-extrabold tracking-wider text-white">
                                        MIGO
                                    </span>
                                    <span className="block text-[8px] leading-snug font-medium tracking-wide text-white/80 uppercase">
                                        Admin Management
                                        <br />
                                        System
                                    </span>
                                </span>
                            </Link>
                            <button
                                type="button"
                                onClick={() => setDrawer(false)}
                                className={`rounded-md p-1 text-white/80 hover:text-white lg:hidden ${ring}`}
                                aria-label="Close menu"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                    </div>

                    <nav
                        className="relative z-10 flex-1 space-y-0.5 overflow-y-auto px-2.5 pt-3 pb-2"
                        aria-label="Admin navigation"
                    >
                        {nav.map(({ label, href, icon: Icon }) => {
                            const on = active(href);
                            const badge =
                                href === '/admin/notifications'
                                    ? (adminNotifications?.unread ?? 0)
                                    : 0;

                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    title={label}
                                    onClick={() => setDrawer(false)}
                                    aria-current={on ? 'page' : undefined}
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${ring} ${on ? 'bg-m-mint font-semibold text-m-accent shadow-sm' : 'text-m-body hover:bg-m-mint/60'} ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                                >
                                    {on && (
                                        <span
                                            className="absolute inset-y-2 -left-2.5 w-1 rounded-r-full bg-m-forest"
                                            aria-hidden
                                        />
                                    )}
                                    <Icon className="size-4 shrink-0" />
                                    <span
                                        className={`flex-1 ${collapsed ? 'lg:hidden' : ''}`}
                                    >
                                        {label}
                                    </span>
                                    {badge > 0 && (
                                        <span
                                            className={`flex min-w-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-bold text-white ${collapsed ? 'lg:absolute lg:top-1 lg:right-2 lg:min-w-4 lg:px-1 lg:text-[9px]' : ''}`}
                                        >
                                            {badge > 99 ? '99+' : badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="relative z-10 p-3">
                        <div
                            className={`flex items-center gap-3 ${collapsed ? 'lg:justify-center' : ''}`}
                        >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-m-solid text-xs font-semibold text-white">
                                {initials}
                            </span>
                            <div
                                className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}
                            >
                                <p className="truncate text-[13px] font-bold text-m-ink">
                                    {admin?.full_name}
                                </p>
                                <p className="truncate text-[11px] text-m-muted">
                                    {admin?.email}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={logout}
                            title="Logout"
                            className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-m-red/30 bg-m-card/90 py-1.5 text-[13px] font-semibold text-m-red shadow-sm transition-colors hover:bg-m-red/5 ${ring}`}
                        >
                            <LogOut className="size-3.5" />
                            <span className={collapsed ? 'lg:hidden' : ''}>
                                Logout
                            </span>
                        </button>
                    </div>
                </aside>

                <svg
                    aria-hidden
                    viewBox="0 0 1440 200"
                    preserveAspectRatio="none"
                    className="pointer-events-none fixed right-0 bottom-0 z-0 h-32 w-full opacity-60 lg:w-[70%] dark:opacity-30"
                >
                    <path
                        d="M0 200 L0 150 C300 40 600 190 900 110 C1100 60 1300 70 1440 20 L1440 200Z"
                        className="fill-m-forest/25"
                    />
                    <path
                        d="M0 200 L0 175 C350 110 700 210 1000 150 C1200 115 1350 120 1440 90 L1440 200Z"
                        className="fill-m-forest/60"
                    />
                </svg>

                <div
                    className={`transition-[padding] ${collapsed ? 'lg:pl-16' : 'lg:pl-56'}`}
                >
                    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-m-line bg-m-card/95 px-4 backdrop-blur sm:px-6">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={toggle}
                                className={`rounded-md p-2 text-m-body hover:bg-m-page ${ring}`}
                                aria-label="Toggle sidebar"
                            >
                                <Menu className="size-5" />
                            </button>
                            <h1 className="text-base font-bold text-m-ink">{title}</h1>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <span className="hidden items-center gap-2 text-xs font-medium text-m-body md:flex">
                                <CalendarDays className="size-4 text-m-accent" />
                                {today}
                            </span>
                            <span
                                aria-hidden
                                className="hidden h-6 w-px bg-m-line md:block"
                            />

                            <ThemeToggle className="size-8!" />

                            <div ref={bell.ref} className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        bell.setOpen(!bell.open);
                                    }}
                                    className={`relative flex size-8 items-center justify-center rounded-full border border-m-line bg-m-card text-m-body transition hover:bg-m-mint ${ring}`}
                                    aria-label={`Notifications${adminNotifications?.unread ? `, ${adminNotifications.unread} unread` : ''}`}
                                    aria-expanded={bell.open}
                                >
                                    <Bell className="size-4" />
                                    {!!adminNotifications?.unread && (
                                        <span
                                            className="absolute top-1 right-1.5 size-2 rounded-full bg-[#DC2626] ring-2 ring-m-card"
                                            aria-hidden
                                        />
                                    )}
                                </button>
                                {bell.open && (
                                    <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-m-line bg-m-card shadow-md">
                                        <p className="border-b border-m-line px-4 py-3 text-sm font-semibold">
                                            Notifications
                                        </p>
                                        {adminNotifications === null ? (
                                            <p className="px-4 py-6 text-center text-sm text-m-muted">
                                                Data not yet available.
                                            </p>
                                        ) : adminNotifications.latest.length ===
                                          0 ? (
                                            <p className="px-4 py-6 text-center text-sm text-m-muted">
                                                No notifications.
                                            </p>
                                        ) : (
                                            <ul className="max-h-72 divide-y divide-m-line overflow-y-auto">
                                                {adminNotifications.latest.map(
                                                    (n) => (
                                                        <li
                                                            key={n.id}
                                                            className="px-4 py-3"
                                                        >
                                                            <p className="flex items-center gap-2 text-sm font-medium">
                                                                {!n.is_read && (
                                                                    <span
                                                                        className="size-2 rounded-full bg-m-forest"
                                                                        aria-label="Unread"
                                                                    />
                                                                )}
                                                                {n.title}
                                                            </p>
                                                            <p className="mt-0.5 line-clamp-2 text-xs text-m-muted">
                                                                {n.message}
                                                            </p>
                                                            <p className="mt-1 text-[11px] text-m-muted">
                                                                {formatDate(
                                                                    n.created_at,
                                                                    true,
                                                                )}
                                                            </p>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                        <Link
                                            href="/admin/notifications"
                                            onClick={() => bell.setOpen(false)}
                                            className="block border-t border-m-line px-4 py-3 text-center text-sm font-medium text-m-accent hover:bg-m-page"
                                        >
                                            View all notifications
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>
                    <main className="relative z-10 mx-auto max-w-[1400px] p-3 pb-20 sm:p-5 sm:pb-24">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
}