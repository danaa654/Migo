import { Link, router } from '@inertiajs/react';
import { ArrowRight, Car, MapPin } from 'lucide-react';
import { useState } from 'react';
import BookingDetails from '@/components/booking-details';
import ConfirmDialog from '@/components/confirm-dialog';
import CustomerShell from '@/components/customer-shell';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { Point } from '@/components/location-picker';
import { PACKAGE_SIZE_LABEL, serviceKeyOf, serviceMeta } from '@/lib/services';
import {
    ACTIVE,
    CANCELLABLE,
    peso,
    statusOf,
    TRACKABLE,
    when,
} from '@/lib/booking-status';

type Booking = {
    id: string;
    booking_reference?: string | null;
    pickup_location: string;
    destination: string;
    booking_status: string;
    booking_date: string | null;
    created_at: string;
    pickup_lat: number | string | null;
    pickup_lng: number | string | null;
    destination_lat: number | string | null;
    destination_lng: number | string | null;
    estimated_distance: number | null;
    estimated_duration: number | null;
    estimated_fare: number | null;
    final_fare: number | null;
    /** MIGOMOTO | MIGOCARS | MIGODALA (rows from before services existed are MigoMoto). */
    service_type?: string | null;
    passenger_count?: number | null;
    notes?: string | null;
    recipient_name?: string | null;
    recipient_phone?: string | null;
    item_description?: string | null;
    package_size?: string | null;
};
type Props = { status?: string | null; bookings: Booking[] };
type Filter = 'all' | 'active' | 'completed' | 'cancelled';

const point = (
    lat: number | string | null,
    lng: number | string | null,
): Point | null =>
    lat !== null && lng !== null && lat !== '' && lng !== ''
        ? { lat: Number(lat), lng: Number(lng) }
        : null;

const TABS: { key: Filter; label: string; test: (s: string) => boolean }[] = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'active', label: 'Active', test: (s) => ACTIVE.includes(s) },
    { key: 'completed', label: 'Completed', test: (s) => s === 'completed' },
    {
        key: 'cancelled',
        label: 'Cancelled',
        test: (s) =>
            ['cancelled_by_passenger', 'cancelled_by_rider', 'no_rider_found', 'expired'].includes(s),
    },
];

const isDelivery = (b: Booking) => serviceKeyOf(b.service_type) === 'MIGODALA';

/** One line of passenger or delivery information for the list. */
const infoLine = (b: Booking): string =>
    isDelivery(b)
        ? [
              b.recipient_name ? `To ${b.recipient_name}` : null,
              b.item_description,
              b.package_size ? `${PACKAGE_SIZE_LABEL[b.package_size] ?? b.package_size} package` : null,
          ]
              .filter(Boolean)
              .join(' · ')
        : `${b.passenger_count ?? 1} passenger${(b.passenger_count ?? 1) === 1 ? '' : 's'}`;

function ServiceChip({ type }: { type?: string | null }) {
    const m = serviceMeta(type);
    const Icon = m.icon;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.chip}`}
        >
            <Icon className="size-3.5" aria-hidden />
            {m.name}
        </span>
    );
}

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

function Row({ k, v }: { k: string; v?: string | null }) {
    return v ? (
        <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-m-body2">{k}</dt>
            <dd className="text-right font-semibold break-words text-m-ink">{v}</dd>
        </div>
    ) : null;
}

export default function CustomerBookings({ status, bookings }: Props) {
    const [selected, setSelected] = useState<Booking | null>(null);
    const [toCancel, setToCancel] = useState<Booking | null>(null);
    const [filter, setFilter] = useState<Filter>('all');
    const [busy, setBusy] = useState(false);

    const tab = TABS.find((t) => t.key === filter)!;
    const shown = bookings.filter((b) => tab.test(b.booking_status));
    const count = (k: Filter) =>
        bookings.filter((b) => TABS.find((t) => t.key === k)!.test(b.booking_status)).length;

    const confirmCancel = () => {
        if (!toCancel) return;
        setBusy(true);
        router.post(
            `/customer/bookings/${toCancel.id}/cancel`,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    setToCancel(null);
                },
            },
        );
    };

    return (
        <CustomerShell title="My Bookings" status={status}>
            <div className="space-y-4 rounded-3xl border border-m-line bg-m-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-m-ink">
                        My Bookings
                    </h1>
                    <p className="mt-1 text-sm text-m-muted">
                        Your rides and deliveries, and their status.
                    </p>
                </div>
                <Link
                    href="/customer/book"
                    className={`rounded-full bg-m-forest px-5 py-2 text-sm font-bold text-white transition hover:bg-m-forest-hover ${ring}`}
                >
                    Book a ride
                </Link>
            </div>

            <div role="tablist" aria-label="Filter bookings" className="flex gap-1 overflow-x-auto">
                {TABS.map((t) => {
                    const on = filter === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => setFilter(t.key)}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${ring} ${
                                on ? 'bg-m-forest text-white' : 'text-m-body hover:bg-m-mint'
                            }`}
                        >
                            {t.label}
                            <span className={`rounded-full px-1.5 text-xs ${on ? 'bg-white/20' : 'bg-m-soft text-m-muted'}`}>
                                {count(t.key)}
                            </span>
                        </button>
                    );
                })}
            </div>
            </div>

            <section className="relative isolate overflow-hidden rounded-3xl border border-m-line bg-m-card shadow-sm">
                <div
                    aria-hidden
                    className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat dark:brightness-50"
                    style={{ backgroundImage: 'url(/img/bgmybooking.png)' }}
                />
                {/* Soft wash so booking rows stay readable; lighter when empty so the picture shows. */}
                <div
                    aria-hidden
                    className={`absolute inset-0 -z-10 ${shown.length === 0 ? 'bg-m-card/20' : 'bg-m-card/85'}`}
                />
                {shown.length === 0 ? (
                    <div className="flex min-h-[26rem] flex-col items-center justify-center px-6 py-10 text-center sm:min-h-[32rem]"><div className="flex max-w-md flex-col items-center rounded-2xl bg-m-card/70 px-6 py-5 backdrop-blur-sm">
                        <p className="text-xl font-bold text-m-forest dark:text-m-ink">
                            {bookings.length === 0 ? 'No bookings yet' : 'Nothing in this tab'}
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-m-muted">
                            {bookings.length === 0
                                ? 'Book your first ride or delivery and it will show up here with its live status.'
                                : 'Try another filter to see your other bookings.'}
                        </p>
                        {bookings.length === 0 && (
                            <Link
                                href="/customer/book"
                                className={`mt-5 inline-flex items-center gap-2 rounded-full bg-m-forest px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-m-forest-hover ${ring}`}
                            >
                                <Car className="size-4" aria-hidden />
                                Book a ride
                                <ArrowRight className="size-4" aria-hidden />
                            </Link>
                        )}
                        </div>
                    </div>
                ) : (
                    <ul className="divide-y divide-m-line">
                        {shown.map((b) => {
                            const st = statusOf(b.booking_status);
                            return (
                                <li key={b.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <ServiceChip type={b.service_type} />
                                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.tone}`}>
                                                {st.label}
                                            </span>
                                            {b.booking_reference && (
                                                <span className="text-xs font-medium text-m-muted">
                                                    {b.booking_reference}
                                                </span>
                                            )}
                                            <span className="text-xs text-m-muted">{when(b)}</span>
                                        </div>
                                        <p className="flex items-start gap-1.5 text-sm">
                                            <MapPin className="mt-0.5 size-4 shrink-0 text-m-green" aria-hidden />
                                            <span>{b.pickup_location}</span>
                                        </p>
                                        <p className="flex items-start gap-1.5 text-sm">
                                            <MapPin className="mt-0.5 size-4 shrink-0 text-m-red" aria-hidden />
                                            <span>{b.destination}</span>
                                        </p>
                                        <p className="pl-5.5 text-xs text-m-muted">
                                            {infoLine(b)}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                                        <span className="mr-auto text-base font-bold text-m-ink sm:mr-0">
                                            {peso(b.final_fare ?? b.estimated_fare)}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelected(b)}
                                                className={`rounded-md border border-m-accent px-3 py-1.5 text-xs font-medium text-m-accent transition hover:bg-m-forest/5 ${ring}`}
                                            >
                                                View
                                            </button>
                                            {TRACKABLE.includes(b.booking_status) && (
                                                <Link
                                                    href={`/customer/ride/${b.id}`}
                                                    className={`rounded-md bg-m-forest px-3 py-1.5 text-xs font-medium text-white transition hover:bg-m-forest-hover ${ring}`}
                                                >
                                                    Track
                                                </Link>
                                            )}
                                            {CANCELLABLE.includes(b.booking_status) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setToCancel(b)}
                                                    className={`rounded-md border border-m-line px-3 py-1.5 text-xs font-medium text-m-red transition hover:bg-m-red/5 ${ring}`}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <ConfirmDialog
                open={!!toCancel}
                title="Cancel this booking?"
                description="Your booking will be cancelled and any rider heading to you will be notified."
                confirmLabel="Cancel booking"
                cancelLabel="Keep it"
                tone="danger"
                busy={busy}
                onConfirm={confirmCancel}
                onCancel={() => setToCancel(null)}
            />

            <Dialog
                open={!!selected}
                onOpenChange={(o) => {
                    if (!o) setSelected(null);
                }}
            >
                <DialogContent
                    className="max-h-[90vh] overflow-y-auto border-m-line bg-m-card text-m-body sm:max-w-lg"
                    style={{ fontFamily: 'Inter, Arial, sans-serif' }}
                >
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {serviceMeta(selected.service_type).name}
                                    <span className="text-sm font-normal text-m-muted">
                                        {isDelivery(selected) ? 'delivery' : 'ride'} details
                                    </span>
                                </DialogTitle>
                                <DialogDescription className="text-sm text-m-muted">
                                    {statusOf(selected.booking_status).label} ·{' '}
                                    {when(selected)}
                                </DialogDescription>
                            </DialogHeader>
                            <dl className="space-y-1.5 rounded-xl bg-m-mint px-4 py-3 text-sm">
                                {selected.estimated_distance != null && (
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-m-body2">
                                            Estimated distance · time
                                        </dt>
                                        <dd className="font-semibold text-m-ink">
                                            ≈{' '}
                                            {Number(
                                                selected.estimated_distance,
                                            ).toFixed(1)}{' '}
                                            km
                                            {selected.estimated_duration !=
                                                null &&
                                                ` · ≈ ${selected.estimated_duration} min`}
                                        </dd>
                                    </div>
                                )}
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="font-bold text-m-ink">
                                        {selected.final_fare != null
                                            ? isDelivery(selected) ? 'Final delivery fare' : 'Final fare'
                                            : isDelivery(selected) ? 'Delivery fare estimate' : 'Estimated fare'}
                                    </dt>
                                    <dd className="text-2xl font-bold text-m-accent">
                                        {peso(
                                            selected.final_fare ??
                                                selected.estimated_fare,
                                        )}
                                    </dd>
                                </div>
                            </dl>
                            <dl className="space-y-1.5 rounded-xl border border-m-line px-4 py-3 text-sm">
                                {isDelivery(selected) ? (
                                    <>
                                        <Row k="Recipient" v={selected.recipient_name} />
                                        <Row k="Contact number" v={selected.recipient_phone} />
                                        <Row k="Item" v={selected.item_description} />
                                        <Row
                                            k="Package size"
                                            v={selected.package_size ? PACKAGE_SIZE_LABEL[selected.package_size] ?? selected.package_size : null}
                                        />
                                    </>
                                ) : (
                                    <Row k="Passengers" v={String(selected.passenger_count ?? 1)} />
                                )}
                                <Row
                                    k={isDelivery(selected) ? 'Delivery notes' : 'Pickup notes'}
                                    v={selected.notes}
                                />
                            </dl>
                            <BookingDetails
                                destinationLabel={isDelivery(selected) ? 'Delivery destination' : 'Destination'}
                                pickupText={selected.pickup_location}
                                destinationText={selected.destination}
                                pickup={point(
                                    selected.pickup_lat,
                                    selected.pickup_lng,
                                )}
                                destination={point(
                                    selected.destination_lat,
                                    selected.destination_lng,
                                )}
                            />
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </CustomerShell>
    );
}