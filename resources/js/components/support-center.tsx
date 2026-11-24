import { useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    LifeBuoy,
    MessageSquareWarning,
    Search,
    TriangleAlert,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';

export type SupportReport = {
    id: string;
    type: 'complaint' | 'support' | 'incident';
    type_label: string;
    category: string;
    description: string;
    status: string;
    response: string | null;
    resolved_at: string | null;
    created_at: string | null;
    occurred_at: string | null;
    location: string | null;
    trip: { reference: string | null; party: string | null } | null;
};
export type SupportBooking = {
    id: string;
    reference: string | null;
    service: string | null;
    party: string | null;
    created_at: string | null;
};
type Option = { key: string; label: string };
export type SupportCenterProps = {
    variant: 'customer' | 'biker';
    postUrl: string;
    reports: SupportReport[];
    bookings: SupportBooking[];
    types: (Option & { hint: string })[];
    categories: Record<string, Option[]>;
    preselect: string | null;
    openCount: number;
    maxOpen: number;
    partyLabel: string;
    tripRequiredForComplaint: boolean;
};

/** The customer pages use the m-* tokens, the biker pages use the --b-* variables. */
const themes = {
    customer: {
        card: 'rounded-lg border border-m-line bg-m-card p-5 shadow-sm sm:p-6',
        control:
            'w-full rounded-md border bg-m-card px-3 py-2.5 text-sm outline-none transition-colors focus:border-m-accent focus:ring-2 focus:ring-m-accent/20',
        line: 'border-m-line',
        divide: 'divide-m-line',
        ink: 'text-m-ink',
        muted: 'text-m-muted',
        mintIcon: 'bg-m-mint text-m-accent',
        inner: 'border-m-line bg-m-page',
        pick: 'border-m-accent bg-m-mint',
        notice: 'border-m-line bg-m-mint text-m-ink',
        btn: 'rounded-md bg-m-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-m-forest-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent',
    },
    biker: {
        card: 'rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] p-5 shadow-sm sm:p-6',
        control:
            'w-full rounded-md border bg-[var(--b-card)] px-3 py-2.5 text-sm text-[var(--b-body)] outline-none transition-colors focus:border-[var(--b-accent)] focus:ring-2 focus:ring-[var(--b-accent)]/20',
        line: 'border-[var(--b-line)]',
        divide: 'divide-[var(--b-line)]',
        ink: 'text-[var(--b-ink)]',
        muted: 'text-[var(--b-muted)]',
        mintIcon: 'bg-[var(--b-mint)] text-[var(--b-accent)]',
        inner: 'border-[var(--b-line)] bg-[var(--b-page)]',
        pick: 'border-[var(--b-accent)] bg-[var(--b-mint)]',
        notice: 'border-[var(--b-line)] bg-[var(--b-mint)] text-[var(--b-ink)]',
        btn: 'rounded-md bg-m-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-m-forest-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--b-accent)]',
    },
} as const;

const MAX_LEN = 2000;

const statusInfo: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
    pending: { label: 'Received', tone: 'bg-[#F59E0B]/10 text-m-amber', icon: Clock },
    under_investigation: { label: 'In review', tone: 'bg-[#7C3AED]/10 text-m-purple', icon: Search },
    resolved: { label: 'Resolved', tone: 'bg-m-green/10 text-m-green', icon: CheckCircle2 },
    rejected: { label: 'Not accepted', tone: 'bg-m-red/10 text-m-red', icon: XCircle },
};
const typeTone: Record<string, string> = {
    complaint: 'bg-[#F59E0B]/10 text-m-amber',
    support: 'bg-[#2563EB]/10 text-[#2563EB]',
    incident: 'bg-m-red/10 text-m-red',
};
const typeIcon = { complaint: MessageSquareWarning, support: LifeBuoy, incident: TriangleAlert } as const;

const when = (s: string | null) =>
    s ? new Date(s).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '';

/** Value for <input type="datetime-local"> in the visitor's own time zone. */
const localNow = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

/**
 * One page for the three kinds of report. The server decides everything that matters (who the report is against,
 * limits, access); this component only shows the right fields for the chosen type.
 */
export default function SupportCenter({
    variant,
    postUrl,
    reports,
    bookings,
    types,
    categories,
    preselect,
    openCount,
    maxOpen,
    partyLabel,
    tripRequiredForComplaint,
}: SupportCenterProps) {
    const t = themes[variant];
    const [maxLocal] = useState(localNow);
    const form = useForm({
        type: preselect ? 'complaint' : '',
        category: '',
        booking_id: preselect ?? '',
        occurred_at: '',
        incident_location: '',
        description: '',
    });
    const errors = form.errors as Record<string, string | undefined>;
    const type = form.data.type;
    const isIncident = type === 'incident';
    const tripRequired = type === 'complaint' && tripRequiredForComplaint;
    const atLimit = openCount >= maxOpen && type !== 'incident';

    form.transform((d) => ({
        ...d,
        occurred_at: d.occurred_at ? new Date(d.occurred_at).toISOString() : '',
    }));

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post(postUrl, {
            preserveScroll: true,
            onSuccess: () =>
                form.setData({
                    type: '',
                    category: '',
                    booking_id: '',
                    occurred_at: '',
                    incident_location: '',
                    description: '',
                }),
        });
    }

    const err = (k: string) =>
        errors[k] ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-m-redtext">
                {errors[k]}
            </p>
        ) : null;
    const border = (k: string) => (errors[k] ? 'border-m-red' : t.line);
    const label = `mb-1.5 block text-sm font-medium ${t.ink}`;

    return (
        <>
            <section className={t.card}>
                <h2 className={`text-lg font-bold ${t.ink}`}>Support Center</h2>
                <p className={`mt-0.5 text-sm ${t.muted}`}>
                    One place for everything: report a problem with a {partyLabel.toLowerCase()}, ask for help, or
                    report an accident or safety concern. Our support team reviews every report and you will see
                    the result here.
                </p>
            </section>

            {openCount >= maxOpen && (
                <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${t.notice}`}>
                    You have {openCount} reports waiting for review. You can send another complaint or support
                    request once the support team responds to one of them. Incident reports are never blocked.
                </p>
            )}

            <form onSubmit={submit} className={t.card} noValidate>
                <h3 className={`text-base font-semibold ${t.ink}`}>New report</h3>

                <fieldset className="mt-4">
                    <legend className={label}>
                        What do you want to send? <span className="text-m-red">*</span>
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {types.map((o) => {
                            const Icon = typeIcon[o.key as keyof typeof typeIcon];
                            const on = type === o.key;
                            return (
                                <label
                                    key={o.key}
                                    className={`flex cursor-pointer flex-col rounded-md border px-3 py-2.5 text-sm ${on ? t.pick : t.line}`}
                                >
                                    <span className={`flex items-center gap-2 font-medium ${t.ink}`}>
                                        <input
                                            type="radio"
                                            name="report-type"
                                            value={o.key}
                                            checked={on}
                                            onChange={() => {
                                                form.setData((d) => ({ ...d, type: o.key, category: '' }));
                                                form.clearErrors();
                                            }}
                                        />
                                        <Icon className="size-4" aria-hidden />
                                        {o.label}
                                    </span>
                                    <span className={`mt-0.5 text-xs ${t.muted}`}>{o.hint}</span>
                                </label>
                            );
                        })}
                    </div>
                    {err('type')}
                </fieldset>

                {type && (
                    <>
                        {isIncident && (
                            <p role="note" className="mt-4 rounded-md border border-m-red/30 bg-m-red/5 px-3 py-2 text-sm text-m-redtext">
                                If someone is in immediate danger, call 911 first. Then tell us what happened so
                                our team can follow up.
                            </p>
                        )}

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <label htmlFor="report-category" className={label}>
                                    {type === 'support' ? 'What do you need help with?' : 'What happened?'}{' '}
                                    <span className="text-m-red">*</span>
                                </label>
                                <select
                                    id="report-category"
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                    aria-invalid={!!errors.category}
                                    className={`${t.control} ${border('category')}`}
                                >
                                    <option value="">Choose one…</option>
                                    {(categories[type] ?? []).map((c) => (
                                        <option key={c.key} value={c.key}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                                {err('category')}
                            </div>

                            <div>
                                <label htmlFor="report-booking" className={label}>
                                    Which trip?{' '}
                                    {tripRequired ? (
                                        <span className="text-m-red">*</span>
                                    ) : (
                                        <span className={`font-normal ${t.muted}`}>(optional)</span>
                                    )}
                                </label>
                                <select
                                    id="report-booking"
                                    value={form.data.booking_id}
                                    onChange={(e) => form.setData('booking_id', e.target.value)}
                                    aria-invalid={!!errors.booking_id}
                                    className={`${t.control} ${border('booking_id')}`}
                                >
                                    <option value="">{tripRequired ? 'Choose a trip…' : 'Not about a specific trip'}</option>
                                    {bookings.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {[
                                                when(b.created_at).split(',').slice(0, 2).join(','),
                                                b.service,
                                                b.party ? `${partyLabel} ${b.party}` : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </option>
                                    ))}
                                </select>
                                {errors.booking_id ? (
                                    err('booking_id')
                                ) : (
                                    <p className={`mt-1.5 text-xs ${t.muted}`}>
                                        {type === 'support'
                                            ? 'Optional. Support requests never name anyone.'
                                            : bookings.length === 0
                                              ? 'Your completed trips will appear here.'
                                              : `Pick the trip so we know which ${partyLabel.toLowerCase()} this is about.`}
                                    </p>
                                )}
                            </div>
                        </div>

                        {isIncident && (
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                    <label htmlFor="report-when" className={label}>
                                        When did it happen? <span className="text-m-red">*</span>
                                    </label>
                                    <input
                                        id="report-when"
                                        type="datetime-local"
                                        max={maxLocal}
                                        value={form.data.occurred_at}
                                        onChange={(e) => form.setData('occurred_at', e.target.value)}
                                        aria-invalid={!!errors.occurred_at}
                                        className={`${t.control} ${border('occurred_at')}`}
                                    />
                                    {err('occurred_at')}
                                </div>
                                <div>
                                    <label htmlFor="report-where" className={label}>
                                        Where did it happen? <span className="text-m-red">*</span>
                                    </label>
                                    <input
                                        id="report-where"
                                        type="text"
                                        maxLength={255}
                                        value={form.data.incident_location}
                                        onChange={(e) => form.setData('incident_location', e.target.value)}
                                        aria-invalid={!!errors.incident_location}
                                        placeholder="Street, landmark or barangay"
                                        className={`${t.control} ${border('incident_location')}`}
                                    />
                                    {err('incident_location')}
                                </div>
                            </div>
                        )}

                        <div className="mt-4">
                            <label htmlFor="report-description" className={label}>
                                {type === 'support' ? 'Tell us how we can help' : 'Tell us what happened'}{' '}
                                <span className="text-m-red">*</span>
                            </label>
                            <textarea
                                id="report-description"
                                rows={5}
                                maxLength={MAX_LEN}
                                value={form.data.description}
                                onChange={(e) => form.setData('description', e.target.value)}
                                aria-invalid={!!errors.description}
                                placeholder="Describe it with as much detail as you can. The more detail, the faster we can help."
                                className={`${t.control} ${border('description')}`}
                            />
                            <div className="mt-1.5 flex items-start justify-between gap-3">
                                {errors.description ? err('description') : <span />}
                                <span className={`shrink-0 text-xs ${t.muted}`}>
                                    {form.data.description.length}/{MAX_LEN}
                                </span>
                            </div>
                        </div>

                        {errors.limit && (
                            <p role="alert" className="mt-3 text-sm font-medium text-m-redtext">
                                {errors.limit}
                            </p>
                        )}

                        <button type="submit" disabled={form.processing || atLimit} className={`${t.btn} mt-5`}>
                            {form.processing ? 'Sending…' : 'Send report'}
                        </button>
                    </>
                )}
            </form>

            <section aria-labelledby="my-reports" className={t.card}>
                <h3 id="my-reports" className={`text-base font-semibold ${t.ink}`}>
                    My reports
                </h3>

                {reports.length === 0 ? (
                    <div className="py-8 text-center">
                        <span className={`mx-auto flex size-12 items-center justify-center rounded-2xl ${t.mintIcon}`}>
                            <LifeBuoy className="size-6" aria-hidden />
                        </span>
                        <p className={`mt-3 text-sm font-medium ${t.ink}`}>No reports yet</p>
                        <p className={`mt-1 text-sm ${t.muted}`}>Reports you send will be listed here.</p>
                    </div>
                ) : (
                    <ul className={`mt-4 divide-y ${t.divide}`}>
                        {reports.map((r) => {
                            const s = statusInfo[r.status] ?? statusInfo.pending;
                            const Icon = s.icon;
                            return (
                                <li key={r.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="flex flex-wrap items-center gap-2">
                                                <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeTone[r.type]}`}>
                                                    {r.type_label}
                                                </span>
                                                <span className={`font-semibold ${t.ink}`}>{r.category}</span>
                                            </p>
                                            <p className={`mt-1 text-xs ${t.muted}`}>
                                                Sent {when(r.created_at)}
                                                {r.trip?.party ? ` · ${partyLabel} ${r.trip.party}` : ''}
                                                {r.trip?.reference ? ` · Trip ${r.trip.reference}` : ''}
                                            </p>
                                            {r.type === 'incident' && (
                                                <p className={`text-xs ${t.muted}`}>
                                                    Happened {when(r.occurred_at)}
                                                    {r.location ? ` · ${r.location}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.tone}`}>
                                            <Icon className="size-3.5" aria-hidden />
                                            {s.label}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed whitespace-pre-line">{r.description}</p>
                                    {r.response && (
                                        <div className={`rounded-md border px-3 py-2.5 text-sm ${t.inner}`}>
                                            <p className={`text-xs font-semibold ${t.muted}`}>
                                                {r.status === 'resolved' ? 'Response from support' : 'Why it was not accepted'}
                                                {r.resolved_at ? ` · ${when(r.resolved_at)}` : ''}
                                            </p>
                                            <p className="mt-1 whitespace-pre-line">{r.response}</p>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </>
    );
}
