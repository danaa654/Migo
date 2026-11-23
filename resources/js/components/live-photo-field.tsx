import {
    Camera,
    Check,
    Loader2,
    RotateCcw,
    ShieldAlert,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    createVerifier,
    loadHuman,
    type FaceCheck,
    type RuleResult,
    type Verifier,
} from '@/lib/face-verification';

const MAX_SIDE = 1024; // longest side of the saved photo, keeps the file well under the 5 MB limit
const QUALITY = 0.85;
const STABLE_FRAMES = 3; // every rule must pass on this many frames in a row before the shutter unlocks
const CHECK_EVERY_MS = 250;

const btn =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-m-mint px-3 py-1.5 text-sm font-semibold text-m-accent transition hover:bg-m-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-60';
const solidBtn =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-m-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-m-forest-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent disabled:cursor-not-allowed disabled:opacity-50';

type Props = {
    id: string;
    label: string;
    file: File | null;
    onChange: (file: File | null) => void;
    error?: string;
    hint?: string;
    disabled?: boolean;
};

type Captured = { file: File; url: string };

// The face models load once per page and are then reused.
let verifierPromise: Promise<Verifier> | null = null;
function ensureVerifier(): Promise<Verifier> {
    verifierPromise ??= loadHuman()
        .then(createVerifier)
        .catch((e) => {
            verifierPromise = null;
            throw e;
        });

    return verifierPromise;
}

const debugOn = (() => {
    try {
        return window.localStorage.getItem('faceDebug') === '1';
    } catch {
        return false;
    }
})();

function cameraProblem(e: unknown): string {
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError')
        return 'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError')
        return 'No camera was found on this device.';
    if (name === 'NotReadableError' || name === 'AbortError')
        return 'The camera is being used by another app. Close it and try again.';

    return 'Could not open the camera. Please try again.';
}

/**
 * Mandatory profile photo taken LIVE with the device camera, with strict on-device face verification. There is no
 * file picker. While the camera is open every frame is checked against the rules (human face visible, one person,
 * whole face framed, facing the camera, eyes open, no glasses, a real face and not a picture on a screen or paper,
 * good light). The Capture button stays locked until all rules pass, a failing rule is named on screen, and the
 * captured frame is verified once more at the moment of capture. This is a quality and presence check only; it is
 * not identity verification. Needs a secure page (https or localhost) because browsers only allow camera access there.
 */
export default function LivePhotoField({
    id,
    label,
    file,
    onChange,
    error,
    hint,
    disabled = false,
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streak = useRef(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [verifier, setVerifier] = useState<Verifier | null>(null);
    const [starting, setStarting] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const [captured, setCaptured] = useState<Captured | null>(null);
    const [rules, setRules] = useState<RuleResult[] | null>(null);
    const [ready, setReady] = useState(false);
    const [debug, setDebug] = useState<FaceCheck['debug'] | null>(null);

    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(
        () => () => {
            if (url) URL.revokeObjectURL(url);
        },
        [url],
    );

    const pendingUrl = captured?.url;
    useEffect(
        () => () => {
            if (pendingUrl) URL.revokeObjectURL(pendingUrl);
        },
        [pendingUrl],
    );

    // Show the live stream and always release the camera when it is no longer needed
    // (cancel, capture, leaving the page, or the form being submitted).
    useEffect(() => {
        const video = videoRef.current;
        if (video && stream) {
            video.srcObject = stream;
            void video.play().catch(() => undefined);
        }

        return () => {
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, [stream]);

    useEffect(() => {
        if (disabled) setStream(null);
    }, [disabled]);

    // Live verification loop: runs only while the camera is open and the face models are loaded.
    useEffect(() => {
        if (!stream || !verifier) return;
        let stop = false;
        streak.current = 0;

        void (async () => {
            while (!stop) {
                const video = videoRef.current;
                if (video && video.readyState >= 2 && video.videoWidth) {
                    try {
                        const result = await verifier.check(verifier.grab(video));
                        if (stop) break;
                        streak.current = result.ok ? streak.current + 1 : 0;
                        setRules(result.rules);
                        setDebug(result.debug);
                        setReady(streak.current >= STABLE_FRAMES);
                    } catch {
                        streak.current = 0;
                        setReady(false);
                    }
                }
                await new Promise((r) => setTimeout(r, CHECK_EVERY_MS));
            }
        })();

        return () => {
            stop = true;
            setReady(false);
            setRules(null);
        };
    }, [stream, verifier]);

    async function openCamera() {
        if (starting || disabled) return;
        setProblem(null);
        setCaptured(null);

        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setProblem(
                'The camera only works on a secure page (https or localhost) in a browser that supports it.',
            );

            return;
        }

        setStarting(true);
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 960 },
                },
                audio: false,
            });
            setStream(s);
        } catch (e) {
            setProblem(cameraProblem(e));
            setStarting(false);

            return;
        }

        // Face verification is mandatory: if it cannot load, no photo can be taken.
        try {
            setVerifier(await ensureVerifier());
        } catch {
            setStream(null);
            setProblem(
                'Face verification could not load, so a photo cannot be taken. Check your connection and try again.',
            );
        } finally {
            setStarting(false);
        }
    }

    function closeCamera() {
        setStream(null); // the effect cleanup stops the tracks
    }

    async function takePhoto() {
        const video = videoRef.current;
        if (
            capturing ||
            !ready ||
            !verifier ||
            !video ||
            !video.videoWidth ||
            !video.videoHeight
        )
            return;

        setCapturing(true);
        setProblem(null);
        try {
            // Final strict check on the exact frame being captured.
            const result = await verifier.check(verifier.grab(video));
            if (!result.ok) {
                streak.current = 0;
                setReady(false);
                setRules(result.rules);
                setProblem(
                    result.rules.find((r) => r.status === 'fail')?.message ??
                        'The photo did not pass face verification. Please try again.',
                );

                return;
            }

            const scale = Math.min(
                1,
                MAX_SIDE / Math.max(video.videoWidth, video.videoHeight),
            );
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('no canvas');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/jpeg', QUALITY),
            );
            if (!blob) throw new Error('no blob');

            const photo = new File([blob], `profile-photo-${Date.now()}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
            });
            setCaptured({ file: photo, url: URL.createObjectURL(photo) });
            closeCamera();
        } catch {
            setProblem('Could not take the photo. Please try again.');
        } finally {
            setCapturing(false);
        }
    }

    function usePhoto() {
        if (!captured) return;
        onChange(captured.file);
        setCaptured(null);
    }

    const live = stream !== null;
    const reviewing = captured !== null;
    const shownError = problem ?? error;
    const failing = rules?.find((r) => r.status === 'fail') ?? null;
    const frameColor = !rules
        ? 'border-white/80'
        : ready
          ? 'border-emerald-400'
          : failing
            ? 'border-red-500'
            : 'border-white/80';

    return (
        <div className="min-w-0">
            <span className="mb-1.5 block text-sm font-medium">
                {label} <span className="text-m-redtext">*</span>
            </span>

            <div
                className={`rounded-xl border-2 border-dashed p-4 transition ${shownError && !live ? 'border-m-red' : 'border-m-line2 bg-m-page2'}`}
            >
                {live ? (
                    <div className="space-y-3">
                        <p className="text-center text-sm font-bold text-m-ink">
                            Take Your Profile Photo
                        </p>
                        <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl bg-black sm:aspect-[4/3] sm:max-w-sm">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="size-full -scale-x-100 object-cover"
                            />
                            {/* Face guide: green when every rule passes, red when a rule fails. */}
                            <div
                                aria-hidden
                                className={`pointer-events-none absolute top-1/2 left-1/2 aspect-[3/4] h-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-colors sm:h-[84%] ${frameColor}`}
                            />
                            {(!verifier || !rules) && (
                                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/60 py-2 text-xs font-medium text-white">
                                    <Loader2
                                        className="size-3.5 animate-spin"
                                        aria-hidden
                                    />
                                    {verifier
                                        ? 'Checking your face…'
                                        : 'Loading face verification…'}
                                </div>
                            )}
                        </div>

                        <p className="text-center text-sm font-medium text-m-ink">
                            Position your face inside the frame.
                        </p>

                        {failing && (
                            <div
                                role="alert"
                                className="mx-auto flex max-w-sm gap-2 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700"
                            >
                                <ShieldAlert
                                    className="mt-0.5 size-4 shrink-0"
                                    aria-hidden
                                />
                                <span>
                                    Rule not met: {failing.label}.{' '}
                                    <span className="font-medium">
                                        {failing.message}
                                    </span>
                                </span>
                            </div>
                        )}
                        {problem && (
                            <p
                                role="alert"
                                className="mx-auto max-w-sm text-center text-xs font-semibold text-red-700"
                            >
                                {problem}
                            </p>
                        )}

                        {rules && (
                            <ul
                                className="mx-auto grid max-w-sm gap-1 text-xs"
                                aria-label="Face verification rules"
                            >
                                {rules.map((r) => (
                                    <li
                                        key={r.id}
                                        className={`flex items-center gap-2 ${r.status === 'fail' ? 'font-semibold text-red-700' : r.status === 'pass' ? 'text-m-accent' : 'text-m-muted'}`}
                                    >
                                        {r.status === 'pass' ? (
                                            <Check
                                                className="size-3.5"
                                                aria-hidden
                                            />
                                        ) : r.status === 'fail' ? (
                                            <X
                                                className="size-3.5"
                                                aria-hidden
                                            />
                                        ) : (
                                            <span
                                                className="inline-block size-1.5 rounded-full bg-current opacity-50"
                                                aria-hidden
                                            />
                                        )}
                                        {r.label}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {debugOn && debug && (
                            <pre className="mx-auto max-w-sm overflow-x-auto rounded bg-black/80 p-2 text-[10px] text-white">
                                {JSON.stringify(debug)}
                            </pre>
                        )}

                        <div className="flex flex-wrap justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => void takePhoto()}
                                disabled={!ready || capturing}
                                className={solidBtn}
                            >
                                {capturing ? (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden
                                    />
                                ) : (
                                    <Camera className="size-4" aria-hidden />
                                )}{' '}
                                Capture Photo
                            </button>
                            <button
                                type="button"
                                onClick={closeCamera}
                                disabled={capturing}
                                className={btn}
                            >
                                Cancel
                            </button>
                        </div>
                        {!ready && (
                            <p className="text-center text-xs text-m-muted">
                                The Capture button unlocks when every rule above
                                passes.
                            </p>
                        )}
                    </div>
                ) : reviewing ? (
                    <div className="space-y-3">
                        <p className="text-center text-sm font-bold text-m-ink">
                            Review your photo
                        </p>
                        <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl bg-black sm:aspect-[4/3] sm:max-w-sm">
                            <img
                                src={captured.url}
                                alt="Your captured profile photo"
                                className="size-full object-cover"
                            />
                        </div>
                        <p className="text-center text-xs text-m-body2">
                            Your face passed verification. Use this photo, or
                            retake it.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            <button
                                type="button"
                                onClick={usePhoto}
                                className={solidBtn}
                            >
                                <Check className="size-4" aria-hidden /> Use This
                                Photo
                            </button>
                            <button
                                type="button"
                                onClick={() => void openCamera()}
                                disabled={starting}
                                className={btn}
                            >
                                <RotateCcw className="size-4" aria-hidden />{' '}
                                Retake Photo
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-m-mint text-m-accent">
                            {url ? (
                                <img
                                    src={url}
                                    alt="Your profile photo"
                                    className="size-full object-cover"
                                />
                            ) : (
                                <Camera className="size-6" aria-hidden />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <button
                                id={id}
                                type="button"
                                onClick={() => void openCamera()}
                                disabled={disabled || starting}
                                aria-describedby={
                                    shownError ? `${id}-err` : `${id}-hint`
                                }
                                className={btn}
                            >
                                {starting ? (
                                    <>
                                        <Loader2
                                            className="size-4 animate-spin"
                                            aria-hidden
                                        />{' '}
                                        Opening camera…
                                    </>
                                ) : file ? (
                                    <>
                                        <RotateCcw
                                            className="size-4"
                                            aria-hidden
                                        />{' '}
                                        Retake Photo
                                    </>
                                ) : (
                                    <>
                                        <Camera
                                            className="size-4"
                                            aria-hidden
                                        />{' '}
                                        Open Camera
                                    </>
                                )}
                            </button>
                            <p
                                className={`mt-1.5 text-xs ${file ? 'font-medium text-m-accent' : 'text-m-muted'}`}
                            >
                                {file
                                    ? 'Photo confirmed.'
                                    : 'No photo yet. A clear photo of your face is required.'}
                            </p>
                        </div>
                        {file && (
                            <button
                                type="button"
                                onClick={() => onChange(null)}
                                disabled={disabled}
                                aria-label="Remove photo"
                                className="rounded-full p-1.5 text-m-muted hover:bg-m-mint hover:text-m-redtext"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {shownError && !live && (
                <p
                    id={`${id}-err`}
                    role="alert"
                    className="mt-1.5 text-xs font-medium text-m-redtext [overflow-wrap:anywhere]"
                >
                    {shownError}
                </p>
            )}
            {hint && !shownError && !live && (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-m-muted">
                    {hint}
                </p>
            )}
        </div>
    );
}
