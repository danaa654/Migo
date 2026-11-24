import { Link } from '@inertiajs/react';
import { useState } from 'react';
import EmailOtpFlow from '@/components/email-otp-flow';
import MigoCustomerPasswordLogin from '@/components/migo-customer-password-login';
import PhoneOtpFlow from '@/components/phone-otp-flow';

function GoogleG() {
    return (
        <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
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

type Method = 'phone' | 'email' | 'password';

const switchLabels: Record<Method, string> = {
    phone: 'Use the phone number',
    email: 'Use the email code',
    password: 'Use the email and password',
};

/**
 * Customers: Google, phone number + SMS code, email + emailed code, or email + password (optional, set later in Profile).
 * There is no registration form; the account is created on first sign-in by Google or a code.
 */
export default function MigoCustomerLogin({
    showGuest = true,
}: {
    /** Hide the "Continue as guest" link when this form is already shown inside the booking page. */
    showGuest?: boolean;
}) {
    const [method, setMethod] = useState<Method>('phone');
    const others = (['phone', 'email', 'password'] as Method[]).filter(
        (m) => m !== method,
    );

    return (
        <div className="w-full max-w-full min-w-0 space-y-4">
            {/* A normal link (full page load): the browser leaves for Google and comes back to /auth/google/callback. */}
            <a
                href="/auth/google/redirect"
                className="flex w-full items-center justify-center gap-3 rounded-full border border-m-line bg-m-card px-5 py-3 text-base font-semibold text-m-body shadow-sm transition hover:-translate-y-0.5 hover:border-m-accent/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
            >
                <GoogleG /> Continue with Google
            </a>

            <div
                role="separator"
                aria-label="o"
                className="flex items-center gap-3 text-xs font-semibold tracking-wide text-m-muted uppercase"
            >
                <span aria-hidden className="h-px flex-1 bg-m-line" />
                or
                <span aria-hidden className="h-px flex-1 bg-m-line" />
            </div>

            {method === 'phone' ? (
                <PhoneOtpFlow
                    sendUrl="/auth/otp/send"
                    verifyUrl="/auth/otp/verify"
                    onVerified={(data) =>
                        window.location.assign(
                            data.redirect ?? '/customer/dashboard',
                        )
                    }
                />
            ) : method === 'password' ? (
                <MigoCustomerPasswordLogin onForgot={() => setMethod('email')} />
            ) : (
                <EmailOtpFlow
                    sendUrl="/auth/email-otp/send"
                    verifyUrl="/auth/email-otp/verify"
                    onVerified={(data) =>
                        window.location.assign(
                            data.redirect ?? '/customer/dashboard',
                        )
                    }
                />
            )}

            <div className="flex flex-col items-center gap-1.5">
                {others.map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className="text-sm font-semibold text-m-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                    >
                        {switchLabels[m]}
                    </button>
                ))}
            </div>

            <p className="border-t border-m-line pt-4 text-center text-xs leading-relaxed text-m-muted">
                No registration form: your account is created automatically on your first login. By continuing, you agree to the{' '}
                <Link
                    href="/terms"
                    className="font-semibold text-m-accent underline-offset-2 hover:underline"
                >
                    Terms
                </Link>{' '}
                at{' '}
                <Link
                    href="/privacy"
                    className="font-semibold text-m-accent underline-offset-2 hover:underline"
                >
                    Privacy Policy
                </Link>
                .
            </p>

            {showGuest && (
                <p className="text-center">
                    <Link
                        href="/book"
                        className="text-sm font-semibold text-m-accent underline-offset-2 hover:underline"
                    >
                        Continue as guest
                    </Link>
                </p>
            )}
        </div>
    );
}