<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Log;
use RuntimeException;

/** Local/dev driver: the "SMS" is written to storage/logs/laravel.log. Never usable in production. */
class LogSmsSender implements SmsSender
{
    public function send(string $to, string $message): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('SMS_DRIVER=log is not allowed in production. Set SMS_DRIVER=semaphore.');
        }

        Log::info("[SMS:log] to {$to}: {$message}");
    }
}
