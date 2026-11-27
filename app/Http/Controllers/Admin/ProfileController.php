<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateAdminPasswordRequest;
use App\Http\Requests\Admin\UpdateAdminPhotoRequest;
use App\Models\AdminProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * "My Profile" for every active staff account (Administrator, Operations Admin, Support Staff): change the own
 * password and the own profile photo. Always scoped to the signed-in staff member (no id in the URL), so nobody can
 * touch someone else's account here. Name, email and role are read-only: only the Administrator manages those
 * (Staff Accounts).
 */
class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $profile = $this->profile($request);

        return Inertia::render('admin/profile', [
            'status' => $request->session()->get('status'),
            'profile' => [
                'full_name' => $profile->full_name,
                'email' => $user->email ?? $profile->email,
                'role_label' => $profile->roleLabel(),
                'avatar_url' => $this->url($profile->avatar_path),
            ],
        ]);
    }

    public function updatePhoto(UpdateAdminPhotoRequest $request): RedirectResponse
    {
        $profile = $this->profile($request);
        $old = $profile->avatar_path;

        $path = $request->file('avatar')->store('admin-avatars', 'public');
        $profile->forceFill(['avatar_path' => $path])->save();

        if ($old && $old !== $path) {
            Storage::disk('public')->delete($old);
        }

        return back()->with('status', 'Profile photo updated.');
    }

    public function removePhoto(Request $request): RedirectResponse
    {
        $profile = $this->profile($request);

        if ($profile->avatar_path) {
            Storage::disk('public')->delete($profile->avatar_path);
            $profile->forceFill(['avatar_path' => null])->save();
        }

        return back()->with('status', 'Profile photo removed.');
    }

    public function updatePassword(UpdateAdminPasswordRequest $request): RedirectResponse
    {
        // Hashed by the User model cast. A staff member who just set a password from the emailed link has has_password = true.
        $request->user()->forceFill(['password' => $request->validated('password'), 'has_password' => true])->save();

        return back()->with('status', 'Password changed.');
    }

    private function profile(Request $request): AdminProfile
    {
        return $request->user()->adminProfile ?? abort(404);
    }

    private function url(?string $path): ?string
    {
        return $path && Storage::disk('public')->exists($path) ? '/storage/'.ltrim($path, '/') : null;
    }
}
