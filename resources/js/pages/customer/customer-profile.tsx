import { router, useForm } from '@inertiajs/react';
import { BadgeCheck, KeyRound, Mail, Smartphone } from 'lucide-react';
import { Notice } from '@/components/migo-auth-shell';
import { PasswordField, TextField } from '@/components/migo-form-fields';
import CustomerShell from '@/components/customer-shell';
import PhoneOtpFlow from '@/components/phone-otp-flow';

type Props = {
    status?: string | null;
    profile: {
        full_name: string;
        email: string | null;
        phone: { verified: boolean; display: string | null; legacy: string };
        sign_in_methods: ('google' | 'phone' | 'password')[];
        can_change_password: boolean;
        needs_profile: boolean;
    };
};

const card = 'rounded-lg border border-m-line bg-m-card p-6 shadow-sm sm:p-8';
const btn =
    'rounded-md bg-m-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-m-forest-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

export default function CustomerProfile({ status, profile }: Props) {
    const info = useForm({ full_name: profile.full_name });
    const pw = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    const { phone } = profile;

    const methods = [
        profile.sign_in_methods.includes('google') && {
            icon: Mail,
            title: 'Google',
            detail: profile.email ?? '',
        },
        profile.sign_in_methods.includes('phone') && {
            icon: Smartphone,
            title: 'Phone number (SMS code)',
            detail: phone.display ?? '',
        },
        profile.sign_in_methods.includes('password') && {
            icon: KeyRound,
            title: 'Email at password',
            detail: profile.email ?? '',
        },
    ].filter(Boolean) as { icon: typeof Mail; title: string; detail: string }[];

    return (
        <CustomerShell title="My Profile" status={status}>
            <div>
                <h1 className="text-2xl font-semibold text-m-ink">
                    {profile.needs_profile
                        ? 'Complete your profile'
                        : 'My Profile'}
                </h1>
                <p className="mt-1 text-sm text-m-muted">
                    {profile.needs_profile
                        ? 'Isang hakbang na lang! Isulat ang buong pangalan mo para makapag-book.'
                        : 'Update your personal details and see how you sign in.'}
                </p>
            </div>

            {profile.needs_profile && (
                <Notice kind="info">
                    Kailangan muna ang buong pangalan mo (first name at last
                    name) bago ka makapag-book ng ride.
                </Notice>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    info.patch('/customer/profile', { preserveScroll: true });
                }}
                className={card}
                noValidate
            >
                <h2 className="text-base font-semibold text-m-ink">
                    Personal information
                </h2>
                <div className="mt-4 max-w-md">
                    <TextField
                        id="full_name"
                        label="Full name"
                        value={info.data.full_name}
                        onChange={(v) => info.setData('full_name', v)}
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
                    className={`${btn} mt-6`}
                >
                    {info.processing
                        ? 'Saving…'
                        : profile.needs_profile
                          ? 'Save and continue'
                          : 'Save changes'}
                </button>
            </form>

            <section className={card} aria-labelledby="signin-heading">
                <h2
                    id="signin-heading"
                    className="text-base font-semibold text-m-ink"
                >
                    How you sign in
                </h2>
                <ul className="mt-4 space-y-3">
                    {methods.map(({ icon: Icon, title, detail }) => (
                        <li
                            key={title}
                            className="flex items-center gap-3 text-sm"
                        >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-m-mint text-m-accent">
                                <Icon className="size-4" aria-hidden />
                            </span>
                            <span>
                                <span className="block font-medium text-m-ink">
                                    {title}
                                </span>
                                {detail && (
                                    <span className="block break-all text-m-muted">
                                        {detail}
                                    </span>
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className={card} aria-labelledby="phone-heading">
                <h2
                    id="phone-heading"
                    className="text-base font-semibold text-m-ink"
                >
                    Phone number
                </h2>
                {phone.verified ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-m-ink">
                        <BadgeCheck
                            className="size-5 text-m-green"
                            aria-hidden
                        />
                        <span className="font-medium">{phone.display}</span>
                        <span className="text-m-muted">
                            · na-verify gamit ang SMS code
                        </span>
                    </p>
                ) : (
                    <div className="mt-3 max-w-md space-y-4">
                        <p className="text-sm text-m-muted">
                            {phone.legacy
                                ? 'I-confirm ang phone number mo para magamit mo ito sa pag-login. Magpapadala kami ng 6-digit code.'
                                : 'Magdagdag ng phone number. Magpapadala kami ng 6-digit code para ma-verify ito.'}
                        </p>
                        <PhoneOtpFlow
                            sendUrl="/customer/profile/phone/send"
                            verifyUrl="/customer/profile/phone/verify"
                            initialPhone={phone.legacy}
                            onVerified={() => router.reload()}
                        />
                    </div>
                )}
            </section>

            {profile.can_change_password && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        pw.put('/customer/profile/password', {
                            preserveScroll: true,
                            onSuccess: () => pw.reset(),
                        });
                    }}
                    className={card}
                    noValidate
                >
                    <h2 className="text-base font-semibold text-m-ink">
                        Change password
                    </h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                            hint="At least 8 characters"
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
                    <button
                        type="submit"
                        disabled={pw.processing}
                        className={`${btn} mt-6`}
                    >
                        {pw.processing ? 'Updating…' : 'Update password'}
                    </button>
                </form>
            )}
        </CustomerShell>
    );
}
