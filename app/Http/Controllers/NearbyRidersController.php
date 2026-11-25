<?php

namespace App\Http\Controllers;

use App\Enums\ServiceType;
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
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        return response()->json(
            $nearby->around(ServiceType::from($d['service_type']), (float) $d['lat'], (float) $d['lng'])
        )->header('Cache-Control', 'no-store');
    }
}