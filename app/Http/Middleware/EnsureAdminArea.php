<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Area gate for the admin portal. Usage: ->middleware('admin.area:riders') or 'admin.area:riders,bookings' (any one).
 * The decision comes from the staff member's admin profile role (AdminProfile::AREAS), never from the browser.
 * Staff who open an area that is not theirs are sent to their own home page.
 */
class EnsureAdminArea
{
    public function handle(Request $request, Closure $next, string ...$areas): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isActiveAdmin()) {
            return redirect('/admin/login');
        }

        foreach ($areas as $area) {
            if ($user->canAccessAdminArea($area)) {
                return $next($request);
            }
        }

        $home = $user->dashboardPath();

        if ($request->expectsJson() || '/'.ltrim($request->path(), '/') === $home) {
            abort(403);
        }

        return redirect($home);
    }
}
