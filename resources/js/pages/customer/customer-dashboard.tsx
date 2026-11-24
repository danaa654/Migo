import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    Bike,
    CalendarClock,
    CircleCheck,
    MapPin,
    Mail,
    Phone,
    ShieldCheck,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import CustomerShell from '@/components/customer-shell';
import { peso, statusOf, TRACKABLE, when } from '@/lib/booking-status';
import { serviceMeta } from '@/lib/services';

type Booking = {
    id: string;
    booking_reference: string | null;
    pickup_location: string;
    destination: string;
    booking_status: string;
    booking_date: string | null;
    estimated_fare: number | null;
    final_fare: number | null;
    created_at: string;
    service_type?: string | null;
};
type Props = {
    account: { name: string; email: string | null };
    profile: {
        phone: string | null;
        accountStatus: string;
        memberSince: string | null;
    };
    bookings: {
        total: number;
        completed: number;
        spent: number;
        active: Booking | null;
        recent: Booking[];
    } | null;
};

const card = 'rounded-xl border border-m-line bg-m-card shadow-sm';
const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

function Tile({
    icon: Icon,
    tone,
    label,
    value,
    sub,
}: {
    icon: LucideIcon;
    tone: string;
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className={`${card} flex items-center gap-3 p-4`}>
            <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}
            >
                <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
                <p className="text-xs text-m-muted">{label}</p>
                <p className="truncate text-lg leading-tight font-bold text-m-ink">
                    {value}
                </p>
                {sub && <p className="truncate text-[11px] text-m-muted">{sub}</p>}
            </div>
        </div>
    );
}

function Route({ b }: { b: Booking }) {
    return (
        <div className="min-w-0 space-y-1 text-sm">
            <p className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-m-green" aria-hidden />
                <span className="truncate">{b.pickup_location}</span>
            </p>
            <p className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-m-red" aria-hidden />
                <span className="truncate">{b.destination}</span>
            </p>
        </div>
    );
}

export default function CustomerDashboard({ account, profile, bookings }: Props) {
    const suspended = profile.accountStatus !== 'active';
    const firstName = account.name.trim().split(/\s+/)[0] || account.name;
    const active = bookings?.active ?? null;
    const memberSince = profile.memberSince
        ? new Date(profile.memberSince).toLocaleDateString('en-PH', {
              month: 'long',
              year: 'numeric',
          })
        : '—';

    return (
        <CustomerShell title="Customer Dashboard">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-xl border border-m-line bg-gradient-to-br from-m-mint via-m-mint to-[#C9E6D3] px-6 py-6 shadow-sm sm:px-8 dark:to-[#244A3B]">
                <img
                    src="/img/header-P.png"
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto max-w-[70%] [mask-image:linear-gradient(to_right,transparent,black_30%)] object-cover object-right select-none sm:block dark:opacity-30"
                />
                <div className="relative max-w-xl">
                    <h1 className="text-2xl font-extrabold tracking-tight text-m-forest dark:text-m-ink">
                        Welcome back, {firstName}!
                    </h1>
                    <p className="mt-1 text-sm text-m-body2">
                        Where to today? Book a ride and a nearby rider will
                        accept your request.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {suspended ? (
                            <span className="cursor-not-allowed rounded-full bg-m-forest/40 px-5 py-2 text-sm font-bold text-white">
                                Booking unavailable
                            </span>
                        ) : active && TRACKABLE.includes(active.booking_status) ? (
                            <Link
                                href={`/customer/ride/${active.id}`}
                                className={`inline-flex items-center gap-2 rounded-full bg-m-forest px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-m-forest-hover ${ring}`}
                            >
                                <span
                                    className="size-2 rounded-full bg-[#7CF0B6] motion-safe:animate-pulse"
                                    aria-hidden
                                />
                                Track your ride
                            </Link>
                        ) : (
                            <Link
                                href="/customer/book"
                                className={`inline-flex items-center gap-2 rounded-full bg-m-forest px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-m-forest-hover ${ring}`}
                            >
                                <MapPin className="size-4" aria-hidden /> Book a ride
                            </Link>
                        )}
                        <Link
                            href="/customer/bookings"
                            className={`inline-flex items-center rounded-full border border-m-forest bg-m-card/70 px-5 py-2 text-sm font-semibold text-m-forest backdrop-blur transition hover:bg-m-card dark:text-m-ink ${ring}`}
                        >
                            My bookings
                        </Link>
                    </div>
                </div>
            </section>

            {suspended && (
                <p
                    role="alert"
                    className="rounded-xl border border-m-red/30 bg-m-red/5 px-4 py-3 text-sm text-m-redtext"
                >
                    Your account is {profile.accountStatus}, so booking is
                    unavailable. Please contact an administrator if you have
                    questions.
                </p>
            )}

            {bookings && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <Tile
                        icon={Bike}
                        tone="bg-m-green/10 text-m-green"
                        label="Total rides"
                        value={String(bookings.total)}
                        sub={`${bookings.completed} completed`}
                    />
                    <Tile
                        icon={Wallet}
                        tone="bg-[#7C3AED]/10 text-m-purple"
                        label="Total spent"
                        value={peso(bookings.spent)}
                        sub="On completed rides"
                    />
                    <Tile
                        icon={CircleCheck}
                        tone="bg-[#2563EB]/10 text-[#2563EB]"
                        label="Member since"
                        value={memberSince}
                    />
                </div>
            )}

            {active && (
                <section className="rounded-xl border border-m-accent/40 bg-m-forest/5 p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-semibold text-m-ink">
                                Active booking
                            </h2>
                            <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusOf(active.booking_status).tone}`}
                            >
                                {statusOf(active.booking_status).label}
                            </span>
                        </div>
                        <span className="text-base font-bold text-m-ink">
                            {peso(active.final_fare ?? active.estimated_fare)}
                        </span>
                    </div>
                    <div className="mt-3">
                        <Route b={active} />
                    </div>
                    {TRACKABLE.includes(active.booking_status) && (
                        <Link
                            href={`/customer/ride/${active.id}`}
                            className={`mt-4 inline-flex items-center gap-2 rounded-md bg-m-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-m-forest-hover ${ring}`}
                        >
                            Open live ride <ArrowRight className="size-4" aria-hidden />
                        </Link>
                    )}
                </section>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <section className={card}>
                    <div className="flex items-center justify-between gap-3 border-b border-m-line px-5 py-4">
                        <h2 className="flex items-center gap-2 text-base font-semibold text-m-ink">
                            <CalendarClock className="size-4 text-m-accent" aria-hidden />{' '}
                            Recent bookings
                        </h2>
                        {bookings && bookings.total > 0 && (
                            <Link
                                href="/customer/bookings"
                                className={`rounded text-sm font-semibold text-m-accent hover:underline ${ring}`}
                            >
                                View all
                            </Link>
                        )}
                    </div>
                    {bookings === null ? (
                        <p className="p-5 text-sm text-m-muted">
                            Booking data is not yet available.
                        </p>
                    ) : bookings.recent.length === 0 ? (
                        <div className="flex flex-col items-center px-5 py-10 text-center">
                            <span className="flex size-12 items-center justify-center rounded-full bg-m-mint text-m-accent">
                                <MapPin className="size-6" aria-hidden />
                            </span>
                            <p className="mt-3 font-semibold text-m-ink">
                                No rides yet
                            </p>
                            <p className="mt-1 max-w-xs text-sm text-m-muted">
                                Your first booking will show up here.
                            </p>
                            {!suspended && (
                                <Link
                                    href="/customer/book"
                                    className={`mt-4 rounded-full bg-m-forest px-4 py-1.5 text-xs font-bold text-white hover:bg-m-forest-hover ${ring}`}
                                >
                                    Book your first ride
                                </Link>
                            )}
                        </div>
                    ) : (
                        <ul className="divide-y divide-m-line">
                            {bookings.recent.map((b) => (
                                <li
                                    key={b.id}
                                    className="flex items-start justify-between gap-3 px-5 py-3.5"
                                >
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${serviceMeta(b.service_type).chip}`}
                                            >
                                                {serviceMeta(b.service_type).name}
                                            </span>
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusOf(b.booking_status).tone}`}
                                            >
                                                {statusOf(b.booking_status).label}
                                            </span>
                                            <span className="text-xs text-m-muted">
                                                {when(b)}
                                            </span>
                                        </div>
                                        <Route b={b} />
                                    </div>
                                    <span className="shrink-0 font-semibold text-m-ink">
                                        {peso(b.final_fare ?? b.estimated_fare)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className={`${card} h-fit p-5`}>
                    <h2 className="flex items-center gap-2 text-base font-semibold text-m-ink">
                        <ShieldCheck className="size-4 text-m-accent" aria-hidden />{' '}
                        Your account
                    </h2>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                            <Mail className="mt-0.5 size-4 shrink-0 text-m-muted" aria-hidden />
                            <div className="min-w-0">
                                <dt className="text-xs text-m-muted">Email</dt>
                                <dd className="font-medium break-all text-m-ink">
                                    {account.email ?? '—'}
                                </dd>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Phone className="mt-0.5 size-4 shrink-0 text-m-muted" aria-hidden />
                            <div>
                                <dt className="text-xs text-m-muted">Contact number</dt>
                                <dd className="font-medium text-m-ink">
                                    {profile.phone ?? (
                                        <Link
                                            href="/customer/profile"
                                            className="text-m-accent underline"
                                        >
                                            Add your number
                                        </Link>
                                    )}
                                </dd>
                                {!profile.phone && (
                                    <p className="mt-0.5 text-xs text-m-muted">
                                        Riders use it to reach you on a trip.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CircleCheck className="mt-0.5 size-4 shrink-0 text-m-muted" aria-hidden />
                            <div>
                                <dt className="text-xs text-m-muted">Status</dt>
                                <dd>
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${suspended ? 'bg-m-red/10 text-m-redtext' : 'bg-m-green/10 text-m-greentext'}`}
                                    >
                                        {profile.accountStatus
                                            .charAt(0)
                                            .toUpperCase() +
                                            profile.accountStatus.slice(1)}
                                    </span>
                                </dd>
                            </div>
                        </div>
                    </dl>
                    <Link
                        href="/customer/profile"
                        className={`mt-5 inline-block rounded-md border border-m-accent px-4 py-2 text-sm font-semibold text-m-accent transition hover:bg-m-forest/5 ${ring}`}
                    >
                        Edit profile
                    </Link>
                </section>
            </div>
        </CustomerShell>
    );
}
