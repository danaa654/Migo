<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AccountRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStaffAccountRequest;
use App\Models\AdminProfile;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Staff Accounts (Administrator only, route middleware admin.area:staff). The Administrator can create, suspend and
 * reactivate Operations Admin and Support Staff accounts and nothing else: no other role can be created here and
 * the Administrator's own account is never touched. A new staff member receives an email link to set their own
 * password, so no password is ever chosen or shown by the Administrator.
 */
class StaffAccountController extends Controller
{
    private const ROLE_DESCRIPTIONS = [
        AdminProfile::ROLE_OPERATIONS => 'Rider applications, document verification and accreditation, subscriptions, and bookings.',
        AdminProfile::ROLE_SUPPORT => 'Support Center: complaints, support requests and incident reports.',
    ];

    public function index(Request $request): Response
    {
        $staff = AdminProfile::query()
            ->whereIn('role', AdminProfile::CREATABLE_ROLES)
            ->orderBy('full_name')
            ->get()
            ->map(fn (AdminProfile $p) => [
                'id' => $p->id,
                'full_name' => $p->full_name,
                'email' => $p->email,
                'role' => $p->role,
                'role_label' => $p->roleLabel(),
                'status' => $p->status,
                'created_at' => $p->created_at?->toIso8601String(),
            ])->values();

        return Inertia::render('admin/staff', [
            'staff' => $staff,
            'roles' => collect(AdminProfile::CREATABLE_ROLES)->map(fn (string $role) => [
                'value' => $role,
                'label' => (new AdminProfile(['role' => $role]))->roleLabel(),
                'description' => self::ROLE_DESCRIPTIONS[$role],
            ])->values(),
            'status' => $request->session()->get('status'),
            'warning' => $request->session()->get('warning'),
        ]);
    }

    public function store(StoreStaffAccountRequest $request): RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($data) {
            // The password is random and never shown: the staff member sets their own from the emailed link.
            $user = new User(['name' => $data['full_name'], 'email' => $data['email'], 'password' => Str::random(40)]);
            $user->forceFill(['role' => AccountRole::Admin->value])->save();

            AdminProfile::create([
                'user_id' => $user->id,
                'full_name' => $data['full_name'],
                'email' => $data['email'],
                'role' => $data['role'],
                'status' => 'active',
            ]);
        });

        if ($this->sendSetupLink($data['email'])) {
            return back()->with('status', "Account created. We emailed {$data['email']} a link to set their password.");
        }

        return back()->with('warning', "Account created, but the setup email could not be sent to {$data['email']}. Use \"Resend setup email\" below.");
    }

    public function suspend(Request $request, AdminProfile $staff): RedirectResponse
    {
        $this->managed($staff);
        $staff->update(['status' => 'suspended']);

        return back()->with('status', "{$staff->full_name} was suspended and can no longer sign in.");
    }

    public function reactivate(Request $request, AdminProfile $staff): RedirectResponse
    {
        $this->managed($staff);
        $staff->update(['status' => 'active']);

        return back()->with('status', "{$staff->full_name} can sign in again.");
    }

    public function invite(Request $request, AdminProfile $staff): RedirectResponse
    {
        $this->managed($staff);

        return $this->sendSetupLink($staff->email)
            ? back()->with('status', "Setup email sent to {$staff->email}.")
            : back()->with('warning', 'The setup email could not be sent right now. Wait a minute and try again.');
    }

    /** Only Operations Admin and Support Staff accounts can be managed from this page. */
    private function managed(AdminProfile $staff): void
    {
        abort_unless(in_array($staff->role, AdminProfile::CREATABLE_ROLES, true), 403);
    }

    private function sendSetupLink(string $email): bool
    {
        try {
            return Password::broker()->sendResetLink(['email' => $email]) === Password::RESET_LINK_SENT;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }
}
