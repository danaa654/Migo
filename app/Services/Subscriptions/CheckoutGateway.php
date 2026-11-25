<?php

namespace App\Services\Subscriptions;

use App\Models\Rider;
use App\Models\SubscriptionPayment;

/** A hosted-checkout payment provider (Xendit, PayMongo). The provider confirms payments by webhook. */
interface CheckoutGateway
{
    /** Short provider name stored on the payment ("xendit", "paymongo"). */
    public function name(): string;

    /** @return array{id: string, url: string} provider checkout id and the page to send the rider to */
    public function createCheckout(SubscriptionPayment $payment, Rider $rider, string $successUrl, string $cancelUrl): array;
}
