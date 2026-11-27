import {
    Bell,
    BellOff,
    Bike,
    MapPin,
    Navigation,
    Phone,
    Power,
    Satellite,
    Star,
    Wallet,
    WifiOff,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import BikerShell from '@/components/biker-shell';
import type { Notifications } from '@/components/biker-notifications';
import ConfirmDialog from '@/components/confirm-dialog';
import LiveRideMap from '@/components/live-ride-map';

type Offer = {
    id: number;
    service_type: string;
    service_label: string;
    passenger_count: number | null;
    item_description: string | null;
    package_size: string | null;
    delivery_vehicle: string | null;
    distance_to_pickup: number;
    estimated_pickup_time: number;
    pickup_location: string;
    destination: string;
    estimated_distance: number | null;
    estimated_fare: number | null;
    expires_in: number;
};
type Active = {
    id: string;
    service_type: string;
    service_label: string;
    passenger_count: number | null;
    notes: string | null;
    recipient_name: string | null;
    recipient_phone: string | null;
    item_description: string | null;
    package_size: string | null;
    delivery_vehicle: string | null;
    reference: string | null;
    status: string;
    pickup_location: string;
    destination: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
    destination_lat: number | null;
    destination_lng: number | null;
    estimated_fare: number | null;
    estimated_distance: number | null;
    passenger_name: string | null;
    passenger_photo_url?: string | null;
    passenger_phone: string | null;
};
type State = {
    today: { trips: number; earnings: number };
    location: { lat: number; lng: number } | null;
    to_rate: {
        id: string;
        passenger_name: string | null;
        final_fare: number | null;
    } | null;
    availability: { status: string; is_online: boolean };
    location_age: number | null;
    offers: Offer[];
    active: Active | null;
};
type Props = {
    account: { name: string; email: string };
    notifications: Notifications;
};
type Perm = NotificationPermission | 'unsupported';

const BASE = '/biker/dispatch';
const xsrf = () =>
    decodeURIComponent(
        document.cookie
            .split('; ')
            .find((c) => c.startsWith('XSRF-TOKEN='))
            ?.split('=')
            .slice(1)
            .join('=') ?? '',
    );

async function api(method: 'GET' | 'POST', path: string, body?: unknown) {
    try {
        const r = await fetch(`${BASE}/${path}`, {
            method,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrf(),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await r.json().catch(() => ({}));
        return {
            ok: r.ok,
            status: r.status,
            data: data as Record<string, any>,
        };
    } catch {
        return {
            ok: false,
            status: 0,
            data: { message: 'Network problem. Retrying...' } as Record<
                string,
                any
            >,
        };
    }
}

const metres = (m: number) =>
    m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
const peso = (n: number | null) =>
    n == null ? '—' : `₱${Number(n).toFixed(2)}`;

// One shared AudioContext, unlocked by the "Go online" click (browsers block sound before a user gesture).
let audioCtx: AudioContext | null = null;
function unlockAudio() {
    try {
        audioCtx ??= new (
            window.AudioContext || (window as any).webkitAudioContext
        )();
        void audioCtx.resume();
    } catch {
        /* sound is optional */
    }
}
function beep() {
    try {
        if (!audioCtx) return;
        void audioCtx.resume();
        const o = audioCtx.createOscillator();
        o.frequency.value = 880;
        o.connect(audioCtx.destination);
        o.start();
        setTimeout(() => o.stop(), 350);
    } catch {
        /* sound is optional */
    }
}

const statusLabel: Record<string, string> = {
    rider_assigned: 'Head to the pickup point',
    rider_arrived: 'Waiting for the passenger',
    in_progress: 'Trip in progress',
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--b-accent)]';

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
        <div className="flex items-center gap-3 rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] p-4 shadow-sm">
            <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}
            >
                <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
                <p className="text-xs text-[var(--b-muted)]">{label}</p>
                <p className="truncate text-lg leading-tight font-bold text-[var(--b-ink)]">
                    {value}
                </p>
                {sub && (
                    <p className="truncate text-[11px] text-[var(--b-muted)]">
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

/** Rider dispatch screen: go online, share GPS, receive ride offers, accept or decline. All decisions are made by the server. */
export default function BikerDispatch({ account, notifications }: Props) {
    const [state, setState] = useState<State | null>(null);
    const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(
        null,
    );
    const [busy, setBusy] = useState(false);
    const [stars, setStars] = useState(0);
    const [deadlines, setDeadlines] = useState<Record<number, number>>({});
    const [offline, setOffline] = useState(false);
    const [perm, setPerm] = useState<Perm>('unsupported');
    const [confirm, setConfirm] = useState<'complete' | 'cancel' | null>(null);
    const [, tick] = useState(0);
    const seen = useRef<Set<number>>(new Set());
    const totals = useRef<Record<number, number>>({});
    const watch = useRef<number | null>(null);
    const lastSent = useRef<{ t: number; lat: number; lng: number } | null>(
        null,
    );

    const online = !!state?.availability.is_online;

    useEffect(() => {
        if ('Notification' in window) setPerm(Notification.permission);
    }, []);

    // Status messages fade away on their own.
    useEffect(() => {
        if (!msg) return;
        const id = setTimeout(() => setMsg(null), 6000);
        return () => clearTimeout(id);
    }, [msg]);

    const refresh = useCallback(async () => {
        const r = await api('GET', 'state');
        if (!r.ok) {
            if (r.status === 403 || r.status === 401)
                window.location.href = '/biker/dashboard';
            else if (r.status === 0 || r.status >= 500) setOffline(true);
            return;
        }
        setOffline(false);
        const s = r.data as State;
        setState(s);
        setDeadlines(
            Object.fromEntries(
                s.offers.map((o) => [o.id, Date.now() + o.expires_in * 1000]),
            ),
        );
        const fresh = s.offers.filter((o) => !seen.current.has(o.id));
        if (fresh.length) {
            fresh.forEach((o) => {
                seen.current.add(o.id);
                totals.current[o.id] = Math.max(o.expires_in, 1);
            });
            beep();
            if (
                'Notification' in window &&
                Notification.permission === 'granted' &&
                document.hidden
            ) {
                new Notification('NEW RIDE REQUEST!', {
                    body: `A passenger ${metres(fresh[0].distance_to_pickup)} away needs a rider.`,
                });
            }
        }
    }, []);

    useEffect(() => {
        void refresh();
        const poll = setInterval(refresh, 3000);
        const clock = setInterval(() => tick((n) => n + 1), 1000);
        return () => {
            clearInterval(poll);
            clearInterval(clock);
        };
    }, [refresh]);

    const sendLocation = useCallback(
        async (p: GeolocationPosition, force = false) => {
            const { latitude, longitude, accuracy, heading, speed } = p.coords;
            const prev = lastSent.current;
            const now = Date.now();
            // Battery: send at most every 10 s, or sooner only if the rider moved 25 m or more.
            if (!force && prev) {
                const moved = Math.hypot(
                    (latitude - prev.lat) * 111320,
                    (longitude - prev.lng) *
                        111320 *
                        Math.cos((latitude * Math.PI) / 180),
                );
                if (now - prev.t < 10000 && moved < 25) return true;
                if (now - prev.t < 3000) return true;
            }
            lastSent.current = { t: now, lat: latitude, lng: longitude };
            const r = await api('POST', 'location', {
                latitude,
                longitude,
                accuracy,
                heading: heading ?? null,
                speed: speed != null ? speed * 3.6 : null,
            });
            if (!r.ok && r.status === 422)
                setMsg({
                    tone: 'err',
                    text: r.data.message ?? 'Location rejected.',
                });
            return r.ok;
        },
        [],
    );

    // Share GPS only while online.
    useEffect(() => {
        if (!online || !('geolocation' in navigator)) return;
        watch.current = navigator.geolocation.watchPosition(
            (p) => void sendLocation(p),
            () =>
                setMsg({
                    tone: 'err',
                    text: 'Location access was lost. Turn GPS on to keep receiving rides.',
                }),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
        );
        return () => {
            if (watch.current != null)
                navigator.geolocation.clearWatch(watch.current);
        };
    }, [online, sendLocation]);

    // Heartbeat: watchPosition only fires when the position changes, so a stationary rider (or a laptop) would go
    // "stale" after the freshness window. Every 15 s while online, read the position again and send it with force = true.
    useEffect(() => {
        if (!online || !('geolocation' in navigator)) return;
        const beat = () =>
            navigator.geolocation.getCurrentPosition(
                (p) => void sendLocation(p, true),
                () => {
                    /* the watchPosition error handler already shows a message */
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
            );
        const id = setInterval(beat, 15000);
        return () => clearInterval(id);
    }, [online, sendLocation]);

    const askPermission = async () => {
        if (!('Notification' in window)) return;
        setPerm(await Notification.requestPermission());
    };

    const goOnline = () => {
        if (!('geolocation' in navigator))
            return setMsg({
                tone: 'err',
                text: 'This device does not support GPS.',
            });
        setBusy(true);
        unlockAudio(); // inside the click, so the browser allows the new-request sound later
        if ('Notification' in window && Notification.permission === 'default')
            void askPermission();
        navigator.geolocation.getCurrentPosition(
            async (p) => {
                await sendLocation(p, true);
                const r = await api('POST', 'online');
                setMsg({
                    tone: r.ok ? 'ok' : 'err',
                    text: r.data.message ?? '',
                });
                await refresh();
                setBusy(false);
            },
            () => {
                setMsg({
                    tone: 'err',
                    text: 'Allow location access in your browser to go online.',
                });
                setBusy(false);
            },
            { enableHighAccuracy: true, timeout: 15000 },
        );
    };

    const act = async (path: string, body?: unknown) => {
        setBusy(true);
        const r = await api('POST', path, body);
        setMsg({
            tone: r.ok ? 'ok' : 'err',
            text: r.data.message ?? (r.ok ? 'Done.' : 'Something went wrong.'),
        });
        await refresh();
        setBusy(false);
    };

    const runConfirmed = async () => {
        const a = state?.active;
        const which = confirm;
        setConfirm(null);
        if (a && which) await act(`bookings/${a.id}/${which}`);
    };

    const offers = (state?.offers ?? []).filter(
        (o) => (deadlines[o.id] ?? 0) > Date.now(),
    );
    const btn =
        'rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50';
    const card =
        'rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] shadow-sm';

    const gps =
        state?.location_age == null
            ? { v: online ? 'Waiting…' : 'Off', s: 'No location yet' }
            : state.location_age <= 60
              ? { v: 'Good', s: `Updated ${state.location_age}s ago` }
              : { v: 'Stale', s: 'Not updating' };

    const a = state?.active ?? null;
    const showMap = online || !!a;

    return (
        <BikerShell
            account={account}
            canBook
            active="dispatch"
            notifications={notifications}
            progress={{ cleared: 6, total: 6 }}
        >
            <div className="flex flex-col gap-4">
                {offline && (
                    <p
                        role="alert"
                        className="flex items-center gap-2 rounded-xl border border-m-red/30 bg-m-red/5 p-3 text-sm text-m-redtext"
                    >
                        <WifiOff className="size-4 shrink-0" aria-hidden />{' '}
                        Connection lost. Retrying… You will not receive
                        requests until you are back online.
                    </p>
                )}
                {msg && (
                    <p
                        role="status"
                        className={`rounded-xl border p-3 text-sm ${msg.tone === 'ok' ? 'border-m-green/30 bg-m-green/5 text-m-greentext' : 'border-m-red/30 bg-m-red/5 text-m-redtext'}`}
                    >
                        {msg.text}
                    </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Tile
                        icon={Power}
                        tone={
                            online
                                ? 'bg-m-green/10 text-m-green'
                                : 'bg-m-soft text-m-muted'
                        }
                        label="Status"
                        value={state ? (online ? 'Online' : 'Offline') : '…'}
                        sub={
                            online
                                ? state?.availability.status.replace(/_/g, ' ')
                                : 'Not receiving requests'
                        }
                    />
                    <Tile
                        icon={Bike}
                        tone="bg-[#2563EB]/10 text-[#2563EB]"
                        label="Trips today"
                        value={String(state?.today.trips ?? 0)}
                        sub="Completed"
                    />
                    <Tile
                        icon={Wallet}
                        tone="bg-[#7C3AED]/10 text-m-purple"
                        label="Earned today"
                        value={peso(state?.today.earnings ?? 0)}
                    />
                    <Tile
                        icon={Satellite}
                        tone={
                            gps.v === 'Stale'
                                ? 'bg-m-red/10 text-m-redtext'
                                : 'bg-[#F59E0B]/15 text-m-amber'
                        }
                        label="GPS signal"
                        value={gps.v}
                        sub={gps.s}
                    />
                </div>

                <section
                    className={`${card} flex flex-wrap items-center justify-between gap-4 p-5`}
                >
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--b-ink)]">
                            <span
                                className={`size-2.5 rounded-full ${online ? 'bg-[#16A36A]' : 'bg-[var(--b-faint)]'}`}
                                aria-hidden
                            />
                            {state
                                ? online
                                    ? 'You are online'
                                    : 'You are offline'
                                : 'Loading...'}
                        </h2>
                        <p className="mt-1 text-xs text-[var(--b-muted)]">
                            {online
                                ? 'GPS is shared with Migo while you are online.'
                                : 'Go online to receive ride requests from nearby passengers. Your location is not shared while you are offline.'}
                            {online &&
                                state?.location_age != null &&
                                state.location_age > 60 &&
                                ' Your GPS signal looks stale: you will not receive requests until it updates.'}
                        </p>
                    </div>
                    {online ? (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => act('offline')}
                            className={`${btn} inline-flex items-center gap-2 border border-[var(--b-line)] text-m-red hover:bg-m-red/5 ${ring}`}
                        >
                            <Power className="size-4" aria-hidden /> Go offline
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={busy || !state}
                            onClick={goOnline}
                            className={`${btn} inline-flex items-center gap-2 bg-[#16A36A] text-white hover:bg-[#117A50] ${ring}`}
                        >
                            <Power className="size-4" aria-hidden /> Go online
                        </button>
                    )}
                </section>

                {a && (
                    <section
                        className="rounded-xl border border-m-accent/40 bg-m-forest/5 p-5 shadow-sm"
                        aria-labelledby="active-booking"
                    >
                        <h2
                            id="active-booking"
                            className="flex items-center gap-2 text-base font-semibold text-[var(--b-ink)]"
                        >
                            <Navigation className="size-4" aria-hidden /> Your
                            active booking{' '}
                            {a.reference && (
                                <span className="text-xs font-normal text-[var(--b-muted)]">
                                    ({a.reference})
                                </span>
                            )}
                        </h2>
                        <p className="mt-1 text-sm font-medium text-[var(--b-accent)]">
                            {statusLabel[a.status] ?? a.status}
                        </p>
                        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-xs text-[var(--b-muted)]">
                                    Pickup
                                </dt>
                                <dd>{a.pickup_location}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-[var(--b-muted)]">
                                    Destination
                                </dt>
                                <dd>{a.destination}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-[var(--b-muted)]">
                                    Service
                                </dt>
                                <dd className="font-medium">
                                    {a.service_label}
                                    {a.service_type !== 'MIGODALA' && a.passenger_count
                                        ? ` · ${a.passenger_count} passenger${a.passenger_count === 1 ? '' : 's'}`
                                        : ''}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-[var(--b-muted)]">
                                    {a.service_type === 'MIGODALA' ? 'Sender' : 'Passenger'}
                                </dt>
                                <dd className="flex items-center gap-2">
                                    {a.passenger_photo_url && (
                                        <img
                                            src={a.passenger_photo_url}
                                            alt=""
                                            className="size-8 rounded-full object-cover ring-1 ring-[var(--b-line)]"
                                        />
                                    )}
                                    {a.passenger_name ?? '—'}
                                </dd>
                            </div>
                            {a.service_type === 'MIGODALA' && (
                                <>
                                    <div>
                                        <dt className="text-xs text-[var(--b-muted)]">
                                            Recipient
                                        </dt>
                                        <dd>
                                            {a.recipient_name ?? '—'}
                                            {a.recipient_phone ? ` · ${a.recipient_phone}` : ''}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-[var(--b-muted)]">
                                            Package
                                        </dt>
                                        <dd>
                                            {a.item_description ?? '—'}
                                            {a.package_size ? ` · ${a.package_size}` : ''}
                                            {a.delivery_vehicle ? ` · by ${a.delivery_vehicle === 'four_wheel' ? 'car' : 'motorcycle'}` : ''}
                                        </dd>
                                    </div>
                                </>
                            )}
                            {a.notes && (
                                <div>
                                    <dt className="text-xs text-[var(--b-muted)]">
                                        Notes
                                    </dt>
                                    <dd>{a.notes}</dd>
                                </div>
                            )}
                            <div>
                                <dt className="text-xs text-[var(--b-muted)]">
                                    Estimated fare
                                </dt>
                                <dd>
                                    {peso(a.estimated_fare)}
                                    {a.estimated_distance
                                        ? ` · ${a.estimated_distance} km`
                                        : ''}
                                </dd>
                            </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {a.passenger_phone && (
                                <a
                                    href={`tel:${a.passenger_phone}`}
                                    className={`${btn} inline-flex items-center gap-2 bg-m-forest text-white hover:bg-m-forest-hover ${ring}`}
                                >
                                    <Phone className="size-4" aria-hidden />{' '}
                                    {a.service_type === 'MIGODALA' ? 'Call sender' : 'Call passenger'}
                                </a>
                            )}
                            {a.service_type === 'MIGODALA' && a.recipient_phone && (
                                <a
                                    href={`tel:${a.recipient_phone}`}
                                    className={`${btn} inline-flex items-center gap-2 border border-m-forest text-m-forest hover:bg-m-forest/5 ${ring}`}
                                >
                                    <Phone className="size-4" aria-hidden />{' '}
                                    Call recipient
                                </a>
                            )}
                            {a.status === 'rider_assigned' && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => act(`bookings/${a.id}/arrived`)}
                                    className={`${btn} bg-[#16A36A] text-white hover:bg-[#117A50] ${ring}`}
                                >
                                    I've Arrived
                                </button>
                            )}
                            {a.status === 'rider_arrived' && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => act(`bookings/${a.id}/start`)}
                                    className={`${btn} bg-[#16A36A] text-white hover:bg-[#117A50] ${ring}`}
                                >
                                    Start Trip
                                </button>
                            )}
                            {a.status === 'in_progress' && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setConfirm('complete')}
                                    className={`${btn} bg-m-forest text-white hover:bg-m-forest-hover ${ring}`}
                                >
                                    Complete Trip
                                </button>
                            )}
                            {a.status !== 'in_progress' && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setConfirm('cancel')}
                                    className={`${btn} border border-[var(--b-line)] text-m-red hover:bg-m-red/5 ${ring}`}
                                >
                                    Cancel booking
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {showMap && (
                    <section className={`${card} overflow-hidden p-3`}>
                        <LiveRideMap
                            pickup={
                                a?.pickup_lat != null && a.pickup_lng != null
                                    ? { lat: a.pickup_lat, lng: a.pickup_lng }
                                    : null
                            }
                            destination={
                                a?.destination_lat != null &&
                                a.destination_lng != null
                                    ? {
                                          lat: a.destination_lat,
                                          lng: a.destination_lng,
                                      }
                                    : null
                            }
                            rider={state?.location ?? null}
                            wheelZoom
                        />
                    </section>
                )}

                {state?.to_rate && (
                    <section
                        className={`${card} p-5`}
                        aria-labelledby="rate-passenger"
                    >
                        <h2
                            id="rate-passenger"
                            className="text-base font-semibold text-[var(--b-ink)]"
                        >
                            Trip completed
                            {state.to_rate.final_fare != null
                                ? ` · collect ${peso(state.to_rate.final_fare)}`
                                : ''}
                        </h2>
                        <p className="mt-1 text-sm text-[var(--b-muted)]">
                            Rate {state.to_rate.passenger_name ?? 'the passenger'}
                        </p>
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
                                    className={`rounded ${ring}`}
                                >
                                    <Star
                                        className={`size-8 ${n <= stars ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[var(--b-faint)]'}`}
                                        aria-hidden
                                    />
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            disabled={busy || !stars}
                            onClick={async () => {
                                await act(`bookings/${state.to_rate!.id}/rate`, {
                                    rating: stars,
                                });
                                setStars(0);
                            }}
                            className={`${btn} mt-3 bg-m-forest text-white hover:bg-m-forest-hover ${ring}`}
                        >
                            Submit rating
                        </button>
                    </section>
                )}

                {online && !a && (
                    <section aria-live="polite" className="space-y-3">
                        {offers.length === 0 ? (
                            <p
                                className={`${card} p-6 text-center text-sm text-[var(--b-muted)]`}
                            >
                                <Bell
                                    className="mx-auto mb-2 size-5 motion-safe:animate-pulse"
                                    aria-hidden
                                />
                                Waiting for nearby ride requests...
                            </p>
                        ) : (
                            offers.map((o) => {
                                const left = Math.max(
                                    0,
                                    Math.ceil(
                                        ((deadlines[o.id] ?? 0) - Date.now()) /
                                            1000,
                                    ),
                                );
                                const pct = Math.min(
                                    100,
                                    (left / (totals.current[o.id] ?? Math.max(left, 1))) *
                                        100,
                                );
                                return (
                                    <article
                                        key={o.id}
                                        className="overflow-hidden rounded-xl border-2 border-m-green bg-[var(--b-card)] shadow-md"
                                    >
                                        <div
                                            className="h-1.5 bg-m-green/15"
                                            aria-hidden
                                        >
                                            <div
                                                className={`h-full transition-[width] duration-1000 ease-linear ${left <= 5 ? 'bg-[#DC2626]' : 'bg-[#16A36A]'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <div className="p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-m-greentext">
                                                        NEW RIDE REQUEST!
                                                    </h3>
                                                    <p className="text-xs text-[var(--b-muted)]">
                                                        A passenger nearby is
                                                        looking for a rider.
                                                    </p>
                                                </div>
                                                <span
                                                    className="rounded-full bg-[#F59E0B]/15 px-3 py-1 text-sm font-semibold text-m-amber"
                                                    aria-label={`${left} seconds left`}
                                                >
                                                    {left}s
                                                </span>
                                            </div>
                                            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                                                <div>
                                                    <dt className="text-xs text-[var(--b-muted)]">
                                                        Pickup distance
                                                    </dt>
                                                    <dd className="font-medium">
                                                        {metres(
                                                            o.distance_to_pickup,
                                                        )}{' '}
                                                        · about{' '}
                                                        {o.estimated_pickup_time}{' '}
                                                        min
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-[var(--b-muted)]">
                                                        Service
                                                    </dt>
                                                    <dd className="font-medium">
                                                        {o.service_label}
                                                        {o.service_type === 'MIGODALA'
                                                            ? o.item_description
                                                                ? ` · ${o.item_description}${o.package_size ? ` (${o.package_size})` : ''}${o.delivery_vehicle ? ` · by ${o.delivery_vehicle === 'four_wheel' ? 'car' : 'motorcycle'}` : ''}`
                                                                : ''
                                                            : o.passenger_count
                                                              ? ` · ${o.passenger_count} passenger${o.passenger_count === 1 ? '' : 's'}`
                                                              : ''}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-[var(--b-muted)]">
                                                        Estimated fare
                                                    </dt>
                                                    <dd className="font-medium">
                                                        {peso(o.estimated_fare)}
                                                        {o.estimated_distance
                                                            ? ` · ${o.estimated_distance} km trip`
                                                            : ''}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2">
                                                    <MapPin
                                                        className="mt-0.5 size-4 shrink-0 text-m-green"
                                                        aria-hidden
                                                    />
                                                    <div>
                                                        <dt className="text-xs text-[var(--b-muted)]">
                                                            Pickup
                                                        </dt>
                                                        <dd>{o.pickup_location}</dd>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <MapPin
                                                        className="mt-0.5 size-4 shrink-0 text-m-red"
                                                        aria-hidden
                                                    />
                                                    <div>
                                                        <dt className="text-xs text-[var(--b-muted)]">
                                                            Destination
                                                        </dt>
                                                        <dd>{o.destination}</dd>
                                                    </div>
                                                </div>
                                            </dl>
                                            <div className="mt-4 flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        act(`offers/${o.id}/accept`)
                                                    }
                                                    className={`${btn} flex-1 bg-[#16A36A] text-white hover:bg-[#117A50] ${ring}`}
                                                >
                                                    ACCEPT RIDE
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        act(
                                                            `offers/${o.id}/decline`,
                                                        )
                                                    }
                                                    className={`${btn} inline-flex items-center gap-1 border border-[var(--b-line)] text-[var(--b-muted)] hover:bg-[var(--b-page)] ${ring}`}
                                                >
                                                    <X
                                                        className="size-4"
                                                        aria-hidden
                                                    />{' '}
                                                    DECLINE
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </section>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--b-muted)]">
                    <span>
                        Keep this page open to receive requests. Closing the
                        page stops them.
                    </span>
                    {perm === 'granted' && (
                        <span className="inline-flex items-center gap-1 text-m-greentext">
                            <Bell className="size-3" aria-hidden /> Background
                            alerts on
                        </span>
                    )}
                    {perm === 'default' && (
                        <button
                            type="button"
                            onClick={askPermission}
                            className={`inline-flex items-center gap-1 rounded font-semibold text-[var(--b-accent)] underline ${ring}`}
                        >
                            <Bell className="size-3" aria-hidden /> Turn on
                            background alerts
                        </button>
                    )}
                    {perm === 'denied' && (
                        <span className="inline-flex items-center gap-1 text-m-redtext">
                            <BellOff className="size-3" aria-hidden />{' '}
                            Background alerts are blocked in your browser
                            settings
                        </span>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={confirm === 'complete'}
                title="Complete this trip?"
                description="Confirm only when the passenger has reached the destination."
                confirmLabel="Complete trip"
                cancelLabel="Not yet"
                busy={busy}
                onConfirm={runConfirmed}
                onCancel={() => setConfirm(null)}
            />
            <ConfirmDialog
                open={confirm === 'cancel'}
                title="Cancel this booking?"
                description="This releases the booking and cannot be undone."
                confirmLabel="Cancel booking"
                tone="danger"
                busy={busy}
                onConfirm={runConfirmed}
                onCancel={() => setConfirm(null)}
            />
        </BikerShell>
    );
}
