import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    Eye,
    EyeOff,
    ImagePlus,
    ListChecks,
    Phone,
    X,
    type LucideIcon,
} from 'lucide-react';
import {
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
    type ReactNode,
} from 'react';

/* Registration-only UI kit. The login pages keep using migo-auth-shell / migo-form-fields. */

export const PHONE_RE = /^09\d{9}$/;
export const PHONE_ERROR =
    'Enter exactly 11 digits starting with 09, for example 09171234567.';

/** Keeps digits only, turns +63 / 63 prefixes into 0, and caps the number at 11 digits. */
export function cleanPhone(raw: string): string {
    let v = raw.trim();
    if (v.startsWith('+63')) v = `0${v.slice(3)}`;
    v = v.replace(/\D/g, '');
    if (v.startsWith('63') && v.length > 11) v = `0${v.slice(2)}`;
    return v.slice(0, 11);
}

const inputBase =
    'h-12 w-full rounded-xl border bg-m-page2 pl-11 pr-3.5 text-sm text-m-body placeholder:text-m-faint transition focus:bg-m-card focus:outline-none focus:ring-4 disabled:opacity-60';
const inputOk =
    'border-m-line2 focus:border-m-accent focus:ring-m-accent/15';
const inputBad =
    'border-m-red focus:border-m-red focus:ring-m-red/15';
const labelCls = 'mb-1.5 block text-sm font-medium text-m-ink';

export const gradientBtn =
    'group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-m-forest to-m-forest-hover px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-m-accent/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-m-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0';

type Side = {
    badge: string;
    heading: string;
    text: string;
    points?: string[];
    extra?: ReactNode;
    icon: LucideIcon;
};

type ShellProps = {
    title: string;
    subtitle: string;
    children: ReactNode;
    side?: Side;
    /** Centered, wide layout without the side panel (account-type selection). */
    centered?: boolean;
    back?: { href: string; label: string };
};

function Backdrop() {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div className="reg-float absolute -top-24 -left-24 size-80 rounded-full bg-m-forest/10" />
            <div className="reg-float-slow absolute top-1/3 -right-20 size-72 rounded-full bg-m-mint" />
            <div className="reg-float absolute bottom-10 left-[12%] size-6 rounded-full border-2 border-m-accent/30" />
            <div className="reg-float-slow absolute top-24 right-[18%] size-8 rotate-12 rounded-md border-2 border-m-accent/30" />
        </div>
    );
}

function SidePanel({ side }: { side: Side }) {
    const Icon = side.icon;
    return (
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-m-forest via-m-forest-hover to-m-solid p-9 text-white lg:flex lg:flex-col">
            <div
                aria-hidden
                className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10"
            />
            <div
                aria-hidden
                className="absolute -bottom-20 -left-12 size-64 rounded-full bg-white/5"
            />
            <svg
                aria-hidden
                viewBox="0 0 300 160"
                className="absolute inset-x-0 bottom-6 w-full opacity-40"
            >
                <path
                    d="M-10 120 C 60 40 120 150 180 80 S 280 40 320 70"
                    fill="none"
                    stroke="#fff"
                    strokeOpacity=".4"
                    strokeWidth="2.5"
                    strokeDasharray="2 9"
                    strokeLinecap="round"
                />
                <circle cx="180" cy="80" r="6" fill="#fff" />
                <circle
                    cx="180"
                    cy="80"
                    r="14"
                    fill="#fff"
                    fillOpacity=".2"
                    className="reg-pulse"
                />
            </svg>

            <div className="relative z-10">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur">
                    <Icon className="size-3.5" aria-hidden /> {side.badge}
                </span>
                <h2 className="mt-5 text-3xl leading-tight font-bold">
                    {side.heading}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/80">
                    {side.text}
                </p>
                {side.points && side.points.length > 0 && (
                    <ul className="mt-7 space-y-3.5">
                        {side.points.map((p) => (
                            <li
                                key={p}
                                className="flex items-start gap-3 text-sm"
                            >
                                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-m-card text-m-accent">
                                    <Check
                                        className="size-3"
                                        strokeWidth={3}
                                        aria-hidden
                                    />
                                </span>
                                <span className="leading-snug text-white/95">
                                    {p}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                {side.extra && <div className="mt-6">{side.extra}</div>}
            </div>
        </aside>
    );
}

export function RegisterShell({
    title,
    subtitle,
    children,
    side,
    centered = false,
    back = { href: '/', label: 'Back to Home' },
}: ShellProps) {
    return (
        <>
            <Head title={title}>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
                <style>{`
                    @media (prefers-reduced-motion: no-preference) {
                        @keyframes reg-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
                        @keyframes reg-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
                        @keyframes reg-pulse { 0% { transform: scale(.6); opacity: .8; } 100% { transform: scale(1.8); opacity: 0; } }
                        .reg-float { animation: reg-float 7s ease-in-out infinite; }
                        .reg-float-slow { animation: reg-float 11s ease-in-out infinite; }
                        .reg-rise { animation: reg-rise .6s ease-out both; }
                        .reg-pulse { transform-box: fill-box; transform-origin: center; animation: reg-pulse 2.2s ease-out infinite; }
                    }
                `}</style>
            </Head>
            <div
                className="relative flex min-h-screen flex-col bg-gradient-to-b from-m-mint via-m-page to-m-card text-m-body"
                style={{
                    fontFamily:
                        'Inter, Arial, ui-sans-serif, system-ui, sans-serif',
                }}
            >
                <Backdrop />
                <header className="relative z-10">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
                        <Link
                            href="/"
                            className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                            aria-label="Migo home"
                        >
                            <img
                                src="/favi.png"
                                alt=""
                                className="size-10 object-contain"
                            />
                            <span className="leading-tight">
                                <span className="block text-base font-bold tracking-wide text-m-accent">
                                    MIGO
                                </span>
                                <span className="block text-[10px] font-semibold text-m-muted italic">
                                    Your Ride. Your Buddy.
                                </span>
                            </span>
                        </Link>
                        <Link
                            href="/login"
                            className="rounded-full border border-m-accent bg-m-card px-4 py-1.5 text-sm font-semibold text-m-accent transition hover:bg-m-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                        >
                            Login
                        </Link>
                    </div>
                </header>

                <main className="relative z-10 flex flex-1 items-start justify-center px-4 pt-2 pb-8 sm:items-center sm:px-5">
                    <div
                        className={`reg-rise w-full ${centered ? 'max-w-4xl' : 'max-w-5xl'}`}
                    >
                        {centered ? (
                            <div className="rounded-3xl border border-m-card bg-m-card/80 p-6 text-center shadow-xl shadow-m-accent/10 backdrop-blur sm:p-10">
                                <h1 className="text-3xl font-extrabold text-m-ink sm:text-4xl">
                                    {title}
                                </h1>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-m-muted">
                                    {subtitle}
                                </p>
                                <div className="mt-8 text-left">{children}</div>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-3xl border border-m-card bg-m-card shadow-xl shadow-m-accent/10 lg:grid lg:grid-cols-[340px_1fr]">
                                {side && <SidePanel side={side} />}
                                <section className="p-6 sm:p-9">
                                    <h1 className="text-2xl font-extrabold text-m-ink sm:text-3xl">
                                        {title}
                                    </h1>
                                    <p className="mt-1.5 text-sm leading-relaxed text-m-muted">
                                        {subtitle}
                                    </p>
                                    <div className="mt-7">{children}</div>
                                </section>
                            </div>
                        )}
                        <p className="mt-5 text-center">
                            <Link
                                href={back.href}
                                className="inline-flex items-center gap-2 rounded text-sm font-medium text-m-accent transition hover:text-m-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                            >
                                <ArrowLeft className="size-4" aria-hidden />{' '}
                                {back.label}
                            </Link>
                        </p>
                    </div>
                </main>

                <footer className="relative z-10 px-5 pb-6 text-center text-xs text-m-muted">
                    <p>Proposed academic project.</p>
                </footer>
            </div>
        </>
    );
}

/** Numbered form section with an icon badge. */
export function Section({
    n,
    title,
    icon: Icon,
    children,
}: {
    n: number;
    title: string;
    icon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <fieldset className="space-y-5 rounded-2xl border border-m-soft bg-m-card p-5">
            <legend className="-ml-1 flex items-center gap-2.5 bg-m-card px-1.5 text-base font-bold text-m-ink">
                <span className="flex size-7 items-center justify-center rounded-full bg-m-forest text-xs font-bold text-white">
                    {n}
                </span>
                <Icon className="size-4 text-m-accent" aria-hidden />
                {title}
            </legend>
            {children}
        </fieldset>
    );
}

function Msg({
    id,
    error,
    hint,
}: {
    id: string;
    error?: string;
    hint?: string;
}) {
    if (error) {
        return (
            <p
                id={`${id}-err`}
                className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-m-redtext"
            >
                <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                {error}
            </p>
        );
    }
    return hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-m-muted">
            {hint}
        </p>
    ) : null;
}

type FieldProps = {
    id: string;
    label: string;
    icon: LucideIcon;
    error?: string;
    hint?: string;
    disabled?: boolean;
};

export function IconField({
    id,
    label,
    icon: Icon,
    error,
    hint,
    disabled,
    type = 'text',
    value,
    onChange,
    placeholder,
    autoComplete,
    autoFocus,
}: FieldProps & {
    type?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    autoComplete?: string;
    autoFocus?: boolean;
}) {
    return (
        <div>
            <label htmlFor={id} className={labelCls}>
                {label}
            </label>
            <div className="relative">
                <Icon
                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-m-accent"
                    aria-hidden
                />
                <input
                    id={id}
                    name={id}
                    type={type}
                    value={value}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        onChange(e.target.value)
                    }
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    aria-invalid={!!error}
                    aria-describedby={
                        error ? `${id}-err` : hint ? `${id}-hint` : undefined
                    }
                    className={`${inputBase} ${error ? inputBad : inputOk}`}
                />
            </div>
            <Msg id={id} error={error} hint={hint} />
        </div>
    );
}

/** Mobile number: digits only, hard-capped at 11, with a live counter. */
export function PhoneField({
    id,
    label,
    error,
    disabled,
    value,
    onChange,
}: Omit<FieldProps, 'icon' | 'hint'> & {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <label htmlFor={id} className={labelCls}>
                {label}
            </label>
            <div className="relative">
                <Phone
                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-m-accent"
                    aria-hidden
                />
                <input
                    id={id}
                    name={id}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={13}
                    value={value}
                    onChange={(e) => onChange(cleanPhone(e.target.value))}
                    onPaste={(e) => {
                        e.preventDefault();
                        onChange(cleanPhone(e.clipboardData.getData('text')));
                    }}
                    placeholder="09171234567"
                    disabled={disabled}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-err` : `${id}-hint`}
                    className={`${inputBase} tracking-wide tabular-nums ${error ? inputBad : inputOk}`}
                />
            </div>
            <Msg
                id={id}
                error={error}
                hint="Philippine mobile number: 11 digits, starting with 09."
            />
        </div>
    );
}

function strength(pw: string): { score: number; label: string; color: string } {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (pw.length < 8) s = Math.min(s, 1);
    const map = [
        { label: 'Too short', color: '#DC2626' },
        { label: 'Weak', color: '#DC2626' },
        { label: 'Fair', color: '#F59E0B' },
        { label: 'Good', color: '#1B5240' },
        { label: 'Strong', color: '#16A36A' },
    ];
    return { score: s, ...map[s] };
}

export function PasswordInput({
    id,
    label,
    icon: Icon,
    error,
    hint,
    disabled,
    value,
    onChange,
    placeholder,
    meter = false,
}: FieldProps & {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    meter?: boolean;
}) {
    const [show, setShow] = useState(false);
    const st = strength(value);
    return (
        <div>
            <label htmlFor={id} className={labelCls}>
                {label}
            </label>
            <div className="relative">
                <Icon
                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-m-accent"
                    aria-hidden
                />
                <input
                    id={id}
                    name={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete="new-password"
                    disabled={disabled}
                    aria-invalid={!!error}
                    aria-describedby={
                        error ? `${id}-err` : hint ? `${id}-hint` : undefined
                    }
                    className={`${inputBase} pr-11 ${error ? inputBad : inputOk}`}
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={
                        show
                            ? `Hide ${label.toLowerCase()}`
                            : `Show ${label.toLowerCase()}`
                    }
                    aria-pressed={show}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-m-muted transition hover:text-m-accent focus-visible:outline-2 focus-visible:outline-m-accent"
                >
                    {show ? (
                        <EyeOff className="size-5" />
                    ) : (
                        <Eye className="size-5" />
                    )}
                </button>
            </div>
            {meter && value.length > 0 && (
                <div className="mt-2" aria-live="polite">
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map((i) => (
                            <span
                                key={i}
                                className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                                style={{
                                    backgroundColor:
                                        i <= st.score ? st.color : 'var(--m-line)',
                                }}
                            />
                        ))}
                    </div>
                    <p
                        className="mt-1 text-xs font-medium"
                        style={{ color: st.color }}
                    >
                        {st.label}
                    </p>
                </div>
            )}
            <Msg id={id} error={error} hint={hint} />
        </div>
    );
}

/** Drop-zone style photo picker with a thumbnail preview. */
export function PhotoField({
    id,
    label,
    error,
    hint,
    disabled,
    file,
    onChange,
}: Omit<FieldProps, 'icon'> & {
    file: File | null;
    onChange: (f: File | null) => void;
}) {
    const url = useMemo(
        () => (file ? URL.createObjectURL(file) : null),
        [file],
    );
    useEffect(
        () => () => {
            if (url) URL.revokeObjectURL(url);
        },
        [url],
    );
    return (
        <div>
            <span className={labelCls}>
                {label}{' '}
                <span className="font-normal text-m-muted">(optional)</span>
            </span>
            <div
                className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition ${error ? 'border-m-red' : 'border-m-line2 bg-m-page2 hover:border-m-accent'}`}
            >
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-m-mint text-m-accent">
                    {url ? (
                        <img
                            src={url}
                            alt="Selected profile preview"
                            className="size-full object-cover"
                        />
                    ) : (
                        <ImagePlus className="size-6" aria-hidden />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <label
                        htmlFor={id}
                        className="inline-flex cursor-pointer rounded-lg bg-m-mint px-3 py-1.5 text-sm font-semibold text-m-accent transition hover:bg-m-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-m-accent"
                    >
                        {file ? 'Change photo' : 'Choose photo'}
                        <input
                            id={id}
                            name={id}
                            type="file"
                            accept="image/png,image/jpeg"
                            disabled={disabled}
                            className="sr-only"
                            onChange={(e) =>
                                onChange(e.target.files?.[0] ?? null)
                            }
                            aria-describedby={
                                error ? `${id}-err` : `${id}-hint`
                            }
                        />
                    </label>
                    <p className="mt-1.5 truncate text-xs text-m-muted">
                        {file ? file.name : 'No file chosen'}
                    </p>
                </div>
                {file && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        aria-label="Remove photo"
                        className="rounded-full p-1.5 text-m-muted hover:bg-m-mint hover:text-m-redtext"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>
            <Msg id={id} error={error} hint={hint} />
        </div>
    );
}

export function TermsCheck({
    checked,
    onChange,
    error,
    disabled,
    children,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    error?: string;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <div>
            <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition ${checked ? 'border-m-accent bg-m-mint' : 'border-m-line bg-m-page2 hover:border-m-accent/50'}`}
            >
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    aria-invalid={!!error}
                    className="mt-0.5 size-4 shrink-0 rounded accent-m-forest"
                />
                <span className="leading-relaxed">{children}</span>
            </label>
            {error && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-m-redtext">
                    <AlertCircle
                        className="mt-px size-3.5 shrink-0"
                        aria-hidden
                    />
                    {error}
                </p>
            )}
        </div>
    );
}

export const outlineBtn =
    'flex items-center justify-center gap-2 rounded-xl border-2 border-m-accent bg-m-card px-5 py-3.5 text-sm font-semibold text-m-accent transition hover:bg-m-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-70';

/** Step tracker for multi-step forms. */
export function Stepper({ step, labels }: { step: number; labels: string[] }) {
    return (
        <ol className="flex items-center gap-3" aria-label="Progress">
            {labels.map((l, i) => {
                const n = i + 1;
                const done = step > n;
                const current = step === n;
                return (
                    <li
                        key={l}
                        className="flex flex-1 items-center gap-3 last:flex-none"
                        aria-current={current ? 'step' : undefined}
                    >
                        <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${done || current ? 'bg-m-forest text-white' : 'bg-m-line text-m-muted'} ${current ? 'ring-4 ring-m-accent/20' : ''}`}
                        >
                            {done ? (
                                <Check
                                    className="size-4"
                                    strokeWidth={3}
                                    aria-hidden
                                />
                            ) : (
                                n
                            )}
                        </span>
                        <span
                            className={`text-sm font-semibold ${current ? 'text-m-ink' : 'text-m-muted'}`}
                        >
                            {l}
                        </span>
                        {i < labels.length - 1 && (
                            <span
                                aria-hidden
                                className="h-0.5 flex-1 overflow-hidden rounded-full bg-m-line"
                            >
                                <span
                                    className={`block h-full bg-m-forest transition-all duration-500 ${done ? 'w-full' : 'w-0'}`}
                                />
                            </span>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

type Group = {
    title: string;
    items: string[];
    note?: string;
    alt?: { label: string; items: string[] };
};

function requirementGroups(vehicle: 'two_wheel' | 'four_wheel' | ''): Group[] {
    const car = vehicle === 'four_wheel';
    return [
        {
            title: "Driver's License",
            items: car
                ? ["Professional Driver's License"]
                : ["Professional Driver's License", 'With Restriction A or 1'],
        },
        car
            ? {
                  title: 'Vehicle',
                  items: [],
                  note: 'Vehicle requirements for Migo Car are set by Migo. Please confirm the current list with the Migo office.',
              }
            : {
                  title: 'Motorcycle',
                  items: [
                      'Model year 2017 or newer',
                      'Engine of at least 100cc',
                      'No major modifications',
                      'No sidecar',
                  ],
              },
        {
            title: 'Government Clearance',
            items: ['NBI Clearance, valid and not expired (hard copy)'],
            alt: {
                label: 'No NBI Clearance yet?',
                items: [
                    'NBI receipt, plus',
                    'A valid Barangay or Police Clearance',
                ],
            },
        },
        {
            title: 'OR/CR',
            items: ['Valid and not expired'],
            alt: {
                label: 'No OR/CR in your name? Bring any one of:',
                items: [
                    "Authorization letter with valid ID and the owner's signature",
                    'Repo sale from a dealer (CASA)',
                    'Delivery receipt',
                    'Sales invoice',
                ],
            },
        },
        { title: 'Medical Certificate', items: ['Required for ages 51 to 65'] },
    ];
}

/** Checklist of what an applicant needs. `dark` is for the blue side panel, `light` for the mobile accordion. */
export function Requirements({
    vehicle,
    tone = 'dark',
}: {
    vehicle: 'two_wheel' | 'four_wheel' | '';
    tone?: 'dark' | 'light';
}) {
    const dark = tone === 'dark';
    const groups = requirementGroups(vehicle);
    return (
        <div>
            <h3
                className={`flex items-center gap-2 text-sm font-bold ${dark ? 'text-white' : 'text-m-ink'}`}
            >
                <ListChecks className="size-4" aria-hidden /> What you will need
            </h3>
            <div className="mt-3 space-y-4">
                {groups.map((g) => (
                    <div key={g.title}>
                        <p
                            className={`text-[11px] font-bold tracking-wide uppercase ${dark ? 'text-white/70' : 'text-m-accent'}`}
                        >
                            {g.title}
                        </p>
                        {g.items.length > 0 && (
                            <ul className="mt-1.5 space-y-1.5">
                                {g.items.map((it) => (
                                    <li
                                        key={it}
                                        className={`flex items-start gap-2 text-[13px] leading-snug ${dark ? 'text-white/95' : 'text-m-body'}`}
                                    >
                                        <span
                                            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${dark ? 'bg-m-card text-m-accent' : 'bg-m-forest text-white'}`}
                                        >
                                            <Check
                                                className="size-2.5"
                                                strokeWidth={3.5}
                                                aria-hidden
                                            />
                                        </span>
                                        {it}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {g.note && (
                            <p
                                className={`mt-1.5 text-[13px] leading-snug ${dark ? 'text-white/85' : 'text-m-muted'}`}
                            >
                                {g.note}
                            </p>
                        )}
                        {g.alt && (
                            <div
                                className={`mt-2 rounded-lg px-3 py-2 text-xs leading-snug ${dark ? 'bg-white/10 text-white/90' : 'bg-m-page text-m-muted'}`}
                            >
                                <p className="font-semibold">{g.alt.label}</p>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                                    {g.alt.items.map((a) => (
                                        <li key={a}>{a}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <p
                className={`mt-4 text-[11px] leading-snug ${dark ? 'text-white/65' : 'text-m-muted'}`}
            >
                Requirements are set by Migo and may change. Please confirm the
                current list with the Migo office.
            </p>
        </div>
    );
}
