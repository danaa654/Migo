import { BadgeCheck, Loader2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { postJson } from '@/lib/post-json';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const outlineSmall =
    'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-m-accent bg-m-card px-4 py-2.5 text-sm font-semibold text-m-accent transition hover:bg-m-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-60';

type Props = {
    /** Whatever is currently typed in the email field. */
    email: string;
    /** True only while the typed email is the one that was proven. */
    verified: boolean;
    disabled?: boolean;
    onVerified: (email: string) => void;
};

/**
 * Sits under the email field of the rider form. "Send verification code" emails a 6-digit code; entering it proves the
 * applicant can open that address. Editing the email afterwards cancels the proof (the parent compares the two).
 * The server owns every rule (limits, expiry, attempts) and only accepts a submit for a proven email.
 */
export default function RiderEmailVerify({
    email,
    verified,
    disabled = false,
    onVerified,
}: Props) {
    const address = email.trim().toLowerCase();
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [sending, setSending] = useState(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendIn, setResendIn] = useState(0);

    // The code box is only shown for the address the code was sent to; typing another address closes it.
    const codeOpen = sentTo !== null && sentTo === address;

    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setTimeout(() => setResendIn((s) => s - 1), 1000);

        return () => clearTimeout(t);
    }, [resendIn]);

    async function send() {
        if (sending || disabled) return;
        if (!EMAIL_RE.test(address)) {
            setError('Enter a valid email address first.');

            return;
        }
        setError(null);
        setSending(true);
        const res = await postJson<{ resend_in?: number }>(
            '/register/biker/email-otp/send',
            { email: address },
        );
        setSending(false);

        if (!res.ok) {
            setError(res.message);
            if (res.status === 429 && res.data.retry_after)
                setResendIn(res.data.retry_after);

            return;
        }

        setSentTo(address);
        setCode('');
        setResendIn(res.data.resend_in ?? 60);
    }

    async function verify(value: string) {
        if (checking || disabled || value.length !== 6 || !sentTo) return;
        setChecking(true);
        setError(null);
        const res = await postJson('/register/biker/email-otp/verify', {
            email: sentTo,
            code: value,
        });
        setChecking(false);

        if (!res.ok) {
            setError(res.message);
            setCode('');

            return;
        }

        onVerified(sentTo);
    }

    function onCode(raw: string) {
        const digits = raw.replace(/\D/g, '').slice(0, 6);
        setCode(digits);
        if (digits.length === 6) void verify(digits);
    }

    if (verified) {
        return (
            <p
                role="status"
                className="flex items-center gap-2 text-sm font-semibold text-m-accent"
            >
                <BadgeCheck className="size-5 shrink-0" aria-hidden />
                <span className="[overflow-wrap:anywhere]">
                    Email verified: {address}
                </span>
            </p>
        );
    }

    return (
        <div className="min-w-0 space-y-3 rounded-xl border border-m-line2 bg-m-page2 p-4">
            {!codeOpen ? (
                <>
                    <p className="text-xs leading-relaxed text-m-body2">
                        Use a real email you can open. We will send a 6-digit
                        code to confirm it before you can continue.
                    </p>
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={sending || disabled}
                        className={outlineSmall}
                    >
                        {sending ? (
                            <>
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden
                                />{' '}
                                Sending…
                            </>
                        ) : (
                            <>
                                <Send className="size-4" aria-hidden /> Send
                                verification code
                            </>
                        )}
                    </button>
                </>
            ) : (
                <>
                    <p className="text-xs leading-relaxed text-m-body2 [overflow-wrap:anywhere]">
                        We sent a 6-digit code to{' '}
                        <span className="font-semibold text-m-ink">
                            {sentTo}
                        </span>
                        . Check your Spam folder if you do not see it.
                    </p>
                    <label htmlFor="rider-email-code" className="sr-only">
                        6-digit verification code
                    </label>
                    <input
                        id="rider-email-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) => onCode(e.target.value)}
                        disabled={checking || disabled}
                        placeholder="000000"
                        className="h-12 w-full rounded-xl border border-m-line bg-m-card px-4 text-center text-xl font-bold tracking-[0.5em] text-m-ink outline-none placeholder:text-m-muted/60 focus:border-m-accent focus:ring-2 focus:ring-m-accent/25 disabled:opacity-60"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void verify(code)}
                            disabled={checking || disabled || code.length !== 6}
                            className={outlineSmall}
                        >
                            {checking ? (
                                <>
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden
                                    />{' '}
                                    Checking…
                                </>
                            ) : (
                                'Verify code'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => void send()}
                            disabled={
                                resendIn > 0 || sending || checking || disabled
                            }
                            className="rounded-xl px-3 py-2.5 text-sm font-semibold text-m-amber transition hover:bg-[#F28C28]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {resendIn > 0
                                ? `Resend code (0:${String(resendIn).padStart(2, '0')})`
                                : 'Resend code'}
                        </button>
                    </div>
                </>
            )}
            {error && (
                <p
                    role="alert"
                    className="text-xs font-medium text-m-redtext [overflow-wrap:anywhere]"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
