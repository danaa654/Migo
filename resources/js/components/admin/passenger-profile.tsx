import { Link } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
    PassengerStatusBadge,
    displayName,
    methodsText,
} from '@/components/admin/passenger-shared';
import { Avatar, initialsOf } from '@/components/admin/rider-shared';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/layouts/admin-layout';

export type PassengerProfile = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    sign_in_methods: string[];
    account_status: string;
    bookings_count: number;
    completed_count: number;
    cancelled_count: number;
    last_booking_at: string | null;
    created_at: string | null;
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
        <dt className="shrink-0 text-m-muted">{label}</dt>
        <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
);

/** Click-to-enlarge photo. Falls back to initials when the customer has not uploaded one. */
export function PassengerPhoto({
    name,
    url,
    size = 'size-16',
}: {
    name: string;
    url: string | null;
    size?: string;
}) {
    const [open, setOpen] = useState(false);
    const [failed, setFailed] = useState(false);
    const hasPhoto = !!url && !failed;

    if (!hasPhoto) return <Avatar name={name} url={null} size={size} />;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`View ${name || 'passenger'} profile photo`}
                className="cursor-zoom-in rounded-full transition hover:ring-2 hover:ring-m-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
            >
                <Avatar name={name} url={url} size={size} />
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="border-m-line bg-m-card sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{name || 'Passenger'}</DialogTitle>
                        <DialogDescription>
                            Profile photo uploaded by the customer.
                        </DialogDescription>
                    </DialogHeader>
                    <img
                        src={url!}
                        alt={`${name || 'Passenger'} profile photo`}
                        onError={() => {
                            setFailed(true);
                            setOpen(false);
                        }}
                        className="mx-auto max-h-[60vh] w-full rounded-xl object-contain"
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Quick look at a customer's profile from the list, without leaving the page. */
export function PassengerProfileDialog({
    passenger,
    onClose,
}: {
    passenger: PassengerProfile | null;
    onClose: () => void;
}) {
    return (
        <Dialog open={!!passenger} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                className="border-m-line bg-m-card text-m-body sm:max-w-md"
                style={{ fontFamily: 'Inter, Arial, sans-serif' }}
            >
                {passenger && (
                    <>
                        <DialogHeader className="items-center text-center sm:text-center">
                            <PassengerPhoto
                                name={passenger.full_name ?? ''}
                                url={passenger.avatar_url}
                                size="size-24"
                            />
                            <DialogTitle className="mt-2 text-lg">
                                {displayName(passenger)}
                            </DialogTitle>
                            <DialogDescription asChild>
                                <div className="flex items-center justify-center gap-2">
                                    <PassengerStatusBadge
                                        status={passenger.account_status}
                                    />
                                    <span className="font-mono text-xs text-m-muted">
                                        {passenger.id.slice(-8).toUpperCase()}
                                    </span>
                                </div>
                            </DialogDescription>
                        </DialogHeader>

                        <dl className="divide-y divide-m-line rounded-xl border border-m-line px-4">
                            <Row label="Email">{passenger.email ?? '—'}</Row>
                            <Row label="Phone">{passenger.phone ?? 'No phone'}</Row>
                            <Row label="Sign-in">
                                {methodsText(passenger.sign_in_methods)}
                            </Row>
                            <Row label="Registered">
                                {formatDate(passenger.created_at)}
                            </Row>
                            <Row label="Trips">
                                {passenger.bookings_count} ({passenger.completed_count}{' '}
                                done, {passenger.cancelled_count} cancelled)
                            </Row>
                            <Row label="Last booking">
                                {passenger.last_booking_at
                                    ? formatDate(passenger.last_booking_at)
                                    : '—'}
                            </Row>
                            <Row label="Profile photo">
                                {passenger.avatar_url
                                    ? 'Uploaded'
                                    : `None (${initialsOf(passenger.full_name ?? '')})`}
                            </Row>
                        </dl>

                        <Link
                            href={`/admin/passengers/${passenger.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-m-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                            View full profile
                            <ExternalLink className="size-4" aria-hidden />
                        </Link>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}