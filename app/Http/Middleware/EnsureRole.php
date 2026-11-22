<?php

namespace App\Http\Middleware;

use App\Enums\AccountRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Server-side role gate. Usage: ->middleware(['auth', 'role:customer']) or 'role:customer,biker'.
 *
 * A signed-in user with the wrong role is sent to their own dashboard (JSON clients get 403).
 * The decision always comes from users.role, never from the URL or anything the browser sends.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect('/login');
        }

        $allowed = array_map(fn (string $role) => AccountRole::from($role), $roles);

        if (! in_array($user->accountRole(), $allowed, true)) {
            if ($request->expectsJson()) {
                abort(403);
            }

            return redirect($user->dashboardPath());
        }

        return $next($request);
    }
}
