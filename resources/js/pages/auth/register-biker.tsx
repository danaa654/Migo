import { Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    Bike,
    CalendarClock,
    Car,
    Check,
    Hash,
    Home,
    IdCard,
    ListChecks,
    Loader2,
    Lock,
    LockKeyhole,
    Mail,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Notice } from '@/components/migo-auth-shell';
import { FileField } from '@/components/migo-form-fields';
import {
    IconField,
    PHONE_ERROR,
    PHONE_RE,
    PasswordInput,
    PhoneField,
    PhotoField,
    RegisterShell,
    Requirements,
    Section,
    Stepper,
    TermsCheck,
    gradientBtn,
    outlineBtn,
} from '@/components/migo-register-ui';

type VehicleType = 'two_wheel' | 'four_wheel';

const vehicleOptions: {
    value: VehicleType;
    title: string;
    wheels: string;
    text: string;
    Icon: typeof Bike;
}[] = [
    {
        value: 'two_wheel',
        title: 'Biker',
        wheels: '2 wheels',
        text: 'Motorcycle rider',
        Icon: Bike,
    },
    {
        value: 'four_wheel',
        title: 'Migo Car',
        wheels: '4 wheels',
        text: 'Car driver',
        Icon: Car,
    },
];

type BikerForm = {
    vehicle_type: VehicleType | '';
    full_name: string;
    email: string;
    phone: string;
    address: string;
    license_number: string;
    license_expiry: string;
    motorcycle_plate_number: string;
    profile_picture: File | null;
    license_document: File | null;
    registration_document: File | null;
    official_receipt: File | null;
    nbi_clearance: File | null;
    password: string;
    password_confirmation: string;
    terms: boolean;
    document_consent: boolean;
};

type Errs = Partial<Record<keyof BikerForm, string>>;

const STEP_ONE: (keyof BikerForm)[] = [
    'vehicle_type',
    'full_name',
    'phone',
    'email',
    'address',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_CHARS = /^[\p{L}][\p{L}\p{M}.'’\- ]*$/u;

/** A full name needs at least a first and a last name (each 2+ letters), made of letters only. */
function fullNameError(raw: string): string | null {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) return 'Full name is required.';
    if (!NAME_CHARS.test(name))
        return 'Full name may only contain letters, spaces, periods, apostrophes and hyphens.';
    const words = name
        .split(' ')
        .filter((w) => w.replace(/[.'’-]/g, '').length >= 2);
    return words.length < 2
        ? 'Enter your full name: first name and last name.'
        : null;
}

function validateStepOne(d: BikerForm): Errs {
    const e: Errs = {};
    if (!d.vehicle_type)
        e.vehicle_type =
            'Please choose 2 wheels (Biker) or 4 wheels (Migo Car).';
    const nameError = fullNameError(d.full_name);
    if (nameError) e.full_name = nameError;
    if (!d.phone) e.phone = 'Contact number is required.';
    else if (!PHONE_RE.test(d.phone)) e.phone = PHONE_ERROR;
    if (!d.email.trim()) e.email = 'Email address is required.';
    else if (!EMAIL_RE.test(d.email.trim()))
        e.email = 'Enter a valid email address.';
    if (!d.address.trim()) e.address = 'Home address is required.';
    return e;
}

function validateStepTwo(d: BikerForm): Errs {
    const e: Errs = {};
    if (!d.license_number.trim())
        e.license_number = "Driver's license number is required.";
    if (!d.license_expiry)
        e.license_expiry = 'License expiry date is required.';
    if (!d.motorcycle_plate_number.trim())
        e.motorcycle_plate_number = 'Plate number is required.';
    if (!d.license_document)
        e.license_document = "Upload your driver's license (photo or scan).";
    if (!d.registration_document)
        e.registration_document =
            'Upload your registration (OR/CR) or the allowed alternative document.';
    if (!d.official_receipt)
        e.official_receipt = 'Upload your official receipt.';
    if (!d.nbi_clearance)
        e.nbi_clearance =
            'Upload your NBI Clearance (or NBI receipt with a Barangay or Police Clearance in one PDF).';
    for (const k of [
        'license_document',
        'registration_document',
        'official_receipt',
        'nbi_clearance',
    ] as const) {
        const f = d[k];
        if (f && f.size > 5 * 1024 * 1024)
            e[k] = 'The file must not be larger than 5 MB.';
        else if (f && !/\.(jpe?g|png|pdf)$/i.test(f.name))
            e[k] = 'The file must be a JPG, PNG or PDF.';
    }
    if (!d.password) e.password = 'Password is required.';
    else if (d.password.length < 8)
        e.password = 'Password must be at least 8 characters.';
    if (d.password !== d.password_confirmation)
        e.password_confirmation = 'Password and confirm password do not match.';
    if (!d.terms)
        e.terms = 'You must agree to the Terms and Conditions to register.';
    if (!d.document_consent)
        e.document_consent =
            'You must consent to Migo collecting and storing your documents to apply.';
    return e;
}

/** GET /register/biker. Two steps: (1) type + personal info, (2) vehicle details + account. Posts to /register/biker. */
export default function RegisterBiker() {
    const form = useForm<BikerForm>({
        vehicle_type: '',
        full_name: '',
        email: '',
        phone: '',
        address: '',
        license_number: '',
        license_expiry: '',
        motorcycle_plate_number: '',
        profile_picture: null,
        license_document: null,
        registration_document: null,
        official_receipt: null,
        nbi_clearance: null,
        password: '',
        password_confirmation: '',
        terms: false,
        document_consent: false,
    });
    const [step, setStep] = useState<1 | 2>(1);
    const [clientErrors, setClientErrors] = useState<Errs>({});
    const top = useRef<HTMLDivElement>(null);
    const serverErrors = form.errors as Errs;
    const err = (k: keyof BikerForm) => clientErrors[k] ?? serverErrors[k];
    const set =
        <K extends keyof BikerForm>(key: K) =>
        (value: BikerForm[K]) => {
            form.setData((d) => ({ ...d, [key]: value }));
            setClientErrors((c) => ({
                ...c,
                [key]: undefined,
                ...(key === 'password'
                    ? { password_confirmation: undefined }
                    : {}),
            }));
            if (serverErrors[key]) form.clearErrors(key);
        };
    const car = form.data.vehicle_type === 'four_wheel';
    const off = form.processing;

    function goTo(next: 1 | 2) {
        setStep(next);
        requestAnimationFrame(() =>
            top.current?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                    .matches
                    ? 'auto'
                    : 'smooth',
                block: 'start',
            }),
        );
    }

    function next() {
        const e = validateStepOne(form.data);
        setClientErrors(e);
        if (Object.keys(e).length === 0) goTo(2);
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        if (off) return;
        if (step === 1) return next();
        const bad = {
            ...validateStepOne(form.data),
            ...validateStepTwo(form.data),
        };
        setClientErrors(bad);
        if (Object.keys(bad).length > 0) {
            if (STEP_ONE.some((k) => bad[k])) goTo(1);
            return;
        }
        form.post('/register/biker', {
            forceFormData: true,
            onError: (errors) => {
                form.reset('password', 'password_confirmation');
                if (STEP_ONE.some((k) => errors[k])) goTo(1);
            },
        });
    }

    return (
        <RegisterShell
            title={car ? 'Drive with Migo Car' : 'Ride with Migo'}
            subtitle="Tell us about yourself and your vehicle. It only takes a few minutes."
            back={{ href: '/login?tab=rider', label: 'Back to Login' }}
            side={{
                badge: car ? 'Migo Car driver' : 'Biker',
                heading: car
                    ? 'Your car, your schedule.'
                    : 'Your bike, your schedule.',
                text: 'An administrator reviews every application. You can accept bookings only after you also complete document verification, orientation, motorcycle inspection and final accreditation.',
                extra: <Requirements vehicle={form.data.vehicle_type} />,
                icon: car ? Car : Bike,
            }}
        >
            <div ref={top} className="scroll-mt-4" />
            <form onSubmit={submit} noValidate className="space-y-6">
                <Stepper
                    step={step}
                    labels={['Your details', 'Vehicle & account']}
                />

                {step === 1 && (
                    <div className="space-y-6">
                        <Notice kind="info">
                            You can sign in right away, but you can accept
                            service requests only after final accreditation.
                        </Notice>

                        <details className="group rounded-xl border border-m-line2 bg-m-page2 p-4 lg:hidden">
                            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-m-ink">
                                <ListChecks
                                    className="size-4 text-m-accent"
                                    aria-hidden
                                />{' '}
                                See the requirements
                                <ArrowRight
                                    className="ml-auto size-4 text-m-accent transition group-open:rotate-90"
                                    aria-hidden
                                />
                            </summary>
                            <div className="mt-4">
                                <Requirements
                                    vehicle={form.data.vehicle_type}
                                    tone="light"
                                />
                            </div>
                        </details>

                        <Section n={1} title="Apply as" icon={BadgeCheck}>
                            <div
                                className="grid gap-3 sm:grid-cols-2"
                                role="radiogroup"
                                aria-label="Vehicle type"
                                aria-describedby={
                                    err('vehicle_type')
                                        ? 'vehicle_type-err'
                                        : undefined
                                }
                            >
                                {vehicleOptions.map(
                                    ({ value, title, wheels, text, Icon }) => {
                                        const selected =
                                            form.data.vehicle_type === value;
                                        return (
                                            <label
                                                key={value}
                                                className={`relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-m-accent ${selected ? 'scale-[1.02] border-m-accent bg-m-mint shadow-lg shadow-m-accent/15' : 'border-m-line bg-m-card hover:-translate-y-0.5 hover:border-m-accent/50'} ${off ? 'opacity-60' : ''}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="vehicle_type"
                                                    value={value}
                                                    checked={selected}
                                                    disabled={off}
                                                    onChange={() =>
                                                        set('vehicle_type')(
                                                            value,
                                                        )
                                                    }
                                                    className="sr-only"
                                                />
                                                <span
                                                    className={`flex size-14 shrink-0 items-center justify-center rounded-xl transition ${selected ? 'bg-m-forest text-white' : 'bg-m-mint text-m-accent'}`}
                                                >
                                                    <Icon
                                                        className="size-7"
                                                        aria-hidden
                                                    />
                                                </span>
                                                <span className="leading-tight">
                                                    <span className="block text-base font-bold text-m-ink">
                                                        {title}
                                                    </span>
                                                    <span className="block text-sm font-medium text-m-accent">
                                                        {wheels}
                                                    </span>
                                                    <span className="block text-xs text-m-muted">
                                                        {text}
                                                    </span>
                                                </span>
                                                {selected && (
                                                    <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-m-forest text-white">
                                                        <Check
                                                            className="size-3"
                                                            strokeWidth={3}
                                                            aria-hidden
                                                        />
                                                    </span>
                                                )}
                                            </label>
                                        );
                                    },
                                )}
                            </div>
                            {err('vehicle_type') && (
                                <p
                                    id="vehicle_type-err"
                                    className="text-xs font-medium text-m-redtext"
                                >
                                    {err('vehicle_type')}
                                </p>
                            )}
                        </Section>

                        <Section
                            n={2}
                            title="Personal information"
                            icon={UserRound}
                        >
                            <div className="grid gap-5 sm:grid-cols-2">
                                <IconField
                                    id="full_name"
                                    label="Full Name"
                                    icon={UserRound}
                                    value={form.data.full_name}
                                    onChange={set('full_name')}
                                    error={err('full_name')}
                                    autoComplete="name"
                                    placeholder="First name and last name"
                                    hint="Use your full legal name, e.g. Juan Dela Cruz."
                                    disabled={off}
                                />
                                <PhoneField
                                    id="phone"
                                    label="Contact Number"
                                    value={form.data.phone}
                                    onChange={set('phone')}
                                    error={err('phone')}
                                    disabled={off}
                                />
                            </div>
                            <IconField
                                id="email"
                                label="Email Address"
                                icon={Mail}
                                type="email"
                                value={form.data.email}
                                onChange={set('email')}
                                error={err('email')}
                                autoComplete="email"
                                placeholder="you@example.com"
                                disabled={off}
                            />
                            <IconField
                                id="address"
                                label="Home Address"
                                icon={Home}
                                value={form.data.address}
                                onChange={set('address')}
                                error={err('address')}
                                autoComplete="street-address"
                                placeholder="House no., street, barangay, city"
                                disabled={off}
                            />
                        </Section>

                        <button
                            type="button"
                            onClick={next}
                            className={gradientBtn}
                        >
                            Next: Vehicle &amp; account{' '}
                            <ArrowRight
                                className="size-4 transition group-hover:translate-x-1"
                                aria-hidden
                            />
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <Section
                            n={3}
                            title={car ? 'Migo Car details' : 'Biker details'}
                            icon={IdCard}
                        >
                            <div className="grid gap-5 sm:grid-cols-2">
                                <IconField
                                    id="license_number"
                                    label="Driver's License Number"
                                    icon={IdCard}
                                    value={form.data.license_number}
                                    onChange={set('license_number')}
                                    error={err('license_number')}
                                    placeholder="N01-23-456789"
                                    disabled={off}
                                />
                                <IconField
                                    id="license_expiry"
                                    label="License Expiry Date"
                                    icon={CalendarClock}
                                    type="date"
                                    value={form.data.license_expiry}
                                    onChange={set('license_expiry')}
                                    error={err('license_expiry')}
                                    disabled={off}
                                />
                            </div>
                            <IconField
                                id="motorcycle_plate_number"
                                label={
                                    car
                                        ? 'Vehicle Plate Number'
                                        : 'Motorcycle Plate Number'
                                }
                                icon={Hash}
                                value={form.data.motorcycle_plate_number}
                                onChange={set('motorcycle_plate_number')}
                                error={err('motorcycle_plate_number')}
                                placeholder={car ? 'ABC 123' : 'ABC 1234'}
                                disabled={off}
                            />
                            <PhotoField
                                id="profile_picture"
                                label="Profile Photo"
                                file={form.data.profile_picture}
                                onChange={set('profile_picture')}
                                error={err('profile_picture')}
                                hint="JPG or PNG, up to 2 MB."
                                disabled={off}
                            />
                            <div className="grid gap-5 sm:grid-cols-2">
                                <FileField
                                    id="license_document"
                                    required
                                    label="Driver's License (photo or scan)"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={set('license_document')}
                                    error={err('license_document')}
                                    hint="Clear, uncropped photo or scan of the original. JPG, PNG or PDF, up to 5 MB."
                                    disabled={off}
                                />
                                <FileField
                                    id="registration_document"
                                    required
                                    label={
                                        car
                                            ? 'Vehicle Registration (OR/CR)'
                                            : 'Motorcycle Registration (OR/CR)'
                                    }
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={set('registration_document')}
                                    error={err('registration_document')}
                                    hint="No OR/CR in your name? Upload the authorization letter, dealer repo sale, delivery receipt or sales invoice (combine pages into one PDF). JPG, PNG or PDF, up to 5 MB."
                                    disabled={off}
                                />
                            </div>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <FileField
                                    id="official_receipt"
                                    required
                                    label="Official Receipt"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={set('official_receipt')}
                                    error={err('official_receipt')}
                                    hint="JPG, PNG or PDF, up to 5 MB."
                                    disabled={off}
                                />
                                <FileField
                                    id="nbi_clearance"
                                    required
                                    label="NBI Clearance"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={set('nbi_clearance')}
                                    error={err('nbi_clearance')}
                                    hint="No NBI yet? Combine your NBI receipt and a Barangay or Police Clearance into one PDF. Up to 5 MB."
                                    disabled={off}
                                />
                            </div>
                            <Notice kind="info">
                                Uploads are only a first screening. Migo staff
                                will still check your ORIGINAL documents in
                                person at the office before you can be
                                accredited. Edited, altered or borrowed
                                documents will fail verification.
                            </Notice>
                        </Section>

                        <Section
                            n={4}
                            title="Account security"
                            icon={LockKeyhole}
                        >
                            <div className="grid gap-5 sm:grid-cols-2">
                                <PasswordInput
                                    id="password"
                                    label="Password"
                                    icon={Lock}
                                    meter
                                    value={form.data.password}
                                    onChange={set('password')}
                                    error={err('password')}
                                    hint="At least 8 characters."
                                    placeholder="Create a password"
                                    disabled={off}
                                />
                                <PasswordInput
                                    id="password_confirmation"
                                    label="Confirm Password"
                                    icon={ShieldCheck}
                                    value={form.data.password_confirmation}
                                    onChange={set('password_confirmation')}
                                    error={err('password_confirmation')}
                                    placeholder="Re-enter your password"
                                    disabled={off}
                                />
                            </div>
                        </Section>

                        <TermsCheck
                            checked={form.data.terms}
                            onChange={set('terms')}
                            error={err('terms')}
                            disabled={off}
                        >
                            I agree to the{' '}
                            <a
                                href="/terms"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-m-accent hover:text-m-accent-hover"
                            >
                                Terms and Conditions
                            </a>{' '}
                            and{' '}
                            <a
                                href="/privacy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-m-accent hover:text-m-accent-hover"
                            >
                                Privacy Policy
                            </a>
                            , and I confirm that the information above is true.
                        </TermsCheck>

                        <TermsCheck
                            checked={form.data.document_consent}
                            onChange={set('document_consent')}
                            error={err('document_consent')}
                            disabled={off}
                        >
                            I consent to Migo collecting and securely storing my
                            uploaded documents (driver&apos;s license, OR/CR,
                            official receipt and NBI clearance) only to verify
                            my rider accreditation, in line with the Data
                            Privacy Act of 2012 (RA 10173).
                        </TermsCheck>

                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => goTo(1)}
                                disabled={off}
                                className={`${outlineBtn} sm:w-auto`}
                            >
                                <ArrowLeft className="size-4" aria-hidden />{' '}
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={off}
                                className={`${gradientBtn} sm:flex-1`}
                            >
                                {off ? (
                                    <>
                                        <Loader2
                                            className="size-4 animate-spin"
                                            aria-hidden
                                        />{' '}
                                        Submitting…
                                    </>
                                ) : (
                                    <>
                                        Submit Application{' '}
                                        <ArrowRight
                                            className="size-4 transition group-hover:translate-x-1"
                                            aria-hidden
                                        />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                <p className="text-center text-sm text-m-muted">
                    Already have an account?{' '}
                    <Link
                        href="/login"
                        className="font-semibold text-m-accent transition hover:text-m-accent-hover"
                    >
                        Login here.
                    </Link>
                </p>
            </form>
        </RegisterShell>
    );
}
