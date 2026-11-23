import type { Human, FaceResult } from '@vladmandic/human';

/**
 * Strict on-device face verification for the rider selfie. Runs entirely in the browser (models are served from
 * /models/human, nothing is uploaded) and only while the rider is capturing the selfie.
 *
 * Every rule has an id and a message so the UI can tell the rider exactly which rule failed.
 * It is a presence/quality check, not identity verification.
 */

export type RuleId =
    | 'face'
    | 'single'
    | 'framing'
    | 'pose'
    | 'eyes'
    | 'glasses'
    | 'real'
    | 'light';

export type RuleStatus = 'pass' | 'fail' | 'pending';

export type RuleResult = { id: RuleId; label: string; status: RuleStatus; message: string };

export type FaceCheck = { ok: boolean; rules: RuleResult[]; debug: Record<string, number | string> };

/** Tunable thresholds. Set localStorage "faceDebug" to "1" to see the live scores on the camera screen. */
export const T = {
    minFaceConfidence: 0.6,
    minFaceShare: 0.1, // face box area / frame area
    maxFaceShare: 0.75,
    centerX: [0.3, 0.7] as const,
    centerY: [0.25, 0.75] as const,
    maxYaw: 0.3, // radians (~17 deg)
    maxPitch: 0.35,
    maxRoll: 0.35,
    minEyeOpen: 0.14, // eye aspect ratio
    minRealScore: 0.6, // anti-spoof: "real" score (photo / screen / paper => low)
    minLiveScore: 0.5, // liveness score
    minBrightness: 55,
    maxBrightness: 235,
    minSharpness: 14,
    eyeDarkRatio: 0.3, // eye area far darker than the cheek => sunglasses / covered eyes
    rimRatio: 2.2, // lower-frame edge energy vs bare skin
    bridgeRatio: 2.0, // nose-bridge edge energy vs bare skin
    frameWidth: 640,
};

const LABELS: Record<RuleId, string> = {
    face: 'A human face is visible',
    single: 'Only one person',
    framing: 'Face fully inside the frame',
    pose: 'Looking straight at the camera',
    eyes: 'Eyes open',
    glasses: 'No glasses',
    real: 'Real person (not a photo or screen)',
    light: 'Good lighting, sharp image',
};

const ORDER: RuleId[] = ['face', 'single', 'framing', 'pose', 'eyes', 'glasses', 'real', 'light'];

export type Verifier = {
    /** Analyse one frame (a canvas the caller has drawn the current video frame onto). */
    check: (frame: HTMLCanvasElement) => Promise<FaceCheck>;
    /** Draw the video frame onto a canvas of the size the verifier expects. */
    grab: (video: HTMLVideoElement) => HTMLCanvasElement;
};

export function createVerifier(human: Human): Verifier {
    return {
        grab: (video) => grabFrame(video),
        check: (frame) => analyse(human, frame),
    };
}

/** Loads the face models (about 3.5 MB, cached by the browser after the first time). */
export async function loadHuman(
    modelBasePath = '/models/human/',
    backend?: 'webgl' | 'wasm' | 'cpu',
): Promise<Human> {
    const { Human: HumanCtor } = await import('@vladmandic/human');
    const human = new HumanCtor({
        modelBasePath,
        ...(backend ? { backend } : {}),
        cacheSensitivity: 0, // never reuse a previous frame's result
        filter: { enabled: false },
        face: {
            enabled: true,
            detector: { rotation: false, maxDetected: 4, minConfidence: 0.4 },
            mesh: { enabled: true },
            iris: { enabled: false },
            description: { enabled: false },
            emotion: { enabled: false },
            attention: { enabled: false },
            antispoof: { enabled: true },
            liveness: { enabled: true },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        segmentation: { enabled: false },
    });
    await human.load();
    await human.warmup();

    return human;
}

function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
    const w = Math.min(T.frameWidth, video.videoWidth);
    const h = Math.round((video.videoHeight / video.videoWidth) * w);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')?.drawImage(video, 0, 0, w, h);

    return c;
}

type Pt = number[];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Gray image + mean absolute gradient helper. */
function grayOf(canvas: HTMLCanvasElement): { g: Float32Array; w: number; h: number } {
    const w = canvas.width;
    const h = canvas.height;
    const { data } = (canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D).getImageData(0, 0, w, h);
    const g = new Float32Array(w * h);
    for (let i = 0; i < g.length; i++)
        g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

    return { g, w, h };
}

type Gray = ReturnType<typeof grayOf>;

function clampRect(img: Gray, x0: number, y0: number, x1: number, y1: number) {
    return {
        x0: Math.max(1, Math.floor(Math.min(x0, x1))),
        y0: Math.max(1, Math.floor(Math.min(y0, y1))),
        x1: Math.min(img.w - 2, Math.ceil(Math.max(x0, x1))),
        y1: Math.min(img.h - 2, Math.ceil(Math.max(y0, y1))),
    };
}

/** Mean luminance of a rectangle. */
function meanLum(img: Gray, x0: number, y0: number, x1: number, y1: number): number {
    const r = clampRect(img, x0, y0, x1, y1);
    let s = 0;
    let n = 0;
    for (let y = r.y0; y <= r.y1; y++)
        for (let x = r.x0; x <= r.x1; x++) {
            s += img.g[y * img.w + x];
            n++;
        }

    return n ? s / n : 0;
}

/** Mean |vertical gradient| (horizontal edges: frame rims, bridge) of a rectangle. */
function meanGy(img: Gray, x0: number, y0: number, x1: number, y1: number): number {
    const r = clampRect(img, x0, y0, x1, y1);
    let s = 0;
    let n = 0;
    for (let y = r.y0; y <= r.y1; y++)
        for (let x = r.x0; x <= r.x1; x++) {
            s += Math.abs(img.g[(y + 1) * img.w + x] - img.g[(y - 1) * img.w + x]);
            n++;
        }

    return n ? s / n : 0;
}

/** Variance of the Laplacian inside a rectangle: low = blurry. */
function sharpness(img: Gray, x0: number, y0: number, x1: number, y1: number): number {
    const r = clampRect(img, x0, y0, x1, y1);
    let s = 0;
    let q = 0;
    let n = 0;
    for (let y = r.y0; y <= r.y1; y++)
        for (let x = r.x0; x <= r.x1; x++) {
            const i = y * img.w + x;
            const l = img.g[i - 1] + img.g[i + 1] + img.g[i - img.w] + img.g[i + img.w] - 4 * img.g[i];
            s += l;
            q += l * l;
            n++;
        }

    return n ? q / n - (s / n) ** 2 : 0;
}

/** Glasses / sunglasses / covered eyes, from face-mesh landmarks. */
function glassesScores(img: Gray, m: Pt[]) {
    // MediaPipe 468-point mesh: 33/133 = one eye (outer/inner), 263/362 = the other eye.
    const eyes = [
        { outer: m[33], inner: m[133] },
        { outer: m[263], inner: m[362] },
    ];
    const ew = (dist(eyes[0].outer, eyes[0].inner) + dist(eyes[1].outer, eyes[1].inner)) / 2;
    const centers = eyes.map((e) => [(e.outer[0] + e.inner[0]) / 2, (e.outer[1] + e.inner[1]) / 2]);

    let rim = 0;
    let dark = 1;
    let skin = 0;
    for (const c of centers) {
        const lower = meanGy(img, c[0] - 0.9 * ew, c[1] + 0.45 * ew, c[0] + 0.9 * ew, c[1] + 0.8 * ew);
        const cheek = meanGy(img, c[0] - 0.9 * ew, c[1] + 1.2 * ew, c[0] + 0.9 * ew, c[1] + 1.55 * ew);
        rim = Math.max(rim, (lower + 1) / (cheek + 1));
        skin += cheek / 2;
        const eyeBox = meanLum(img, c[0] - 0.6 * ew, c[1] - 0.2 * ew, c[0] + 0.6 * ew, c[1] + 0.2 * ew);
        const cheekLum = meanLum(img, c[0] - 0.6 * ew, c[1] + 1.2 * ew, c[0] + 0.6 * ew, c[1] + 1.5 * ew);
        dark = Math.min(dark, eyeBox / Math.max(1, cheekLum));
    }
    const mid = [(centers[0][0] + centers[1][0]) / 2, (centers[0][1] + centers[1][1]) / 2];
    const bridgeGy = meanGy(img, mid[0] - 0.22 * ew, mid[1] - 0.25 * ew, mid[0] + 0.22 * ew, mid[1] + 0.25 * ew);

    return { rim, dark, bridge: (bridgeGy + 1) / (skin + 1) };
}

async function analyse(human: Human, frame: HTMLCanvasElement): Promise<FaceCheck> {
    const res = await human.detect(frame);
    const faces = res.face as FaceResult[];
    const debug: Record<string, number | string> = { faces: faces.length };

    const status = (): Record<RuleId, RuleResult> => {
        const o = {} as Record<RuleId, RuleResult>;
        for (const id of ORDER) o[id] = { id, label: LABELS[id], status: 'pending', message: '' };

        return o;
    };
    const r = status();
    const done = (): FaceCheck => ({
        ok: ORDER.every((id) => r[id].status === 'pass'),
        rules: ORDER.map((id) => r[id]),
        debug,
    });
    const fail = (id: RuleId, message: string) => {
        r[id].status = 'fail';
        r[id].message = message;
    };
    const pass = (id: RuleId) => {
        r[id].status = 'pass';
    };

    // Rule 1: a human face must be detected.
    const strong = faces.filter((f) => (f.faceScore ?? f.score ?? 0) >= T.minFaceConfidence);
    if (strong.length === 0) {
        fail('face', 'No human face detected. Your face must be visible in the frame.');

        return done();
    }
    pass('face');

    // Rule 2: only one person.
    if (faces.length > 1) {
        fail('single', 'More than one face detected. Only you may be in the photo.');

        return done();
    }
    pass('single');

    const f = strong[0];
    const W = frame.width;
    const H = frame.height;
    const [bx, by, bw, bh] = f.box;
    const share = (bw * bh) / (W * H);
    const cx = (bx + bw / 2) / W;
    const cy = (by + bh / 2) / H;
    debug.share = +share.toFixed(3);
    debug.faceScore = +(f.faceScore ?? f.score ?? 0).toFixed(2);

    // Rule 3: whole face inside the frame, big enough and centred.
    if (bx < 0 || by < 0 || bx + bw > W || by + bh > H)
        fail('framing', 'Your face is cut off. Keep your whole face (forehead to chin) inside the frame.');
    else if (share < T.minFaceShare) fail('framing', 'Your face is too far away. Move closer to the camera.');
    else if (share > T.maxFaceShare) fail('framing', 'Your face is too close. Move back a little.');
    else if (cx < T.centerX[0] || cx > T.centerX[1] || cy < T.centerY[0] || cy > T.centerY[1])
        fail('framing', 'Center your face inside the oval guide.');
    else pass('framing');

    const m = (f.mesh ?? []) as Pt[];
    if (m.length < 468) {
        fail('pose', 'Face landmarks could not be read. Face the camera in good light.');

        return done();
    }

    // Rule 4: facing the camera so every feature is visible.
    const ang = f.rotation?.angle;
    debug.yaw = +(ang?.yaw ?? 0).toFixed(2);
    debug.pitch = +(ang?.pitch ?? 0).toFixed(2);
    if (ang && (Math.abs(ang.yaw) > T.maxYaw || Math.abs(ang.pitch) > T.maxPitch || Math.abs(ang.roll) > T.maxRoll))
        fail('pose', 'Look straight at the camera. Do not turn or tilt your head.');
    else pass('pose');

    // Rule 5: eyes open (eye aspect ratio from the mesh).
    const ear = (dist(m[159], m[145]) / dist(m[33], m[133]) + dist(m[386], m[374]) / dist(m[263], m[362])) / 2;
    debug.eyeOpen = +ear.toFixed(2);
    if (ear < T.minEyeOpen) fail('eyes', 'Your eyes must be open and clearly visible.');
    else pass('eyes');

    // Rule 6: no glasses or sunglasses.
    const img = grayOf(frame);
    const gl = glassesScores(img, m);
    debug.rim = +gl.rim.toFixed(2);
    debug.bridge = +gl.bridge.toFixed(2);
    debug.eyeDark = +gl.dark.toFixed(2);
    if (gl.dark < T.eyeDarkRatio) fail('glasses', 'Sunglasses or covered eyes detected. Remove them and show your eyes.');
    else if (gl.rim > T.rimRatio || gl.bridge > T.bridgeRatio) fail('glasses', 'Glasses detected. Please remove your eyeglasses.');
    else pass('glasses');

    // Rule 7: a real, live face, not a picture on a phone/tablet/screen or on paper.
    const real = f.real ?? 0;
    const live = f.live ?? 0;
    debug.real = +real.toFixed(2);
    debug.live = +live.toFixed(2);
    if (real < T.minRealScore || live < T.minLiveScore)
        fail('real', 'A photo of a picture was detected. Show your real face, not a photo on a screen or paper.');
    else pass('real');

    // Rule 8: lighting and sharpness measured on the face itself.
    const bright = meanLum(img, bx, by, bx + bw, by + bh);
    const sharp = sharpness(img, bx, by, bx + bw, by + bh);
    debug.bright = Math.round(bright);
    debug.sharp = +sharp.toFixed(1);
    if (bright < T.minBrightness) fail('light', 'Too dark. Move to a well-lit area.');
    else if (bright > T.maxBrightness) fail('light', 'Too bright. Avoid strong light directly on your face.');
    else if (sharp < T.minSharpness) fail('light', 'The image is blurry. Hold still and keep the camera steady.');
    else pass('light');

    return done();
}
