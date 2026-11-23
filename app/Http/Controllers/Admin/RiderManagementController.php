<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Riders\RiderAccreditation;
use App\Actions\Riders\RiderStatusException;
use App\Actions\Riders\UpdateRiderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectRiderRequest;
use App\Http\Requests\Admin\SuspendRiderRequest;
use App\Models\AdminProfile;
use App\Models\Rider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Admin > Rider Management. Mounted under the ['auth', EnsureActiveAdmin] group in routes/web.php; each write
 * action also re-checks isActiveAdmin() (directly or in its FormRequest) so it stays protected on its own.
 */
class RiderManagementController extends Controller
{
    private const PER_PAGE = 10;

    /** Sortable columns the client may ask for (whitelist; anything else falls back to the default). */
    private const SORTS = ['full_name', 'email', 'phone', 'created_at', 'application_status', 'accreditation_status', 'account_status'];

    /** Supporting documents: URL type => [riders column, label]. */
    private const DOCUMENTS = [
        'license' => ['license_document', "Driver's License"],
        'registration' => ['registration_document', 'Motorcycle Registration (OR/CR)'],
        'receipt' => ['official_receipt', 'Official Receipt'],
        'nbi' => ['nbi_clearance', 'NBI Clearance'],
    ];

    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $verification = in_array($request->query('verification'), ['pending', 'approved', 'rejected'], true) ? $request->query('verification') : null;
        $accreditation = in_array($request->query('accreditation'), ['not_accredited', 'for_final_approval', 'accredited', 'revoked'], true) ? $request->query('accreditation') : null;
        $account = in_array($request->query('account'), ['active', 'inactive', 'suspended'], true) ? $request->query('account') : null;
        $sort = in_array($request->query('sort'), self::SORTS, true) ? $request->query('sort') : 'created_at';
        $direction = $request->query('direction') === 'asc' ? 'asc' : 'desc';

        $riders = Rider::query()
            ->select('id', 'full_name', 'email', 'phone', 'profile_picture', 'vehicle_type', 'application_status', 'accreditation_status', 'account_status', 'created_at')
            ->when($search !== '', function ($q) use ($search) {
                // "!" is the LIKE escape character (works on MySQL and SQLite), so %, _ typed by the admin match literally.
                $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_substr($search, 0, 100)).'%';
                $q->where(fn ($w) => $w
                    ->whereRaw("full_name like ? escape '!'", [$like])
                    ->orWhereRaw("email like ? escape '!'", [$like])
                    ->orWhereRaw("id like ? escape '!'", [$like]));
            })
            ->when($verification, fn ($q, $v) => $q->where('application_status', $v))
            ->when($accreditation, fn ($q, $a) => $q->where('accreditation_status', $a))
            ->when($account, fn ($q, $a) => $q->where('account_status', $a))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Rider $r) => [
                'id' => $r->id,
                'full_name' => $r->full_name,
                'email' => $r->email,
                'phone' => $r->phone,
                'profile_picture_url' => $this->pictureUrl($r),
                'vehicle_type' => $r->vehicle_type?->label(),
                'application_status' => $r->application_status,
                'accreditation_status' => $r->accreditation_status,
                'account_status' => $r->account_status,
                'created_at' => $r->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/riders/index', [
            'stats' => $this->stats(),
            'riders' => $riders,
            'filters' => ['search' => $search, 'verification' => $verification, 'accreditation' => $accreditation, 'account' => $account, 'sort' => $sort, 'direction' => $direction],
        ]);
    }

    public function show(Rider $rider, RiderAccreditation $accreditation): Response
    {
        $documents = collect(self::DOCUMENTS)->map(function (array $def, string $type) use ($rider) {
            [$column, $label] = $def;
            $path = $rider->{$column};
            $exists = $path && Storage::disk('local')->exists($path);

            return [
                'type' => $type,
                'label' => $label,
                'available' => (bool) $exists,
                'url' => $exists ? "/admin/riders/{$rider->id}/documents/{$type}" : null,
                'is_image' => $exists && in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), ['jpg', 'jpeg', 'png'], true),
            ];
        })->values();

        $history = DB::table('audit_logs as a')
            ->leftJoin('admin_profiles as p', 'p.id', '=', 'a.admin_id')
            ->where('a.subject_type', 'rider')->where('a.subject_id', $rider->id)
            ->orderByDesc('a.created_at')
            ->select('a.id', 'a.action', 'a.description as reason', 'a.created_at', 'p.full_name as admin_name')
            ->get();

        return Inertia::render('admin/riders/show', [
            'rider' => [
                'id' => $rider->id,
                'full_name' => $rider->full_name,
                'email' => $rider->email,
                'phone' => $rider->phone,
                'address' => $rider->address,
                'profile_picture_url' => $this->pictureUrl($rider),
                'vehicle_type' => $rider->vehicle_type?->label(),
                'motorcycle_plate_number' => $rider->motorcycle_plate_number,
                'license_number' => $rider->license_number,
                'license_expiry' => $rider->license_expiry?->toDateString(),
                'license_expired' => (bool) $rider->license_expiry?->isPast(),
                'application_status' => $rider->application_status,
                'account_status' => $rider->account_status,
                'registration_document_available' => (bool) $rider->registration_document,
                'rejection_reason' => $rider->rejection_reason,
                'suspension_reason' => $rider->suspension_reason,
                'has_account' => $rider->user_id !== null,
                'created_at' => $rider->created_at?->toIso8601String(),
                'reviewed_at' => $rider->reviewed_at?->toIso8601String(),
            ],
            'documents' => $documents,
            'history' => $history,
            'accreditation' => $accreditation->summary($rider),
            'staff' => AdminProfile::query()->where('status', 'active')->orderBy('full_name')->get(['id', 'full_name', 'role'])
                ->filter(fn ($p) => $p->user?->canAccessAdminArea('riders'))->values(),
            'currentStaffId' => request()->user()->adminProfile?->id,
            'requiredEquipment' => RiderAccreditation::REQUIRED_EQUIPMENT,
            'requiredDocuments' => RiderAccreditation::REQUIRED_DOCUMENTS,
        ]);
    }

    /** Streams a supporting document from the PRIVATE disk. Only active administrators reach this route. */
    public function document(Request $request, Rider $rider, string $type): StreamedResponse
    {
        abort_unless($request->user()?->isActiveAdmin(), 403);
        abort_unless(isset(self::DOCUMENTS[$type]), 404);

        $path = $rider->{self::DOCUMENTS[$type][0]};
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, basename($path), [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        ], 'inline');
    }

    public function approve(Request $request, Rider $rider, UpdateRiderStatus $action): RedirectResponse
    {
        return $this->run($request, fn ($admin) => $action->approve($rider, $admin), "{$rider->full_name} has been approved.");
    }

    public function reject(RejectRiderRequest $request, Rider $rider, UpdateRiderStatus $action): RedirectResponse
    {
        return $this->run($request, fn ($admin) => $action->reject($rider, $admin, $request->validated('reason')), "{$rider->full_name}'s application has been rejected.");
    }

    public function suspend(SuspendRiderRequest $request, Rider $rider, UpdateRiderStatus $action): RedirectResponse
    {
        return $this->run($request, fn ($admin) => $action->suspend($rider, $admin, $request->validated('reason')), "{$rider->full_name}'s account has been suspended.");
    }

    public function reactivate(Request $request, Rider $rider, UpdateRiderStatus $action): RedirectResponse
    {
        return $this->run($request, fn ($admin) => $action->reactivate($rider, $admin), "{$rider->full_name}'s account has been reactivated.");
    }

    /** @param callable(AdminProfile): mixed $do */
    private function run(Request $request, callable $do, string $success): RedirectResponse
    {
        abort_unless($request->user()?->isActiveAdmin(), 403);

        try {
            $do($request->user()->adminProfile);
            Inertia::flash('toast', ['type' => 'success', 'message' => $success]);
        } catch (RiderStatusException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $e->getMessage()]);
        }

        return back();
    }

    /** @return array<string, int> Live counts from the riders table (one query). */
    private function stats(): array
    {
        $r = Rider::query()->selectRaw(
            "count(*) as total,
             coalesce(sum(case when application_status = 'pending' then 1 else 0 end), 0) as pending,
             coalesce(sum(case when application_status = 'approved' then 1 else 0 end), 0) as approved,
             coalesce(sum(case when application_status = 'rejected' then 1 else 0 end), 0) as rejected,
             coalesce(sum(case when account_status = 'suspended' then 1 else 0 end), 0) as suspended,
             coalesce(sum(case when application_status = 'approved' and document_verification_status <> 'verified' and accreditation_status <> 'revoked' then 1 else 0 end), 0) as pending_documents,
             coalesce(sum(case when document_verification_status = 'verified' and orientation_status <> 'completed' and accreditation_status <> 'revoked' then 1 else 0 end), 0) as pending_orientation,
             coalesce(sum(case when orientation_status = 'completed' and inspection_status <> 'passed' and accreditation_status <> 'revoked' then 1 else 0 end), 0) as pending_inspection,
             coalesce(sum(case when accreditation_status = 'for_final_approval' then 1 else 0 end), 0) as for_final_approval,
             coalesce(sum(case when accreditation_status = 'accredited' then 1 else 0 end), 0) as accredited"
        )->toBase()->first();

        return array_map('intval', (array) $r);
    }

    private function pictureUrl(Rider $rider): ?string
    {
        $path = $rider->profile_picture;

        return $path && Storage::disk('public')->exists($path) ? '/storage/'.$path : null;
    }
}
