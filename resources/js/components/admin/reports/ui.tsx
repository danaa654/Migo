import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shared look for every Reports tab. Mirrors the Subscription Management redesign (rounded-2xl cards, icon KPIs, gradient bars). */
export const box = 'rounded-2xl border border-m-line bg-m-card shadow-sm';
export const th = 'px-3 py-2 text-[11px] font-semibold tracking-wide text-m-muted uppercase';

export const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pesoShort = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n}%`);
export const mins = (n: number | null) => (n === null ? '—' : `${n} min`);

/** 0.4 -> "24 min", 5.5 -> "5.5 h", 72 -> "3 days". */
export function hoursText(h: number | null | undefined): string {
    if (h === null || h === undefined) return '—';
    if (h < 1) return `${Math.round(h * 60)} min`;
    if (h < 48) return `${Math.round(h * 10) / 10} h`;

    return `${Math.round((h / 24) * 10) / 10} days`;
}

export function dayLabel(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);

    return new Date(y!, m! - 1, d!).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export type Tone = 'default' | 'good' | 'warn' | 'alert';
const TONE: Record<Tone, string> = {
    default: 'bg-m-mint text-m-forest',
    good: 'bg-emerald-100 text-emerald-700',
    warn: 'bg-amber-100 text-amber-700',
    alert: 'bg-red-100 text-red-700',
};

/** "+12% vs previous" style line. `lowerIsBetter` flips the colours (cancellations, failures). */
export function Delta({ now, before, lowerIsBetter = false }: { now: number; before: number; lowerIsBetter?: boolean }) {
    if (before === 0) {
        return <span className="text-m-muted">{now === 0 ? 'no change' : 'new this period'}</span>;
    }
    const p = Math.round(((now - before) / before) * 100);
    const good = lowerIsBetter ? p < 0 : p > 0;
    const colour = p === 0 ? 'text-m-muted' : good ? 'text-emerald-700' : 'text-red-700';

    return (
        <span className={colour}>
            {p > 0 ? '+' : ''}
            {p}% <span className="text-m-muted">vs previous</span>
        </span>
    );
}

export function Kpi({ icon: Icon, label, value, note, tone = 'default' }: { icon: LucideIcon; label: string; value: string | number; note?: ReactNode; tone?: Tone }) {
    return (
        <div className={`${box} flex items-center gap-3 p-4`}>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TONE[tone]}`}>
                <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
                <p className="text-xs font-medium text-m-muted">{label}</p>
                <p className="truncate text-2xl leading-tight font-extrabold text-m-ink">{value}</p>
                {note && <p className="text-xs text-m-muted">{note}</p>}
            </div>
        </div>
    );
}

export function Panel({ title, icon: Icon, aside, className = '', children }: { title: string; icon?: LucideIcon; aside?: ReactNode; className?: string; children: ReactNode }) {
    return (
        <section className={`${box} p-5 ${className}`} aria-label={title}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-m-ink">
                    {Icon && <Icon className="size-4 text-m-forest" aria-hidden />} {title}
                </h2>
                {aside && <span className="text-xs text-m-muted">{aside}</span>}
            </div>
            {children}
        </section>
    );
}

export function Row({ k, v }: { k: string; v: ReactNode }) {
    return (
        <div className="flex justify-between gap-3 text-sm">
            <dt className="text-m-muted">{k}</dt>
            <dd className="font-semibold text-m-ink">{v}</dd>
        </div>
    );
}

export function Empty({ text }: { text: string }) {
    return <p className="py-8 text-center text-sm text-m-muted">{text}</p>;
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
    return (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-m-muted">
            {items.map((i) => (
                <span key={i.name} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: i.color }} /> {i.name}
                </span>
            ))}
        </div>
    );
}

/**
 * One column per day, optionally stacked. `rows[i].parts[j]` is series j on day i; colours/names line up with `j`.
 * Plain CSS, so no chart library is needed.
 */
export function DailyBars({
    rows,
    colors,
    names,
    format = (n) => String(n),
    height = 'h-44',
    title,
}: {
    rows: { label: string; parts: number[] }[];
    colors: string[];
    names: string[];
    format?: (n: number) => string;
    height?: string;
    title: string;
}) {
    const totals = rows.map((r) => r.parts.reduce((a, b) => a + b, 0));
    const max = Math.max(...totals, 0);
    if (rows.length === 0 || max === 0) return <Empty text="Nothing recorded in this range." />;

    return (
        <div>
            <p className="mb-1 text-[11px] text-m-muted">Peak day: {format(max)}</p>
            <div className={`flex ${height} items-end gap-px`} role="img" aria-label={title}>
                {rows.map((r, i) => {
                    const total = totals[i]!;

                    return (
                        <div
                            key={r.label}
                            className="flex h-full min-w-[3px] flex-1 flex-col justify-end"
                            title={`${dayLabel(r.label)}\n${names.map((n, j) => `${n}: ${format(r.parts[j] ?? 0)}`).join('\n')}`}
                        >
                            {total > 0 && (
                                <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-[3px]" style={{ height: `${(total / max) * 100}%`, minHeight: 3 }}>
                                    {r.parts.map((v, j) => v > 0 && <div key={j} style={{ height: `${(v / total) * 100}%`, background: colors[j] }} />)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-m-muted">
                <span>{dayLabel(rows[0]!.label)}</span>
                <span>{dayLabel(rows[rows.length - 1]!.label)}</span>
            </div>
        </div>
    );
}

/** A label, a value and a thin proportional bar underneath. */
export function Meter({ label, value, share, color, right }: { label: string; value: ReactNode; share: number; color?: string; right?: ReactNode }) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-m-ink">{label}</span>
                <span className="shrink-0 font-semibold text-m-ink">
                    {value}
                    {right && <span className="ml-2 text-xs font-normal text-m-muted">{right}</span>}
                </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-m-line/60">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, share))}%`, background: color ?? 'var(--m-forest)', minWidth: share > 0 ? 4 : 0 }} />
            </div>
        </div>
    );
}

/** Two or three segments of one whole, e.g. repeat vs one-time bookers. */
export function SplitBar({ parts }: { parts: { name: string; value: number; color: string }[] }) {
    const total = parts.reduce((a, p) => a + p.value, 0);
    if (total === 0) return <Empty text="Nothing recorded in this range." />;

    return (
        <div>
            <div className="flex h-3 overflow-hidden rounded-full bg-m-line/60">
                {parts.map((p) => (p.value > 0 ? <div key={p.name} title={`${p.name}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} /> : null))}
            </div>
            <div className="mt-3 grid gap-2 text-sm" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
                {parts.map((p) => (
                    <div key={p.name}>
                        <p className="flex items-center gap-1.5 text-xs text-m-muted">
                            <span className="size-2.5 rounded-sm" style={{ background: p.color }} /> {p.name}
                        </p>
                        <p className="text-lg font-extrabold text-m-ink">{p.value}</p>
                        <p className="text-xs text-m-muted">{Math.round((p.value / total) * 100)}%</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function Pill({ children, className }: { children: ReactNode; className: string }) {
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}
