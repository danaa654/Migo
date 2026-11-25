import { Link } from '@inertiajs/react';
import {
    Bike,
    Check,
    CircleCheck,
    ClipboardCheck,
    Clock,
    Flag,
    GraduationCap,
    IdCard,
    Lock,
    MapPin,
    PauseCircle,
    Star,
    TriangleAlert,
    Trophy,
    UserPlus,
    Wallet,
    Wrench,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { Notifications } from '@/components/biker-notifications';
import { DashboardSubscriptionCard, useBikerSubscription } from '@/components/biker-plan';
import BikerShell from '@/components/biker-shell';

type Status = 'pending' | 'approved' | 'rejected' | null;

type Accreditation = {
    statuses: {
        application: string;
        document_verification: string;
        orientation: string;
        motorcycle_inspection: string;
        accreditation: string;
        account: string;
    };
    missing_requirements: string[];
    can_accept_bookings: boolean;
    orientation: { scheduled_at: string; location: string } | null;
    rejection_reason: string | null;
    document_remarks: string | null;
    orientation_remarks: string | null;
    inspection_remarks: string | null;
    revocation_reason: string | null;
};

type Stats = {
    total_trips: number;
    total_earnings: number;
    rating: number | null;
    rating_count: number;
    week: {
        trips: number;
        earnings: number;
        days: { label: string; earnings: number; trips: number; is_today: boolean }[];
    };
    recent: {
        id: string;
        reference: string | null;
        pickup: string | null;
        destination: string | null;
        distance: number | null;
        fare: number | null;
        completed_at: string | null;
    }[];
} | null;

type Props = {
    account: { name: string; email: string };
    applicationStatus: Status;
    accountStatus?: 'active' | 'suspended' | null;
    rejectionReason?: string | null;
    suspensionReason?: string | null;
    notifications?: Notifications;
    accreditation?: Accreditation | null;
    stats?: Stats;
};

/* ---------- helpers ---------- */

const ago = (raw: string | null) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    if (mins < 10080) return `${Math.floor(mins / 1440)}d ago`;
    return d.toLocaleDateString('en-PH', { dateStyle: 'medium' });
};

const peso = (n: number) =>
    `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const label = (v: string) => v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/* ---------- status banners (unchanged copy) ---------- */

const banner: Record<
    'pending' | 'approved' | 'rejected' | 'none',
    { icon: LucideIcon; tone: string; title: string; text: string }
> = {
    pending: {
        icon: Clock,
        tone: 'border-[#F59E0B]/40 bg-[#F59E0B]/5 text-[var(--b-amber)]',
        title: 'Application under review',
        text: 'An administrator is reviewing your application. After approval you still need to complete the in-person requirements before you can accept bookings.',
    },
    approved: {
        icon: CircleCheck,
        tone: 'border-m-green/30 bg-m-green/5 text-[var(--b-greentext)]',
        title: 'Application approved',
        text: 'Your online application is approved. This is only the first step: you still need to complete the in-person requirements below before you can accept bookings.',
    },
    rejected: {
        icon: TriangleAlert,
        tone: 'border-m-red/30 bg-m-red/5 text-[var(--b-redtext)]',
        title: 'Application not approved',
        text: 'Your application was not approved, so service requests are not available. Please contact an administrator for details.',
    },
    none: {
        icon: TriangleAlert,
        tone: 'border-m-red/30 bg-m-red/5 text-[var(--b-redtext)]',
        title: 'No application on file',
        text: 'We could not find a biker application for this account. Please contact an administrator.',
    },
};

const suspendedBanner = {
    icon: PauseCircle,
    tone: 'border-[var(--b-ink)]/30 bg-[var(--b-ink)]/5 text-[var(--b-ink)]',
    title: 'Account suspended',
    text: 'Your rider account is suspended, so you cannot accept service requests. Please contact an administrator if you have questions.',
};

/* ---------- accreditation checkpoints ---------- */

type StepState = 'done' | 'current' | 'failed' | 'locked';
type Step = {
    title: string;
    short: string;
    icon: LucideIcon;
    status: string;
    state: StepState;
    note: string | null;
};

function steps(a: Accreditation): Step[] {
    const s = a.statuses;
    const appr = s.application === 'approved';
    const pick = (done: boolean, failed: boolean, started: boolean): StepState =>
        done ? 'done' : failed ? 'failed' : started ? 'current' : 'locked';
    return [
        {
            title: 'Online registration',
            short: 'Register',
            icon: UserPlus,
            status: 'Submitted',
            state: 'done',
            note: null,
        },
        {
            title: 'Initial application review',
            short: 'Review',
            icon: ClipboardCheck,
            status: s.application === 'pending' ? 'Pending review' : label(s.application),
            state: pick(appr, s.application === 'rejected', true),
            note: s.application === 'rejected' ? a.rejection_reason : null,
        },
        {
            title: 'Face-to-face document verification',
            short: 'Documents',
            icon: IdCard,
            status: label(s.document_verification),
            state: pick(
                s.document_verification === 'verified',
                s.document_verification === 'failed',
                appr,
            ),
            note:
                s.document_verification === 'failed'
                    ? a.document_remarks
                    : appr && s.document_verification === 'pending'
                      ? 'Visit the Migo office with your ORIGINAL license, motorcycle registration (OR/CR) and official receipt.'
                      : null,
        },
        {
            title: 'Rider orientation',
            short: 'Orientation',
            icon: GraduationCap,
            status: label(s.orientation),
            state: pick(
                s.orientation === 'completed',
                s.orientation === 'failed',
                s.document_verification === 'verified',
            ),
            note: a.orientation
                ? `Scheduled ${new Date(a.orientation.scheduled_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })} at ${a.orientation.location}`
                : s.orientation === 'failed'
                  ? a.orientation_remarks
                  : s.document_verification === 'verified' && s.orientation === 'pending'
                    ? 'Waiting for Migo staff to schedule your orientation.'
                    : null,
        },
        {
            title: 'Motorcycle inspection',
            short: 'Inspection',
            icon: Wrench,
            status: label(s.motorcycle_inspection),
            state: pick(
                s.motorcycle_inspection === 'passed',
                s.motorcycle_inspection === 'failed',
                s.orientation === 'completed',
            ),
            note:
                s.motorcycle_inspection === 'failed'
                    ? `${a.inspection_remarks ?? ''} A reinspection is required.`.trim()
                    : s.orientation === 'completed' && s.motorcycle_inspection === 'pending'
                      ? 'Bring your motorcycle to the Migo office for the physical inspection.'
                      : null,
        },
        {
            title: 'Final accreditation',
            short: 'Accredited',
            icon: Flag,
            status: label(s.accreditation),
            state: pick(
                s.accreditation === 'accredited',
                s.accreditation === 'revoked',
                s.accreditation === 'for_final_approval',
            ),
            note:
                s.accreditation === 'revoked'
                    ? a.revocation_reason
                    : s.accreditation === 'for_final_approval'
                      ? 'All requirements are complete. An administrator will grant your final accreditation.'
                      : null,
        },
    ];
}

const markerTone: Record<StepState, string> = {
    done: 'bg-[#16A36A] text-white shadow-md shadow-m-green/30',
    current: 'bg-[var(--b-forest)] text-white shadow-lg shadow-[var(--b-forest)]/30 ring-4 ring-[var(--b-forest)]/15',
    failed: 'bg-[#DC2626] text-white shadow-md shadow-m-red/30',
    locked: 'border-2 border-dashed border-[var(--b-line2)] bg-[var(--b-card)] text-[var(--b-faint)]',
};

const panelTone: Record<StepState, string> = {
    done: 'border-m-green/30 bg-[#16A36A]/[0.05]',
    current: 'border-[var(--b-forest)]/30 bg-[var(--b-mint)]/60',
    failed: 'border-m-red/30 bg-[#DC2626]/[0.05]',
    locked: 'border-[var(--b-line)] bg-[var(--b-page)]/70',
};

const chipTone: Record<StepState, string> = {
    done: 'bg-m-green/10 text-[var(--b-greentext)] ring-m-green/30',
    current: 'bg-[var(--b-forest)]/10 text-[var(--b-accent)] ring-[var(--b-forest)]/30',
    failed: 'bg-m-red/10 text-[var(--b-redtext)] ring-m-red/30',
    locked: 'bg-[var(--b-card)] text-[var(--b-muted)] ring-[var(--b-line)]',
};

function CheckpointTrail({ accreditation, canBook }: { accreditation: Accreditation; canBook: boolean }) {
    const list = steps(accreditation);
    const last = list.length - 1;
    const cleared = list.filter((s) => s.state === 'done').length;
    const currentIdx = list.findIndex((s) => s.state !== 'done'); // -1 => every checkpoint cleared
    const [picked, setPicked] = useState<number | null>(null);
    const focus = picked ?? (currentIdx === -1 ? last : currentIdx);
    const fill = (currentIdx === -1 ? last : currentIdx) / last;
    const sel = list[focus];
    const SelIcon = sel.icon;

    const detail =
        sel.note ??
        (sel.state === 'done'
            ? 'Checkpoint cleared.'
            : sel.state === 'current'
              ? 'In progress. Migo staff will record the result here.'
              : sel.state === 'failed'
                ? 'This checkpoint was not passed. Please contact Migo staff.'
                : `Unlocks once “${list[focus - 1]?.title ?? 'the previous checkpoint'}” is complete.`);

    return (
        <section
            className="rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] shadow-sm"
            aria-labelledby="biker-accreditation"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--b-line)] px-5 py-4 sm:px-6">
                <div>
                    <h2 id="biker-accreditation" className="text-base font-semibold text-[var(--b-ink)]">
                        Accreditation checkpoints
                    </h2>
                    <p className="text-xs text-[var(--b-muted)]">
                        Results are recorded by Migo staff and cannot be changed from your account.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div
                        className="h-2 w-28 overflow-hidden rounded-full bg-[var(--b-line)]"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={list.length}
                        aria-valuenow={cleared}
                        aria-label="Checkpoints cleared"
                    >
                        <div
                            className="h-full rounded-full bg-[#16A36A] transition-all duration-700"
                            style={{ width: `${(cleared / list.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-sm font-semibold text-[var(--b-ink)]">
                        {cleared}/{list.length}
                        <span className="ml-1 font-normal text-[var(--b-muted)]">cleared</span>
                    </span>
                </div>
            </div>

            <div className="space-y-4 p-4">
                {canBook ? (
                    <p
                        role="status"
                        className="flex items-center gap-2 rounded-xl border border-m-green/30 bg-m-green/5 px-4 py-3 text-sm text-[var(--b-greentext)]"
                    >
                        <Trophy className="size-4 shrink-0" aria-hidden />
                        You are an accredited Migo rider and can accept bookings.
                    </p>
                ) : (
                    <div
                        role="status"
                        className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/5 px-4 py-3 text-sm text-[var(--b-amber)]"
                    >
                        <p className="font-semibold">You cannot accept bookings yet.</p>
                        <p className="mt-1">
                            All requirements must be completed and your account must be active first.
                        </p>
                        {accreditation.missing_requirements.length > 0 && (
                            <ul className="mt-2 list-disc pl-5">
                                {accreditation.missing_requirements.map((m) => (
                                    <li key={m}>{m}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* The trail: vertical on phones, a horizontal road on larger screens. */}
                <ol className="relative flex flex-col gap-5 py-1 md:grid md:grid-cols-6 md:gap-0 md:py-0">
                    <span
                        aria-hidden
                        className="absolute top-[61px] right-[8.3333%] left-[8.3333%] hidden h-1.5 rounded-full bg-[var(--b-line)] md:block"
                        style={{
                            backgroundImage:
                                'repeating-linear-gradient(90deg, transparent 0 10px, var(--b-card) 10px 14px)',
                        }}
                    >
                        <span
                            className="block h-full rounded-full bg-[#16A36A] transition-all duration-700"
                            style={{ width: `${fill * 100}%` }}
                        />
                    </span>

                    {list.map((st, i) => {
                        const isFinish = i === last;
                        const Icon =
                            st.state === 'done'
                                ? isFinish
                                    ? Trophy
                                    : Check
                                : st.state === 'failed'
                                  ? X
                                  : st.state === 'locked' && isFinish
                                    ? Lock
                                    : st.icon;
                        const here = i === currentIdx;
                        return (
                            <li key={st.title} className="relative z-10 md:pt-10">
                                {i < last && (
                                    <span
                                        aria-hidden
                                        className={`absolute top-6 -bottom-[44px] left-6 w-1.5 -translate-x-1/2 rounded-full md:hidden ${
                                            st.state === 'done' ? 'bg-[#16A36A]' : 'bg-[var(--b-line)]'
                                        }`}
                                    />
                                )}
                                {here && (
                                    <span
                                        aria-hidden
                                        className="absolute top-0 left-1/2 hidden -translate-x-1/2 flex-col items-center motion-safe:animate-bounce md:flex"
                                    >
                                        <span className="flex items-center gap-1 rounded-full bg-[var(--b-pin)] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-white">
                                            <Bike className="size-3.5" /> You are here
                                        </span>
                                        <span className="-mt-px size-2 rotate-45 bg-[var(--b-pin)]" />
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setPicked(i)}
                                    aria-pressed={focus === i}
                                    aria-current={here ? 'step' : undefined}
                                    aria-label={`Checkpoint ${i + 1}: ${st.title}, ${st.status}`}
                                    className="group flex w-full items-center gap-4 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--b-accent)] md:flex-col md:gap-2.5 md:text-center"
                                >
                                    <span className="relative flex shrink-0">
                                        {here && st.state === 'current' && (
                                            <span
                                                aria-hidden
                                                className="absolute inset-0 rounded-full bg-[var(--b-forest)]/30 motion-safe:animate-ping"
                                            />
                                        )}
                                        <span
                                            className={`relative flex size-12 items-center justify-center rounded-full transition group-hover:scale-105 ${markerTone[st.state]} ${
                                                st.state === 'done' && isFinish ? '!bg-[#F59E0B] !shadow-[#F59E0B]/40' : ''
                                            } ${focus === i ? 'outline-2 outline-offset-4 outline-[var(--b-accent)]/50 outline' : ''}`}
                                        >
                                            <Icon className="size-5" aria-hidden />
                                        </span>
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[11px] font-semibold tracking-wide text-[var(--b-muted)] uppercase">
                                            Checkpoint {i + 1}
                                        </span>
                                        <span
                                            className={`block text-sm leading-snug ${
                                                focus === i ? 'font-semibold text-[var(--b-ink)]' : 'font-medium text-[var(--b-body2)]'
                                            }`}
                                        >
                                            <span className="md:hidden">{st.title}</span>
                                            <span className="hidden md:inline">{st.short}</span>
                                        </span>
                                        <span
                                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${chipTone[st.state]}`}
                                        >
                                            {st.status}
                                        </span>
                                        {here && (
                                            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--b-pin)] px-2 py-0.5 text-[11px] font-semibold text-white md:hidden">
                                                <Bike className="size-3" aria-hidden /> You are here
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>

                {/* Detail for the selected checkpoint */}
                <div className="relative" aria-live="polite">
                    <span
                        aria-hidden
                        className={`absolute -top-[7px] hidden size-3.5 -translate-x-1/2 rotate-45 border-t border-l md:block ${panelTone[sel.state]}`}
                        style={{ left: `${((focus + 0.5) / list.length) * 100}%` }}
                    />
                    <div className={`relative rounded-xl border p-4 sm:p-5 ${panelTone[sel.state]}`}>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`flex size-8 items-center justify-center rounded-lg ${markerTone[sel.state].includes('border-dashed') ? 'bg-[var(--b-card)] text-[var(--b-faint)] ring-1 ring-[var(--b-line)]' : markerTone[sel.state].split(' ').slice(0, 2).join(' ')}`}>
                                <SelIcon className="size-4" aria-hidden />
                            </span>
                            <h3 className="text-base font-semibold text-[var(--b-ink)]">
                                {focus + 1}. {sel.title}
                            </h3>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${chipTone[sel.state]}`}>
                                {sel.status}
                            </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--b-body2)]">{detail}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ---------- stats, earnings, activity ---------- */

function StatTile({
    icon: Icon,
    tone,
    label: text,
    value,
    sub,
}: {
    icon: LucideIcon;
    tone: string;
    label: string;
    value: string;
    sub: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] p-3 shadow-sm">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--b-muted)]">{text}</p>
                <p className="text-xl leading-tight font-bold text-[var(--b-ink)]">{value}</p>
                <p className="truncate text-xs text-[var(--b-muted)]">{sub}</p>
            </div>
        </div>
    );
}

function EarningsChart({ week }: { week: NonNullable<Stats>['week'] }) {
    const max = Math.max(...week.days.map((d) => d.earnings), 0);
    const top = week.days.find((d) => d.earnings === max && max > 0);
    return (
        <section className="rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] p-4 shadow-sm" aria-labelledby="biker-earnings">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 id="biker-earnings" className="text-base font-semibold text-[var(--b-ink)]">
                        Earnings this week
                    </h2>
                    <p className="text-xs text-[var(--b-muted)]">
                        {peso(week.earnings)} from {week.trips} completed {week.trips === 1 ? 'trip' : 'trips'}
                    </p>
                </div>
            </div>
            <div className="mt-6 flex h-44 items-end gap-2 sm:gap-4" role="img" aria-label={`Daily earnings this week: ${week.days.map((d) => `${d.label} ${peso(d.earnings)}`).join(', ')}`}>
                {week.days.map((d) => {
                    const h = max > 0 ? Math.max((d.earnings / max) * 100, d.earnings > 0 ? 8 : 0) : 0;
                    const isTop = top === d;
                    return (
                        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                            <span className={`text-[11px] font-semibold text-[var(--b-greentext)] ${isTop ? '' : 'invisible'}`}>{peso(d.earnings)}</span>
                            <div className="flex w-full flex-1 items-end">
                                <div
                                    className={`w-full rounded-t-lg transition-all duration-700 ${
                                        d.is_today ? 'bg-[var(--b-forest)]' : isTop ? 'bg-[#16A36A]' : 'bg-m-green/35'
                                    } ${h === 0 ? 'h-1 rounded-full !bg-[var(--b-line)]' : ''}`}
                                    style={h > 0 ? { height: `${h}%` } : undefined}
                                    title={`${d.label}: ${peso(d.earnings)} (${d.trips} ${d.trips === 1 ? 'trip' : 'trips'})`}
                                />
                            </div>
                            <span className={`text-xs ${d.is_today ? 'font-bold text-[var(--b-accent)]' : 'text-[var(--b-muted)]'}`}>{d.label}</span>
                        </div>
                    );
                })}
            </div>
            {max === 0 && <p className="mt-3 text-center text-xs text-[var(--b-muted)]">No completed trips this week yet.</p>}
        </section>
    );
}

function RecentTrips({ recent }: { recent: NonNullable<Stats>['recent'] }) {
    return (
        <section className="rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] shadow-sm" aria-labelledby="biker-recent">
            <div className="border-b border-[var(--b-line)] px-5 py-4">
                <h2 id="biker-recent" className="text-base font-semibold text-[var(--b-ink)]">
                    Recent trips
                </h2>
            </div>
            {recent.length === 0 ? (
                <p className="p-4 text-sm text-[var(--b-muted)]">Completed trips will show up here.</p>
            ) : (
                <ul className="divide-y divide-[var(--b-line)]">
                    {recent.map((t) => (
                        <li key={t.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-m-green/10 text-m-green">
                                <Check className="size-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-[var(--b-ink)]">{t.reference ?? 'Trip completed'}</p>
                                <p className="flex items-center gap-1 truncate text-xs text-[var(--b-muted)]">
                                    <MapPin className="size-3 shrink-0" aria-hidden />
                                    <span className="truncate">{t.destination ?? t.pickup ?? '—'}</span>
                                </p>
                                <p className="text-xs text-[var(--b-muted)]">
                                    {t.distance != null ? `${t.distance.toFixed(1)} km · ` : ''}
                                    {ago(t.completed_at)}
                                </p>
                            </div>
                            {t.fare != null && <span className="font-semibold text-[var(--b-greentext)]">{peso(t.fare)}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/* ---------- page ---------- */

export default function BikerDashboard({
    account,
    applicationStatus,
    accountStatus,
    rejectionReason,
    suspensionReason,
    notifications,
    accreditation,
    stats,
}: Props) {
    const subscription = useBikerSubscription();
    const suspended = accountStatus === 'suspended';
    const b = suspended ? suspendedBanner : banner[applicationStatus ?? 'none'];
    const BannerIcon = b.icon;
    const canBook = !!accreditation?.can_accept_bookings;
    const reason = suspended
        ? suspensionReason
        : applicationStatus === 'rejected'
          ? rejectionReason
          : null;
    const cleared = accreditation ? steps(accreditation).filter((s) => s.state === 'done').length : 0;
    const showStats = !!stats && (canBook || stats.total_trips > 0);
    const firstName = account.name.trim().split(/\s+/)[0] || account.name;

    const pill = suspended
        ? 'Account suspended'
        : canBook
          ? 'Accredited rider'
          : applicationStatus === 'rejected' || !applicationStatus
            ? b.title
            : `${cleared} of 6 checkpoints cleared`;

    // Accredited riders see their numbers first; riders still on the road to accreditation see the trail first.
    const o = canBook ? { stats: 'order-2', trail: 'order-4', money: 'order-3' } : { stats: 'order-3', trail: 'order-2', money: 'order-4' };

    return (
        <BikerShell
            account={account}
            canBook={canBook}
            active="dashboard"
            notifications={notifications}
            progress={accreditation ? { cleared, total: 6 } : undefined}
        >
            <div className="flex flex-col gap-4">
                {/* Hero (same look as the admin welcome banner) */}
                <section className="relative order-1 min-h-32 overflow-hidden rounded-xl border border-[var(--b-line)] bg-gradient-to-br from-m-mint via-m-mint to-[#C9E6D3] px-5 py-4 shadow-sm dark:to-[#244A3B]">
                    <img
                        src="/img/header-banner.png"
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto max-w-[80%] [mask-image:linear-gradient(to_right,transparent,black_30%)] object-cover object-right select-none sm:block dark:opacity-30"
                    />
                    <div className="relative max-w-xl">
                        <span className="inline-flex items-center gap-2 rounded-full bg-m-card/70 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--b-ink)] ring-1 ring-[var(--b-line)]">
                            <span className={`size-1.5 rounded-full ${canBook ? 'bg-[#16A36A]' : suspended ? 'bg-m-red' : 'bg-[#F59E0B]'}`} />
                            {pill}
                        </span>
                        <h1 className="mt-2 text-xl font-extrabold tracking-tight text-m-forest dark:text-m-ink">
                            {canBook ? `Welcome back, ${firstName}!` : `Welcome, ${firstName}`}
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--b-body2)]">
                            {canBook
                                ? 'Let’s hit the road and earn more today.'
                                : suspended
                                  ? 'Your account is paused for now.'
                                  : 'Clear every checkpoint to unlock bookings and start earning.'}
                        </p>
                        {canBook && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Link
                                    href="/biker/dispatch"
                                    className="inline-flex items-center gap-2 rounded-full bg-m-forest px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-m-forest-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                                >
                                    <span className="size-2 rounded-full bg-[#7CF0B6] motion-safe:animate-pulse" aria-hidden />
                                    Go online / Ride requests
                                </Link>
                                <Link
                                    href="/biker/service-requests"
                                    className="inline-flex items-center rounded-full border border-m-forest bg-m-card/70 px-4 py-1.5 text-xs font-semibold text-m-forest backdrop-blur transition hover:bg-m-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent dark:text-m-ink"
                                >
                                    View service requests
                                </Link>
                            </div>
                        )}
                    </div>
                </section>

                {/* Subscription: which plan the rider has and when it ends (accredited riders only) */}
                {canBook && subscription?.required && (
                    <div className="order-2">
                        <DashboardSubscriptionCard sub={subscription} />
                    </div>
                )}

                {/* Application / suspension notice (hidden for accredited riders, who see the success state in the trail) */}
                {(!canBook || reason || suspended) && (
                    <section role="status" className={`order-1 flex items-start gap-3 rounded-xl border p-4 ${b.tone}`}>
                        <BannerIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
                        <div className="text-sm">
                            <h2 className="font-semibold">{b.title}</h2>
                            <p className="mt-1 leading-relaxed">{b.text}</p>
                            {reason && (
                                <p className="mt-2 leading-relaxed whitespace-pre-line">
                                    <span className="font-semibold">Reason:</span> {reason}
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {applicationStatus === 'approved' && suspended && (
                    <p className="order-1 rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] p-4 text-sm text-[var(--b-muted)]">
                        Your application is still approved. Service requests stay unavailable until your account is reactivated.
                    </p>
                )}

                {accreditation && (
                    <div className={o.trail}>
                        <CheckpointTrail accreditation={accreditation} canBook={canBook} />
                    </div>
                )}

                {showStats && stats && (
                    <>
                        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${o.stats}`}>
                            <StatTile icon={Bike} tone="bg-m-green/10 text-m-green" label="Total trips" value={String(stats.total_trips)} sub={`${stats.week.trips} this week`} />
                            <StatTile icon={Wallet} tone="bg-[#2563EB]/10 text-[#2563EB]" label="Total earnings" value={peso(stats.total_earnings)} sub="From completed trips" />
                            <StatTile
                                icon={Star}
                                tone="bg-[#F59E0B]/15 text-m-amber"
                                label="Rating"
                                value={stats.rating != null ? stats.rating.toFixed(1) : '—'}
                                sub={stats.rating_count > 0 ? `${stats.rating_count} passenger ${stats.rating_count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}
                            />
                            <StatTile icon={Wallet} tone="bg-[#7C3AED]/10 text-m-purple" label="This week" value={peso(stats.week.earnings)} sub={`${stats.week.trips} ${stats.week.trips === 1 ? 'trip' : 'trips'} since Monday`} />
                        </div>
                        <div className={`grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] ${o.money}`}>
                            <EarningsChart week={stats.week} />
                            <RecentTrips recent={stats.recent} />
                        </div>
                    </>
                )}
            </div>
        </BikerShell>
    );
}