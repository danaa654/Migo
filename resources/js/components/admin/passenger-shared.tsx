import { router } from '@inertiajs/react';
import { Loader2, PauseCircle, PlayCircle, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export type PassengerAction = 'suspend' | 'deactivate' | 'reactivate';
export type PassengerRef = {
    id: string;
    full_name: string | null;
    account_status: string;
};

export const displayName = (p: { full_name: string | null }) =>
    p.full_name ?? 'Unnamed passenger';

const statusTone: Record<string, string> = {
    active: 'bg-m-forest/10 text-m-accent-hover',
    suspended: 'bg-m-solid/10 text-m-ink',
    deactivated: 'bg-m-red/10 text-m-red',
};
const pill =
    'inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium capitalize';

export const PassengerStatusBadge = ({ status }: { status: string }) => (
    <span className={`${pill} ${statusTone[status] ?? 'bg-m-page text-m-muted'}`}>
        {status}
    </span>
);

const methodLabel: Record<string, string> = {
    google: 'Google',
    phone: 'Phone',
    email: 'Email code',
    password: 'Password',
};
export const methodsText = (methods: string[]) =>
    methods.length ? methods.map((m) => methodLabel[m] ?? m).join(', ') : '—';

/** Which actions make sense for the passenger's current status. */
export function allowedActions(status: string): PassengerAction[] {
    if (status === 'active') return ['suspend', 'deactivate'];
    if (status === 'suspended') return ['reactivate', 'deactivate'];
    if (status === 'deactivated') return ['reactivate'];
    return [];
}

type Def = {
    label: string;
    title: string;
    text: (name: string) => string;
    confirm: string;
    needsReason: boolean;
    button: string;
    outline: string;
    icon: typeof PauseCircle;
};

export const actionDefs: Record<PassengerAction, Def> = {
    suspend: {
        label: 'Suspend',
        title: 'Suspend passenger account',
        text: (n) =>
            `${n} will not be able to book new rides until the account is reactivated. A ride that is already in progress will finish normally. The passenger is notified with your reason.`,
        confirm: 'Suspend account',
        needsReason: true,
        button: 'bg-m-solid text-white hover:bg-m-ink',
        outline: 'border-m-line text-m-ink hover:bg-m-page',
        icon: PauseCircle,
    },
    deactivate: {
        label: 'Deactivate',
        title: 'Deactivate passenger account',
        text: (n) =>
            `${n} will not be able to book new rides. Their bookings and history are kept. You can reactivate the account later. The passenger is notified with your reason.`,
        confirm: 'Deactivate account',
        needsReason: true,
        button: 'bg-m-red text-white hover:opacity-90',
        outline: 'border-m-red/40 text-m-red hover:bg-m-red/10',
        icon: UserX,
    },
    reactivate: {
        label: 'Reactivate',
        title: 'Reactivate passenger account',
        text: (n) =>
            `${n} will be able to book rides again. The passenger is notified.`,
        confirm: 'Reactivate account',
        needsReason: false,
        button: 'bg-m-forest text-white hover:bg-m-forest-hover',
        outline: 'border-m-accent text-m-accent hover:bg-m-mint',
        icon: PlayCircle,
    },
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

export function ActionButtons({
    passenger,
    onAction,
}: {
    passenger: PassengerRef;
    onAction: (a: PassengerAction) => void;
}) {
    return (
        <>
            {allowedActions(passenger.account_status).map((a) => (
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

export function PassengerActionDialog({
    passenger,
    action,
    onClose,
}: {
    passenger: PassengerRef | null;
    action: PassengerAction | null;
    onClose: () => void;
}) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const open = !!passenger && !!action;
    const def = action ? actionDefs[action] : null;

    useEffect(() => {
        if (open) {
            setReason('');
            setError(null);
            setBusy(false);
        }
    }, [open, passenger?.id, action]);

    function submit() {
        if (!passenger || !action || !def || busy) return;
        if (def.needsReason && reason.trim().length < 5) {
            setError('Please provide a reason (at least 5 characters).');
            return;
        }
        router.post(
            `/admin/passengers/${passenger.id}/${action}`,
            def.needsReason ? { reason: reason.trim() } : {},
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onSuccess: () => onClose(),
                onError: (e) =>
                    setError(e.reason ?? 'Something went wrong. Please try again.'),
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
                {passenger && def && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{def.title}</DialogTitle>
                            <DialogDescription className="text-sm leading-relaxed text-m-muted">
                                {def.text(displayName(passenger))}
                            </DialogDescription>
                        </DialogHeader>
                        {def.needsReason && (
                            <div>
                                <label
                                    htmlFor="passenger-action-reason"
                                    className="mb-1.5 block text-sm font-medium"
                                >
                                    Reason <span className="text-m-red">*</span>
                                </label>
                                <textarea
                                    id="passenger-action-reason"
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
                                    placeholder="Explain why this action is being taken…"
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