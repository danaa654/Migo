import { router, useForm } from '@inertiajs/react';
import {
    BadgeCheck,
    ChevronDown,
    KeyRound,
    Mail,
    ShieldCheck,
    Smartphone,
    UserRound,
    type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import CustomerShell from '@/components/customer-shell';
import { Notice } from '@/components/migo-auth-shell';
import { PasswordField, TextField } from '@/components/migo-form-fields';
import PhoneOtpFlow from '@/components/phone-otp-flow';

type Props = {
    status?: string | null;
    profile: {
        full_name: string;
        email: string | null;
        phone: { verified: boolean; display: string | null; legacy: string };
        sign_in_methods: ('google' | 'phone' | 'email' | 'password')[];
        can_change_password: boolean;
        can_set_password: boolean;
        needs_profile: boolean;
    };
};

const card = 'rounded-lg border border-m-line bg-m-card shadow-sm';
const btn =
    'rounded-md bg-m-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-m-forest-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const btnGhost =
    'rounded-md border border-m-line bg-m-card px-4 py-2 text-sm font-semibold text-m-accent transition hover:border-m-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

function GoogleG() {
    return (
        <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
            <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
        </svg>
    );
}

function Chip({ children, on }: { children: ReactNode; on: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                on
                    ? 'bg-m-mint text-m-accent'
                    : 'bg-m-page text-m-muted ring-1 ring-m-line'
            }`}
        >
            {children}
        </span>
    );
}

function CardHeader({
    icon: Icon,
    title,
    hint,
}: {
    icon: LucideIcon;
    title: string;
    hint: string;
}) {
    return (
        <div className="flex items-start gap-3 border-b border-m-line px-6 py-4 sm:px-8">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-m-mint text-m-accent">
                <Icon className="size-4" aria-hidden />
            </span>
            <div>
                <h2 className="text-base font-semibold text-m-ink">{title}</h2>
                <p className="text-sm text-m-muted">{hint}</p>
            </div>
        </div>
    );
}

function MethodRow({
    icon,
    title,
    detail,
    badge,
    on,
    action,
}: {
    icon: ReactNode;
    title: string;
    detail?: string | null;
    badge: string;
    on: boolean;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-m-mint text-m-accent">
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-m-ink">{title}</p>
                {detail && (
                    <p className="truncate text-sm text-m-muted">{detail}</p>
                )}
            </div>
            <Chip on={on}>{badge}</Chip>
            {action}
        </div>
    );
}

export default function CustomerProfile({ status, profile }: Props) {
    const info = useForm({ full_name: profile.full_name });
    const pw = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    const setPw = useForm({ password: '', password_confirmation: '' });
    const [open, setOpen] = useState(false);
    const { phone } = profile;

    const hasGoogle = profile.sign_in_methods.includes('google');
    const hasPassword = profile.can_change_password;
    const canSet = profile.can_set_password;
    const displayName = profile.full_name || profile.email || 'Customer';
    const initials =
        displayName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join('') || 'C';

    return (
        <CustomerShell title="My Profile" status={status}>
            <div className="mx-auto w-full max-w-3xl space-y-6">
                {/* Summary */}
                <header
                    className={`${card} flex flex-wrap items-center gap-4 p-6 sm:p-8`}
                >
                    <span
                        aria-hidden
                        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-m-forest text-lg font-semibold text-white"
                    >
                        {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-xl font-semibold text-m-ink">
                            {profile.needs_profile
                                ? 'Complete your profile'
                                : displayName}
                        </h1>
                        <p className="truncate text-sm text-m-muted">
                            {profile.needs_profile
                                ? 'One more step: enter your full name so you can book a ride.'
                                : (profile.email ?? phone.display ?? '')}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Chip on={hasGoogle}>Google</Chip>
                            <Chip on={phone.verified}>
                                {phone.verified ? 'Phone verified' : 'No phone'}
                            </Chip>
                            <Chip on={hasPassword}>
                                {hasPassword ? 'Password set' : 'No password'}
                            </Chip>
                        </div>
                    </div>
                </header>

                {profile.needs_profile && (
                    <Notice kind="info">
                        We need your full name (first and last name) before you
                        can book a ride.
                    </Notice>
                )}

                {/* Personal */}
                <section className={card} aria-labelledby="personal-heading">
                    <CardHeader
                        icon={UserRound}
                        title="Personal"
                        hint="Your name and phone number."
                    />
                    <div className="divide-y divide-m-line">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                info.patch('/customer/profile', {
                                    preserveScroll: true,
                                });
                            }}
                            className="px-6 py-5 sm:px-8"
                            noValidate
                        >
                            <h3
                                id="personal-heading"
                                className="sr-only"
                            >
                                Personal information
                            </h3>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                                <div className="flex-1">
                                    <TextField
                                        id="full_name"
                                        label="Full name"
                                        value={info.data.full_name}
                                        onChange={(v) =>
                                            info.setData('full_name', v)
                                        }
                                        error={info.errors.full_name}
                                        autoComplete="name"
                                        autoFocus={profile.needs_profile}
                                        placeholder="Juan Dela Cruz"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={
                                        info.processing ||
                                        (!info.isDirty && !profile.needs_profile)
                                    }
                                    className={`${btn} sm:mb-px`}
                                >
                                    {info.processing
                                        ? 'Saving…'
                                        : profile.needs_profile
                                          ? 'Save and continue'
                                          : 'Save changes'}
                                </button>
                            </div>
                        </form>

                        <div className="px-6 py-5 sm:px-8">
                            <p className="text-sm font-medium text-m-ink">
                                Phone number
                            </p>
                            {phone.verified ? (
                                <p className="mt-2 flex items-center gap-2 text-sm text-m-ink">
                                    <BadgeCheck
                                        className="size-5 text-m-green"
                                        aria-hidden
                                    />
                                    <span className="font-medium">
                                        {phone.display}
                                    </span>
                                    <span className="text-m-muted">
                                        · verified by SMS code
                                    </span>
                                </p>
                            ) : (
                                <div className="mt-2 max-w-md space-y-3">
                                    <p className="text-sm text-m-muted">
                                        {phone.legacy
                                            ? 'Confirm your phone number so you can use it to sign in. We will send a 6-digit code.'
                                            : 'Add a phone number. We will send a 6-digit code to verify it.'}
                                    </p>
                                    <PhoneOtpFlow
                                        sendUrl="/customer/profile/phone/send"
                                        verifyUrl="/customer/profile/phone/verify"
                                        initialPhone={phone.legacy}
                                        onVerified={() => router.reload()}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Sign-in & security */}
                <section className={card} aria-labelledby="security-heading">
                    <CardHeader
                        icon={ShieldCheck}
                        title="Sign-in & security"
                        hint="The ways you can sign in to your account."
                    />
                    <div
                        id="security-heading"
                        className="divide-y divide-m-line px-6 sm:px-8"
                    >
                        <MethodRow
                            icon={<GoogleG />}
                            title="Google"
                            detail={hasGoogle ? profile.email : null}
                            badge={hasGoogle ? 'Connected' : 'Not connected'}
                            on={hasGoogle}
                        />
                        <MethodRow
                            icon={<Smartphone className="size-4" aria-hidden />}
                            title="Phone number (SMS code)"
                            detail={phone.display}
                            badge={phone.verified ? 'Verified' : 'Not added'}
                            on={phone.verified}
                        />
                        <MethodRow
                            icon={<KeyRound className="size-4" aria-hidden />}
                            title="Email & password"
                            detail={profile.email}
                            badge={hasPassword ? 'Password set' : 'Not set'}
                            on={hasPassword}
                            action={
                                (hasPassword || canSet) && (
                                    <button
                                        type="button"
                                        onClick={() => setOpen(!open)}
                                        aria-expanded={open}
                                        aria-controls="password-panel"
                                        className={`${btnGhost} inline-flex items-center gap-1.5`}
                                    >
                                        {hasPassword
                                            ? 'Change password'
                                            : 'Set password'}
                                        <ChevronDown
                                            className={`size-4 transition ${open ? 'rotate-180' : ''}`}
                                            aria-hidden
                                        />
                                    </button>
                                )
                            }
                        />
                        {!hasPassword && !canSet && (
                            <p className="flex items-start gap-2 py-3 text-xs text-m-muted">
                                <Mail
                                    className="mt-0.5 size-3.5 shrink-0"
                                    aria-hidden
                                />
                                A password needs a verified email. Sign in with
                                Google or an email code to add one.
                            </p>
                        )}
                    </div>

                    {open && (hasPassword || canSet) && (
                        <div
                            id="password-panel"
                            className="border-t border-m-line bg-m-page/60 px-6 py-5 sm:px-8"
                        >
                            {hasPassword ? (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        pw.put('/customer/profile/password', {
                                            preserveScroll: true,
                                            onSuccess: () => {
                                                pw.reset();
                                                setOpen(false);
                                            },
                                        });
                                    }}
                                    noValidate
                                >
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <PasswordField
                                                id="current_password"
                                                label="Current password"
                                                value={pw.data.current_password}
                                                onChange={(v) =>
                                                    pw.setData(
                                                        'current_password',
                                                        v,
                                                    )
                                                }
                                                error={pw.errors.current_password}
                                                autoComplete="current-password"
                                            />
                                        </div>
                                        <PasswordField
                                            id="password"
                                            label="New password"
                                            value={pw.data.password}
                                            onChange={(v) =>
                                                pw.setData('password', v)
                                            }
                                            error={pw.errors.password}
                                            hint="At least 8 characters"
                                        />
                                        <PasswordField
                                            id="password_confirmation"
                                            label="Confirm new password"
                                            value={pw.data.password_confirmation}
                                            onChange={(v) =>
                                                pw.setData(
                                                    'password_confirmation',
                                                    v,
                                                )
                                            }
                                            error={
                                                pw.errors.password_confirmation
                                            }
                                        />
                                    </div>
                                    <div className="mt-5 flex gap-3">
                                        <button
                                            type="submit"
                                            disabled={pw.processing}
                                            className={btn}
                                        >
                                            {pw.processing
                                                ? 'Updating…'
                                                : 'Update password'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOpen(false)}
                                            className={btnGhost}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        setPw.put(
                                            '/customer/profile/password/set',
                                            {
                                                preserveScroll: true,
                                                onSuccess: () => {
                                                    setPw.reset();
                                                    setOpen(false);
                                                },
                                            },
                                        );
                                    }}
                                    noValidate
                                >
                                    <p className="mb-4 text-sm text-m-muted">
                                        Optional. Add a password to sign in with{' '}
                                        <span className="font-medium text-m-ink">
                                            {profile.email}
                                        </span>{' '}
                                        and your password, in addition to Google
                                        and codes.
                                    </p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <PasswordField
                                            id="set_password"
                                            label="New password"
                                            value={setPw.data.password}
                                            onChange={(v) =>
                                                setPw.setData('password', v)
                                            }
                                            error={setPw.errors.password}
                                            hint="At least 8 characters"
                                        />
                                        <PasswordField
                                            id="set_password_confirmation"
                                            label="Confirm password"
                                            value={
                                                setPw.data.password_confirmation
                                            }
                                            onChange={(v) =>
                                                setPw.setData(
                                                    'password_confirmation',
                                                    v,
                                                )
                                            }
                                            error={
                                                setPw.errors
                                                    .password_confirmation
                                            }
                                        />
                                    </div>
                                    <div className="mt-5 flex gap-3">
                                        <button
                                            type="submit"
                                            disabled={setPw.processing}
                                            className={btn}
                                        >
                                            {setPw.processing
                                                ? 'Saving…'
                                                : 'Save password'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOpen(false)}
                                            className={btnGhost}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </CustomerShell>
    );
}