import { ArrowLeft, Loader2, Phone, RotateCcw } from 'lucide-react';
import {
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type FormEvent,
    type KeyboardEvent,
} from 'react';
import { Notice } from '@/components/migo-auth-shell';
import { postJson } from '@/lib/post-json';

const LEN = 6;
const BLANK = Array<string>(LEN).fill('');

const pill =
    'flex items-center gap-3 rounded-full border bg-m-card py-1.5 pl-1.5 pr-4 shadow-sm transition focus-within:border-m-accent focus-within:ring-2 focus-within:ring-m-accent/20';
const iconCircle =
    'flex size-10 shrink-0 items-center justify-center rounded-full bg-m-mint text-m-accent';
const primaryBtn =
    'flex w-full items-center justify-center gap-2 rounded-full bg-m-forest px-5 py-3 text-base font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-m-forest-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0';
const linkBtn =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-60';

/** Same rule as the server: 09171234567, 9171234567 and +639171234567 are accepted; anything else is not. */
export function normalizePhPhone(raw: string): string | null {
    const v = raw.replace(/[\s\-().]/g, '');
    const m =
        /^\+639(\d{9})$/.exec(v) ??
        /^09(\d{9})$/.exec(v) ??
        /^9(\d{9})$/.exec(v);

    return m ? `+639${m[1]}` : null;
}

export function formatPhPhone(e164: string): string {
    return `+63 ${e164.slice(3, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}`;
}

type Props = {
    sendUrl: string;
    verifyUrl: string;
    /** Pre-fills the number field (for example a number typed at the old registration). */
    initialPhone?: string;
    /** Called after the server accepted the code. Login: navigate to data.redirect. Profile: reload. */
    onVerified: (data: { redirect?: string }) => void;
};

/**
 * Step 1: mobile number -> "Send OTP". Step 2: six digit boxes (auto-advance, paste, numeric keypad, autofocus),
 * resend with a 60-second countdown, change number. The server owns every rule (limits, expiry, attempts).
 */
export default function PhoneOtpFlow({
    sendUrl,
    verifyUrl,
    initialPhone = '',
    onVerified,
}: Props) {
    const [step, setStep] = useState<'phone' | 'code'>('phone');
    const [phone, setPhone] = useState(initialPhone);
    const [e164, setE164] = useState('');
    const [digits, setDigits] = useState<string[]>(BLANK);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState('');
    const [resendIn, setResendIn] = useState(0);
    const boxes = useRef<(HTMLInputElement | null)[]>([]);

    // 60-second resend countdown.
    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setTimeout(() => setResendIn((s) => s - 1), 1000);

        return () => clearTimeout(t);
    }, [resendIn]);

    // Autofocus the first box whenever the code step opens.
    useEffect(() => {
        if (step === 'code') boxes.current[0]?.focus();
    }, [step]);

    async function requestCode(number: string, resend = false) {
        setError(null);
        setSending(true);
        const res = await postJson<{ resend_in?: number }>(sendUrl, {
            phone: number,
        });
        setSending(false);

        if (!res.ok) {
            setError(res.message);
            if (res.status === 429 && res.data.retry_after && step === 'code')
                setResendIn(res.data.retry_after);

            return;
        }

        setE164(number);
        setDigits(BLANK);
        setResendIn(res.data.resend_in ?? 60);
        setInfo(
            resend
                ? 'Nagpadala kami ng bagong code.'
                : 'Naipadala na ang code.',
        );
        setStep('code');
    }

    function submitPhone(e: FormEvent) {
        e.preventDefault();
        if (sending) return;
        const number = normalizePhPhone(phone);
        if (!number) {
            setError(
                'Hindi valid ang number. Gamitin ang 09171234567, 9171234567 o +639171234567.',
            );

            return;
        }
        void requestCode(number);
    }

    async function submitCode(code: string) {
        if (verifying || code.length !== LEN) return;
        setVerifying(true);
        setError(null);
        const res = await postJson<{ redirect?: string }>(verifyUrl, {
            phone: e164,
            code,
        });

        if (!res.ok) {
            setVerifying(false);
            setError(res.message);
            setDigits(BLANK);
            setTimeout(() => boxes.current[0]?.focus(), 0);

            return;
        }

        onVerified(res.data); // keep the spinner on while the page changes
    }

    function fill(text: string, from: number) {
        const all = text.replace(/\D/g, '');
        const start = all.length >= LEN ? 0 : from; // a whole code always fills every box
        const chars = all.slice(0, LEN - start).split('');
        if (!chars.length) return;
        const next = [...digits];
        chars.forEach((c, k) => (next[start + k] = c));
        setDigits(next);
        boxes.current[Math.min(start + chars.length, LEN - 1)]?.focus();
        if (next.every(Boolean)) void submitCode(next.join(''));
    }

    function onChange(i: number, value: string) {
        const raw = value.replace(/\D/g, '');
        if (raw.length > 1) return fill(raw, i); // paste or SMS autofill into one box
        const next = [...digits];
        next[i] = raw;
        setDigits(next);
        if (raw && i < LEN - 1) boxes.current[i + 1]?.focus();
        if (next.every(Boolean)) void submitCode(next.join(''));
    }

    function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !digits[i] && i > 0) {
            e.preventDefault();
            const next = [...digits];
            next[i - 1] = '';
            setDigits(next);
            boxes.current[i - 1]?.focus();
        } else if (e.key === 'ArrowLeft' && i > 0) {
            boxes.current[i - 1]?.focus();
        } else if (e.key === 'ArrowRight' && i < LEN - 1) {
            boxes.current[i + 1]?.focus();
        }
    }

    function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
        e.preventDefault();
        fill(e.clipboardData.getData('text'), i);
    }

    function changeNumber() {
        setStep('phone');
        setDigits(BLANK);
        setError(null);
        setInfo('');
        setResendIn(0);
    }

    // Screen readers hear status changes (code sent, errors) but not every countdown tick.
    const live = (
        <p className="sr-only" role="status" aria-live="polite">
            {info}
        </p>
    );

    if (step === 'phone') {
        return (
            <form onSubmit={submitPhone} noValidate className="space-y-3">
                {live}
                <div>
                    <label htmlFor="phone" className="sr-only">
                        Mobile number
                    </label>
                    <div
                        className={`${pill} ${error ? 'border-m-red' : 'border-m-line'}`}
                    >
                        <span className={iconCircle}>
                            <Phone className="size-5" aria-hidden />
                        </span>
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="09XX XXX XXXX"
                            disabled={sending}
                            aria-invalid={!!error}
                            aria-describedby={
                                error ? 'phone-err' : 'phone-hint'
                            }
                            className="h-9 w-full bg-transparent text-sm text-m-body outline-none placeholder:text-m-muted disabled:opacity-60"
                        />
                    </div>
                    {error ? (
                        <p
                            id="phone-err"
                            role="alert"
                            className="mt-1.5 px-4 text-xs font-medium text-m-redtext"
                        >
                            {error}
                        </p>
                    ) : (
                        <p
                            id="phone-hint"
                            className="mt-1.5 px-4 text-xs text-m-muted"
                        >
                            Halimbawa: 09171234567 o +639171234567
                        </p>
                    )}
                </div>
                <button type="submit" disabled={sending} className={primaryBtn}>
                    {sending ? (
                        <>
                            <Loader2
                                className="size-4 animate-spin"
                                aria-hidden
                            />{' '}
                            Nagpapadala…
                        </>
                    ) : (
                        'Send OTP'
                    )}
                </button>
            </form>
        );
    }

    return (
        <div className="space-y-4">
            {live}
            <p className="text-center text-sm leading-relaxed text-m-body2">
                Nagpadala kami ng 6-digit code sa{' '}
                <span className="font-semibold whitespace-nowrap text-m-ink">
                    {formatPhPhone(e164)}
                </span>
                .
            </p>

            <div
                role="group"
                aria-label="6-digit code"
                className="flex justify-center gap-2"
            >
                {digits.map((d, i) => (
                    <input
                        key={i}
                        ref={(el) => {
                            boxes.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        aria-label={`Digit ${i + 1} of ${LEN}`}
                        value={d}
                        disabled={verifying}
                        onChange={(e) => onChange(i, e.target.value)}
                        onKeyDown={(e) => onKeyDown(i, e)}
                        onPaste={(e) => onPaste(i, e)}
                        onFocus={(e) => e.target.select()}
                        className={`h-12 w-10 rounded-2xl border bg-m-card text-center text-xl font-bold text-m-ink shadow-sm transition outline-none focus:border-m-accent focus:ring-2 focus:ring-m-accent/25 disabled:opacity-60 sm:h-14 sm:w-12 ${error ? 'border-m-red' : 'border-m-line'}`}
                    />
                ))}
            </div>

            {error && <Notice kind="error">{error}</Notice>}

            <button
                type="button"
                onClick={() => void submitCode(digits.join(''))}
                disabled={verifying || digits.some((d) => !d)}
                className={primaryBtn}
            >
                {verifying ? (
                    <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />{' '}
                        Vine-verify…
                    </>
                ) : (
                    'Verify and Login'
                )}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={changeNumber}
                    disabled={verifying}
                    className={`${linkBtn} text-m-accent hover:bg-m-mint`}
                >
                    <ArrowLeft className="size-4" aria-hidden /> Change number
                </button>
                <button
                    type="button"
                    onClick={() => void requestCode(e164, true)}
                    disabled={resendIn > 0 || sending || verifying}
                    className={`${linkBtn} text-m-amber hover:bg-[#F28C28]/10`}
                >
                    {sending ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                        <RotateCcw className="size-4" aria-hidden />
                    )}
                    {resendIn > 0
                        ? `Resend code (0:${String(resendIn).padStart(2, '0')})`
                        : 'Resend code'}
                </button>
            </div>
        </div>
    );
}
