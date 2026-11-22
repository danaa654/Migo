import { router } from '@inertiajs/react';
import {
    CheckCircle2,
    Loader2,
    PauseCircle,
    PlayCircle,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export type RiderAction = 'approve' | 'reject' | 'suspend' | 'reactivate';
export type RiderRef = { id: string; full_name: string };
export type RiderStatuses = {
    application_status: string;
    account_status: string;
};

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
export const initialsOf = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?';

const verificationTone: Record<string, string> = {
    pending: 'bg-[#F59E0B]/10 text-m-amber',
    approved: 'bg-m-green/10 text-m-green',
    rejected: 'bg-m-red/10 text-m-red',
};
const accreditationTone: Record<string, string> = {
    not_accredited: 'bg-m-page text-m-muted',
    for_final_approval: 'bg-[#7C3AED]/10 text-m-purple',
    accredited: 'bg-m-green/10 text-m-green',
    revoked: 'bg-m-red/10 text-m-red',
};
const accountTone: Record<string, string> = {
    inactive: 'bg-m-page text-m-muted',
    active: 'bg-m-forest/10 text-m-accent-hover',
    suspended: 'bg-m-solid/10 text-m-ink',
};
const pill =
    'inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium capitalize';

export const VerificationBadge = ({ status }: { status: string }) => (
    <span
        className={`${pill} ${verificationTone[status] ?? 'bg-m-page text-m-muted'}`}
    >
        {status}
    </span>
);
export const AccreditationBadge = ({ status }: { status: string }) => (
    <span
        className={`${pill} ${accreditationTone[status] ?? 'bg-m-page text-m-muted'}`}
    >
        {status.replace(/_/g, ' ')}
    </span>
);
export const AccountBadge = ({ status }: { status: string }) => (
    <span
        className={`${pill} ${accountTone[status] ?? 'bg-m-page text-m-muted'}`}
    >
        {status}
    </span>
);

/** Which actions make sense for the rider's current state (the server re-checks every one of them). */
export function allowedActions(r: RiderStatuses): RiderAction[] {
    const out: RiderAction[] = [];
    if (r.application_status !== 'approved') out.push('approve');
    if (r.application_status === 'pending') out.push('reject');
    if (r.account_status === 'suspended') out.push('reactivate');
    else out.push('suspend');
    return out;
}

type Def = {
    label: string;
    icon: LucideIcon;
    button: string;
    confirm: string;
    needsReason: boolean;
    title: string;
    text: (n: string) => string;
};

export const actionDefs: Record<RiderAction, Def> = {
    approve: {
        label: 'Approve',
        icon: CheckCircle2,
        button: 'bg-[#16A36A] hover:bg-[#12875A] text-white',
        confirm: 'Approve Application',
        needsReason: false,
        title: 'Approve this application?',
        text: (n) =>
            `${n}'s online application will be marked Approved and the rider will be notified. This is only the first step: the rider still needs face-to-face document verification, orientation, motorcycle inspection and final accreditation before they can accept bookings.`,
    },
    reject: {
        label: 'Reject',
        icon: XCircle,
        button: 'bg-[#DC2626] hover:bg-[#B91C1C] text-white',
        confirm: 'Reject Application',
        needsReason: true,
        title: 'Reject this application?',
        text: (n) =>
            `${n} will be notified and will not be able to accept service requests. The reason you enter is saved and shown to the rider.`,
    },
    suspend: {
        label: 'Suspend',
        icon: PauseCircle,
        button: 'bg-[#DC2626] hover:bg-[#B91C1C] text-white',
        confirm: 'Suspend Account',
        needsReason: true,
        title: 'Suspend this rider account?',
        text: (n) =>
            `${n} will lose access to restricted rider functions and cannot accept service requests until reactivated. The rider will be notified.`,
    },
    reactivate: {
        label: 'Reactivate',
        icon: PlayCircle,
        button: 'bg-m-forest hover:bg-m-forest-hover text-white',
        confirm: 'Reactivate Account',
        needsReason: false,
        title: 'Reactivate this rider account?',
        text: (n) =>
            `${n}'s account will be active again and the rider will be notified.`,
    },
};

const outline =
    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const tone: Record<RiderAction, string> = {
    approve: 'border-m-green text-m-green hover:bg-m-green/5',
    reject: 'border-m-red text-m-red hover:bg-m-red/5',
    suspend: 'border-m-red text-m-red hover:bg-m-red/5',
    reactivate: 'border-m-accent text-m-accent hover:bg-m-mint',
};

/** Row of the actions that apply to this rider. The dialog itself is rendered by the page via onAction. */
export function ActionButtons({
    rider,
    onAction,
}: {
    rider: RiderStatuses;
    onAction: (a: RiderAction) => void;
}) {
    return (
        <>
            {allowedActions(rider).map((a) => {
                const Icon = actionDefs[a].icon;
                return (
                    <button
                        key={a}
                        type="button"
                        onClick={() => onAction(a)}
                        className={`${outline} ${tone[a]}`}
                    >
                        <Icon className="size-3.5" aria-hidden />
                        {actionDefs[a].label}
                    </button>
                );
            })}
        </>
    );
}

/** Confirmation dialog for every sensitive action. Reject / Suspend require a reason (validated again on the server). */
export function RiderActionDialog({
    rider,
    action,
    onClose,
}: {
    rider: RiderRef | null;
    action: RiderAction | null;
    onClose: () => void;
}) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const open = !!rider && !!action;
    const def = action ? actionDefs[action] : null;

    useEffect(() => {
        if (open) {
            setReason('');
            setError(null);
            setBusy(false);
        }
    }, [open, rider?.id, action]);

    function submit() {
        if (!rider || !action || !def || busy) return;
        if (def.needsReason && reason.trim().length < 5) {
            setError('Please provide a reason (at least 5 characters).');
            return;
        }
        router.post(
            `/admin/riders/${rider.id}/${action}`,
            def.needsReason ? { reason: reason.trim() } : {},
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onSuccess: () => onClose(),
                onError: (e) =>
                    setError(
                        e.reason ?? 'Something went wrong. Please try again.',
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
                className="border-m-line bg-m-card text-m-body sm:max-w-md"
                style={{ fontFamily: 'Inter, Arial, sans-serif' }}
            >
                {rider && def && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{def.title}</DialogTitle>
                            <DialogDescription className="text-sm leading-relaxed text-m-muted">
                                {def.text(rider.full_name)}
                            </DialogDescription>
                        </DialogHeader>
                        {def.needsReason && (
                            <div>
                                <label
                                    htmlFor="rider-action-reason"
                                    className="mb-1.5 block text-sm font-medium"
                                >
                                    {action === 'reject'
                                        ? 'Rejection reason'
                                        : 'Suspension reason'}{' '}
                                    <span className="text-m-red">*</span>
                                </label>
                                <textarea
                                    id="rider-action-reason"
                                    rows={4}
                                    maxLength={1000}
                                    value={reason}
                                    onChange={(e) => {
                                        setReason(e.target.value);
                                        setError(null);
                                    }}
                                    disabled={busy}
                                    aria-invalid={!!error}
                                    aria-describedby={
                                        error ? 'rider-action-err' : undefined
                                    }
                                    className={`w-full rounded-md border bg-m-card px-3 py-2 text-sm outline-none focus:border-m-accent focus:ring-2 focus:ring-m-accent/20 ${error ? 'border-m-red' : 'border-m-line'}`}
                                    placeholder={
                                        action === 'reject'
                                            ? 'Explain why this application is being rejected…'
                                            : 'Explain why this account is being suspended…'
                                    }
                                />
                                {error && (
                                    <p
                                        id="rider-action-err"
                                        role="alert"
                                        className="mt-1.5 text-xs font-medium text-m-redtext"
                                    >
                                        {error}
                                    </p>
                                )}
                            </div>
                        )}
                        {!def.needsReason && error && (
                            <p
                                role="alert"
                                className="text-xs font-medium text-m-redtext"
                            >
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
                                {busy && (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden
                                    />
                                )}
                                {busy ? 'Saving…' : def.confirm}
                            </button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function Avatar({
    name,
    url,
    size = 'size-9',
}: {
    name: string;
    url: string | null;
    size?: string;
}) {
    const [failed, setFailed] = useState(false);
    if (url && !failed)
        return (
            <img
                src={url}
                alt=""
                onError={() => setFailed(true)}
                className={`${size} shrink-0 rounded-full object-cover`}
            />
        );
    return (
        <span
            className={`${size} flex shrink-0 items-center justify-center rounded-full bg-m-solid text-xs font-semibold text-white`}
            aria-hidden
        >
            {initialsOf(name)}
        </span>
    );
}
