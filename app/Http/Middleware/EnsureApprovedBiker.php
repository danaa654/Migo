<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricted biker functions (service requests, ...) need final ACCREDITATION (see Rider::canAcceptRequests):
 * approved application, documents verified, orientation completed, motorcycle inspection passed, and an active account.
 * Usage: ->middleware(['auth', 'role:biker', 'biker.approved']).
 * Riders who are not yet accredited (or are suspended/inactive/revoked) are sent back to the biker dashboard, which shows the status.
 */
class EnsureApprovedBiker
{
    public function handle(Request $request, Closure $next): Response
    {
        $rider = $request->user()?->rider;

        if (! $rider?->canAcceptRequests()) {
            if ($request->expectsJson()) {
                abort(403, 'Your rider account is not accredited or is not active.');
            }

            return redirect('/biker/dashboard');
        }

        return $next($request);
    }
}
