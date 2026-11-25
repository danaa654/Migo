<?php

namespace App\Services\Subscriptions;

use App\Models\Rider;
use App\Models\SubscriptionPayment;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Xendit Invoice API (hosted checkout page). The secret key never leaves the server. */
class XenditClient implements CheckoutGateway
{
    public function name(): string
    {
        return 'xendit';
    }

    public function createCheckout(SubscriptionPayment $payment, Rider $rider, string $successUrl, string $cancelUrl): array
    {
        $secret = (string) config('payments.xendit.secret');
        if ($secret === '') {
            throw new RuntimeException('XENDIT_SECRET_KEY is not set.');
        }

        $response = Http::withBasicAuth($secret, '')->acceptJson()->asJson()->timeout(20)
            ->post(rtrim(config('payments.xendit.base_url'), '/').'/v2/invoices', array_filter([
                'external_id' => 'MIGO-SUB-'.$payment->id, // unique per payment
                'amount' => (float) $payment->amount,       // pesos, not centavos
                'currency' => 'PHP',
                'description' => $payment->plan_name_snapshot.' subscription ('.$payment->duration_snapshot.')',
                'payer_email' => $rider->email ?: null,
                'invoice_duration' => (int) config('payments.xendit.invoice_minutes') * 60,
                'success_redirect_url' => $successUrl,
                'failure_redirect_url' => $cancelUrl,
            ], fn ($v) => $v !== null));

        $body = $response->json();
        if (! $response->successful() || ! isset($body['id'], $body['invoice_url'])) {
            throw new RuntimeException('Xendit invoice failed: HTTP '.$response->status().' '.mb_substr((string) $response->body(), 0, 500));
        }

        return ['id' => $body['id'], 'url' => $body['invoice_url']];
    }

    /**
     * Asks Xendit directly (server to server) for an invoice. Used when the webhook cannot reach this server
     * (local XAMPP, tunnel down). Returns null when Xendit cannot be reached or the invoice is unknown.
     */
    public function fetchInvoice(string $invoiceId): ?array
    {
        $secret = (string) config('payments.xendit.secret');
        if ($secret === '' || $invoiceId === '') {
            return null;
        }

        try {
            $response = Http::withBasicAuth($secret, '')->acceptJson()->timeout(10)
                ->get(rtrim(config('payments.xendit.base_url'), '/').'/v2/invoices/'.$invoiceId);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }

        return $response->successful() ? $response->json() : null;
    }

    /** Xendit sends your webhook verification token in the x-callback-token header. Fails closed when none is set. */
    public function validToken(string $header): bool
    {
        $expected = (string) config('payments.xendit.callback_token');

        return $expected !== '' && $header !== '' && hash_equals($expected, $header);
    }
}