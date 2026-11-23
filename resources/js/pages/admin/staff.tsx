import { router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    MailWarning,
    ShieldCheck,
    UserPlus,
} from 'lucide-react';
import type { FormEvent } from 'react';
import AdminLayout, { formatDate } from '@/layouts/admin-layout';

type Role = { value: string; label: string; description: string };
type Staff = {
    id: string;
    full_name: string;
    email: string;
    role: string;
    role_label: string;
    status: string;
    created_at: string | null;
};
type Props = {
    staff: Staff[];
    roles: Role[];
    status?: string | null;
    warning?: string | null;
};

const control =
    'w-full rounded-md border border-m-line bg-m-card px-3 py-2 text-sm outline-none focus:border-m-accent focus:ring-2 focus:ring-m-accent/20 disabled:opacity-60';
const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const primary = `rounded-md bg-m-forest px-4 py-2 text-sm font-medium text-white hover:bg-m-forest-hover disabled:cursor-not-allowed disabled:opacity-60 ${ring}`;
const small = `rounded-md border border-m-line bg-m-card px-3 py-1.5 text-xs font-medium hover:bg-m-page disabled:opacity-60 ${ring}`;

export default function StaffAccounts({
    staff,
    roles,
    status,
    warning,
}: Props) {
    const form = useForm({
        full_name: '',
        email: '',
        role: roles[0]?.value ?? 'operations_admin',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/admin/staff', {
            preserveScroll: true,
            onSuccess: () => form.reset('full_name', 'email'),
        });
    };

    const act = (s: Staff, action: 'suspend' | 'reactivate' | 'invite') => {
        if (
            action === 'suspend' &&
            !window.confirm(
                `Suspend ${s.full_name}? They will be signed out and cannot sign in until you reactivate them.`,
            )
        )
            return;
        router.post(`/admin/staff/${s.id}/${action}`, {}, { preserveScroll: true });
    };

    return (
        <AdminLayout title="Staff Accounts">
            <div className="mb-4">
                <h2 className="text-2xl font-bold">Staff Accounts</h2>
                <p className="text-sm text-m-muted">
                    Create accounts for Operations Admin and Support Staff. Each
                    person gets an email link to set their own password and then
                    signs in through the Admin Login.
                </p>
            </div>

            {status && (
                <p
                    role="status"
                    className="mb-4 flex items-center gap-2 rounded-md border border-m-green/30 bg-m-green/5 px-4 py-2 text-sm text-m-green"
                >
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                    <span className="[overflow-wrap:anywhere]">{status}</span>
                </p>
            )}
            {warning && (
                <p
                    role="alert"
                    className="mb-4 flex items-center gap-2 rounded-md border border-m-red/30 bg-m-red/5 px-4 py-2 text-sm text-m-red"
                >
                    <MailWarning className="size-4 shrink-0" aria-hidden />
                    <span className="[overflow-wrap:anywhere]">{warning}</span>
                </p>
            )}

            <section className="mb-6 rounded-lg border border-m-line bg-m-card p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                    <UserPlus className="size-4" aria-hidden /> New staff account
                </h3>
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="full_name"
                                className="mb-1 block text-sm font-medium"
                            >
                                Full name
                            </label>
                            <input
                                id="full_name"
                                value={form.data.full_name}
                                onChange={(e) =>
                                    form.setData('full_name', e.target.value)
                                }
                                autoComplete="off"
                                aria-invalid={!!form.errors.full_name}
                                className={control}
                            />
                            {form.errors.full_name && (
                                <p role="alert" className="mt-1 text-xs text-m-red">
                                    {form.errors.full_name}
                                </p>
                            )}
                        </div>
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-1 block text-sm font-medium"
                            >
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={form.data.email}
                                onChange={(e) =>
                                    form.setData('email', e.target.value)
                                }
                                autoComplete="off"
                                aria-invalid={!!form.errors.email}
                                className={control}
                            />
                            {form.errors.email && (
                                <p role="alert" className="mt-1 text-xs text-m-red">
                                    {form.errors.email}
                                </p>
                            )}
                        </div>
                    </div>

                    <fieldset>
                        <legend className="mb-1 text-sm font-medium">Role</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {roles.map((r) => (
                                <label
                                    key={r.value}
                                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${form.data.role === r.value ? 'border-m-accent bg-m-mint' : 'border-m-line hover:bg-m-page'}`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={r.value}
                                        checked={form.data.role === r.value}
                                        onChange={() =>
                                            form.setData('role', r.value)
                                        }
                                        className="mt-1 accent-m-forest"
                                    />
                                    <span>
                                        <span className="block font-semibold">
                                            {r.label}
                                        </span>
                                        <span className="block text-xs text-m-muted">
                                            {r.description}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        {form.errors.role && (
                            <p role="alert" className="mt-1 text-xs text-m-red">
                                {form.errors.role}
                            </p>
                        )}
                    </fieldset>

                    <button
                        type="submit"
                        disabled={form.processing}
                        className={primary}
                    >
                        {form.processing
                            ? 'Creating…'
                            : 'Create account and send setup email'}
                    </button>
                </form>
            </section>

            <section className="rounded-lg border border-m-line bg-m-card shadow-sm">
                <h3 className="flex items-center gap-2 border-b border-m-line px-5 py-3 text-base font-semibold">
                    <ShieldCheck className="size-4" aria-hidden /> Staff (
                    {staff.length})
                </h3>
                {staff.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-m-muted">
                        No staff accounts yet. Create the first one above.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs text-m-muted uppercase">
                                <tr>
                                    <th className="px-5 py-2 font-medium">Name</th>
                                    <th className="px-5 py-2 font-medium">Role</th>
                                    <th className="px-5 py-2 font-medium">Status</th>
                                    <th className="px-5 py-2 font-medium">Created</th>
                                    <th className="px-5 py-2 font-medium">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="border-t border-m-line"
                                    >
                                        <td className="px-5 py-3">
                                            <span className="block font-medium">
                                                {s.full_name}
                                            </span>
                                            <span className="block text-xs break-all text-m-muted">
                                                {s.email}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            {s.role_label}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.status === 'active' ? 'bg-m-green/10 text-m-green' : 'bg-m-red/10 text-m-red'}`}
                                            >
                                                {s.status === 'active'
                                                    ? 'Active'
                                                    : 'Suspended'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-m-muted">
                                            {formatDate(s.created_at)}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => act(s, 'invite')}
                                                    className={small}
                                                >
                                                    Resend setup email
                                                </button>
                                                {s.status === 'active' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            act(s, 'suspend')
                                                        }
                                                        className={`${small} text-m-redtext`}
                                                    >
                                                        Suspend
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            act(s, 'reactivate')
                                                        }
                                                        className={small}
                                                    >
                                                        Reactivate
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </AdminLayout>
    );
}
