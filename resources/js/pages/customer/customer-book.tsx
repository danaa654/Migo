import { Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Clock,
    Crosshair,
    Headset,
    Lightbulb,
    MapPin,
    PhilippinePeso,
    Repeat2,
    Route,
    ShieldCheck,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MigoCustomerLogin from '@/components/migo-customer-login';
import BookingDetails from '@/components/booking-details';
import CustomerShell from '@/components/customer-shell';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import LocationPicker, {
    type Mode,
    type Point,
} from '@/components/location-picker';
import ServiceFields from '@/components/service-fields';
import type { ServiceData } from '@/components/service-fields';
import ServicePicker from '@/components/service-picker';
import { useNearbyRiders } from '@/hooks/use-nearby-riders';
import { PACKAGE_SIZE_LABEL, serviceMeta } from '@/lib/services';
import type { ServiceInfo, ServiceKey } from '@/lib/services';

type Booking = {
    id: string;
    pickup_location: string;
    destination: string;
    booking_status: string;
};
/** Fare quote from the server (GET /book/quote). The same backend rules are applied again when the booking is saved. */
type Quote = {
    distance_km: number;
    minutes: number;
    base_fare: number;
    base_km: number;
    extra_km: number;
    per_km: number;
    extra_charge: number;
    other_charges: number;
    total: number;
};
type QuoteState = {
    quote: Quote | null;
    loading: boolean;
    error: string | null;
};

/** Asks the server for the fare whenever both pins are set (waits 250 ms so dragging a pin does not flood it). */
function useFareQuote(
    pickup: Point | null,
    destination: Point | null,
    service: ServiceKey | null,
): QuoteState {
    const key =
        pickup && destination && service
            ? `${service},${pickup.lat},${pickup.lng},${destination.lat},${destination.lng}`
            : null;
    const [res, setRes] = useState<{
        key: string;
        quote: Quote | null;
        error: string | null;
    } | null>(null);

    useEffect(() => {
        if (!pickup || !destination || !key || !service) {
            return;
        }

        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            const qs = new URLSearchParams({
                service_type: service,
                pickup_lat: String(pickup.lat),
                pickup_lng: String(pickup.lng),
                destination_lat: String(destination.lat),
                destination_lng: String(destination.lng),
            });

            try {
                const r = await fetch(`/book/quote?${qs}`, {
                    headers: { Accept: 'application/json' },
                    signal: ctrl.signal,
                });
                const body = await r.json().catch(() => null);

                setRes(
                    r.ok
                        ? { key, quote: body as Quote, error: null }
                        : {
                              key,
                              quote: null,
                              error:
                                  body?.message ??
                                  'We could not calculate the fare. Please try again.',
                          },
                );
            } catch (e) {
                if ((e as Error).name !== 'AbortError') {
                    setRes({
                        key,
                        quote: null,
                        error: 'We could not calculate the fare. Check your connection and try again.',
                    });
                }
            }
        }, 250);

        return () => {
            clearTimeout(timer);
            ctrl.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    if (!key) {
        return { quote: null, loading: false, error: null };
    }

    if (!res || res.key !== key) {
        return { quote: null, loading: true, error: null };
    }

    return { quote: res.quote, loading: false, error: res.error };
}

const km1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const peso = (n: number) =>
    `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Props = {
    /** The three services (names, capacity and starting fare come from the server settings). */
    services: ServiceInfo[];
    /** Set when the page was opened with ?service=...; otherwise the customer first sees the service selection. */
    initialService?: ServiceKey | null;
    status?: string | null;
    canBook: boolean;
    accountStatus: string;
    active: Booking | null;
    /** True on the public /book page: nothing is saved until the person signs in. */
    guest?: boolean;
};

type Form = ServiceData & {
    service_type: ServiceKey | '';
    pickup_location: string;
    destination: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
    destination_lat: number | null;
    destination_lng: number | null;
};

const EMPTY_FORM: Form = {
    service_type: '',
    passenger_count: 1,
    notes: '',
    recipient_name: '',
    recipient_phone: '',
    item_description: '',
    package_size: '',
    pickup_location: '',
    destination: '',
    pickup_lat: null,
    pickup_lng: null,
    destination_lat: null,
    destination_lng: null,
};

// A guest's pickup and destination are kept in this browser tab while they sign in, then restored (max 1 hour).
const DRAFT_KEY = 'migo.bookingDraft';

function readDraft(): Form | null {
    try {
        const raw = window.sessionStorage.getItem(DRAFT_KEY);

        if (!raw) {
            return null;
        }

        const saved = JSON.parse(raw) as { savedAt: number; data: Form };

        return Date.now() - saved.savedAt < 3_600_000 ? saved.data : null;
    } catch {
        return null; // storage unavailable: the person simply picks the places again
    }
}

function saveDraft(data: Form) {
    try {
        window.sessionStorage.setItem(
            DRAFT_KEY,
            JSON.stringify({ savedAt: Date.now(), data }),
        );
    } catch {
        // storage unavailable: the person simply picks the places again
    }
}

function clearDraft() {
    try {
        window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
        // nothing to clear
    }
}

const card =
    'rounded-3xl border border-m-line bg-m-card p-4 shadow-sm sm:p-6';

const stepsFor = (service: ServiceKey | null) =>
    service === 'MIGODALA'
        ? [
              { title: 'Pickup & Delivery', text: 'Where does it go?' },
              { title: 'Review & Confirm', text: 'Confirm your delivery' },
              { title: 'On its way!', text: 'Track your delivery' },
          ]
        : [
              { title: 'Pickup & Destination', text: 'Where are you going?' },
              { title: 'Review & Confirm', text: 'Confirm your ride' },
              { title: 'Get on your way!', text: 'Enjoy the ride' },
          ];

/**
 * The three booking steps as a horizontal stepper above the form. Signed-in customers already have the account sidebar,
 * so they see this on every screen size (no second side panel). Guests see it on phones/tablets only, next to StepsPanel.
 */
function MobileStepper({
    current,
    always = false,
    service,
}: {
    current: number;
    always?: boolean;
    service: ServiceKey | null;
}) {
    const STEPS = stepsFor(service);

    return (
        <ol
            aria-label="Booking progress"
            className={`flex items-start rounded-2xl border border-m-line bg-m-card px-3 py-3 shadow-sm sm:px-6 ${always ? '' : 'lg:hidden'}`}
        >
            {STEPS.map((st, i) => {
                const n = i + 1;
                const done = n < current;
                const active = n === current;

                return (
                    <li
                        key={st.title}
                        aria-current={active ? 'step' : undefined}
                        className="relative flex flex-1 flex-col items-center text-center"
                    >
                        {i > 0 && (
                            <span
                                aria-hidden
                                className={`absolute top-4 right-1/2 h-px w-full ${n <= current ? 'bg-m-forest' : 'bg-m-line2'}`}
                            />
                        )}
                        <span
                            className={`relative z-10 flex size-8 items-center justify-center rounded-full border text-sm font-semibold ${active || done ? 'border-m-forest bg-m-forest text-white' : 'border-m-line2 bg-m-card text-m-body'}`}
                        >
                            {done ? <Check className="size-4" aria-hidden /> : n}
                        </span>
                        <span
                            className={`mt-1.5 text-[11px] leading-tight font-semibold ${active ? 'text-m-ink' : 'text-m-muted'}`}
                        >
                            {st.title}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

/** Left panel: the three booking steps over the side illustration (public/img/side.webp). */
function StepsPanel({
    current,
    service,
}: {
    current: number;
    service: ServiceKey | null;
}) {
    const STEPS = stepsFor(service);

    return (
        <aside className="relative hidden overflow-hidden rounded-3xl border border-m-line bg-m-mint lg:block">
            <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-[position:left_bottom] bg-no-repeat dark:opacity-40 dark:brightness-75"
                style={{ backgroundImage: 'url(/img/side.webp)' }}
            />
            <div className="relative flex h-full min-h-[30rem] flex-col p-5">
                <ol className="relative space-y-6">
                    <span
                        aria-hidden
                        className="absolute top-6 bottom-6 left-[17px] w-px bg-m-line2"
                    />
                    {STEPS.map((st, i) => {
                        const n = i + 1;
                        const done = n < current;
                        const active = n === current;

                        return (
                            <li
                                key={st.title}
                                aria-current={active ? 'step' : undefined}
                                className="relative flex items-start gap-3"
                            >
                                <span
                                    className={`z-10 flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${active || done ? 'border-m-forest bg-m-forest text-white' : 'border-m-line2 bg-m-card text-m-body'}`}
                                >
                                    {done ? (
                                        <Check className="size-4" aria-hidden />
                                    ) : (
                                        n
                                    )}
                                </span>
                                <span className="leading-tight">
                                    <span className="block text-sm font-semibold text-m-ink">
                                        {st.title}
                                    </span>
                                    <span className="mt-1 block text-xs text-m-muted">
                                        {st.text}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
                <div className="mt-auto flex items-center gap-3 rounded-2xl bg-m-card/85 p-4 shadow-sm backdrop-blur">
                    <ShieldCheck
                        className="size-8 shrink-0 text-m-accent"
                        aria-hidden
                    />
                    <p className="text-sm leading-snug font-medium text-m-body">
                        Safe. Reliable.
                        <br />
                        Always with you.
                    </p>
                </div>
            </div>
        </aside>
    );
}

/** Torn-paper edge: transparent half-circles cut along the top and bottom, so it works on any background. */
const RECEIPT_EDGE = [
    'radial-gradient(circle 7px at 9px 0, #0000 98%, #000) top / 18px 51% repeat-x',
    'radial-gradient(circle 7px at 9px 100%, #0000 98%, #000) bottom / 18px 51% repeat-x',
].join(', ');

const BOOK_FORM_ID = 'book-form';

function ReceiptRow({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-3 text-sm">
            <Icon className="size-5 shrink-0 text-m-accent" aria-hidden />
            <span className="flex-1 text-m-body2">{label}</span>
            <span className="font-semibold text-m-ink">{value}</span>
        </div>
    );
}

function ReceiptPlace({
    kind,
    text,
    delivery = false,
}: {
    kind: 'pickup' | 'destination';
    text: string;
    delivery?: boolean;
}) {
    return (
        <div className="flex items-start gap-3">
            <MapPin
                className={`mt-0.5 size-5 shrink-0 ${kind === 'pickup' ? 'text-m-green' : 'text-m-red'}`}
                fill="currentColor"
                fillOpacity={0.15}
                aria-hidden
            />
            <div className="min-w-0 text-sm leading-snug">
                <p className="font-semibold text-m-ink">
                    {kind === 'pickup'
                        ? 'Pickup'
                        : delivery
                          ? 'Delivery destination'
                          : 'Destination'}
                </p>
                <p
                    className={`line-clamp-3 ${text ? 'text-m-body2' : 'text-m-faint'}`}
                >
                    {text || 'Not set yet'}
                </p>
            </div>
        </div>
    );
}

/** The fare as a receipt, shown before the customer confirms. Replaces the old "Quick & Easy" card. */
function FareCard({
    fare,
    service,
    pickupText,
    destinationText,
    canConfirm,
    busy,
}: {
    fare: QuoteState;
    service: ServiceKey | null;
    pickupText: string;
    destinationText: string;
    canConfirm: boolean;
    busy: boolean;
}) {
    const { quote } = fare;
    const meta = serviceMeta(service);
    const delivery = service === 'MIGODALA';

    return (
        <div
            className="drop-shadow-md"
            role="status"
            aria-live="polite"
            aria-label="Fare breakdown"
        >
            <div
                className="overflow-hidden bg-m-card"
                style={{ WebkitMask: RECEIPT_EDGE, mask: RECEIPT_EDGE }}
            >
                <div className="flex items-center gap-3 bg-m-forest px-5 pt-6 pb-5 text-white">
                    <img
                        src="/favi.png"
                        alt=""
                        className="size-11 rounded-lg bg-white/10 object-contain p-0.5"
                    />
                    <div className="leading-tight">
                        <p className="text-xl font-bold tracking-wide">MIGO</p>
                        <p className="mt-0.5 text-xs text-white/80">
                            Ride Smarter. Go Further.
                        </p>
                    </div>
                </div>

                <div className="space-y-4 px-5 pt-4 pb-7">
                    <h2 className="text-lg font-bold text-m-ink">
                        {service ? `${meta.name} ` : ''}
                        {delivery ? 'Delivery Fare' : 'Fare Breakdown'}
                    </h2>

                    <div className="space-y-3 border-b border-dashed border-m-line2 pb-4">
                        <ReceiptPlace kind="pickup" text={pickupText} />
                        <ReceiptPlace
                            kind="destination"
                            text={destinationText}
                            delivery={delivery}
                        />
                    </div>

                    {quote ? (
                        <>
                            <div className="space-y-3 border-b border-dashed border-m-line2 pb-4">
                                <ReceiptRow
                                    icon={Route}
                                    label="Estimated distance"
                                    value={`≈ ${quote.distance_km.toFixed(1)} km`}
                                />
                                <ReceiptRow
                                    icon={Clock}
                                    label="Estimated travel time"
                                    value={`≈ ${quote.minutes} min`}
                                />
                            </div>

                            <div className="space-y-3 border-b border-dashed border-m-line2 pb-4">
                                <ReceiptRow
                                    icon={meta.icon}
                                    label={`Base fare (first ${km1(quote.base_km)} km)`}
                                    value={peso(quote.base_fare)}
                                />
                                <ReceiptRow
                                    icon={PhilippinePeso}
                                    label={`Additional distance (${quote.extra_km.toFixed(1)} km × ${peso(quote.per_km)})`}
                                    value={peso(quote.extra_charge)}
                                />
                                {quote.other_charges > 0 && (
                                    <ReceiptRow
                                        icon={PhilippinePeso}
                                        label="Other charges (minimum fare)"
                                        value={peso(quote.other_charges)}
                                    />
                                )}
                            </div>

                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-base leading-tight font-bold text-m-ink">
                                    {delivery
                                        ? 'Total Delivery Fare'
                                        : 'Total Estimated Fare'}
                                </span>
                                <span className="text-3xl font-bold text-m-accent">
                                    {peso(quote.total)}
                                </span>
                            </div>
                            <p className="text-xs leading-snug text-m-muted">
                                This is an estimate. The final fare can change a
                                little with the actual route.
                            </p>

                            {canConfirm && (
                                <button
                                    type="submit"
                                    form={BOOK_FORM_ID}
                                    disabled={busy}
                                    className="flex w-full items-center justify-center gap-2 rounded-full bg-m-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-m-forest-hover disabled:opacity-60"
                                >
                                    <ArrowRight
                                        className="size-4"
                                        aria-hidden
                                    />{' '}
                                    {delivery
                                        ? 'Confirm Delivery'
                                        : 'Confirm Booking'}
                                </button>
                            )}
                        </>
                    ) : fare.loading ? (
                        <p className="text-sm text-m-body2">
                            Calculating your fare…
                        </p>
                    ) : fare.error ? (
                        <p role="alert" className="text-sm text-m-redtext">
                            {fare.error}
                        </p>
                    ) : (
                        <p className="text-sm text-m-body2">
                            Pin your pickup and destination on the map to see
                            the total {delivery ? 'delivery ' : ''}fare before
                            you confirm.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Right panel: the fare estimate, why book with Migo, and a link to support. */
function InfoPanel({
    fare,
    service,
    pickupText,
    destinationText,
    canConfirm,
    busy,
    guest,
}: {
    fare: QuoteState;
    service: ServiceKey | null;
    pickupText: string;
    destinationText: string;
    canConfirm: boolean;
    busy: boolean;
    guest: boolean;
}) {
    const features = [
        { icon: Zap, title: 'Fast', text: 'Find a ride in seconds' },
        {
            icon: ShieldCheck,
            title: 'Secure',
            text: 'Verified & trusted riders',
        },
        { icon: MapPin, title: 'Reliable', text: 'Real-time tracking' },
    ];

    return (
        <aside
            className={`space-y-4 rounded-3xl border border-m-line bg-m-card p-3 shadow-sm xl:self-start ${guest ? 'lg:col-span-2 xl:col-span-1' : ''}`}
        >
            <FareCard
                fare={fare}
                service={service}
                pickupText={pickupText}
                destinationText={destinationText}
                canConfirm={canConfirm}
                busy={busy}
            />
            <ul className="grid gap-3 px-2 sm:grid-cols-3 xl:grid-cols-1">
                {features.map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-m-mint text-m-accent">
                            <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="leading-tight">
                            <span className="block text-sm font-semibold text-m-ink">
                                {title}
                            </span>
                            <span className="block text-xs text-m-muted">
                                {text}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
            <div className="mx-2 border-t border-m-line pt-3 pb-1">
                <Link
                    href="/#support"
                    className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-m-mint"
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-m-mint text-m-accent">
                        <Headset className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1 leading-tight">
                        <span className="block text-sm font-semibold text-m-ink">
                            Need help?
                        </span>
                        <span className="block text-xs text-m-muted">
                            Contact support
                        </span>
                    </span>
                    <ArrowRight className="size-4 text-m-muted" aria-hidden />
                </Link>
            </div>
        </aside>
    );
}
const label = (s: string) =>
    s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const message: Record<string, string> = {
    pending: 'We are starting your search.',
    searching_for_rider: 'Finding nearby riders...',
    rider_assigned: 'A rider has accepted your booking.',
    rider_arrived: 'Your rider has arrived at your pickup location.',
    in_progress: 'Your ride is in progress.',
};

const PHONE = /^(\+?63|0)?9\d{9}$/;

type ServiceErrors = Partial<Record<keyof ServiceData, string>>;

/** Same rules as App\Http\Requests\Customer\StoreBookingRequest; the server checks them again. */
function checkService(data: Form, info: ServiceInfo): ServiceErrors {
    const e: ServiceErrors = {};

    if (info.is_delivery) {
        if (data.recipient_name.trim().length < 2) {
            e.recipient_name = "Enter the recipient's name.";
        }

        if (!PHONE.test(data.recipient_phone.replace(/[\s\-().]/g, ''))) {
            e.recipient_phone =
                'Enter a valid Philippine mobile number, for example 0917 123 4567.';
        }

        if (data.item_description.trim().length < 3) {
            e.item_description = 'Describe what is being delivered.';
        }

        if (!data.package_size) {
            e.package_size = 'Choose the package size.';
        }
    } else if (
        !Number.isInteger(data.passenger_count) ||
        data.passenger_count < 1 ||
        data.passenger_count > info.max_passengers
    ) {
        e.passenger_count = `${info.name} carries 1 to ${info.max_passengers} passenger${info.max_passengers === 1 ? '' : 's'}.`;
    }

    return e;
}

/** Service, passengers or recipient and package, as shown in the review step. */
function ServiceSummary({ data, info }: { data: Form; info: ServiceInfo }) {
    const meta = serviceMeta(info.key);
    const Icon = meta.icon;
    const rows: [string, string][] = info.is_delivery
        ? [
              ['Recipient', data.recipient_name.trim()],
              ['Contact number', data.recipient_phone.trim()],
              ['Item', data.item_description.trim()],
              ['Package size', PACKAGE_SIZE_LABEL[data.package_size] ?? '—'],
          ]
        : [['Passengers', String(data.passenger_count)]];

    if (data.notes.trim()) {
        rows.push([info.is_delivery ? 'Delivery notes' : 'Pickup notes', data.notes.trim()]);
    }

    return (
        <div className="space-y-2 rounded-xl bg-m-mint px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-bold text-m-ink">
                <span className={`flex size-7 items-center justify-center rounded-full ${meta.tone}`}>
                    <Icon className="size-4" aria-hidden />
                </span>
                {meta.name}
                <span className="font-normal text-m-muted">· {meta.short}</span>
            </p>
            <dl className="space-y-1">
                {rows.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                        <dt className="shrink-0 text-m-body2">{k}</dt>
                        <dd className="text-right font-semibold break-words text-m-ink">{v}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

export default function CustomerBook({
    services,
    initialService = null,
    status,
    canBook,
    accountStatus,
    active,
    guest = false,
}: Props) {
    // A customer who has just signed in gets the places they chose as a guest back (and the service they picked).
    const [draft] = useState<Form | null>(() =>
        !guest && typeof window !== 'undefined' ? readDraft() : null,
    );
    const startService: ServiceKey | null =
        initialService ??
        (draft?.service_type && services.some((s) => s.key === draft.service_type)
            ? draft.service_type
            : null);
    const [service, setService] = useState<ServiceKey | null>(startService);
    const form = useForm<Form>({
        ...EMPTY_FORM,
        ...(draft ?? {}),
        service_type: startService ?? '',
    });
    const { data, setData } = form;
    const [reviewing, setReviewing] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);

    const info = services.find((s) => s.key === service) ?? null;
    const delivery = info?.is_delivery ?? false;
    const meta = serviceMeta(service);

    const pickup: Point | null =
        data.pickup_lat !== null && data.pickup_lng !== null
            ? { lat: data.pickup_lat, lng: data.pickup_lng }
            : null;
    const destination: Point | null =
        data.destination_lat !== null && data.destination_lng !== null
            ? { lat: data.destination_lat, lng: data.destination_lng }
            : null;

    const nearby = useNearbyRiders(service, pickup);
    const fareState = useFareQuote(pickup, destination, service);
    const quote = fareState.quote;

    // The places and every typed detail stay in the form while the customer moves between services.
    const chooseService = (key: ServiceKey) => {
        const chosen = services.find((s) => s.key === key);
        setService(key);
        form.clearErrors();
        setData((d) => ({
            ...d,
            service_type: key,
            passenger_count: Math.min(
                Math.max(1, d.passenger_count),
                Math.max(1, chosen?.max_passengers ?? 1),
            ),
        }));
    };
    const backToServices = () => {
        setReviewing(false);
        form.clearErrors();
        setService(null);
    };

    const onPick = (mode: Mode, point: Point, address: string) => {
        if (mode === 'pickup')
            setData((d) => ({
                ...d,
                pickup_location: address,
                pickup_lat: point.lat,
                pickup_lng: point.lng,
            }));
        else
            setData((d) => ({
                ...d,
                destination: address,
                destination_lat: point.lat,
                destination_lng: point.lng,
            }));
    };

    const onText = (mode: Mode, text: string) =>
        setData((d) =>
            mode === 'pickup'
                ? { ...d, pickup_location: text, pickup_lat: null, pickup_lng: null }
                : {
                      ...d,
                      destination: text,
                      destination_lat: null,
                      destination_lng: null,
                  },
        );
    const onSwap = () =>
        setData((d) => ({
            ...d,
            pickup_location: d.destination,
            destination: d.pickup_location,
            pickup_lat: d.destination_lat,
            pickup_lng: d.destination_lng,
            destination_lat: d.pickup_lat,
            destination_lng: d.pickup_lng,
        }));
    const locateRef = useRef<() => void>(() => {});
    const [locating, setLocating] = useState(false);

    const guestNotice = guest && (
        <p
            role="status"
            className="rounded-2xl border border-m-accent/30 bg-m-mint px-4 py-2.5 text-sm text-m-ink"
        >
            You are browsing as a guest. Plan your ride now: you only need to
            sign in when you book it.
        </p>
    );

    // Step 0: nothing is booked until a service is chosen.
    if (!active && canBook && !info) {
        return (
            <CustomerShell
                title="Book a Ride"
                status={status}
                guest={guest}
                wide
            >
                {guestNotice}
                <ServicePicker services={services} onChoose={chooseService} />
            </CustomerShell>
        );
    }

    const submitLabel = delivery ? 'Confirm Delivery' : 'Confirm Booking';

    return (
        <CustomerShell
            title="Book a Ride"
            status={status}
            guest={guest}
            wide
        >
            {/* Signed in: the account sidebar is the only side panel, so the steps run across the top. */}
            {!guest && (
                <MobileStepper current={reviewing ? 2 : 1} always service={service} />
            )}
            <div
                className={
                    guest
                        ? 'grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-stretch xl:grid-cols-[250px_minmax(0,1fr)_300px] xl:gap-5'
                        : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-5'
                }
            >
                {guest && <MobileStepper current={reviewing ? 2 : 1} service={service} />}
                {guest && <StepsPanel current={reviewing ? 2 : 1} service={service} />}

                <div
                    className={`flex min-w-0 flex-col gap-4 ${guest ? 'lg:min-h-[calc(100dvh-6.5rem)]' : ''}`}
                >
                    {guestNotice}

                    {active ? (
                        <section className={card}>
                            <h1 className="text-xl font-bold text-m-ink">
                                You have a booking in progress (
                                {label(active.booking_status)})
                            </h1>
                            <p className="mt-2 text-sm text-m-muted">
                                {message[active.booking_status]}
                            </p>
                            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                                <div className="rounded-2xl bg-m-mint p-4">
                                    <dt className="font-medium text-m-muted">
                                        Pickup
                                    </dt>
                                    <dd className="mt-1 font-semibold text-m-ink">
                                        {active.pickup_location}
                                    </dd>
                                </div>
                                <div className="rounded-2xl bg-m-mint p-4">
                                    <dt className="font-medium text-m-muted">
                                        Destination
                                    </dt>
                                    <dd className="mt-1 font-semibold text-m-ink">
                                        {active.destination}
                                    </dd>
                                </div>
                            </dl>
                            <Link
                                href={`/customer/ride/${active.id}`}
                                className="mt-5 inline-block rounded-full bg-m-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-m-forest-hover"
                            >
                                View ride status
                            </Link>
                        </section>
                    ) : !canBook ? (
                        <p
                            role="alert"
                            className="rounded-2xl border border-m-red/30 bg-m-red/5 px-4 py-3 text-sm text-m-redtext"
                        >
                            Your account is {accountStatus}, so booking is
                            unavailable. Please contact an administrator if you
                            have questions.
                        </p>
                    ) : (
                        <form
                            id={BOOK_FORM_ID}
                            onSubmit={(e) => {
                                e.preventDefault();
                                // Show a preview first; if the addresses are obviously incomplete, submit so the server shows what is missing.
                                const complete =
                                    data.pickup_location.trim().length >= 5 &&
                                    data.destination.trim().length >= 5;
                                const svcErrors = info ? checkService(data, info) : {};

                                if (complete && !destination) {
                                    // The fare is calculated from the destination pin, so it must be on the map.
                                    form.clearErrors();
                                    form.setError(
                                        'destination',
                                        'Pin your destination on the map (search a place or click the map) so we can show your fare.',
                                    );
                                } else if (complete && Object.keys(svcErrors).length) {
                                    form.clearErrors();
                                    form.setError(svcErrors);
                                } else if (complete) {
                                    form.clearErrors();
                                    setReviewing(true);
                                } else if (guest) {
                                    // Guests cannot post yet, so show what is missing here.
                                    form.clearErrors();

                                    if (data.pickup_location.trim().length < 5) {
                                        form.setError(
                                            'pickup_location',
                                            'Please set your pickup location.',
                                        );
                                    }

                                    if (data.destination.trim().length < 5) {
                                        form.setError(
                                            'destination',
                                            'Please set your destination.',
                                        );
                                    }
                                } else {
                                    form.post('/customer/bookings');
                                }
                            }}
                            className={`${card} flex min-h-0 flex-1 flex-col gap-4`}
                            noValidate
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <h1 className="text-xl font-bold text-m-ink sm:text-2xl">
                                            {delivery
                                                ? 'Send with MigoDala'
                                                : `Book ${meta.name}`}
                                        </h1>
                                        <span className="inline-block rounded-full bg-m-mint px-2.5 py-0.5 text-xs font-semibold text-m-accent">
                                            Step 1 of 3
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-sm text-m-muted">
                                        {delivery
                                            ? 'Set the pickup and delivery places, then add the recipient and package details.'
                                            : 'Enter your pickup and destination to get started.'}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={backToServices}
                                        className="inline-flex items-center gap-2 rounded-full border border-m-line2 px-3.5 py-2 text-sm font-semibold text-m-body transition hover:bg-m-mint"
                                    >
                                        <Repeat2 className="size-4" aria-hidden />{' '}
                                        Change service
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => locateRef.current()}
                                        disabled={locating}
                                        className="inline-flex items-center gap-2 rounded-full border border-m-accent px-3.5 py-2 text-sm font-semibold text-m-accent transition hover:bg-m-mint disabled:opacity-60"
                                    >
                                        <Crosshair className="size-4" aria-hidden />{' '}
                                        {locating ? 'Detecting…' : 'Use my location'}
                                    </button>
                                </div>
                            </div>

                            <LocationPicker
                                pickup={pickup}
                                destination={destination}
                                pickupText={data.pickup_location}
                                destinationText={data.destination}
                                destinationLabel={
                                    delivery ? 'Delivery destination' : 'Destination'
                                }
                                onPick={onPick}
                                onText={onText}
                                onClear={(m) => onText(m, '')}
                                onSwap={onSwap}
                                errors={{
                                    pickup:
                                        form.errors.pickup_location ||
                                        form.errors.pickup_lat,
                                    destination:
                                        form.errors.destination ||
                                        form.errors.destination_lat,
                                }}
                                registerLocate={(fn) => {
                                    locateRef.current = fn;
                                }}
                                onLocating={setLocating}
                                nearby={nearby}
                                nearbyService={service}
                                fill
                            />

                            {info && (
                                <ServiceFields
                                    service={info}
                                    data={data}
                                    errors={form.errors}
                                    onChange={(k, v) => setData((d) => ({ ...d, [k]: v }))}
                                />
                            )}

                            {quote && (
                                <p
                                    role="status"
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-m-accent/30 bg-m-mint px-4 py-2.5 text-sm text-m-ink xl:hidden"
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        <PhilippinePeso
                                            className="size-5 text-m-accent"
                                            aria-hidden
                                        />
                                        {delivery
                                            ? 'Total delivery fare'
                                            : 'Total estimated fare'}{' '}
                                        · ≈ {quote.distance_km.toFixed(1)} km
                                    </span>
                                    <span className="text-lg font-bold">
                                        {peso(quote.total)}
                                    </span>
                                </p>
                            )}

                            <p className="flex items-start gap-3 rounded-2xl bg-m-mint px-4 py-2.5 text-sm text-m-body">
                                <Lightbulb
                                    className="mt-0.5 size-5 shrink-0 text-m-accent"
                                    aria-hidden
                                />
                                {delivery
                                    ? 'Only accredited Migo riders can accept your delivery. You can cancel it until a rider accepts.'
                                    : 'Only accredited Migo riders can accept your request. You can cancel it until a rider accepts.'}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={backToServices}
                                    className="inline-flex items-center gap-2 rounded-full border-2 border-m-line2 px-5 py-2.5 text-sm font-semibold text-m-body transition hover:bg-m-mint"
                                >
                                    <ArrowLeft className="size-4" aria-hidden />{' '}
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className="inline-flex items-center gap-2 rounded-full bg-m-forest px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-m-forest-hover disabled:opacity-60"
                                >
                                    {delivery ? 'Review Delivery' : 'Review Booking'}{' '}
                                    <ArrowRight className="size-4" aria-hidden />
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <InfoPanel
                    fare={fareState}
                    service={service}
                    pickupText={data.pickup_location}
                    destinationText={data.destination}
                    canConfirm={!active && canBook && !!quote}
                    busy={form.processing}
                    guest={guest}
                />
            </div>

            <Dialog
                open={reviewing}
                onOpenChange={(o) => {
                    if (!form.processing) setReviewing(o);
                }}
            >
                <DialogContent
                    className="max-h-[90vh] overflow-y-auto border-m-line bg-m-card text-m-body sm:max-w-lg"
                    style={{ fontFamily: 'Inter, Arial, sans-serif' }}
                >
                    <DialogHeader>
                        <DialogTitle>
                            {delivery ? 'Review your delivery' : 'Review your booking'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-m-muted">
                            {delivery
                                ? 'Check the places, recipient and package before sending the request.'
                                : 'Check your pickup and destination before sending the request.'}
                        </DialogDescription>
                    </DialogHeader>
                    {info && <ServiceSummary data={data} info={info} />}
                    <BookingDetails
                        pickupText={data.pickup_location}
                        destinationText={data.destination}
                        pickup={pickup}
                        destination={destination}
                    />
                    {quote ? (
                        <dl className="space-y-1.5 rounded-xl bg-m-mint px-4 py-3 text-sm">
                            <div className="flex justify-between gap-3">
                                <dt className="text-m-body2">
                                    Estimated distance · time
                                </dt>
                                <dd className="font-semibold text-m-ink">
                                    ≈ {quote.distance_km.toFixed(1)} km · ≈{' '}
                                    {quote.minutes} min
                                </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-m-body2">
                                    Base fare (first {km1(quote.base_km)} km)
                                </dt>
                                <dd className="font-semibold text-m-ink">
                                    {peso(quote.base_fare)}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-m-body2">
                                    Additional distance (
                                    {quote.extra_km.toFixed(1)} km)
                                </dt>
                                <dd className="font-semibold text-m-ink">
                                    {peso(quote.extra_charge)}
                                </dd>
                            </div>
                            {quote.other_charges > 0 && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-m-body2">
                                        Other charges
                                    </dt>
                                    <dd className="font-semibold text-m-ink">
                                        {peso(quote.other_charges)}
                                    </dd>
                                </div>
                            )}
                            <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-m-line2 pt-2">
                                <dt className="font-bold text-m-ink">
                                    {delivery
                                        ? 'Total Delivery Fare'
                                        : 'Total Estimated Fare'}
                                </dt>
                                <dd className="text-2xl font-bold text-m-accent">
                                    {peso(quote.total)}
                                </dd>
                            </div>
                        </dl>
                    ) : (
                        <p
                            role="alert"
                            className="rounded-xl bg-m-mint px-4 py-3 text-sm text-m-redtext"
                        >
                            {fareState.error ??
                                'Calculating your fare…'}
                        </p>
                    )}
                    <DialogFooter className="gap-2">
                        <button
                            type="button"
                            onClick={() => setReviewing(false)}
                            disabled={form.processing}
                            className="rounded-md border border-m-line px-4 py-2 text-sm font-medium transition hover:bg-m-page disabled:opacity-60"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            disabled={form.processing || !quote}
                            onClick={() => {
                                if (guest) {
                                    // Keep the places and details, then ask the guest to sign in.
                                    saveDraft(data);
                                    setReviewing(false);
                                    setLoginOpen(true);

                                    return;
                                }

                                clearDraft();
                                form.post('/customer/bookings', {
                                    onError: () => setReviewing(false),
                                });
                            }}
                            className="rounded-md bg-m-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-m-forest-hover disabled:opacity-60"
                        >
                            {guest
                                ? 'Sign in to book'
                                : form.processing
                                  ? 'Requesting…'
                                  : submitLabel}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {guest && (
                <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
                    <DialogContent
                        className="max-h-[90vh] overflow-y-auto border-m-line bg-m-card text-m-body sm:max-w-md"
                        style={{ fontFamily: 'Inter, Arial, sans-serif' }}
                    >
                        <DialogHeader>
                            <DialogTitle>
                                {delivery
                                    ? 'Sign in to send your delivery'
                                    : 'Sign in to book your ride'}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-m-muted">
                                Your places and details are saved. Sign in
                                with Google or your phone number and you will
                                come right back here to confirm.
                            </DialogDescription>
                        </DialogHeader>
                        <MigoCustomerLogin showGuest={false} />
                    </DialogContent>
                </Dialog>
            )}
        </CustomerShell>
    );
}