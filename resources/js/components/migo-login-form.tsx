import { Link, useForm } from '@inertiajs/react';
import { ChevronRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Notice } from '@/components/migo-auth-shell';

type Props = {
    /** "public" = Customer and Biker form at /login. "admin" = Administrator form at /admin/login. */
    portal: 'public' | 'admin';
    status?: string;
    canResetPassword?: boolean;
};

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
 * The single sign-in form used by both login pages. It always posts to Fortify's POST /login.
 * The server decides the account type from the user's stored role; "portal" only tells the server
 * which rule applies (public form accepts Customer/Biker, admin form accepts active administrators).
 */
export default function MigoLoginForm({
    portal,
    status,
    canResetPassword = true,
}: Props) {
    const form = useForm({
        email: '',
        password: '',
        remember: false,
        ...(portal === 'admin' ? { portal: 'admin' } : {}),
    });
    const [show, setShow] = useState(false);
    const [local, setLocal] = useState<{ email?: string; password?: string }>(
        {},
    );

    const emailError = local.email;
    const passwordError = local.password;
    // Wrong password, wrong portal, unknown email and throttling all arrive as an "email" error from Fortify.
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
        form.post('/login', { onFinish: () => form.setData('password', '') });
    }

    return (
        <form onSubmit={submit} noValidate className="space-y-4">
            {status && <Notice kind="success">{status}</Notice>}
            {serverError && <Notice kind="error">{serverError}</Notice>}

            <div>
                <label htmlFor="email" className="sr-only">
                    Email Address
                </label>
                <div
                    className={`${pill} ${emailError ? 'border-m-red' : 'border-m-line'}`}
                >
                    <span className={iconCircle}>
                        <Mail className="size-5" aria-hidden />
                    </span>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        placeholder="Email Address"
                        disabled={form.processing}
                        aria-invalid={!!emailError}
                        aria-describedby={emailError ? 'email-err' : undefined}
                        className={pillInput}
                    />
                </div>
                {emailError && (
                    <p
                        id="email-err"
                        className="mt-1.5 px-4 text-xs font-medium text-m-redtext"
                    >
                        {emailError}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="password" className="sr-only">
                    Password
                </label>
                <div
                    className={`${pill} ${passwordError ? 'border-m-red' : 'border-m-line'}`}
                >
                    <span className={iconCircle}>
                        <Lock className="size-5" aria-hidden />
                    </span>
                    <input
                        id="password"
                        type={show ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                        placeholder="Password"
                        disabled={form.processing}
                        aria-invalid={!!passwordError}
                        aria-describedby={passwordError ? 'pw-err' : undefined}
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
                {passwordError && (
                    <p
                        id="pw-err"
                        className="mt-1.5 px-4 text-xs font-medium text-m-redtext"
                    >
                        {passwordError}
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
                {canResetPassword && (
                    <Link
                        href="/forgot-password"
                        className="font-semibold text-m-accent transition hover:text-m-accent-hover"
                    >
                        Forgot password?
                    </Link>
                )}
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

            {portal === 'public' && (
                <p className="border-t border-m-line pt-5 text-center text-sm text-m-muted">
                    Bagong rider o driver?{' '}
                    <Link
                        href="/register/biker"
                        className="font-semibold text-m-accent transition hover:text-m-accent-hover"
                    >
                        Mag-apply dito.
                    </Link>
                </p>
            )}
        </form>
    );
}
