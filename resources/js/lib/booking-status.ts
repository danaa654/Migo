/** Shared booking-status helpers for the customer pages. Statuses are stored lowercase snake_case (App\Enums\BookingStatus). */

export const STATUS: Record<string, { label: string; tone: string }> = {
    pending: { label: 'Pending', tone: 'bg-[#F59E0B]/15 text-m-amber' },
    searching_for_rider: {
        label: 'Finding a rider',
        tone: 'bg-[#F59E0B]/15 text-m-amber',
    },
    rider_assigned: {
        label: 'Rider on the way',
        tone: 'bg-[#2563EB]/10 text-[#2563EB]',
    },
    rider_arrived: {
        label: 'Rider arrived',
        tone: 'bg-[#2563EB]/10 text-[#2563EB]',
    },
    in_progress: { label: 'On trip', tone: 'bg-m-green/10 text-m-greentext' },
    completed: { label: 'Completed', tone: 'bg-m-green/10 text-m-greentext' },
    cancelled_by_passenger: {
        label: 'Cancelled',
        tone: 'bg-m-soft text-m-muted',
    },
    cancelled_by_rider: {
        label: 'Cancelled by rider',
        tone: 'bg-m-soft text-m-muted',
    },
    no_rider_found: {
        label: 'No rider found',
        tone: 'bg-m-red/10 text-m-redtext',
    },
    expired: { label: 'Expired', tone: 'bg-m-soft text-m-muted' },
};

export const statusOf = (s: string) =>
    STATUS[s] ?? {
        label: s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
        tone: 'bg-m-soft text-m-muted',
    };

/** A booking the customer can open on the live ride page. */
export const TRACKABLE = [
    'pending',
    'searching_for_rider',
    'rider_assigned',
    'rider_arrived',
    'in_progress',
    'no_rider_found',
];
/** Statuses the customer may still cancel. */
export const CANCELLABLE = [
    'pending',
    'searching_for_rider',
    'rider_assigned',
    'rider_arrived',
];
export const ACTIVE = [
    'pending',
    'searching_for_rider',
    'rider_assigned',
    'rider_arrived',
    'in_progress',
];

export const peso = (n: number | null | undefined) =>
    n == null
        ? '—'
        : `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** DB timestamps without a zone are UTC. */
export function when(b: {
    booking_date?: string | null;
    created_at: string;
}): string {
    const raw = b.booking_date ?? b.created_at;
    const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
    return isNaN(d.getTime())
        ? '—'
        : d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}
