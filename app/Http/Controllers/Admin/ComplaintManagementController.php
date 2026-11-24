<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Complaints\ComplaintStatusException;
use App\Actions\Complaints\UpdateComplaintStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ResolveComplaintRequest;
use App\Http\Requests\Admin\SuspendRiderRequest;
use App\Models\AdminProfile;
use App\Models\Booking;
use App\Models\Complaint;
use App\Models\ComplaintPenalty;
use App\Services\Complaints\ComplaintPenaltyService;
use App\Support\SupportCategories;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin > Support Center (complaints, support requests and incident reports in one inbox). Mounted under the "support" area (Administrator and Support Staff).
 * Each write action also re-checks the area so it stays protected on its own.
 */
class ComplaintManagementController extends Controller
{
    private const PER_PAGE = 10;

    private const STATUSES = ['pending', 'under_investigation', 'resolved', 'rejected'];

    private const SORTS = ['priority', 'created_at', 'complaint_status', 'complaint_category'];

    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $status = in_array($request->query('status'), self::STATUSES, true) ? $request->query('status') : null;
        $type = in_array($request->query('type'), ['rider', 'passenger'], true) ? $request->query('type') : null;
        $kind = in_array($request->query('kind'), Complaint::TYPES, true) ? $request->query('kind') : null;
        $category = trim((string) $request->query('category', '')) ?: null;
        $sort = in_array($request->query('sort'), self::SORTS, true) ? $request->query('sort') : 'priority';
        $direction = $request->query('direction') === 'asc' ? 'asc' : 'desc';

        $query = $this->withReporter(Complaint::query())
            ->when($search !== '', function ($q) use ($search) {
                // "!" is the LIKE escape character, so %, _ typed by staff match literally.
                $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_substr($search, 0, 100)).'%';
                $q->where(fn ($w) => $w
                    ->whereRaw("complaints.complaint_category like ? escape '!'", [$like])
                    ->orWhereRaw("complaints.description like ? escape '!'", [$like])
                    ->orWhereRaw("complaints.id like ? escape '!'", [$like])
                    ->orWhereRaw("complaints.incident_location like ? escape '!'", [$like])
                    ->orWhereRaw("coalesce(ps.full_name, rd.full_name) like ? escape '!'", [$like]));
            })
            ->when($status, fn ($q, $s) => $q->where('complaints.complaint_status', $s))
            ->when($type, fn ($q, $t) => $q->where('complaints.reporter_type', $t))
            ->when($kind, fn ($q, $k) => $q->where('complaints.report_type', $k))
            ->when($category, fn ($q, $c) => $q->where('complaints.complaint_category', $c));

        if ($sort === 'priority') {
            // Open reports first. Among them incident (safety) reports come first, then pending before investigating,
            // the longest-waiting one on top. Closed ones after, newest first.
            $query->orderByRaw("case when complaints.complaint_status in ('pending', 'under_investigation') then 0 else 1 end")
                ->orderByRaw("case when complaints.report_type = 'incident' then 0 else 1 end")
                ->orderByRaw("case complaints.complaint_status when 'pending' then 0 when 'under_investigation' then 1 else 2 end")
                ->orderByRaw("case when complaints.complaint_status in ('pending', 'under_investigation') then complaints.created_at end asc")
                ->orderByDesc('complaints.created_at');
        } else {
            $query->orderBy("complaints.{$sort}", $direction);
        }

        $complaints = $query->orderBy('complaints.id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn ($c) => [
                'id' => $c->id,
                'category' => $c->complaint_category,
                'category_label' => SupportCategories::label($c->complaint_category),
                'report_type' => $c->report_type,
                'is_safety' => $c->report_type === Complaint::TYPE_INCIDENT,
                'excerpt' => mb_strimwidth((string) $c->description, 0, 110, '…'),
                'status' => $c->complaint_status,
                'reporter_type' => $c->reporter_type,
                'reporter_name' => $c->reporter_name,
                'has_booking' => $c->booking_id !== null,
                'created_at' => $c->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/complaints/index', [
            'stats' => $this->stats(),
            'complaints' => $complaints,
            'categories' => Complaint::query()->distinct()->orderBy('complaint_category')->pluck('complaint_category')
                ->map(fn ($key) => ['key' => $key, 'label' => SupportCategories::label($key)])->values(),
            'filters' => ['search' => $search, 'status' => $status, 'type' => $type, 'kind' => $kind, 'category' => $category, 'sort' => $sort, 'direction' => $direction],
        ]);
    }

    public function show(Complaint $complaint, ComplaintPenaltyService $penalties): Response
    {
        $complaint->load('assignee');

        $booking = $complaint->booking_id ? Booking::query()->with('rider:id,full_name')->find($complaint->booking_id) : null;

        $history = DB::table('audit_logs as a')
            ->leftJoin('admin_profiles as p', 'p.id', '=', 'a.admin_id')
            ->where('a.subject_type', 'complaint')->where('a.subject_id', $complaint->id)
            ->orderByDesc('a.created_at')
            ->select('a.id', 'a.action', 'a.description as reason', 'a.created_at', 'p.full_name as admin_name')
            ->get();

        return Inertia::render('admin/complaints/show', [
            'complaint' => [
                'id' => $complaint->id,
                'category' => $complaint->complaint_category,
                'category_label' => SupportCategories::label($complaint->complaint_category),
                'report_type' => $complaint->report_type,
                'type_label' => SupportCategories::typeLabel($complaint->report_type),
                'noun' => SupportCategories::noun($complaint->report_type),
                'is_safety' => $complaint->isSafety(),
                'occurred_at' => $complaint->occurred_at?->toIso8601String(),
                'location' => $complaint->incident_location,
                'description' => $complaint->description,
                'status' => $complaint->complaint_status,
                'resolution_note' => $complaint->resolution_note,
                'resolved_at' => $complaint->resolved_at?->toIso8601String(),
                'assigned_to' => $complaint->assignee?->full_name,
                'created_at' => $complaint->created_at?->toIso8601String(),
            ],
            'reporter' => $this->party($complaint->reporter_type, $complaint->reporter_id),
            'against' => $complaint->against_type ? $this->party($complaint->against_type, $complaint->against_id) : null,
            'booking' => $booking ? [
                'id' => $booking->id,
                'reference' => $booking->booking_reference,
                'service' => $booking->service_type?->label(),
                'pickup' => $booking->pickup_location,
                'destination' => $booking->destination,
                'status' => $booking->booking_status,
                'rider' => $booking->rider?->full_name,
                'created_at' => $booking->created_at?->toIso8601String(),
            ] : null,
            'history' => $history,
            // Penalty points: what the admin sees before upholding, and what was applied once it was.
            'penalty' => $complaint->canCarryPenalty() ? $penalties->preview($complaint) : ['can_uphold' => false, 'is_support' => $complaint->report_type === Complaint::TYPE_SUPPORT],
            'applied_penalty' => $this->appliedPenalty($complaint),
            'against_active_points' => $complaint->against_type && $complaint->against_id ? $penalties->activePoints($complaint->against_type, $complaint->against_id) : null,
        ]);
    }

    public function investigate(Request $request, Complaint $complaint, UpdateComplaintStatus $action): RedirectResponse
    {
        $noun = SupportCategories::noun($complaint->report_type);

        return $this->run($request, fn ($admin) => $action->investigate($complaint, $admin), "The {$noun} is now being handled.");
    }

    public function resolve(ResolveComplaintRequest $request, Complaint $complaint, UpdateComplaintStatus $action): RedirectResponse
    {
        // A support request has no finding: it is simply answered.
        $upheld = $complaint->report_type !== Complaint::TYPE_SUPPORT && $request->validated('finding') === 'upheld';
        $finding = $upheld ? ['severity' => $request->validated('severity'), 'action' => $request->validated('action')] : null;

        return $this->run(
            $request,
            fn ($admin) => $action->resolve($complaint, $admin, $request->validated('reason'), $finding),
            match (true) {
                $upheld => 'The report was upheld and the penalty was recorded.',
                $complaint->report_type === Complaint::TYPE_SUPPORT => 'The support request has been answered and closed.',
                default => 'The report has been resolved with no violation found.',
            },
        );
    }

    public function reject(SuspendRiderRequest $request, Complaint $complaint, UpdateComplaintStatus $action): RedirectResponse
    {
        return $this->run($request, fn ($admin) => $action->reject($complaint, $admin, $request->validated('reason')), 'The '.SupportCategories::noun($complaint->report_type).' has been rejected.');
    }

    /** @param callable(AdminProfile): mixed $do */
    private function run(Request $request, callable $do, string $success): RedirectResponse
    {
        abort_unless($request->user()?->canAccessAdminArea('support'), 403);

        try {
            $do($request->user()->adminProfile);
            Inertia::flash('toast', ['type' => 'success', 'message' => $success]);
        } catch (ComplaintStatusException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $e->getMessage()]);
        }

        return back();
    }

    /** @return array<string, mixed>|null */
    private function appliedPenalty(Complaint $complaint): ?array
    {
        $p = ComplaintPenalty::query()->where('complaint_id', $complaint->id)->first();

        return $p ? [
            'severity' => $p->severity,
            'points' => $p->points,
            'action' => ComplaintPenaltyService::ACTIONS[$p->action] ?? $p->action,
            'suspension_ends_at' => $p->suspension_ends_at?->toIso8601String(),
            'suspension_lifted_at' => $p->suspension_lifted_at?->toIso8601String(),
            'expires_at' => $p->expires_at?->toIso8601String(),
        ] : null;
    }

    /** Adds reporter_name from passengers / riders (reporter_id is that profile's id, matched by reporter_type). */
    private function withReporter($query)
    {
        return $query
            ->leftJoin('passengers as ps', fn ($j) => $j->on('ps.id', '=', 'complaints.reporter_id')->where('complaints.reporter_type', 'passenger'))
            ->leftJoin('riders as rd', fn ($j) => $j->on('rd.id', '=', 'complaints.reporter_id')->where('complaints.reporter_type', 'rider'))
            ->select('complaints.*', DB::raw('coalesce(ps.full_name, rd.full_name) as reporter_name'));
    }

    /** @return array{type: string, id: string, name: string|null, email: string|null, phone: string|null, url: string}|null */
    private function party(?string $type, ?string $id): ?array
    {
        if (! $type || ! $id) {
            return null;
        }
        $table = $type === 'rider' ? 'riders' : 'passengers';
        $row = DB::table($table)->where('id', $id)->first(['id', 'full_name', 'email', 'phone']);

        return [
            'type' => $type,
            'id' => $id,
            'name' => $row && $row->full_name !== '' ? $row->full_name : null,
            'email' => $row->email ?? null,
            'phone' => $row && $row->phone !== '' ? $row->phone : null,
            'url' => ($type === 'rider' ? '/admin/riders/' : '/admin/passengers/').$id,
            'found' => $row !== null,
        ];
    }

    /** @return array<string, int> */
    private function stats(): array
    {
        $r = Complaint::query()->selectRaw(
            "count(*) as total,
             coalesce(sum(case when complaint_status = 'pending' then 1 else 0 end), 0) as pending,
             coalesce(sum(case when complaint_status = 'under_investigation' then 1 else 0 end), 0) as under_investigation,
             coalesce(sum(case when complaint_status = 'resolved' then 1 else 0 end), 0) as resolved,
             coalesce(sum(case when complaint_status = 'rejected' then 1 else 0 end), 0) as rejected,
             coalesce(sum(case when report_type = 'complaint' then 1 else 0 end), 0) as complaints,
             coalesce(sum(case when report_type = 'support' then 1 else 0 end), 0) as support,
             coalesce(sum(case when report_type = 'incident' then 1 else 0 end), 0) as incidents,
             coalesce(sum(case when report_type = 'incident' and complaint_status in ('pending', 'under_investigation') then 1 else 0 end), 0) as open_incidents"
        )->toBase()->first();

        return array_map('intval', (array) $r);
    }
}