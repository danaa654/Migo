<?php

namespace App\Http\Controllers;

use App\Http\Requests\Biker\UpdateRiderLocationRequest;
use App\Models\Booking;
use App\Models\RiderAvailability;
use App\Models\RiderBookingOffer;
use App\Models\RiderLocation;
use App\Services\Dispatch\DispatchService;
use App\Services\Dispatch\RiderPresenceService;
use App\Services\Dispatch\TripService;
use App\Support\BikerShellData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Rider side of dispatch. Only reachable by accredited, active bikers (biker.approved middleware).
 * The page polls state(); every decision (accept, decline, cancel) is made by the server.
 */
class RiderDispatchController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('biker/biker-dispatch', BikerShellData::props($request->user()));
    }

    /** Everything the page needs: availability, live offers and the rider's active booking. */
    public function state(Request $request): JsonResponse
    {
        $rider = $request->user()->rider;
        $avail = RiderAvailability::where('rider_id', $rider->id)->first();
        $loc = RiderLocation::where('rider_id', $rider->id)->first();

        $offers = RiderBookingOffer::with('booking')
            ->where('rider_id', $rider->id)->where('offer_status', 'sent')->where('expires_at', '>', now())
            ->whereHas('booking', fn ($q) => $q->where('booking_status', 'searching_for_rider'))
            ->orderBy('distance_to_pickup')->get()
            ->map(fn (RiderBookingOffer $o) => [
                // No passenger name, phone or coordinates are sent before the rider accepts.
                'id' => $o->id,
                'service_type' => $o->booking->service()->value,
                'service_label' => $o->booking->service()->label(),
                'passenger_count' => $o->booking->passenger_count,
                'item_description' => $o->booking->item_description,
                'package_size' => $o->booking->package_size,
                'delivery_vehicle' => $o->booking->service()->isDelivery() ? $o->booking->vehicleType()->value : null,
                'distance_to_pickup' => $o->distance_to_pickup,
                'estimated_pickup_time' => $o->estimated_pickup_time,
                'pickup_location' => $o->booking->pickup_location,
                'destination' => $o->booking->destination,
                'estimated_distance' => $o->booking->estimated_distance,
                'estimated_fare' => $o->booking->estimated_fare,
                'expires_in' => max(0, $o->expires_at->timestamp - now()->timestamp),
            ])->values();

        $active = Booking::with('passenger:id,full_name,phone')
            ->where('rider_id', $rider->id)->whereIn('booking_status', ['rider_assigned', 'rider_arrived', 'in_progress'])->first();

        $toRate = Booking::with('passenger:id,full_name')->where('rider_id', $rider->id)->where('booking_status', 'completed')
            ->where('completed_at', '>=', now()->subHours(2))
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('booking_ratings')->whereColumn('booking_ratings.booking_id', 'bookings.id')->where('rater_type', 'rider'))
            ->latest('completed_at')->first();

        $today = Booking::where('rider_id', $rider->id)->where('booking_status', 'completed')
            ->where('completed_at', '>=', now()->startOfDay());

        return response()->json([
            'today' => ['trips' => (clone $today)->count(), 'earnings' => (float) (clone $today)->sum('final_fare')],
            'location' => $loc ? ['lat' => $loc->latitude, 'lng' => $loc->longitude] : null,
            'to_rate' => $toRate ? ['id' => $toRate->id, 'passenger_name' => $toRate->passenger?->full_name, 'final_fare' => $toRate->final_fare] : null,
            'availability' => ['status' => $avail?->availability_status?->value ?? 'offline', 'is_online' => (bool) $avail?->is_online],
            'location_age' => $loc ? max(0, now()->timestamp - $loc->last_location_update->timestamp) : null,
            'offers' => $offers,
            'active' => $active ? [
                'id' => $active->id, 'reference' => $active->booking_reference, 'status' => $active->booking_status,
                'service_type' => $active->service()->value, 'service_label' => $active->service()->label(),
                'passenger_count' => $active->passenger_count, 'notes' => $active->notes,
                // Delivery details (MigoDala) are revealed only after this rider has been assigned.
                'recipient_name' => $active->recipient_name, 'recipient_phone' => $active->recipient_phone,
                'item_description' => $active->item_description, 'package_size' => $active->package_size,
                'delivery_vehicle' => $active->service()->isDelivery() ? $active->vehicleType()->value : null,
                'pickup_location' => $active->pickup_location, 'destination' => $active->destination,
                'pickup_lat' => $active->pickup_lat, 'pickup_lng' => $active->pickup_lng,
                'destination_lat' => $active->destination_lat, 'destination_lng' => $active->destination_lng,
                'estimated_fare' => $active->estimated_fare, 'estimated_distance' => $active->estimated_distance,
                // Contact details are revealed only after this rider has been assigned.
                'passenger_name' => $active->passenger?->full_name, 'passenger_phone' => $active->passenger?->phone,
                'passenger_photo_url' => $active->passenger?->avatar_path ? '/storage/'.ltrim($active->passenger->avatar_path, '/') : null,
            ] : null,
        ]);
    }

    public function location(UpdateRiderLocationRequest $request, RiderPresenceService $presence): JsonResponse
    {
        return $this->reply($presence->updateLocation($request->user()->rider, $request->validated()), 422);
    }

    public function online(Request $request, RiderPresenceService $presence): JsonResponse
    {
        return $this->reply($presence->goOnline($request->user()->rider), 422);
    }

    public function offline(Request $request, RiderPresenceService $presence): JsonResponse
    {
        return $this->reply($presence->goOffline($request->user()->rider), 409);
    }

    public function accept(Request $request, int $offer, DispatchService $dispatch): JsonResponse
    {
        $result = $dispatch->accept($request->user()->rider, $offer);
        unset($result['booking']); // never return the model: the page reloads state() instead

        return $this->reply($result, 409);
    }

    public function decline(Request $request, int $offer, DispatchService $dispatch): JsonResponse
    {
        $dispatch->decline($request->user()->rider, $offer);

        return response()->json(['ok' => true, 'code' => 'declined', 'message' => 'Ride request declined.']);
    }

    public function cancel(Request $request, string $booking, DispatchService $dispatch): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:200']]);

        return $this->reply($dispatch->cancelByRider($booking, $request->user()->rider, $request->user()->id, $data['reason'] ?? null), 409);
    }

    public function arrived(Request $request, string $booking, TripService $trips): JsonResponse
    {
        return $this->reply($trips->arrived($booking, $request->user()->rider), 409);
    }

    public function start(Request $request, string $booking, TripService $trips): JsonResponse
    {
        return $this->reply($trips->start($booking, $request->user()->rider), 409);
    }

    public function complete(Request $request, string $booking, TripService $trips): JsonResponse
    {
        return $this->reply($trips->complete($booking, $request->user()->rider), 409);
    }

    public function rate(Request $request, string $booking, TripService $trips): JsonResponse
    {
        $d = $request->validate(['rating' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:500']]);

        return $this->reply($trips->rateByRider($booking, $request->user()->rider, $request->user()->id, (int) $d['rating'], $d['comment'] ?? null), 409);
    }

    /** @param array{ok: bool, code: string, message: string} $result */
    private function reply(array $result, int $failStatus): JsonResponse
    {
        return response()->json($result, $result['ok'] ? 200 : $failStatus);
    }
}
