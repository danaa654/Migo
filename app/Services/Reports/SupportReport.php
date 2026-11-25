<?php

namespace App\Services\Reports;

use App\Models\Complaint;
use App\Support\SupportCategories;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Reports > Support & Safety. Reports are counted by the day they were filed. The service filter does not apply
 * (a support request is not tied to a ride service). "Open now" ignores the date range.
 */
class SupportReport
{
    use BuildsReportRanges;

    public function build(CarbonInterface $from, CarbonInterface $to): array
    {
        $range = [$this->stamp($from), $this->stamp($to)];

        $rows = DB::table('complaints')->whereBetween('created_at', $range)
            ->get(['report_type', 'complaint_category', 'complaint_status', 'reporter_type', 'created_at', 'resolved_at']);

        $days = $this->dayMap($from, $to, ['complaint' => 0, 'support' => 0, 'incident' => 0]);
        $types = array_fill_keys(Complaint::TYPES, 0);
        $status = ['pending' => 0, 'under_investigation' => 0, 'resolved' => 0, 'rejected' => 0];
        $categories = [];
        $reporters = ['rider' => 0, 'passenger' => 0];
        $hours = [];
        $byTypeHours = array_fill_keys(Complaint::TYPES, []);

        foreach ($rows as $r) {
            $type = $r->report_type ?: Complaint::TYPE_COMPLAINT;
            $types[$type] = ($types[$type] ?? 0) + 1;
            $status[$r->complaint_status] = ($status[$r->complaint_status] ?? 0) + 1;
            $reporters[$r->reporter_type] = ($reporters[$r->reporter_type] ?? 0) + 1;
            $categories[$r->complaint_category] = ($categories[$r->complaint_category] ?? 0) + 1;

            $day = $this->dayOf($r->created_at);
            if (isset($days[$day][$type])) {
                $days[$day][$type]++;
            }
            // Time to close = filed -> resolved or rejected (both stamp resolved_at).
            if ($r->resolved_at) {
                $h = max(0, \Illuminate\Support\Carbon::parse($r->created_at)->diffInMinutes(\Illuminate\Support\Carbon::parse($r->resolved_at), false)) / 60;
                $hours[] = $h;
                $byTypeHours[$type][] = $h;
            }
        }
        sort($hours);
        $n = count($hours);
        $median = $n === 0 ? null : ($n % 2 ? $hours[intdiv($n, 2)] : ($hours[$n / 2 - 1] + $hours[$n / 2]) / 2);
        $avg = fn (array $v) => $v === [] ? null : round(array_sum($v) / count($v), 1);

        arsort($categories);
        $topCategories = [];
        foreach (array_slice($categories, 0, 8, true) as $key => $count) {
            $topCategories[] = ['key' => $key, 'label' => SupportCategories::label((string) $key), 'count' => $count];
        }

        // ---- penalties from upheld complaints
        $pen = DB::table('complaint_penalties')->whereBetween('created_at', $range)
            ->get(['subject_type', 'severity', 'points', 'action', 'suspension_ends_at', 'suspension_lifted_at']);
        $now = now();
        $actions = [];
        $suspensions = $activeSuspensions = $lifted = 0;
        $subjects = ['rider' => 0, 'passenger' => 0];
        foreach ($pen as $p) {
            $actions[$p->action] = ($actions[$p->action] ?? 0) + 1;
            $subjects[$p->subject_type] = ($subjects[$p->subject_type] ?? 0) + 1;
            if (str_starts_with((string) $p->action, 'suspend')) {
                $suspensions++;
                if ($p->suspension_lifted_at) {
                    $lifted++;
                } elseif (! $p->suspension_ends_at || \Illuminate\Support\Carbon::parse($p->suspension_ends_at)->gt($now)) {
                    $activeSuspensions++;
                }
            }
        }

        $open = DB::table('complaints')->whereIn('complaint_status', Complaint::OPEN);
        $oldest = (clone $open)->min('created_at');

        return [
            'total' => $rows->count(),
            'by_type' => $types,
            'by_status' => $status,
            'reporters' => $reporters,
            'categories' => $topCategories,
            'resolution' => [
                'closed' => $n,
                'avg_hours' => $avg($hours),
                'median_hours' => $median === null ? null : round($median, 1),
                'within_24h' => $this->pct(count(array_filter($hours, fn ($h) => $h <= 24)), $n),
                'by_type' => array_map($avg, $byTypeHours),
            ],
            'open_now' => (int) (clone $open)->count(),
            'oldest_open_days' => $oldest ? (int) \Illuminate\Support\Carbon::parse($oldest)->diffInDays($now) : null,
            'penalties' => [
                'total' => $pen->count(),
                'points' => (int) $pen->sum('points'),
                'suspensions' => $suspensions,
                'active_suspensions' => $activeSuspensions,
                'lifted' => $lifted,
                'by_action' => $actions,
                'subjects' => $subjects,
            ],
            'trend' => array_values($days),
        ];
    }
}
