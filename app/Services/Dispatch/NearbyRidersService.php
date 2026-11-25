<?php

namespace App\Services\Dispatch;

use App\Enums\ServiceType;
use App\Models\DispatchSetting;
use Illuminate\Support\Facades\Cache;

/**
 * Anonymous "riders near you" data for the customer's booking map, shown before anything is booked.
 *
 * Privacy: only a position on a coarse grid is returned. No rider id, name, photo or plate ever leaves this class,
 * and riders are never returned one-to-one with their real coordinates.
 * Eligibility comes from DispatchService::eligibleRiders(), the same rule dispatch uses to send offers.
 */
class NearbyRidersService
{
    private const GRID_DEG = 0.0015;   // about 165 m: positions are snapped to the centre of a grid cell

    private const MAX_MARKERS = 30;

    public function __construct(private readonly DispatchService $dispatch) {}

    /** @return array{count: int, eta_minutes: ?int, radius_km: float, riders: list<array{lat: float, lng: float}>} */
    public function around(ServiceType $service, float $lat, float $lng): array
    {
        // Cache per service and ~1 km area for a few seconds so many customers cost one query, not one each.
        $key = sprintf('nearby:%s:%.2f:%.2f', $service->value, $lat, $lng);

        return Cache::remember($key, 8, fn () => $this->compute($service, $lat, $lng));
    }

    private function compute(ServiceType $service, float $lat, float $lng): array
    {
        $radiusKm = max(0.5, (float) DispatchSetting::get('nearby_radius_km', '3'));
        $fresh = max(1, (int) DispatchSetting::get('location_freshness_seconds', '60'));
        $dLat = $radiusKm / 111.32;
        $dLng = $radiusKm / (111.32 * max(0.01, cos(deg2rad($lat))));

        $rows = $this->dispatch->eligibleRiders($service, $fresh)
            ->whereBetween('l.latitude', [$lat - $dLat, $lat + $dLat])
            ->whereBetween('l.longitude', [$lng - $dLng, $lng + $dLng])
            ->limit(200)
            ->get(['l.latitude', 'l.longitude']);

        $nearest = null;
        $cells = [];
        $count = 0;
        foreach ($rows as $r) {
            $meters = DispatchService::distanceMeters($lat, $lng, (float) $r->latitude, (float) $r->longitude);
            if ($meters > $radiusKm * 1000) {
                continue;
            }
            $count++;
            $nearest = $nearest === null ? $meters : min($nearest, $meters);
            // Snap to the middle of a grid cell; riders in the same cell collapse into one marker.
            $cLat = (floor((float) $r->latitude / self::GRID_DEG) + 0.5) * self::GRID_DEG;
            $cLng = (floor((float) $r->longitude / self::GRID_DEG) + 0.5) * self::GRID_DEG;
            $cells[round($cLat, 5).','.round($cLng, 5)] = ['lat' => round($cLat, 5), 'lng' => round($cLng, 5)];
        }

        $markers = array_values($cells);
        shuffle($markers); // marker order must not reveal anything either
        $eta = $nearest === null ? null : max(1, (int) ceil(($nearest / 1000) * 1.3 / 25 * 60));

        return [
            'count' => $count,
            'eta_minutes' => $eta,
            'radius_km' => $radiusKm,
            'riders' => array_slice($markers, 0, self::MAX_MARKERS),
        ];
    }
}