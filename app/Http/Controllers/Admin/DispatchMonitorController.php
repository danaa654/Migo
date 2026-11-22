<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BookingStatus;
use App\Enums\ServiceType;
use App\Http\Controllers\Controller;
use App\Models\DispatchSetting;
use App\Services\Dispatch\DispatchService;
use App\Services\Dispatch\TripService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin live dispatch monitor (Booking Management). Read-mostly: the only interventions are cancelling a booking and
 * restarting a NO_RIDER_FOUND search, and both go through the same locked, validated services as passengers and riders.
 * An administrator can never assign a rider.
 */
class DispatchMonitorController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/bookings/index');
    }

    /** Everything the monitor page needs in one request (polled every few seconds). */
    public function live(): JsonResponse
    {
        $now = now()->timestamp;
        $dayAgo = now()->subDay();
        $fresh = max(1, (int) DispatchSetting::get('location_freshness_seconds', '60'));
        $age = fn ($ts) => $ts ? max(0, $now - strtotime((string) $ts)) : null;

        // ---- active bookings (searching, assigned, arrived, in progress)
        $active = DB::table('bookings as b')
            ->leftJoin('passengers as p', 'p.id', '=', 'b.passenger_id')
            ->leftJoin('riders as r', 'r.id', '=', 'b.rider_id')
            ->whereIn('b.booking_status', BookingStatus::ACTIVE)
            ->orderBy('b.requested_at')->limit(100)
            ->get(['b.id', 'b.booking_reference', 'b.booking_status', 'b.pickup_location', 'b.destination', 'b.pickup_lat', 'b.pickup_lng',
                'b.current_search_radius_km', 'b.requested_at', 'b.estimated_fare', 'b.service_type', 'p.full_name as passenger_name', 'r.full_name as rider_name']);

        $offers = $active->isEmpty() ? collect() : DB::table('rider_booking_offers')->whereIn('booking_id', $active->pluck('id'))
            ->selectRaw("booking_id, count(*) as total, sum(offer_status = 'sent') as open")->groupBy('booking_id')->get()->keyBy('booking_id');

        $activeRows = $active->map(fn ($b) => [
            'id' => $b->id, 'reference' => $b->booking_reference, 'status' => $b->booking_status,
            'service' => ServiceType::fromInput($b->service_type)->label(),
            'passenger' => $b->passenger_name, 'rider' => $b->rider_name,
            'pickup' => $b->pickup_location, 'destination' => $b->destination,
            'radius_km' => $b->current_search_radius_km !== null ? (float) $b->current_search_radius_km : null,
            'offers_sent' => (int) ($offers[$b->id]->total ?? 0), 'offers_open' => (int) ($offers[$b->id]->open ?? 0),
            'waiting_s' => $age($b->requested_at), 'fare' => $b->estimated_fare !== null ? (float) $b->estimated_fare : null,
            'lat' => $b->pickup_lat !== null ? (float) $b->pickup_lat : null, 'lng' => $b->pickup_lng !== null ? (float) $b->pickup_lng : null,
        ])->values();

        // ---- online riders and their last known position
        $riders = DB::table('rider_availability as a')
            ->join('riders as r', 'r.id', '=', 'a.rider_id')
            ->leftJoin('rider_locations as l', 'l.rider_id', '=', 'a.rider_id')
            ->where('a.is_online', true)->limit(500)
            ->get(['r.id', 'r.full_name', 'a.availability_status', 'l.latitude', 'l.longitude', 'l.last_location_update'])
            ->map(function ($x) use ($age, $fresh) {
                $a = $age($x->last_location_update);

                return [
                    'id' => $x->id, 'name' => $x->full_name, 'status' => $x->availability_status,
                    'lat' => $x->latitude !== null ? (float) $x->latitude : null, 'lng' => $x->longitude !== null ? (float) $x->longitude : null,
                    'location_age_s' => $a, 'stale' => $a === null || $a > $fresh,
                ];
            })->values();

        // ---- unmatched and cancelled (last 24 hours)
        $base = fn () => DB::table('bookings as b')->leftJoin('passengers as p', 'p.id', '=', 'b.passenger_id')
            ->select('b.id', 'b.booking_reference', 'b.booking_status', 'b.pickup_location', 'b.destination', 'p.full_name as passenger_name');

        $unmatched = $base()->addSelect('b.updated_at as at')->where('b.booking_status', 'no_rider_found')->where('b.updated_at', '>=', $dayAgo)
            ->orderByDesc('b.updated_at')->limit(30)->get();
        $cancelled = $base()->addSelect('b.cancelled_at as at')->whereIn('b.booking_status', ['cancelled_by_passenger', 'cancelled_by_rider'])
            ->where('b.cancelled_at', '>=', $dayAgo)->orderByDesc('b.cancelled_at')->limit(30)->get();

        $shape = fn ($r) => ['id' => $r->id, 'reference' => $r->booking_reference, 'status' => $r->booking_status, 'passenger' => $r->passenger_name,
            'pickup' => $r->pickup_location, 'destination' => $r->destination, 'at' => $r->at];

        // ---- assignment history (most recent assignments)
        $history = DB::table('bookings as b')
            ->leftJoin('passengers as p', 'p.id', '=', 'b.passenger_id')
            ->leftJoin('riders as r', 'r.id', '=', 'b.rider_id')
            ->whereNotNull('b.assigned_at')->orderByDesc('b.assigned_at')->limit(25)
            ->get(['b.id', 'b.booking_reference', 'b.booking_status', 'b.requested_at', 'b.assigned_at', 'p.full_name as passenger_name', 'r.full_name as rider_name'])
            ->map(fn ($h) => [
                'id' => $h->id, 'reference' => $h->booking_reference, 'status' => $h->booking_status, 'passenger' => $h->passenger_name, 'rider' => $h->rider_name,
                'assigned_at' => $h->assigned_at,
                'time_to_assign_s' => $h->requested_at && $h->assigned_at ? max(0, strtotime((string) $h->assigned_at) - strtotime((string) $h->requested_at)) : null,
            ])->values();

        $counts = [
            'searching' => $activeRows->whereIn('status', ['pending', 'searching_for_rider'])->count(),
            'assigned' => $activeRows->whereIn('status', ['rider_assigned', 'rider_arrived'])->count(),
            'in_progress' => $activeRows->where('status', 'in_progress')->count(),
            'riders_available' => $riders->where('status', 'online_available')->where('stale', false)->count(),
            'riders_on_trip' => $riders->where('status', 'on_trip')->count(),
            'unmatched_24h' => DB::table('bookings')->where('booking_status', 'no_rider_found')->where('updated_at', '>=', $dayAgo)->count(),
            'cancelled_24h' => DB::table('bookings')->whereIn('booking_status', ['cancelled_by_passenger', 'cancelled_by_rider'])->where('cancelled_at', '>=', $dayAgo)->count(),
        ];

        return response()->json([
            'counts' => $counts, 'active' => $activeRows, 'riders' => $riders,
            'unmatched' => $unmatched->map($shape)->values(), 'cancelled' => $cancelled->map($shape)->values(),
            'history' => $history, 'freshness_s' => $fresh,
        ]);
    }

    /** Status timeline and every rider offer of one booking (opened from the history table). */
    public function history(string $booking): JsonResponse
    {
        abort_unless(DB::table('bookings')->where('id', $booking)->exists(), 404);

        $timeline = DB::table('booking_status_history as h')->leftJoin('users as u', 'u.id', '=', 'h.changed_by')
            ->where('h.booking_id', $booking)->orderBy('h.id')
            ->get(['h.previous_status', 'h.new_status', 'h.actor_type', 'h.remarks', 'h.created_at', 'u.name as actor_name']);

        $offers = DB::table('rider_booking_offers as o')->join('riders as r', 'r.id', '=', 'o.rider_id')
            ->where('o.booking_id', $booking)->orderBy('o.id')
            ->get(['r.full_name', 'o.distance_to_pickup', 'o.estimated_pickup_time', 'o.offer_status', 'o.notified_at', 'o.responded_at']);

        return response()->json(['timeline' => $timeline, 'offers' => $offers]);
    }

    public function cancel(Request $request, string $booking, DispatchService $dispatch): JsonResponse
    {
        $admin = $request->user()->adminProfile;
        abort_unless($request->user()->isActiveAdmin() && $admin, 403);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:200']]);

        $result = $dispatch->cancelByAdmin($booking, $request->user()->id, $data['reason']);
        if ($result['ok']) {
            $this->audit($admin->id, 'dispatch.booking_cancelled', $data['reason'], $booking);
        }

        return response()->json($result, $result['ok'] ? 200 : 409);
    }

    public function retry(Request $request, string $booking, TripService $trips): JsonResponse
    {
        $admin = $request->user()->adminProfile;
        abort_unless($request->user()->isActiveAdmin() && $admin, 403);

        $result = $trips->retryByAdmin($booking, $request->user()->id);
        if ($result['ok']) {
            $this->audit($admin->id, 'dispatch.search_restarted', null, $booking);
        }

        return response()->json($result, $result['ok'] ? 200 : 409);
    }

    private function audit(string $adminId, string $action, ?string $description, string $bookingId): void
    {
        DB::table('audit_logs')->insert([
            'id' => (string) Str::uuid(), 'admin_id' => $adminId, 'action' => $action, 'description' => $description,
            'subject_type' => 'booking', 'subject_id' => $bookingId, 'created_at' => now(),
        ]);
    }
}
