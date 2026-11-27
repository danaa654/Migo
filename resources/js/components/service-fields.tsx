import { Bike, Car, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ServiceInfo } from '@/lib/services';
import { PACKAGE_SIZE_LABEL } from '@/lib/services';

export type ServiceData = {
    passenger_count: number;
    notes: string;
    recipient_name: string;
    recipient_phone: string;
    item_description: string;
    package_size: string;
    /** MigoDala only: 'two_wheel' (motorcycle) or 'four_wheel' (car). A Large package is always a car. */
    delivery_vehicle: string;
};
type Errors = Partial<Record<keyof ServiceData, string>>;

const input =
    'w-full rounded-xl border border-m-line2 bg-m-card px-3.5 py-2.5 text-sm text-m-ink outline-none transition placeholder:text-m-faint focus:border-m-accent focus:ring-2 focus:ring-m-accent/20';

function Field({
    id,
    label,
    optional,
    error,
    children,
}: {
    id: string;
    label: string;
    optional?: boolean;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div>
            <label htmlFor={id} className="mb-1 block text-sm font-semibold text-m-ink">
                {label}
                {optional && (
                    <span className="ml-1 font-normal text-m-muted">(optional)</span>
                )}
            </label>
            {children}
            {error && (
                <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-m-redtext">
                    {error}
                </p>
            )}
        </div>
    );
}

/** The part of the booking form that differs per service: passengers (rides) or recipient and package (MigoDala). */
export default function ServiceFields({
    service,
    data,
    errors,
    onChange,
}: {
    service: ServiceInfo;
    data: ServiceData;
    errors: Errors;
    onChange: <K extends keyof ServiceData>(key: K, value: ServiceData[K]) => void;
}) {
    const aria = (k: keyof ServiceData) => ({
        'aria-invalid': errors[k] ? true : undefined,
        'aria-describedby': errors[k] ? `${k}-err` : undefined,
    });

    if (service.is_delivery) {
        const large = data.package_size === 'large';
        const vehicle = large ? 'four_wheel' : data.delivery_vehicle || 'two_wheel';
        const vehicles = [
            { key: 'two_wheel', label: 'Motorcycle', hint: 'Small and medium items', Icon: Bike, disabled: large },
            { key: 'four_wheel', label: 'Car', hint: 'Large or bulky items', Icon: Car, disabled: false },
        ];

        return (
            <div className="grid gap-4 sm:grid-cols-2">
                <Field id="recipient_name" label="Recipient name" error={errors.recipient_name}>
                    <input
                        id="recipient_name"
                        className={input}
                        value={data.recipient_name}
                        maxLength={120}
                        autoComplete="off"
                        placeholder="Who will receive it?"
                        onChange={(e) => onChange('recipient_name', e.target.value)}
                        {...aria('recipient_name')}
                    />
                </Field>
                <Field id="recipient_phone" label="Recipient contact number" error={errors.recipient_phone}>
                    <input
                        id="recipient_phone"
                        className={input}
                        type="tel"
                        inputMode="tel"
                        value={data.recipient_phone}
                        maxLength={20}
                        autoComplete="off"
                        placeholder="0917 123 4567"
                        onChange={(e) => onChange('recipient_phone', e.target.value)}
                        {...aria('recipient_phone')}
                    />
                </Field>
                <div className="sm:col-span-2">
                    <Field id="item_description" label="Package / item description" error={errors.item_description}>
                        <input
                            id="item_description"
                            className={input}
                            value={data.item_description}
                            maxLength={255}
                            autoComplete="off"
                            placeholder="e.g. Documents in a brown envelope"
                            onChange={(e) => onChange('item_description', e.target.value)}
                            {...aria('item_description')}
                        />
                    </Field>
                </div>
                <fieldset className="sm:col-span-2">
                    <legend className="mb-1 text-sm font-semibold text-m-ink">Package size</legend>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-describedby={errors.package_size ? 'package_size-err' : undefined}>
                        {Object.keys(service.package_sizes ?? PACKAGE_SIZE_LABEL).map((k) => {
                            const on = data.package_size === k;
                            const full = service.package_sizes?.[k] ?? PACKAGE_SIZE_LABEL[k];

                            return (
                                <button
                                    key={k}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    onClick={() => {
                                        onChange('package_size', k);
                                        // A large package does not fit on a motorcycle: switch to a car automatically.
                                        if (k === 'large') onChange('delivery_vehicle', 'four_wheel');
                                    }}
                                    className={`rounded-xl border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent ${
                                        on
                                            ? 'border-m-forest bg-m-forest text-white'
                                            : 'border-m-line2 bg-m-card text-m-body hover:bg-m-mint'
                                    }`}
                                >
                                    <span className="block text-sm font-semibold">{PACKAGE_SIZE_LABEL[k] ?? k}</span>
                                    <span className={`block text-[11px] leading-tight ${on ? 'text-white/80' : 'text-m-muted'}`}>
                                        {full.replace(/^\w+ /, '')}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {errors.package_size && (
                        <p id="package_size-err" role="alert" className="mt-1 text-xs text-m-redtext">
                            {errors.package_size}
                        </p>
                    )}
                </fieldset>
                <fieldset className="sm:col-span-2">
                    <legend className="mb-1 text-sm font-semibold text-m-ink">Delivery vehicle</legend>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-describedby="delivery_vehicle-hint">
                        {vehicles.map(({ key, label, hint, Icon, disabled }) => {
                            const on = vehicle === key;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    disabled={disabled}
                                    onClick={() => onChange('delivery_vehicle', key)}
                                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                                        on
                                            ? 'border-m-forest bg-m-forest text-white'
                                            : 'border-m-line2 bg-m-card text-m-body hover:bg-m-mint'
                                    }`}
                                >
                                    <Icon className="size-5 shrink-0" aria-hidden />
                                    <span>
                                        <span className="block text-sm font-semibold">{label}</span>
                                        <span className={`block text-[11px] leading-tight ${on ? 'text-white/80' : 'text-m-muted'}`}>
                                            {hint}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p id="delivery_vehicle-hint" className="mt-1 text-xs text-m-muted">
                        {large
                            ? 'Large packages are delivered by car, so Car is selected for you.'
                            : 'Your delivery is only offered to riders with the vehicle you choose.'}
                    </p>
                </fieldset>
                <div className="sm:col-span-2">
                    <Field id="notes" label="Delivery notes" optional error={errors.notes}>
                        <textarea
                            id="notes"
                            className={`${input} min-h-16 resize-y`}
                            value={data.notes}
                            maxLength={300}
                            placeholder="Handle with care, leave at the guard, call on arrival…"
                            onChange={(e) => onChange('notes', e.target.value)}
                            {...aria('notes')}
                        />
                    </Field>
                </div>
            </div>
        );
    }

    const max = service.max_passengers;
    const set = (n: number) => onChange('passenger_count', Math.min(max, Math.max(1, n)));

    return (
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div>
                <p id="passenger_count-label" className="mb-1 text-sm font-semibold text-m-ink">
                    {max === 1 ? 'Passenger' : 'Number of passengers'}
                </p>
                {max === 1 ? (
                    <p className="rounded-xl bg-m-mint px-3.5 py-2.5 text-sm text-m-body2">
                        1 passenger <span className="text-m-muted">· a motorcycle seats one</span>
                    </p>
                ) : (
                    <div
                        role="group"
                        aria-labelledby="passenger_count-label"
                        className="inline-flex items-center gap-1 rounded-full border border-m-line2 bg-m-card p-1"
                    >
                        <button
                            type="button"
                            aria-label="One fewer passenger"
                            disabled={data.passenger_count <= 1}
                            onClick={() => set(data.passenger_count - 1)}
                            className="flex size-8 items-center justify-center rounded-full text-m-accent transition hover:bg-m-mint disabled:opacity-40"
                        >
                            <Minus className="size-4" aria-hidden />
                        </button>
                        <output className="w-8 text-center text-sm font-bold text-m-ink" aria-live="polite">
                            {data.passenger_count}
                        </output>
                        <button
                            type="button"
                            aria-label="One more passenger"
                            disabled={data.passenger_count >= max}
                            onClick={() => set(data.passenger_count + 1)}
                            className="flex size-8 items-center justify-center rounded-full text-m-accent transition hover:bg-m-mint disabled:opacity-40"
                        >
                            <Plus className="size-4" aria-hidden />
                        </button>
                    </div>
                )}
                <p className="mt-1 text-xs text-m-muted">
                    {max === 1 ? 'Capacity: 1' : `Maximum ${max}`}
                </p>
                {errors.passenger_count && (
                    <p id="passenger_count-err" role="alert" className="mt-1 text-xs text-m-redtext">
                        {errors.passenger_count}
                    </p>
                )}
            </div>
            <Field id="notes" label="Pickup notes" optional error={errors.notes}>
                <textarea
                    id="notes"
                    className={`${input} min-h-16 resize-y`}
                    value={data.notes}
                    maxLength={300}
                    placeholder="Gate colour, landmark, what you are wearing…"
                    onChange={(e) => onChange('notes', e.target.value)}
                    {...aria('notes')}
                />
            </Field>
        </div>
    );
}