<?php

namespace App\Events;

use App\Enums\DispatchEventType;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

/**
 * One real-time dispatch event (see DispatchEventType for the full list).
 * It is dispatched only AFTER the surrounding database transaction commits, so nobody is ever notified about a
 * change that was rolled back. App\Listeners\DeliverDispatchNotification turns it into in-app + push notifications.
 */
class DispatchEventOccurred implements ShouldDispatchAfterCommit
{
    /** @param array<string, mixed> $context small extra values for the message (e.g. ['message' => '...']) */
    public function __construct(
        public DispatchEventType $type,
        public string $bookingId,
        public ?string $riderId = null,
        public ?int $offerId = null,
        public array $context = [],
    ) {}

    /** @param array<string, mixed> $context */
    public static function raise(DispatchEventType $type, string $bookingId, ?string $riderId = null, ?int $offerId = null, array $context = []): void
    {
        event(new self($type, $bookingId, $riderId, $offerId, $context));
    }
}
