<?php

namespace App\Http\Responses;

use App\Http\Responses\Concerns\RedirectsByRole;
use Illuminate\Http\JsonResponse;
use Laravel\Fortify\Contracts\TwoFactorLoginResponse as TwoFactorLoginResponseContract;
use Symfony\Component\HttpFoundation\Response;

class TwoFactorLoginResponse implements TwoFactorLoginResponseContract
{
    use RedirectsByRole;

    public function toResponse($request): Response
    {
        $path = $this->dashboardFor($request);

        return $request->wantsJson()
            ? new JsonResponse(['two_factor' => false, 'redirect' => $path], 200)
            : redirect($path);
    }
}
