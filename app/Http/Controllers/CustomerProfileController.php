<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customer\SetCustomerPasswordRequest;
use App\Http\Requests\Customer\UpdateCustomerPasswordRequest;
use App\Http\Requests\Customer\UpdateCustomerProfileRequest;
use App\Models\Passenger;
use App\Support\PhilippinePhone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** The signed-in customer's own profile. Only their own records are ever read or changed. */
class CustomerProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $passenger = $user->passenger;
        $verified = $user->phone && $user->phone_verified_at;

        return Inertia::render('customer/customer-profile', [
            'status' => $request->session()->get('status'),
            'account' => ['name' => $user->name, 'email' => $user->email],
            'profile' => [
                'full_name' => $passenger?->full_name ?: $user->name,
                'email' => $user->email,
                // Verified number (source of truth: users.phone, E.164). "legacy" is a number typed at the old
                // registration that has not been confirmed by SMS yet, offered as a starting point.
                'phone' => [
                    'verified' => (bool) $verified,
                    'display' => $verified ? PhilippinePhone::format($user->phone) : null,
                    'legacy' => ! $verified && $passenger?->phone ? $passenger->phone : '',
                ],
                'sign_in_methods' => $user->signInMethods(),
                'can_change_password' => $user->canChangePassword(),
                'can_set_password' => $user->canSetPassword(),
                'needs_profile' => $user->needsProfileCompletion(),
            ],
        ]);
    }

    public function update(UpdateCustomerProfileRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $firstTime = $user->needsProfileCompletion();

        DB::transaction(function () use ($user, $data) {
            $user->forceFill(['name' => $data['full_name']])->save();

            // Keep the passengers row in sync. The phone is never changed here: it only changes after an SMS code.
            Passenger::updateOrCreate(
                ['user_id' => $user->id],
                ['full_name' => $data['full_name'], 'email' => $user->email, 'phone' => $user->passenger?->phone ?? ($user->phone ? PhilippinePhone::toLocal($user->phone) : '')],
            );
        });

        // After the first-login "Complete your profile" step, continue to the dashboard.
        return redirect($firstTime ? '/customer/dashboard' : '/customer/profile')->with('status', 'Na-save ang profile mo.');
    }

    public function updatePassword(UpdateCustomerPasswordRequest $request): RedirectResponse
    {
        abort_unless($request->user()->canChangePassword(), 403);

        $request->user()->update(['password' => $request->validated('password')]); // hashed by the User model cast

        return back()->with('status', 'Password changed.');
    }

    /** First password for a customer who signed up with Google, phone or an email code. They are already signed in. */
    public function setPassword(SetCustomerPasswordRequest $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user->canSetPassword(), 403);

        $user->forceFill(['password' => $request->validated('password'), 'has_password' => true])->save(); // hashed by the User model cast

        return back()->with('status', 'Na-save ang password mo. Puwede ka nang mag-login gamit ang email at password.');
    }
}