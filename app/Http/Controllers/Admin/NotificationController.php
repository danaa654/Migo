<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminProfile;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin > Notifications (the "notifications" area). The admin feed is the rows of `notifications` with user_id NULL;
 * rows with a user_id belong to riders / passengers and are never shown here. Staff only see the types their role
 * can act on: support / incident notifications need the "support" area, so an Operations Admin does not get them.
 */
class NotificationController extends Controller
{
    private const PER_PAGE = 15;

    private const SUPPORT_TYPES = ['complaint_filed', 'support_filed'];

    private const INCIDENT_TYPES = ['incident_filed'];

    private const CATEGORIES = ['support', 'incidents', 'operations'];

    /** The admin feed this staff member is allowed to see. Also used by the bell (HandleInertiaRequests). */
    public static function feed(?AdminProfile $admin): Builder
    {
        return DB::table('notifications')
            ->whereNull('user_id')
            ->when(! $admin?->hasArea('support'), fn ($q) => $q->whereNotIn('notification_type', [...self::SUPPORT_TYPES, ...self::INCIDENT_TYPES]));
    }

    public function index(Request $request): Response
    {
        $admin = $request->user()->adminProfile;
        $filter = $request->query('filter') === 'unread' ? 'unread' : 'all';
        $category = in_array($request->query('category'), self::CATEGORIES, true) ? $request->query('category') : null;
        $search = trim((string) $request->query('search', ''));

        $unread = self::feed($admin)->where('is_read', false)->count();

        $rows = self::feed($admin)
            ->when($filter === 'unread', fn ($q) => $q->where('is_read', false))
            ->when($category === 'support', fn ($q) => $q->whereIn('notification_type', self::SUPPORT_TYPES))
            ->when($category === 'incidents', fn ($q) => $q->whereIn('notification_type', self::INCIDENT_TYPES))
            ->when($category === 'operations', fn ($q) => $q->whereNotIn('notification_type', [...self::SUPPORT_TYPES, ...self::INCIDENT_TYPES]))
            ->when($search !== '', function ($q) use ($search) {
                // "!" is the LIKE escape character, so %, _ typed by the admin match literally.
                $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_substr($search, 0, 100)).'%';
                $q->where(fn ($w) => $w
                    ->whereRaw("title like ? escape '!'", [$like])
                    ->orWhereRaw("message like ? escape '!'", [$like]));
            })
            ->orderByDesc('created_at')
            ->orderBy('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn ($n) => [
                'id' => $n->id,
                'title' => $n->title,
                'message' => $n->message,
                'category' => $this->categoryOf($n->notification_type),
                'is_read' => (bool) $n->is_read,
                'created_at' => $n->created_at,
                'has_link' => $this->urlOf($n) !== null,
            ]);

        return Inertia::render('admin/notifications', [
            'notifications' => $rows,
            'unread' => $unread,
            'filters' => ['filter' => $filter, 'category' => $category, 'search' => $search],
            'categories' => $admin?->hasArea('support') ? self::CATEGORIES : ['operations'],
        ]);
    }

    /** Mark read, then go to the related page (when the notification has one) or back to the list. */
    public function open(Request $request, string $id): RedirectResponse
    {
        $n = $this->find($request, $id);
        self::feed($request->user()->adminProfile)->where('id', $id)->update(['is_read' => true]);

        return redirect()->to($this->urlOf($n) ?? '/admin/notifications');
    }

    public function read(Request $request, string $id): RedirectResponse
    {
        $this->find($request, $id);
        self::feed($request->user()->adminProfile)->where('id', $id)->update(['is_read' => true]);

        return back();
    }

    public function unread(Request $request, string $id): RedirectResponse
    {
        $this->find($request, $id);
        self::feed($request->user()->adminProfile)->where('id', $id)->update(['is_read' => false]);

        return back();
    }

    public function readAll(Request $request): RedirectResponse
    {
        self::feed($request->user()->adminProfile)->where('is_read', false)->update(['is_read' => true]);

        return back();
    }

    /** 404 unless the notification is in this staff member's own feed. */
    private function find(Request $request, string $id): object
    {
        return self::feed($request->user()->adminProfile)->where('id', $id)->first() ?? abort(404);
    }

    private function categoryOf(?string $type): string
    {
        return match (true) {
            in_array($type, self::SUPPORT_TYPES, true) => 'support',
            in_array($type, self::INCIDENT_TYPES, true) => 'incidents',
            default => 'operations',
        };
    }

    /** Only relative /admin/ links stored by the app itself are followed (data.url); anything else is ignored. */
    private function urlOf(object $n): ?string
    {
        $data = is_string($n->data ?? null) ? json_decode($n->data, true) : null;
        $url = is_array($data) ? ($data['url'] ?? null) : null;

        return is_string($url) && str_starts_with($url, '/admin/') && ! str_contains($url, '//') ? $url : null;
    }
}