<?php

namespace App\Http\Controllers;

use App\Actions\Riders\RiderAccreditation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only: a biker sees their own accreditation progress. Riders have no endpoint that can change it. */
class BikerAccreditationController extends Controller
{
    public function __invoke(Request $request, RiderAccreditation $service): JsonResponse
    {
        $rider = $request->user()->rider;
        abort_unless($rider, 404);

        return response()->json($service->summary($rider, forRider: true));
    }
}
