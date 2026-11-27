<?php

namespace App\Services\Dispatch;

use App\Enums\BookingStatus;
use App\Enums\DispatchEventType as E;
use App\Enums\RiderAvailabilityStatus;
use App\Events\DispatchEventOccurred as Raise;
use App\Models\Booking;
use App\Models\BookingRating;
use App\Models\BookingRoutePoint;
use App\Models\DispatchSetting;
use App\Models\Passenger;
use App\Models\Rider;
use App\Models\RiderAvailability;
use App\Models\RiderBookingOffer;
use App\Models\RiderLocation;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/** After assignment: arrival, start, completion, ratings, retry and the passenger's live view. */
class TripService
{
    public function __construct(private DispatchService $dispatch) {}

    /** @return array{ok: bool, code: string, message: string} */
    public function arrived(string $bookingId, Rider $rider): array
    {
        return DB::transaction(function () use ($bookingId, $rider) {
            $b = Booking::whereKey($bookingId)->where('rider_id', $rider->id)->lockForUpdate()->first();
            if (! $b || $b->booking_status !== 'rider_assigned') {
                return $this->fail('invalid_state', 'You can only confirm arrival on a booking you have just accepted.');
            }

            // The server checks the rider really is at the pickup point (0 disables the check).
            $radius = (int) DispatchSetting::get('arrival_radius_meters', '300');
            if ($radius > 0) {
                $loc = RiderLocation::where('rider_id', $rider->id)->first();
                if (! $loc || $loc->last_location_update->timestamp < now()->timestamp - max(15, (int) DispatchSetting::get('location_freshness_seconds', '60'))) {
                    return $this->fail('no_location', 'Your GPS location is out of date. Wait for it to update and try again.');
                }
                $meters = DispatchService::distanceMeters($loc->latitude, $loc->longitude, (float) $b->pickup_lat, (float) $b->pickup_lng);
                if ($meters > $radius) {
                    return $this->fail('too_far', sprintf('You are still about %d m from the pickup point. Move within %d m to confirm arrival.', round($meters), $radius));
                }
            }

            $this->dispatch->move($b, BookingStatus::RiderArrived, 'rider', $rider->user_id, 'Rider arrived at pickup', ['arrived_at' => now()]);
            Raise::raise(E::PassengerRiderArrived, $b->id, $rider->id);
            Raise::raise(E::TripStatusUpdated, $b->id, $rider->id);

            return ['ok' => true, 'code' => 'arrived', 'message' => 'Arrival confirmed. The passenger has been told.'];
        });
    }

    /** @return array{ok: bool, code: string, message: string} */
    public function start(string $bookingId, Rider $rider): array
    {
        return DB::transaction(function () use ($bookingId, $rider) {
            $b = Booking::whereKey($bookingId)->where('rider_id', $rider->id)->lockForUpdate()->first();
            if (! $b || $b->booking_status !== 'rider_arrived') {
                return $this->fail('invalid_state', 'Confirm that you have arrived before starting the trip.');
            }
            $this->dispatch->move($b, BookingStatus::InProgress, 'rider', $rider->user_id, 'Trip started', ['started_at' => now()]);
            $this->dispatch->setAvailability($rider->id, RiderAvailabilityStatus::OnTrip);
            Raise::raise(E::PassengerTripStarted, $b->id, $rider->id);
            Raise::raise(E::TripStatusUpdated, $b->id, $rider->id);

            return ['ok' => true, 'code' => 'started', 'message' => 'Trip started.'];
        });
    }

    /** @return array{ok: bool, code: string, message: string} */
    public function complete(string $bookingId, Rider $rider): array
    {
        return DB::transaction(function () use ($bookingId, $rider) {
            $b = Booking::whereKey($bookingId)->where('rider_id', $rider->id)->lockForUpdate()->first();
            if (! $b || $b->booking_status !== 'in_progress') {
                return $this->fail('invalid_state', 'Only a trip in progress can be completed.');
            }

            $fare = $this->finalFare($b);
            $this->dispatch->move($b, BookingStatus::Completed, 'rider', $rider->user_id, 'Trip completed', ['completed_at' => now(), 'final_fare' => $fare]);

            // Available again only if the rider is still online and still allowed to take rides.
            $next = $rider->fresh()->canAcceptRequests() ? RiderAvailabilityStatus::OnlineAvailable : RiderAvailabilityStatus::Unavailable;
            RiderAvailability::where('rider_id', $rider->id)->where('is_online', true)
                ->update(['availability_status' => $next->value, 'last_active_at' => now()]);
            Raise::raise(E::PassengerTripCompleted, $b->id, $rider->id, null, ['final_fare' => $fare]);
            Raise::raise(E::TripStatusUpdated, $b->id, $rider->id);

            return ['ok' => true, 'code' => 'completed', 'message' => sprintf('Trip completed. Collect ₱%.2f from the passenger.', $fare)];
        });
    }

    /** Pricing rule: the recorded GPS route is used when it has enough points, kept between 0.8x and 1.5x of the estimate. */
    private function finalFare(Booking $b): float
    {
        $estimate = $b->estimated_fare !== null ? (float) $b->estimated_fare : null;
        $points = BookingRoutePoint::where('booking_id', $b->id)->orderBy('id')->get(['latitude', 'longitude']);

        if ($estimate === null || $points->count() < 5) {
            return $estimate ?? DispatchService::fareConfig($b->service())['minimum'];
        }

        $meters = 0.0;
        for ($i = 1; $i < $points->count(); $i++) {
            $meters += DispatchService::distanceMeters($points[$i - 1]->latitude, $points[$i - 1]->longitude, $points[$i]->latitude, $points[$i]->longitude);
        }
        $km = $meters / 1000;
        $fare = DispatchService::fareForKm($km, $b->service())['total'];

        return round(min($estimate * 1.5, max($estimate * 0.8, $fare)), 2);
    }

    /** A NO_RIDER_FOUND booking is searched again from the first radius. Old offers are cleared so those riders can be asked again. */
    public function retry(string $bookingId, Passenger $passenger, ?int $userId): array
    {
        return DB::transaction(function () use ($bookingId, $passenger, $userId) {
            $p = Passenger::whereKey($passenger->id)->lockForUpdate()->firstOrFail();
            if ($p->account_status !== 'active') {
                return $this->fail('account_blocked', 'Your account cannot book rides right now.');
            }
            $b = Booking::whereKey($bookingId)->where('passenger_id', $p->id)->lockForUpdate()->first();
            if (! $b || $b->booking_status !== 'no_rider_found') {
                return $this->fail('invalid_state', 'This booking cannot be searched again.');
            }
            if (Booking::where('passenger_id', $p->id)->whereIn('booking_status', BookingStatus::ACTIVE)->exists()) {
                return $this->fail('duplicate_active', 'You already have a booking in progress.');
            }

            RiderBookingOffer::where('booking_id', $b->id)->delete();
            $now = now();
            $this->dispatch->move($b, BookingStatus::SearchingForRider, 'passenger', $userId, 'Passenger searched again', [
                'search_started_at' => $now, 'last_expansion_at' => $now, 'current_search_radius_km' => $this->dispatch->radii()[0],
            ]);
            Raise::raise(E::PassengerSearchingForRider, $b->id, null, null, ['message' => 'Searching again...']);
            $this->dispatch->dispatchRound($b);

            return ['ok' => true, 'code' => 'searching', 'message' => 'Searching again...'];
        });
    }

    /**
     * Administrator restarts the search for a NO_RIDER_FOUND booking (same rules as the passenger's retry).
     * Lock order matches retry(): passenger row first, then booking row.
     *
     * @return array{ok: bool, code: string, message: string}
     */
    public function retryByAdmin(string $bookingId, ?int $userId): array
    {
        return DB::transaction(function () use ($bookingId, $userId) {
            $passengerId = Booking::whereKey($bookingId)->value('passenger_id');
            if (! $passengerId) {
                return $this->fail('not_found', 'Booking not found.');
            }
            Passenger::whereKey($passengerId)->lockForUpdate()->firstOrFail();
            $b = Booking::whereKey($bookingId)->lockForUpdate()->first();
            if (! $b || $b->booking_status !== 'no_rider_found') {
                return $this->fail('invalid_state', 'Only a booking with no rider found can be searched again.');
            }
            if (Booking::where('passenger_id', $passengerId)->where('id', '!=', $b->id)->whereIn('booking_status', BookingStatus::ACTIVE)->exists()) {
                return $this->fail('duplicate_active', 'This passenger already has another booking in progress.');
            }

            RiderBookingOffer::where('booking_id', $b->id)->delete();
            $now = now();
            $this->dispatch->move($b, BookingStatus::SearchingForRider, 'admin', $userId, 'Search restarted by administrator', [
                'search_started_at' => $now, 'last_expansion_at' => $now, 'current_search_radius_km' => $this->dispatch->radii()[0],
            ]);
            Raise::raise(E::PassengerSearchingForRider, $b->id, null, null, ['message' => 'Searching again...']);
            $this->dispatch->dispatchRound($b);

            return ['ok' => true, 'code' => 'searching', 'message' => 'Search restarted.'];
        });
    }

    /** @return array{ok: bool, code: string, message: string} */
    public function rateByPassenger(string $bookingId, Passenger $passenger, ?int $userId, int $stars, ?string $comment): array
    {
        $b = Booking::whereKey($bookingId)->where('passenger_id', $passenger->id)->first();

        return $this->saveRating($b, 'passenger', $userId, $b?->rider_id, $stars, $comment);
    }

    /** @return array{ok: bool, code: string, message: string} */
    public function rateByRider(string $bookingId, Rider $rider, ?int $userId, int $stars, ?string $comment): array
    {
        $b = Booking::whereKey($bookingId)->where('rider_id', $rider->id)->first();

        return $this->saveRating($b, 'rider', $userId, null, $stars, $comment);
    }

    private function saveRating(?Booking $b, string $by, ?int $userId, ?string $ratedRiderId, int $stars, ?string $comment): array
    {
        if (! $b || $b->booking_status !== 'completed') {
            return $this->fail('invalid_state', 'You can only rate a completed trip.');
        }
        try {
            BookingRating::create([
                'booking_id' => $b->id, 'rater_type' => $by, 'rater_user_id' => $userId, 'rated_rider_id' => $ratedRiderId,
                'rating' => max(1, min(5, $stars)), 'comment' => $comment ? mb_substr(trim($comment), 0, 500) : null,
            ]);
        } catch (UniqueConstraintViolationException) {
            return $this->fail('already_rated', 'You have already rated this trip.');
        }

        return ['ok' => true, 'code' => 'rated', 'message' => 'Thank you for your rating.'];
    }

    /**
     * What the passenger's page shows. The rider's name, plate, phone and live position are only included for a booking
     * that is assigned to that rider and still active, and the caller has already checked the booking is the passenger's own.
     */
    public function live(Booking $b): array
    {
        $out = [
            'id' => $b->id, 'reference' => $b->booking_reference, 'status' => $b->booking_status,
            'service_type' => $b->service()->value, 'service_label' => $b->service()->label(),
            'passenger_count' => $b->passenger_count, 'recipient_name' => $b->recipient_name, 'item_description' => $b->item_description,
            'package_size' => $b->package_size, 'notes' => $b->notes,
            'pickup_location' => $b->pickup_location, 'destination' => $b->destination,
            'pickup' => $b->pickup_lat !== null ? ['lat' => $b->pickup_lat, 'lng' => $b->pickup_lng] : null,
            'dest' => $b->destination_lat !== null ? ['lat' => $b->destination_lat, 'lng' => $b->destination_lng] : null,
            'estimated_fare' => $b->estimated_fare, 'estimated_distance' => $b->estimated_distance, 'final_fare' => $b->final_fare,
            'search_radius_km' => $b->current_search_radius_km, 'rider' => null, 'rider_location' => null,
            'eta_minutes' => null, 'distance_to_target_m' => null, 'approaching' => false, 'rated' => false,
        ];

        if (! $b->rider_id || ! in_array($b->booking_status, ['rider_assigned', 'rider_arrived', 'in_progress', 'completed'], true)) {
            return $out;
        }

        $rider = Rider::find($b->rider_id);
        if (! $rider) {
            return $out;
        }
        $stats = BookingRating::where('rated_rider_id', $rider->id)->where('rater_type', 'passenger')->selectRaw('avg(rating) as a, count(*) as c')->first();
        $out['rider'] = [
            'name' => $rider->full_name,
            'photo_url' => $rider->profile_picture ? asset('storage/'.ltrim($rider->profile_picture, '/')) : null,
            'rating' => $stats && $stats->c ? round((float) $stats->a, 1) : null, 'rating_count' => (int) ($stats->c ?? 0),
            'plate' => $rider->motorcycle_plate_number, 'vehicle_type' => $rider->vehicle_type?->value ?? null,
            'phone' => $b->booking_status === 'completed' ? null : $rider->phone,
        ];
        $out['rated'] = BookingRating::where('booking_id', $b->id)->where('rater_type', 'passenger')->exists();

        if ($b->booking_status === 'completed') {
            return $out;
        }

        $loc = RiderLocation::where('rider_id', $rider->id)->first();
        if ($loc && $loc->last_location_update->timestamp > now()->timestamp - 120) {
            $out['rider_location'] = ['lat' => $loc->latitude, 'lng' => $loc->longitude, 'heading' => $loc->heading];
            $toDest = $b->booking_status === 'in_progress';
            $tLat = $toDest ? $b->destination_lat : $b->pickup_lat;
            $tLng = $toDest ? $b->destination_lng : $b->pickup_lng;
            if ($tLat !== null) {
                $m = DispatchService::distanceMeters($loc->latitude, $loc->longitude, (float) $tLat, (float) $tLng);
                $out['distance_to_target_m'] = (int) round($m);
                $out['eta_minutes'] = max(1, (int) ceil($m / 1000 * 1.3 / 25 * 60));
                $out['approaching'] = $b->booking_status === 'rider_assigned' && $m <= 300;
            }
        }

        return $out;
    }

    /** @return array{ok: false, code: string, message: string} */
    private function fail(string $code, string $message): array
    {
        return ['ok' => false, 'code' => $code, 'message' => $message];
    }
}