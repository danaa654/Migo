<?php

namespace App\Http\Responses;

use App\Http\Responses\Concerns\RedirectsByRole;
use Illuminate\Http\JsonResponse;
use Laravel\Passkeys\Contracts\PasskeyLoginResponse as PasskeyLoginResponseContract;
use Symfony\Component\HttpFoundation\Response;

class PasskeyLoginResponse implements PasskeyLoginResponseContract
{
    use RedirectsByRole;

    public function toResponse($request): Response
    {
        $path = $this->dashboardFor($request);

        return $request->wantsJson()
            ? new JsonResponse(['redirect' => url($path)], 200)
            : redirect($path);
    }
}
