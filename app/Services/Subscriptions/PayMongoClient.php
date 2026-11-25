<?php

namespace App\Services\Subscriptions;

use App\Models\Rider;
use App\Models\SubscriptionPayment;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Thin server-side client for PayMongo Hosted Checkout. The secret key never leaves the server. */
class PayMongoClient implements CheckoutGateway
{
    public function name(): string
    {
        return 'paymongo';
    }

    /** Creates a hosted checkout page for one payment and returns its id and URL. */
    public function createCheckout(SubscriptionPayment $payment, Rider $rider, string $successUrl, string $cancelUrl): array
    {
        $secret = (string) config('paymongo.secret');
        if ($secret === '') {
            throw new RuntimeException('PAYMONGO_SECRET_KEY is not set.');
        }

        $response = Http::withBasicAuth($secret, '')->acceptJson()->asJson()->timeout(20)
            ->post(rtrim(config('paymongo.base_url'), '/').'/v2/checkout_sessions', ['data' => ['attributes' => [
                'line_items' => [[
                    'name' => $payment->plan_name_snapshot.' subscription ('.$payment->duration_snapshot.')',
                    'amount' => (int) round($payment->amount * 100), // centavos
                    'currency' => 'PHP',
                    'quantity' => 1,
                ]],
                'payment_method_types' => config('paymongo.methods'),
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl,
                'reference_number' => 'MIGO-SUB-'.$payment->id,
                'metadata' => ['payment_id' => (string) $payment->id, 'rider_id' => (string) $rider->id],
            ]]]);

        $session = $response->json('data');
        if (! $response->successful() || ! isset($session['id'], $session['attributes']['checkout_url'])) {
            throw new RuntimeException('PayMongo checkout failed: HTTP '.$response->status().' '.mb_substr((string) $response->body(), 0, 500));
        }

        return ['id' => $session['id'], 'url' => $session['attributes']['checkout_url']];
    }

    /**
     * Verifies the Paymongo-Signature header: HMAC-SHA256 of "<timestamp>.<raw body>" with the webhook secret,
     * compared with the "te" value (test keys) or "li" value (live keys). Fails closed when no secret is configured.
     */
    public function validSignature(string $rawBody, string $header): bool
    {
        $secret = (string) config('paymongo.webhook_secret');
        if ($secret === '' || $header === '') {
            return false;
        }

        $parts = [];
        foreach (explode(',', $header) as $piece) {
            [$k, $v] = array_pad(explode('=', trim($piece), 2), 2, '');
            $parts[$k] = $v;
        }
        if (($parts['t'] ?? '') === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $parts['t'].'.'.$rawBody, $secret);
        $given = str_starts_with((string) config('paymongo.secret'), 'sk_live_') ? ($parts['li'] ?? '') : ($parts['te'] ?? '');

        return $given !== '' && hash_equals($expected, $given);
    }
}
