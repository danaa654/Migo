<?php

namespace App\Http\Controllers;

use App\Actions\Riders\RiderAccreditation;
use App\Models\Booking;
use App\Models\BookingRating;
use App\Support\BikerShellData;
use App\Support\RiderDocuments;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class BikerDashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $rider = $user->rider;

        return Inertia::render('biker/biker-dashboard', [
            'account' => ['name' => $user->name, 'email' => $user->email],
            'applicationStatus' => $rider?->application_status,
            'accountStatus' => $rider?->account_status,
            // Shown to the rider so they can review the decision (set by an administrator).
            'rejectionReason' => $rider?->application_status === 'rejected' ? $rider->rejection_reason : null,
            'suspensionReason' => $rider?->isSuspended() ? $rider->suspension_reason : null,
            // Accreditation progress (rider-safe view: no staff names or internal remarks). Additive prop.
            'accreditation' => $rider ? app(RiderAccreditation::class)->summary($rider, forRider: true) : null,
            // What the rider submitted: their own profile details and the four uploaded documents (view only).
            'profile' => $rider ? [
                'full_name' => $rider->full_name,
                'email' => $rider->email,
                'phone' => $rider->phone,
                'address' => $rider->address,
                'photo_url' => $rider->profile_picture && Storage::disk('public')->exists($rider->profile_picture) ? '/storage/'.$rider->profile_picture : null,
                'vehicle_type' => $rider->vehicle_type?->label(),
                'license_number' => $rider->license_number,
                'license_expiry' => $rider->license_expiry?->toDateString(),
                'plate_number' => $rider->motorcycle_plate_number,
                'registered_at' => $rider->created_at?->toIso8601String(),
            ] : null,
            'documents' => $rider ? RiderDocuments::forRider($rider) : [],
            'notifications' => BikerShellData::notifications($user->id),
            // Trip / earnings / rating summary for the dashboard cards. Additive prop; null when unavailable.
            'stats' => $rider ? $this->stats($rider->id) : null,
        ]);
    }

    /** Marks the signed-in biker's own notifications as read. */
    public function markNotificationsRead(Request $request): RedirectResponse
    {
        try {
            DB::table('notifications')->where('user_id', $request->user()->id)->where('is_read', false)->update(['is_read' => true]);
        } catch (Throwable $e) {
            report($e);
        }

        return back();
    }

    /**
     * Completed-trip totals, this week's daily earnings (Mon-Sun) and the latest trips for the signed-in rider.
     *
     * @return array<string, mixed>|null  null when the booking tables are unavailable
     */
    private function stats(string $riderId): ?array
    {
        try {
            $done = fn () => Booking::query()->where('rider_id', $riderId)->where('booking_status', 'completed');
            $weekStart = now()->startOfWeek();

            $weekRows = $done()->where('completed_at', '>=', $weekStart)->get(['id', 'final_fare', 'completed_at']);
            $days = collect(range(0, 6))->map(function (int $i) use ($weekStart, $weekRows) {
                $day = $weekStart->copy()->addDays($i);
                $rows = $weekRows->filter(fn ($b) => $b->completed_at?->isSameDay($day));

                return [
                    'label' => $day->format('D'),
                    'earnings' => (float) $rows->sum('final_fare'),
                    'trips' => $rows->count(),
                    'is_today' => $day->isToday(),
                ];
            })->all();

            $ratings = BookingRating::query()->where('rated_rider_id', $riderId)->where('rater_type', 'passenger');
            $average = (clone $ratings)->avg('rating');

            return [
                'total_trips' => $done()->count(),
                'total_earnings' => (float) $done()->sum('final_fare'),
                'rating' => $average !== null ? round((float) $average, 1) : null,
                'rating_count' => (clone $ratings)->count(),
                'week' => [
                    'trips' => $weekRows->count(),
                    'earnings' => (float) $weekRows->sum('final_fare'),
                    'days' => $days,
                ],
                'recent' => $done()->latest('completed_at')->limit(5)
                    ->get(['id', 'booking_reference', 'pickup_location', 'destination', 'estimated_distance', 'final_fare', 'estimated_fare', 'completed_at'])
                    ->map(fn ($b) => [
                        'id' => $b->id,
                        'reference' => $b->booking_reference,
                        'pickup' => $b->pickup_location,
                        'destination' => $b->destination,
                        'distance' => $b->estimated_distance,
                        'fare' => $b->final_fare ?? $b->estimated_fare,
                        'completed_at' => $b->completed_at?->toIso8601String(),
                    ])->all(),
            ];
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }
}