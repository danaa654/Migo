import { router } from '@inertiajs/react';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, BellOff, CheckCheck, Maximize2, Minimize2, X } from 'lucide-react';
import { useState } from 'react';

export type Notice = {
    id: string;
    title: string;
    message: string;
    is_read: boolean | number;
    created_at: string;
};
export type Notifications = { unread: number; latest: Notice[] } | null;

const when = (raw: string) => {
    const d = new Date(raw.replace(' ', 'T') + (raw.includes('T') ? '' : 'Z')); // DB timestamps are UTC
    return isNaN(d.getTime())
        ? ''
        : d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--b-accent)]';

/** Bell button for the nav bar. Opens a notifications modal that can be maximized to read everything. */
export default function NotificationBell({ notifications }: { notifications?: Notifications }) {
    const [open, setOpen] = useState(false);
    const [big, setBig] = useState(false);
    const unread = notifications?.unread ?? 0;
    const items = notifications?.latest ?? [];

    const markAll = () => router.post('/biker/notifications/read', {}, { preserveScroll: true });

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) setBig(false);
            }}
        >
            <Dialog.Trigger
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                className={`relative flex size-8 items-center justify-center rounded-full border border-[var(--b-line)] bg-[var(--b-card)] text-[var(--b-accent)] transition hover:bg-[var(--b-mint)] ${ring}`}
            >
                <Bell className="size-4" aria-hidden />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-[var(--b-card)]">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F1F18]/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className={`fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-[var(--b-line)] bg-[var(--b-card)] text-[var(--b-body)] shadow-2xl transition-[width,height,border-radius] duration-200 focus:outline-none ${
                        big
                            ? 'h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] rounded-2xl'
                            : 'h-[min(36rem,calc(100dvh-2rem))] w-[min(30rem,calc(100vw-2rem))] rounded-2xl'
                    }`}
                    style={{ fontFamily: 'Inter, Arial, ui-sans-serif, system-ui, sans-serif' }}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--b-line)] px-5 py-4">
                        <Dialog.Title className="flex min-w-0 items-center gap-2 text-lg font-semibold text-[var(--b-ink)]">
                            <Bell className="hidden size-5 shrink-0 text-[var(--b-accent)] sm:block" aria-hidden />
                            Notifications
                            {unread > 0 && (
                                <span className="rounded-full bg-[#DC2626] px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white">
                                    {unread}
                                    <span className="hidden sm:inline"> unread</span>
                                </span>
                            )}
                        </Dialog.Title>
                        <div className="flex shrink-0 items-center gap-1">
                            {unread > 0 && (
                                <button
                                    type="button"
                                    onClick={markAll}
                                    className={`mr-1 inline-flex items-center gap-1.5 rounded-md whitespace-nowrap px-2.5 py-1.5 text-sm font-medium text-[var(--b-accent)] transition hover:bg-[var(--b-mint)] ${ring}`}
                                >
                                    <CheckCheck className="size-4" aria-hidden />
                                    {big ? (
                                        <>
                                            <span className="hidden sm:inline">Mark all as read</span>
                                            <span className="sm:hidden">Read all</span>
                                        </>
                                    ) : (
                                        'Read all'
                                    )}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setBig((b) => !b)}
                                aria-label={big ? 'Restore size' : 'Maximize'}
                                title={big ? 'Restore size' : 'Maximize'}
                                className={`flex size-9 items-center justify-center rounded-md text-[var(--b-muted)] transition hover:bg-[var(--b-page)] hover:text-[var(--b-ink)] ${ring}`}
                            >
                                {big ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
                            </button>
                            <Dialog.Close
                                aria-label="Close"
                                className={`flex size-9 items-center justify-center rounded-md text-[var(--b-muted)] transition hover:bg-[var(--b-page)] hover:text-[var(--b-ink)] ${ring}`}
                            >
                                <X className="size-5" aria-hidden />
                            </Dialog.Close>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--b-page2)]">
                        {notifications === null || notifications === undefined ? (
                            <p className="p-6 text-sm text-[var(--b-muted)]">Notifications are not yet available.</p>
                        ) : items.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-[var(--b-muted)]">
                                <BellOff className="size-8" aria-hidden />
                                <p className="text-sm">You have no notifications.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-[var(--b-line)]">
                                {items.map((n) => {
                                    const isNew = !n.is_read;
                                    return (
                                        <li
                                            key={n.id}
                                            className={`px-5 py-4 text-sm ${isNew ? 'bg-[var(--b-card)]' : ''} ${
                                                big ? 'sm:grid sm:grid-cols-[1fr_auto] sm:gap-6 sm:px-8' : ''
                                            }`}
                                        >
                                            <div>
                                                <p className={`flex items-center gap-2 ${isNew ? 'font-semibold text-[var(--b-ink)]' : 'font-medium text-[var(--b-body2)]'}`}>
                                                    {isNew && <span className="size-2 shrink-0 rounded-full bg-[var(--b-forest)]" aria-label="Unread" />}
                                                    {n.title}
                                                </p>
                                                <p className="mt-1 leading-relaxed whitespace-pre-line text-[var(--b-muted)]">{n.message}</p>
                                            </div>
                                            <p className={`text-xs whitespace-nowrap text-[var(--b-muted)] ${big ? 'mt-1 sm:mt-0 sm:pt-0.5' : 'mt-1.5'}`}>
                                                {when(n.created_at)}
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}