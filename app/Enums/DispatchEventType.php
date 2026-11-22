<?php

namespace App\Enums;

/**
 * Every real-time dispatch event (spec section 7). The value is stored in notifications.event.
 * Names follow the spec; where passenger and admin share a name the case is prefixed with the audience.
 */
enum DispatchEventType: string
{
    // ---- Passenger
    case PassengerBookingRequestSubmitted = 'passenger.booking_request_submitted';
    case PassengerSearchingForRider = 'passenger.searching_for_rider';
    case PassengerRiderFound = 'passenger.rider_found';
    case PassengerRiderApproaching = 'passenger.rider_approaching';
    case PassengerRiderArrived = 'passenger.rider_arrived';
    case PassengerTripStarted = 'passenger.trip_started';
    case PassengerTripCompleted = 'passenger.trip_completed';
    case PassengerBookingCancelled = 'passenger.booking_cancelled';
    case PassengerNoRiderFound = 'passenger.no_rider_found';

    // ---- Rider
    case NewRideRequest = 'rider.new_ride_request';
    case RideRequestExpired = 'rider.ride_request_expired';
    case RideRequestCancelled = 'rider.ride_request_cancelled';
    case RideAcceptedSuccessfully = 'rider.ride_accepted_successfully';
    case RideAlreadyAccepted = 'rider.ride_already_accepted';
    case PassengerCancelled = 'rider.passenger_cancelled';
    case TripStatusUpdated = 'rider.trip_status_updated';

    // ---- Admin
    case AdminNewRideBooking = 'admin.new_ride_booking';
    case AdminBookingAssigned = 'admin.booking_assigned';
    case AdminBookingCancelled = 'admin.booking_cancelled';
    case AdminNoRiderFound = 'admin.no_rider_found';
    case AdminRiderDispatchFailure = 'admin.rider_dispatch_failure';

    /** @return 'passenger'|'rider'|'admin' */
    public function audience(): string
    {
        return explode('.', $this->value)[0];
    }

    /** Whether a push notification is sent in addition to the in-app notification (admins never get pushes). */
    public function pushes(): bool
    {
        return in_array($this, [
            self::PassengerRiderFound, self::PassengerRiderApproaching, self::PassengerRiderArrived,
            self::PassengerTripStarted, self::PassengerTripCompleted, self::PassengerBookingCancelled, self::PassengerNoRiderFound,
            self::NewRideRequest, self::RideRequestCancelled, self::PassengerCancelled,
        ], true);
    }

    /**
     * Title and message shown to the recipient. $c may contain: reference, pickup, destination, fare, trip_km,
     * final_fare, status, distance_m, pickup_min, rider_name, plate, message (caller override).
     * Rider offers never include passenger contact details.
     *
     * @param  array<string, mixed>  $c
     * @return array{title: string, message: string}
     */
    public function render(array $c): array
    {
        $ref = $c['reference'] ?? 'your booking';
        $override = $c['message'] ?? null;
        $peso = fn ($v) => '₱'.number_format((float) $v, 2);

        return match ($this) {
            self::PassengerBookingRequestSubmitted => ['title' => 'Ride requested', 'message' => "Your request {$ref} has been sent."],
            self::PassengerSearchingForRider => ['title' => 'Finding nearby riders...', 'message' => $override ?? 'Please wait while we connect you with an available rider.'],
            self::PassengerRiderFound => ['title' => 'Rider Found!', 'message' => trim(($c['rider_name'] ?? 'A rider').(isset($c['plate']) ? " ({$c['plate']})" : '').' accepted your ride and is on the way.')],
            self::PassengerRiderApproaching => ['title' => 'Your rider is nearby', 'message' => ($c['rider_name'] ?? 'Your rider').' is almost at your pickup point.'],
            self::PassengerRiderArrived => ['title' => 'Your rider has arrived', 'message' => 'Your rider has arrived at your pickup location.'],
            self::PassengerTripStarted => ['title' => 'Trip started', 'message' => 'Your trip'.(isset($c['destination']) ? " to {$c['destination']}" : '').' has started.'],
            self::PassengerTripCompleted => ['title' => 'Trip completed', 'message' => (isset($c['final_fare']) ? 'Fare '.$peso($c['final_fare']).'. ' : '').'Please rate your rider.'],
            self::PassengerBookingCancelled => ['title' => 'Booking cancelled', 'message' => $override ?? "Your booking {$ref} was cancelled."],
            self::PassengerNoRiderFound => ['title' => 'No rider found', 'message' => "Sorry, we couldn't find an available rider nearby. Please try again."],

            self::NewRideRequest => ['title' => 'NEW RIDE REQUEST!', 'message' => trim(
                (isset($c['distance_m']) ? 'Pickup '.($c['distance_m'] >= 1000 ? round($c['distance_m'] / 1000, 1).' km' : $c['distance_m'].' m').' away' : 'A passenger nearby is looking for a rider')
                .(isset($c['pickup_min']) ? " (about {$c['pickup_min']} min)" : '').'. '
                .(isset($c['trip_km']) ? "Trip {$c['trip_km']} km. " : '')
                .(isset($c['fare']) ? 'Fare '.$peso($c['fare']).'. ' : '')
                .(isset($c['pickup']) ? $c['pickup'] : '').(isset($c['destination']) ? ' to '.$c['destination'] : '')
            )],
            self::RideRequestExpired => ['title' => 'Ride request expired', 'message' => 'You did not respond in time, so this request was removed.'],
            self::RideRequestCancelled => ['title' => 'Ride request cancelled', 'message' => 'This ride request is no longer available.'],
            self::RideAcceptedSuccessfully => ['title' => 'Ride accepted', 'message' => 'Head to the pickup point'.(isset($c['pickup']) ? ": {$c['pickup']}" : '').". Booking {$ref}."],
            self::RideAlreadyAccepted => ['title' => 'Ride already taken', 'message' => 'Another rider accepted this booking first.'],
            self::PassengerCancelled => ['title' => 'Passenger cancelled', 'message' => "Booking {$ref} was cancelled by the passenger. You are available for new requests again."],
            self::TripStatusUpdated => ['title' => 'Trip updated', 'message' => "Booking {$ref} is now ".str_replace('_', ' ', (string) ($c['status'] ?? 'updated')).'.'],

            self::AdminNewRideBooking => ['title' => 'New ride booking', 'message' => "{$ref}: ".($c['pickup'] ?? '?').' to '.($c['destination'] ?? '?').'.'],
            self::AdminBookingAssigned => ['title' => 'Booking assigned', 'message' => "{$ref} was accepted by ".($c['rider_name'] ?? 'a rider').'.'],
            self::AdminBookingCancelled => ['title' => 'Booking cancelled', 'message' => "{$ref} was cancelled".(isset($c['message']) ? ": {$c['message']}" : '.')],
            self::AdminNoRiderFound => ['title' => 'No rider found', 'message' => "{$ref} timed out without a rider accepting."],
            self::AdminRiderDispatchFailure => ['title' => 'Dispatch failure', 'message' => "{$ref}: no eligible rider was found at any search radius."],
        };
    }
}
