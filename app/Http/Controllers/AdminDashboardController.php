<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class AdminDashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('admin/dashboard', [
            'stats' => [
                'riders' => $this->attempt(fn () => $this->riderCounts()),
                'passengers' => $this->attempt(fn () => DB::table('passengers')->count()),
                'bookings' => $this->attempt(fn () => DB::table('bookings')->count()),
                'openComplaints' => $this->attempt(fn () => DB::table('complaints')->whereIn('complaint_status', ['pending', 'under_investigation'])->count()),
            ],
            'riders' => $this->attempt(fn () => $this->recentRiders()),
            'bookings' => $this->attempt(fn () => $this->recentBookings()),
            'complaints' => $this->attempt(fn () => $this->recentComplaints()),
        ]);
    }

    /** Returns null when a table is missing or the query fails, so the page can show "Data not yet available". */
    private function attempt(callable $fn): mixed
    {
        try {
            return $fn();
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }

    private function riderCounts(): array
    {
        $r = DB::table('riders')
            ->selectRaw("count(*) as total, sum(application_status = 'pending') as pending, sum(application_status = 'approved') as approved")
            ->first();

        return ['total' => (int) $r->total, 'pending' => (int) $r->pending, 'approved' => (int) $r->approved];
    }

    private function recentRiders()
    {
        // Only the fields the dashboard needs (no address, license or plate data).
        return DB::table('riders')
            ->select('id', 'full_name', 'email', 'phone', 'application_status', 'created_at')
            ->orderByDesc('created_at')->limit(5)->get();
    }

    private function recentBookings()
    {
        $when = 'coalesce(b.booking_date, b.created_at)';

        return DB::table('bookings as b')
            ->leftJoin('passengers as p', 'p.id', '=', 'b.passenger_id')
            ->leftJoin('riders as r', 'r.id', '=', 'b.rider_id')
            ->select('b.id', 'p.full_name as passenger_name', 'r.full_name as rider_name', 'b.pickup_location', 'b.destination', 'b.booking_status')
            ->selectRaw("$when as booked_at")
            ->orderByRaw("$when desc")->limit(5)->get();
    }

    private function recentComplaints()
    {
        $rows = DB::table('complaints')
            ->select('id', 'reporter_id', 'reporter_type', 'complaint_category', 'complaint_status', 'created_at')
            ->orderByDesc('created_at')->limit(5)->get();

        $names = [];
        foreach (['rider' => 'riders', 'passenger' => 'passengers'] as $type => $table) {
            $ids = $rows->where('reporter_type', $type)->pluck('reporter_id')->all();
            $names[$type] = $ids ? DB::table($table)->whereIn('id', $ids)->pluck('full_name', 'id') : collect();
        }

        return $rows->map(function ($row) use ($names) {
            $row->reporter_name = $names[$row->reporter_type][$row->reporter_id] ?? null;
            unset($row->reporter_id);

            return $row;
        })->values();
    }
}
