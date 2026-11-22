<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Semaphore (Philippines). Keys live in .env: SEMAPHORE_API_KEY, optional SEMAPHORE_SENDER_NAME. */
class SemaphoreSmsSender implements SmsSender
{
    public function __construct(
        private readonly ?string $apiKey,
        private readonly ?string $senderName,
        private readonly string $endpoint,
    ) {}

    public function send(string $to, string $message): void
    {
        if (! $this->apiKey) {
            throw new RuntimeException('SEMAPHORE_API_KEY is not set.');
        }

        $payload = [
            'apikey' => $this->apiKey,
            'number' => ltrim($to, '+'), // 639XXXXXXXXX
            'message' => $message,
        ];
        if ($this->senderName) {
            $payload['sendername'] = $this->senderName;
        }

        // The key and the message are never logged; failures surface only the HTTP status.
        $response = Http::asForm()->timeout(10)->post($this->endpoint, $payload);

        if (! $response->successful()) {
            throw new RuntimeException('Semaphore rejected the SMS (HTTP '.$response->status().').');
        }
    }
}
