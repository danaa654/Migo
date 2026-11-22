import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { MigoBrand, TopBar } from '@/components/migo-bar';
import type { ReactNode } from 'react';

// File in /public: login-bg.png (page background).
const LOGIN_BG = '/login-bg.png';

export const field =
    'w-full rounded-md border border-m-line bg-m-card px-3.5 py-2.5 text-sm text-m-body placeholder:text-m-muted transition focus:border-m-accent focus:outline-none focus:ring-2 focus:ring-m-accent/20 disabled:bg-m-page';
export const submitBtn =
    'flex w-full items-center justify-center gap-2 rounded-md bg-m-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-m-forest-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-70';

const notice = {
    error: 'border-m-red/30 bg-m-red/5 text-m-redtext',
    success: 'border-m-green/30 bg-m-green/5 text-m-greentext',
    info: 'border-m-accent/30 bg-m-mint text-m-ink',
};

export function Notice({
    kind,
    children,
}: {
    kind: 'error' | 'success' | 'info';
    children: ReactNode;
}) {
    return (
        <div
            role={kind === 'error' ? 'alert' : 'status'}
            className={`rounded-xl border px-4 py-3 text-sm ${notice[kind]}`}
        >
            {children}
        </div>
    );
}

type Back = { href: string; label: string };

type Props = {
    title: string;
    subtitle: string;
    children: ReactNode;
    /** Wider card, used by the account-type selection page. */
    wide?: boolean;
    /** Medium card, used by the registration forms. */
    medium?: boolean;
    /** Link shown under the card. Defaults to "Back to Home". */
    back?: Back;
    /** Discreet "Admin Login" link in the footer. Hidden on the admin login page itself. */
    adminLink?: boolean;
};

export default function MigoAuthShell({
    title,
    subtitle,
    children,
    wide = false,
    medium = false,
    back = { href: '/', label: 'Back to Home' },
    adminLink = true,
}: Props) {
    return (
        <>
            <Head title={title}>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <div
                className="relative isolate flex min-h-dvh flex-col bg-m-page text-m-body"
                style={{
                    fontFamily:
                        'Inter, Arial, ui-sans-serif, system-ui, sans-serif',
                }}
            >
                {/* full-screen background: fixed, so every login tab shows the exact same picture whatever the card height */}
                <div
                    aria-hidden
                    className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat dark:brightness-[.35]"
                    style={{ backgroundImage: `url(${LOGIN_BG})` }}
                />

                <TopBar width="max-w-7xl" left={<MigoBrand subtitle="Your Ride. Your Buddy." />} />

                <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-6">

                    <div
                        className={`w-full ${wide ? 'max-w-4xl' : medium ? 'max-w-2xl' : 'max-w-md'}`}
                    >
                        <div className="overflow-hidden rounded-3xl bg-m-card/95 shadow-xl ring-1 shadow-m-accent/15 ring-m-card">
                            <div
                                aria-hidden
                                className="h-1.5 bg-gradient-to-r from-m-forest via-[#F28C28] to-m-forest"
                            />
                            <div className="p-5 sm:p-7">
                                <h1 className="text-center text-2xl font-extrabold text-m-accent">
                                    {title}
                                </h1>
                                <p className="mx-auto mt-1 max-w-sm text-center text-sm leading-relaxed text-m-muted">
                                    {subtitle}
                                </p>
                                <div className="mt-4 text-left">{children}</div>
                            </div>
                        </div>
                        <p className="mt-3 text-center">
                            <Link
                                href={back.href}
                                className="inline-flex items-center gap-2 rounded-full bg-m-card/75 px-4 py-1.5 text-sm font-medium text-m-accent backdrop-blur transition hover:bg-m-card hover:text-m-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                            >
                                <ArrowLeft className="size-4" aria-hidden />{' '}
                                {back.label}
                            </Link>
                        </p>
                    </div>
                </main>

                <footer className="relative px-5 pb-3 text-center text-xs text-m-body2">
                    {adminLink && (
                        <p>
                            <Link
                                href="/admin/login"
                                className="rounded text-m-body2 underline-offset-2 transition hover:text-m-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                            >
                                Admin Login
                            </Link>
                        </p>
                    )}
                </footer>
            </div>
        </>
    );
}
