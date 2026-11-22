import BookingMap, { straightLineKm } from '@/components/booking-map';
import type { Point } from '@/components/location-picker';

/** Pickup, destination, estimated distance and map. Shared by the review step and the My Bookings details. */
export default function BookingDetails({
    pickupText,
    destinationText,
    pickup,
    destination,
    destinationLabel = 'Destination',
}: {
    destinationLabel?: string;
    pickupText: string;
    destinationText: string;
    pickup: Point | null;
    destination: Point | null;
}) {
    const km =
        pickup && destination ? straightLineKm(pickup, destination) : null;

    return (
        <div className="space-y-4">
            <dl className="grid gap-3 text-sm">
                <div className="rounded-md bg-m-mint p-3">
                    <dt className="flex items-center gap-2 font-medium text-m-muted">
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#16A36A] text-[11px] font-bold text-white">
                            A
                        </span>{' '}
                        Pickup
                    </dt>
                    <dd className="mt-1 font-semibold text-m-ink">
                        {pickupText}
                    </dd>
                </div>
                <div className="rounded-md bg-m-mint p-3">
                    <dt className="flex items-center gap-2 font-medium text-m-muted">
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#DC2626] text-[11px] font-bold text-white">
                            B
                        </span>{' '}
                        {destinationLabel}
                    </dt>
                    <dd className="mt-1 font-semibold text-m-ink">
                        {destinationText}
                    </dd>
                </div>
            </dl>
            <BookingMap pickup={pickup} destination={destination} />
            {km !== null && (
                <p className="text-xs text-m-muted">
                    Approximate straight-line distance:{' '}
                    <span className="font-semibold text-m-body">
                        {km < 1
                            ? `${Math.round(km * 1000)} m`
                            : `${km.toFixed(1)} km`}
                    </span>
                    . The actual road distance may be longer.
                </p>
            )}
        </div>
    );
}
