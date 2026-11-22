import { useForm } from '@inertiajs/react';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import AdminLayout from '@/layouts/admin-layout';

type Values = {
    initial_radius_km: number;
    max_radius_km: number;
    expansion_interval_seconds: number;
    offer_expiration_seconds: number;
    max_search_duration_seconds: number;
    location_freshness_seconds: number;
    auto_offline_seconds: number;
    arrival_radius_meters: number;
    approaching_radius_meters: number;
    fare_base_php: number;
    fare_base_km: number;
    fare_per_km_php: number;
    fare_minimum_php: number;
    fare_cars_base_php: number;
    fare_cars_base_km: number;
    fare_cars_per_km_php: number;
    fare_cars_minimum_php: number;
    fare_dala_base_php: number;
    fare_dala_base_km: number;
    fare_dala_per_km_php: number;
    fare_dala_minimum_php: number;
    migomoto_max_passengers: number;
    migocars_max_passengers: number;
};

/** Fare settings per service. MigoMoto keeps the original keys; MigoCars and MigoDala have their own. */
const FARE_SERVICES: { name: string; prefix: 'fare_' | 'fare_cars_' | 'fare_dala_'; unit: string }[] = [
    { name: 'MigoMoto', prefix: 'fare_', unit: 'ride' },
    { name: 'MigoCars', prefix: 'fare_cars_', unit: 'ride' },
    { name: 'MigoDala', prefix: 'fare_dala_', unit: 'delivery' },
];
type Props = {
    values: Values;
    radii: number[];
    canEdit: boolean;
    status?: string | null;
};

const control =
    'w-full rounded-md border border-m-line bg-m-card px-3 py-2 text-sm outline-none focus:border-m-accent focus:ring-2 focus:ring-m-accent/20 disabled:bg-m-page disabled:text-m-muted';
const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

const requirements = [
    'Rider account is verified and approved',
    'Rider account is active (not suspended)',
    'Rider has completed final accreditation',
    'Rider is online and marked available',
    'Rider is not on another active booking',
    'Rider has a valid GPS location',
];

export default function DispatchSettings({
    values,
    radii,
    canEdit,
    status,
}: Props) {
    const form = useForm<Values>(values);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put('/admin/settings', { preserveScroll: true });
    };

    const field = (
        key: keyof Values,
        label: string,
        hint: string,
        unit: string,
        step = '1',
    ) => (
        <div>
            <label htmlFor={key} className="mb-1 block text-sm font-medium">
                {label}
            </label>
            <div className="flex items-center gap-2">
                <input
                    id={key}
                    type="number"
                    step={step}
                    inputMode="decimal"
                    value={form.data[key]}
                    disabled={!canEdit}
                    onChange={(e) =>
                        form.setData(key, e.target.value as unknown as number)
                    }
                    className={control}
                    aria-describedby={`${key}-hint`}
                    aria-invalid={!!form.errors[key]}
                />
                <span className="shrink-0 text-sm text-m-muted">{unit}</span>
            </div>
            <p id={`${key}-hint`} className="mt-1 text-xs text-m-muted">
                {hint}
            </p>
            {form.errors[key] && (
                <p role="alert" className="mt-1 text-xs text-m-red">
                    {form.errors[key]}
                </p>
            )}
        </div>
    );

    return (
        <AdminLayout title="Admin Settings">
            <div className="mb-4">
                <h2 className="text-2xl font-bold">Dispatch Settings</h2>
                <p className="text-sm text-m-muted">
                    Controls how nearby riders are found and how long offers
                    stay open. Changes apply to new searches immediately.
                </p>
            </div>

            {status && (
                <p
                    role="status"
                    className="mb-4 flex items-center gap-2 rounded-md border border-m-green/30 bg-m-green/5 px-4 py-2 text-sm text-m-green"
                >
                    <CheckCircle2 className="size-4" aria-hidden />
                    {status}
                </p>
            )}
            {!canEdit && (
                <p className="mb-4 flex items-center gap-2 rounded-md border border-m-line bg-m-card px-4 py-3 text-sm text-m-muted">
                    <Lock className="size-4 shrink-0" aria-hidden />
                    These settings are read-only for your role. Only a super
                    administrator can change them.
                </p>
            )}

            <form onSubmit={submit} className="space-y-6">
                <section className="rounded-lg border border-m-line bg-m-card p-5 shadow-sm">
                    <h3 className="mb-1 text-base font-semibold">
                        Search radius
                    </h3>
                    <p className="mb-4 text-xs text-m-muted">
                        The search starts at the initial radius and widens in
                        steps until a rider accepts or the maximum is reached.
                        Current steps: {radii.join(' → ')} km.
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2">
                        {field(
                            'initial_radius_km',
                            'Initial search radius',
                            'Riders inside this distance of the pickup point are offered the booking first.',
                            'km',
                            '0.1',
                        )}
                        {field(
                            'max_radius_km',
                            'Maximum search radius',
                            'The search never goes beyond this distance.',
                            'km',
                            '0.1',
                        )}
                    </div>
                </section>

                {FARE_SERVICES.map((svc) => {
                    const k = (n: string) => `${svc.prefix}${n}` as keyof Values;

                    return (
                        <section key={svc.name} className="rounded-lg border border-m-line bg-m-card p-5 shadow-sm">
                            <h3 className="mb-1 text-base font-semibold">{svc.name} fares</h3>
                            <p className="mb-4 text-xs text-m-muted">
                                Total fare = base fare for the first kilometres + the rate for every additional kilometre.
                                Customers see this breakdown before they confirm, and riders see the same saved fare.
                            </p>
                            <div className="grid gap-5 sm:grid-cols-2">
                                {field(k('base_php'), 'Base fare', `Charged for the first kilometres of every ${svc.unit}.`, '₱', '0.5')}
                                {field(k('base_km'), 'Distance covered by the base fare', 'Kilometres included in the base fare (1 = the first 1 km).', 'km', '0.1')}
                                {field(k('per_km_php'), 'Additional distance rate', 'Charged for each kilometre after the base distance.', '₱ per km', '0.5')}
                                {field(k('minimum_php'), 'Minimum fare', 'The lowest total fare. Keep it equal to the base fare unless you want a higher floor.', '₱', '0.5')}
                            </div>
                        </section>
                    );
                })}

                <section className="rounded-lg border border-m-line bg-m-card p-5 shadow-sm">
                    <h3 className="mb-1 text-base font-semibold">Passenger capacity</h3>
                    <p className="mb-4 text-xs text-m-muted">
                        The most passengers a customer can book. MigoDala carries packages, not passengers.
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2">
                        {field('migomoto_max_passengers', 'MigoMoto capacity', 'A motorcycle normally seats 1 (maximum 2).', 'passengers')}
                        {field('migocars_max_passengers', 'MigoCars capacity', 'Seats offered per car (1–8).', 'passengers')}
                    </div>
                </section>

                <section className="rounded-lg border border-m-line bg-m-card p-5 shadow-sm">
                    <h3 className="mb-4 text-base font-semibold">Timing</h3>
                    <div className="grid gap-5 sm:grid-cols-2">
                        {field(
                            'expansion_interval_seconds',
                            'Search expansion interval',
                            'How long to wait before widening the radius (5–300).',
                            'seconds',
                        )}
                        {field(
                            'offer_expiration_seconds',
                            'Offer expiration time',
                            'How long a rider has to accept an offer (5–120). Checked on the server.',
                            'seconds',
                        )}
                        {field(
                            'max_search_duration_seconds',
                            'Maximum search duration',
                            'After this the booking becomes "no rider found" (30–1800, at least the offer time).',
                            'seconds',
                        )}
                        {field(
                            'approaching_radius_meters',
                            'Rider approaching distance',
                            'The passenger is told the rider is nearby when the rider is this close to the pickup point (50–2000).',
                            'metres',
                        )}
                        {field(
                            'arrival_radius_meters',
                            'Arrival check distance',
                            'A rider can only tap "I\'ve Arrived" within this distance of the pickup point. 0 turns the check off.',
                            'metres',
                        )}
                    </div>
                </section>

                <section className="rounded-lg border border-m-line bg-m-card p-5 shadow-sm">
                    <h3 className="mb-1 text-base font-semibold">
                        Rider eligibility
                    </h3>
                    <p className="mb-4 text-xs text-m-muted">
                        GPS freshness can be tuned. The safety requirements
                        below are always enforced and cannot be switched off.
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2">
                        {field(
                            'location_freshness_seconds',
                            'GPS freshness limit',
                            'A rider whose last GPS update is older than this is skipped until a new location arrives (15–600).',
                            'seconds',
                        )}
                        {field(
                            'auto_offline_seconds',
                            'Auto-offline after silence',
                            'Available riders who send no GPS for this long are taken offline (60–3600).',
                            'seconds',
                        )}
                    </div>
                    <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                        {requirements.map((r) => (
                            <li
                                key={r}
                                className="flex items-center gap-2 text-sm"
                            >
                                <ShieldCheck
                                    className="size-4 shrink-0 text-m-green"
                                    aria-hidden
                                />
                                {r}
                            </li>
                        ))}
                    </ul>
                </section>

                {canEdit && (
                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={form.processing || !form.isDirty}
                            className={`rounded-md bg-m-forest px-5 py-2 text-sm font-medium text-white hover:bg-m-forest-hover disabled:opacity-50 ${ring}`}
                        >
                            {form.processing ? 'Saving...' : 'Save settings'}
                        </button>
                        <button
                            type="button"
                            onClick={() => form.reset()}
                            disabled={form.processing || !form.isDirty}
                            className={`rounded-md border border-m-line bg-m-card px-4 py-2 text-sm font-medium hover:bg-m-page disabled:opacity-50 ${ring}`}
                        >
                            Discard changes
                        </button>
                    </div>
                )}
            </form>
        </AdminLayout>
    );
}
