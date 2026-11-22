<?php

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Models\Booking;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class CustomerDashboardController extends Controller
{
    private const COLUMNS = ['id', 'booking_reference', 'pickup_location', 'destination', 'booking_status', 'booking_date',
        'estimated_fare', 'final_fare', 'created_at', 'service_type'];

    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $passenger = $user->passenger;

        return Inertia::render('customer/customer-dashboard', [
            'account' => ['name' => $user->name, 'email' => $user->email],
            'profile' => [
                'phone' => $passenger?->phone ?: null,
                'accountStatus' => $passenger?->account_status ?? 'active',
                'memberSince' => $user->created_at?->toDateString(),
            ],
            // Read-only summary of the customer's own bookings. null = bookings table unavailable.
            'bookings' => $passenger ? $this->bookings($passenger->id) : null,
        ]);
    }

    /** @return array{total: int, completed: int, spent: float, active: mixed, recent: mixed}|null */
    private function bookings(string $passengerId): ?array
    {
        try {
            $own = fn () => Booking::query()->where('passenger_id', $passengerId);

            return [
                'total' => $own()->count(),
                'completed' => $own()->where('booking_status', 'completed')->count(),
                'spent' => (float) $own()->where('booking_status', 'completed')->sum('final_fare'),
                // Uses the real lifecycle statuses (the old list, pending/accepted/ongoing, never matched a live ride).
                'active' => $own()->whereIn('booking_status', BookingStatus::ACTIVE)->latest('created_at')->first(self::COLUMNS),
                'recent' => $own()->latest('created_at')->limit(5)->get(self::COLUMNS),
            ];
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }
}
