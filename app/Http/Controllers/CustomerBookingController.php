<?php

namespace App\Http\Controllers;

use App\Enums\ServiceType;
use App\Http\Requests\Customer\StoreBookingRequest;
use App\Models\Booking;
use App\Services\Dispatch\DispatchException;
use App\Services\Dispatch\DispatchService;
use App\Services\Dispatch\TripService;
use App\Support\BookingResume;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** A customer's own bookings. Every query is scoped to the signed-in customer's passenger profile. */
class CustomerBookingController extends Controller
{
    private const COLUMNS = ['id', 'booking_reference', 'pickup_location', 'destination', 'booking_status', 'booking_date', 'created_at',
        'pickup_lat', 'pickup_lng', 'destination_lat', 'destination_lng', 'estimated_distance', 'estimated_duration', 'estimated_fare', 'final_fare', 'service_type', 'passenger_count', 'notes', 'recipient_name',
        'recipient_phone', 'item_description', 'package_size'];

    /** Book a Ride form (or the current active booking, since only one is allowed at a time). */
    public function create(Request $request): Response
    {
        $passenger = $request->user()->passenger;

        return Inertia::render('customer/customer-book', [
            'services' => self::services(),
            'initialService' => self::requestedService($request),
            'status' => $request->session()->get('status'),
            'canBook' => $passenger?->account_status === 'active',
            'accountStatus' => $passenger?->account_status ?? 'active',
            'active' => $passenger
                ? Booking::where('passenger_id', $passenger->id)->whereIn('booking_status', Booking::ACTIVE)
                    ->latest('created_at')->first(self::COLUMNS)
                : null,
        ]);
    }

    /**
     * The three services for the selection screen. "starting_fare" is the configured minimum fare for that service
     * (Admin > Settings), so no price is written into the page.
     *
     * @return list<array<string, mixed>>
     */
    private static function services(): array
    {
        return array_map(fn (ServiceType $s) => [
            'key' => $s->value, 'name' => $s->label(), 'description' => $s->description(), 'is_delivery' => $s->isDelivery(),
            'max_passengers' => $s->maxPassengers(), 'starting_fare' => DispatchService::fareConfig($s)['minimum'],
            'package_sizes' => $s->isDelivery() ? ServiceType::PACKAGE_SIZES : null,
        ], ServiceType::cases());
    }

    /** ?service=migomoto (or MIGOMOTO) opens that service's form directly; anything else shows the selection screen. */
    private static function requestedService(Request $request): ?string
    {
        return ServiceType::tryFrom(strtoupper((string) $request->query('service')))?->value;
    }

    /** Public booking page for guests. Signed-in users are sent to their own page; the booking itself still needs a login. */
    public function guest(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if ($user) {
            $path = $user->dashboardPath();

            return redirect(str_starts_with($path, '/customer') ? '/customer/book' : $path);
        }

        BookingResume::mark($request->session());

        return Inertia::render('customer/customer-book', [
            'services' => self::services(),
            'initialService' => self::requestedService($request),
            'status' => null,
            'canBook' => true,
            'accountStatus' => 'active',
            'active' => null,
            'guest' => true,
        ]);
    }

    /**
     * Fare quote for the booking page (public, nothing is saved). The same DispatchService rules are applied again
     * when the booking is stored, so the price shown here is the price saved on the booking.
     */
    public function quote(Request $request): JsonResponse
    {
        $d = $request->validate([
            'service_type' => ['nullable', Rule::enum(ServiceType::class)],
            'pickup_lat' => ['required', 'numeric', 'between:-90,90'],
            'pickup_lng' => ['required', 'numeric', 'between:-180,180'],
            'destination_lat' => ['required', 'numeric', 'between:-90,90'],
            'destination_lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        if (abs($d['pickup_lat'] - $d['destination_lat']) < 0.00005 && abs($d['pickup_lng'] - $d['destination_lng']) < 0.00005) {
            return response()->json(['message' => 'Pickup and destination must be different places.'], 422);
        }

        return response()->json(DispatchService::quote((float) $d['pickup_lat'], (float) $d['pickup_lng'], (float) $d['destination_lat'], (float) $d['destination_lng'], ServiceType::fromInput($d['service_type'] ?? null)));
    }

    public function index(Request $request): Response
    {
        $passenger = $request->user()->passenger;

        return Inertia::render('customer/customer-bookings', [
            'status' => $request->session()->get('status'),
            'bookings' => $passenger
                ? Booking::where('passenger_id', $passenger->id)->latest('created_at')->limit(100)->get(self::COLUMNS)
                : [],
        ]);
    }

    public function store(StoreBookingRequest $request, DispatchService $dispatch): RedirectResponse
    {
        $passenger = $request->user()->passenger;

        if (! $passenger) {
            return back()->withErrors(['pickup_location' => 'Your account cannot make bookings right now. Please contact an administrator.']);
        }

        try {
            $booking = $dispatch->createBooking($passenger, $request->user(), $request->validated());
        } catch (DispatchException $e) {
            return back()->withErrors(['pickup_location' => $e->getMessage()]);
        }

        return to_route('customer.ride', $booking->id);
    }

    /** The ride status page. The page itself polls live(). */
    public function show(Request $request, string $booking): Response
    {
        $row = $this->own($request, $booking);

        return Inertia::render('customer/customer-ride', ['bookingId' => $row->id, 'status' => $request->session()->get('status')]);
    }

    public function live(Request $request, string $booking, TripService $trips): JsonResponse
    {
        return response()->json($trips->live($this->own($request, $booking)));
    }

    /** A customer may cancel their own booking until the trip starts. Offers are invalidated by the dispatch service. */
    public function cancel(Request $request, string $booking, DispatchService $dispatch): RedirectResponse
    {
        $passenger = $request->user()->passenger;
        abort_unless($passenger, 403);

        $result = $dispatch->cancelByPassenger($booking, $passenger, $request->user()->id);

        return back()->with('status', $result['message']);
    }

    public function retry(Request $request, string $booking, TripService $trips): JsonResponse
    {
        $result = $trips->retry($booking, $request->user()->passenger ?? abort(403), $request->user()->id);

        return response()->json($result, $result['ok'] ? 200 : 409);
    }

    public function rate(Request $request, string $booking, TripService $trips): JsonResponse
    {
        $d = $request->validate(['rating' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:500']]);
        $result = $trips->rateByPassenger($booking, $request->user()->passenger ?? abort(403), $request->user()->id, (int) $d['rating'], $d['comment'] ?? null);

        return response()->json($result, $result['ok'] ? 200 : 409);
    }

    /** The booking, only if it belongs to the signed-in customer (404 otherwise, so ids cannot be probed). */
    private function own(Request $request, string $booking): Booking
    {
        $passenger = $request->user()->passenger;
        abort_unless($passenger, 403);

        return Booking::where('id', $booking)->where('passenger_id', $passenger->id)->firstOrFail();
    }
}
