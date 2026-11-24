import { Link } from '@inertiajs/react';
import { ArrowLeft, ExternalLink, History } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
    ActionButtons,
    ComplaintActionDialog,
    ComplaintStatusBadge,
    ReporterBadge,
    SafetyBadge,
    TypeBadge,
    pretty,
    type ComplaintAction,
    type PenaltyInfo,
} from '@/components/admin/complaint-shared';
import { shortId } from '@/components/admin/rider-shared';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Party = {
    type: string;
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    url: string;
    found: boolean;
};
type Props = {
    complaint: {
        id: string;
        category: string;
        category_label: string;
        report_type: string;
        type_label: string;
        noun: string;
        is_safety: boolean;
        occurred_at: string | null;
        location: string | null;
        description: string;
        status: string;
        resolution_note: string | null;
        resolved_at: string | null;
        assigned_to: string | null;
        created_at: string | null;
    };
    reporter: Party | null;
    against: Party | null;
    booking: {
        id: string;
        reference: string | null;
        service: string | null;
        pickup: string;
        destination: string;
        status: string;
        rider: string | null;
        created_at: string | null;
    } | null;
    history: { id: string; action: string; reason: string | null; created_at: string; admin_name: string | null }[];
    penalty: PenaltyInfo;
    applied_penalty: {
        severity: string;
        points: number;
        action: string;
        suspension_ends_at: string | null;
        suspension_lifted_at: string | null;
        expires_at: string | null;
    } | null;
    against_active_points: number | null;
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const eventLabel: Record<string, string> = {
    'complaint.filed': 'Report filed',
    'complaint.investigation_started': 'Review started',
    'complaint.resolved': 'Report resolved',
    'complaint.rejected': 'Report rejected',
    'complaint.penalty_applied': 'Penalty applied',
};
const eventTone: Record<string, string> = {
    'complaint.filed': 'bg-[#F59E0B]',
    'complaint.investigation_started': 'bg-[#7C3AED]',
    'complaint.resolved': 'bg-[#16A36A]',
    'complaint.rejected': 'bg-[#DC2626]',
    'complaint.penalty_applied': 'bg-[#DC2626]',
};

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

function PartyCard({ title, party, extra }: { title: string; party: Party | null; extra?: ReactNode }) {
    return (
        <Card title={title} right={party ? <ReporterBadge type={party.type} /> : undefined}>
            {!party ? (
                <p className="text-sm text-m-muted">Not recorded.</p>
            ) : !party.found ? (
                <p className="text-sm text-m-muted">This {party.type} record no longer exists.</p>
            ) : (
                <div className="space-y-1 text-sm">
                    <p className="font-medium">{party.name ?? 'Unnamed'}</p>
                    {party.email && <p className="break-all text-m-muted">{party.email}</p>}
                    {party.phone && <p className="text-m-muted">{party.phone}</p>}
                    {extra}
                    <Link
                        href={party.url}
                        className={`mt-2 inline-flex items-center gap-1.5 rounded text-xs font-medium text-m-accent hover:text-m-accent-hover ${ring}`}
                    >
                        Open {party.type} profile <ExternalLink className="size-3.5" aria-hidden />
                    </Link>
                </div>
            )}
        </Card>
    );
}

export default function ComplaintShow({
    complaint,
    reporter,
    against,
    booking,
    history,
    penalty,
    applied_penalty,
    against_active_points,
}: Props) {
    const [action, setAction] = useState<ComplaintAction | null>(null);

    // The list sends "Resolve" here (?resolve=1) because the finding and penalty options live on this page.
    useEffect(() => {
        if (
            complaint.status === 'under_investigation' &&
            new URLSearchParams(window.location.search).get('resolve') === '1'
        ) {
            setAction('resolve');
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [complaint.status]);
    const closed = complaint.status === 'resolved' || complaint.status === 'rejected';

    return (
        <AdminLayout title="Support Center">
            <Link
                href="/admin/complaints"
                className={`mb-4 inline-flex items-center gap-2 rounded text-sm font-medium text-m-accent hover:text-m-accent-hover ${ring}`}
            >
                <ArrowLeft className="size-4" aria-hidden /> Back to Support Center
            </Link>

            <div className="mb-6 flex flex-col gap-4 rounded-lg border border-m-line bg-m-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold">{complaint.category_label}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-m-muted">
                        <TypeBadge type={complaint.report_type} />
                        {complaint.is_safety && <SafetyBadge />}
                        <ComplaintStatusBadge status={complaint.status} />
                        <span className="font-mono" title={complaint.id}>{shortId(complaint.id)}</span>
                        <span>Filed {formatDate(complaint.created_at, true)}</span>
                        {complaint.assigned_to && <span>· Handled by {complaint.assigned_to}</span>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ActionButtons complaint={{ id: complaint.id, status: complaint.status }} onAction={setAction} />
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card title={`${complaint.type_label} details`}>
                        {complaint.report_type === 'incident' && (
                            <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-m-line pb-3 text-sm">
                                <dt className="text-m-muted">Happened</dt>
                                <dd>{formatDate(complaint.occurred_at, true)}</dd>
                                <dt className="text-m-muted">Location</dt>
                                <dd>{complaint.location ?? '—'}</dd>
                            </dl>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-line">{complaint.description}</p>
                    </Card>

                    {applied_penalty && (
                        <Card title="Penalty applied">
                            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                                <dt className="text-m-muted">Severity</dt>
                                <dd className="capitalize">
                                    {applied_penalty.severity} (+{applied_penalty.points}{' '}
                                    {applied_penalty.points === 1 ? 'point' : 'points'})
                                </dd>
                                <dt className="text-m-muted">Action</dt>
                                <dd>{applied_penalty.action}</dd>
                                {applied_penalty.suspension_ends_at && (
                                    <>
                                        <dt className="text-m-muted">Suspension</dt>
                                        <dd>
                                            {applied_penalty.suspension_lifted_at
                                                ? `Lifted ${formatDate(applied_penalty.suspension_lifted_at, true)}`
                                                : `Ends ${formatDate(applied_penalty.suspension_ends_at, true)}`}
                                        </dd>
                                    </>
                                )}
                                <dt className="text-m-muted">Points expire</dt>
                                <dd>{formatDate(applied_penalty.expires_at, true)}</dd>
                            </dl>
                        </Card>
                    )}

                    {closed && complaint.resolution_note && (
                        <Card title={complaint.status === 'resolved' ? 'Resolution' : 'Rejection reason'}>
                            <p className="text-sm leading-relaxed whitespace-pre-line">{complaint.resolution_note}</p>
                            {complaint.resolved_at && (
                                <p className="mt-2 text-xs text-m-muted">{formatDate(complaint.resolved_at, true)}</p>
                            )}
                        </Card>
                    )}

                    <Card title="Related booking">
                        {!booking ? (
                            <p className="text-sm text-m-muted">This report is not linked to a booking.</p>
                        ) : (
                            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                                <dt className="text-m-muted">Reference</dt>
                                <dd className="font-mono text-xs">{booking.reference ?? shortId(booking.id)}</dd>
                                <dt className="text-m-muted">Service</dt>
                                <dd>{booking.service ?? '—'}</dd>
                                <dt className="text-m-muted">Route</dt>
                                <dd>{booking.pickup} <span className="text-m-muted">to</span> {booking.destination}</dd>
                                <dt className="text-m-muted">Rider</dt>
                                <dd>{booking.rider ?? '—'}</dd>
                                <dt className="text-m-muted">Status</dt>
                                <dd className="capitalize">{pretty(booking.status)}</dd>
                                <dt className="text-m-muted">Booked</dt>
                                <dd>{formatDate(booking.created_at, true)}</dd>
                            </dl>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <PartyCard title="Filed by" party={reporter} />
                    <PartyCard
                        title={complaint.report_type === 'support' ? 'Person involved' : 'Report against'}
                        party={against}
                        extra={
                            against_active_points !== null && (
                                <p className="text-xs text-m-muted">
                                    Active penalty points: <strong className="text-m-ink">{against_active_points}</strong>
                                </p>
                            )
                        }
                    />

                    <Card title="History" right={<History className="size-4 text-m-muted" aria-hidden />}>
                        {history.length === 0 ? (
                            <p className="text-sm text-m-muted">No decisions have been recorded for this report yet.</p>
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
                                            {h.reason && !h.reason.includes(' -> ') && (
                                                <p className="mt-1 whitespace-pre-line text-m-body">{h.reason}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Card>
                </div>
            </div>

            <ComplaintActionDialog
                complaint={action ? { id: complaint.id, status: complaint.status } : null}
                action={action}
                onClose={() => setAction(null)}
                penalty={penalty}
            />
        </AdminLayout>
    );
}