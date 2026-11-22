import { MigoBrand, TopBar, navPill } from '@/components/migo-bar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    Bike,
    ChevronRight,
    ClipboardList,
    Clock,
    FileText,
    Headset,
    KeyRound,
    LifeBuoy,
    Mail,
    MapPinned,
    Menu,
    ShieldCheck,
    Star,
    UserCog,
    UserPlus,
    UserRound,
    Users,
    X,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// Placeholder contact address. Replace it with the project's real support email before going live.
const SUPPORT_EMAIL = 'support@migo.example';

// Logo files in /public: favi.png (square icon) and welcome-logo.jpg (MIGO wordmark with the tagline).
const ICON = '/favi.png';
const WELCOME_LOGO = '/welcome-logo.jpg';
// Hero background in /public.
const HERO_BG = '/background.png';
// Optional: transparent PNG of the rider on the motorcycle. Put it in /public as rider.png. Hidden automatically if missing.
const HERO_RIDER = '/rider.png';

const links = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'services', label: 'Services' },
    { id: 'passenger-guide', label: 'Passenger Guide' },
    { id: 'biker-information', label: 'Rider Information' },
    { id: 'support', label: 'Customer Support' },
];

type Item = { icon: LucideIcon; title: string; text: string };

const audiences: { icon: LucideIcon; title: string; points: string[] }[] = [
    {
        icon: UserRound,
        title: 'For Customers',
        points: [
            'Mag-book ng motorcycle or car ride in a few taps.',
            'Magpadala ng parcel o padala, at i-track ang rider hanggang makarating.',
            'I-rate ang ride at humingi ng tulong kapag kailangan.',
        ],
    },
    {
        icon: Bike,
        title: 'For Riders & Drivers',
        points: [
            'Mag-apply online at tapusin ang accreditation.',
            'Mag-online para makatanggap ng nearby ride at padala requests.',
            'I-accept o i-decline ang offers; ang server ang bahala sa matching.',
        ],
    },
    {
        icon: ShieldCheck,
        title: 'For Administrators',
        points: [
            'I-manage ang rider, driver, at passenger records.',
            'Bantayan ang live bookings at dispatch settings.',
            'I-review ang complaints at mag-generate ng reports.',
        ],
    },
];

const services: Item[] = [
    {
        icon: Clock,
        title: 'Ride & Padala Booking',
        text: 'Awtomatikong ino-offer ang request mo sa nearby accredited riders at drivers.',
    },
    {
        icon: ClipboardList,
        title: 'Rider & Driver Accreditation',
        text: 'Documents, orientation, at vehicle inspection (motorcycle o car) bago makatanggap ng rides o padala.',
    },
    {
        icon: MapPinned,
        title: 'Live Dispatch Monitoring',
        text: 'Nakikita ng administrators ang searches, offers, at trips habang nangyayari.',
    },
    {
        icon: FileText,
        title: 'Complaints and Reports',
        text: 'I-review ang customer concerns at mag-generate ng administrative reports. Ginagawa in phases.',
    },
];

const steps: Item[] = [
    {
        icon: UserPlus,
        title: 'Mag-login gamit ang Google o phone number',
        text: 'Walang registration form. Mag-sign in gamit ang Google o phone number (may 6-digit code via SMS) at awtomatikong magagawa ang account mo sa unang login.',
    },
    {
        icon: MapPinned,
        title: 'Set pickup and destination',
        text: 'Piliin ang dalawang points sa map at makikita mo muna ang estimated fare, ride man o padala.',
    },
    {
        icon: Bike,
        title: 'Get matched with a rider or driver',
        text: 'Ang pinakamalapit na available accredited rider o driver ang tatanggap. Pwede kang mag-cancel hanggang doon.',
    },
    {
        icon: Star,
        title: 'Ride and rate',
        text: 'I-track ang rider o driver live, tapos i-rate ang trip pagdating mo.',
    },
];

const bikerInfo: Item[] = [
    {
        icon: FileText,
        title: 'Apply online',
        text: 'Gumawa ng rider account at i-submit ang details at documents para ma-review.',
    },
    {
        icon: ClipboardList,
        title: 'Basic requirements',
        text: "Driver's license, OR/CR ng motorcycle o car, official receipt, at NBI clearance. Magtanong sa Migo office para sa current list.",
    },
    {
        icon: UserCog,
        title: 'Accreditation steps',
        text: 'Document check in person, orientation, tapos vehicle inspection (motorcycle o car).',
    },
    {
        icon: Headset,
        title: 'Rider support',
        text: 'May tanong sa application o accreditation? Makipag-ugnayan sa Migo support.',
    },
];

const supportTopics: Item[] = [
    {
        icon: MapPinned,
        title: 'Booking help',
        text: 'Step-by-step help sa pag-book ng ride o padala.',
    },
    {
        icon: KeyRound,
        title: 'Login issues',
        text: 'Troubleshooting steps kung hindi ka makapag-sign in.',
    },
    {
        icon: LifeBuoy,
        title: 'Rider concerns',
        text: 'Mga tanong tungkol sa applications, accreditation, o ride at padala requests.',
    },
    {
        icon: Headset,
        title: 'Report a rider or driver',
        text: 'Sabihin sa amin ang concern sa isang trip, padala, o rider/driver.',
    },
];

const card =
    'h-full rounded-2xl border border-m-line bg-m-card p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-m-accent/40 hover:shadow-md';
const iconBox =
    'mb-4 flex size-11 items-center justify-center rounded-xl bg-m-mint text-m-accent';
const focus =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';
const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-full bg-m-forest px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-m-forest-hover hover:shadow-md ${focus}`;
const btnOutline = `inline-flex items-center justify-center gap-2 rounded-full border-2 border-m-ink bg-m-card/70 px-6 py-3 text-sm font-semibold text-m-ink transition duration-200 hover:-translate-y-0.5 hover:bg-m-card hover:shadow-md ${focus}`;
const btnAccent = `inline-flex items-center justify-center gap-2 rounded-full bg-[#F28C28] px-6 py-3 text-sm font-bold text-[#1A2B24] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#F59A3F] hover:shadow-md ${focus}`;

function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
    });
}

/** Fades and slides content in once when it scrolls into view. */
function Reveal({
    children,
    delay = 0,
    as: Tag = 'div',
    className = '',
}: {
    children: ReactNode;
    delay?: number;
    as?: 'div' | 'li';
    className?: string;
}) {
    const ref = useRef<HTMLElement | null>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (
            window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
            !('IntersectionObserver' in window)
        ) {
            setShown(true);
            return;
        }
        const obs = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    setShown(true);
                    obs.disconnect();
                }
            },
            { threshold: 0.15 },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <Tag
            ref={ref as never}
            style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
            className={`transition duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
        >
            {children}
        </Tag>
    );
}

/** Soft wave between two sections. `from` is the section above, `to` the section below. */
function WaveDivider({
    from,
    to,
    flip = false,
}: {
    from: string;
    to: string;
    flip?: boolean;
}) {
    return (
        <div
            aria-hidden
            style={{ backgroundColor: from }}
            className="-mb-px leading-none"
        >
            <svg
                viewBox="0 0 1440 80"
                preserveAspectRatio="none"
                className={`block h-12 w-full sm:h-20 ${flip ? '[transform:scaleX(-1)]' : ''}`}
            >
                <path
                    d="M0 40 C 240 90 480 0 720 40 C 960 80 1200 0 1440 40 V80 H0 Z"
                    style={{ fill: to }}
                />
            </svg>
        </div>
    );
}

// ---------- Ride map illustration (decorative, not live tracking) ----------
// The map tile is drawn flat and tilted with one affine matrix. Everything that should stand upright
// (trees, pin, rider, card) is drawn in screen space at projected positions.
const M = { a: 1.1, b: 0.02, c: -0.2, d: 0.7, e: 130, f: 100 };
const proj = ([x, y]: [number, number]): [number, number] => [
    M.a * x + M.c * y + M.e,
    M.b * x + M.d * y + M.f,
];
const n = (v: number) => v.toFixed(1);

const ROUTE_LOCAL: [number, number][] = [
    [70, 240],
    [200, 255],
    [205, 75],
    [330, 70],
];
const R = ROUTE_LOCAL.map(proj);
const ROUTE_D = `M${n(R[0][0])} ${n(R[0][1])} C${n(R[1][0])} ${n(R[1][1])} ${n(R[2][0])} ${n(R[2][1])} ${n(R[3][0])} ${n(R[3][1])}`;
const START = R[0];
const DEST = R[3];

function bezier(t: number): [number, number] {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [0, 1].map(
        (i) =>
            k[0] * R[0][i] + k[1] * R[1][i] + k[2] * R[2][i] + k[3] * R[3][i],
    ) as [number, number];
}

const TREES: [number, number][] = [
    [40, 50],
    [62, 62],
    [200, 38],
    [125, 172],
    [285, 168],
    [306, 196],
    [356, 140],
    [24, 150],
    [150, 100],
];
const STREETS_MAJOR = { h: [70, 150, 225], v: [90, 170, 250, 330] };
const STREETS_MINOR = { h: [30, 110, 187, 262], v: [50, 130, 210, 290, 360] };
const PARKS: [number, number, number, number][] = [
    [102, 158, 62, 50],
    [256, 148, 72, 58],
    [18, 24, 58, 42],
    [182, 18, 62, 38],
    [20, 232, 58, 40],
];
const SKYLINE: [number, number, number, number][] = [
    [400, 52, 30, 62],
    [434, 24, 38, 92],
    [476, 62, 30, 52],
    [510, 36, 28, 78],
    [542, 70, 24, 44],
];

function useReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(
        () =>
            setReduced(
                window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            ),
        [],
    );
    return reduced;
}

function Tree({ at }: { at: [number, number] }) {
    const [x, y] = proj(at);
    return (
        <g transform={`translate(${n(x)} ${n(y)})`}>
            <ellipse cx="0" cy="1" rx="8" ry="3" fill="#1A2B24" opacity=".12" />
            <rect
                x="-1.5"
                y="-12"
                width="3"
                height="12"
                rx="1"
                fill="#8B6B4A"
            />
            <circle cx="0" cy="-18" r="9" fill="#7CC795" />
            <circle cx="-3" cy="-21" r="4" fill="#9ADBAF" />
        </g>
    );
}

function Rider() {
    return (
        <g>
            <ellipse
                cx="0"
                cy="1"
                rx="28"
                ry="5"
                fill="#1A2B24"
                opacity=".18"
            />
            <circle cx="-17" cy="-8" r="8" fill="#1A2B24" />
            <circle cx="-17" cy="-8" r="3" fill="#E3DCC8" />
            <circle cx="18" cy="-8" r="8" fill="#1A2B24" />
            <circle cx="18" cy="-8" r="3" fill="#E3DCC8" />
            <path
                d="M-26 -14 Q-26 -26 -14 -26 L4 -26 Q10 -26 12 -18 L14 -10 L-24 -10 Q-26 -10 -26 -14 Z"
                fill="#1B5240"
            />
            <path
                d="M12 -12 L16 -34 Q18 -37 22 -35 L22 -30 L20 -12 Z"
                fill="#143D30"
            />
            <path
                d="M17 -35 L25 -37"
                stroke="#1A2B24"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <circle cx="22" cy="-30" r="2.4" fill="#FFD43B" />
            <rect
                x="-40"
                y="-44"
                width="24"
                height="20"
                rx="3"
                fill="#1B5240"
                stroke="#F28C28"
                strokeWidth="1.5"
            />
            <text
                x="-28"
                y="-29"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#FFFFFF"
                fontFamily="Inter, Arial, sans-serif"
            >
                M
            </text>
            <path
                d="M-8 -28 Q-10 -46 0 -48 Q8 -48 8 -38 L6 -28 Z"
                fill="#1A2B24"
            />
            <path
                d="M5 -42 L17 -36"
                stroke="#1A2B24"
                strokeWidth="4"
                strokeLinecap="round"
            />
            <path
                d="M-2 -28 L8 -18 L12 -12"
                stroke="#1A2B24"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            <circle cx="1" cy="-55" r="7" fill="#F28C28" />
            <rect
                x="3"
                y="-58"
                width="6"
                height="3.5"
                rx="1.7"
                fill="#FFFFFF"
                opacity=".9"
            />
        </g>
    );
}

const PIN_PATH =
    'M0 0 C-4 -9 -12 -16 -12 -24 A12 12 0 1 1 12 -24 C12 -16 4 -9 0 0 Z';

/** Tilted map tile with a rider heading to a destination pin. Decorative only. */
function RideMap({ still = false }: { still?: boolean }) {
    const moving = !useReducedMotion() && !still;
    const rest = bezier(0.55);
    const T = `matrix(${M.a} ${M.b} ${M.c} ${M.d} ${M.e} ${M.f})`;
    const dur = '9s';

    return (
        <figure>
            <svg
                viewBox="0 0 640 440"
                role="img"
                className="block w-full"
                aria-label="Illustration of a rider on a map traveling toward a destination pin"
            >
                <defs>
                    <clipPath id="rm-clip">
                        <rect x="10" y="10" width="380" height="280" rx="20" />
                    </clipPath>
                    <filter
                        id="rm-blur"
                        x="-20%"
                        y="-50%"
                        width="140%"
                        height="200%"
                    >
                        <feGaussianBlur stdDeviation="14" />
                    </filter>
                    <filter
                        id="rm-glow"
                        x="-20%"
                        y="-20%"
                        width="140%"
                        height="140%"
                    >
                        <feGaussianBlur stdDeviation="4" />
                    </filter>
                    <filter
                        id="rm-soft"
                        x="-20%"
                        y="-30%"
                        width="140%"
                        height="180%"
                    >
                        <feDropShadow
                            dx="0"
                            dy="6"
                            stdDeviation="8"
                            floodColor="#1B5240"
                            floodOpacity=".18"
                        />
                    </filter>
                </defs>

                {/* faint city skyline behind the tile */}
                <g fill="#CFE0D6" opacity=".6">
                    {SKYLINE.map(([x, y, w, h]) => (
                        <rect key={x} x={x} y={y} width={w} height={h} rx="2" />
                    ))}
                </g>

                {/* tile: soft shadow, edge thickness, top surface */}
                <ellipse
                    cx="320"
                    cy="350"
                    rx="250"
                    ry="30"
                    fill="#1B5240"
                    opacity=".16"
                    filter="url(#rm-blur)"
                />
                <g transform={`translate(0 14) ${T}`}>
                    <rect width="400" height="300" rx="26" fill="#D9D2BD" />
                </g>
                <g transform={T}>
                    <rect width="400" height="300" rx="26" fill="#FBF8EF" />
                    <g clipPath="url(#rm-clip)">
                        <rect
                            x="10"
                            y="10"
                            width="380"
                            height="280"
                            fill="#EFEBDD"
                        />
                        {PARKS.map(([x, y, w, h]) => (
                            <rect
                                key={`${x}-${y}`}
                                x={x}
                                y={y}
                                width={w}
                                height={h}
                                rx="10"
                                fill="#CDE8D3"
                            />
                        ))}
                        <path
                            d="M250 300 C300 250 330 230 410 160"
                            fill="none"
                            stroke="#BFD6C8"
                            strokeWidth="40"
                            strokeLinecap="round"
                        />
                        <path
                            d="M250 300 C300 250 330 230 410 160"
                            fill="none"
                            stroke="#CFE0D6"
                            strokeWidth="22"
                            strokeLinecap="round"
                        />
                        <g stroke="#FFFFFF" strokeLinecap="round">
                            <g strokeWidth="4">
                                {STREETS_MINOR.h.map((y) => (
                                    <path key={`h${y}`} d={`M10 ${y}H390`} />
                                ))}
                                {STREETS_MINOR.v.map((x) => (
                                    <path key={`v${x}`} d={`M${x} 10V290`} />
                                ))}
                            </g>
                            <g strokeWidth="9">
                                {STREETS_MAJOR.h.map((y) => (
                                    <path key={`H${y}`} d={`M10 ${y}H390`} />
                                ))}
                                {STREETS_MAJOR.v.map((x) => (
                                    <path key={`V${x}`} d={`M${x} 10V290`} />
                                ))}
                                <path d="M10 280 L210 140" strokeWidth="7" />
                            </g>
                        </g>
                    </g>
                </g>

                {/* trees, back to front */}
                {[...TREES]
                    .sort((p, q) => p[1] - q[1])
                    .map((t) => (
                        <Tree key={`${t[0]}-${t[1]}`} at={t} />
                    ))}

                {/* route: faint guide, glow, and a trail that draws as the rider moves */}
                <path
                    d={ROUTE_D}
                    fill="none"
                    stroke="#1B5240"
                    strokeOpacity=".25"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="2 8"
                />
                <g>
                    {moving && (
                        <animate
                            attributeName="opacity"
                            values="1;1;0;0"
                            keyTimes="0;0.88;0.97;1"
                            dur={dur}
                            repeatCount="indefinite"
                        />
                    )}
                    <path
                        d={ROUTE_D}
                        pathLength="1"
                        fill="none"
                        stroke="#1B5240"
                        strokeOpacity=".35"
                        strokeWidth="10"
                        strokeLinecap="round"
                        filter="url(#rm-glow)"
                        strokeDasharray={moving ? '1 1' : '0.55 1'}
                        strokeDashoffset={moving ? 1 : 0}
                    >
                        {moving && (
                            <animate
                                attributeName="stroke-dashoffset"
                                values="1;0;0"
                                keyTimes="0;0.8;1"
                                dur={dur}
                                repeatCount="indefinite"
                            />
                        )}
                    </path>
                    <path
                        d={ROUTE_D}
                        pathLength="1"
                        fill="none"
                        stroke="#1B5240"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeDasharray={moving ? '1 1' : '0.55 1'}
                        strokeDashoffset={moving ? 1 : 0}
                    >
                        {moving && (
                            <animate
                                attributeName="stroke-dashoffset"
                                values="1;0;0"
                                keyTimes="0;0.8;1"
                                dur={dur}
                                repeatCount="indefinite"
                            />
                        )}
                    </path>
                </g>

                {/* start point */}
                <ellipse
                    cx={START[0]}
                    cy={START[1]}
                    rx="9"
                    ry="5"
                    fill="#FFFFFF"
                    stroke="#1B5240"
                    strokeWidth="2.5"
                />

                {/* destination: pulsing ripple and pin */}
                <ellipse
                    cx={DEST[0]}
                    cy={DEST[1]}
                    rx="26"
                    ry="10"
                    fill="#F28C28"
                    opacity=".15"
                />
                <ellipse
                    cx={DEST[0]}
                    cy={DEST[1]}
                    rx="16"
                    ry="6"
                    fill="#F28C28"
                    opacity=".25"
                >
                    {moving && (
                        <animate
                            attributeName="rx"
                            values="12;30"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    )}
                    {moving && (
                        <animate
                            attributeName="ry"
                            values="4.5;11"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    )}
                    {moving && (
                        <animate
                            attributeName="opacity"
                            values=".35;0"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    )}
                </ellipse>
                <ellipse
                    cx={DEST[0]}
                    cy={DEST[1]}
                    rx="5"
                    ry="2.2"
                    fill="#D9741A"
                />
                <g transform={`translate(${n(DEST[0])} ${n(DEST[1])})`}>
                    <g>
                        {moving && (
                            <animateTransform
                                attributeName="transform"
                                type="translate"
                                values="0 0;0 -4;0 0"
                                dur="1.6s"
                                repeatCount="indefinite"
                            />
                        )}
                        <path
                            d={PIN_PATH}
                            fill="#F28C28"
                            transform="translate(0 -4) scale(1.15)"
                        />
                        <circle cx="0" cy="-31.6" r="6" fill="#FFFFFF" />
                    </g>
                </g>

                {/* rider */}
                <g
                    transform={
                        moving
                            ? undefined
                            : `translate(${n(rest[0])} ${n(rest[1])})`
                    }
                >
                    {moving && (
                        <animateMotion
                            path={ROUTE_D}
                            dur={dur}
                            repeatCount="indefinite"
                            calcMode="linear"
                            keyPoints="0;1;1"
                            keyTimes="0;0.8;1"
                        />
                    )}
                    {moving && (
                        <animate
                            attributeName="opacity"
                            values="0;1;1;0;0"
                            keyTimes="0;0.04;0.88;0.97;1"
                            dur={dur}
                            repeatCount="indefinite"
                        />
                    )}
                    <g>
                        {moving && (
                            <animateTransform
                                attributeName="transform"
                                type="translate"
                                values="0 0;0 -1.5;0 0"
                                dur="0.5s"
                                repeatCount="indefinite"
                            />
                        )}
                        <Rider />
                    </g>
                </g>

                {/* floating status card */}
                <g transform="translate(40 24)">
                    {moving && (
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="40 24;40 19;40 24"
                            dur="5s"
                            repeatCount="indefinite"
                        />
                    )}
                    <rect
                        width="204"
                        height="58"
                        rx="18"
                        fill="#FFFFFF"
                        filter="url(#rm-soft)"
                    />
                    <path
                        d={PIN_PATH}
                        fill="#F28C28"
                        transform="translate(30 41) scale(.75)"
                    />
                    <circle cx="30" cy="23" r="4" fill="#FFFFFF" />
                    <text
                        x="54"
                        y="26"
                        fontSize="13"
                        fontWeight="700"
                        fill="#1A2B24"
                        fontFamily="Inter, Arial, sans-serif"
                    >
                        On the way...
                    </text>
                    <text
                        x="54"
                        y="43"
                        fontSize="10"
                        fill="#5F675D"
                        fontFamily="Inter, Arial, sans-serif"
                    >
                        Arriving in ~5 min
                    </text>
                    <path
                        d="M180 23 L186 29 L180 35"
                        fill="none"
                        stroke="#5F675D"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>
            </svg>
            <figcaption className="mx-auto mt-1 w-fit rounded-full bg-m-card/80 px-3 py-1 text-center text-xs text-m-body2">
                Illustration lang. Hindi live tracking.
            </figcaption>
        </figure>
    );
}

function Heading({ title, text }: { title: string; text?: string }) {
    return (
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-m-ink sm:text-3xl">
                {title}
            </h2>
            {text && (
                <p className="mt-3 leading-relaxed text-m-muted">{text}</p>
            )}
        </Reveal>
    );
}

function ItemCard({
    icon: Icon,
    title,
    text,
    delay = 0,
}: Item & { delay?: number }) {
    return (
        <Reveal delay={delay}>
            <article className={card}>
                <div className={iconBox}>
                    <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="mb-2 text-base font-semibold text-m-ink">
                    {title}
                </h3>
                <p className="text-sm leading-relaxed text-m-muted">{text}</p>
            </article>
        </Reveal>
    );
}

const perks: { icon: LucideIcon; label: string }[] = [
    { icon: Zap, label: 'Fast Booking' },
    { icon: ShieldCheck, label: 'Trusted Service' },
    { icon: Users, label: 'Better Mobility' },
];

export default function Welcome() {
    // Signed-in users get a shortcut to the dashboard for their role (decided on the server). Everyone else sees "Login".
    const { dashboardUrl } = usePage().props as {
        dashboardUrl?: string | null;
    };
    const loginHref = dashboardUrl ?? '/login';
    const loginLabel = dashboardUrl ? 'Dashboard' : 'Login';
    // Registration is guest-only on the server, so the button is hidden for signed-in users.
    const showRegister = !dashboardUrl;
    // "Book a Ride" is for customers (their booking page) and guests (the public /book page; they sign in when they book). Bikers and admins don't book.
    const isCustomer = !!dashboardUrl && dashboardUrl.startsWith('/customer');
    const showBook = showRegister || isCustomer;
    const bookHref = isCustomer ? '/customer/book' : '/book';
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState('home');
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) =>
                entries.forEach(
                    (e) => e.isIntersecting && setActive(e.target.id),
                ),
            { rootMargin: '-45% 0px -50% 0px' },
        );
        links.forEach((l) => {
            const el = document.getElementById(l.id);
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, []);

    const nav = (id: string) => {
        setOpen(false);
        goTo(id);
    };

    return (
        <>
            <Head title="Welcome">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700;1,900&display=swap"
                    rel="stylesheet"
                />
                <style>{`
                    html { scrollbar-width: none; }
                    html::-webkit-scrollbar { display: none; }
                    @media (prefers-reduced-motion: no-preference) {
                        html { scroll-behavior: smooth; }
                    }
                `}</style>
            </Head>
            <div
                className="min-h-screen bg-m-page text-m-body"
                style={{
                    fontFamily:
                        'Inter, Arial, ui-sans-serif, system-ui, sans-serif',
                }}
            >
                <TopBar
                    toggle={false}
                    className={scrolled ? 'shadow-sm' : ''}
                    left={
                        <>
                            <MigoBrand
                                onClick={() => nav('home')}
                                subtitle="Your Ride. Your Buddy."
                            />
                            <span
                                className="hidden h-12 w-px shrink-0 bg-m-line xl:block"
                                aria-hidden
                            />
                            <nav
                                className="hidden items-center gap-0.5 xl:flex"
                                aria-label="Main"
                            >
                                {links.map((l) => (
                                    <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => nav(l.id)}
                                        aria-current={
                                            active === l.id ? 'true' : undefined
                                        }
                                        className={navPill(active === l.id)}
                                    >
                                        {l.label}
                                    </button>
                                ))}
                            </nav>
                        </>
                    }
                    right={
                        <>
                            <div className="hidden items-center gap-2 xl:flex">
                                <Link
                                    href={loginHref}
                                    className={`inline-flex items-center gap-2 rounded-full border-2 border-m-accent px-4 py-2 text-sm font-semibold whitespace-nowrap text-m-accent transition hover:bg-m-mint ${focus}`}
                                >
                                    <UserRound className="size-4" aria-hidden />{' '}
                                    {loginLabel}
                                </Link>
                                {showRegister && (
                                    <Link
                                        href="/register/biker"
                                        className={`${btnAccent} !px-5 !py-2.5 whitespace-nowrap`}
                                    >
                                        <UserPlus
                                            className="size-4"
                                            aria-hidden
                                        />{' '}
                                        Become a Rider
                                    </Link>
                                )}
                            </div>
                            <ThemeToggle />
                            <button
                                type="button"
                                className={`rounded-md p-2 xl:hidden ${focus}`}
                                onClick={() => setOpen(!open)}
                                aria-expanded={open}
                                aria-label="Toggle menu"
                            >
                                {open ? (
                                    <X className="size-6" />
                                ) : (
                                    <Menu className="size-6" />
                                )}
                            </button>
                        </>
                    }
                    below={open && (
                        <nav
                            className="flex flex-col gap-1 border-t border-m-line bg-m-card px-5 pt-3 pb-5 xl:hidden"
                            aria-label="Mobile"
                        >
                            {links.map((l) => (
                                <button
                                    key={l.id}
                                    type="button"
                                    onClick={() => nav(l.id)}
                                    className={`rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-m-mint hover:text-m-accent ${active === l.id ? 'text-m-accent' : ''}`}
                                >
                                    {l.label}
                                </button>
                            ))}
                            <Link
                                href={loginHref}
                                className={`${showRegister ? btnOutline : btnPrimary} mt-2`}
                            >
                                {loginLabel}
                            </Link>
                            {showRegister && (
                                <Link
                                    href="/register/biker"
                                    className={btnAccent}
                                >
                                    Become a Rider / Driver
                                </Link>
                            )}
                        </nav>
                    )}
                />

                <main>
                    <section
                        id="home"
                        className="relative overflow-hidden bg-m-page2"
                    >
                        {/* background image */}
                        <div
                            aria-hidden
                            className="absolute inset-0 bg-no-repeat dark:brightness-[.4]"
                            style={{
                                backgroundImage: `url(${HERO_BG})`,
                                backgroundSize: '100% auto',
                                backgroundPosition: 'center bottom',
                            }}
                        />
                        {/* blend the top edge of the image into the cream background */}
                        <div
                            aria-hidden
                            className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-m-page2 to-transparent"
                        />
                        {/* soft cream wash on the left so the text stays readable */}
                        <div
                            aria-hidden
                            className="absolute inset-0 bg-gradient-to-r from-m-page2/90 via-m-page2/55 to-transparent"
                        />
                        {/* fade the bottom into the white About section */}
                        <div
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-m-card to-transparent"
                        />
                        {/* green and orange wave, bottom left */}
                        <svg
                            aria-hidden
                            viewBox="0 0 900 220"
                            preserveAspectRatio="none"
                            className="absolute bottom-0 left-0 hidden h-36 w-[60%] lg:block"
                        >
                            <path
                                d="M0 70 C120 150 300 205 520 215 L520 220 L0 220 Z"
                                fill="#F28C28"
                            />
                            <path
                                d="M0 120 C140 175 330 195 560 190 C700 188 820 205 900 220 L0 220 Z"
                                fill="#1B5240"
                            />
                        </svg>
                        {/* optional rider image, bottom right (hidden if /public/rider.png does not exist) */}
                        <img
                            src={HERO_RIDER}
                            alt=""
                            aria-hidden
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                            className="pointer-events-none absolute right-4 bottom-0 hidden w-[28%] max-w-md lg:block"
                        />

                        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-8 px-5 pt-8 pb-16 lg:min-h-[calc(100svh-73px)] lg:grid-cols-2 lg:gap-12 lg:px-8 lg:pt-8 lg:pb-10">
                            <div>
                                <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-m-mint px-4 py-2 text-sm font-semibold text-m-ink">
                                    <ShieldCheck
                                        className="size-5 text-m-accent"
                                        aria-hidden
                                    />{' '}
                                    Safe <span aria-hidden>&bull;</span>{' '}
                                    Reliable <span aria-hidden>&bull;</span> On
                                    Time
                                </p>
                                <h1 className="text-m-ink">
                                    <span className="block text-4xl font-extrabold sm:text-5xl">
                                        Welcome to
                                    </span>
                                    <span className="block">
                                        <img
                                            src={WELCOME_LOGO}
                                            alt="Migo. Your Ride. Your Buddy."
                                            className="mt-1 mb-3 -ml-2 h-auto w-full max-w-sm mix-blend-multiply dark:mix-blend-screen dark:invert dark:hue-rotate-180"
                                        />
                                    </span>
                                </h1>
                                <p className="max-w-lg text-lg leading-relaxed text-m-body2">
                                    Connecting passengers, senders, riders, and
                                    drivers through a convenient, reliable, and
                                    organized ride and padala service. Mas
                                    madali, mas maaasahan, at mas organisado.
                                </p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    {showBook && (
                                        <Link
                                            href={bookHref}
                                            className={btnAccent}
                                        >
                                            <Bike
                                                className="size-4"
                                                aria-hidden
                                            />{' '}
                                            Book a Ride{' '}
                                            <ChevronRight
                                                className="size-4"
                                                aria-hidden
                                            />
                                        </Link>
                                    )}
                                    {showRegister && (
                                        <Link
                                            href="/register/biker"
                                            className={btnOutline}
                                        >
                                            <UserPlus
                                                className="size-4"
                                                aria-hidden
                                            />{' '}
                                            Become a Rider / Driver{' '}
                                            <ChevronRight
                                                className="size-4"
                                                aria-hidden
                                            />
                                        </Link>
                                    )}
                                    {!showBook && (
                                        <button
                                            type="button"
                                            onClick={() => goTo('about')}
                                            className={btnOutline}
                                        >
                                            Learn More{' '}
                                            <ChevronRight
                                                className="size-4"
                                                aria-hidden
                                            />
                                        </button>
                                    )}
                                </div>
                                <ul className="mt-6 inline-flex max-w-full flex-wrap items-center gap-y-3 rounded-3xl bg-m-card/90 px-4 py-4 shadow-sm sm:flex-nowrap sm:rounded-full sm:px-4">
                                    {perks.map(({ icon: Icon, label }, i) => (
                                        <li
                                            key={label}
                                            className={`flex items-center gap-3 px-3 text-sm font-medium whitespace-nowrap text-m-ink sm:px-5 ${i > 0 ? 'sm:border-l sm:border-m-line' : ''}`}
                                        >
                                            <Icon
                                                className="size-6 text-m-accent"
                                                aria-hidden
                                            />{' '}
                                            {label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <RideMap />
                        </div>
                    </section>

                    <section id="about" className="scroll-mt-16 bg-m-card py-16">
                        <div className="mx-auto max-w-7xl px-5 lg:px-8">
                            <Heading
                                title="About Migo"
                                text="Migo is a ride and padala service that connects passengers and senders with accredited riders and drivers, by motorcycle or by car. Ang Migo ang nag-aayos ng rider accreditation, passenger records, real-time dispatch, at customer concerns para sa mga passenger, rider, at administrator."
                            />
                            <div className="grid gap-6 md:grid-cols-3">
                                {audiences.map(
                                    ({ icon: Icon, title, points }, i) => (
                                        <Reveal key={title} delay={i * 120}>
                                            <article className={card}>
                                                <div className={iconBox}>
                                                    <Icon
                                                        className="size-5"
                                                        aria-hidden
                                                    />
                                                </div>
                                                <h3 className="mb-3 text-base font-semibold text-m-ink">
                                                    {title}
                                                </h3>
                                                <ul className="space-y-2 text-sm leading-relaxed text-m-muted">
                                                    {points.map((p) => (
                                                        <li
                                                            key={p}
                                                            className="flex gap-2"
                                                        >
                                                            <span
                                                                className="mt-2 size-1.5 shrink-0 rounded-full bg-[#F28C28]"
                                                                aria-hidden
                                                            />
                                                            {p}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </article>
                                        </Reveal>
                                    ),
                                )}
                            </div>
                        </div>
                    </section>
                    <WaveDivider from="var(--m-card)" to="var(--m-page)" flip />

                    <section id="services" className="scroll-mt-16 py-16">
                        <div className="mx-auto max-w-7xl px-5 lg:px-8">
                            <Heading
                                title="Services"
                                text="Ano ang ginagawa ng Migo system para sa riders, drivers, passengers, at administrators. Ang ilang modules ay ginagawa pa in phases."
                            />
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                {services.map((s, i) => (
                                    <ItemCard
                                        key={s.title}
                                        {...s}
                                        delay={i * 100}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>
                    <WaveDivider from="var(--m-page)" to="var(--m-mint)" />

                    <section
                        id="passenger-guide"
                        className="scroll-mt-16 bg-m-mint py-16"
                    >
                        <div className="mx-auto max-w-7xl px-5 lg:px-8">
                            <Heading
                                title="Passenger Guide"
                                text="Apat lang ang steps para mag-book ng ride o padala sa Migo."
                            />
                            <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                {steps.map(({ icon: Icon, title, text }, i) => (
                                    <Reveal as="li" key={title} delay={i * 100}>
                                        <div className={card}>
                                            <span className="mb-4 flex size-9 items-center justify-center rounded-full bg-m-forest text-sm font-bold text-white">
                                                {i + 1}
                                            </span>
                                            <Icon
                                                className="mb-3 size-5 text-[#F28C28]"
                                                aria-hidden
                                            />
                                            <h3 className="mb-2 text-base font-semibold text-m-ink">
                                                {title}
                                            </h3>
                                            <p className="text-sm leading-relaxed text-m-muted">
                                                {text}
                                            </p>
                                        </div>
                                    </Reveal>
                                ))}
                            </ol>
                            {showBook && (
                                <div className="mt-10 flex flex-wrap justify-center gap-3">
                                    <Link href={bookHref} className={btnAccent}>
                                        <Bike className="size-4" aria-hidden />{' '}
                                        Book a Ride
                                    </Link>
                                </div>
                            )}
                        </div>
                    </section>
                    <WaveDivider from="var(--m-mint)" to="var(--m-page)" flip />

                    <section
                        id="biker-information"
                        className="scroll-mt-16 py-16"
                    >
                        <div className="mx-auto max-w-7xl px-5 lg:px-8">
                            <Heading
                                title="Rider Information"
                                text="General information para sa riders at drivers na gustong mag-drive with Migo."
                            />
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                {bikerInfo.map((b, i) => (
                                    <ItemCard
                                        key={b.title}
                                        {...b}
                                        delay={i * 100}
                                    />
                                ))}
                            </div>
                            <p
                                role="note"
                                className="mx-auto mt-8 max-w-3xl rounded-xl border border-m-line bg-m-card p-4 text-sm text-m-muted"
                            >
                                Ang mga bagong rider account ay kailangang
                                ma-approve ng administrator at makumpleto ang
                                accreditation process (document verification,
                                orientation, vehicle inspection) bago
                                makatanggap ng ride o padala requests.
                            </p>
                            <div className="mt-8 flex flex-wrap justify-center gap-3">
                                {showRegister && (
                                    <Link
                                        href="/register/biker"
                                        className={btnAccent}
                                    >
                                        <Bike className="size-4" aria-hidden />{' '}
                                        Become a Rider / Driver
                                    </Link>
                                )}
                                <Link
                                    href={loginHref}
                                    className={
                                        showRegister ? btnOutline : btnPrimary
                                    }
                                >
                                    {loginLabel}
                                </Link>
                            </div>
                        </div>
                    </section>
                    <WaveDivider from="var(--m-page)" to="var(--m-card)" />

                    <section
                        id="support"
                        className="scroll-mt-16 bg-m-card py-16"
                    >
                        <div className="mx-auto max-w-7xl px-5 lg:px-8">
                            <Heading
                                title="Customer Support"
                                text="Pwedeng makipag-ugnayan ang passengers, riders, at drivers sa Migo team sa pamamagitan ng email."
                            />
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                {supportTopics.map((s, i) => (
                                    <ItemCard
                                        key={s.title}
                                        {...s}
                                        delay={i * 100}
                                    />
                                ))}
                            </div>
                            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                                <a
                                    href={`mailto:${SUPPORT_EMAIL}`}
                                    className={btnPrimary}
                                >
                                    <Mail className="size-4" aria-hidden />{' '}
                                    {SUPPORT_EMAIL}
                                </a>
                            </div>
                        </div>
                    </section>
                    <WaveDivider from="var(--m-card)" to="var(--m-deep)" flip />
                </main>

                <footer className="bg-m-deep py-10 text-sm text-white/75">
                    <div className="mx-auto max-w-7xl px-5 lg:px-8">
                        <div className="mb-6 flex items-center gap-3 text-white">
                            <img
                                src={ICON}
                                alt=""
                                className="size-9 rounded-lg object-contain"
                            />
                            <span className="text-base font-extrabold tracking-wide uppercase italic">
                                Migo
                            </span>
                        </div>
                        <nav
                            aria-label="Footer"
                            className="flex flex-wrap gap-x-6 gap-y-2"
                        >
                            <button
                                type="button"
                                onClick={() => goTo('about')}
                                className={`rounded hover:text-white ${focus}`}
                            >
                                About
                            </button>
                            <button
                                type="button"
                                onClick={() => goTo('support')}
                                className={`rounded hover:text-white ${focus}`}
                            >
                                Customer Support
                            </button>
                            <Link
                                href="/privacy"
                                className={`rounded hover:text-white ${focus}`}
                            >
                                Privacy Policy
                            </Link>
                            <Link
                                href="/terms"
                                className={`rounded hover:text-white ${focus}`}
                            >
                                Terms and Conditions
                            </Link>
                        </nav>
                        <p className="mt-6 max-w-3xl leading-relaxed">
                            Disclaimer: Ang Migo ay isang proposed academic
                            project na ginawa para sa pag-aaral at
                            demonstration.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                            <p className="text-white/60">
                                © {new Date().getFullYear()} Migo (proposed
                                academic project). All rights reserved.
                            </p>
                            <Link
                                href="/admin/login"
                                className={`rounded text-xs text-white/40 transition hover:text-white/80 ${focus}`}
                            >
                                Admin Login
                            </Link>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}