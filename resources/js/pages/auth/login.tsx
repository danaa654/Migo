import { usePage } from '@inertiajs/react';
import { Bike, UserRound, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import MigoAuthShell, { Notice } from '@/components/migo-auth-shell';
import MigoCustomerLogin from '@/components/migo-customer-login';
import MigoLoginForm from '@/components/migo-login-form';

type Tab = 'customer' | 'rider';

const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'customer', label: 'Customer', icon: UserRound },
    { key: 'rider', label: 'Rider / Driver', icon: Bike },
];

/**
 * Public login (GET /login, rendered by Fortify).
 *  - Customer (default): Google or phone number + SMS code. No registration form.
 *  - Rider / Driver: email + password. The server decides the dashboard from the stored role.
 */
export default function Login({
    status,
    canResetPassword = true,
    tab: initialTab,
}: {
    status?: string;
    canResetPassword?: boolean;
    tab?: Tab;
}) {
    const { errors } = usePage().props as { errors?: Record<string, string> };
    // A status message ("application submitted", "password reset") is meant for riders, so open that option.
    const [tab, setTab] = useState<Tab>(
        initialTab === 'rider' || status ? 'rider' : 'customer',
    );

    // Move the cursor to the email box once the card has finished flipping to the rider side.
    useEffect(() => {
        if (tab !== 'rider') return;
        const t = setTimeout(() => {
            // Keep the focus on the tab when the person is switching with the arrow keys.
            if (document.activeElement?.getAttribute('role') === 'tab') return;

            document.getElementById('email')?.focus();
        }, 520);

        return () => clearTimeout(t);
    }, [tab]);

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const next: Tab = tab === 'customer' ? 'rider' : 'customer';
        setTab(next);
        document.getElementById(`tab-${next}`)?.focus();
    }

    return (
        <MigoAuthShell
            title="Welcome Back"
            subtitle={
                tab === 'customer'
                    ? 'Log in with your Google or phone number.'
                    : 'For riders and drivers: log in with your email and password.'
            }
        >
            <div className="space-y-4">
                {errors?.google && (
                    <Notice kind="error">{errors.google}</Notice>
                )}

                <div
                    role="tablist"
                    aria-label="Uri ng login"
                    onKeyDown={onKeyDown}
                    className="grid grid-cols-2 gap-1 rounded-full bg-m-page p-1 ring-1 ring-m-line"
                >
                    {tabs.map(({ key, label, icon: Icon }) => {
                        const active = tab === key;

                        return (
                            <button
                                key={key}
                                id={`tab-${key}`}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                aria-controls={`panel-${key}`}
                                tabIndex={active ? 0 : -1}
                                onClick={() => setTab(key)}
                                className={`flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent ${active ? 'bg-m-forest text-white shadow' : 'text-m-accent hover:bg-m-card'}`}
                            >
                                <Icon className="size-4" aria-hidden /> {label}
                            </button>
                        );
                    })}
                </div>

                {/* Flip card: Customer on the front, Rider / Driver on the back. Both faces share one grid cell, so the card is as tall as the taller face. */}
                <div className="[perspective:1400px]">
                    <div
                        className="grid transition-transform duration-500 ease-in-out [transform-style:preserve-3d] motion-reduce:transition-none"
                        style={{
                            transform:
                                tab === 'rider' ? 'rotateY(180deg)' : 'none',
                        }}
                    >
                        <div
                            id="panel-customer"
                            role="tabpanel"
                            aria-labelledby="tab-customer"
                            inert={tab !== 'customer'}
                            className="col-start-1 row-start-1 [backface-visibility:hidden]"
                        >
                            <MigoCustomerLogin />
                        </div>
                        <div
                            id="panel-rider"
                            role="tabpanel"
                            aria-labelledby="tab-rider"
                            inert={tab !== 'rider'}
                            className="col-start-1 row-start-1 [transform:rotateY(180deg)] [backface-visibility:hidden]"
                        >
                            <MigoLoginForm
                                portal="public"
                                status={status}
                                canResetPassword={canResetPassword}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </MigoAuthShell>
    );
}
