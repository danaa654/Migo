import { Link, useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import type { FormEvent } from 'react';
import MigoAuthShell, {
    field,
    Notice,
    submitBtn,
} from '@/components/migo-auth-shell';

export default function ForgotPassword({ status }: { status?: string }) {
    const form = useForm({ email: '' });

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!form.processing) form.post('/forgot-password');
    }

    return (
        <MigoAuthShell
            title="Forgot Password?"
            subtitle="Enter your email address and we will send you a link to reset your password."
        >
            <form onSubmit={submit} className="space-y-5">
                {status && <Notice kind="success">{status}</Notice>}
                {form.errors.email && (
                    <Notice kind="error">{form.errors.email}</Notice>
                )}
                <div>
                    <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-semibold"
                    >
                        Email Address
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        required
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        placeholder="Enter your email address"
                        disabled={form.processing}
                        className={field}
                    />
                </div>
                <button
                    type="submit"
                    disabled={form.processing}
                    className={submitBtn}
                >
                    {form.processing ? (
                        <>
                            <Loader2
                                className="size-4 animate-spin"
                                aria-hidden
                            />{' '}
                            Sending…
                        </>
                    ) : (
                        'Send Reset Link'
                    )}
                </button>
                <p className="text-center text-sm">
                    <Link
                        href="/login"
                        className="font-semibold text-m-accent hover:text-m-accent-hover"
                    >
                        Back to Sign In
                    </Link>
                </p>
            </form>
        </MigoAuthShell>
    );
}
