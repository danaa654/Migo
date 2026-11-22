import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

export const ring =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent';

/** Pill used for the active / inactive links of every top-level navigation (welcome, customer, biker). */
export const navPill = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition ${ring} ${
        active
            ? 'bg-m-forest text-white'
            : 'text-m-body hover:bg-m-mint hover:text-m-accent'
    }`;

type BrandProps = {
    /** Small line under the name: the tagline or the portal name ("Customer", "Biker Dashboard"...). */
    subtitle?: string;
    /** Where the brand links to. Ignored when `onClick` is given. */
    href?: string;
    onClick?: () => void;
    /** Hide the subtitle on very small screens. */
    hideSubtitleOnMobile?: boolean;
    label?: string;
};

/** The one Migo logo + wordmark used by every page. */
export function MigoBrand({
    subtitle,
    href = '/',
    onClick,
    hideSubtitleOnMobile = false,
    label = 'Migo home',
}: BrandProps) {
    const inner = (
        <span className="flex items-center gap-3">
            <img src="/favi.png" alt="" className="size-9 object-contain" />
            <span className="leading-tight">
                <span className="block text-base font-bold tracking-wide text-m-accent">
                    MIGO
                </span>
                {subtitle && (
                    <span
                        className={`${hideSubtitleOnMobile ? 'hidden sm:block' : 'block'} text-[10px] font-medium tracking-wide whitespace-nowrap text-m-muted uppercase`}
                    >
                        {subtitle}
                    </span>
                )}
            </span>
        </span>
    );
    const cls = `shrink-0 rounded text-left ${ring}`;

    return onClick ? (
        <button
            type="button"
            onClick={onClick}
            className={cls}
            aria-label={label}
        >
            {inner}
        </button>
    ) : (
        <Link href={href} className={cls} aria-label={label}>
            {inner}
        </Link>
    );
}

type BarProps = {
    /** Left side: normally <MigoBrand /> plus optional desktop links. */
    left: ReactNode;
    /** Right side actions. The theme toggle is added for you, last-but-one position is up to the caller. */
    right?: ReactNode;
    /** Row under the bar (mobile menu, tab links). */
    below?: ReactNode;
    /** Container width, e.g. "max-w-7xl", "max-w-5xl", "max-w-3xl" or "max-w-none". */
    width?: string;
    sticky?: boolean;
    /** Put the theme toggle before (default) or after `right`. */
    toggle?: boolean;
    className?: string;
};

/** Shared top bar chrome: same height, border, background and theme toggle on every page. */
export function TopBar({
    left,
    right,
    below,
    width = 'max-w-7xl',
    sticky = true,
    toggle = true,
    className = '',
}: BarProps) {
    return (
        <header
            className={`${sticky ? 'sticky top-0 z-40' : ''} border-b border-m-line bg-m-card/95 backdrop-blur transition-shadow duration-300 ${className}`}
        >
            <div
                className={`mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-5 ${width}`}
            >
                <div className="flex min-w-0 items-center gap-4 xl:gap-6">
                    {left}
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    {right}
                    {toggle && <ThemeToggle />}
                </div>
            </div>
            {below}
        </header>
    );
}
