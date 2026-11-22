<?php

namespace App\Services\Dispatch;

use App\Enums\BookingStatus;
use App\Enums\DispatchEventType as E;
use App\Enums\OfferStatus;
use App\Enums\RiderAvailabilityStatus;
use App\Enums\ServiceType;
use App\Events\DispatchEventOccurred as Raise;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\DispatchSetting;
use App\Models\Passenger;
use App\Models\Rider;
use App\Models\RiderAvailability;
use App\Models\RiderBookingOffer;
use App\Models\User;
use App\Support\PhilippinePhone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The dispatch engine. Every state change happens inside a DB transaction on a LOCKED booking row, so two requests
 * can never both change the same booking. Lock order is always: booking -> offer -> rider availability.
 */
class DispatchService
{
    private const AVG_SPEED_KMH = 25;      // used for pickup-time estimates until a road-routing API is plugged in

    private const ROAD_FACTOR = 1.3;       // straight line -> approximate road distance

    // ---------------------------------------------------------------- settings

    /** @return list<float> ascending search radii in km */
    public function radii(): array
    {
        $r = array_values(array_filter(array_map('floatval', explode(',', DispatchSetting::get('search_radii_km', '1,2,3,5,8'))), fn ($x) => $x > 0));
        sort($r);

        return $r ?: [1.0, 2.0, 3.0, 5.0, 8.0];
    }

    private function int(string $key, int $default): int
    {
        return max(1, (int) DispatchSetting::get($key, (string) $default));
    }

    // ---------------------------------------------------------------- create / cancel

    /**
     * Validates and creates a ride request and starts the search.
     *
     * @param  array{service_type?: string, pickup_location: string, destination: string, pickup_lat: float, pickup_lng: float, destination_lat?: ?float, destination_lng?: ?float}  $data
     */
    public function createBooking(Passenger $passenger, User $user, array $data): Booking
    {
        return DB::transaction(function () use ($passenger, $user, $data) {
            // Lock the passenger row so two simultaneous taps cannot both pass the duplicate check.
            $p = Passenger::whereKey($passenger->id)->lockForUpdate()->firstOrFail();

            if ($p->account_status !== 'active') {
                throw new DispatchException('account_inactive', 'Your account cannot make bookings right now. Please contact an administrator.');
            }
            if (Booking::where('passenger_id', $p->id)->whereIn('booking_status', BookingStatus::ACTIVE)->exists()) {
                throw new DispatchException('duplicate_active', 'You already have a booking in progress. Cancel it or wait until it is completed.');
            }

            $hasDest = isset($data['destination_lat'], $data['destination_lng']);
            if ($hasDest && abs($data['pickup_lat'] - $data['destination_lat']) < 0.00005 && abs($data['pickup_lng'] - $data['destination_lng']) < 0.00005) {
                throw new DispatchException('same_location', 'Pickup and destination must be different places.');
            }

            $service = ServiceType::fromInput($data['service_type'] ?? null);
            $extra = $this->serviceFields($service, $data);

            [$km, $min, $fare] = $this->estimate($data, $service);

            $booking = new Booking($extra + [
                'service_type' => $service,
                'passenger_id' => $p->id,
                'pickup_location' => $data['pickup_location'],
                'destination' => $data['destination'],
                'pickup_lat' => $data['pickup_lat'],
                'pickup_lng' => $data['pickup_lng'],
                'destination_lat' => $data['destination_lat'] ?? null,
                'destination_lng' => $data['destination_lng'] ?? null,
                'booking_status' => BookingStatus::Pending->value,
                'booking_date' => now(),
                'requested_at' => now(),
                'booking_reference' => 'BK-'.now()->format('ymd').'-'.Str::upper(Str::random(5)),
                'estimated_distance' => $km, 'estimated_duration' => $min, 'estimated_fare' => $fare,
            ]);
            $booking->save();

            $this->history($booking, null, BookingStatus::Pending, 'passenger', $user->id, 'Ride requested');
            Raise::raise(E::PassengerBookingRequestSubmitted, $booking->id);
            Raise::raise(E::AdminNewRideBooking, $booking->id);
            $this->startSearch($booking, 'passenger', $user->id);

            return $booking->refresh();
        });
    }

    /**
     * The service-specific columns, re-checked here (the form request already validated them) so that no caller can
     * save a ride without a valid passenger count or a delivery without its recipient and item details.
     *
     * @return array<string, mixed>
     */
    private function serviceFields(ServiceType $service, array $d): array
    {
        $notes = isset($d['notes']) && trim((string) $d['notes']) !== '' ? mb_substr(trim((string) $d['notes']), 0, 300) : null;

        if (! $service->isDelivery()) {
            $count = (int) ($d['passenger_count'] ?? 1);
            if ($count < 1 || $count > $service->maxPassengers()) {
                throw new DispatchException('invalid_passengers', sprintf('%s carries 1 to %d passenger(s).', $service->label(), $service->maxPassengers()));
            }

            return ['passenger_count' => $count, 'notes' => $notes];
        }

        $phone = PhilippinePhone::normalize($d['recipient_phone'] ?? null);
        $name = trim((string) ($d['recipient_name'] ?? ''));
        $item = trim((string) ($d['item_description'] ?? ''));
        $size = (string) ($d['package_size'] ?? '');
        if ($name === '' || $phone === null || $item === '' || ! array_key_exists($size, ServiceType::PACKAGE_SIZES)) {
            throw new DispatchException('invalid_delivery', 'Recipient name, recipient contact number, item description and package size are required for a delivery.');
        }

        return ['passenger_count' => null, 'notes' => $notes, 'recipient_name' => $name, 'recipient_phone' => PhilippinePhone::toLocal($phone),
            'item_description' => mb_substr($item, 0, 255), 'package_size' => $size];
    }

    /** Moves a PENDING booking into SEARCHING_FOR_RIDER and sends the first round of offers. */
    private function startSearch(Booking $booking, string $actor, ?int $userId): void
    {
        $now = now();
        $this->move($booking, BookingStatus::SearchingForRider, $actor, $userId, 'Searching for a rider', [
            'search_started_at' => $now, 'last_expansion_at' => $now, 'current_search_radius_km' => $this->radii()[0],
        ]);
        Raise::raise(E::PassengerSearchingForRider, $booking->id);
        $this->dispatchRound($booking);
    }

    /** @return array{ok: bool, code: string, message: string} */
    public function cancelByPassenger(string $bookingId, Passenger $passenger, ?int $userId): array
    {
        return DB::transaction(function () use ($bookingId, $passenger, $userId) {
            $b = Booking::whereKey($bookingId)->where('passenger_id', $passenger->id)->lockForUpdate()->first();
            if (! $b) {
                return $this->fail('not_found', 'Booking not found.');
            }
            $from = $b->status();
            if ($from === BookingStatus::InProgress || ! $from->canTransitionTo(BookingStatus::CancelledByPassenger)) {
                return $this->fail('not_cancellable', 'This booking can no longer be cancelled.');
            }

            $riderId = $b->rider_id;
            $this->move($b, BookingStatus::CancelledByPassenger, 'passenger', $userId, 'Cancelled by passenger', ['cancelled_at' => now()]);
            $this->closeOpenOffers($b, OfferStatus::Cancelled);
            if ($riderId) {
                $this->setAvailability($riderId, RiderAvailabilityStatus::OnlineAvailable);
                Raise::raise(E::PassengerCancelled, $b->id, $riderId);
            }
            Raise::raise(E::AdminBookingCancelled, $b->id, null, null, ['message' => 'cancelled by the passenger']);

            return ['ok' => true, 'code' => 'cancelled', 'message' => 'Booking cancelled.'];
        });
    }

    /**
     * Rider cancels after accepting. Before arrival the booking goes back to the search (the cancelling rider is never
     * offered it again). After arrival it ends as CANCELLED_BY_RIDER.
     *
     * @return array{ok: bool, code: string, message: string}
     */
    public function cancelByRider(string $bookingId, Rider $rider, ?int $userId, ?string $reason = null): array
    {
        return DB::transaction(function () use ($bookingId, $rider, $userId, $reason) {
            $b = Booking::whereKey($bookingId)->where('rider_id', $rider->id)->lockForUpdate()->first();
            if (! $b || ! in_array($b->booking_status, ['rider_assigned', 'rider_arrived'], true)) {
                return $this->fail('not_cancellable', 'This booking cannot be cancelled.');
            }
            $remarks = 'Cancelled by rider'.($reason ? ": $reason" : '');

            RiderBookingOffer::where('booking_id', $b->id)->where('rider_id', $rider->id)
                ->update(['offer_status' => OfferStatus::Cancelled->value]);
            $this->setAvailability($rider->id, RiderAvailabilityStatus::OnlineAvailable);

            if ($b->booking_status === 'rider_arrived') {
                $this->move($b, BookingStatus::CancelledByRider, 'rider', $userId, $remarks, ['cancelled_at' => now()]);
                Raise::raise(E::PassengerBookingCancelled, $b->id, null, null, ['message' => 'Your rider cancelled after arriving at the pickup point.']);
                Raise::raise(E::AdminBookingCancelled, $b->id, null, null, ['message' => 'cancelled by the rider after arrival']);

                return ['ok' => true, 'code' => 'cancelled', 'message' => 'Booking cancelled.'];
            }

            // Re-dispatch. The two history rows keep the audit trail complete; the status machine itself is bypassed
            // on purpose here because CANCELLED_BY_RIDER is otherwise terminal.
            $this->history($b, BookingStatus::RiderAssigned, BookingStatus::CancelledByRider, 'rider', $userId, $remarks);
            $this->history($b, BookingStatus::CancelledByRider, BookingStatus::SearchingForRider, 'system', null, 'Re-dispatching after rider cancellation');
            $now = now();
            $b->forceFill([
                'booking_status' => BookingStatus::SearchingForRider->value, 'rider_id' => null, 'assigned_at' => null,
                'search_started_at' => $now, 'last_expansion_at' => $now, 'current_search_radius_km' => $this->radii()[0],
            ])->save();
            Raise::raise(E::PassengerSearchingForRider, $b->id, null, null, ['message' => 'Your rider cancelled. We are finding you another rider.']);

            // Riders who lost the first race were never given a chance to decline: they are eligible again, so clear their
            // LOST_TO_ANOTHER_RIDER rows (the unique key would otherwise hide this booking from them forever).
            // The cancelling rider keeps a CANCELLED row, so they are never offered this booking again.
            RiderBookingOffer::where('booking_id', $b->id)->where('offer_status', OfferStatus::LostToAnotherRider->value)->delete();
            $this->dispatchRound($b);

            return ['ok' => true, 'code' => 'redispatched', 'message' => 'Booking cancelled. We are looking for another rider for the passenger.'];
        });
    }

    /**
     * Administrator intervention. It goes through the same locked, validated status machine as everyone else: it
     * cannot touch a trip that is already in progress and it cannot assign a rider (assignment is only ever by a rider's accept).
     * There is no separate "cancelled by admin" status in the required lifecycle, so it ends as CANCELLED_BY_PASSENGER
     * and the history row records actor_type = admin plus the reason.
     *
     * @return array{ok: bool, code: string, message: string}
     */
    public function cancelByAdmin(string $bookingId, ?int $userId, string $reason): array
    {
        return DB::transaction(function () use ($bookingId, $userId, $reason) {
            $b = Booking::whereKey($bookingId)->lockForUpdate()->first();
            if (! $b) {
                return $this->fail('not_found', 'Booking not found.');
            }
            $from = $b->status();
            if ($from === BookingStatus::InProgress || ! $from->canTransitionTo(BookingStatus::CancelledByPassenger)) {
                return $this->fail('not_cancellable', 'This booking can no longer be cancelled from here.');
            }

            $riderId = $b->rider_id;
            $this->move($b, BookingStatus::CancelledByPassenger, 'admin', $userId, 'Cancelled by administrator: '.$reason, ['cancelled_at' => now()]);
            $this->closeOpenOffers($b, OfferStatus::Cancelled);
            if ($riderId) {
                $this->setAvailability($riderId, RiderAvailabilityStatus::OnlineAvailable);
                Raise::raise(E::RideRequestCancelled, $b->id, $riderId);
            }
            Raise::raise(E::PassengerBookingCancelled, $b->id, null, null, ['message' => 'Your booking was cancelled by an administrator.']);
            Raise::raise(E::AdminBookingCancelled, $b->id, null, null, ['message' => 'cancelled by an administrator']);

            return ['ok' => true, 'code' => 'cancelled', 'message' => 'Booking cancelled.'];
        });
    }

    // ---------------------------------------------------------------- matching

    /**
     * Creates offers for riders who qualify inside the booking's CURRENT radius and have NOT been offered this booking yet.
     * The unique (booking_id, rider_id) key plus insertOrIgnore make repeated rounds safe.
     */
    public function dispatchRound(Booking $b): int
    {
        $radiusKm = (float) $b->current_search_radius_km;
        $ttl = $this->int('offer_expiration_seconds', 20);
        $fresh = $this->int('location_freshness_seconds', 60);
        $lat = (float) $b->pickup_lat;
        $lng = (float) $b->pickup_lng;

        // Cheap bounding-box prefilter in SQL, exact Haversine in PHP.
        $dLat = $radiusKm / 111.32;
        $dLng = $radiusKm / (111.32 * max(0.01, cos(deg2rad($lat))));

        $candidates = Rider::query()
            ->join('rider_availability as a', 'a.rider_id', '=', 'riders.id')
            ->join('rider_locations as l', 'l.rider_id', '=', 'riders.id')
            ->whereNotNull('riders.user_id')
            ->where('riders.application_status', 'approved')
            ->where('riders.account_status', 'active')
            ->where('riders.accreditation_status', 'accredited')
            ->where('riders.vehicle_type', $b->service()->vehicleType()->value) // MigoCars -> 4 wheels; MigoMoto / MigoDala -> 2 wheels
            ->where('a.is_online', true)
            ->where('a.availability_status', RiderAvailabilityStatus::OnlineAvailable->value)
            ->where('l.last_location_update', '>=', now()->subSeconds($fresh))
            ->whereBetween('l.latitude', [$lat - $dLat, $lat + $dLat])
            ->whereBetween('l.longitude', [$lng - $dLng, $lng + $dLng])
            ->whereNotIn('riders.id', Booking::whereIn('booking_status', BookingStatus::RIDER_COMMITTED)->whereNotNull('rider_id')->select('rider_id'))
            ->whereNotIn('riders.id', RiderBookingOffer::where('booking_id', $b->id)->select('rider_id'))
            ->get(['riders.id as rider_id', 'l.latitude', 'l.longitude']);

        $rows = [];
        $now = now();
        foreach ($candidates as $c) {
            $meters = self::distanceMeters($lat, $lng, (float) $c->latitude, (float) $c->longitude);
            if ($meters > $radiusKm * 1000) {
                continue;
            }
            $rows[] = [
                'booking_id' => $b->id, 'rider_id' => $c->rider_id, 'distance_to_pickup' => (int) round($meters),
                'estimated_pickup_time' => $this->etaMinutes($meters), 'offer_status' => OfferStatus::Sent->value,
                'notified_at' => $now, 'expires_at' => $now->copy()->addSeconds($ttl), 'created_at' => $now, 'updated_at' => $now,
            ];
        }
        usort($rows, fn ($x, $y) => $x['distance_to_pickup'] <=> $y['distance_to_pickup']);

        $inserted = $rows ? RiderBookingOffer::insertOrIgnore($rows) : 0;

        // One real-time NewRideRequest per newly created offer. Riders offered earlier were excluded above, so nobody is notified twice.
        if ($inserted) {
            RiderBookingOffer::where('booking_id', $b->id)->where('notified_at', $now)->whereIn('rider_id', array_column($rows, 'rider_id'))
                ->get(['id', 'rider_id'])
                ->each(fn ($o) => Raise::raise(E::NewRideRequest, $b->id, $o->rider_id, $o->id));
        }

        return $inserted;
    }

    /** Called every few seconds by the scheduler (php artisan dispatch:tick). */
    public function tick(): array
    {
        $stats = ['expired_offers' => $this->expireOffers(), 'expanded' => 0, 'offers' => 0, 'no_rider' => 0, 'approaching' => 0];

        $interval = $this->int('expansion_interval_seconds', 20);
        $maxDuration = $this->int('max_search_duration_seconds', 180);
        $radii = $this->radii();

        foreach (Booking::where('booking_status', 'searching_for_rider')->pluck('id') as $id) {
            DB::transaction(function () use ($id, $interval, $maxDuration, $radii, &$stats) {
                $b = Booking::whereKey($id)->lockForUpdate()->first();
                if (! $b || $b->booking_status !== 'searching_for_rider') {
                    return;
                }
                $now = now()->timestamp;
                $elapsed = $now - ($b->search_started_at?->timestamp ?? $now);

                if ($elapsed >= $maxDuration) {
                    $this->closeOpenOffers($b, OfferStatus::Expired);
                    $this->move($b, BookingStatus::NoRiderFound, 'system', null, 'No rider accepted within the maximum search time');
                    Raise::raise(E::PassengerNoRiderFound, $b->id);
                    Raise::raise(E::AdminNoRiderFound, $b->id);
                    if (! RiderBookingOffer::where('booking_id', $b->id)->exists()) {
                        Raise::raise(E::AdminRiderDispatchFailure, $b->id); // not a single eligible rider existed at any radius
                    }
                    $stats['no_rider']++;

                    return;
                }

                if ($now - ($b->last_expansion_at?->timestamp ?? 0) >= $interval) {
                    $current = (float) $b->current_search_radius_km;
                    $next = collect($radii)->first(fn ($r) => $r > $current + 0.0001);
                    $b->forceFill(['last_expansion_at' => now()] + ($next ? ['current_search_radius_km' => $next] : []))->save();
                    $next && $stats['expanded']++;
                }

                // Also catches riders who came online (or sent a fresh GPS fix) since the last round.
                $stats['offers'] += $this->dispatchRound($b);
            });
        }

        $stats['approaching'] = $this->notifyApproaching();

        return $stats;
    }

    /** Marks every overdue SENT offer as EXPIRED and tells each rider, so the request disappears from their screen. */
    private function expireOffers(): int
    {
        $due = RiderBookingOffer::where('offer_status', 'sent')->where('expires_at', '<=', now())->get(['id', 'booking_id', 'rider_id']);
        if ($due->isEmpty()) {
            return 0;
        }
        $count = RiderBookingOffer::whereIn('id', $due->pluck('id'))->where('offer_status', 'sent')
            ->update(['offer_status' => OfferStatus::Expired->value]);
        $due->each(fn ($o) => Raise::raise(E::RideRequestExpired, $o->booking_id, $o->rider_id, $o->id));

        return $count;
    }

    /**
     * Tells the passenger once, when the assigned rider gets within the "approaching" distance of the pickup point.
     * The notifications table itself is the de-duplication record (one per assignment).
     */
    public function notifyApproaching(): int
    {
        $radius = max(50, (int) DispatchSetting::get('approaching_radius_meters', '300'));

        $rows = DB::table('bookings')
            ->join('rider_locations as l', 'l.rider_id', '=', 'bookings.rider_id')
            ->join('passengers as p', 'p.id', '=', 'bookings.passenger_id')
            ->where('bookings.booking_status', 'rider_assigned')
            ->whereNotNull('bookings.pickup_lat')->whereNotNull('p.user_id')
            ->where('l.last_location_update', '>=', now()->subSeconds(120))
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('notifications')
                ->whereColumn('notifications.booking_id', 'bookings.id')
                ->where('notifications.event', E::PassengerRiderApproaching->value)
                ->whereColumn('notifications.created_at', '>=', 'bookings.assigned_at'))
            ->get(['bookings.id', 'bookings.rider_id', 'bookings.pickup_lat', 'bookings.pickup_lng', 'l.latitude', 'l.longitude']);

        $n = 0;
        foreach ($rows as $r) {
            if (self::distanceMeters((float) $r->latitude, (float) $r->longitude, (float) $r->pickup_lat, (float) $r->pickup_lng) <= $radius) {
                Raise::raise(E::PassengerRiderApproaching, $r->id, $r->rider_id);
                $n++;
            }
        }

        return $n;
    }

    // ---------------------------------------------------------------- rider responses

    /**
     * FIRST ACCEPTANCE WINS. The booking row is locked, so a second simultaneous request waits, then sees the booking
     * is no longer searching and gets "already_assigned". Everything is validated here, never in the client.
     *
     * @return array{ok: bool, code: string, message: string, booking?: Booking}
     */
    public function accept(Rider $rider, int $offerId): array
    {
        return DB::transaction(function () use ($rider, $offerId) {
            $first = RiderBookingOffer::where('id', $offerId)->where('rider_id', $rider->id)->first();
            if (! $first) {
                return $this->fail('offer_not_found', 'This ride request is no longer available.');
            }

            $b = Booking::whereKey($first->booking_id)->lockForUpdate()->first();
            $offer = RiderBookingOffer::whereKey($offerId)->lockForUpdate()->first();

            if ($b->booking_status !== 'searching_for_rider') {
                if ($offer->offer_status === OfferStatus::Sent) {
                    $offer->forceFill(['offer_status' => OfferStatus::LostToAnotherRider->value])->save();
                }
                $cancelled = str_starts_with($b->booking_status, 'cancelled') || in_array($b->booking_status, ['no_rider_found', 'expired'], true);

                return $cancelled
                    ? $this->fail('booking_cancelled', 'This ride request was cancelled.')
                    : $this->fail('already_assigned', 'Another rider has already accepted this booking.');
            }
            if ($offer->offer_status !== OfferStatus::Sent) {
                return $this->fail('offer_not_available', 'This ride request is no longer available.');
            }
            if ($offer->expires_at->lessThanOrEqualTo(now())) {
                $offer->forceFill(['offer_status' => OfferStatus::Expired->value])->save();

                return $this->fail('offer_expired', 'This ride request has expired.');
            }

            $avail = RiderAvailability::where('rider_id', $rider->id)->lockForUpdate()->first();
            if (! $avail || ! $avail->is_online || $avail->availability_status !== RiderAvailabilityStatus::OnlineAvailable) {
                return $this->fail('rider_unavailable', 'You must be online and available to accept a ride.');
            }
            if (! $rider->fresh()->canAcceptRequests()) {
                return $this->fail('not_eligible', 'Your account is not eligible to accept rides.');
            }
            if (Booking::where('rider_id', $rider->id)->whereIn('booking_status', BookingStatus::RIDER_COMMITTED)->exists()) {
                return $this->fail('rider_busy', 'You already have an active booking.');
            }

            $now = now();
            $this->move($b, BookingStatus::RiderAssigned, 'rider', $rider->user_id, 'Accepted by rider', ['rider_id' => $rider->id, 'assigned_at' => $now]);
            $offer->forceFill(['offer_status' => OfferStatus::Accepted->value, 'responded_at' => $now])->save();
            $losers = RiderBookingOffer::where('booking_id', $b->id)->where('id', '!=', $offer->id)->where('offer_status', 'sent')->get(['id', 'rider_id']);
            if ($losers->isNotEmpty()) {
                RiderBookingOffer::whereIn('id', $losers->pluck('id'))->update(['offer_status' => OfferStatus::LostToAnotherRider->value]);
            }
            $avail->forceFill(['availability_status' => RiderAvailabilityStatus::AcceptingBooking->value, 'last_active_at' => $now])->save();

            Raise::raise(E::RideAcceptedSuccessfully, $b->id, $rider->id, $offer->id);
            Raise::raise(E::PassengerRiderFound, $b->id, $rider->id);
            Raise::raise(E::AdminBookingAssigned, $b->id, $rider->id);
            $losers->each(fn ($l) => Raise::raise(E::RideAlreadyAccepted, $b->id, $l->rider_id, $l->id));

            return ['ok' => true, 'code' => 'assigned', 'message' => 'Ride accepted.', 'booking' => $b->refresh()];
        });
    }

    /** A decline only closes that one offer: the rider stays ONLINE_AVAILABLE. */
    public function decline(Rider $rider, int $offerId): bool
    {
        return RiderBookingOffer::where('id', $offerId)->where('rider_id', $rider->id)->where('offer_status', 'sent')
            ->update(['offer_status' => OfferStatus::Declined->value, 'responded_at' => now()]) > 0;
    }

    // ---------------------------------------------------------------- helpers

    /** Validates the transition, writes the new status and the history row. The booking row must already be locked. */
    public function move(Booking $b, BookingStatus $to, string $actor, ?int $userId, ?string $remarks = null, array $attrs = []): void
    {
        $from = $b->status();
        if (! $from->canTransitionTo($to)) {
            throw new DispatchException('invalid_transition', "A booking cannot change from {$from->value} to {$to->value}.");
        }
        $b->forceFill(['booking_status' => $to->value] + $attrs)->save();
        $this->history($b, $from, $to, $actor, $userId, $remarks);
    }

    private function history(Booking $b, ?BookingStatus $from, BookingStatus $to, string $actor, ?int $userId, ?string $remarks): void
    {
        BookingStatusHistory::create([
            'booking_id' => $b->id, 'previous_status' => $from?->value, 'new_status' => $to->value,
            'changed_by' => $userId, 'actor_type' => $actor, 'remarks' => $remarks,
        ]);
    }

    /** Closes every open offer of the booking and tells those riders (cancelled -> RideRequestCancelled, expired -> RideRequestExpired). */
    private function closeOpenOffers(Booking $b, OfferStatus $as): void
    {
        $open = RiderBookingOffer::where('booking_id', $b->id)->where('offer_status', 'sent')->get(['id', 'rider_id']);
        if ($open->isEmpty()) {
            return;
        }
        RiderBookingOffer::whereIn('id', $open->pluck('id'))->where('offer_status', 'sent')->update(['offer_status' => $as->value]);
        $type = $as === OfferStatus::Cancelled ? E::RideRequestCancelled : E::RideRequestExpired;
        $open->each(fn ($o) => Raise::raise($type, $b->id, $o->rider_id, $o->id));
    }

    public function setAvailability(string $riderId, RiderAvailabilityStatus $status): void
    {
        RiderAvailability::where('rider_id', $riderId)->update(['availability_status' => $status->value, 'last_active_at' => now()]);
    }

    /** @return array{ok: false, code: string, message: string} */
    private function fail(string $code, string $message): array
    {
        return ['ok' => false, 'code' => $code, 'message' => $message];
    }

    private function etaMinutes(float $meters): int
    {
        return max(1, (int) ceil(($meters / 1000) * self::ROAD_FACTOR / self::AVG_SPEED_KMH * 60));
    }

    /**
     * The fare rules, read from the admin dispatch settings. Migo pricing: a base fare covers the first `base_km`
     * kilometres (PHP 20.00 for the first 1 km); every additional kilometre is charged at `per_km`. `minimum` is a
     * floor for the whole fare and defaults to the base fare, so it never changes a normal ride.
     *
     * @return array{base: float, base_km: float, per_km: float, minimum: float, road_factor: float, avg_speed_kmh: int}
     */
    public static function fareConfig(?ServiceType $service = null): array
    {
        $service ??= ServiceType::MigoMoto;
        $k = $service->fareKeys();
        // MigoCars / MigoDala read their own keys (seeded by a migration, edited in Admin > Settings). If a key is
        // missing they fall back to the MigoMoto rate rather than failing, so a quote is never blocked.
        $moto = ServiceType::MigoMoto->fareKeys();
        $get = fn (string $name, string $default) => (float) DispatchSetting::get($k[$name], DispatchSetting::get($moto[$name], $default));

        return [
            'base' => $get('base', '20'),
            'base_km' => $get('base_km', '1'),
            'per_km' => $get('per_km', '10'),
            'minimum' => $get('minimum', '20'),
            'road_factor' => self::ROAD_FACTOR,
            'avg_speed_kmh' => self::AVG_SPEED_KMH,
        ];
    }

    /**
     * THE fare calculation. Used by the booking page quote, by estimate() when a booking is saved and by the final
     * fare when a trip completes, so the customer, the rider and the admin always see the same rules.
     *
     * @return array{base_fare: float, base_km: float, extra_km: float, per_km: float, extra_charge: float, other_charges: float, total: float}
     */
    public static function fareForKm(float $km, ?ServiceType $service = null): array
    {
        $c = self::fareConfig($service);
        $extraKm = round(max(0.0, $km - $c['base_km']), 2);
        $extra = round($c['per_km'] * $extraKm, 2);
        $raw = $c['base'] + $extra;
        $total = round(max($c['minimum'], $raw), 2);

        return [
            'base_fare' => round($c['base'], 2),
            'base_km' => $c['base_km'],
            'extra_km' => $extraKm,
            'per_km' => $c['per_km'],
            'extra_charge' => $extra,
            // Only non-zero if an admin sets the minimum fare above base + distance.
            'other_charges' => round(max(0.0, $total - $raw), 2),
            'total' => $total,
        ];
    }

    /** Approximate road distance in km between two points (straight line x road factor). */
    public static function roadKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        return round(self::distanceMeters($lat1, $lng1, $lat2, $lng2) / 1000 * self::ROAD_FACTOR, 2);
    }

    /** Estimated ride time in minutes for a road distance. */
    public static function minutesForKm(float $km): int
    {
        return max(1, (int) ceil($km / self::AVG_SPEED_KMH * 60));
    }

    /**
     * Fare quote for the booking page, shown before the customer confirms. Nothing is saved.
     *
     * @return array{distance_km: float, minutes: int, base_fare: float, base_km: float, extra_km: float, per_km: float, extra_charge: float, other_charges: float, total: float}
     */
    public static function quote(float $pickupLat, float $pickupLng, float $destLat, float $destLng, ?ServiceType $service = null): array
    {
        $km = self::roadKm($pickupLat, $pickupLng, $destLat, $destLng);

        return ['service_type' => ($service ?? ServiceType::MigoMoto)->value, 'distance_km' => $km, 'minutes' => self::minutesForKm($km)] + self::fareForKm($km, $service);
    }

    /** @return array{0: ?float, 1: ?int, 2: ?float} distance km, duration min, fare */
    private function estimate(array $d, ServiceType $service): array
    {
        if (! isset($d['destination_lat'], $d['destination_lng'])) {
            return [null, null, null];
        }
        $km = self::roadKm($d['pickup_lat'], $d['pickup_lng'], $d['destination_lat'], $d['destination_lng']);

        return [$km, self::minutesForKm($km), self::fareForKm($km, $service)['total']];
    }

    /** Haversine great-circle distance in metres. */
    public static function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371000;
        $a = sin(deg2rad($lat2 - $lat1) / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin(deg2rad($lng2 - $lng1) / 2) ** 2;

        return 2 * $r * asin(min(1, sqrt($a)));
    }
}
