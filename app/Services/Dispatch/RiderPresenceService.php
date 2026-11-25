<?php

namespace App\Services\Dispatch;

use App\Enums\BookingStatus;
use App\Enums\OfferStatus;
use App\Enums\RiderAvailabilityStatus;
use App\Models\Booking;
use App\Models\BookingRoutePoint;
use App\Models\DispatchSetting;
use App\Models\Rider;
use App\Models\RiderAvailability;
use App\Models\RiderBookingOffer;
use App\Models\RiderLocation;
use Illuminate\Support\Facades\DB;

/** A rider's online/offline state and GPS position. All values are validated on the server. */
class RiderPresenceService
{
    private function freshSeconds(): int
    {
        return max(1, (int) DispatchSetting::get('location_freshness_seconds', '60'));
    }

    /** @return array{ok: bool, code: string, message: string} */
    public function updateLocation(Rider $rider, array $d): array
    {
        $lat = (float) $d['latitude'];
        $lng = (float) $d['longitude'];
        $accuracy = isset($d['accuracy']) ? (float) $d['accuracy'] : null;

        if (abs($lat) < 0.0001 && abs($lng) < 0.0001) {
            return $this->fail('invalid_location', 'Invalid GPS location.');
        }
        if ($accuracy !== null && $accuracy > 200) {
            return $this->fail('low_accuracy', 'GPS accuracy is too low (over 200 m). Move to an open area.');
        }

        $prev = RiderLocation::where('rider_id', $rider->id)->first();
        if ($prev && $prev->last_location_update->timestamp > now()->timestamp - 60) {
            $seconds = max(1, now()->timestamp - $prev->last_location_update->timestamp);
            $kmh = DispatchService::distanceMeters($prev->latitude, $prev->longitude, $lat, $lng) / $seconds * 3.6;
            if ($kmh > 200) {
                return $this->fail('implausible_jump', 'Location jump rejected.');
            }
        }

        RiderLocation::updateOrCreate(['rider_id' => $rider->id], [
            'latitude' => $lat, 'longitude' => $lng, 'accuracy' => $accuracy,
            'heading' => $d['heading'] ?? null, 'speed' => $d['speed'] ?? null,
            'last_location_update' => now(), // server clock, never the device clock
        ]);
        RiderAvailability::where('rider_id', $rider->id)->update(['last_active_at' => now()]);

        // While a trip is IN_PROGRESS, keep the route (at most one point every 5 s).
        $trip = Booking::where('rider_id', $rider->id)->where('booking_status', 'in_progress')->value('id');
        if ($trip) {
            $last = BookingRoutePoint::where('booking_id', $trip)->latest('id')->value('recorded_at');
            if (! $last || strtotime((string) $last) <= now()->timestamp - 5) {
                BookingRoutePoint::create(['booking_id' => $trip, 'latitude' => $lat, 'longitude' => $lng, 'speed' => $d['speed'] ?? null, 'recorded_at' => now()]);
            }
        }

        return ['ok' => true, 'code' => 'ok', 'message' => 'Location updated.'];
    }

    /** @return array{ok: bool, code: string, message: string} */
    public function goOnline(Rider $rider): array
    {
        $access = app(\App\Services\Subscriptions\SubscriptionService::class)->access($rider);
        if (! $access['allowed']) {
            return $this->fail($access['code'], $access['message']);
        }

        return DB::transaction(function () use ($rider) {
            $loc = RiderLocation::where('rider_id', $rider->id)->first();
            if (! $loc || $loc->last_location_update->timestamp < now()->timestamp - $this->freshSeconds()) {
                return $this->fail('no_location', 'We cannot see your GPS location yet. Turn on location access and try again.');
            }

            RiderAvailability::firstOrCreate(['rider_id' => $rider->id], ['availability_status' => RiderAvailabilityStatus::Offline->value, 'is_online' => false]);
            $avail = RiderAvailability::where('rider_id', $rider->id)->lockForUpdate()->first();

            $active = Booking::where('rider_id', $rider->id)->whereIn('booking_status', BookingStatus::RIDER_COMMITTED)->first();
            $status = ! $active ? RiderAvailabilityStatus::OnlineAvailable
                : ($active->booking_status === 'in_progress' ? RiderAvailabilityStatus::OnTrip : RiderAvailabilityStatus::AcceptingBooking);

            $avail->forceFill(['is_online' => true, 'availability_status' => $status->value, 'last_active_at' => now()])->save();

            return ['ok' => true, 'code' => 'online', 'message' => 'You are online.'];
        });
    }

    /** @return array{ok: bool, code: string, message: string} */
    public function goOffline(Rider $rider): array
    {
        return DB::transaction(function () use ($rider) {
            if (Booking::where('rider_id', $rider->id)->whereIn('booking_status', BookingStatus::RIDER_COMMITTED)->exists()) {
                return $this->fail('active_booking', 'Finish or cancel your active booking before going offline.');
            }
            RiderAvailability::where('rider_id', $rider->id)->update(['is_online' => false, 'availability_status' => RiderAvailabilityStatus::Offline->value]);
            RiderBookingOffer::where('rider_id', $rider->id)->where('offer_status', 'sent')->update(['offer_status' => OfferStatus::Cancelled->value]);

            return ['ok' => true, 'code' => 'offline', 'message' => 'You are offline.'];
        });
    }

    /** Riders who stopped sending GPS (app closed, no signal) are taken offline and their open offers are cancelled. */
    public function sweepStale(): int
    {
        $cut = now()->subSeconds(max(30, (int) DispatchSetting::get('auto_offline_seconds', '300')));
        $ids = RiderAvailability::where('is_online', true)->where('availability_status', RiderAvailabilityStatus::OnlineAvailable->value)
            ->where(fn ($q) => $q->whereNull('last_active_at')->orWhere('last_active_at', '<', $cut))
            ->pluck('rider_id');

        if ($ids->isEmpty()) {
            return 0;
        }
        RiderAvailability::whereIn('rider_id', $ids)->update(['is_online' => false, 'availability_status' => RiderAvailabilityStatus::Offline->value]);
        RiderBookingOffer::whereIn('rider_id', $ids)->where('offer_status', 'sent')->update(['offer_status' => OfferStatus::Cancelled->value]);

        return $ids->count();
    }

    /** @return array{ok: false, code: string, message: string} */
    private function fail(string $code, string $message): array
    {
        return ['ok' => false, 'code' => $code, 'message' => $message];
    }
}
