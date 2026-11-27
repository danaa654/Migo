import { router, useForm } from '@inertiajs/react';
import { CheckCircle2, KeyRound, Lock, Trash2, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Notifications } from '@/components/biker-notifications';
import BikerShell from '@/components/biker-shell';
import LivePhotoField from '@/components/live-photo-field';
import { PasswordField, TextField } from '@/components/migo-form-fields';

type Props = {
    account: { name: string; email: string };
    notifications: Notifications;
    status?: string | null;
    canBook: boolean;
    profile: {
        full_name: string;
        email: string;
        phone: string | null;
        address: string | null;
        vehicle_type: string | null;
        license_number: string | null;
        plate_number: string | null;
        accredited: boolean;
        avatar_url: string | null;
        registration_photo_url: string | null;
        can_change_password: boolean;
    };
};

const card = 'rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] shadow-sm';
const btn =
    'rounded-lg bg-m-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-m-forest-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const btnGhost =
    'inline-flex items-center gap-2 rounded-lg border border-[var(--b-line)] bg-[var(--b-card)] px-4 py-2 text-sm font-semibold text-m-red transition hover:bg-m-red/5 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

function Section({ icon: Icon, title, hint, children }: { icon: typeof UserRound; title: string; hint?: string; children: ReactNode }) {
    return (
        <section className={`${card} p-5 sm:p-6`}>
            <div className="mb-4 flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--b-mint)] text-[var(--b-accent)]">
                    <Icon className="size-4" aria-hidden />
                </span>
                <div>
                    <h2 className="text-base font-bold text-[var(--b-ink)]">{title}</h2>
                    {hint && <p className="text-sm text-[var(--b-muted)]">{hint}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

function ReadOnly({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="text-xs font-medium text-[var(--b-muted)]">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-[var(--b-ink)]">{value || '—'}</dd>
        </div>
    );
}

export default function BikerProfile({ account, notifications, status, canBook, profile }: Props) {
    const info = useForm({ phone: profile.phone ?? '', address: profile.address ?? '' });
    const photo = useForm<{ avatar: File | null }>({ avatar: null });
    const pw = useForm({ current_password: '', password: '', password_confirmation: '' });

    const shown = profile.avatar_url ?? profile.registration_photo_url;
    const initial = profile.full_name.trim().charAt(0).toUpperCase() || 'R';

    return (
        <BikerShell
            account={account}
            canBook={canBook}
            active="profile"
            notifications={notifications}
            progress={canBook ? { cleared: 6, total: 6 } : undefined}
        >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                {status && (
                    <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        <CheckCircle2 className="size-4" aria-hidden /> {status}
                    </div>
                )}

                {/* Summary */}
                <header className={`${card} flex flex-wrap items-center gap-4 p-5 sm:p-6`}>
                    {shown ? (
                        <img src={shown} alt="" className="size-16 shrink-0 rounded-full object-cover ring-2 ring-[var(--b-line)]" />
                    ) : (
                        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-m-solid text-xl font-semibold text-white" aria-hidden>
                            {initial}
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-xl font-bold text-[var(--b-ink)]">{profile.full_name}</h1>
                        <p className="truncate text-sm text-[var(--b-muted)]">{profile.email}</p>
                    </div>
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            profile.accredited ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                        }`}
                    >
                        {profile.accredited ? 'Accredited rider' : 'Accreditation in progress'}
                    </span>
                </header>

                {/* Profile photo */}
                <Section
                    icon={UserRound}
                    title="Profile photo"
                    hint="Passengers see this photo when you accept their ride. Take a clear photo of your face."
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!photo.data.avatar) return;
                            photo.post('/biker/profile/photo', {
                                preserveScroll: true,
                                forceFormData: true,
                                onSuccess: () => photo.reset(),
                            });
                        }}
                        noValidate
                    >
                        <LivePhotoField
                            id="avatar"
                            label="New photo"
                            file={photo.data.avatar}
                            onChange={(f) => photo.setData('avatar', f)}
                            error={photo.errors.avatar}
                            disabled={photo.processing}
                        />
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button type="submit" disabled={photo.processing || !photo.data.avatar} className={btn}>
                                {photo.processing ? 'Saving…' : 'Save photo'}
                            </button>
                            {profile.avatar_url && (
                                <button
                                    type="button"
                                    disabled={photo.processing}
                                    onClick={() => router.delete('/biker/profile/photo', { preserveScroll: true })}
                                    className={btnGhost}
                                >
                                    <Trash2 className="size-4" aria-hidden /> Remove photo
                                </button>
                            )}
                        </div>
                        {profile.avatar_url && profile.registration_photo_url && (
                            <p className="mt-3 text-xs text-[var(--b-muted)]">Removing your photo goes back to the photo you took at registration.</p>
                        )}
                    </form>
                </Section>

                {/* Contact details */}
                <Section icon={UserRound} title="Contact details" hint="Keep your number current so passengers and Migo staff can reach you.">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            info.patch('/biker/profile', { preserveScroll: true });
                        }}
                        noValidate
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TextField
                                id="phone"
                                label="Contact number"
                                type="tel"
                                value={info.data.phone}
                                onChange={(v) => info.setData('phone', v)}
                                error={info.errors.phone}
                                hint="11 digits, starts with 09"
                                autoComplete="tel"
                            />
                            <TextField
                                id="address"
                                label="Address"
                                value={info.data.address}
                                onChange={(v) => info.setData('address', v)}
                                error={info.errors.address}
                                autoComplete="street-address"
                            />
                        </div>
                        <div className="mt-5">
                            <button type="submit" disabled={info.processing || !info.isDirty} className={btn}>
                                {info.processing ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </form>
                </Section>

                {/* Accreditation details: read only */}
                <Section
                    icon={Lock}
                    title="Accreditation details"
                    hint="These are part of your accreditation record. To correct something, send a Support request or visit the Migo office."
                >
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <ReadOnly label="Full name" value={profile.full_name} />
                        <ReadOnly label="Email" value={profile.email} />
                        <ReadOnly label="Vehicle" value={profile.vehicle_type} />
                        <ReadOnly label="Plate number" value={profile.plate_number} />
                        <ReadOnly label="License number" value={profile.license_number} />
                    </dl>
                </Section>

                {/* Password */}
                <Section icon={KeyRound} title="Change password" hint="Use at least 8 characters. You stay signed in on this device.">
                    {profile.can_change_password ? (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                pw.put('/biker/profile/password', {
                                    preserveScroll: true,
                                    onSuccess: () => pw.reset(),
                                    onError: () => pw.reset('password', 'password_confirmation'),
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
                                        onChange={(v) => pw.setData('current_password', v)}
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
                                    onChange={(v) => pw.setData('password_confirmation', v)}
                                    error={pw.errors.password_confirmation}
                                />
                            </div>
                            <div className="mt-5">
                                <button type="submit" disabled={pw.processing} className={btn}>
                                    {pw.processing ? 'Updating…' : 'Update password'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <p className="text-sm text-[var(--b-muted)]">This account has no password to change.</p>
                    )}
                </Section>
            </div>
        </BikerShell>
    );
}
