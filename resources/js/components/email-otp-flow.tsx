import { ArrowLeft, Loader2, Mail, RotateCcw } from 'lucide-react';
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
    sendUrl: string;
    verifyUrl: string;
    /** Called after the server accepted the code. Navigate to data.redirect. */
    onVerified: (data: { redirect?: string }) => void;
};

/**
 * Step 1: email -> "Send code". Step 2: six digit boxes (auto-advance, paste, numeric keypad, autofocus),
 * resend with a 60-second countdown, change email. The server owns every rule (limits, expiry, attempts).
 */
export default function EmailOtpFlow({ sendUrl, verifyUrl, onVerified }: Props) {
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [email, setEmail] = useState('');
    const [sentTo, setSentTo] = useState('');
    const [digits, setDigits] = useState<string[]>(BLANK);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState('');
    const [resendIn, setResendIn] = useState(0);
    const boxes = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setTimeout(() => setResendIn((s) => s - 1), 1000);

        return () => clearTimeout(t);
    }, [resendIn]);

    useEffect(() => {
        if (step === 'code') boxes.current[0]?.focus();
    }, [step]);

    async function requestCode(address: string, resend = false) {
        setError(null);
        setSending(true);
        const res = await postJson<{ resend_in?: number }>(sendUrl, {
            email: address,
        });
        setSending(false);

        if (!res.ok) {
            setError(res.message);
            if (res.status === 429 && res.data.retry_after && step === 'code')
                setResendIn(res.data.retry_after);

            return;
        }

        setSentTo(address);
        setDigits(BLANK);
        setResendIn(res.data.resend_in ?? 60);
        setInfo(
            resend
                ? 'Nagpadala kami ng bagong code.'
                : 'Naipadala na ang code.',
        );
        setStep('code');
    }

    function submitEmail(e: FormEvent) {
        e.preventDefault();
        if (sending) return;
        const address = email.trim().toLowerCase();
        if (!EMAIL_RE.test(address)) {
            setError('Hindi valid ang email address.');

            return;
        }
        void requestCode(address);
    }

    async function submitCode(code: string) {
        if (verifying || code.length !== LEN) return;
        setVerifying(true);
        setError(null);
        const res = await postJson<{ redirect?: string }>(verifyUrl, {
            email: sentTo,
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
        const start = all.length >= LEN ? 0 : from;
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
        if (raw.length > 1) return fill(raw, i);
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

    function changeEmail() {
        setStep('email');
        setDigits(BLANK);
        setError(null);
        setInfo('');
        setResendIn(0);
    }

    const live = (
        <p className="sr-only" role="status" aria-live="polite">
            {info}
        </p>
    );

    if (step === 'email') {
        return (
            <form
                onSubmit={submitEmail}
                noValidate
                className="w-full max-w-full min-w-0 space-y-3"
            >
                {live}
                <div>
                    <label htmlFor="customer-email" className="sr-only">
                        Email address
                    </label>
                    <div
                        className={`${pill} ${error ? 'border-m-red' : 'border-m-line'}`}
                    >
                        <span className={iconCircle}>
                            <Mail className="size-5" aria-hidden />
                        </span>
                        <input
                            id="customer-email"
                            name="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="juan@gmail.com"
                            disabled={sending}
                            aria-invalid={!!error}
                            aria-describedby={error ? 'email-err' : undefined}
                            className="h-9 w-full bg-transparent text-sm text-m-body outline-none placeholder:text-m-muted disabled:opacity-60"
                        />
                    </div>
                    {error && (
                        <p
                            id="email-err"
                            role="alert"
                            className="mt-1.5 px-4 text-xs font-medium text-m-redtext [overflow-wrap:anywhere]"
                        >
                            {error}
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
                        'Send code to email'
                    )}
                </button>
            </form>
        );
    }

    return (
        <div className="w-full max-w-full min-w-0 space-y-4">
            {live}
            <p className="text-center text-sm leading-relaxed text-m-body2 [overflow-wrap:anywhere]">
                Nagpadala kami ng 6-digit code sa{' '}
                <span className="font-semibold text-m-ink [overflow-wrap:anywhere]">
                    {sentTo}
                </span>
                . Kung wala sa inbox, tingnan ang Spam.
            </p>

            <div
                role="group"
                aria-label="6-digit code"
                className="flex max-w-full justify-center gap-1.5 sm:gap-2"
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
                        className={`h-12 w-9 min-w-0 rounded-2xl border bg-m-card text-center text-xl font-bold text-m-ink shadow-sm transition outline-none focus:border-m-accent focus:ring-2 focus:ring-m-accent/25 disabled:opacity-60 sm:h-14 sm:w-12 ${error ? 'border-m-red' : 'border-m-line'}`}
                    />
                ))}
            </div>

            {error && (
                <Notice kind="error">
                    <span className="block min-w-0 [overflow-wrap:anywhere]">
                        {error}
                    </span>
                </Notice>
            )}

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
                    onClick={changeEmail}
                    disabled={verifying}
                    className={`${linkBtn} text-m-accent hover:bg-m-mint`}
                >
                    <ArrowLeft className="size-4" aria-hidden /> Change email
                </button>
                <button
                    type="button"
                    onClick={() => void requestCode(sentTo, true)}
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