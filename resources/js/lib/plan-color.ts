import type { CSSProperties } from 'react';

/** Colours an admin can pick with one click. Any other #RRGGBB works too (the custom picker). */
export const PLAN_PRESETS: { name: string; hex: string }[] = [
    { name: 'Yellow', hex: '#F5C542' },
    { name: 'Blue', hex: '#2C4F73' },
    { name: 'Black', hex: '#171717' },
    { name: 'Green', hex: '#1B7F5C' },
    { name: 'Teal', hex: '#0E8A8A' },
    { name: 'Purple', hex: '#6D3FC0' },
    { name: 'Red', hex: '#C0392B' },
    { name: 'Orange', hex: '#E8731A' },
];

/** Used while a plan has no colour saved: the original look by name, then the same three colours in turn. */
const BY_NAME: Record<string, string> = { basic: '#F5C542', standard: '#2C4F73', premium: '#171717' };
const FALLBACK = ['#F5C542', '#2C4F73', '#171717'];

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** The colour to use for a plan: the saved one, else by name (basic / standard / premium), else cycled by position. */
export function colorFor(name: string | null | undefined, saved?: string | null, index = 0): string {
    if (isHex(saved)) return saved;
    const n = (name ?? '').toLowerCase();
    const k = Object.keys(BY_NAME).find((x) => n.includes(x));

    return k ? BY_NAME[k]! : FALLBACK[index % FALLBACK.length]!;
}

type RGB = [number, number, number];
const toRgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const toHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const mix = (hex: string, with_: RGB, t: number): string => {
    const c = toRgb(hex);

    return toHex([c[0] + (with_[0] - c[0]) * t, c[1] + (with_[1] - c[1]) * t, c[2] + (with_[2] - c[2]) * t]);
};
const lighten = (hex: string, t: number) => mix(hex, [255, 255, 255], t);
const darken = (hex: string, t: number) => mix(hex, [0, 0, 0], t);
const luminance = (hex: string) => {
    const f = (v: number) => {
        const s = v / 255;

        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = toRgb(hex);

    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export type PlanStyle = {
    /** Spread onto a card: gradient background, readable text colour and a thin edge. */
    card: CSSProperties;
    /** True when the card is dark (so text is white). */
    onDark: boolean;
    text: string;
    /** Translucent panel on top of the card. */
    soft: string;
    track: string;
    bar: string;
    accent: string;
    edge: string;
    /** The plain colour, for dots and small bars on a normal (light or dark) page. */
    solid: string;
    /** Small "Current plan" pill that stands out on the card. */
    pill: CSSProperties;
    /** Small chip for tables: solid colour with readable text. */
    chip: CSSProperties;
};

/** Everything a card needs, worked out from one colour. Text turns dark or white by the colour's brightness. */
export function planStyle(hex: string): PlanStyle {
    const light = luminance(hex) > 0.35;
    const text = light ? darken(hex, 0.78) : '#FFFFFF';
    const edge = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)';

    return {
        card: {
            background: `linear-gradient(135deg, ${lighten(hex, 0.28)} 0%, ${hex} 50%, ${darken(hex, 0.3)} 100%)`,
            color: text,
            boxShadow: `0 0 0 1px ${edge}`,
        },
        onDark: !light,
        text,
        soft: light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.15)',
        track: light ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.22)',
        bar: light ? darken(hex, 0.5) : lighten(hex, 0.6),
        accent: light ? darken(hex, 0.45) : lighten(hex, 0.65),
        edge,
        solid: hex,
        pill: light ? { background: darken(hex, 0.7), color: '#FFFFFF' } : { background: lighten(hex, 0.7), color: darken(hex, 0.7) },
        chip: { background: hex, color: light ? darken(hex, 0.78) : '#FFFFFF' },
    };
}
