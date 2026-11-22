<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Customers who signed in by phone for the first time have no name yet. Until they save their full name on the
 * profile page they cannot reach the dashboard or book. (Alias: customer.profile)
 */
class EnsureCustomerProfileComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->needsProfileCompletion()) {
            if ($request->expectsJson()) {
                abort(403, 'Complete your profile first.');
            }

            return redirect('/customer/profile')->with('status', 'Isulat muna ang buong pangalan mo para makapag-book.');
        }

        return $next($request);
    }
}
