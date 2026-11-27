import { useForm } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import AdminLayout from '@/layouts/admin-layout';

type Values = {
    initial_radius_km: number;
    max_radius_km: number;
    nearby_radius_km: number;
    expansion_interval_seconds: number;
    offer_expiration_seconds: number;
    max_search_duration_seconds: number;
    location_freshness_seconds: number;
    auto_offline_seconds: number;
    arrival_radius_meters: number;
    approaching_radius_meters: number;
    trial_hours: number;
    trial_daily_limit: number;
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

type Props = {
    values: Values;
    radii: number[];
    stepOptions: number[];
    canEdit: boolean;
    status?: string | null;
};

type TabId = 'find' | 'pickup' | 'fares' | 'riders';
type Problem = { tab: TabId; text: string };

const TABS: { id: TabId; label: string; blurb: string }[] = [
    { id: 'find', label: 'Finding riders', blurb: 'How far the search reaches, and how long each step lasts before it widens or gives up.' },
    { id: 'pickup', label: 'Pickup', blurb: 'What happens after a rider accepts and is on the way to the customer.' },
    { id: 'fares', label: 'Fares and seats', blurb: 'What each service charges and how many passengers it can carry.' },
    { id: 'riders', label: 'Rider rules', blurb: 'Which riders receive requests, how GPS is checked, and the free trial.' },
];

/** Fare settings per service. MigoMoto keeps the original keys; MigoCars and MigoDala have their own. */
const SERVICES: {
    name: string;
    prefix: 'fare_' | 'fare_cars_' | 'fare_dala_';
    unit: string;
    seats: keyof Values | null;
}[] = [
    { name: 'MigoMoto', prefix: 'fare_', unit: 'ride', seats: 'migomoto_max_passengers' },
    { name: 'MigoCars', prefix: 'fare_cars_', unit: 'ride', seats: 'migocars_max_passengers' },
    { name: 'MigoDala', prefix: 'fare_dala_', unit: 'delivery', seats: null },
];

const REQUIREMENTS = [
    'Rider account is verified and approved',
    'Rider account is active (not suspended)',
    'Rider has completed final accreditation',
    'Rider is online and marked available',
    'Rider is not on another active booking',
    'Rider has a valid GPS location',
];

const num = (v: unknown) => (v === '' || v === null || v === undefined ? NaN : Number(v));

/** Which tab a field lives on, so server-side errors can point at the right tab. */
function tabOfKey(key: string): TabId {
    if (key.startsWith('fare_') || key.endsWith('_max_passengers')) return 'fares';
    if (key === 'approaching_radius_meters' || key === 'arrival_radius_meters') return 'pickup';
    if (['location_freshness_seconds', 'auto_offline_seconds', 'trial_hours', 'trial_daily_limit'].includes(key)) return 'riders';
    return 'find';
}

/** Mirrors DispatchSettingsController: initial, the standard steps in between, then the maximum. */
function buildSteps(initial: number, max: number, options: number[]): number[] {
    if (!Number.isFinite(initial) || !Number.isFinite(max) || max < initial) return [];

    return [...new Set([initial, ...options.filter((x) => x > initial && x < max), max])].sort((a, b) => a - b);
}

/** Mirrors DispatchService::fareForKm. */
function fareFor(km: number, base: number, baseKm: number, perKm: number, min: number): number {
    return Math.max(min, base + perKm * Math.max(0, km - baseKm));
}

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const dur = (s: number) => {
    if (!Number.isFinite(s)) return '–';
    if (s < 60) return `${s} s`;

    return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`;
};

const hoursLabel = (h: number) => {
    if (!Number.isFinite(h) || h < 1) return '';
    if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`;
    const days = Math.floor(h / 24);
    const rest = h % 24;

    return `${days} day${days === 1 ? '' : 's'}${rest ? ` ${rest} h` : ''}`;
};

const ring = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-m-line bg-m-card p-5">
            <h3 className="text-base font-semibold">{title}</h3>
            {description && <p className="mt-1 text-sm text-m-muted">{description}</p>}
            <div className="mt-4">{children}</div>
        </section>
    );
}

export default function DispatchSettings({ values, radii, stepOptions, canEdit, status }: Props) {
    const form = useForm<Values>(values);
    const uid = useId();
    const [tab, setTab] = useState<TabId>('find');
    const [serviceIdx, setServiceIdx] = useState(0);

    const d = form.data;
    const n = (k: keyof Values) => num(d[k]);

    const steps = buildSteps(n('initial_radius_km'), n('max_radius_km'), stepOptions);
    const interval = n('expansion_interval_seconds');
    const offerTtl = n('offer_expiration_seconds');
    const maxDuration = n('max_search_duration_seconds');
    const secondsNeeded = steps.length > 0 ? (steps.length - 1) * interval + offerTtl : NaN;

    // The same rules the server enforces, shown while typing so the admin sees a problem before saving.
    const problems: Problem[] = [];
    if (n('max_radius_km') < n('initial_radius_km')) {
        problems.push({ tab: 'find', text: 'The maximum search radius cannot be smaller than the initial radius.' });
    }
    if (n('nearby_radius_km') > n('max_radius_km')) {
        problems.push({ tab: 'find', text: 'The nearby-riders map radius cannot be bigger than the maximum search radius.' });
    }
    if (maxDuration < offerTtl) {
        problems.push({ tab: 'find', text: 'The maximum search duration must be at least the offer expiration time.' });
    } else if (Number.isFinite(secondsNeeded) && maxDuration < secondsNeeded) {
        problems.push({
            tab: 'find',
            text: `Widening to ${d.max_radius_km} km and letting the last offers run out takes ${secondsNeeded} seconds. Raise the maximum search duration, widen faster, or lower the maximum radius.`,
        });
    }
    if (n('approaching_radius_meters') <= n('arrival_radius_meters')) {
        problems.push({ tab: 'pickup', text: 'The “rider is close” distance must be bigger than the arrival check distance.' });
    }
    if (n('auto_offline_seconds') < n('location_freshness_seconds')) {
        problems.push({ tab: 'riders', text: 'Auto-offline time cannot be shorter than the GPS freshness limit.' });
    }
    SERVICES.forEach((svc) => {
        if (n(`${svc.prefix}minimum_php` as keyof Values) < n(`${svc.prefix}base_php` as keyof Values)) {
            problems.push({ tab: 'fares', text: `${svc.name}: the minimum fare cannot be lower than the base fare.` });
        }
    });

    const changed = (Object.keys(values) as (keyof Values)[]).filter((k) => !Object.is(num(d[k]), num(values[k]))).length;
    const serverErrorTabs = new Set(Object.keys(form.errors).map(tabOfKey));
    const tabHasIssue = (id: TabId) => problems.some((p) => p.tab === id) || serverErrorTabs.has(id);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put('/admin/settings', { preserveScroll: true });
    };

    const discard = () => {
        form.setData(values);
        form.clearErrors();
    };

    const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = TABS.findIndex((t) => t.id === tab);
        const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
        setTab(next.id);
        document.getElementById(`${uid}-tab-${next.id}`)?.focus();
    };

    const field = (key: keyof Values, label: string, hint: string, unit: string, step = '1') => (
        <div>
            <label htmlFor={`${uid}-${key}`} className="mb-1 block text-sm font-medium">
                {label}
            </label>
            <div
                className={`flex items-stretch rounded-md border bg-m-card focus-within:ring-2 focus-within:ring-m-accent/20 ${
                    form.errors[key] ? 'border-m-red' : 'border-m-line focus-within:border-m-accent'
                } ${canEdit ? '' : 'bg-m-page'}`}
            >
                <input
                    id={`${uid}-${key}`}
                    type="number"
                    step={step}
                    inputMode="decimal"
                    value={form.data[key]}
                    disabled={!canEdit}
                    onChange={(e) => form.setData(key, e.target.value as unknown as number)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none disabled:text-m-muted"
                    aria-describedby={`${uid}-${key}-hint`}
                    aria-invalid={!!form.errors[key]}
                />
                <span className="flex items-center border-l border-m-line px-3 text-sm text-m-muted">{unit}</span>
            </div>
            <p id={`${uid}-${key}-hint`} className="mt-1 text-xs text-m-muted">
                {hint}
            </p>
            {form.errors[key] && (
                <p role="alert" className="mt-1 text-xs text-m-red">
                    {form.errors[key]}
                </p>
            )}
        </div>
    );

    /* ---------------------------------------------------------------- Finding riders */

    const timelineReady = steps.length > 0 && Number.isFinite(interval) && Number.isFinite(maxDuration) && Number.isFinite(offerTtl);

    const findPanel = (
        <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
                <Card title="How far we search" description="The search starts close to the pickup point and widens step by step.">
                    <div className="grid gap-5 sm:grid-cols-2">
                        {field('initial_radius_km', 'Start at', 'Riders this close are asked first.', 'km', '0.1')}
                        {field('max_radius_km', 'Never go beyond', 'The farthest the search will ever reach.', 'km', '0.1')}
                    </div>
                    <p className="mt-4 text-sm text-m-muted">
                        Steps after saving: <span className="font-medium text-inherit">{(steps.length ? steps : radii).join(' → ')} km</span>
                    </p>
                </Card>
                <Card title="How long each step lasts" description="Every request goes to all eligible riders in range at once. The first rider to accept gets the booking.">
                    <div className="grid gap-5 sm:grid-cols-2">
                        {field('offer_expiration_seconds', 'Rider has to accept within', 'How long a request stays open (5–120). Checked on the server.', 'seconds')}
                        {field('expansion_interval_seconds', 'Widen the search every', 'Wait this long before the next radius (5–300).', 'seconds')}
                        {field('max_search_duration_seconds', 'Give up after', 'Then the booking becomes “no rider found” (30–1800).', 'seconds')}
                    </div>
                </Card>
                <Card title="Customer map" description="The “riders near you” map shown before a customer books.">
                    {field('nearby_radius_km', 'Map radius', 'Cannot be bigger than the farthest search distance.', 'km', '0.1')}
                </Card>
            </div>

            <section className="h-fit rounded-lg border border-m-line bg-m-card p-5 lg:sticky lg:top-4">
                <h3 className="text-base font-semibold">What a customer's search looks like</h3>
                <p className="mt-1 text-sm text-m-muted">Updates as you type, so you can check the timing before saving.</p>

                {timelineReady ? (
                    <ol className="relative mt-5 ml-1.5 border-l border-m-line">
                        {steps.map((r, i) => {
                            const t = i * interval;
                            const reachable = t < maxDuration;

                            return (
                                <li key={`${r}-${i}`} className={`relative pb-4 pl-5 ${reachable ? '' : 'text-m-muted'}`}>
                                    <span aria-hidden className={`absolute top-1.5 -left-[5px] size-2.5 rounded-full ${reachable ? (i === 0 ? 'bg-m-forest' : 'bg-m-accent') : 'bg-m-line'}`} />
                                    <div className="flex items-baseline gap-3">
                                        <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{dur(t)}</span>
                                        <span className="text-sm">
                                            {i === 0 ? `Riders within ${r} km get the request.` : `The search widens to ${r} km.`}
                                            {!reachable && ' Never reached: the search ends first.'}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                        <li className="relative pl-5">
                            <span aria-hidden className="absolute top-1.5 -left-[5px] size-2.5 rounded-full bg-m-red" />
                            <div className="flex items-baseline gap-3">
                                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{dur(maxDuration)}</span>
                                <span className="text-sm">No rider found. The booking closes and the customer is told.</span>
                            </div>
                        </li>
                    </ol>
                ) : (
                    <p className="mt-5 text-sm text-m-muted">Enter valid numbers to see the timeline.</p>
                )}

                <ul className="mt-5 space-y-1.5 border-t border-m-line pt-4 text-xs text-m-muted">
                    <li>Each request stays open for {dur(offerTtl)}. A rider who declines or misses it is not asked again for that booking.</li>
                    <li>Timing is checked every 5 seconds, so a step can run up to 5 seconds late.</li>
                </ul>
            </section>
        </div>
    );

    /* ---------------------------------------------------------------- Pickup */

    const pickupPanel = (
        <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Rider is close" description="The customer gets a “your rider is nearby” alert once.">
                {field('approaching_radius_meters', 'Send the alert when the rider is within', 'Distance to the pickup point (50–2000).', 'metres')}
            </Card>
            <Card title="Rider has arrived" description="The rider can only tap “I’ve arrived” when their GPS is near the pickup point.">
                {field('arrival_radius_meters', 'Allow “I’ve arrived” within', 'Enter 0 to turn this check off.', 'metres')}
            </Card>
            <p className="text-sm text-m-muted lg:col-span-2">
                {n('approaching_radius_meters') > n('arrival_radius_meters')
                    ? `The customer is alerted at ${d.approaching_radius_meters} m, and the rider can confirm arrival from ${d.arrival_radius_meters} m.`
                    : 'The alert distance has to be bigger than the arrival distance so the customer is warned before the rider can confirm arrival.'}
            </p>
        </div>
    );

    /* ---------------------------------------------------------------- Fares and seats */

    const svc = SERVICES[serviceIdx];
    const sk = (name: string) => `${svc.prefix}${name}` as keyof Values;
    const fareOf = (s: (typeof SERVICES)[number], km: number) =>
        fareFor(km, num(d[`${s.prefix}base_php` as keyof Values]), num(d[`${s.prefix}base_km` as keyof Values]), num(d[`${s.prefix}per_km_php` as keyof Values]), num(d[`${s.prefix}minimum_php` as keyof Values]));

    const base = n(sk('base_php'));
    const baseKm = n(sk('base_km'));
    const perKm = n(sk('per_km_php'));
    const exampleKm = 5;
    const exampleTotal = fareOf(svc, exampleKm);
    const extraKm = Math.max(0, exampleKm - baseKm);
    const fareValid = [base, baseKm, perKm, n(sk('minimum_php'))].every(Number.isFinite);

    const faresPanel = (
        <div className="space-y-5">
            <div role="group" aria-label="Choose a service" className="inline-flex rounded-md border border-m-line bg-m-card p-1">
                {SERVICES.map((s, i) => (
                    <button
                        key={s.name}
                        type="button"
                        aria-pressed={i === serviceIdx}
                        onClick={() => setServiceIdx(i)}
                        className={`rounded px-4 py-1.5 text-sm font-medium ${ring} ${i === serviceIdx ? 'bg-m-forest text-white' : 'text-m-muted hover:bg-m-page'}`}
                    >
                        {s.name}
                    </button>
                ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-5">
                    <Card title={`${svc.name} fare`} description={`Total = base fare + the rate for every extra kilometre. Customers see this before they confirm.`}>
                        <div className="grid gap-5 sm:grid-cols-2">
                            {field(sk('base_php'), 'Base fare', `Charged for the first kilometres of every ${svc.unit}.`, '₱', '0.5')}
                            {field(sk('base_km'), 'Kilometres in the base fare', '1 means the first 1 km.', 'km', '0.1')}
                            {field(sk('per_km_php'), 'Rate per extra km', 'Charged for each km after that.', '₱ per km', '0.5')}
                            {field(sk('minimum_php'), 'Minimum fare', 'The lowest total. Keep it equal to the base fare unless you want a higher floor.', '₱', '0.5')}
                        </div>
                    </Card>
                    {svc.seats ? (
                        <Card title="Seats" description="The most passengers a customer can book.">
                            {field(svc.seats, `${svc.name} capacity`, svc.seats === 'migomoto_max_passengers' ? 'A motorcycle normally seats 1 (maximum 2).' : 'Seats offered per car (1–8).', 'passengers')}
                        </Card>
                    ) : (
                        <p className="text-sm text-m-muted">MigoDala carries packages, so it has no passenger limit.</p>
                    )}
                </div>

                <section className="h-fit rounded-lg border border-m-line bg-m-card p-5">
                    <h3 className="text-base font-semibold">What customers will pay</h3>
                    <p className="mt-1 text-sm text-m-muted" aria-live="polite">
                        {fareValid
                            ? `A ${exampleKm} km ${svc.name} ${svc.unit} costs ${peso(exampleTotal)}: ${peso(base)} for the first ${baseKm} km${extraKm > 0 ? ` plus ${extraKm} km at ${peso(perKm)} per km` : ''}${exampleTotal > base + perKm * extraKm ? ', raised to the minimum fare' : ''}.`
                            : 'Enter valid numbers to see an example.'}
                    </p>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                            <caption className="sr-only">Fare by distance for each service</caption>
                            <thead>
                                <tr className="border-b border-m-line text-left text-m-muted">
                                    <th scope="col" className="py-2 pr-3 font-medium">Distance</th>
                                    {SERVICES.map((s, i) => (
                                        <th key={s.name} scope="col" className={`px-3 py-2 text-right font-medium ${i === serviceIdx ? 'text-inherit' : ''}`}>
                                            {s.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[1, 3, 5, 10].map((km) => (
                                    <tr key={km} className="border-b border-m-line last:border-0">
                                        <th scope="row" className="py-2 pr-3 text-left font-normal">{km} km</th>
                                        {SERVICES.map((s, i) => {
                                            const f = fareOf(s, km);

                                            return (
                                                <td key={s.name} className={`px-3 py-2 text-right tabular-nums ${i === serviceIdx ? 'bg-m-page font-semibold' : ''}`}>
                                                    {Number.isFinite(f) ? peso(f) : '–'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );

    /* ---------------------------------------------------------------- Rider rules */

    const ridersPanel = (
        <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
                <Card title="Location checks" description="Keeps requests from going to riders whose location is out of date.">
                    <div className="grid gap-5 sm:grid-cols-2">
                        {field('location_freshness_seconds', 'GPS counts as fresh for', 'An older location is skipped until a new one arrives (15–600).', 'seconds')}
                        {field('auto_offline_seconds', 'Set offline after no GPS for', 'Available riders who go silent are taken offline (60–3600).', 'seconds')}
                    </div>
                </Card>
                <Card title="Free trial" description="Every newly accredited rider gets one free trial.">
                    <div className="grid gap-5 sm:grid-cols-2">
                        {field('trial_hours', 'Trial length', `${hoursLabel(n('trial_hours')) || 'Enter 1–720 hours'}. Applies only to trials that start after you save.`, 'hours')}
                        {field('trial_daily_limit', 'Bookings per day', 'Most bookings a trial rider can accept a day (1–50). Applies to running trials right away. Resets at 12:00 AM Philippine time.', 'per day')}
                    </div>
                </Card>
            </div>
            <section className="h-fit rounded-lg border border-m-line bg-m-card p-5">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                    <Lock className="size-4 text-m-muted" aria-hidden />
                    Always required
                </h3>
                <p className="mt-1 text-sm text-m-muted">A rider must meet all of these to get a request. These safety rules cannot be switched off.</p>
                <ul className="mt-4 space-y-2.5">
                    {REQUIREMENTS.map((r) => (
                        <li key={r} className="flex items-center gap-2 text-sm">
                            <ShieldCheck className="size-4 shrink-0 text-m-green" aria-hidden />
                            {r}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );

    const panels: Record<TabId, ReactNode> = { find: findPanel, pickup: pickupPanel, fares: faresPanel, riders: ridersPanel };
    const activeBlurb = TABS.find((t) => t.id === tab)?.blurb;
    const tabProblems = problems.filter((p) => p.tab === tab);

    return (
        <AdminLayout title="Admin Settings">
            <div className="mb-5">
                <h2 className="text-2xl font-bold">Dispatch Settings</h2>
                <p className="text-sm text-m-muted">How riders are found, what rides cost, and the rules riders follow. Changes apply to new bookings right away.</p>
            </div>

            {status && (
                <p role="status" className="mb-4 flex items-center gap-2 rounded-md border border-m-green/30 bg-m-green/5 px-4 py-2 text-sm text-m-green">
                    <CheckCircle2 className="size-4" aria-hidden />
                    {status}
                </p>
            )}
            {!canEdit && (
                <p className="mb-4 flex items-center gap-2 rounded-md border border-m-line bg-m-card px-4 py-3 text-sm text-m-muted">
                    <Lock className="size-4 shrink-0" aria-hidden />
                    These settings are read-only for your role. Only a super administrator can change them.
                </p>
            )}

            <form onSubmit={submit}>
                <div role="tablist" aria-label="Setting groups" onKeyDown={onTabKey} className="flex gap-1 overflow-x-auto border-b border-m-line">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            id={`${uid}-tab-${t.id}`}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.id}
                            aria-controls={`${uid}-panel-${t.id}`}
                            tabIndex={tab === t.id ? 0 : -1}
                            onClick={() => setTab(t.id)}
                            className={`relative -mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm ${ring} ${
                                tab === t.id ? 'border-m-forest font-semibold' : 'border-transparent text-m-muted hover:text-inherit'
                            }`}
                        >
                            {t.label}
                            {tabHasIssue(t.id) && (
                                <>
                                    <span aria-hidden className="absolute top-2 right-1.5 size-2 rounded-full bg-m-red" />
                                    <span className="sr-only"> (needs attention)</span>
                                </>
                            )}
                        </button>
                    ))}
                </div>

                <div id={`${uid}-panel-${tab}`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="pt-5 pb-6">
                    <p className="mb-4 text-sm text-m-muted">{activeBlurb}</p>

                    {canEdit && tabProblems.length > 0 && (
                        <ul role="alert" className="mb-5 space-y-1 rounded-md border border-m-red/30 bg-m-red/5 px-4 py-3 text-sm text-m-red">
                            {tabProblems.map((p) => (
                                <li key={p.text}>{p.text}</li>
                            ))}
                        </ul>
                    )}

                    {panels[tab]}
                </div>

                {canEdit && (
                    <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-m-line bg-m-card px-4 py-3">
                        <p className="flex items-center gap-2 text-sm" aria-live="polite">
                            {problems.length > 0 ? (
                                <>
                                    <AlertCircle className="size-4 text-m-red" aria-hidden />
                                    <span className="text-m-red">
                                        {problems.length} {problems.length === 1 ? 'problem' : 'problems'} to fix before saving.
                                    </span>
                                    <button type="button" onClick={() => setTab(problems[0].tab)} className={`rounded text-sm underline ${ring}`}>
                                        Show me
                                    </button>
                                </>
                            ) : changed > 0 ? (
                                <span>
                                    {changed} unsaved {changed === 1 ? 'change' : 'changes'}
                                </span>
                            ) : (
                                <span className="text-m-muted">No unsaved changes</span>
                            )}
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={discard}
                                disabled={form.processing || changed === 0}
                                className={`rounded-md border border-m-line bg-m-card px-4 py-2 text-sm font-medium hover:bg-m-page disabled:opacity-50 ${ring}`}
                            >
                                Discard changes
                            </button>
                            <button
                                type="submit"
                                disabled={form.processing || changed === 0 || problems.length > 0}
                                className={`rounded-md bg-m-forest px-5 py-2 text-sm font-medium text-white hover:bg-m-forest-hover disabled:opacity-50 ${ring}`}
                            >
                                {form.processing ? 'Saving...' : 'Save changes'}
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </AdminLayout>
    );
}