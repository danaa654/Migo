<?php

namespace App\Http\Middleware;

use App\Enums\AccountRole;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect('/admin/login');
        }

        // Signed in, but as a Customer or Biker: keep their session, send them to their own dashboard.
        if ($user->accountRole() !== AccountRole::Admin) {
            if ($request->expectsJson()) {
                abort(403);
            }

            return redirect($user->dashboardPath());
        }

        // Admin role without an active admin profile (inactive, suspended, missing): end the session.
        if (! $user->isActiveAdmin()) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect('/admin/login');
        }

        return $next($request);
    }
}
