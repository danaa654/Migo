import { router, useForm } from '@inertiajs/react';
import { CheckCircle2, ImagePlus, KeyRound, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { PasswordField } from '@/components/migo-form-fields';
import AdminLayout from '@/layouts/admin-layout';

type Props = {
    status?: string | null;
    profile: {
        full_name: string;
        email: string;
        role_label: string;
        avatar_url: string | null;
    };
};

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const card = 'rounded-xl border border-m-line bg-m-card shadow-sm';
const primary = `rounded-lg bg-m-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-m-forest-hover disabled:cursor-not-allowed disabled:opacity-60 ${ring}`;
const secondary = `inline-flex items-center gap-2 rounded-lg border border-m-line bg-m-card px-4 py-2 text-sm font-semibold text-m-body transition hover:bg-m-page disabled:cursor-not-allowed disabled:opacity-60 ${ring}`;
const danger = `inline-flex items-center gap-2 rounded-lg border border-m-red/30 bg-m-card px-4 py-2 text-sm font-semibold text-m-red transition hover:bg-m-red/5 disabled:cursor-not-allowed disabled:opacity-60 ${ring}`;

function Section({
    icon: Icon,
    title,
    hint,
    children,
}: {
    icon: typeof UserRound;
    title: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <section className={`${card} p-5 sm:p-6`}>
            <div className="mb-4 flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-m-mint text-m-accent">
                    <Icon className="size-4" aria-hidden />
                </span>
                <div>
                    <h2 className="text-base font-bold text-m-ink">{title}</h2>
                    {hint && <p className="text-sm text-m-muted">{hint}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

export default function AdminProfile({ status, profile }: Props) {
    const photo = useForm<{ avatar: File | null }>({ avatar: null });
    const pw = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    const fileInput = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [pickError, setPickError] = useState<string | null>(null);

    // Local preview of the chosen file; revoked when it changes or the page closes.
    useEffect(() => {
        if (!photo.data.avatar) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(photo.data.avatar);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [photo.data.avatar]);

    const initials =
        profile.full_name
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'A';
    const shown = preview ?? profile.avatar_url;

    const pick = (file: File | null) => {
        setPickError(null);
        photo.clearErrors();
        if (!file) return photo.setData('avatar', null);
        if (!ACCEPTED.includes(file.type)) {
            setPickError('The photo must be a JPG, PNG or WEBP file.');
            return photo.setData('avatar', null);
        }
        if (file.size > MAX_BYTES) {
            setPickError('The photo must not be larger than 5 MB.');
            return photo.setData('avatar', null);
        }
        photo.setData('avatar', file);
    };

    const savePhoto = (e: FormEvent) => {
        e.preventDefault();
        if (!photo.data.avatar) return;
        photo.post('/admin/profile/photo', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                photo.reset();
                if (fileInput.current) fileInput.current.value = '';
            },
        });
    };

    const savePassword = (e: FormEvent) => {
        e.preventDefault();
        pw.put('/admin/profile/password', {
            preserveScroll: true,
            onSuccess: () => pw.reset(),
            onError: () => pw.reset('password', 'password_confirmation'),
        });
    };

    const photoError = pickError ?? photo.errors.avatar;

    return (
        <AdminLayout title="My Profile">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                {status && (
                    <p
                        role="status"
                        className="flex items-center gap-2 rounded-xl border border-m-green/30 bg-m-green/5 px-4 py-2 text-sm text-m-green"
                    >
                        <CheckCircle2 className="size-4" aria-hidden /> {status}
                    </p>
                )}

                {/* Summary */}
                <header className={`${card} flex flex-wrap items-center gap-4 p-5 sm:p-6`}>
                    {shown ? (
                        <img
                            src={shown}
                            alt=""
                            className="size-16 shrink-0 rounded-full object-cover ring-2 ring-m-line"
                        />
                    ) : (
                        <span
                            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-m-solid text-xl font-semibold text-white"
                            aria-hidden
                        >
                            {initials}
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-xl font-bold text-m-ink">
                            {profile.full_name}
                        </h2>
                        <p className="truncate text-sm text-m-muted">
                            {profile.email}
                        </p>
                    </div>
                    <span className="rounded-full bg-m-mint px-3 py-1 text-xs font-semibold text-m-accent">
                        {profile.role_label}
                    </span>
                </header>

                {/* Profile photo */}
                <Section
                    icon={ImagePlus}
                    title="Profile photo"
                    hint="Shown in the sidebar and the top bar. JPG, PNG or WEBP, up to 5 MB."
                >
                    <form onSubmit={savePhoto} noValidate>
                        <label
                            htmlFor="avatar"
                            className="mb-1.5 block text-sm font-medium"
                        >
                            New photo
                        </label>
                        <input
                            ref={fileInput}
                            id="avatar"
                            name="avatar"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={photo.processing}
                            aria-invalid={!!photoError}
                            aria-describedby={photoError ? 'avatar-err' : undefined}
                            onChange={(e) => pick(e.target.files?.[0] ?? null)}
                            className={`block w-full cursor-pointer rounded-md border border-m-line bg-m-card text-sm text-m-body file:mr-3 file:cursor-pointer file:border-0 file:bg-m-mint file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-m-accent hover:file:bg-m-line ${photoError ? 'border-m-red' : ''}`}
                        />
                        {photoError && (
                            <p
                                id="avatar-err"
                                className="mt-1.5 text-xs font-medium text-m-redtext"
                            >
                                {photoError}
                            </p>
                        )}
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                type="submit"
                                disabled={photo.processing || !photo.data.avatar}
                                className={primary}
                            >
                                {photo.processing ? 'Saving…' : 'Save photo'}
                            </button>
                            {photo.data.avatar && (
                                <button
                                    type="button"
                                    disabled={photo.processing}
                                    onClick={() => {
                                        pick(null);
                                        if (fileInput.current)
                                            fileInput.current.value = '';
                                    }}
                                    className={secondary}
                                >
                                    Cancel
                                </button>
                            )}
                            {profile.avatar_url && !photo.data.avatar && (
                                <button
                                    type="button"
                                    disabled={photo.processing}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                'Remove your profile photo?',
                                            )
                                        )
                                            router.delete('/admin/profile/photo', {
                                                preserveScroll: true,
                                            });
                                    }}
                                    className={danger}
                                >
                                    <Trash2 className="size-4" aria-hidden />{' '}
                                    Remove photo
                                </button>
                            )}
                        </div>
                    </form>
                </Section>

                {/* Password */}
                <Section
                    icon={KeyRound}
                    title="Change password"
                    hint="Use at least 8 characters. You stay signed in on this device."
                >
                    <form onSubmit={savePassword} noValidate>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <PasswordField
                                    id="current_password"
                                    label="Current password"
                                    value={pw.data.current_password}
                                    onChange={(v) =>
                                        pw.setData('current_password', v)
                                    }
                                    error={pw.errors.current_password}
                                    autoComplete="current-password"
                                />
                            </div>
                            <PasswordField
                                id="password"
                                label="New password"
                                value={pw.data.password}
                                onChange={(v) => pw.setData('password', v)}
                                error={pw.errors.password}
                            />
                            <PasswordField
                                id="password_confirmation"
                                label="Confirm new password"
                                value={pw.data.password_confirmation}
                                onChange={(v) =>
                                    pw.setData('password_confirmation', v)
                                }
                                error={pw.errors.password_confirmation}
                            />
                        </div>
                        <div className="mt-5">
                            <button
                                type="submit"
                                disabled={pw.processing}
                                className={primary}
                            >
                                {pw.processing ? 'Updating…' : 'Update password'}
                            </button>
                        </div>
                    </form>
                </Section>
            </div>
        </AdminLayout>
    );
}
