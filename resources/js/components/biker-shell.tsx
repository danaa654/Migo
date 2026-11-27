import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    ClipboardList,
    CreditCard,
    LayoutDashboard,
    LogOut,
    Lock,
    Menu,
    MessageSquareWarning,
    Navigation,
    Trophy,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import NotificationBell from '@/components/biker-notifications';
import type { Notifications } from '@/components/biker-notifications';
import { PlanChip, SidebarPlan, useBikerSubscription } from '@/components/biker-plan';
import { BikerThemeStyles } from '@/components/biker-theme';
import { ring } from '@/components/migo-bar';
import { ThemeToggle } from '@/components/theme-toggle';

type Props = {
    account: { name: string; email: string };
    /** Unlocks the Ride requests / Service requests links (accredited riders only). */
    canBook?: boolean;
    active?: 'dashboard' | 'dispatch' | 'requests' | 'complaints' | 'subscription' | 'profile';
    /** Notifications for the bell in the top bar. */
    notifications?: Notifications;
    /** Accreditation progress shown at the bottom of the sidebar. */
    progress?: { cleared: number; total: number };
    children?: ReactNode;
};

type NavItem = {
    key: 'dashboard' | 'dispatch' | 'requests' | 'complaints' | 'subscription';
    href: string;
    label: string;
    icon: LucideIcon;
    needsBooking: boolean;
};
const NAV: NavItem[] = [
    { key: 'dashboard', href: '/biker/dashboard', label: 'Dashboard', icon: LayoutDashboard, needsBooking: false },
    { key: 'dispatch', href: '/biker/dispatch', label: 'Ride requests', icon: Navigation, needsBooking: true },
    { key: 'requests', href: '/biker/service-requests', label: 'Service requests', icon: ClipboardList, needsBooking: true },
    { key: 'subscription', href: '/biker/subscription', label: 'Subscription', icon: CreditCard, needsBooking: true },
    { key: 'complaints', href: '/biker/complaints', label: 'Support', icon: MessageSquareWarning, needsBooking: true },
];

const logout = () => router.post('/logout');
const COLLAPSE_KEY = 'migo.biker.sidebar.collapsed';

/**
 * Signed-in shell for the Biker pages. Same look and behaviour as the admin shell: brand block, artwork sidebar,
 * slim top bar. The menu button collapses the sidebar to icons on desktop and opens it as a drawer on phones.
 */
export default function BikerShell({
    account,
    canBook = false,
    active = 'dashboard',
    notifications,
    progress,
    children,
}: Props) {
    const sub = useBikerSubscription();
    // Photo the rider chose (else the registration selfie). Shared by HandleInertiaRequests as "bikerAvatar".
    const avatar = (usePage().props as unknown as { bikerAvatar?: string | null }).bikerAvatar ?? null;
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [drawer, setDrawer] = useState(false);
    const initial = account.name.trim().charAt(0).toUpperCase() || 'B';
    const title = active === 'profile' ? 'My profile' : (NAV.find((n) => n.key === active)?.label ?? 'Dashboard');
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    useEffect(() => setAvatarFailed(false), [avatar]);

    // Every Biker page mounts its own shell, so remember the choice between pages (browser storage can be unavailable).
    useEffect(() => {
        try {
            setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
        } catch {
            /* storage blocked: stay expanded */
        }
    }, []);

    const toggle = () => {
        if (window.innerWidth < 1024) {
            setDrawer((d) => !d);

            return;
        }
        const next = !collapsed;
        setCollapsed(next);
        try {
            window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
        } catch {
            /* ignore */
        }
    };

    // Collapsed width only applies on desktop (lg:), so the phone drawer is always full width.
    const hideWhenCollapsed = collapsed ? 'lg:hidden' : '';

    return (
        <>
            <Head title="Biker Dashboard">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </Head>
            <BikerThemeStyles />
            <div
                className="min-h-screen bg-[var(--b-page)] text-[var(--b-body)]"
                style={{ fontFamily: 'Inter, Arial, ui-sans-serif, system-ui, sans-serif' }}
            >
                {drawer && <div className="fixed inset-0 z-30 bg-m-solid/40 lg:hidden" onClick={() => setDrawer(false)} aria-hidden />}

                <aside
                    className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col overflow-hidden border-r border-[var(--b-line)] bg-[var(--b-card)] shadow-xl transition-transform lg:translate-x-0 lg:shadow-none ${
                        drawer ? 'translate-x-0' : '-translate-x-full'
                    } ${collapsed ? 'lg:w-16' : 'lg:w-56'}`}
                    aria-label="Biker sidebar"
                >
                    {/* Sidebar artwork, same as the admin sidebar: public/img/side.png in light mode, public/img/sideD.png in dark mode. */}
                    <img
                        src="/img/side.png"
                        alt=""
                        aria-hidden
                        draggable={false}
                        className={`pointer-events-none absolute inset-0 size-full object-cover object-left select-none dark:hidden ${hideWhenCollapsed}`}
                    />
                    <img
                        src="/img/sideD.png"
                        alt=""
                        aria-hidden
                        draggable={false}
                        className={`pointer-events-none absolute inset-0 hidden size-full object-cover object-left select-none dark:block ${hideWhenCollapsed}`}
                    />

                    <div className="relative z-10">
                        <div
                            className={`flex items-center justify-between gap-2 rounded-br-[1.5rem] bg-linear-to-br from-[#1B5240] via-[#17483A] to-[#0F2F25] px-3 py-3 shadow-md ${
                                collapsed ? 'lg:justify-center lg:rounded-br-2xl lg:px-2' : ''
                            }`}
                        >
                            <Link href="/" aria-label="Migo home" className={`flex min-w-0 items-center gap-3 rounded-lg ${ring}`}>
                                <img
                                    src="/favi.png"
                                    alt=""
                                    className="size-10 shrink-0 rounded-lg bg-white object-contain p-0.5 shadow-sm ring-2 ring-white/30"
                                />
                                <span className={`min-w-0 leading-tight ${hideWhenCollapsed}`}>
                                    <span className="block text-base font-extrabold tracking-wider text-white">MIGO</span>
                                    <span className="block text-[8px] leading-snug font-medium tracking-wide text-white/80 uppercase">
                                        Biker
                                        <br />
                                        Dashboard
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

                    <nav aria-label="Biker menu" className="relative z-10 flex-1 space-y-0.5 overflow-y-auto px-2.5 pt-3 pb-2">
                        {NAV.map((n) => {
                            const Icon = n.icon;
                            const locked = n.needsBooking && !canBook;
                            const isActive = active === n.key;
                            if (locked) {
                                return (
                                    <span
                                        key={n.key}
                                        aria-disabled="true"
                                        title="Unlocks after your accreditation is complete"
                                        className={`flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--b-faint)] ${
                                            collapsed ? 'lg:justify-center lg:px-0' : ''
                                        }`}
                                    >
                                        <Icon className="size-4 shrink-0" aria-hidden />
                                        <span className={`flex-1 ${hideWhenCollapsed}`}>{n.label}</span>
                                        <Lock className={`size-3 ${hideWhenCollapsed}`} aria-hidden />
                                    </span>
                                );
                            }
                            return (
                                <Link
                                    key={n.key}
                                    href={n.href}
                                    title={n.label}
                                    onClick={() => setDrawer(false)}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${ring} ${
                                        isActive
                                            ? 'bg-[var(--b-mint)]/90 font-bold text-[var(--b-accent)] shadow-sm'
                                            : 'text-[var(--b-ink)] hover:bg-[var(--b-mint)]/60'
                                    } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                                >
                                    {isActive && <span className="absolute inset-y-2 -left-2.5 w-1 rounded-r-full bg-[var(--b-forest)]" aria-hidden />}
                                    <Icon className="size-4 shrink-0" aria-hidden />
                                    <span className={hideWhenCollapsed}>{n.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="relative z-10 space-y-2.5 p-3 dark:bg-gradient-to-t dark:from-[#08100D]/70 dark:to-transparent">
                        {canBook && <SidebarPlan sub={sub} collapsed={collapsed} />}

                        {progress && (
                            <div
                                className={`rounded-xl bg-gradient-to-br from-m-forest to-m-green p-3 text-white shadow-sm ${
                                    collapsed ? 'lg:flex lg:justify-center lg:px-0' : ''
                                }`}
                                title={canBook ? 'Accredited rider' : `Accreditation ${progress.cleared}/${progress.total} cleared`}
                            >
                                {canBook ? (
                                    <p className="flex items-center gap-2 text-[13px] font-semibold">
                                        <Trophy className="size-4 shrink-0" aria-hidden />
                                        <span className={hideWhenCollapsed}>Accredited rider</span>
                                    </p>
                                ) : (
                                    <>
                                        <p className={`text-[11px] font-medium text-white/80 ${hideWhenCollapsed}`}>Accreditation</p>
                                        <p className="text-base font-bold">
                                            {progress.cleared}/{progress.total} <span className={`text-xs font-medium text-white/80 ${hideWhenCollapsed}`}>cleared</span>
                                        </p>
                                        <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25 ${hideWhenCollapsed}`}>
                                            <div className="h-full rounded-full bg-[#fff]" style={{ width: `${(progress.cleared / progress.total) * 100}%` }} />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <Link
                            href="/biker/profile"
                            onClick={() => setDrawer(false)}
                            aria-current={active === 'profile' ? 'page' : undefined}
                            title={`My profile: ${account.name} (${account.email})`}
                            className={`flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-[var(--b-mint)]/60 ${ring} ${
                                active === 'profile' ? 'bg-[var(--b-mint)]/90' : ''
                            } ${collapsed ? 'lg:justify-center' : ''}`}
                        >
                            {avatar && !avatarFailed ? (
                                <img
                                    src={avatar}
                                    alt=""
                                    onError={() => setAvatarFailed(true)}
                                    className="size-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--b-line)]"
                                />
                            ) : (
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-m-solid text-xs font-semibold text-white" aria-hidden>
                                    {initial}
                                </span>
                            )}
                            <span className={`min-w-0 leading-tight ${hideWhenCollapsed}`}>
                                <span className="block truncate text-[13px] font-bold text-[var(--b-ink)]" title={account.name}>
                                    {account.name}
                                </span>
                                <span className="block truncate text-[11px] text-[var(--b-muted)]" title={account.email}>
                                    {account.email}
                                </span>
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={logout}
                            title="Logout"
                            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-m-red/30 bg-[var(--b-card)]/90 py-1.5 text-[13px] font-semibold text-m-red shadow-sm transition-colors hover:bg-m-red/5 ${ring}`}
                        >
                            <LogOut className="size-3.5" aria-hidden />
                            <span className={hideWhenCollapsed}>Logout</span>
                        </button>
                    </div>
                </aside>

                <svg
                    aria-hidden
                    viewBox="0 0 1440 200"
                    preserveAspectRatio="none"
                    className="pointer-events-none fixed right-0 bottom-0 z-0 h-32 w-full opacity-60 lg:w-[70%] dark:opacity-30"
                >
                    <path d="M0 200 L0 150 C300 40 600 190 900 110 C1100 60 1300 70 1440 20 L1440 200Z" className="fill-m-forest/25" />
                    <path d="M0 200 L0 175 C350 110 700 210 1000 150 C1200 115 1350 120 1440 90 L1440 200Z" className="fill-m-forest/60" />
                </svg>

                <div className={`transition-[padding] ${collapsed ? 'lg:pl-16' : 'lg:pl-56'}`}>
                    <header className="sticky top-0 z-20 border-b border-[var(--b-line)] bg-[var(--b-card)]/95 backdrop-blur">
                        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
                            <div className="flex min-w-0 items-center gap-3">
                                <button
                                    type="button"
                                    onClick={toggle}
                                    className={`rounded-md p-2 text-[var(--b-body)] hover:bg-[var(--b-page)] ${ring}`}
                                    aria-label="Toggle sidebar"
                                    aria-expanded={drawer || !collapsed}
                                >
                                    <Menu className="size-5" />
                                </button>
                                <h1 className="truncate text-base font-bold text-[var(--b-ink)]">{title}</h1>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                {canBook && <PlanChip sub={sub} />}
                                <span className="hidden items-center gap-2 text-xs font-medium text-[var(--b-body)] md:flex">
                                    <CalendarDays className="size-4 text-[var(--b-accent)]" aria-hidden />
                                    {today}
                                </span>
                                <span aria-hidden className="hidden h-6 w-px bg-[var(--b-line)] md:block" />
                                <ThemeToggle className="size-8!" />
                                <NotificationBell notifications={notifications} />
                            </div>
                        </div>
                    </header>

                    <main className="relative z-10 min-w-0 p-3 pb-20 sm:p-5 sm:pb-24">
                        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
                    </main>
                </div>
            </div>
        </>
    );
}