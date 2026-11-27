<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ServiceType;
use App\Http\Controllers\Controller;
use App\Models\DispatchSetting;
use App\Services\Dispatch\DispatchService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin Settings = dispatch settings. Every active administrator can view them; only a super administrator can change them.
 * The hard rider requirements (approved, active, accredited, online, available, fresh GPS, not on another trip) are
 * safety rules in DispatchService and are intentionally NOT switchable here.
 */
class DispatchSettingsController extends Controller
{
    /** Values used when a key has never been saved (must match the defaults inside the dispatch services). */
    private const DEFAULTS = [
        'expansion_interval_seconds' => 20, 'offer_expiration_seconds' => 20, 'max_search_duration_seconds' => 180,
        'location_freshness_seconds' => 60, 'auto_offline_seconds' => 300, 'arrival_radius_meters' => 300, 'approaching_radius_meters' => 500,
        // Rider free trial (SubscriptionService reads these; the defaults match its constants).
        'trial_hours' => 72, 'trial_daily_limit' => 3,
        // Rider orientation: most riders scheduled on one day (RiderAccreditation reads it; default 30).
        'orientation_daily_limit' => 30,
    ];

    /** Radius (km) of the anonymous "riders near you" map on the customer booking page (NearbyRidersService reads it). */
    private const NEARBY_DEFAULT = 3;

    /** Passenger capacity per service (MigoDala carries a package, not passengers). */
    private const CAPACITY = ['migomoto_max_passengers' => [1, 1, 2], 'migocars_max_passengers' => [4, 1, 8]]; // default, min, max

    /** Steps between the initial and the maximum radius (km). */
    private const STEPS = [1, 2, 3, 5, 8, 10, 15, 20, 30, 50];

    public function edit(Request $request, DispatchService $dispatch): Response
    {
        $radii = $dispatch->radii();
        $values = ['initial_radius_km' => $radii[0], 'max_radius_km' => end($radii)];
        $values['nearby_radius_km'] = (float) DispatchSetting::get('nearby_radius_km', (string) self::NEARBY_DEFAULT);
        foreach (self::DEFAULTS as $key => $default) {
            $values[$key] = (int) DispatchSetting::get($key, (string) $default);
        }

        // Fares for every service (MigoMoto keeps its original keys; MigoCars and MigoDala have their own).
        foreach (ServiceType::cases() as $service) {
            foreach (DispatchService::fareConfig($service) as $name => $value) {
                if (isset($service->fareKeys()[$name])) {
                    $values[$service->fareKeys()[$name]] = (float) $value;
                }
            }
        }
        foreach (self::CAPACITY as $key => [$default]) {
            $values[$key] = (int) DispatchSetting::get($key, (string) $default);
        }

        return Inertia::render('admin/dispatch-settings', [
            'values' => $values,
            'radii' => $radii,
            'stepOptions' => self::STEPS,
            'canEdit' => $this->isSuperAdmin($request),
            'status' => $request->session()->get('status'),
        ]);
    }

    public function update(Request $request, DispatchService $dispatch): RedirectResponse
    {
        abort_unless($this->isSuperAdmin($request), 403);

        $d = $request->validate([
            'initial_radius_km' => ['required', 'numeric', 'min:0.1', 'max:50'],
            'max_radius_km' => ['required', 'numeric', 'gte:initial_radius_km', 'max:50'],
            // The pre-booking map can never promise riders from further away than dispatch will actually search.
            'nearby_radius_km' => ['required', 'numeric', 'min:0.5', 'lte:max_radius_km'],
            'expansion_interval_seconds' => ['required', 'integer', 'between:5,300'],
            'offer_expiration_seconds' => ['required', 'integer', 'between:5,120'],
            'max_search_duration_seconds' => ['required', 'integer', 'between:30,1800', 'gte:offer_expiration_seconds', function ($attribute, $value, $fail) use ($request) {
                // The search must last long enough to widen all the way to the maximum radius AND give the last riders time to answer.
                $needed = $this->secondsToReachMaxRadius($request->all());
                if ($needed !== null && (int) $value < $needed) {
                    $fail("Too short to reach the maximum radius. Use at least {$needed} seconds, or widen faster, or lower the maximum radius.");
                }
            }],
            'location_freshness_seconds' => ['required', 'integer', 'between:15,600'],
            // A rider must not be switched offline before their GPS is even considered stale.
            'auto_offline_seconds' => ['required', 'integer', 'between:60,3600', 'gte:location_freshness_seconds'],
            'arrival_radius_meters' => ['required', 'integer', 'between:0,2000'],
            // The "rider is close" alert has to fire before the point where the rider can confirm arrival.
            'approaching_radius_meters' => ['required', 'integer', 'between:50,2000', 'gt:arrival_radius_meters'],
            'trial_hours' => ['required', 'integer', 'between:1,720'],
            'trial_daily_limit' => ['required', 'integer', 'between:1,50'],
            'orientation_daily_limit' => ['required', 'integer', 'between:1,200'],
            ...$this->fareRules(),
            'migomoto_max_passengers' => ['required', 'integer', 'between:1,2'],
            'migocars_max_passengers' => ['required', 'integer', 'between:1,8'],
        ]);

        $initial = round((float) $d['initial_radius_km'], 2);
        $max = round((float) $d['max_radius_km'], 2);
        $steps = collect(self::STEPS)->filter(fn ($x) => $x > $initial && $x < $max)->prepend($initial)->push($max)->unique()->sort()->values();

        $new = ['nearby_radius_km' => rtrim(rtrim(number_format((float) $d['nearby_radius_km'], 2, '.', ''), '0'), '.')];
        $new += ['search_radii_km' => $steps->map(fn ($x) => rtrim(rtrim(number_format($x, 2, '.', ''), '0'), '.'))->implode(',')];
        foreach (array_keys(self::DEFAULTS) as $key) {
            $new[$key] = (string) $d[$key];
        }

        foreach (array_merge(array_keys($this->fareRules()), array_keys(self::CAPACITY)) as $key) {
            $new[$key] = rtrim(rtrim(number_format((float) $d[$key], 2, '.', ''), '0'), '.') ?: '0';
        }

        $admin = $request->user()->adminProfile;
        $changes = [];

        DB::transaction(function () use ($new, $request, $admin, &$changes) {
            foreach ($new as $key => $value) {
                $old = DispatchSetting::query()->whereKey($key)->value('value');
                if ($old === $value) {
                    continue;
                }
                DispatchSetting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'updated_by' => $request->user()->id]);
                $changes[] = "{$key}: ".($old ?? 'default')." -> {$value}";
            }

            if ($changes) {
                DB::table('audit_logs')->insert([
                    'id' => (string) Str::uuid(), 'admin_id' => $admin->id, 'action' => 'dispatch.settings_updated',
                    'description' => Str::limit(implode('; ', $changes), 1000, '...'), 'subject_type' => 'dispatch_settings', 'subject_id' => null, 'created_at' => now(),
                ]);
            }
        });

        DispatchSetting::flush();

        return back()->with('status', $changes ? 'Dispatch settings saved. New bookings use them immediately.' : 'No changes to save.');
    }

    /** @return array<string, list<string>> validation for every fare key of every service */
    private function fareRules(): array
    {
        $rules = [];
        foreach (ServiceType::cases() as $service) {
            foreach ($service->fareKeys() as $name => $key) {
                $rules[$key] = ['required', 'numeric', 'min:0', $name === 'base_km' ? 'max:50' : 'max:10000'];
                if ($name === 'minimum') {
                    $rules[$key][] = 'gte:'.$service->fareKeys()['base']; // a floor below the base fare would never apply
                }
            }
        }

        return $rules;
    }

    /** Seconds needed to widen to the maximum radius and let the last round of offers run out; null when the input is not usable yet. */
    private function secondsToReachMaxRadius(array $in): ?int
    {
        foreach (['initial_radius_km', 'max_radius_km', 'expansion_interval_seconds', 'offer_expiration_seconds'] as $k) {
            if (! isset($in[$k]) || ! is_numeric($in[$k])) {
                return null;
            }
        }
        $initial = (float) $in['initial_radius_km'];
        $max = (float) $in['max_radius_km'];
        $steps = collect(self::STEPS)->filter(fn ($x) => $x > $initial && $x < $max)->count() + ($max > $initial ? 1 : 0);

        return $steps * (int) $in['expansion_interval_seconds'] + (int) $in['offer_expiration_seconds'];
    }

    private function isSuperAdmin(Request $request): bool
    {
        $user = $request->user();

        return $user->isActiveAdmin() && $user->adminProfile?->role === 'super_admin';
    }
}