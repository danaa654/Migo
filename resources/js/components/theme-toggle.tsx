import { Moon, Sun } from 'lucide-react';
import { useAppearance } from '@/hooks/use-appearance';

/** Sun/Moon button that switches between light and dark mode. Same look in every top bar. */
export function ThemeToggle({ className = '' }: { className?: string }) {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const dark = resolvedAppearance === 'dark';

    return (
        <button
            type="button"
            onClick={() => updateAppearance(dark ? 'light' : 'dark')}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border border-m-line bg-m-card text-m-accent transition hover:bg-m-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent ${className}`}
        >
            {dark ? (
                <Sun className="size-5" aria-hidden />
            ) : (
                <Moon className="size-5" aria-hidden />
            )}
        </button>
    );
}
