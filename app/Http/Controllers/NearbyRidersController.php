<?php

namespace App\Http\Controllers;

use App\Enums\ServiceType;
use App\Enums\VehicleType;
use App\Services\Dispatch\NearbyRidersService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Public, read-only: anonymous nearby-rider markers for the booking map. Nothing is saved. */
class NearbyRidersController extends Controller
{
    public function __invoke(Request $request, NearbyRidersService $nearby): JsonResponse
    {
        $d = $request->validate([
            'service_type' => ['required', Rule::enum(ServiceType::class)],
            // MigoDala only: count motorcycle or car riders. Ignored for rides.
            'vehicle' => ['nullable', Rule::enum(VehicleType::class)],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $service = ServiceType::from($d['service_type']);
        $vehicle = $service->isDelivery() ? VehicleType::tryFrom((string) ($d['vehicle'] ?? '')) : null;

        return response()->json(
            $nearby->around($service, (float) $d['lat'], (float) $d['lng'], $vehicle)
        )->header('Cache-Control', 'no-store');
    }
}