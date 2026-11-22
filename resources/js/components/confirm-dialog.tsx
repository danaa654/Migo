import * as Dialog from '@radix-ui/react-dialog';

type Props = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    /** "danger" paints the confirm button red (cancelling a booking). */
    tone?: 'primary' | 'danger';
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

/** Small accessible confirmation modal (replaces window.confirm). Same look as the notifications modal. */
export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Keep it',
    tone = 'primary',
    busy = false,
    onConfirm,
    onCancel,
}: Props) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F1F18]/60 backdrop-blur-[2px]" />
                <Dialog.Content
                    className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5 text-[var(--m-body)] shadow-2xl focus:outline-none"
                    style={{ fontFamily: 'Inter, Arial, ui-sans-serif, system-ui, sans-serif' }}
                >
                    <Dialog.Title className="text-lg font-semibold text-[var(--m-ink)]">
                        {title}
                    </Dialog.Title>
                    <Dialog.Description className="mt-1.5 text-sm text-[var(--m-muted)]">
                        {description}
                    </Dialog.Description>
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-md border border-[var(--m-line)] px-4 py-2 text-sm font-semibold text-[var(--m-body)] transition hover:bg-[var(--m-page)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-accent)]"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onConfirm}
                            className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-accent)] disabled:opacity-50 ${
                                tone === 'danger'
                                    ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                                    : 'bg-m-forest hover:bg-m-forest-hover'
                            }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
