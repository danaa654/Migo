<?php

namespace App\Http\Responses\Concerns;

use Illuminate\Http\Request;

trait RedirectsByRole
{
    /**
     * Role dashboard for the signed-in user. Any previously stored "intended" URL is discarded so a
     * user is never sent somewhere their role does not belong (e.g. a customer returning to /admin).
     */
    protected function dashboardFor(Request $request): string
    {
        $user = $request->user();

        abort_if(! $user, 403);

        $request->session()->forget('url.intended');

        return $user->dashboardPath();
    }
}
