import { Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ExternalLink,
    FileText,
    FileX,
    History,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import RiderAccreditationPanel, {
    type AccreditationSummary,
} from '@/components/admin/rider-accreditation';
import {
    AccountBadge,
    AccreditationBadge,
    ActionButtons,
    Avatar,
    RiderActionDialog,
    VerificationBadge,
    type RiderAction,
} from '@/components/admin/rider-shared';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Rider = {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    address: string | null;
    profile_picture_url: string | null;
    vehicle_type: string | null;
    motorcycle_plate_number: string;
    license_number: string;
    license_expiry: string | null;
    license_expired: boolean;
    application_status: string;
    account_status: string;
    rejection_reason: string | null;
    suspension_reason: string | null;
    registration_document_available?: boolean;
    has_account: boolean;
    created_at: string | null;
    reviewed_at: string | null;
};
type Doc = {
    type: string;
    label: string;
    available: boolean;
    url: string | null;
    is_image: boolean;
};
type Entry = {
    id: string;
    action: string;
    reason: string | null;
    created_at: string;
    admin_name: string | null;
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const eventLabel: Record<string, string> = {
    'rider.approved': 'Application approved',
    'rider.rejected': 'Application rejected',
    'rider.suspended': 'Account suspended',
    'rider.reactivated': 'Account reactivated',
};
const eventTone: Record<string, string> = {
    'rider.approved': 'bg-[#16A36A]',
    'rider.rejected': 'bg-[#DC2626]',
    'rider.suspended': 'bg-m-solid',
    'rider.reactivated': 'bg-m-forest',
};

function Card({
    title,
    children,
    right,
}: {
    title: string;
    children: ReactNode;
    right?: ReactNode;
}) {
    return (
        <section className="rounded-lg border border-m-line bg-m-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-m-line px-4 py-3">
                <h3 className="text-base font-semibold">{title}</h3>
                {right}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

/** Missing data is shown as "Not provided", never invented. */
function Field({
    label,
    value,
    mono,
}: {
    label: string;
    value: ReactNode | null | undefined;
    mono?: boolean;
}) {
    const empty = value === null || value === undefined || value === '';
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-m-muted">{label}</dt>
            <dd
                className={`mt-0.5 text-sm break-words ${mono ? 'font-mono' : ''} ${empty ? 'text-m-muted' : 'font-medium'}`}
            >
                {empty ? 'Not provided' : value}
            </dd>
        </div>
    );
}

type Props = {
    rider: Rider;
    documents: Doc[];
    history: Entry[];
    accreditation: AccreditationSummary;
    staff: { id: string; full_name: string; role: string }[];
    currentStaffId: string | null;
    requiredEquipment: string[];
    requiredDocuments: string[];
};

export default function RiderShow({
    rider,
    documents,
    history,
    accreditation,
    staff,
    currentStaffId,
    requiredEquipment,
    requiredDocuments,
}: Props) {
    const [action, setAction] = useState<RiderAction | null>(null);

    return (
        <AdminLayout title="Rider Details">
            <Link
                href="/admin/riders"
                className={`mb-4 inline-flex items-center gap-2 rounded text-sm font-medium text-m-accent hover:text-m-accent-hover ${ring}`}
            >
                <ArrowLeft className="size-4" aria-hidden /> Back to Rider
                Management
            </Link>

            <div className="mb-6 flex flex-col gap-4 rounded-lg border border-m-line bg-m-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <Avatar
                        name={rider.full_name}
                        url={rider.profile_picture_url}
                        size="size-16"
                    />
                    <div className="min-w-0">
                        <h2 className="truncate text-xl font-bold">
                            {rider.full_name}
                        </h2>
                        <p className="text-sm break-all text-m-muted">
                            {rider.email}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-m-muted">
                            <span>Application</span>
                            <VerificationBadge
                                status={rider.application_status}
                            />
                            <span className="ml-1">Accreditation</span>
                            <AccreditationBadge
                                status={accreditation.statuses.accreditation}
                            />
                            <span className="ml-1">Account</span>
                            <AccountBadge status={rider.account_status} />
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ActionButtons rider={rider} onAction={setAction} />
                </div>
            </div>

            {!rider.has_account && (
                <p
                    role="status"
                    className="mb-4 rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/5 px-4 py-3 text-sm text-m-amber"
                >
                    This rider record is not linked to a sign-in account, so the
                    rider cannot be sent notifications.
                </p>
            )}

            <RiderAccreditationPanel
                rider={rider}
                accreditation={accreditation}
                staff={staff}
                currentStaffId={currentStaffId}
                requiredEquipment={requiredEquipment}
                requiredDocuments={requiredDocuments}
                onApplicationAction={setAction}
            />

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Personal Information">
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <Field label="Full Name" value={rider.full_name} />
                        <Field label="Email Address" value={rider.email} />
                        <Field label="Contact Number" value={rider.phone} />
                        <Field
                            label="Registration Date"
                            value={formatDate(rider.created_at, true)}
                        />
                        <Field label="Home Address" value={rider.address} />
                        <Field
                            label="Profile Picture"
                            value={
                                rider.profile_picture_url ? (
                                    <a
                                        href={rider.profile_picture_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-m-accent hover:underline"
                                    >
                                        View photo
                                    </a>
                                ) : null
                            }
                        />
                    </dl>
                </Card>

                <Card title="Rider Information">
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <Field
                            label="Vehicle Type"
                            value={rider.vehicle_type}
                        />
                        <Field
                            label="Plate Number"
                            value={rider.motorcycle_plate_number}
                            mono
                        />
                        <Field
                            label="Driver's License Number"
                            value={rider.license_number}
                            mono
                        />
                        <Field
                            label="License Expiry"
                            value={
                                rider.license_expiry ? (
                                    <>
                                        {formatDate(rider.license_expiry)}
                                        {rider.license_expired && (
                                            <span className="ml-2 rounded bg-m-red/10 px-1.5 py-0.5 text-xs font-medium text-m-red">
                                                Expired
                                            </span>
                                        )}
                                    </>
                                ) : null
                            }
                        />
                        <Field label="Rider ID" value={rider.id} mono />
                        <Field
                            label="Last Verification Decision"
                            value={
                                rider.reviewed_at
                                    ? formatDate(rider.reviewed_at, true)
                                    : null
                            }
                        />
                    </dl>
                    {(rider.rejection_reason || rider.suspension_reason) && (
                        <div className="mt-4 space-y-3">
                            {rider.rejection_reason && (
                                <div className="rounded-md border border-m-red/30 bg-m-red/5 p-3 text-sm">
                                    <p className="font-semibold text-m-redtext">
                                        Rejection reason
                                    </p>
                                    <p className="mt-1 whitespace-pre-line text-m-body">
                                        {rider.rejection_reason}
                                    </p>
                                </div>
                            )}
                            {rider.suspension_reason && (
                                <div className="rounded-md border border-m-ink/30 bg-m-solid/5 p-3 text-sm">
                                    <p className="font-semibold text-m-ink">
                                        Suspension reason
                                    </p>
                                    <p className="mt-1 whitespace-pre-line text-m-body">
                                        {rider.suspension_reason}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                <Card title="Supporting Documents">
                    <ul className="space-y-3">
                        {documents.map((d) => (
                            <li
                                key={d.type}
                                className="flex flex-col gap-3 rounded-md border border-m-line p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    {d.available && d.is_image && d.url ? (
                                        <img
                                            src={d.url}
                                            alt={`${d.label} preview`}
                                            className="size-12 shrink-0 rounded border border-m-line object-cover"
                                        />
                                    ) : (
                                        <span
                                            className={`flex size-12 shrink-0 items-center justify-center rounded ${d.available ? 'bg-m-mint text-m-accent' : 'bg-m-page text-m-muted'}`}
                                        >
                                            {d.available ? (
                                                <FileText
                                                    className="size-5"
                                                    aria-hidden
                                                />
                                            ) : (
                                                <FileX
                                                    className="size-5"
                                                    aria-hidden
                                                />
                                            )}
                                        </span>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">
                                            {d.label}
                                        </p>
                                        <p className="text-xs text-m-muted">
                                            {d.available
                                                ? 'Uploaded'
                                                : 'Not uploaded'}
                                        </p>
                                    </div>
                                </div>
                                {d.available && d.url && (
                                    <a
                                        href={d.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-m-accent px-3 py-1.5 text-xs font-medium text-m-accent hover:bg-m-mint ${ring}`}
                                    >
                                        Review{' '}
                                        <ExternalLink
                                            className="size-3.5"
                                            aria-hidden
                                        />
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                    {documents.every((d) => !d.available) && (
                        <p className="mt-3 text-sm text-m-muted">
                            This rider has not uploaded any verification
                            documents.
                        </p>
                    )}
                </Card>

                <Card
                    title="Application and Account History"
                    right={
                        <History
                            className="size-4 text-m-muted"
                            aria-hidden
                        />
                    }
                >
                    {history.length === 0 ? (
                        <p className="text-sm text-m-muted">
                            No verification or account decisions have been
                            recorded for this rider yet.
                        </p>
                    ) : (
                        <ol className="space-y-4">
                            {history.map((h) => (
                                <li key={h.id} className="flex gap-3">
                                    <span
                                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${eventTone[h.action] ?? 'bg-m-muted'}`}
                                        aria-hidden
                                    />
                                    <div className="min-w-0 text-sm">
                                        <p className="font-medium">
                                            {eventLabel[h.action] ?? h.action}
                                        </p>
                                        <p className="text-xs text-m-muted">
                                            {formatDate(h.created_at, true)}
                                            {h.admin_name
                                                ? ` · by ${h.admin_name}`
                                                : ''}
                                        </p>
                                        {h.reason && (
                                            <p className="mt-1 whitespace-pre-line text-m-body">
                                                {h.reason}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </Card>
            </div>

            <RiderActionDialog
                rider={action ? rider : null}
                action={action}
                onClose={() => setAction(null)}
            />
        </AdminLayout>
    );
}
