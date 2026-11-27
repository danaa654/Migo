<?php

namespace App\Http\Controllers;

use App\Http\Requests\Biker\UpdateBikerPasswordRequest;
use App\Http\Requests\Biker\UpdateBikerPhotoRequest;
use App\Http\Requests\Biker\UpdateBikerProfileRequest;
use App\Models\Rider;
use App\Support\BikerShellData;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The signed-in rider's own profile: contact details, the photo passengers see, and the password.
 * Always scoped to the signed-in rider (no id in the URL). Accreditation data (name, licence, plate, vehicle, the
 * registration selfie and every status) is shown read-only and can only be changed by administrators.
 */
class BikerProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $rider = $this->rider($request);

        return Inertia::render('biker/biker-profile', [
            ...BikerShellData::props($user),
            'status' => $request->session()->get('status'),
            'canBook' => $rider->canAcceptRequests(),
            'profile' => [
                'full_name' => $rider->full_name,
                'email' => $user->email,
                'phone' => $rider->phone,
                'address' => $rider->address,
                'vehicle_type' => $rider->vehicle_type?->label(),
                'license_number' => $rider->license_number,
                'plate_number' => $rider->motorcycle_plate_number,
                'accredited' => $rider->isAccredited(),
                'avatar_url' => $this->url($rider->avatar_path),
                'registration_photo_url' => $this->url($rider->profile_picture),
                'can_change_password' => (bool) $user->canChangePassword(),
            ],
        ]);
    }

    public function update(UpdateBikerProfileRequest $request): RedirectResponse
    {
        $rider = $this->rider($request);
        $rider->forceFill($request->safe()->only(['phone', 'address']))->save();

        return back()->with('status', 'Profile saved.');
    }

    public function updatePhoto(UpdateBikerPhotoRequest $request): RedirectResponse
    {
        $rider = $this->rider($request);
        $old = $rider->avatar_path;

        $path = $request->file('avatar')->store('rider-avatars', 'public');
        $rider->forceFill(['avatar_path' => $path])->save();

        // Only the replaced avatar is deleted. The registration selfie (profile_picture) is never touched.
        if ($old && $old !== $path) {
            Storage::disk('public')->delete($old);
        }

        return back()->with('status', 'Profile photo updated.');
    }

    public function removePhoto(Request $request): RedirectResponse
    {
        $rider = $this->rider($request);

        if ($rider->avatar_path) {
            Storage::disk('public')->delete($rider->avatar_path);
            $rider->forceFill(['avatar_path' => null])->save();
        }

        return back()->with('status', 'Profile photo removed.');
    }

    public function updatePassword(UpdateBikerPasswordRequest $request): RedirectResponse
    {
        abort_unless($request->user()->canChangePassword(), 403);

        $request->user()->update(['password' => $request->validated('password')]); // hashed by the User model cast

        return back()->with('status', 'Password changed.');
    }

    private function rider(Request $request): Rider
    {
        return $request->user()->rider ?? abort(404);
    }

    private function url(?string $path): ?string
    {
        return $path && Storage::disk('public')->exists($path) ? '/storage/'.ltrim($path, '/') : null;
    }
}