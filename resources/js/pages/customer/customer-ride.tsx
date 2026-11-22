import { router } from '@inertiajs/react';
import {
    CircleCheck,
    Loader2,
    MessageSquare,
    Phone,
    Star,
    TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import CustomerShell from '@/components/customer-shell';
import LiveRideMap from '@/components/live-ride-map';

type Pt = { lat: number; lng: number };
type Live = {
    id: string;
    service_type?: string;
    service_label?: string;
    reference: string | null;
    status: string;
    pickup_location: string;
    destination: string;
    pickup: Pt | null;
    dest: Pt | null;
    estimated_fare: number | null;
    estimated_distance: number | null;
    final_fare: number | null;
    search_radius_km: number | null;
    rider: {
        name: string;
        photo_url: string | null;
        rating: number | null;
        rating_count: number;
        plate: string;
        vehicle_type: string | null;
        phone: string | null;
    } | null;
    rider_location: (Pt & { heading: number | null }) | null;
    eta_minutes: number | null;
    distance_to_target_m: number | null;
    approaching: boolean;
    rated: boolean;
};

const xsrf = () =>
    decodeURIComponent(
        document.cookie
            .split('; ')
            .find((c) => c.startsWith('XSRF-TOKEN='))
            ?.split('=')
            .slice(1)
            .join('=') ?? '',
    );
async function post(url: string, body?: unknown) {
    try {
        const r = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrf(),
            },
            body: JSON.stringify(body ?? {}),
        });
        return {
            ok: r.ok,
            data: (await r.json().catch(() => ({}))) as Record<string, any>,
        };
    } catch {
        return {
            ok: false,
            data: { message: 'Network problem. Please try again.' } as Record<
                string,
                any
            >,
        };
    }
}

const card = 'rounded-lg border border-m-line bg-m-card p-6 shadow-sm sm:p-8';
const metres = (m: number) =>
    m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
const peso = (n: number | null) =>
    n == null ? '—' : `₱${Number(n).toFixed(2)}`;
const CANCELLED = ['cancelled_by_passenger', 'cancelled_by_rider'];

export default function CustomerRide({
    bookingId,
    status,
}: {
    bookingId: string;
    status?: string | null;
}) {
    const [live, setLive] = useState<Live | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [stars, setStars] = useState(0);
    const [comment, setComment] = useState('');
    const [note, setNote] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/customer/ride/${bookingId}/live`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            if (r.ok) {
                setLive(await r.json());
                setError(null);
            } else setError('We could not refresh your ride. Retrying...');
        } catch {
            setError('Connection lost. Retrying...');
        }
    }, [bookingId]);

    useEffect(() => {
        void load();
        const t = setInterval(load, 3000);
        return () => clearInterval(t);
    }, [load]);

    const cancel = () => {
        if (window.confirm('Cancel this booking?'))
            router.post(
                `/customer/bookings/${bookingId}/cancel`,
                {},
                { preserveScroll: true, onSuccess: load },
            );
    };
    const retry = async () => {
        setBusy(true);
        const r = await post(`/customer/bookings/${bookingId}/retry`);
        setNote(r.data.message ?? null);
        await load();
        setBusy(false);
    };
    const rate = async () => {
        if (!stars) return setNote('Choose a star rating first.');
        setBusy(true);
        const r = await post(`/customer/bookings/${bookingId}/rate`, {
            rating: stars,
            comment,
        });
        setNote(r.data.message ?? null);
        await load();
        setBusy(false);
    };

    const s = live?.status ?? '';
    const searching = s === 'pending' || s === 'searching_for_rider';
    const assigned = [
        'rider_assigned',
        'rider_arrived',
        'in_progress',
    ].includes(s);
    const failed = s === 'no_rider_found' || s === 'expired';
    const btn =
        'rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-60';

    return (
        <CustomerShell title="Your Ride" status={status}>
            <h1 className="text-2xl font-semibold text-m-ink">
                {live?.service_type === 'MIGODALA' ? 'Your Delivery' : 'Your Ride'}{' '}
                {live?.service_label && (
                    <span className="mr-1 rounded-full bg-m-mint px-2.5 py-0.5 align-middle text-xs font-semibold text-m-accent">
                        {live.service_label}
                    </span>
                )}
                {live?.reference && (
                    <span className="text-sm font-normal text-m-muted">
                        {live.reference}
                    </span>
                )}
            </h1>

            {error && (
                <p
                    role="status"
                    className="rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/5 px-4 py-2 text-sm text-m-amber"
                >
                    {error}
                </p>
            )}
            {note && (
                <p
                    role="status"
                    className="rounded-md border border-m-line bg-m-card px-4 py-2 text-sm text-m-body"
                >
                    {note}
                </p>
            )}
            {!live && !error && (
                <p className="text-sm text-m-muted">Loading...</p>
            )}

            {live && searching && (
                <section className={`${card} text-center`} aria-live="polite">
                    <Loader2
                        className="mx-auto size-10 animate-spin text-m-accent"
                        aria-hidden
                    />
                    <h2 className="mt-4 text-lg font-semibold text-m-ink">
                        Finding nearby riders...
                    </h2>
                    <p className="mt-1 text-sm text-m-muted">
                        Please wait while we connect you with an available
                        rider.
                    </p>
                    {live.search_radius_km != null && (
                        <p className="mt-2 text-xs text-m-muted">
                            Searching within {live.search_radius_km} km of your
                            pickup point.
                        </p>
                    )}
                    <dl className="mx-auto mt-5 grid max-w-xl gap-3 text-left text-sm sm:grid-cols-2">
                        <div className="rounded-md bg-m-mint p-3">
                            <dt className="text-xs font-medium text-m-muted">
                                Pickup
                            </dt>
                            <dd className="font-semibold text-m-ink">
                                {live.pickup_location}
                            </dd>
                        </div>
                        <div className="rounded-md bg-m-mint p-3">
                            <dt className="text-xs font-medium text-m-muted">
                                Destination
                            </dt>
                            <dd className="font-semibold text-m-ink">
                                {live.destination}
                            </dd>
                        </div>
                    </dl>
                    <p className="mt-3 text-sm text-m-muted">
                        Estimated fare {peso(live.estimated_fare)}
                        {live.estimated_distance
                            ? ` · ${live.estimated_distance} km`
                            : ''}
                    </p>
                    <button
                        type="button"
                        onClick={cancel}
                        className={`${btn} mt-5 border border-m-line text-m-red hover:bg-m-red/5`}
                    >
                        Cancel booking
                    </button>
                </section>
            )}

            {live && failed && (
                <section className={card} role="alert">
                    <TriangleAlert
                        className="size-6 text-m-amber"
                        aria-hidden
                    />
                    <h2 className="mt-2 text-lg font-semibold text-m-ink">
                        {s === 'expired'
                            ? 'This request expired.'
                            : 'No rider found'}
                    </h2>
                    <p className="mt-1 text-sm text-m-muted">
                        Sorry, we couldn't find an available rider nearby.
                        Please try again.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {s === 'no_rider_found' && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={retry}
                                className={`${btn} bg-m-forest text-white hover:bg-m-forest-hover`}
                            >
                                Try again
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => router.visit('/customer/book')}
                            className={`${btn} border border-m-line text-m-body hover:bg-m-page`}
                        >
                            Cancel
                        </button>
                    </div>
                </section>
            )}

            {live && CANCELLED.includes(s) && (
                <section className={card}>
                    <h2 className="text-lg font-semibold text-m-ink">
                        Booking cancelled
                    </h2>
                    <p className="mt-1 text-sm text-m-muted">
                        {s === 'cancelled_by_rider'
                            ? 'The rider cancelled this trip.'
                            : 'You cancelled this booking.'}
                    </p>
                    <button
                        type="button"
                        onClick={() => router.visit('/customer/book')}
                        className={`${btn} mt-4 bg-m-forest text-white hover:bg-m-forest-hover`}
                    >
                        Book another ride
                    </button>
                </section>
            )}

            {live && assigned && live.rider && (
                <section className={`${card} space-y-5`}>
                    <div className="flex items-center gap-2 text-m-greentext">
                        <CircleCheck className="size-5" aria-hidden />
                        <h2 className="text-lg font-semibold">
                            {s === 'in_progress'
                                ? 'Trip in progress'
                                : 'Rider Found!'}
                        </h2>
                    </div>

                    {s === 'rider_arrived' && (
                        <p
                            role="status"
                            className="rounded-md border border-m-green/30 bg-m-green/5 px-4 py-3 text-sm font-medium text-m-greentext"
                        >
                            Your rider has arrived at your pickup location.
                        </p>
                    )}
                    {s === 'rider_assigned' && live.approaching && (
                        <p
                            role="status"
                            className="rounded-md border border-m-accent/30 bg-m-forest/5 px-4 py-3 text-sm font-medium text-m-accent-hover"
                        >
                            Your rider is approaching your pickup point.
                        </p>
                    )}

                    <div className="flex items-center gap-4">
                        {live.rider.photo_url ? (
                            <img
                                src={live.rider.photo_url}
                                alt=""
                                className="size-16 rounded-full object-cover"
                            />
                        ) : (
                            <span
                                className="flex size-16 items-center justify-center rounded-full bg-m-mint text-xl font-bold text-m-accent"
                                aria-hidden
                            >
                                {live.rider.name.charAt(0)}
                            </span>
                        )}
                        <div>
                            <p className="text-base font-semibold text-m-ink">
                                {live.rider.name}
                            </p>
                            <p className="flex items-center gap-1 text-sm text-m-muted">
                                <Star
                                    className="size-4 text-[#F59E0B]"
                                    aria-hidden
                                />
                                {live.rider.rating
                                    ? `${live.rider.rating} (${live.rider.rating_count})`
                                    : 'New rider'}
                            </p>
                            <p className="text-sm text-m-muted">
                                Motorcycle plate{' '}
                                <span className="font-semibold text-m-body">
                                    {live.rider.plate}
                                </span>
                                {live.rider.vehicle_type
                                    ? ` · ${live.rider.vehicle_type.replace(/_/g, ' ')}`
                                    : ''}
                            </p>
                        </div>
                    </div>

                    <dl className="grid gap-3 text-sm sm:grid-cols-3">
                        <div className="rounded-md bg-m-mint p-3">
                            <dt className="text-xs font-medium text-m-muted">
                                {s === 'in_progress'
                                    ? 'Arrival at destination'
                                    : 'Estimated arrival'}
                            </dt>
                            <dd className="font-semibold text-m-ink">
                                {live.eta_minutes != null
                                    ? `${live.eta_minutes} min`
                                    : 'Waiting for GPS'}
                            </dd>
                        </div>
                        <div className="rounded-md bg-m-mint p-3">
                            <dt className="text-xs font-medium text-m-muted">
                                {s === 'in_progress'
                                    ? 'Distance to destination'
                                    : 'Rider distance'}
                            </dt>
                            <dd className="font-semibold text-m-ink">
                                {live.distance_to_target_m != null
                                    ? metres(live.distance_to_target_m)
                                    : '—'}
                            </dd>
                        </div>
                        <div className="rounded-md bg-m-mint p-3">
                            <dt className="text-xs font-medium text-m-muted">
                                Estimated fare
                            </dt>
                            <dd className="font-semibold text-m-ink">
                                {peso(live.estimated_fare)}
                            </dd>
                        </div>
                    </dl>

                    <LiveRideMap
                        pickup={live.pickup}
                        destination={live.dest}
                        rider={live.rider_location}
                    />

                    <div className="flex flex-wrap gap-2">
                        {live.rider.phone && (
                            <>
                                <a
                                    href={`tel:${live.rider.phone}`}
                                    className={`${btn} inline-flex items-center gap-2 bg-m-forest text-white hover:bg-m-forest-hover`}
                                >
                                    <Phone className="size-4" aria-hidden />{' '}
                                    Call Rider
                                </a>
                                <a
                                    href={`sms:${live.rider.phone}`}
                                    className={`${btn} inline-flex items-center gap-2 border border-m-accent text-m-accent hover:bg-m-forest/5`}
                                >
                                    <MessageSquare
                                        className="size-4"
                                        aria-hidden
                                    />{' '}
                                    Message Rider
                                </a>
                            </>
                        )}
                        {s !== 'in_progress' && (
                            <button
                                type="button"
                                onClick={cancel}
                                className={`${btn} border border-m-line text-m-red hover:bg-m-red/5`}
                            >
                                Cancel booking
                            </button>
                        )}
                    </div>
                </section>
            )}

            {live && s === 'completed' && (
                <section className={`${card} space-y-4`}>
                    <div className="flex items-center gap-2 text-m-greentext">
                        <CircleCheck className="size-5" aria-hidden />
                        <h2 className="text-lg font-semibold">
                            Trip completed
                        </h2>
                    </div>
                    <p className="text-sm text-m-muted">
                        Final fare{' '}
                        <span className="text-lg font-bold text-m-ink">
                            {peso(live.final_fare)}
                        </span>
                        . Please pay your rider in cash.
                    </p>
                    {live.rated ? (
                        <p className="text-sm text-m-greentext">
                            Thank you for rating your trip.
                        </p>
                    ) : (
                        <div>
                            <h3 className="text-sm font-semibold text-m-ink">
                                Rate {live.rider?.name ?? 'your rider'}
                            </h3>
                            <div
                                className="mt-2 flex gap-1"
                                role="radiogroup"
                                aria-label="Rating"
                            >
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        role="radio"
                                        aria-checked={stars === n}
                                        aria-label={`${n} star${n > 1 ? 's' : ''}`}
                                        onClick={() => setStars(n)}
                                    >
                                        <Star
                                            className={`size-8 ${n <= stars ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-m-faint'}`}
                                            aria-hidden
                                        />
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                maxLength={500}
                                rows={2}
                                placeholder="Add a comment (optional)"
                                className="mt-3 w-full rounded-md border border-m-line p-2 text-sm"
                            />
                            <button
                                type="button"
                                disabled={busy}
                                onClick={rate}
                                className={`${btn} mt-2 bg-m-forest text-white hover:bg-m-forest-hover`}
                            >
                                Submit rating
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => router.visit('/customer/book')}
                        className={`${btn} border border-m-line text-m-body hover:bg-m-page`}
                    >
                        Book another ride
                    </button>
                </section>
            )}
        </CustomerShell>
    );
}
