<?php

namespace App\Services\Dispatch;

use RuntimeException;

/** A dispatch rule was broken (invalid transition, duplicate booking, ...). The message is safe to show to the user. */
class DispatchException extends RuntimeException
{
    public function __construct(public readonly string $codeName, string $message)
    {
        parent::__construct($message);
    }
}
