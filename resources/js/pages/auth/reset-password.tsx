import { useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import type { FormEvent } from 'react';
import MigoAuthShell, {
    field,
    Notice,
    submitBtn,
} from '@/components/migo-auth-shell';

export default function ResetPassword({
    token,
    email,
}: {
    token: string;
    email: string;
}) {
    const form = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });
    const error =
        form.errors.password || form.errors.email || form.errors.token;

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!form.processing)
            form.post('/reset-password', {
                onFinish: () => form.reset('password', 'password_confirmation'),
            });
    }

    return (
        <MigoAuthShell
            title="Reset Password"
            subtitle="Choose a new password for your admin account."
        >
            <form onSubmit={submit} className="space-y-5">
                {error && <Notice kind="error">{error}</Notice>}
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
                        value={form.data.email}
                        readOnly
                        className={field}
                    />
                </div>
                <div>
                    <label
                        htmlFor="pw"
                        className="mb-1.5 block text-sm font-semibold"
                    >
                        New Password
                    </label>
                    <input
                        id="pw"
                        type="password"
                        autoComplete="new-password"
                        autoFocus
                        required
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                        placeholder="At least 8 characters"
                        disabled={form.processing}
                        className={field}
                    />
                </div>
                <div>
                    <label
                        htmlFor="pw2"
                        className="mb-1.5 block text-sm font-semibold"
                    >
                        Confirm Password
                    </label>
                    <input
                        id="pw2"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={form.data.password_confirmation}
                        onChange={(e) =>
                            form.setData(
                                'password_confirmation',
                                e.target.value,
                            )
                        }
                        placeholder="Re-enter your new password"
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
                            Updating…
                        </>
                    ) : (
                        'Update Password'
                    )}
                </button>
            </form>
        </MigoAuthShell>
    );
}
