<?php

namespace App\Listeners;

use App\Events\DispatchEventOccurred;
use App\Models\Booking;
use App\Models\Rider;
use App\Models\RiderBookingOffer;
use App\Services\Dispatch\PushNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Writes the in-app notification (existing `notifications` table) and sends the push.
 * Runs synchronously but is fully guarded: any failure is reported and swallowed so dispatch keeps working.
 * Recipient: passenger events -> the passenger's account, rider events -> that rider's account, admin events -> user_id NULL (admin feed).
 */
class DeliverDispatchNotification
{
    public function __construct(private PushNotifier $push) {}

    public function handle(DispatchEventOccurred $e): void
    {
        try {
            $this->deliver($e);
        } catch (Throwable $ex) {
            report($ex);
        }
    }

    private function deliver(DispatchEventOccurred $e): void
    {
        $type = $e->type;
        $booking = Booking::with('passenger:id,user_id')->find($e->bookingId);
        if (! $booking) {
            return;
        }

        $userId = match ($type->audience()) {
            'passenger' => $booking->passenger?->user_id,
            'rider' => $e->riderId ? Rider::whereKey($e->riderId)->value('user_id') : null,
            default => null,
        };
        if ($type->audience() !== 'admin' && ! $userId) {
            return; // recipient has no account to notify
        }

        $context = $this->context($e, $booking);
        ['title' => $title, 'message' => $message] = $type->render($context);

        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(), 'title' => $title, 'message' => $message, 'notification_type' => 'dispatch',
            'is_read' => false, 'created_at' => now(), 'user_id' => $userId, 'booking_id' => $booking->id,
            'event' => $type->value, 'data' => json_encode(['offer_id' => $e->offerId, 'rider_id' => $e->riderId, 'status' => $booking->booking_status]),
        ]);

        if ($userId && $type->pushes()) {
            try {
                $this->push->send((int) $userId, $title, $message, ['event' => $type->value, 'booking_id' => $booking->id]);
            } catch (Throwable $ex) {
                report($ex); // the in-app notification above is already saved
            }
        }
    }

    /** @return array<string, mixed> */
    private function context(DispatchEventOccurred $e, Booking $b): array
    {
        $c = $e->context + [
            'reference' => $b->booking_reference, 'pickup' => $b->pickup_location, 'destination' => $b->destination,
            'fare' => $b->estimated_fare, 'trip_km' => $b->estimated_distance, 'final_fare' => $b->final_fare, 'status' => $b->booking_status,
        ];

        if ($e->offerId && ($o = RiderBookingOffer::find($e->offerId))) {
            $c['distance_m'] = $o->distance_to_pickup;
            $c['pickup_min'] = $o->estimated_pickup_time;
        }
        if ($e->riderId && ($r = Rider::find($e->riderId))) {
            $c['rider_name'] = $r->full_name;
            $c['plate'] = $r->motorcycle_plate_number;
        }

        return array_filter($c, fn ($v) => $v !== null);
    }
}
