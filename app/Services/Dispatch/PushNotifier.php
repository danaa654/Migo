<?php

namespace App\Services\Dispatch;

use Illuminate\Support\Facades\Log;

/**
 * Push delivery for devices in the background or closed. Callers must catch exceptions: a failed push never
 * breaks dispatch. Add a real provider (FCM / Web Push) as another driver here.
 */
class PushNotifier
{
    /** @param array<string, mixed> $data */
    public function send(int $userId, string $title, string $body, array $data = []): void
    {
        $driver = (string) config('dispatch.push.driver', 'log');

        if ($driver === 'null') {
            return;
        }

        if ($driver === 'log') {
            Log::info('[push] user '.$userId.': '.$title.' - '.$body, $data);

            return;
        }

        Log::warning("[push] unknown DISPATCH_PUSH_DRIVER \"{$driver}\"; notification not sent.");
    }
}
