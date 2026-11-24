import { router } from '@inertiajs/react';
import { CheckCircle2, Loader2, Search, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export type ComplaintAction = 'investigate' | 'resolve' | 'reject';
export type ComplaintRef = { id: string; status: string };
export type PenaltyInfo = {
    can_uphold: boolean;
    suggested_severity?: string;
    active_points?: number;
    points?: Record<string, number>;
    suggestions?: Record<string, string>;
    actions?: { key: string; label: string }[];
    expiry_days?: number;
    /** Support requests have no finding and carry no points. */
    is_support?: boolean;
};

export const pretty = (s: string) => s.replace(/_/g, ' ');

const statusTone: Record<string, string> = {
    pending: 'bg-[#F59E0B]/10 text-m-amber',
    under_investigation: 'bg-[#7C3AED]/10 text-m-purple',
    resolved: 'bg-m-green/10 text-m-green',
    rejected: 'bg-m-red/10 text-m-red',
};
const pill =
    'inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium capitalize';

export const ComplaintStatusBadge = ({ status }: { status: string }) => (
    <span className={`${pill} ${statusTone[status] ?? 'bg-m-page text-m-muted'}`}>
        {pretty(status)}
    </span>
);

const kindTone: Record<string, string> = {
    complaint: 'bg-[#F59E0B]/10 text-m-amber',
    support: 'bg-[#2563EB]/10 text-[#2563EB]',
    incident: 'bg-m-red/10 text-m-red',
};
const kindLabel: Record<string, string> = {
    complaint: 'Complaint',
    support: 'Support request',
    incident: 'Incident',
};

/** The report type: Complaint, Support request or Incident. */
export const TypeBadge = ({ type }: { type: string }) => (
    <span className={`${pill} ${kindTone[type] ?? 'bg-m-page text-m-muted'}`}>{kindLabel[type] ?? type}</span>
);

/** Incident reports are safety reports: flagged and listed first. */
export const SafetyBadge = () => (
    <span className={`${pill} bg-m-red text-white`}>Safety</span>
);

export const ReporterBadge = ({ type }: { type: string }) => (
    <span className={`${pill} bg-m-page text-m-body`}>{type}</span>
);

export function allowedActions(status: string): ComplaintAction[] {
    if (status === 'pending') return ['investigate', 'reject'];
    if (status === 'under_investigation') return ['resolve', 'reject'];
    return [];
}

type Def = {
    label: string;
    title: string;
    text: string;
    confirm: string;
    reasonLabel: string | null;
    placeholder: string;
    button: string;
    outline: string;
    icon: typeof Search;
};

export const actionDefs: Record<ComplaintAction, Def> = {
    investigate: {
        label: 'Start review',
        title: 'Start review',
        text: 'The report will be marked as in progress and assigned to you. The person who filed it is notified.',
        confirm: 'Start review',
        reasonLabel: null,
        placeholder: '',
        button: 'bg-m-forest text-white hover:bg-m-forest-hover',
        outline: 'border-m-accent text-m-accent hover:bg-m-mint',
        icon: Search,
    },
    resolve: {
        label: 'Resolve',
        title: 'Resolve report',
        text: 'Describe what was done (and, for complaints and incidents, record your finding). The note is sent to the person who filed it, and a resolved report cannot be reopened.',
        confirm: 'Resolve report',
        reasonLabel: 'Resolution note',
        placeholder: 'Describe how this was resolved…',
        button: 'bg-m-forest text-white hover:bg-m-forest-hover',
        outline: 'border-m-green/40 text-m-green hover:bg-m-green/10',
        icon: CheckCircle2,
    },
    reject: {
        label: 'Reject',
        title: 'Reject report',
        text: 'Explain why this is not accepted. The reason is sent to the person who filed it, and a rejected report cannot be reopened.',
        confirm: 'Reject report',
        reasonLabel: 'Rejection reason',
        placeholder: 'Explain why this complaint is being rejected…',
        button: 'bg-m-red text-white hover:opacity-90',
        outline: 'border-m-red/40 text-m-red hover:bg-m-red/10',
        icon: XCircle,
    },
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

export function ActionButtons({
    complaint,
    onAction,
}: {
    complaint: ComplaintRef;
    onAction: (a: ComplaintAction) => void;
}) {
    return (
        <>
            {allowedActions(complaint.status).map((a) => (
                <button
                    key={a}
                    type="button"
                    onClick={() => onAction(a)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${actionDefs[a].outline} ${ring}`}
                >
                    {actionDefs[a].label}
                </button>
            ))}
        </>
    );
}

export function ComplaintActionDialog({
    complaint,
    action,
    onClose,
    penalty = null,
}: {
    complaint: ComplaintRef | null;
    action: ComplaintAction | null;
    onClose: () => void;
    /** Penalty details of the party the complaint is against. Only the review page has them (the list does not). */
    penalty?: PenaltyInfo | null;
}) {
    const [reason, setReason] = useState('');
    const [finding, setFinding] = useState<'' | 'upheld' | 'not_upheld'>('');
    const [severity, setSeverity] = useState('minor');
    const [penaltyAction, setPenaltyAction] = useState('none');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const open = !!complaint && !!action;
    const def = action ? actionDefs[action] : null;

    useEffect(() => {
        if (open) {
            setReason('');
            setError(null);
            setBusy(false);
            setFinding('');
            const sev = penalty?.suggested_severity ?? 'minor';
            setSeverity(sev);
            setPenaltyAction(penalty?.suggestions?.[sev] ?? 'none');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, complaint?.id, action]);

    // Resolving needs the finding and penalty options, which live on the review page: the list sends you there.
    useEffect(() => {
        if (open && action === 'resolve' && !penalty && complaint) {
            router.visit(`/admin/complaints/${complaint.id}?resolve=1`);
            onClose();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, action, penalty, complaint?.id]);

    const isSupport = !!penalty?.is_support;
    // A support request is simply answered: no finding, no points.
    const resolving = action === 'resolve' && !!penalty && !isSupport;
    const upheld = resolving && finding === 'upheld';
    const after = upheld && penalty?.points ? (penalty.active_points ?? 0) + (penalty.points[severity] ?? 0) : 0;

    function submit() {
        if (!complaint || !action || !def || busy) return;
        if (resolving && !finding) {
            setError('Choose whether the report is upheld or not.');
            return;
        }
        if (def.reasonLabel && reason.trim().length < 5) {
            setError('Please write at least 5 characters.');
            return;
        }
        const body: Record<string, string> = def.reasonLabel ? { reason: reason.trim() } : {};
        if (action === 'resolve' && isSupport) body.finding = 'not_upheld';
        if (resolving) {
            body.finding = finding;
            if (upheld) {
                body.severity = severity;
                body.action = penaltyAction;
            }
        }
        router.post(
            `/admin/complaints/${complaint.id}/${action}`,
            body,
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onSuccess: () => onClose(),
                onError: (e) =>
                    setError(
                        e.reason ??
                            e.finding ??
                            e.severity ??
                            e.action ??
                            'Something went wrong. Please try again.',
                    ),
                onFinish: () => setBusy(false),
            },
        );
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o && !busy) onClose();
            }}
        >
            <DialogContent
                className={`border-m-line bg-m-card text-m-body ${resolving ? 'sm:max-w-lg' : 'sm:max-w-md'}`}
                style={{ fontFamily: 'Inter, Arial, sans-serif' }}
            >
                {complaint && def && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{def.title}</DialogTitle>
                            <DialogDescription className="text-sm leading-relaxed text-m-muted">
                                {def.text}
                            </DialogDescription>
                        </DialogHeader>
                        {resolving && !penalty?.can_uphold && (
                            <p className="rounded-md border border-m-line bg-m-page px-3 py-2 text-xs text-m-muted">
                                This report has no one recorded as the person it is against, so it can only be
                                closed with no violation found.
                            </p>
                        )}
                        {resolving && (
                            <fieldset className="space-y-3">
                                <legend className="mb-1.5 text-sm font-medium">
                                    Finding <span className="text-m-red">*</span>
                                </legend>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {(
                                        [
                                            ['upheld', 'Upheld', 'A violation happened. Penalty points are added.'],
                                            ['not_upheld', 'Not upheld', 'No violation found. No points are added.'],
                                        ] as const
                                    ).map(([value, label, hint]) => (
                                        <label
                                            key={value}
                                            className={`flex cursor-pointer flex-col rounded-md border px-3 py-2 text-sm ${finding === value ? 'border-m-accent bg-m-mint' : 'border-m-line'} ${value === 'upheld' && !penalty?.can_uphold ? 'cursor-not-allowed opacity-50' : ''}`}
                                        >
                                            <span className="flex items-center gap-2 font-medium">
                                                <input
                                                    type="radio"
                                                    name="complaint-finding"
                                                    value={value}
                                                    checked={finding === value}
                                                    disabled={busy || (value === 'upheld' && !penalty?.can_uphold)}
                                                    onChange={() => {
                                                        setFinding(value);
                                                        setError(null);
                                                    }}
                                                />
                                                {label}
                                            </span>
                                            <span className="mt-0.5 text-xs text-m-muted">{hint}</span>
                                        </label>
                                    ))}
                                </div>

                                {upheld && penalty && (
                                    <div className="space-y-3 rounded-md border border-m-line bg-m-page p-3">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <label htmlFor="penalty-severity" className="mb-1 block text-xs font-medium">
                                                    How serious?
                                                </label>
                                                <select
                                                    id="penalty-severity"
                                                    value={severity}
                                                    disabled={busy}
                                                    onChange={(e) => {
                                                        setSeverity(e.target.value);
                                                        setPenaltyAction(penalty.suggestions?.[e.target.value] ?? 'none');
                                                    }}
                                                    className="w-full rounded-md border border-m-line bg-m-card px-2.5 py-2 text-sm outline-none focus:border-m-accent"
                                                >
                                                    <option value="minor">Minor (+{penalty.points?.minor ?? 1} point)</option>
                                                    <option value="serious">Serious (+{penalty.points?.serious ?? 3} points)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="penalty-action" className="mb-1 block text-xs font-medium">
                                                    Action
                                                </label>
                                                <select
                                                    id="penalty-action"
                                                    value={penaltyAction}
                                                    disabled={busy}
                                                    onChange={(e) => setPenaltyAction(e.target.value)}
                                                    className="w-full rounded-md border border-m-line bg-m-card px-2.5 py-2 text-sm outline-none focus:border-m-accent"
                                                >
                                                    {penalty.actions?.map((a) => (
                                                        <option key={a.key} value={a.key}>
                                                            {a.label}
                                                            {penalty.suggestions?.[severity] === a.key ? ' (suggested)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <p className="text-xs text-m-muted">
                                            Active points now: <strong>{penalty.active_points ?? 0}</strong>. After this:{' '}
                                            <strong>{after}</strong>. Points expire after {penalty.expiry_days ?? 90} days. The
                                            person is told the outcome, but never who reported them or what was written.
                                        </p>
                                    </div>
                                )}
                            </fieldset>
                        )}
                        {def.reasonLabel && (
                            <div>
                                <label
                                    htmlFor="complaint-action-reason"
                                    className="mb-1.5 block text-sm font-medium"
                                >
                                    {def.reasonLabel} <span className="text-m-red">*</span>
                                </label>
                                <textarea
                                    id="complaint-action-reason"
                                    rows={4}
                                    maxLength={1000}
                                    value={reason}
                                    onChange={(e) => {
                                        setReason(e.target.value);
                                        setError(null);
                                    }}
                                    disabled={busy}
                                    aria-invalid={!!error}
                                    className={`w-full rounded-md border bg-m-card px-3 py-2 text-sm outline-none focus:border-m-accent focus:ring-2 focus:ring-m-accent/20 ${error ? 'border-m-red' : 'border-m-line'}`}
                                    placeholder={def.placeholder}
                                />
                            </div>
                        )}
                        {error && (
                            <p role="alert" className="text-xs font-medium text-m-redtext">
                                {error}
                            </p>
                        )}
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
                                disabled={busy}
                                className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${def.button}`}
                            >
                                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                                {busy ? 'Saving…' : def.confirm}
                            </button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}