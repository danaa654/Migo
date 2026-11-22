<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Riders\AccreditationException;
use App\Actions\Riders\RiderAccreditation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRemarksRequest;
use App\Http\Requests\Admin\GrantAccreditationRequest;
use App\Http\Requests\Admin\RecordDocumentVerificationRequest;
use App\Http\Requests\Admin\RecordInspectionRequest;
use App\Http\Requests\Admin\RecordOrientationResultRequest;
use App\Http\Requests\Admin\RevokeAccreditationRequest;
use App\Http\Requests\Admin\ScheduleOrientationRequest;
use App\Models\AdminProfile;
use App\Models\Rider;
use App\Models\RiderOrientation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Admin > Rider Management > Accreditation (backend foundation; no UI yet).
 * Mounted under the ['auth', EnsureActiveAdmin] group in routes/web.php. Each action also re-checks
 * isActiveAdmin() (in its FormRequest) and the service re-checks the staff member, so it is protected on its own.
 *
 * JSON clients get the updated progress summary (422 for workflow violations, 403 for authorization failures);
 * browser clients are redirected back with a toast, like the rest of Rider Management.
 */
class RiderAccreditationController extends Controller
{
    public function show(Request $request, Rider $rider, RiderAccreditation $service): JsonResponse
    {
        abort_unless($request->user()?->isActiveAdmin(), 403);

        return response()->json($service->summary($rider));
    }

    public function verifyDocuments(RecordDocumentVerificationRequest $request, Rider $rider, RiderAccreditation $service): JsonResponse|RedirectResponse
    {
        return $this->run($request, $rider, $service, 'Document verification recorded.',
            fn ($staff) => $service->recordDocumentVerification($rider, $staff, $request->validated()));
    }

    public function scheduleOrientation(ScheduleOrientationRequest $request, Rider $rider, RiderAccreditation $service): JsonResponse|RedirectResponse
    {
        return $this->run($request, $rider, $service, 'Orientation scheduled.',
            fn ($staff) => $service->scheduleOrientation($rider, $staff, $request->validated()));
    }

    public function orientationResult(RecordOrientationResultRequest $request, Rider $rider, RiderOrientation $orientation, RiderAccreditation $service): JsonResponse|RedirectResponse
    {
        abort_unless($orientation->rider_id === $rider->id, 404);

        return $this->run($request, $rider, $service, 'Orientation result recorded.',
            fn ($staff) => $service->recordOrientationResult($rider, $orientation, $staff, $request->validated()));
    }

    public function recordInspection(RecordInspectionRequest $request, Rider $rider, RiderAccreditation $service): JsonResponse|RedirectResponse
    {
        $data = $request->validated();
        $data['inspected_at'] = $data['inspected_on'] ?? null;
        unset($data['inspected_on']);

        return $this->run($request, $rider, $service, 'Motorcycle inspection recorded.',
            fn ($staff) => $service->recordInspection($rider, $staff, $data));
    }

    public function grant(GrantAccreditationRequest $request, Rider $rider, RiderAccreditation $service): JsonResponse|RedirectResponse
    {
        return $this->run($request, $rider, $service, "{$rider->full_name} is now accredited.",
            fn ($staff) => $service->grant($rider, $staff, $request->validated('remarks')));
    }

    public function revoke(RevokeAccreditationRequest $request, Rider $rider, RiderAccreditation $service): JsonResponse|RedirectResponse
    {
        return $this->run($request, $rider, $service, "{$rider->full_name}'s accreditation has been revoked.",
            fn ($staff) => $service->revoke($rider, $staff, $request->validated('reason')));
    }

    public function remarks(AdminRemarksRequest $request, Rider $rider, RiderAccreditation $service): JsonResponse|RedirectResponse
    {
        return $this->run($request, $rider, $service, 'Remarks saved.',
            fn ($staff) => $service->addRemarks($rider, $staff, $request->validated('remarks')));
    }

    /** @param callable(AdminProfile): mixed $do */
    private function run(Request $request, Rider $rider, RiderAccreditation $service, string $success, callable $do): JsonResponse|RedirectResponse
    {
        abort_unless($request->user()?->isActiveAdmin(), 403);

        try {
            $do($request->user()->adminProfile); // AuthorizationException is rendered as 403 by the framework
        } catch (AccreditationException $e) {
            if ($request->expectsJson()) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
            Inertia::flash('toast', ['type' => 'error', 'message' => $e->getMessage()]);

            return back();
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => $success, 'accreditation' => $service->summary($rider)]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $success]);

        return back();
    }
}
