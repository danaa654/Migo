<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Passengers\PassengerStatusException;
use App\Actions\Passengers\UpdatePassengerStatus;
use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SuspendRiderRequest;
use App\Models\AdminProfile;
use App\Models\Booking;
use App\Models\Passenger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin > Passenger Management. Reading (list, detail) needs the "passengers" area; changing a status needs
 * "passengers_manage" (Administrator only; Support Staff are read-only). Passengers are never created or deleted
 * here: they sign up themselves and their bookings / complaints keep their history.
 */
class PassengerManagementController extends Controller
{
    private const PER_PAGE = 10;

    /** Sortable columns the client may ask for (whitelist; anything else falls back to the default). */
    private const SORTS = ['full_name', 'email', 'phone', 'created_at', 'account_status', 'bookings_count', 'last_booking_at'];

    private const STATUSES = ['active', 'suspended', 'deactivated'];

    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $status = in_array($request->query('status'), self::STATUSES, true) ? $request->query('status') : null;
        $sort = in_array($request->query('sort'), self::SORTS, true) ? $request->query('sort') : 'created_at';
        $direction = $request->query('direction') === 'asc' ? 'asc' : 'desc';

        $passengers = Passenger::query()
            ->with('user')
            ->withCount([
                'bookings',
                'bookings as completed_count' => fn ($q) => $q->where('booking_status', BookingStatus::Completed->value),
                'bookings as cancelled_count' => fn ($q) => $q->where('booking_status', BookingStatus::CancelledByPassenger->value),
            ])
            ->withMax('bookings as last_booking_at', 'created_at')
            ->when($search !== '', function ($q) use ($search) {
                // "!" is the LIKE escape character, so %, _ typed by the admin match literally.
                $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_substr($search, 0, 100)).'%';
                $q->where(fn ($w) => $w
                    ->whereRaw("full_name like ? escape '!'", [$like])
                    ->orWhereRaw("email like ? escape '!'", [$like])
                    ->orWhereRaw("phone like ? escape '!'", [$like])
                    ->orWhereRaw("id like ? escape '!'", [$like]));
            })
            ->when($status, fn ($q, $s) => $q->where('account_status', $s))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Passenger $p) => [
                'id' => $p->id,
                'full_name' => $p->full_name !== '' ? $p->full_name : null,
                'email' => $p->email,
                'phone' => $p->phone !== '' ? $p->phone : null,
                'sign_in_methods' => $p->user?->signInMethods() ?? [],
                'account_status' => $p->account_status,
                'bookings_count' => (int) $p->bookings_count,
                'completed_count' => (int) $p->completed_count,
                'cancelled_count' => (int) $p->cancelled_count,
                'last_booking_at' => $p->last_booking_at ? Carbon::parse($p->last_booking_at)->toIso8601String() : null,
                'created_at' => $p->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/passengers/index', [
            'stats' => $this->stats(),
            'passengers' => $passengers,
            'filters' => ['search' => $search, 'status' => $status, 'sort' => $sort, 'direction' => $direction],
            'canManage' => (bool) $request->user()?->canAccessAdminArea('passengers_manage'),
        ]);
    }

    public function show(Request $request, Passenger $passenger): Response
    {
        $passenger->load('user');

        $counts = Booking::query()->where('passenger_id', $passenger->id)->selectRaw(
            "count(*) as total,
             coalesce(sum(case when booking_status = 'completed' then 1 else 0 end), 0) as completed,
             coalesce(sum(case when booking_status = 'cancelled_by_passenger' then 1 else 0 end), 0) as cancelled_by_passenger,
             coalesce(sum(case when booking_status = 'cancelled_by_rider' then 1 else 0 end), 0) as cancelled_by_rider,
             coalesce(sum(case when booking_status = 'no_rider_found' then 1 else 0 end), 0) as no_rider_found"
        )->toBase()->first();

        $bookings = Booking::query()
            ->with('rider:id,full_name')
            ->where('passenger_id', $passenger->id)
            ->orderByDesc('created_at')
            ->limit(15)
            ->get()
            ->map(fn (Booking $b) => [
                'id' => $b->id,
                'reference' => $b->booking_reference,
                'service' => $b->service_type?->label(),
                'pickup' => $b->pickup_location,
                'destination' => $b->destination,
                'status' => $b->booking_status,
                'fare' => $b->final_fare ?? $b->estimated_fare,
                'rider' => $b->rider?->full_name,
                'created_at' => $b->created_at?->toIso8601String(),
            ])->values();

        // Ratings this passenger gave to riders.
        $ratings = $passenger->user_id
            ? DB::table('booking_ratings as r')
                ->leftJoin('riders as rd', 'rd.id', '=', 'r.rated_rider_id')
                ->where('r.rater_type', 'passenger')->where('r.rater_user_id', $passenger->user_id)
                ->orderByDesc('r.created_at')->limit(10)
                ->get(['r.id', 'r.booking_id', 'r.rating', 'r.comment', 'r.created_at', 'rd.full_name as rider_name'])
            : collect();

        // Complaints this passenger filed.
        $complaints = DB::table('complaints')
            ->where('reporter_type', 'passenger')->where('reporter_id', $passenger->id)
            ->orderByDesc('created_at')->limit(10)
            ->get(['id', 'complaint_category', 'complaint_status', 'created_at']);

        $history = DB::table('audit_logs as a')
            ->leftJoin('admin_profiles as p', 'p.id', '=', 'a.admin_id')
            ->where('a.subject_type', 'passenger')->where('a.subject_id', $passenger->id)
            ->orderByDesc('a.created_at')
            ->select('a.id', 'a.action', 'a.description as reason', 'a.created_at', 'p.full_name as admin_name')
            ->get();

        return Inertia::render('admin/passengers/show', [
            'passenger' => [
                'id' => $passenger->id,
                'full_name' => $passenger->full_name !== '' ? $passenger->full_name : null,
                'email' => $passenger->email,
                'phone' => $passenger->phone !== '' ? $passenger->phone : null,
                'sign_in_methods' => $passenger->user?->signInMethods() ?? [],
                'account_status' => $passenger->account_status,
                'suspension_reason' => $passenger->suspension_reason,
                'has_account' => $passenger->user_id !== null,
                'has_active_booking' => Booking::query()->where('passenger_id', $passenger->id)->whereIn('booking_status', BookingStatus::ACTIVE)->exists(),
                'created_at' => $passenger->created_at?->toIso8601String(),
            ],
            'tripStats' => array_map('intval', (array) $counts),
            'bookings' => $bookings,
            'ratings' => $ratings,
            'complaints' => $complaints,
            'history' => $history,
            'canManage' => (bool) $request->user()?->canAccessAdminArea('passengers_manage'),
        ]);
    }

    public function suspend(SuspendRiderRequest $request, Passenger $passenger, UpdatePassengerStatus $action): RedirectResponse
    {
        return $this->run($request, fn ($admin) => $action->suspend($passenger, $admin, $request->validated('reason')), $this->label($passenger).' has been suspended.');
    }

    public function deactivate(SuspendRiderRequest $request, Passenger $passenger, UpdatePassengerStatus $action): RedirectResponse
    {
        return $this->run($request, fn ($admin) => $action->deactivate($passenger, $admin, $request->validated('reason')), $this->label($passenger).' has been deactivated.');
    }

    public function reactivate(Request $request, Passenger $passenger, UpdatePassengerStatus $action): RedirectResponse
    {
        return $this->run($request, fn ($admin) => $action->reactivate($passenger, $admin), $this->label($passenger).' has been reactivated.');
    }

    /** @param callable(AdminProfile): mixed $do */
    private function run(Request $request, callable $do, string $success): RedirectResponse
    {
        // Re-checked here so the write actions stay protected even if a route's middleware is ever changed.
        abort_unless($request->user()?->canAccessAdminArea('passengers_manage'), 403);

        try {
            $do($request->user()->adminProfile);
            Inertia::flash('toast', ['type' => 'success', 'message' => $success]);
        } catch (PassengerStatusException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $e->getMessage()]);
        }

        return back();
    }

    private function label(Passenger $passenger): string
    {
        return $passenger->full_name !== '' ? $passenger->full_name : 'The passenger';
    }

    /** @return array<string, int> Live counts from the passengers table (one query). */
    private function stats(): array
    {
        $r = Passenger::query()->selectRaw(
            "count(*) as total,
             coalesce(sum(case when account_status = 'active' then 1 else 0 end), 0) as active,
             coalesce(sum(case when account_status = 'suspended' then 1 else 0 end), 0) as suspended,
             coalesce(sum(case when account_status = 'deactivated' then 1 else 0 end), 0) as deactivated"
        )->toBase()->first();

        return array_map('intval', (array) $r);
    }
}