import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    ClipboardList,
    LayoutDashboard,
    LogIn,
    LogOut,
    MapPin,
    Menu,
    MessageSquareWarning,
    UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MigoBrand, TopBar, navPill, ring } from '@/components/migo-bar';
import { ThemeToggle } from '@/components/theme-toggle';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Item = {
    label: string;
    href?: string; // no href = built in a later phase, shown as "Soon"
    icon: LucideIcon;
    /** Extra paths that keep this item highlighted (e.g. the live ride page belongs to My Bookings). */
    also?: string[];
};

/** Customer navigation. Items without an href are built in later phases and shown as "Soon". */
const nav: Item[] = [
    { label: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboard },
    { label: 'Book a Ride', href: '/customer/book', icon: MapPin },
    {
        label: 'My Bookings',
        href: '/customer/bookings',
        icon: ClipboardList,
        also: ['/customer/ride/'],
    },
    { label: 'Complaints', icon: MessageSquareWarning },
    { label: 'Profile', href: '/customer/profile', icon: UserRound },
];

type ShellProps = {
    title: string;
    status?: string | null;
    /** Guest mode (public booking page): no customer navigation, a Login link instead of Logout. */
    guest?: boolean;
    /** Wider page (used by the booking page, which has side panels). */
    wide?: boolean;
    children: ReactNode;
};

const logout = () => router.post('/logout');
const COLLAPSE_KEY = 'migo.customerSidebarCollapsed';

/** Signed-in customers get the sidebar layout (same look as the Biker and Admin shells); guests keep the simple top bar. */
export default function CustomerShell(props: ShellProps) {
    return props.guest ? <TopBarShell {...props} /> : <SidebarShell {...props} />;
}

function SidebarShell({ title, status, wide = false, children }: ShellProps) {
    const { url, props } = usePage();
    const path = url.split('?')[0];
    // Desktop only: the three-line button hides the sidebar. The choice is remembered per browser.
    const [collapsed, setCollapsed] = useState(false);
    useEffect(() => {
        try {
            setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
        } catch {
            /* storage blocked: start expanded */
        }
    }, []);
    const toggleSidebar = () =>
        setCollapsed((c) => {
            try {
                localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
            } catch {
                /* ignore */
            }

            return !c;
        });
    const user = (props as unknown as {
        auth: { user: { name: string; email: string | null } };
    }).auth.user;
    const name = user?.name ?? 'Customer';
    const initial = name.trim().charAt(0).toUpperCase() || 'C';
    const isActive = (n: Item) =>
        !!n.href && (path === n.href || !!n.also?.some((p) => path.startsWith(p)));
    const heading = nav.find(isActive)?.label ?? title;
    const links = nav.filter((n) => n.href);
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <>
            <Head title={title} />
            <div
                className="min-h-screen bg-m-page text-m-body"
                style={{ fontFamily: 'Inter, Arial, ui-sans-serif, system-ui, sans-serif' }}
            >
                <aside
                    id="customer-sidebar"
                    className={`fixed inset-y-0 left-0 z-40 hidden w-56 flex-col overflow-hidden border-r border-m-line bg-m-card transition-transform duration-200 lg:flex ${collapsed ? 'lg:-translate-x-full' : ''}`}
                    aria-label="Customer sidebar"
                    inert={collapsed || undefined}
                >
                    <img
                        src="/img/sidebar-P.webp"
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="pointer-events-none absolute inset-0 size-full object-cover object-left-bottom select-none dark:opacity-10"
                    />
                    <div className="relative z-10">
                        <Link
                            href="/customer/dashboard"
                            aria-label="Migo customer dashboard"
                            className={`flex items-center gap-3 rounded-br-[1.5rem] bg-linear-to-br from-[#1B5240] via-[#17483A] to-[#0F2F25] px-3 py-3 shadow-md ${ring}`}
                        >
                            <img
                                src="/favi.png"
                                alt=""
                                className="size-10 shrink-0 rounded-lg bg-white object-contain p-0.5 shadow-sm ring-2 ring-white/30"
                            />
                            <span className="min-w-0 leading-tight">
                                <span className="block text-base font-extrabold tracking-wider text-white">
                                    MIGO
                                </span>
                                <span className="block text-[8px] leading-snug font-medium tracking-wide text-white/80 uppercase">
                                    Customer
                                    <br />
                                    Dashboard
                                </span>
                            </span>
                        </Link>
                    </div>

                    <nav aria-label="Customer menu" className="relative z-10 flex-1 space-y-0.5 overflow-y-auto px-2.5 pt-3 pb-2">
                        {nav.map((n) => {
                            const Icon = n.icon;
                            if (!n.href) {
                                return (
                                    <span
                                        key={n.label}
                                        aria-disabled="true"
                                        title="Coming soon"
                                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-m-faint"
                                    >
                                        <Icon className="size-4" aria-hidden />
                                        <span className="flex-1">{n.label}</span>
                                        <span className="rounded bg-m-soft px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
                                            Soon
                                        </span>
                                    </span>
                                );
                            }
                            const on = isActive(n);
                            return (
                                <Link
                                    key={n.label}
                                    href={n.href}
                                    aria-current={on ? 'page' : undefined}
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${ring} ${
                                        on
                                            ? 'bg-m-mint/90 font-bold text-m-accent shadow-sm'
                                            : 'text-m-ink hover:bg-m-mint/60'
                                    }`}
                                >
                                    {on && (
                                        <span className="absolute inset-y-2 -left-2.5 w-1 rounded-r-full bg-m-forest" aria-hidden />
                                    )}
                                    <Icon className="size-4" aria-hidden />
                                    {n.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="relative z-10 space-y-2.5 bg-gradient-to-t from-m-card via-m-card/90 to-transparent p-3 pt-8">
                        <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-m-solid text-xs font-semibold text-white" aria-hidden>
                                {initial}
                            </span>
                            <span className="min-w-0 leading-tight">
                                <span className="block truncate text-[13px] font-bold text-m-ink" title={name}>
                                    {name}
                                </span>
                                <span className="block truncate text-[11px] text-m-muted" title={user?.email ?? ''}>
                                    {user?.email ?? 'Customer'}
                                </span>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={logout}
                            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-m-red/30 bg-m-card/90 py-1.5 text-[13px] font-semibold text-m-red shadow-sm transition-colors hover:bg-m-red/5 ${ring}`}
                        >
                            <LogOut className="size-3.5" aria-hidden /> Logout
                        </button>
                    </div>
                </aside>

                <svg
                    aria-hidden
                    viewBox="0 0 1440 200"
                    preserveAspectRatio="none"
                    className="pointer-events-none fixed right-0 bottom-0 z-0 h-20 w-full opacity-60 lg:w-[70%] dark:opacity-30"
                >
                    <path d="M0 200 L0 150 C300 40 600 190 900 110 C1100 60 1300 70 1440 20 L1440 200Z" className="fill-m-forest/25" />
                    <path d="M0 200 L0 175 C350 110 700 210 1000 150 C1200 115 1350 120 1440 90 L1440 200Z" className="fill-m-forest/60" />
                </svg>

                <div
                    className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-0' : 'lg:pl-56'}`}
                >
                    <header className="sticky top-0 z-30 border-b border-m-line bg-m-card/95 backdrop-blur">
                        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
                            <div className="flex min-w-0 items-center gap-3">
                                <button
                                    type="button"
                                    onClick={toggleSidebar}
                                    aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
                                    aria-controls="customer-sidebar"
                                    aria-expanded={!collapsed}
                                    title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
                                    className={`hidden size-9 items-center justify-center rounded-lg text-m-ink transition hover:bg-m-mint lg:flex ${ring}`}
                                >
                                    <Menu className="size-5" aria-hidden />
                                </button>
                                <Link href="/customer/dashboard" aria-label="Migo customer dashboard" className={`flex items-center gap-2 ${collapsed ? '' : 'lg:hidden'} ${ring}`}>
                                    <img src="/favi.png" alt="" className="size-8 object-contain" />
                                    <span className="text-sm font-extrabold tracking-wide text-m-accent">MIGO</span>
                                </Link>
                                <p className="hidden text-base font-bold text-m-ink lg:block">{heading}</p>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <span className="hidden items-center gap-2 text-xs font-medium text-m-body md:flex">
                                    <CalendarDays className="size-4 text-m-accent" aria-hidden />
                                    {today}
                                </span>
                                <span aria-hidden className="hidden h-6 w-px bg-m-line md:block" />
                                <ThemeToggle className="size-8!" />
                                {/* The sidebar (account and logout) is hidden on small screens, so keep them here. */}
                                <span className="flex size-8 items-center justify-center rounded-full bg-m-solid text-xs font-semibold text-white lg:hidden" title={name} aria-hidden>
                                    {initial}
                                </span>
                                <button
                                    type="button"
                                    onClick={logout}
                                    aria-label="Logout"
                                    className={`flex size-8 items-center justify-center rounded-full border border-m-line text-m-red transition hover:bg-m-red/10 lg:hidden ${ring}`}
                                >
                                    <LogOut className="size-3.5" aria-hidden />
                                </button>
                            </div>
                        </div>
                        <nav aria-label="Customer" className="flex gap-1 overflow-x-auto border-t border-m-line px-4 py-2 lg:hidden">
                            {links.map((l) => (
                                <Link
                                    key={l.label}
                                    href={l.href!}
                                    aria-current={isActive(l) ? 'page' : undefined}
                                    className={`shrink-0 ${navPill(isActive(l))}`}
                                >
                                    {l.label}
                                </Link>
                            ))}
                        </nav>
                    </header>

                    <main className="relative z-10 min-w-0 p-3 pb-6 sm:p-5 sm:pb-8">
                        <div className={`mx-auto w-full space-y-4 ${wide ? 'max-w-[1700px]' : 'max-w-[1500px]'}`}>
                            {status && (
                                <p role="status" className="rounded-md border border-m-green/30 bg-m-green/5 px-4 py-3 text-sm text-m-greentext">
                                    {status}
                                </p>
                            )}
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}

function TopBarShell({
    title,
    status,
    guest = false,
    wide = false,
    children,
}: {
    title: string;
    status?: string | null;
    /** Guest mode (public booking page): no customer navigation, a Login link instead of Logout. */
    guest?: boolean;
    /** Wider page (used by the booking page, which has side panels). */
    wide?: boolean;
    children: ReactNode;
}) {
    const { url } = usePage();
    const path = url.split('?')[0];

    return (
        <>
            <Head title={title} />
            <div
                className="flex min-h-screen flex-col bg-m-page text-m-body"
                style={{
                    fontFamily:
                        'Inter, Arial, ui-sans-serif, system-ui, sans-serif',
                }}
            >
                <TopBar
                    toggle={false}
                    width={wide ? 'max-w-[1760px]' : 'max-w-5xl'}
                    left={
                        <MigoBrand
                            href={guest ? '/' : '/customer/dashboard'}
                            label={
                                guest ? 'Migo home' : 'Migo customer dashboard'
                            }
                            subtitle={guest ? 'Guest' : 'Customer'}
                        />
                    }
                    right={
                        <>
                            <ThemeToggle />
                            {guest ? (
                                <Link
                                    href="/login"
                                    className={`inline-flex items-center gap-2 rounded-full border-2 border-m-accent px-4 py-2 text-sm font-semibold text-m-accent transition hover:bg-m-mint ${ring}`}
                                >
                                    <LogIn className="size-4" aria-hidden />{' '}
                                    Login
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => router.post('/logout')}
                                    className={`inline-flex items-center gap-2 rounded-full border border-m-line px-4 py-2 text-sm font-medium text-m-red transition hover:bg-m-red/10 ${ring}`}
                                >
                                    <LogOut className="size-4" aria-hidden />{' '}
                                    Logout
                                </button>
                            )}
                        </>
                    }
                    below={
                        guest ? undefined : (
                            <nav
                                aria-label="Customer"
                                className={`mx-auto flex gap-1 overflow-x-auto px-4 pb-3 sm:px-5 ${wide ? 'max-w-[1760px]' : 'max-w-5xl'}`}
                            >
                                {nav.map((n) =>
                                    n.href ? (
                                        <Link
                                            key={n.label}
                                            href={n.href}
                                            aria-current={
                                                path === n.href
                                                    ? 'page'
                                                    : undefined
                                            }
                                            className={navPill(path === n.href)}
                                        >
                                            {n.label}
                                        </Link>
                                    ) : (
                                        <span
                                            key={n.label}
                                            aria-disabled="true"
                                            title="Coming soon"
                                            className="flex cursor-not-allowed items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap text-m-faint"
                                        >
                                            {n.label}
                                            <span className="rounded bg-m-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                                                Soon
                                            </span>
                                        </span>
                                    ),
                                )}
                            </nav>
                        )
                    }
                />

                <main
                    className={`mx-auto w-full flex-1 space-y-4 ${wide ? 'max-w-[1760px] px-3 py-4 sm:px-5 lg:py-5' : 'max-w-5xl px-5 py-8'}`}
                >
                    {status && (
                        <p
                            role="status"
                            className="rounded-md border border-m-green/30 bg-m-green/5 px-4 py-3 text-sm text-m-greentext"
                        >
                            {status}
                        </p>
                    )}
                    {children}
                </main>
            </div>
        </>
    );
}