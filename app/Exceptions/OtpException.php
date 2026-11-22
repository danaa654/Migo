<?php

namespace App\Exceptions;

use RuntimeException;

/** A user-facing OTP problem. The message is safe to show; it never reveals whether a number is registered. */
class OtpException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422, public readonly ?int $retryAfter = null)
    {
        parent::__construct($message);
    }

    public static function throttled(int $retryAfter): self
    {
        $retryAfter = max(1, $retryAfter);

        return new self("Masyadong madalas ang pag-request. Subukan ulit pagkalipas ng {$retryAfter} segundo.", 429, $retryAfter);
    }
}
