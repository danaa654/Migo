<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
            ],
            // Where the signed-in user's dashboard is (decided server-side from users.role); null for guests.
            'dashboardUrl' => fn () => $user?->dashboardPath(),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'currentTeam' => fn () => $user?->currentTeam ? $user->toUserTeam($user->currentTeam) : null,
            'teams' => fn () => $user?->toUserTeams(includeCurrent: true) ?? [],
            // Admin portal: signed-in administrator + notification bell data
            'admin' => fn () => ($p = $user?->adminProfile) ? ['full_name' => $p->full_name, 'email' => $p->email, 'role' => $p->role, 'role_label' => $p->roleLabel(), 'areas' => $p->areas()] : null,
            // Rider sidebar / dashboard: the plan the rider currently has (paid first, then free trial). Null for non-riders.
            'bikerSubscription' => fn () => $this->bikerSubscription($user),
            'adminNotifications' => fn () => $user?->adminProfile ? $this->adminNotifications($user->adminProfile) : null,
        ];
    }

    /** @return array{required: bool, kind: string|null, plan: string|null, color?: string|null, starts_at: string|null, expires_at: string|null}|null */
    private function bikerSubscription(?\App\Models\User $user): ?array
    {
        $rider = $user?->rider;
        if (! $rider) {
            return null;
        }

        try {
            $now = now();
            $current = fn (string $type) => \App\Models\RiderSubscription::where('rider_id', $rider->id)
                ->where('subscription_type', $type)->effective($now)->orderByDesc('expires_at')->first();
            $sub = $current('paid') ?? $current('trial');

            return [
                'required' => app(\App\Services\Subscriptions\SubscriptionService::class)->required(),
                'kind' => $sub?->subscription_type,
                'plan' => $sub ? ($sub->subscription_type === 'trial' ? 'Free Trial' : $sub->plan_name_snapshot) : null,
                'color' => $sub && $sub->subscription_type === 'paid' ? \App\Models\SubscriptionPlan::whereKey($sub->subscription_plan_id)->value('color') : null,
                'starts_at' => $sub?->starts_at?->toIso8601String(),
                'expires_at' => $sub?->expires_at?->toIso8601String(),
            ];
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /** @return array{unread: int, latest: mixed}|null  null when the notifications table is unavailable */
    private function adminNotifications(\App\Models\AdminProfile $admin): ?array
    {
        try {
            // Same feed as the Notifications page: only the types this staff role can act on.
            return [
                'unread' => \App\Http\Controllers\Admin\NotificationController::feed($admin)->where('is_read', false)->count(),
                'latest' => \App\Http\Controllers\Admin\NotificationController::feed($admin)->select('id', 'title', 'message', 'is_read', 'created_at')->orderByDesc('created_at')->limit(5)->get(),
            ];
        } catch (\Throwable) {
            return null;
        }
    }
}