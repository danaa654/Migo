<?php

namespace Tests\Support;

use App\Services\Sms\SmsSender;
use RuntimeException;

/** Captures SMS instead of sending it, so tests can read the OTP the way a phone would. */
class FakeSmsSender implements SmsSender
{
    /** @var list<array{to: string, message: string}> */
    public array $sent = [];

    public bool $fail = false;

    public function send(string $to, string $message): void
    {
        if ($this->fail) {
            throw new RuntimeException('SMS provider down');
        }

        $this->sent[] = ['to' => $to, 'message' => $message];
    }

    public function lastCode(): string
    {
        $last = end($this->sent);
        preg_match('/\b(\d{6})\b/', $last['message'] ?? '', $m);

        return $m[1] ?? throw new RuntimeException('No SMS was sent.');
    }
}
