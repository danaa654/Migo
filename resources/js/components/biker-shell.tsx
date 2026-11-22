import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    ClipboardList,
    LayoutDashboard,
    LogOut,
    Lock,
    Navigation,
    Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import NotificationBell from '@/components/biker-notifications';
import type { Notifications } from '@/components/biker-notifications';
import { BikerThemeStyles } from '@/components/biker-theme';
import { navPill, ring } from '@/components/migo-bar';
import { ThemeToggle } from '@/components/theme-toggle';

type Props = {
    account: { name: string; email: string };
    /** Unlocks the Ride requests / Service requests links (accredited riders only). */
    canBook?: boolean;
    active?: 'dashboard' | 'dispatch' | 'requests';
    /** Notifications for the bell in the top bar. */
    notifications?: Notifications;
    /** Accreditation progress shown at the bottom of the sidebar. */
    progress?: { cleared: number; total: number };
    children?: ReactNode;
};

type NavItem = {
    key: 'dashboard' | 'dispatch' | 'requests';
    href: string;
    label: string;
    icon: LucideIcon;
    needsBooking: boolean;
};
const NAV: NavItem[] = [
    { key: 'dashboard', href: '/biker/dashboard', label: 'Dashboard', icon: LayoutDashboard, needsBooking: false },
    { key: 'dispatch', href: '/biker/dispatch', label: 'Ride requests', icon: Navigation, needsBooking: true },
    { key: 'requests', href: '/biker/service-requests', label: 'Service requests', icon: ClipboardList, needsBooking: true },
];

const logout = () => router.post('/logout');

/** Signed-in shell for the Biker pages. Same look as the admin shell: brand block, artwork sidebar, slim top bar. */
export default function BikerShell({
    account,
    canBook = false,
    active = 'dashboard',
    notifications,
    progress,
    children,
}: Props) {
    const mobileLinks = NAV.filter((n) => !n.needsBooking || canBook);
    const initial = account.name.trim().charAt(0).toUpperCase() || 'B';
    const title = NAV.find((n) => n.key === active)?.label ?? 'Dashboard';
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

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
                <aside
                    className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col overflow-hidden border-r border-[var(--b-line)] bg-[var(--b-card)] lg:flex"
                    aria-label="Biker sidebar"
                >
                    {/* Sidebar artwork (public/img/side.png), same as the admin sidebar. */}
                    <img
                        src="/img/side.png"
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="pointer-events-none absolute inset-0 size-full object-cover object-left select-none dark:opacity-10"
                    />

                    <div className="relative z-10">
                        <Link
                            href="/"
                            aria-label="Migo home"
                            className={`flex items-center gap-3 rounded-br-[1.5rem] bg-linear-to-br from-[#1B5240] via-[#17483A] to-[#0F2F25] px-3 py-3 shadow-md ${ring}`}
                        >
                            <img
                                src="/favi.png"
                                alt=""
                                className="size-10 shrink-0 rounded-lg bg-white object-contain p-0.5 shadow-sm ring-2 ring-white/30"
                            />
                            <span className="min-w-0 leading-tight">
                                <span className="block text-base font-extrabold tracking-wider text-white">MIGO</span>
                                <span className="block text-[8px] leading-snug font-medium tracking-wide text-white/80 uppercase">
                                    Biker
                                    <br />
                                    Dashboard
                                </span>
                            </span>
                        </Link>
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
                                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--b-faint)]"
                                    >
                                        <Icon className="size-4" aria-hidden />
                                        <span className="flex-1">{n.label}</span>
                                        <Lock className="size-3" aria-hidden />
                                    </span>
                                );
                            }
                            return (
                                <Link
                                    key={n.key}
                                    href={n.href}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${ring} ${
                                        isActive
                                            ? 'bg-[var(--b-mint)]/90 font-bold text-[var(--b-accent)] shadow-sm'
                                            : 'text-[var(--b-ink)] hover:bg-[var(--b-mint)]/60'
                                    }`}
                                >
                                    {isActive && <span className="absolute inset-y-2 -left-2.5 w-1 rounded-r-full bg-[var(--b-forest)]" aria-hidden />}
                                    <Icon className="size-4" aria-hidden />
                                    {n.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="relative z-10 space-y-2.5 p-3">
                        {progress && (
                            <div className="rounded-xl bg-gradient-to-br from-m-forest to-m-green p-3 text-white shadow-sm">
                                {canBook ? (
                                    <p className="flex items-center gap-2 text-[13px] font-semibold">
                                        <Trophy className="size-4" aria-hidden /> Accredited rider
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-[11px] font-medium text-white/80">Accreditation</p>
                                        <p className="text-base font-bold">
                                            {progress.cleared}/{progress.total}{' '}
                                            <span className="text-xs font-medium text-white/80">cleared</span>
                                        </p>
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25">
                                            <div className="h-full rounded-full bg-[#fff]" style={{ width: `${(progress.cleared / progress.total) * 100}%` }} />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-m-solid text-xs font-semibold text-white" aria-hidden>
                                {initial}
                            </span>
                            <span className="min-w-0 leading-tight">
                                <span className="block truncate text-[13px] font-bold text-[var(--b-ink)]" title={account.name}>
                                    {account.name}
                                </span>
                                <span className="block truncate text-[11px] text-[var(--b-muted)]" title={account.email}>
                                    {account.email}
                                </span>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={logout}
                            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-m-red/30 bg-[var(--b-card)]/90 py-1.5 text-[13px] font-semibold text-m-red shadow-sm transition-colors hover:bg-m-red/5 ${ring}`}
                        >
                            <LogOut className="size-3.5" aria-hidden /> Logout
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

                <div className="lg:pl-56">
                    <header className="sticky top-0 z-20 border-b border-[var(--b-line)] bg-[var(--b-card)]/95 backdrop-blur">
                        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
                            <div className="flex min-w-0 items-center gap-3">
                                <Link href="/" aria-label="Migo home" className={`flex items-center gap-2 lg:hidden ${ring}`}>
                                    <img src="/favi.png" alt="" className="size-8 object-contain" />
                                    <span className="text-sm font-extrabold tracking-wide text-[var(--b-accent)]">MIGO</span>
                                </Link>
                                <h1 className="hidden text-base font-bold text-[var(--b-ink)] lg:block">{title}</h1>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <span className="hidden items-center gap-2 text-xs font-medium text-[var(--b-body)] md:flex">
                                    <CalendarDays className="size-4 text-[var(--b-accent)]" aria-hidden />
                                    {today}
                                </span>
                                <span aria-hidden className="hidden h-6 w-px bg-[var(--b-line)] md:block" />
                                <ThemeToggle className="size-8!" />
                                <NotificationBell notifications={notifications} />
                                {/* The sidebar (account and logout) is hidden on small screens, so keep them here. */}
                                <span
                                    className="flex size-8 items-center justify-center rounded-full bg-m-solid text-xs font-semibold text-white lg:hidden"
                                    title={account.name}
                                    aria-hidden
                                >
                                    {initial}
                                </span>
                                <button
                                    type="button"
                                    onClick={logout}
                                    aria-label="Logout"
                                    className={`flex size-8 items-center justify-center rounded-full border border-[var(--b-line)] text-m-red transition hover:bg-m-red/10 lg:hidden ${ring}`}
                                >
                                    <LogOut className="size-3.5" aria-hidden />
                                </button>
                            </div>
                        </div>
                        {mobileLinks.length > 1 && (
                            <nav aria-label="Biker" className="flex gap-1 overflow-x-auto border-t border-[var(--b-line)] px-4 py-2 lg:hidden">
                                {mobileLinks.map((l) => (
                                    <Link
                                        key={l.key}
                                        href={l.href}
                                        aria-current={active === l.key ? 'page' : undefined}
                                        className={`shrink-0 ${navPill(active === l.key)}`}
                                    >
                                        {l.label}
                                    </Link>
                                ))}
                            </nav>
                        )}
                    </header>

                    <main className="relative z-10 min-w-0 p-3 pb-20 sm:p-5 sm:pb-24">
                        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
                    </main>
                </div>
            </div>
        </>
    );
}