import { useForm } from '@inertiajs/react';
import { ChevronRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Notice } from '@/components/migo-auth-shell';

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const pill =
    'flex items-center gap-3 rounded-full border bg-m-card py-1.5 pl-1.5 pr-4 shadow-sm transition focus-within:border-m-accent focus-within:ring-2 focus-within:ring-m-accent/20';
const pillInput =
    'h-9 w-full bg-transparent text-sm text-m-body outline-none placeholder:text-m-muted disabled:opacity-60';
const iconCircle =
    'flex size-10 shrink-0 items-center justify-center rounded-full bg-m-mint text-m-accent';
const loginBtn =
    'flex w-full items-center justify-center gap-2 rounded-full bg-m-forest px-5 py-3 text-base font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-m-forest-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0';

/**
 * Customer email + password sign-in. Posts to Fortify's POST /login (same endpoint as the rider form), so the
 * server decides the account type from the stored role and applies the login throttle.
 * "Forgot password?" hands over to the emailed-code login; the customer then sets a new password in Profile.
 */
export default function MigoCustomerPasswordLogin({
    onForgot,
}: {
    onForgot: () => void;
}) {
    const form = useForm({ email: '', password: '', remember: false });
    const [show, setShow] = useState(false);
    const [local, setLocal] = useState<{ email?: string; password?: string }>(
        {},
    );

    // Wrong password, unknown email, passwordless account and throttling all arrive as an "email" error from Fortify.
    const serverError =
        !local.email && !local.password ? form.errors.email : undefined;

    function submit(e: FormEvent) {
        e.preventDefault();
        if (form.processing) return;

        const next: typeof local = {};
        if (!form.data.email.trim()) next.email = 'Email address is required.';
        else if (!isValidEmail(form.data.email.trim()))
            next.email = 'Enter a valid email address.';
        if (!form.data.password) next.password = 'Password is required.';
        setLocal(next);
        if (Object.keys(next).length) return;

        form.clearErrors();
        form.transform((d) => ({ ...d, email: d.email.trim() }));
        form.post('/login', { onFinish: () => form.setData('password', '') });
    }

    return (
        <form onSubmit={submit} noValidate className="space-y-4">
            {serverError && <Notice kind="error">{serverError}</Notice>}

            <div>
                <label htmlFor="customer-pw-email" className="sr-only">
                    Email Address
                </label>
                <div
                    className={`${pill} ${local.email ? 'border-m-red' : 'border-m-line'}`}
                >
                    <span className={iconCircle}>
                        <Mail className="size-5" aria-hidden />
                    </span>
                    <input
                        id="customer-pw-email"
                        type="email"
                        autoComplete="email"
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        placeholder="Email Address"
                        disabled={form.processing}
                        aria-invalid={!!local.email}
                        className={pillInput}
                    />
                </div>
                {local.email && (
                    <p className="mt-1.5 px-4 text-xs font-medium text-m-redtext">
                        {local.email}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="customer-pw-password" className="sr-only">
                    Password
                </label>
                <div
                    className={`${pill} ${local.password ? 'border-m-red' : 'border-m-line'}`}
                >
                    <span className={iconCircle}>
                        <Lock className="size-5" aria-hidden />
                    </span>
                    <input
                        id="customer-pw-password"
                        type={show ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                        placeholder="Password"
                        disabled={form.processing}
                        aria-invalid={!!local.password}
                        className={pillInput}
                    />
                    <button
                        type="button"
                        onClick={() => setShow(!show)}
                        aria-label={show ? 'Hide password' : 'Show password'}
                        aria-pressed={show}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-m-muted transition hover:text-m-accent focus-visible:outline-2 focus-visible:outline-m-accent"
                    >
                        {show ? (
                            <EyeOff className="size-5" />
                        ) : (
                            <Eye className="size-5" />
                        )}
                    </button>
                </div>
                {local.password && (
                    <p className="mt-1.5 px-4 text-xs font-medium text-m-redtext">
                        {local.password}
                    </p>
                )}
            </div>

            <div className="flex items-center justify-between gap-4 px-1 text-sm">
                <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <input
                        type="checkbox"
                        checked={form.data.remember}
                        onChange={(e) =>
                            form.setData('remember', e.target.checked)
                        }
                        className="size-4 rounded accent-m-forest"
                    />
                    Remember me
                </label>
                <button
                    type="button"
                    onClick={onForgot}
                    className="font-semibold text-m-accent transition hover:text-m-accent-hover"
                >
                    Forgot password?
                </button>
            </div>

            <button
                type="submit"
                disabled={form.processing}
                className={loginBtn}
            >
                {form.processing ? (
                    <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />{' '}
                        Signing in…
                    </>
                ) : (
                    <>
                        Login <ChevronRight className="size-5" aria-hidden />
                    </>
                )}
            </button>
        </form>
    );
}