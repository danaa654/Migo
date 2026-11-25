import { router, useForm } from '@inertiajs/react';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';

type Page<T> = { data: T[]; current_page: number; last_page: number; from: number | null; to: number | null; total: number };
type Sub = { id: number; rider: string; email: string | null; plan: string; duration: string; price: number; type: string; state: string; starts_at: string; expires_at: string };
type Pay = { id: number; rider: string; email: string | null; plan: string; duration: string; amount: number; method: string; reference: string | null; status: string; rejection_reason: string | null; reviewer: string | null; verified_at: string | null; created_at: string };
type Plan = { id: number; name: string; description: string | null; duration_value: number; duration_unit: string; duration: string; price: number; monthly: number | null; is_active: boolean; subscribers: number };
type Props = {
    tab: 'overview' | 'subscriptions' | 'payments' | 'plans';
    status?: string | null;
    canManage: boolean;
    stats: Record<string, number>;
    subscriptions: Page<Sub> | null;
    payments: Page<Pay> | null;
    plans: Plan[] | null;
    filters: { status: string; plan: string; search: string; from: string; to: string };
};

const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—');
const TABS = [
    ['overview', 'Overview'],
    ['subscriptions', 'Rider subscriptions'],
    ['payments', 'Payments'],
    ['plans', 'Plans'],
] as const;
const PILL: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800', scheduled: 'bg-sky-100 text-sky-800', expiring: 'bg-amber-100 text-amber-800', expired: 'bg-slate-200 text-slate-700',
    pending: 'bg-amber-100 text-amber-800', verified: 'bg-emerald-100 text-emerald-800', failed: 'bg-red-100 text-red-800', cancelled: 'bg-slate-200 text-slate-700', refunded: 'bg-slate-200 text-slate-700',
};
const box = 'rounded-lg border border-m-line bg-m-card shadow-sm';

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
    return (
        <div className={`${box} p-4`}>
            <p className="text-xs font-medium text-m-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-m-ink">{value}</p>
            {note && <p className="mt-1 text-xs text-m-muted">{note}</p>}
        </div>
    );
}

function Pager<T>({ page, go }: { page: Page<T>; go: (n: number) => void }) {
    if (page.total === 0) return null;
    return (
        <div className="flex items-center justify-between p-3 text-sm text-m-muted">
            <span>{page.from}–{page.to} of {page.total}</span>
            <div className="flex gap-1">
                <button disabled={page.current_page <= 1} onClick={() => go(page.current_page - 1)} className="rounded-md border border-m-line p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
                <button disabled={page.current_page >= page.last_page} onClick={() => go(page.current_page + 1)} className="rounded-md border border-m-line p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
            </div>
        </div>
    );
}

export default function Subscriptions(p: Props) {
    const [search, setSearch] = useState(p.filters.search);
    const [editing, setEditing] = useState<Plan | 'new' | null>(null);
    const plan = useForm({ name: '', description: '', duration_value: 3, duration_unit: 'month', price: 599, is_active: true });

    const go = (patch: Record<string, string | number | undefined>) =>
        router.get('/admin/subscriptions', { tab: p.tab, status: p.filters.status || undefined, plan: p.filters.plan || undefined, search: p.filters.search || undefined, from: p.filters.from || undefined, to: p.filters.to || undefined, ...patch }, { preserveState: true, preserveScroll: true, replace: true });
    const post = (url: string) => router.post(url, {}, { preserveScroll: true });
    const conv = p.stats.trials_started > 0 ? Math.round((p.stats.trials_converted / p.stats.trials_started) * 100) : 0;

    const openPlan = (pl: Plan | 'new') => {
        plan.clearErrors();
        if (pl === 'new') plan.setData({ name: '', description: '', duration_value: 3, duration_unit: 'month', price: 599, is_active: true });
        else plan.setData({ name: pl.name, description: pl.description ?? '', duration_value: pl.duration_value, duration_unit: pl.duration_unit, price: pl.price, is_active: pl.is_active });
        setEditing(pl);
    };
    const savePlan = () => {
        const done = { preserveScroll: true, onSuccess: () => setEditing(null) };
        editing === 'new' ? plan.post('/admin/subscriptions/plans', done) : plan.put(`/admin/subscriptions/plans/${(editing as Plan).id}`, done);
    };

    return (
        <AdminLayout title="Subscription Management">
            <div className="space-y-4">
                {p.status && (
                    <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        <CheckCircle2 className="size-4" /> {p.status}
                    </div>
                )}
                <div className="flex flex-wrap gap-1 border-b border-m-line">
                    {TABS.map(([k, label]) => (
                        <button key={k} onClick={() => router.get('/admin/subscriptions', { tab: k }, { preserveScroll: true })} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${p.tab === k ? 'border-m-forest text-m-forest' : 'border-transparent text-m-muted hover:text-m-ink'}`}>
                            {label}
                            {k === 'payments' && p.stats.pending_payments > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[11px] text-white">{p.stats.pending_payments}</span>}
                        </button>
                    ))}
                </div>

                {p.tab === 'overview' && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Stat label="Riders with access now" value={p.stats.active_riders} />
                        <Stat label="Active free trials" value={p.stats.active_trials} />
                        <Stat label="Active paid subscriptions" value={p.stats.active_paid} />
                        <Stat label="Expiring in 7 days" value={p.stats.expiring_soon} />
                        <Stat label="Expired subscriptions" value={p.stats.expired} />
                        <Stat label="Payments to verify" value={p.stats.pending_payments} />
                        <Stat label="Verified revenue" value={peso(p.stats.revenue)} note="Verified payments only" />
                        <Stat label="Trial to paid conversion" value={`${conv}%`} note={`${p.stats.trials_converted} of ${p.stats.trials_started} trial riders`} />
                    </div>
                )}

                {p.tab === 'subscriptions' && p.subscriptions && (
                    <div className={box}>
                        <div className="flex flex-wrap items-center gap-2 p-3">
                            <select value={p.filters.status} onChange={(e) => go({ status: e.target.value || undefined, page: 1 })} className="rounded-md border border-m-line bg-transparent px-2 py-1.5 text-sm">
                                <option value="">All</option><option value="active">Active</option><option value="trial">Free trials</option><option value="paid">Paid</option><option value="expiring">Expiring soon</option><option value="scheduled">Queued renewals</option><option value="expired">Expired</option>
                            </select>
                            <select value={p.filters.plan} onChange={(e) => go({ plan: e.target.value || undefined, page: 1 })} className="rounded-md border border-m-line bg-transparent px-2 py-1.5 text-sm">
                                <option value="">All plans</option>
                                {(p.plans ?? []).map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                            </select>
                            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go({ search: search || undefined, page: 1 })} placeholder="Search rider, press Enter" className="ml-auto w-56 rounded-md border border-m-line bg-transparent px-2 py-1.5 text-sm" />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-y border-m-line text-left text-xs text-m-muted"><tr><th className="p-3">Rider</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Starts</th><th className="p-3">Expires</th></tr></thead>
                                <tbody>
                                    {p.subscriptions.data.map((s) => (
                                        <tr key={s.id} className="border-b border-m-line">
                                            <td className="p-3"><p className="font-medium">{s.rider}</p><p className="text-xs text-m-muted">{s.email}</p></td>
                                            <td className="p-3">{s.plan}<p className="text-xs text-m-muted">{s.type === 'trial' ? 'Free trial' : `${s.duration} · ${peso(s.price)}`}</p></td>
                                            <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL[s.state]}`}>{s.type === 'trial' && s.state === 'active' ? 'trial' : s.state}</span></td>
                                            <td className="p-3">{when(s.starts_at)}</td>
                                            <td className="p-3">{when(s.expires_at)}</td>
                                        </tr>
                                    ))}
                                    {p.subscriptions.data.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-m-muted">No subscriptions match these filters.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <Pager page={p.subscriptions} go={(n) => go({ page: n })} />
                    </div>
                )}

                {p.tab === 'payments' && p.payments && (
                    <div className={box}>
                        <div className="flex flex-wrap items-center gap-2 p-3">
                            <select value={p.filters.status} onChange={(e) => go({ status: e.target.value || undefined, page: 1 })} className="rounded-md border border-m-line bg-transparent px-2 py-1.5 text-sm">
                                <option value="">All payments</option><option value="pending">Awaiting payment</option><option value="verified">Paid</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
                            </select>
                            <input type="date" value={p.filters.from} onChange={(e) => go({ from: e.target.value || undefined, page: 1 })} className="rounded-md border border-m-line bg-transparent px-2 py-1 text-sm" />
                            <input type="date" value={p.filters.to} onChange={(e) => go({ to: e.target.value || undefined, page: 1 })} className="rounded-md border border-m-line bg-transparent px-2 py-1 text-sm" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go({ search: search || undefined, page: 1 })} placeholder="Rider or payment ID, press Enter" className="ml-auto w-60 rounded-md border border-m-line bg-transparent px-2 py-1.5 text-sm" />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-y border-m-line text-left text-xs text-m-muted"><tr><th className="p-3">Rider</th><th className="p-3">Plan / amount</th><th className="p-3">Method</th><th className="p-3">Submitted</th><th className="p-3">Status</th></tr></thead>
                                <tbody>
                                    {p.payments.data.map((x) => (
                                        <tr key={x.id} className="border-b border-m-line align-top">
                                            <td className="p-3"><p className="font-medium">{x.rider}</p><p className="text-xs text-m-muted">{x.email}</p></td>
                                            <td className="p-3">{x.plan} · {x.duration}<p className="font-medium">{peso(x.amount)}</p></td>
                                            <td className="p-3">{x.method}<p className="text-xs text-m-muted">{x.reference ?? 'Awaiting provider'}</p></td>
                                            <td className="p-3">{when(x.created_at)}</td>
                                            <td className="p-3">
                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL[x.status] ?? ''}`}>{x.status === 'verified' ? 'paid' : x.status === 'pending' ? 'awaiting payment' : x.status}</span>
                                                {x.status === 'verified' && <p className="mt-1 text-xs text-m-muted">{when(x.verified_at)}</p>}
                                                {x.rejection_reason && <p className="mt-1 text-xs text-m-muted">{x.rejection_reason}</p>}
                                            </td>
                                        </tr>
                                    ))}
                                    {p.payments.data.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-m-muted">No payments match these filters.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <Pager page={p.payments} go={(n) => go({ page: n })} />
                    </div>
                )}

                {p.tab === 'plans' && p.plans && (
                    <div className="space-y-3">
                        {p.canManage && <button onClick={() => openPlan('new')} className="inline-flex items-center gap-1.5 rounded-md bg-m-forest px-3 py-2 text-sm font-medium text-white"><Plus className="size-4" />Add plan</button>}
                        <div className="grid gap-3 md:grid-cols-3">
                            {p.plans.map((pl) => (
                                <div key={pl.id} className={`${box} p-4 ${pl.is_active ? '' : 'opacity-60'}`}>
                                    <div className="flex items-center justify-between"><p className="font-bold">{pl.name}</p><span className={`rounded-full px-2 py-0.5 text-[11px] ${pl.is_active ? PILL.active : PILL.expired}`}>{pl.is_active ? 'Active' : 'Inactive'}</span></div>
                                    <p className="mt-1 text-2xl font-extrabold">{peso(pl.price)}</p>
                                    <p className="text-xs text-m-muted">{pl.duration}{pl.monthly !== null && ` · ${peso(pl.monthly)} / month`}</p>
                                    {pl.description && <p className="mt-2 text-sm">{pl.description}</p>}
                                    <p className="mt-2 text-xs text-m-muted">{pl.subscribers} purchase(s)</p>
                                    {p.canManage && (
                                        <div className="mt-3 flex gap-2">
                                            <button onClick={() => openPlan(pl)} className="rounded-md border border-m-line px-3 py-1 text-xs font-medium">Edit</button>
                                            <button onClick={() => post(`/admin/subscriptions/plans/${pl.id}/toggle`)} className="rounded-md border border-m-line px-3 py-1 text-xs font-medium">{pl.is_active ? 'Deactivate' : 'Activate'}</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-m-muted">Editing a plan never changes existing subscriptions: each keeps the name, duration and price it was bought with.</p>
                    </div>
                )}
            </div>

            {editing && (
                <Modal title={editing === 'new' ? 'Add plan' : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
                    <div className="space-y-2 text-sm">
                        <Field label="Name" error={plan.errors.name}><input value={plan.data.name} onChange={(e) => plan.setData('name', e.target.value)} className="w-full rounded-md border border-m-line bg-transparent p-2" /></Field>
                        <Field label="Description" error={plan.errors.description}><textarea value={plan.data.description} onChange={(e) => plan.setData('description', e.target.value)} rows={2} className="w-full rounded-md border border-m-line bg-transparent p-2" /></Field>
                        <div className="grid grid-cols-3 gap-2">
                            <Field label="Length" error={plan.errors.duration_value}><input type="number" min={1} value={plan.data.duration_value} onChange={(e) => plan.setData('duration_value', Number(e.target.value))} className="w-full rounded-md border border-m-line bg-transparent p-2" /></Field>
                            <Field label="Unit" error={plan.errors.duration_unit}><select value={plan.data.duration_unit} onChange={(e) => plan.setData('duration_unit', e.target.value)} className="w-full rounded-md border border-m-line bg-transparent p-2"><option value="day">days</option><option value="month">months</option><option value="year">years</option></select></Field>
                            <Field label="Price (₱)" error={plan.errors.price}><input type="number" min={1} step="0.01" value={plan.data.price} onChange={(e) => plan.setData('price', Number(e.target.value))} className="w-full rounded-md border border-m-line bg-transparent p-2" /></Field>
                        </div>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={plan.data.is_active} onChange={(e) => plan.setData('is_active', e.target.checked)} /> Available for purchase</label>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="rounded-md border border-m-line px-3 py-1.5 text-sm">Cancel</button>
                        <button disabled={plan.processing} onClick={savePlan} className="rounded-md bg-m-forest px-3 py-1.5 text-sm font-medium text-white">Save plan</button>
                    </div>
                </Modal>
            )}
        </AdminLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-semibold">{label}</label>
            {children}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl bg-m-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-3 font-bold">{title}</h3>
                {children}
            </div>
        </div>
    );
}
