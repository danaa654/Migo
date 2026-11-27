import { BadgeCheck, CircleAlert, Clock, Eye, FileText, IdCard, ImageIcon } from 'lucide-react';

export type BikerProfile = {
    full_name: string;
    email: string;
    phone: string | null;
    address: string | null;
    photo_url: string | null;
    vehicle_type: string | null;
    license_number: string | null;
    license_expiry: string | null;
    plate_number: string | null;
    registered_at: string | null;
};
export type BikerDocument = { type: string; label: string; available: boolean; is_image: boolean; url: string | null };

const date = (raw: string | null) => {
    if (!raw) return '—';
    const d = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);

    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { dateStyle: 'medium' });
};

/** One overall result for the document check, in the rider's words. */
function verification(status: string | undefined, remarks: string | null | undefined) {
    switch (status) {
        case 'verified':
            return { label: 'Documents verified', cls: 'bg-emerald-100 text-emerald-800', icon: BadgeCheck, note: 'Migo staff checked your original documents in person.' };
        case 'failed':
            return { label: 'Needs attention', cls: 'bg-red-100 text-red-800', icon: CircleAlert, note: remarks ? `Staff remarks: ${remarks}` : 'Please visit the Migo office with your original documents.' };
        default:
            return { label: 'Waiting for in-person check', cls: 'bg-amber-100 text-amber-800', icon: Clock, note: 'Your files were received. Bring the ORIGINAL documents to the Migo office so staff can verify them.' };
    }
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-[var(--b-muted)]">{label}</dt>
            <dd className="truncate text-sm font-semibold text-[var(--b-ink)]" title={value || undefined}>
                {value || '—'}
            </dd>
        </div>
    );
}

/** The rider's own submitted profile and documents. View only: nothing here can change an accreditation result. */
export default function BikerApplicationCard({
    profile,
    documents,
    documentStatus,
    documentRemarks,
}: {
    profile: BikerProfile;
    documents: BikerDocument[];
    documentStatus?: string;
    documentRemarks?: string | null;
}) {
    const v = verification(documentStatus, documentRemarks);
    const VIcon = v.icon;
    const initial = profile.full_name.trim().charAt(0).toUpperCase() || '?';

    return (
        <section className="rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] shadow-sm" aria-labelledby="biker-application">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--b-line)] px-5 py-4">
                <div>
                    <h2 id="biker-application" className="text-base font-semibold text-[var(--b-ink)]">
                        My application
                    </h2>
                    <p className="text-xs text-[var(--b-muted)]">What you submitted to Migo. You can view it here but not change it.</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${v.cls}`}>
                    <VIcon className="size-3.5" aria-hidden /> {v.label}
                </span>
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {/* Profile */}
                <div>
                    <h3 className="mb-3 text-sm font-semibold text-[var(--b-ink)]">Profile</h3>
                    <div className="flex items-start gap-4">
                        {profile.photo_url ? (
                            <a href={profile.photo_url} target="_blank" rel="noopener noreferrer" title="View profile photo" className="shrink-0">
                                <img src={profile.photo_url} alt={`Profile photo of ${profile.full_name}`} className="size-24 rounded-2xl border border-[var(--b-line)] object-cover" />
                            </a>
                        ) : (
                            <span aria-hidden className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-m-mint text-3xl font-extrabold text-m-forest">
                                {initial}
                            </span>
                        )}
                        <div className="min-w-0">
                            <p className="truncate text-lg font-bold text-[var(--b-ink)]">{profile.full_name}</p>
                            <p className="truncate text-sm text-[var(--b-muted)]">{profile.email}</p>
                            <p className="text-sm text-[var(--b-muted)]">{profile.phone || '—'}</p>
                            {!profile.photo_url && <p className="mt-1 text-xs text-[var(--b-muted)]">No profile photo on file.</p>}
                        </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                        <Detail label="Vehicle" value={profile.vehicle_type} />
                        <Detail label="Plate number" value={profile.plate_number} />
                        <Detail label="Driver's license no." value={profile.license_number} />
                        <Detail label="License expires" value={date(profile.license_expiry)} />
                        <div className="col-span-2">
                            <Detail label="Home address" value={profile.address} />
                        </div>
                        <Detail label="Applied on" value={date(profile.registered_at)} />
                    </dl>
                </div>

                {/* Documents */}
                <div>
                    <h3 className="mb-3 text-sm font-semibold text-[var(--b-ink)]">Documents you submitted</h3>
                    <ul className="space-y-2">
                        {documents.map((d) => (
                            <li key={d.type} className="flex items-center gap-3 rounded-lg border border-[var(--b-line)] px-3 py-2.5">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-m-mint text-m-forest">
                                    {d.type === 'license' ? <IdCard className="size-4" aria-hidden /> : d.is_image ? <ImageIcon className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[var(--b-ink)]">{d.label}</p>
                                    <p className={`text-xs ${d.available ? 'text-emerald-700' : 'text-[var(--b-muted)]'}`}>{d.available ? 'Submitted' : 'No file on record'}</p>
                                </div>
                                {d.available && d.url && (
                                    <a
                                        href={d.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--b-line)] px-3 py-1.5 text-xs font-semibold text-[var(--b-ink)] hover:bg-m-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                                    >
                                        <Eye className="size-3.5" aria-hidden /> View
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-xs text-[var(--b-muted)]">{v.note}</p>
                </div>
            </div>
        </section>
    );
}