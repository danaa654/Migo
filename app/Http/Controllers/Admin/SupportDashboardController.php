<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Complaint;
use App\Support\SupportCategories;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Support Staff landing page (route middleware "admin.area:support_dashboard").
 * Only report (complaint / support request / incident) data is exposed here, never rider or booking data.
 */
class SupportDashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('admin/support-dashboard', [
            'stats' => $this->attempt(fn () => $this->stats()),
            'reports' => $this->attempt(fn () => $this->needsAttention()),
        ]);
    }

    /** Returns null when the query fails, so the page can show "Data not yet available". */
    private function attempt(callable $fn): mixed
    {
        try {
            return $fn();
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }

    private function stats(): array
    {
        $r = Complaint::query()->selectRaw(
            "coalesce(sum(case when complaint_status = 'pending' then 1 else 0 end), 0) as pending,
             coalesce(sum(case when complaint_status = 'under_investigation' then 1 else 0 end), 0) as under_investigation,
             coalesce(sum(case when report_type = 'incident' and complaint_status in ('pending', 'under_investigation') then 1 else 0 end), 0) as open_incidents"
        )->toBase()->first();

        $resolvedThisWeek = Complaint::query()
            ->where('complaint_status', 'resolved')
            ->where('resolved_at', '>=', now()->subDays(7))
            ->count();

        return [
            'pending' => (int) $r->pending,
            'under_investigation' => (int) $r->under_investigation,
            'open_incidents' => (int) $r->open_incidents,
            'resolved_this_week' => $resolvedThisWeek,
        ];
    }

    /** Open reports in the same priority order as the Support Center inbox: safety first, longest-waiting on top. */
    private function needsAttention()
    {
        return Complaint::query()
            ->leftJoin('passengers as ps', fn ($j) => $j->on('ps.id', '=', 'complaints.reporter_id')->where('complaints.reporter_type', 'passenger'))
            ->leftJoin('riders as rd', fn ($j) => $j->on('rd.id', '=', 'complaints.reporter_id')->where('complaints.reporter_type', 'rider'))
            ->select('complaints.*', DB::raw('coalesce(ps.full_name, rd.full_name) as reporter_name'))
            ->whereIn('complaints.complaint_status', ['pending', 'under_investigation'])
            ->orderByRaw("case when complaints.report_type = 'incident' then 0 else 1 end")
            ->orderByRaw("case complaints.complaint_status when 'pending' then 0 else 1 end")
            ->orderBy('complaints.created_at')
            ->orderBy('complaints.id')
            ->limit(6)
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'category_label' => SupportCategories::label($c->complaint_category),
                'report_type' => $c->report_type,
                'is_safety' => $c->report_type === Complaint::TYPE_INCIDENT,
                'status' => $c->complaint_status,
                'reporter_type' => $c->reporter_type,
                'reporter_name' => $c->reporter_name,
                'created_at' => $c->created_at?->toIso8601String(),
            ])
            ->values();
    }
}