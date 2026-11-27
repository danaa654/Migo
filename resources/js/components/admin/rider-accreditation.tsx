import { router } from '@inertiajs/react';
import {
    Award,
    Check,
    CircleDashed,
    Clock,
    History,
    Loader2,
    Lock,
    ShieldAlert,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccreditationBadge } from '@/components/admin/rider-shared';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/layouts/admin-layout';

/* ------------------------------------------------------------------ types (shape of RiderAccreditation::summary()) */
type Staff = { id: string; full_name: string; role: string };
type Named = { id: string; full_name: string } | null;
type DocVerification = {
    id: number;
    status: string;
    documents_checked: Record<string, boolean> | null;
    verified_at: string;
    office_location: string | null;
    remarks: string | null;
    verifier: Named;
};
type Orientation = {
    id: number;
    status: string;
    scheduled_at: string;
    location: string;
    attended: boolean | null;
    completed_at: string | null;
    remarks: string | null;
    facilitator: Named;
};
type Inspection = {
    id: number;
    status: string;
    make: string;
    model: string;
    plate_number: string;
    registration_number: string;
    registration_expiry: string;
    condition: string;
    safety_equipment: Record<string, boolean>;
    roadworthy: boolean;
    inspected_at: string;
    findings: string | null;
    remarks: string | null;
    inspector: Named;
};
type HistoryRow = {
    id: number;
    stage: string;
    action: string;
    from_status: string | null;
    to_status: string | null;
    remarks: string | null;
    created_at: string;
    actor: Named;
};

export type AccreditationSummary = {
    statuses: {
        application: string;
        document_verification: string;
        orientation: string;
        motorcycle_inspection: string;
        accreditation: string;
        account: string;
    };
    eligible_for_final_approval: boolean;
    missing_requirements: string[];
    can_accept_bookings: boolean;
    admin_remarks: string | null;
    accredited_at: string | null;
    revocation_reason: string | null;
    document_verifications: DocVerification[];
    orientations: Orientation[];
    inspections: Inspection[];
    history: HistoryRow[];
};

type RiderLite = {
    id: string;
    full_name: string;
    created_at: string | null;
    reviewed_at: string | null;
    application_status: string;
    account_status: string;
    rejection_reason: string | null;
    motorcycle_plate_number: string;
    has_account: boolean;
};

/** A file the rider uploaded when applying (served to staff by /admin/riders/{id}/documents/{type}). */
type UploadedDoc = {
    type: string;
    label: string;
    available: boolean;
    url: string | null;
    is_image: boolean;
};

type Props = {
    rider: RiderLite;
    accreditation: AccreditationSummary;
    staff: Staff[];
    currentStaffId: string | null;
    requiredEquipment: string[];
    requiredDocuments: string[];
    /** Uploaded copies, so staff can open each one while recording the in-person check. */
    documents?: UploadedDoc[];
    onApplicationAction: (a: 'approve' | 'reject') => void;
};

type Kind =
    | 'documents'
    | 'orientation'
    | 'orientation-result'
    | 'inspection'
    | 'grant'
    | 'revoke'
    | 'remarks';

/* ------------------------------------------------------------------ helpers */
const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const input =
    'w-full rounded-md border border-m-line bg-m-card px-3 py-2 text-sm outline-none focus:border-m-accent focus:ring-2 focus:ring-m-accent/20 disabled:opacity-60';
const humanize = (k: string) =>
    k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const latest = <T extends { id: number }>(rows: T[]) =>
    [...rows].sort((a, b) => b.id - a.id);
const docLabel: Record<string, string> = {
    license: "Driver's license",
    registration: 'Motorcycle registration (OR/CR)',
    receipt: 'Official receipt',
    nbi: 'NBI clearance',
};

type StageState = 'complete' | 'current' | 'failed' | 'locked';
const stateStyle: Record<
    StageState,
    { dot: string; card: string; label: string }
> = {
    complete: {
        dot: 'bg-[#16A36A] text-white',
        card: 'border-m-green/30 bg-[#16A36A]/[0.03]',
        label: 'Completed',
    },
    current: {
        dot: 'bg-m-forest text-white',
        card: 'border-m-accent/40 bg-m-mint/50',
        label: 'In progress',
    },
    failed: {
        dot: 'bg-[#DC2626] text-white',
        card: 'border-m-red/30 bg-[#DC2626]/[0.03]',
        label: 'Failed / needs action',
    },
    locked: {
        dot: 'bg-m-line text-m-muted',
        card: 'border-m-line bg-m-page/60',
        label: 'Not started',
    },
};

function Btn({
    children,
    onClick,
    tone = 'blue',
    disabled,
}: {
    children: ReactNode;
    onClick: () => void;
    tone?: 'blue' | 'green' | 'red' | 'outline';
    disabled?: boolean;
}) {
    const t = {
        blue: 'bg-m-forest text-white hover:bg-m-forest-hover',
        green: 'bg-[#16A36A] text-white hover:bg-[#12875A]',
        red: 'bg-[#DC2626] text-white hover:bg-[#B91C1C]',
        outline: 'border border-m-accent text-m-accent hover:bg-m-mint',
    }[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${t} ${ring}`}
        >
            {children}
        </button>
    );
}

function Meta({ children }: { children: ReactNode }) {
    return <p className="text-xs text-m-muted">{children}</p>;
}

/* ------------------------------------------------------------------ the form dialog (one dialog, one form per stage) */
type FormProps = {
    kind: Kind | null;
    onClose: () => void;
    ctx: Omit<Props, 'onApplicationAction'>;
};

function FormDialog({ kind, onClose, ctx }: FormProps) {
    const {
        rider,
        accreditation: acc,
        staff,
        requiredEquipment,
        requiredDocuments,
        documents = [],
    } = ctx;
    const base = `/admin/riders/${rider.id}/accreditation`;
    const lastInspection = latest(acc.inspections)[0];
    const openOrientation = latest(acc.orientations).find(
        (o) => o.status === 'scheduled',
    );
    const lastOrientation = latest(acc.orientations)[0];

    const [f, setF] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!kind) return;
        setErrors({});
        setBusy(false);
        if (kind === 'documents')
            setF({
                status: 'verified',
                checked: Object.fromEntries(
                    requiredDocuments.map((d) => [d, false]),
                ),
                office_location: '',
                remarks: '',
            });
        if (kind === 'orientation')
            setF({
                scheduled_at: '',
                location: lastOrientation?.location ?? '',
                facilitator_id:
                    lastOrientation?.facilitator?.id ??
                    ctx.currentStaffId ??
                    '',
                remarks: '',
            });
        if (kind === 'orientation-result')
            setF({ attended: true, result: 'completed', remarks: '' });
        if (kind === 'inspection')
            setF({
                status: 'passed',
                make: lastInspection?.make ?? '',
                model: lastInspection?.model ?? '',
                plate_number:
                    lastInspection?.plate_number ??
                    rider.motorcycle_plate_number ??
                    '',
                registration_number: lastInspection?.registration_number ?? '',
                registration_expiry:
                    lastInspection?.registration_expiry?.slice(0, 10) ?? '',
                condition: 'good',
                equipment: Object.fromEntries(
                    requiredEquipment.map((k) => [k, false]),
                ),
                roadworthy: true,
                findings: '',
                remarks: '',
            });
        if (kind === 'grant') setF({ remarks: '' });
        if (kind === 'revoke') setF({ reason: '' });
        if (kind === 'remarks') setF({ remarks: acc.admin_remarks ?? '' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind]);

    const set = (k: string, v: any) => {
        setF((p) => ({ ...p, [k]: v }));
        setErrors((p) => ({ ...p, [k]: '' }));
    };
    const toggle = (group: string, k: string, v: boolean) =>
        setF((p) => ({ ...p, [group]: { ...p[group], [k]: v } }));

    const titles: Record<Kind, [string, string, string]> = {
        documents: [
            'Face-to-face document verification',
            'Record the result of checking the ORIGINAL documents at the Migo office. You are recorded as the responsible staff member.',
            'Save verification',
        ],
        orientation: [
            lastOrientation?.status === 'scheduled'
                ? 'Reschedule orientation'
                : 'Schedule orientation',
            'Set the date, time, place and facilitator. The rider is notified. An earlier open schedule is kept in history as cancelled.',
            'Save schedule',
        ],
        'orientation-result': [
            'Record orientation attendance and result',
            'Only the assigned facilitator or a super administrator can confirm this.',
            'Save result',
        ],
        inspection: [
            lastInspection ? 'Record reinspection' : 'Motorcycle inspection',
            'Record the physical inspection. Earlier inspections stay in history.',
            'Save inspection',
        ],
        grant: [
            'Grant final accreditation?',
            `${rider.full_name} will be accredited and, with an active account, can accept bookings. Your name and the date are recorded.`,
            'Grant accreditation',
        ],
        revoke: [
            'Revoke accreditation?',
            `${rider.full_name} will immediately lose the ability to accept bookings. The reason is saved and shown to the rider.`,
            'Revoke accreditation',
        ],
        remarks: [
            'Administrative remarks',
            'Internal notes; riders do not see these. Earlier remarks are kept in the history log.',
            'Save remarks',
        ],
    };

    function payload(): [string, Record<string, any>] {
        switch (kind) {
            case 'documents':
                return [
                    `${base}/documents`,
                    {
                        status: f.status,
                        documents_checked: f.checked,
                        office_location: f.office_location || null,
                        remarks: f.remarks || null,
                    },
                ];
            case 'orientation':
                return [
                    `${base}/orientation`,
                    {
                        scheduled_at: f.scheduled_at,
                        location: f.location,
                        facilitator_id: f.facilitator_id,
                        remarks: f.remarks || null,
                    },
                ];
            case 'orientation-result':
                return [
                    `${base}/orientation/${openOrientation?.id}/result`,
                    {
                        attended: f.attended,
                        result: f.result,
                        remarks: f.remarks || null,
                    },
                ];
            case 'inspection':
                return [
                    `${base}/inspection`,
                    {
                        status: f.status,
                        make: f.make,
                        model: f.model,
                        plate_number: f.plate_number,
                        registration_number: f.registration_number,
                        registration_expiry: f.registration_expiry,
                        condition: f.condition,
                        safety_equipment: f.equipment,
                        roadworthy: f.roadworthy,
                        findings: f.findings || null,
                        remarks: f.remarks || null,
                    },
                ];
            case 'grant':
                return [`${base}/grant`, { remarks: f.remarks || null }];
            case 'revoke':
                return [`${base}/revoke`, { reason: f.reason }];
            default:
                return [`${base}/remarks`, { remarks: f.remarks }];
        }
    }

    function submit() {
        if (!kind || busy) return;
        const local: Record<string, string> = {};
        if (kind === 'revoke' && (f.reason ?? '').trim().length < 5)
            local.reason = 'Please provide a reason (at least 5 characters).';
        if (kind === 'remarks' && !(f.remarks ?? '').trim())
            local.remarks = 'Remarks cannot be empty.';
        if (
            kind === 'documents' &&
            f.status === 'failed' &&
            !(f.remarks ?? '').trim()
        )
            local.remarks = 'Remarks are required when verification fails.';
        if (
            kind === 'inspection' &&
            f.status === 'failed' &&
            !(f.findings ?? '').trim()
        )
            local.findings = 'Findings are required when an inspection fails.';
        if (Object.keys(local).length) {
            setErrors(local);
            return;
        }

        const [url, data] = payload();
        router.post(url, data, {
            preserveScroll: true,
            onStart: () => setBusy(true),
            onSuccess: () => onClose(), // workflow errors come back as an error toast from the server
            onError: (e) => setErrors(e as Record<string, string>),
            onFinish: () => setBusy(false),
        });
    }

    const Err = ({ k }: { k: string }) =>
        errors[k] ? (
            <p role="alert" className="mt-1 text-xs font-medium text-m-redtext">
                {errors[k]}
            </p>
        ) : null;
    const Hint = ({ children }: { children: ReactNode }) => (
        <span className="mt-1 block text-xs text-m-muted">{children}</span>
    );
    const Label = ({
        children,
        req,
    }: {
        children: ReactNode;
        req?: boolean;
    }) => (
        <span className="mb-1 block text-sm font-medium">
            {children}
            {req && <span className="text-m-red"> *</span>}
        </span>
    );
    const Check = ({
        checked,
        onChange,
        children,
    }: {
        checked: boolean;
        onChange: (v: boolean) => void;
        children: ReactNode;
    }) => (
        <label className="flex items-center gap-2 text-sm">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="size-4 rounded border-m-line accent-m-forest"
            />
            {children}
        </label>
    );
    const Radios = ({
        k,
        options,
    }: {
        k: string;
        options: [string, string][];
    }) => (
        <div className="flex flex-wrap gap-4">
            {options.map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                    <input
                        type="radio"
                        name={k}
                        checked={f[k] === v}
                        onChange={() => set(k, v)}
                        className="accent-m-forest"
                    />
                    {l}
                </label>
            ))}
        </div>
    );
    const Remarks = ({
        k = 'remarks',
        label = 'Remarks',
        req,
        placeholder,
    }: {
        k?: string;
        label?: string;
        req?: boolean;
        placeholder?: string;
    }) => (
        <label className="block">
            <Label req={req}>{label}</Label>
            <textarea
                rows={3}
                maxLength={2000}
                value={f[k] ?? ''}
                onChange={(e) => set(k, e.target.value)}
                placeholder={placeholder}
                className={input}
            />
            <Err k={k} />
        </label>
    );

    const [title, desc, cta] = kind ? titles[kind] : ['', '', ''];
    const blocked = kind === 'grant' && !acc.eligible_for_final_approval;
    const danger =
        kind === 'revoke' ||
        (kind === 'documents' && f.status === 'failed') ||
        (kind === 'inspection' && f.status === 'failed');

    return (
        <Dialog
            open={!!kind}
            onOpenChange={(o) => {
                if (!o && !busy) onClose();
            }}
        >
            <DialogContent
                className="max-h-[90vh] overflow-y-auto border-m-line bg-m-card text-m-body sm:max-w-lg"
                style={{ fontFamily: 'Inter, Arial, sans-serif' }}
            >
                {kind && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription className="text-sm leading-relaxed text-m-muted">
                                {desc}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {kind === 'documents' && (
                                <>
                                    <fieldset>
                                        <legend className="mb-1 text-sm font-medium">
                                            Originals physically checked
                                        </legend>
                                        <p className="mb-2 text-xs text-m-muted">
                                            Open the copy the rider uploaded to
                                            compare it with the original before
                                            you tick it.
                                        </p>
                                        <div className="space-y-2">
                                            {requiredDocuments.map((d) => {
                                                const up = documents.find(
                                                    (x) => x.type === d,
                                                );
                                                return (
                                                    <div
                                                        key={d}
                                                        className="flex items-center justify-between gap-3"
                                                    >
                                                        <Check
                                                            checked={!!f.checked?.[d]}
                                                            onChange={(v) =>
                                                                toggle('checked', d, v)
                                                            }
                                                        >
                                                            {docLabel[d] ?? humanize(d)}
                                                        </Check>
                                                        {up?.available && up.url ? (
                                                            <a
                                                                href={up.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-m-accent px-2.5 py-1 text-xs font-medium text-m-accent hover:bg-m-mint ${ring}`}
                                                            >
                                                                View uploaded copy
                                                            </a>
                                                        ) : (
                                                            <span className="shrink-0 text-xs text-m-red">
                                                                No file uploaded
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </fieldset>
                                    <div>
                                        <Label req>Result</Label>
                                        <Radios
                                            k="status"
                                            options={[
                                                ['verified', 'Verified'],
                                                ['failed', 'Failed'],
                                            ]}
                                        />
                                        <Err k="status" />
                                    </div>
                                    <label className="block">
                                        <Label>Office location</Label>
                                        <input
                                            value={f.office_location ?? ''}
                                            onChange={(e) =>
                                                set(
                                                    'office_location',
                                                    e.target.value,
                                                )
                                            }
                                            maxLength={255}
                                            className={input}
                                        />
                                        <Err k="office_location" />
                                    </label>
                                    <Remarks
                                        req={f.status === 'failed'}
                                        label={
                                            f.status === 'failed'
                                                ? 'Remarks (incomplete or invalid documents)'
                                                : 'Remarks'
                                        }
                                    />
                                </>
                            )}

                            {kind === 'orientation' && (
                                <>
                                    <label className="block">
                                        <Label req>Date and time</Label>
                                        <input
                                            type="datetime-local"
                                            value={f.scheduled_at ?? ''}
                                            onChange={(e) =>
                                                set(
                                                    'scheduled_at',
                                                    e.target.value,
                                                )
                                            }
                                            className={input}
                                        />
                                        <Err k="scheduled_at" />
                                    </label>
                                    <label className="block">
                                        <Label req>Location</Label>
                                        <input
                                            value={f.location ?? ''}
                                            onChange={(e) =>
                                                set('location', e.target.value)
                                            }
                                            maxLength={255}
                                            className={input}
                                        />
                                        <Err k="location" />
                                    </label>
                                    <label className="block">
                                        <Label req>Facilitator</Label>
                                        <select
                                            value={f.facilitator_id ?? ''}
                                            onChange={(e) =>
                                                set(
                                                    'facilitator_id',
                                                    e.target.value,
                                                )
                                            }
                                            className={input}
                                        >
                                            <option value="">
                                                Select a staff member
                                            </option>
                                            {staff.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.full_name}
                                                </option>
                                            ))}
                                        </select>
                                        <Err k="facilitator_id" />
                                    </label>
                                    <Remarks />
                                </>
                            )}

                            {kind === 'orientation-result' && (
                                <>
                                    <Check
                                        checked={!!f.attended}
                                        onChange={(v) => {
                                            set('attended', v);
                                            if (!v) set('result', 'failed');
                                        }}
                                    >
                                        The rider attended the orientation
                                    </Check>
                                    <div>
                                        <Label req>Result</Label>
                                        <Radios
                                            k="result"
                                            options={[
                                                ['completed', 'Completed'],
                                                ['failed', 'Failed'],
                                            ]}
                                        />
                                        <Err k="result" />
                                    </div>
                                    <Remarks req={f.result === 'failed'} />
                                </>
                            )}

                            {kind === 'inspection' && (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="block">
                                            <Label req>Make</Label>
                                            <input
                                                value={f.make ?? ''}
                                                onChange={(e) =>
                                                    set('make', e.target.value)
                                                }
                                                maxLength={60}
                                                placeholder="Brand, e.g. Honda, Yamaha"
                                                className={input}
                                            />
                                            <Hint>
                                                The motorcycle brand shown on
                                                the OR/CR.
                                            </Hint>
                                            <Err k="make" />
                                        </label>
                                        <label className="block">
                                            <Label req>Model</Label>
                                            <input
                                                value={f.model ?? ''}
                                                onChange={(e) =>
                                                    set('model', e.target.value)
                                                }
                                                maxLength={60}
                                                placeholder="e.g. Click 125, Mio i125"
                                                className={input}
                                            />
                                            <Hint>
                                                The specific motorcycle model.
                                            </Hint>
                                            <Err k="model" />
                                        </label>
                                        <label className="block">
                                            <Label req>Plate number</Label>
                                            <input
                                                value={f.plate_number ?? ''}
                                                onChange={(e) =>
                                                    set(
                                                        'plate_number',
                                                        e.target.value,
                                                    )
                                                }
                                                maxLength={30}
                                                placeholder="e.g. ABC 1234"
                                                className={`${input} font-mono uppercase`}
                                            />
                                            <Hint>
                                                Number on the license plate.
                                            </Hint>
                                            <Err k="plate_number" />
                                        </label>
                                        <label className="block">
                                            <Label req>
                                                Registration number
                                            </Label>
                                            <input
                                                value={
                                                    f.registration_number ?? ''
                                                }
                                                onChange={(e) =>
                                                    set(
                                                        'registration_number',
                                                        e.target.value,
                                                    )
                                                }
                                                maxLength={60}
                                                placeholder="MV File No. from the CR"
                                                className={input}
                                            />
                                            <Hint>
                                                The LTO MV File Number printed
                                                on the CR (not the plate
                                                number).
                                            </Hint>
                                            <Err k="registration_number" />
                                        </label>
                                        <label className="block">
                                            <Label req>
                                                Registration expiry
                                            </Label>
                                            <input
                                                type="date"
                                                value={
                                                    f.registration_expiry ?? ''
                                                }
                                                onChange={(e) =>
                                                    set(
                                                        'registration_expiry',
                                                        e.target.value,
                                                    )
                                                }
                                                className={input}
                                            />
                                            <Hint>
                                                Registration validity date on
                                                the OR/CR.
                                            </Hint>
                                            <Err k="registration_expiry" />
                                        </label>
                                        <label className="block">
                                            <Label req>Condition</Label>
                                            <select
                                                value={f.condition ?? 'good'}
                                                onChange={(e) =>
                                                    set(
                                                        'condition',
                                                        e.target.value,
                                                    )
                                                }
                                                className={input}
                                            >
                                                {[
                                                    'excellent',
                                                    'good',
                                                    'fair',
                                                    'poor',
                                                ].map((c) => (
                                                    <option key={c} value={c}>
                                                        {humanize(c)}
                                                    </option>
                                                ))}
                                            </select>
                                            <Err k="condition" />
                                        </label>
                                    </div>
                                    <fieldset>
                                        <legend className="mb-1 text-sm font-medium">
                                            Required safety equipment present
                                        </legend>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {requiredEquipment.map((k) => (
                                                <Check
                                                    key={k}
                                                    checked={!!f.equipment?.[k]}
                                                    onChange={(v) =>
                                                        toggle(
                                                            'equipment',
                                                            k,
                                                            v,
                                                        )
                                                    }
                                                >
                                                    {humanize(k)}
                                                </Check>
                                            ))}
                                        </div>
                                    </fieldset>
                                    <Check
                                        checked={!!f.roadworthy}
                                        onChange={(v) => set('roadworthy', v)}
                                    >
                                        Motorcycle is roadworthy
                                    </Check>
                                    <div>
                                        <Label req>Result</Label>
                                        <Radios
                                            k="status"
                                            options={[
                                                ['passed', 'Passed'],
                                                ['failed', 'Failed'],
                                            ]}
                                        />
                                        <Err k="status" />
                                    </div>
                                    <Remarks
                                        k="findings"
                                        label="Findings"
                                        req={f.status === 'failed'}
                                        placeholder="What you found, e.g. worn brake pads, broken signal light. Required if Failed."
                                    />
                                    <Remarks k="remarks" label="Remarks" />
                                </>
                            )}

                            {kind === 'grant' &&
                                (blocked ? (
                                    <div
                                        role="alert"
                                        className="rounded-md border border-m-red/30 bg-m-red/5 p-3 text-sm"
                                    >
                                        <p className="font-semibold text-m-redtext">
                                            Accreditation cannot be granted yet.
                                            Still missing:
                                        </p>
                                        <ul className="mt-1 list-disc pl-5">
                                            {acc.missing_requirements.map(
                                                (m) => (
                                                    <li key={m}>{m}</li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                ) : (
                                    <Remarks label="Remarks (optional)" />
                                ))}

                            {kind === 'revoke' && (
                                <label className="block">
                                    <Label req>Reason</Label>
                                    <textarea
                                        rows={4}
                                        maxLength={1000}
                                        value={f.reason ?? ''}
                                        onChange={(e) =>
                                            set('reason', e.target.value)
                                        }
                                        className={input}
                                    />
                                    <Err k="reason" />
                                </label>
                            )}
                            {kind === 'remarks' && (
                                <Remarks label="Remarks" req />
                            )}
                        </div>

                        <DialogFooter>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={busy}
                                className="rounded-md border border-m-line px-4 py-2 text-sm font-medium hover:bg-m-page disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={busy || blocked}
                                className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${danger ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-m-forest hover:bg-m-forest-hover'}`}
                            >
                                {busy && (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden
                                    />
                                )}
                                {busy ? 'Saving…' : cta}
                            </button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/* ------------------------------------------------------------------ the tracker */
export default function RiderAccreditationPanel(props: Props) {
    const {
        rider,
        accreditation: acc,
        staff,
        currentStaffId,
        onApplicationAction,
    } = props;
    const [kind, setKind] = useState<Kind | null>(null);

    const s = acc.statuses;
    const doc = latest(acc.document_verifications)[0];
    const ori = latest(acc.orientations)[0];
    const openOri = latest(acc.orientations).find(
        (o) => o.status === 'scheduled',
    );
    const ins = latest(acc.inspections)[0];
    const me = staff.find((x) => x.id === currentStaffId);
    const canRecordOrientation =
        !!openOri &&
        (me?.role === 'super_admin' ||
            openOri.facilitator?.id === currentStaffId);
    const accredited = s.accreditation === 'accredited';
    const locked = accredited; // completed stages change only after revoking

    const stages = useMemo(() => {
        const st = (
            done: boolean,
            failed: boolean,
            started: boolean,
        ): StageState =>
            done
                ? 'complete'
                : failed
                  ? 'failed'
                  : started
                    ? 'current'
                    : 'locked';
        const appr = s.application === 'approved';
        return [
            {
                n: 1,
                title: 'Online Registration',
                status: 'Submitted',
                state: 'complete' as StageState,
                date: rider.created_at,
                staff: null as string | null,
                remarks: null as string | null,
                actions: null as ReactNode,
            },
            {
                n: 2,
                title: 'Initial Application Review',
                status: humanize(
                    s.application === 'pending'
                        ? 'pending review'
                        : s.application,
                ),
                state: st(appr, s.application === 'rejected', true),
                date: rider.reviewed_at,
                staff: null,
                remarks: rider.rejection_reason,
                actions: s.application !== 'approved' && (
                    <>
                        <Btn
                            tone="green"
                            onClick={() => onApplicationAction('approve')}
                        >
                            <Check className="size-3.5" aria-hidden />
                            Approve
                        </Btn>
                        {s.application === 'pending' && (
                            <Btn
                                tone="red"
                                onClick={() => onApplicationAction('reject')}
                            >
                                <X className="size-3.5" aria-hidden />
                                Reject
                            </Btn>
                        )}
                    </>
                ),
            },
            {
                n: 3,
                title: 'Face-to-Face Document Verification',
                status: humanize(s.document_verification),
                state: st(
                    s.document_verification === 'verified',
                    s.document_verification === 'failed',
                    appr,
                ),
                date: doc?.verified_at ?? null,
                staff: doc?.verifier?.full_name ?? null,
                remarks: doc?.remarks ?? null,
                actions: appr && !locked && (
                    <Btn onClick={() => setKind('documents')}>
                        {doc ? 'Record new result' : 'Record verification'}
                    </Btn>
                ),
            },
            {
                n: 4,
                title: 'Rider Orientation',
                status: humanize(s.orientation),
                state: st(
                    s.orientation === 'completed',
                    s.orientation === 'failed',
                    s.document_verification === 'verified',
                ),
                date: openOri
                    ? openOri.scheduled_at
                    : (ori?.completed_at ?? ori?.scheduled_at ?? null),
                staff: (openOri ?? ori)?.facilitator?.full_name ?? null,
                remarks: ori?.remarks ?? null,
                actions: s.document_verification === 'verified' &&
                    !locked &&
                    s.orientation !== 'completed' && (
                        <>
                            <Btn onClick={() => setKind('orientation')}>
                                {openOri
                                    ? 'Reschedule'
                                    : 'Schedule orientation'}
                            </Btn>
                            {openOri && (
                                <Btn
                                    tone="outline"
                                    disabled={!canRecordOrientation}
                                    onClick={() =>
                                        setKind('orientation-result')
                                    }
                                >
                                    Record attendance / result
                                </Btn>
                            )}
                        </>
                    ),
                extra: openOri
                    ? `Scheduled ${formatDate(openOri.scheduled_at, true)} at ${openOri.location}`
                    : ori
                      ? `Last session: ${formatDate(ori.scheduled_at, true)} at ${ori.location}${ori.attended === null ? '' : ori.attended ? ' (attended)' : ' (did not attend)'}`
                      : null,
            },
            {
                n: 5,
                title: 'Motorcycle Inspection',
                status: humanize(s.motorcycle_inspection),
                state: st(
                    s.motorcycle_inspection === 'passed',
                    s.motorcycle_inspection === 'failed',
                    s.orientation === 'completed',
                ),
                date: ins?.inspected_at ?? null,
                staff: ins?.inspector?.full_name ?? null,
                remarks: ins
                    ? [ins.findings, ins.remarks].filter(Boolean).join(' · ') ||
                      null
                    : null,
                actions: s.orientation === 'completed' &&
                    !locked &&
                    s.motorcycle_inspection !== 'passed' && (
                        <Btn onClick={() => setKind('inspection')}>
                            {ins ? 'Record reinspection' : 'Record inspection'}
                        </Btn>
                    ),
                extra: ins
                    ? `${ins.make} ${ins.model} · ${ins.plate_number} · ${humanize(ins.condition)}${ins.roadworthy ? ', roadworthy' : ', not roadworthy'}`
                    : `Plate on application: ${rider.motorcycle_plate_number}`,
            },
            {
                n: 6,
                title: 'Final Accreditation',
                status: humanize(s.accreditation),
                state: st(
                    accredited,
                    s.accreditation === 'revoked',
                    s.accreditation === 'for_final_approval',
                ),
                date: acc.accredited_at,
                staff: null,
                remarks:
                    s.accreditation === 'revoked'
                        ? acc.revocation_reason
                        : null,
                actions: accredited ? (
                    <Btn tone="red" onClick={() => setKind('revoke')}>
                        Revoke accreditation
                    </Btn>
                ) : (
                    <Btn tone="green" onClick={() => setKind('grant')}>
                        <Award className="size-3.5" aria-hidden />
                        Grant final accreditation
                    </Btn>
                ),
            },
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [acc, rider, canRecordOrientation, locked]);

    const accreditedBy = accredited
        ? (acc.history.find((h) => h.action === 'accreditation.granted')?.actor
              ?.full_name ?? null)
        : null;
    const history = latest(acc.history);

    return (
        <section
            className="mb-6 rounded-lg border border-m-line bg-m-card shadow-sm"
            aria-labelledby="accreditation-heading"
        >
            <div className="flex flex-col gap-3 border-b border-m-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3
                        id="accreditation-heading"
                        className="text-base font-semibold"
                    >
                        Accreditation Progress
                    </h3>
                    <Meta>
                        Every stage is recorded separately. Online approval
                        alone never allows bookings.
                    </Meta>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-m-muted">
                    Accreditation{' '}
                    <AccreditationBadge status={s.accreditation} />
                    <span
                        className={`rounded px-2 py-0.5 font-medium ${acc.can_accept_bookings ? 'bg-m-green/10 text-m-green' : 'bg-m-red/10 text-m-red'}`}
                    >
                        {acc.can_accept_bookings
                            ? 'Can accept bookings'
                            : 'Cannot accept bookings'}
                    </span>
                </div>
            </div>

            <div className="p-4">
                {!acc.eligible_for_final_approval && !accredited && (
                    <div className="mb-4 flex gap-3 rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/5 p-3 text-sm text-m-amber">
                        <ShieldAlert
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                        />
                        <div>
                            <p className="font-semibold">
                                Not yet eligible for final accreditation
                            </p>
                            <ul className="mt-1 list-disc pl-5">
                                {acc.missing_requirements.map((m) => (
                                    <li key={m}>{m}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
                {s.account !== 'active' && (
                    <p
                        role="status"
                        className="mb-4 rounded-md border border-m-ink/30 bg-m-solid/5 px-3 py-2 text-sm text-m-ink"
                    >
                        Account is {s.account}: this rider cannot accept
                        bookings regardless of accreditation.
                    </p>
                )}

                <ol className="space-y-3">
                    {stages.map((g) => {
                        const style = stateStyle[g.state];
                        const Icon =
                            g.state === 'complete'
                                ? Check
                                : g.state === 'failed'
                                  ? X
                                  : g.state === 'current'
                                    ? Clock
                                    : Lock;
                        return (
                            <li
                                key={g.n}
                                className={`rounded-lg border p-3 sm:p-4 ${style.card}`}
                            >
                                <div className="flex gap-3">
                                    <span
                                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.dot}`}
                                        aria-hidden
                                    >
                                        <Icon className="size-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <h4 className="text-sm font-semibold">
                                                {g.n}. {g.title}
                                            </h4>
                                            <span className="rounded bg-m-card px-2 py-0.5 text-xs font-medium ring-1 ring-m-line">
                                                {g.status}
                                            </span>
                                            <span className="text-xs text-m-muted">
                                                {style.label}
                                            </span>
                                        </div>
                                        <dl className="mt-1 grid gap-x-6 gap-y-0.5 text-xs text-m-muted sm:grid-cols-2">
                                            <div>
                                                <dt className="inline">
                                                    Date:{' '}
                                                </dt>
                                                <dd className="inline text-m-body">
                                                    {g.date
                                                        ? formatDate(
                                                              g.date,
                                                              true,
                                                          )
                                                        : '—'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="inline">
                                                    Staff:{' '}
                                                </dt>
                                                <dd className="inline text-m-body">
                                                    {g.n === 6
                                                        ? (accreditedBy ?? '—')
                                                        : (g.staff ?? '—')}
                                                </dd>
                                            </div>
                                        </dl>
                                        {'extra' in g && g.extra && (
                                            <p className="mt-1 text-xs text-m-muted">
                                                {g.extra}
                                            </p>
                                        )}
                                        {g.remarks && (
                                            <p className="mt-1 text-sm whitespace-pre-line">
                                                <span className="font-medium">
                                                    Remarks:{' '}
                                                </span>
                                                {g.remarks}
                                            </p>
                                        )}
                                        {g.actions && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {g.actions}
                                            </div>
                                        )}
                                        {g.n === 4 &&
                                            openOri &&
                                            !canRecordOrientation && (
                                                <p className="mt-2 text-xs text-m-muted">
                                                    Only the assigned
                                                    facilitator (
                                                    {openOri.facilitator
                                                        ?.full_name ??
                                                        'unknown'}
                                                    ) or a super administrator
                                                    can record the result.
                                                </p>
                                            )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>

                <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md border border-m-line p-3 text-sm">
                    <div className="min-w-0">
                        <p className="font-medium">Administrative remarks</p>
                        <p className="mt-0.5 whitespace-pre-line text-m-muted">
                            {acc.admin_remarks ?? 'No remarks recorded.'}
                        </p>
                    </div>
                    <Btn tone="outline" onClick={() => setKind('remarks')}>
                        Edit remarks
                    </Btn>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">
                            Inspection history
                        </h4>
                        {acc.inspections.length === 0 ? (
                            <p className="text-sm text-m-muted">
                                No inspections recorded yet.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {latest(acc.inspections).map((i) => (
                                    <li
                                        key={i.id}
                                        className="rounded-md border border-m-line p-3 text-sm"
                                    >
                                        <p className="font-medium">
                                            {humanize(i.status)} · {i.make}{' '}
                                            {i.model} ({i.plate_number})
                                        </p>
                                        <Meta>
                                            {formatDate(i.inspected_at, true)}
                                            {i.inspector
                                                ? ` · inspector ${i.inspector.full_name}`
                                                : ''}
                                        </Meta>
                                        <Meta>
                                            Missing equipment:{' '}
                                            {Object.entries(i.safety_equipment)
                                                .filter(([, v]) => !v)
                                                .map(([k]) => humanize(k))
                                                .join(', ') || 'none'}
                                        </Meta>
                                        {(i.findings || i.remarks) && (
                                            <p className="mt-1 whitespace-pre-line">
                                                {[i.findings, i.remarks]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">
                            Verification and orientation records
                        </h4>
                        {acc.document_verifications.length +
                            acc.orientations.length ===
                        0 ? (
                            <p className="text-sm text-m-muted">
                                Nothing recorded yet.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {latest(acc.document_verifications).map((d) => (
                                    <li
                                        key={`d${d.id}`}
                                        className="rounded-md border border-m-line p-3 text-sm"
                                    >
                                        <p className="font-medium">
                                            Documents: {humanize(d.status)}
                                        </p>
                                        <Meta>
                                            {formatDate(d.verified_at, true)}
                                            {d.verifier
                                                ? ` · ${d.verifier.full_name}`
                                                : ''}
                                            {d.office_location
                                                ? ` · ${d.office_location}`
                                                : ''}
                                        </Meta>
                                        {d.remarks && (
                                            <p className="mt-1 whitespace-pre-line">
                                                {d.remarks}
                                            </p>
                                        )}
                                    </li>
                                ))}
                                {latest(acc.orientations).map((o) => (
                                    <li
                                        key={`o${o.id}`}
                                        className="rounded-md border border-m-line p-3 text-sm"
                                    >
                                        <p className="font-medium">
                                            Orientation: {humanize(o.status)}
                                        </p>
                                        <Meta>
                                            {formatDate(o.scheduled_at, true)} ·{' '}
                                            {o.location}
                                            {o.facilitator
                                                ? ` · facilitator ${o.facilitator.full_name}`
                                                : ''}
                                        </Meta>
                                        {o.remarks && (
                                            <p className="mt-1 whitespace-pre-line">
                                                {o.remarks}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="mt-6">
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <History
                            className="size-4 text-m-muted"
                            aria-hidden
                        />
                        Accreditation audit trail
                    </h4>
                    {history.length === 0 ? (
                        <p className="flex items-center gap-2 text-sm text-m-muted">
                            <CircleDashed className="size-4" aria-hidden />
                            No accreditation actions recorded yet.
                        </p>
                    ) : (
                        <ol className="space-y-3">
                            {history.map((h) => (
                                <li key={h.id} className="flex gap-3 text-sm">
                                    <span
                                        className="mt-1.5 size-2.5 shrink-0 rounded-full bg-m-forest"
                                        aria-hidden
                                    />
                                    <div className="min-w-0">
                                        <p className="font-medium">
                                            {humanize(
                                                h.action.replace('.', ' '),
                                            )}
                                            {h.from_status || h.to_status ? (
                                                <span className="font-normal text-m-muted">
                                                    {' '}
                                                    ({h.from_status ??
                                                        '—'} →{' '}
                                                    {h.to_status ?? '—'})
                                                </span>
                                            ) : null}
                                        </p>
                                        <Meta>
                                            {formatDate(h.created_at, true)}
                                            {h.actor
                                                ? ` · by ${h.actor.full_name}`
                                                : ''}
                                        </Meta>
                                        {h.remarks && (
                                            <p className="mt-0.5 whitespace-pre-line">
                                                {h.remarks}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>

            <FormDialog
                kind={kind}
                onClose={() => setKind(null)}
                ctx={{
                    rider: props.rider,
                    accreditation: acc,
                    staff,
                    currentStaffId,
                    requiredEquipment: props.requiredEquipment,
                    requiredDocuments: props.requiredDocuments,
                    documents: props.documents,
                }}
            />
        </section>
    );
}