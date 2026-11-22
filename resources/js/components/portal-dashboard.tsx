import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
    /** "Customer" or "Biker". */
    roleLabel: string;
    account: { name: string; email: string };
    /** Page heading. Defaults to "Welcome, {name}". */
    heading?: string;
    /** Short text under the heading. Defaults to the standard welcome text. */
    intro?: string;
    /** Show the account type / email tiles. Default true. */
    showAccount?: boolean;
    /** "Back" link shown above the content (e.g. back to the dashboard). */
    back?: { href: string; label: string };
    /** Extra content below the welcome card (status banners, tables, ...). */
    children?: ReactNode;
};

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

/** Minimal signed-in landing page for Customer and Biker accounts, in the Migo blue branding. */
export default function PortalDashboard({
    roleLabel,
    account,
    heading,
    intro,
    showAccount = true,
    back,
    children,
}: Props) {
    return (
        <>
            <Head title={`${roleLabel} Dashboard`} />
            <div
                className="flex min-h-screen flex-col bg-m-page text-m-body"
                style={{
                    fontFamily:
                        'Inter, Arial, ui-sans-serif, system-ui, sans-serif',
                }}
            >
                <header className="border-b border-m-line bg-m-card">
                    <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
                        <Link
                            href="/"
                            className={`flex items-center gap-3 ${ring}`}
                            aria-label="Migo home"
                        >
                            <img
                                src="/favi.png"
                                alt=""
                                className="size-9 object-contain"
                            />
                            <span className="leading-tight">
                                <span className="block text-base font-bold tracking-wide text-m-accent">
                                    MIGO
                                </span>
                                <span className="block text-[10px] font-medium tracking-wide text-m-muted uppercase">
                                    {roleLabel} Dashboard
                                </span>
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => router.post('/logout')}
                            className={`inline-flex items-center gap-2 rounded-md border border-m-line px-3.5 py-2 text-sm font-medium text-m-red transition hover:bg-m-red/5 ${ring}`}
                        >
                            <LogOut className="size-4" aria-hidden /> Logout
                        </button>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-10">
                    {back && (
                        <Link
                            href={back.href}
                            className={`inline-flex items-center gap-2 rounded text-sm font-medium text-m-accent transition hover:text-m-accent-hover ${ring}`}
                        >
                            <ArrowLeft className="size-4" aria-hidden />{' '}
                            {back.label}
                        </Link>
                    )}
                    <section className="rounded-lg border border-m-line bg-m-card p-6 shadow-sm sm:p-8">
                        <h1 className="text-2xl font-semibold text-m-ink">
                            {heading ?? `Welcome, ${account.name}`}
                        </h1>
                        <p className="mt-2 text-sm leading-relaxed text-m-muted">
                            {intro ??
                                `You are signed in to your ${roleLabel.toLowerCase()} account. Your ${roleLabel.toLowerCase()} tools will appear here as the system is built in phases.`}
                        </p>
                        {showAccount && (
                            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                                <div className="rounded-md bg-m-mint p-4">
                                    <dt className="font-medium text-m-muted">
                                        Account type
                                    </dt>
                                    <dd className="mt-1 font-semibold text-m-ink">
                                        {roleLabel}
                                    </dd>
                                </div>
                                <div className="rounded-md bg-m-mint p-4">
                                    <dt className="font-medium text-m-muted">
                                        Email address
                                    </dt>
                                    <dd className="mt-1 font-semibold break-all text-m-ink">
                                        {account.email}
                                    </dd>
                                </div>
                            </dl>
                        )}
                    </section>
                    {children}
                </main>
            </div>
        </>
    );
}
