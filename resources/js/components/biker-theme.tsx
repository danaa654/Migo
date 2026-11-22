import { ThemeToggle } from '@/components/theme-toggle';

/**
 * The Biker pages use their own --b-* names. They now just point at the app-wide --m-* palette
 * (defined in app.css, light and dark), so the whole app switches together.
 */
const CSS = `
:root{
  --b-page:var(--m-page); --b-page2:var(--m-page2); --b-card:var(--m-card);
  --b-line:var(--m-line); --b-line2:var(--m-line2);
  --b-ink:var(--m-ink); --b-body:var(--m-body); --b-body2:var(--m-body2); --b-muted:var(--m-muted); --b-faint:var(--m-faint);
  --b-mint:var(--m-mint); --b-forest:var(--m-forest); --b-accent:var(--m-accent);
  --b-greentext:var(--m-greentext); --b-amber:var(--m-amber); --b-redtext:var(--m-redtext); --b-pin:var(--m-pin);
}
`;

/** Renders the --b-* aliases. Include once per page (the Biker shell does this). */
export function BikerThemeStyles() {
    return <style>{CSS}</style>;
}

export { ThemeToggle };
