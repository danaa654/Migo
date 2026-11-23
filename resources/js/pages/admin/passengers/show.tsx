import { Link } from '@inertiajs/react';
import { ArrowLeft, History } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
    ActionButtons,
    PassengerActionDialog,
    PassengerStatusBadge,
    displayName,
    methodsText,
    type PassengerAction,
} from '@/components/admin/passenger-shared';
import { Avatar, shortId } from '@/components/admin/rider-shared';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Passenger = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    sign_in_methods: string[];
    account_status: string;
    suspension_reason: string | null;
    has_account: boolean;
    has_active_booking: boolean;
    created_at: string | null;
};
type Booking = {
    id: string;
    reference: string | null;
    service: string | null;
    pickup: string;
    destination: string;
    status: string;
    fare: number | null;
    rider: string | null;
    created_at: string | null;
};
type Rating = { id: number; booking_id: string; rating: number; comment: string | null; created_at: string; rider_name: string | null };
type Complaint = { id: string; complaint_category: string; complaint_status: string; created_at: string };
type Entry = { id: string; action: string; reason: string | null; created_at: string; admin_name: string | null };
type Props = {
    passenger: Passenger;
    tripStats: { total: number; completed: number; cancelled_by_passenger: number; cancelled_by_rider: number; no_rider_found: number };
    bookings: Booking[];
    ratings: Rating[];
    complaints: Complaint[];
    history: Entry[];
    canManage: boolean;
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const eventLabel: Record<string, string> = {
    'passenger.suspended': 'Account suspended',
    'passenger.deactivated': 'Account deactivated',
    'passenger.reactivated': 'Account reactivated',
};
const eventTone: Record<string, string> = {
    'passenger.suspended': 'bg-m-solid',
    'passenger.deactivated': 'bg-[#DC2626]',
    'passenger.reactivated': 'bg-m-forest',
};
const pretty = (s: string) => s.replace(/_/g, ' ');
const peso = (n: number | null) =>
    n == null ? '—' : `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
    return (
        <section className="rounded-lg border border-m-line bg-m-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-m-line px-4 py-3">
                <h3 className="text-sm font-semibold text-m-ink">{title}</h3>
                {right}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-m-line bg-m-card px-4 py-3 shadow-sm">
            <p className="text-xs text-m-muted">{label}</p>
            <p className="mt-0.5 text-2xl leading-tight font-bold text-m-ink">{value.toLocaleString()}</p>
        </div>
    );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-m-muted">{label}</dt>
            <dd className="mt-0.5 text-sm break-words">{children}</dd>
        </div>
    );
}

export default function PassengerShow({ passenger, tripStats, bookings, ratings, complaints, history, canManage }: Props) {
    const [action, setAction] = useState<PassengerAction | null>(null);

    return (
        <AdminLayout title="Passenger Details">
            <Link
                href="/admin/passengers"
                className={`mb-4 inline-flex items-center gap-2 rounded text-sm font-medium text-m-accent hover:text-m-accent-hover ${ring}`}
            >
                <ArrowLeft className="size-4" aria-hidden /> Back to Passenger Management
            </Link>

            <div className="mb-6 flex flex-col gap-4 rounded-lg border border-m-line bg-m-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <Avatar name={passenger.full_name ?? ''} url={null} size="size-16" />
                    <div className="min-w-0">
                        <h2 className="truncate text-xl font-bold">{displayName(passenger)}</h2>
                        <p className="text-sm break-all text-m-muted">{passenger.email ?? passenger.phone ?? '—'}</p>
                        <div className="mt-2 flex items-center gap-2">
                            <PassengerStatusBadge status={passenger.account_status} />
                            <span className="font-mono text-xs text-m-muted" title={passenger.id}>{shortId(passenger.id)}</span>
                        </div>
                    </div>
                </div>
                {canManage && (
                    <div className="flex flex-wrap gap-2">
                        <ActionButtons passenger={passenger} onAction={setAction} />
                    </div>
                )}
            </div>

            {passenger.account_status !== 'active' && passenger.suspension_reason && (
                <div role="status" className="mb-6 rounded-lg border border-m-line bg-m-page px-4 py-3 text-sm">
                    <p className="font-semibold capitalize text-m-ink">Account {passenger.account_status}</p>
                    <p className="mt-1 whitespace-pre-line text-m-body">{passenger.suspension_reason}</p>
                    {passenger.has_active_booking && (
                        <p className="mt-2 text-xs text-m-muted">
                            This passenger still has a trip in progress. It will finish normally; only new bookings are blocked.
                        </p>
                    )}
                </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                <Stat label="Total bookings" value={tripStats.total} />
                <Stat label="Completed" value={tripStats.completed} />
                <Stat label="Cancelled by passenger" value={tripStats.cancelled_by_passenger} />
                <Stat label="Cancelled by rider" value={tripStats.cancelled_by_rider} />
                <Stat label="No rider found" value={tripStats.no_rider_found} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card title="Recent bookings">
                        {bookings.length === 0 ? (
                            <p className="text-sm text-m-muted">This passenger has not made any bookings yet.</p>
                        ) : (
                            <div className="-mx-4 overflow-x-auto">
                                <table className="w-full min-w-[760px] text-left text-sm">
                                    <thead className="bg-m-page text-xs font-semibold text-m-muted">
                                        <tr>
                                            <th scope="col" className="px-4 py-2">Reference</th>
                                            <th scope="col" className="px-4 py-2">Service</th>
                                            <th scope="col" className="px-4 py-2">Route</th>
                                            <th scope="col" className="px-4 py-2">Rider</th>
                                            <th scope="col" className="px-4 py-2">Fare</th>
                                            <th scope="col" className="px-4 py-2">Status</th>
                                            <th scope="col" className="px-4 py-2">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-m-line">
                                        {bookings.map((b) => (
                                            <tr key={b.id}>
                                                <td className="px-4 py-2.5 font-mono text-xs">{b.reference ?? shortId(b.id)}</td>
                                                <td className="px-4 py-2.5">{b.service ?? '—'}</td>
                                                <td className="px-4 py-2.5">
                                                    <p className="max-w-[16rem] truncate" title={b.pickup}>{b.pickup}</p>
                                                    <p className="max-w-[16rem] truncate text-xs text-m-muted" title={b.destination}>to {b.destination}</p>
                                                </td>
                                                <td className="px-4 py-2.5">{b.rider ?? '—'}</td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">{peso(b.fare)}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="inline-block rounded bg-m-page px-2 py-0.5 text-xs font-medium whitespace-nowrap capitalize text-m-body">{pretty(b.status)}</span>
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(b.created_at, true)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>

                    <Card title="Ratings given to riders">
                        {ratings.length === 0 ? (
                            <p className="text-sm text-m-muted">No ratings yet.</p>
                        ) : (
                            <ul className="divide-y divide-m-line">
                                {ratings.map((r) => (
                                    <li key={r.id} className="py-2.5 text-sm first:pt-0 last:pb-0">
                                        <p>
                                            <span className="font-semibold">{r.rating}/5</span>
                                            <span className="text-m-muted"> for {r.rider_name ?? 'a rider'} · {formatDate(r.created_at)}</span>
                                        </p>
                                        {r.comment && <p className="mt-0.5 text-m-body">{r.comment}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card title="Complaints filed">
                        {complaints.length === 0 ? (
                            <p className="text-sm text-m-muted">This passenger has not filed any complaints.</p>
                        ) : (
                            <ul className="divide-y divide-m-line">
                                {complaints.map((c) => (
                                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                                        <span className="capitalize">{pretty(c.complaint_category)}</span>
                                        <span className="text-xs text-m-muted">
                                            <span className="capitalize">{pretty(c.complaint_status)}</span> · {formatDate(c.created_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Profile">
                        <dl className="space-y-3">
                            <Info label="Full name">{passenger.full_name ?? '—'}</Info>
                            <Info label="Email">{passenger.email ?? '—'}</Info>
                            <Info label="Phone">{passenger.phone ?? '—'}</Info>
                            <Info label="Sign-in methods">{methodsText(passenger.sign_in_methods)}</Info>
                            <Info label="Registered">{formatDate(passenger.created_at, true)}</Info>
                            {!passenger.has_account && <Info label="Login account">No linked login account</Info>}
                        </dl>
                    </Card>

                    <Card title="Account history" right={<History className="size-4 text-m-muted" aria-hidden />}>
                        {history.length === 0 ? (
                            <p className="text-sm text-m-muted">No account decisions have been recorded for this passenger yet.</p>
                        ) : (
                            <ol className="space-y-4">
                                {history.map((h) => (
                                    <li key={h.id} className="flex gap-3">
                                        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${eventTone[h.action] ?? 'bg-m-muted'}`} aria-hidden />
                                        <div className="min-w-0 text-sm">
                                            <p className="font-medium">{eventLabel[h.action] ?? h.action}</p>
                                            <p className="text-xs text-m-muted">
                                                {formatDate(h.created_at, true)}
                                                {h.admin_name ? ` · by ${h.admin_name}` : ''}
                                            </p>
                                            {h.reason && <p className="mt-1 whitespace-pre-line text-m-body">{h.reason}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Card>
                </div>
            </div>

            <PassengerActionDialog
                passenger={action ? passenger : null}
                action={action}
                onClose={() => setAction(null)}
            />
        </AdminLayout>
    );
}