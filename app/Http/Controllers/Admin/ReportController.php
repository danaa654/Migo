<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ServiceType;
use App\Http\Controllers\Controller;
use App\Models\Complaint;
use App\Services\Reports\BookingsReport;
use App\Services\Reports\PassengersReport;
use App\Services\Reports\RevenueReport;
use App\Services\Reports\RidersReport;
use App\Services\Reports\SubscriptionsReport;
use App\Services\Reports\SupportReport;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin > Reports and Analytics (the "reports" area: Administrator only). One page; the filter bar (date range +
 * service) is shared by every tab. Only the active tab's data is computed on each request.
 * The service filter applies to ride data only: the Subscriptions and Support & Safety tabs ignore it.
 */
class ReportController extends Controller
{
    private const TABS = ['bookings', 'revenue', 'riders', 'passengers', 'support', 'subscriptions'];

    private const MAX_DAYS = 366;

    public function index(
        Request $request,
        BookingsReport $bookings,
        RevenueReport $revenue,
        RidersReport $riders,
        PassengersReport $passengers,
        SupportReport $support,
        SubscriptionsReport $subscriptions,
    ): Response {
        $tab = in_array($request->query('tab'), self::TABS, true) ? $request->query('tab') : 'bookings';
        $service = in_array($request->query('service'), array_column(ServiceType::cases(), 'value'), true)
            ? $request->query('service') : null;

        [$from, $to, $preset] = $this->range($request);

        // Previous period of the same length, for the "vs previous" change on the cards.
        $days = (int) $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1;
        $prevTo = $from->copy()->subSecond();
        $prevFrom = $from->copy()->subDays($days);

        $current = $bookings->summary($from, $to, $service);
        $previous = $bookings->summary($prevFrom, $prevTo, $service);

        return Inertia::render('admin/reports', [
            'filters' => [
                'tab' => $tab,
                'preset' => $preset,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'service' => $service,
            ],
            'services' => array_column(ServiceType::cases(), 'value'),
            'summary' => [
                'current' => $current,
                'previous' => $previous,
                'active_riders' => $this->safe(fn () => DB::table('riders')
                    ->where('application_status', 'approved')->where('accreditation_status', 'accredited')
                    ->where('account_status', 'active')->count()),
                'open_complaints' => $this->safe(fn () => DB::table('complaints')
                    ->whereIn('complaint_status', Complaint::OPEN)->count()),
            ],
            'report' => match ($tab) {
                'bookings' => $bookings->build($from, $to, $service),
                'revenue' => $revenue->build($from, $to, $service, $prevFrom, $prevTo),
                'riders' => $riders->build($from, $to, $service, $prevFrom, $prevTo),
                'passengers' => $passengers->build($from, $to, $service, $prevFrom, $prevTo),
                'support' => $support->build($from, $to),
                'subscriptions' => $subscriptions->build($from, $to, $prevFrom, $prevTo),
            },
        ]);
    }

    /** @return array{0: CarbonInterface, 1: CarbonInterface, 2: string} */
    private function range(Request $request): array
    {
        $now = now();
        $preset = (string) $request->query('preset', '30d');

        [$from, $to] = match ($preset) {
            'today' => [$now->copy()->startOfDay(), $now->copy()->endOfDay()],
            '7d' => [$now->copy()->subDays(6)->startOfDay(), $now->copy()->endOfDay()],
            'month' => [$now->copy()->startOfMonth(), $now->copy()->endOfDay()],
            'custom' => $this->customRange($request, $now),
            default => [$now->copy()->subDays(29)->startOfDay(), $now->copy()->endOfDay()],
        };
        if (! in_array($preset, ['today', '7d', 'month', 'custom'], true)) {
            $preset = '30d';
        }

        // Keep the range sane: never reversed, never longer than a year.
        if ($from->gt($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }
        if ((int) $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) >= self::MAX_DAYS) {
            $from = $to->copy()->subDays(self::MAX_DAYS - 1)->startOfDay();
        }

        return [$from, $to, $preset];
    }

    private function customRange(Request $request, CarbonInterface $now): array
    {
        try {
            $from = Carbon::parse((string) $request->query('from'))->startOfDay();
            $to = Carbon::parse((string) $request->query('to'))->endOfDay();
        } catch (\Throwable) {
            return [$now->copy()->subDays(29)->startOfDay(), $now->copy()->endOfDay()];
        }

        return [$from, $to];
    }

    private function safe(callable $fn): ?int
    {
        try {
            return $fn();
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }
}
