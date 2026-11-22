<?php

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\BookingRating;
use App\Support\BikerShellData;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/** Approved bikers only (see EnsureApprovedBiker). Trip history: every booking assigned to the signed-in biker. */
class BikerServiceRequestController extends Controller
{
    private const PER_PAGE = 10;

    /** Filter tab => booking statuses. */
    private const FILTERS = [
        'active' => BookingStatus::RIDER_COMMITTED,
        'completed' => ['completed'],
        'cancelled' => ['cancelled_by_rider', 'cancelled_by_passenger'],
    ];

    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $riderId = $user->rider->id;
        $filter = array_key_exists($request->string('status')->toString(), self::FILTERS) ? $request->string('status')->toString() : 'all';

        try {
            $byStatus = Booking::query()->where('rider_id', $riderId)
                ->selectRaw('booking_status, count(*) as total')->groupBy('booking_status')->pluck('total', 'booking_status');

            $counts = ['all' => (int) $byStatus->sum()];
            foreach (self::FILTERS as $key => $statuses) {
                $counts[$key] = (int) $byStatus->only($statuses)->sum();
            }

            $page = Booking::query()
                ->with('passenger:id,full_name')
                ->where('rider_id', $riderId)
                ->when($filter !== 'all', fn ($q) => $q->whereIn('booking_status', self::FILTERS[$filter]))
                ->select('id', 'passenger_id', 'booking_reference', 'pickup_location', 'destination', 'booking_status',
                    'estimated_distance', 'estimated_fare', 'final_fare', 'requested_at', 'created_at')
                ->orderByDesc('created_at')
                ->paginate(self::PER_PAGE)
                ->withQueryString();

            $ratings = BookingRating::query()
                ->where('rater_type', 'passenger')->where('rated_rider_id', $riderId)
                ->whereIn('booking_id', collect($page->items())->pluck('id'))
                ->pluck('rating', 'booking_id');

            $requests = [
                'data' => collect($page->items())->map(fn (Booking $b) => [
                    'id' => $b->id,
                    'reference' => $b->booking_reference,
                    'pickup' => $b->pickup_location,
                    'destination' => $b->destination,
                    'status' => $b->booking_status,
                    'distance' => $b->estimated_distance,
                    'fare' => $b->final_fare ?? $b->estimated_fare,
                    'passenger' => $b->passenger?->full_name,
                    'rating' => $ratings[$b->id] ?? null,
                    'date' => ($b->requested_at ?? $b->created_at)?->toIso8601String(),
                ])->values()->all(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'from' => $page->firstItem(),
                'to' => $page->lastItem(),
                'total' => $page->total(),
            ];
        } catch (Throwable $e) {
            report($e);
            $requests = null; // page shows "not yet available"
            $counts = ['all' => 0, 'active' => 0, 'completed' => 0, 'cancelled' => 0];
        }

        return Inertia::render('biker/biker-service-requests', [
            ...BikerShellData::props($user),
            'requests' => $requests,
            'counts' => $counts,
            'filter' => $filter,
        ]);
    }
}
