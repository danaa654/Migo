<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPayment;
use App\Services\Subscriptions\PayMongoClient;
use App\Services\Subscriptions\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

/**
 * PayMongo -> MIGO. This is the ONLY place a subscription payment becomes "paid". The request must carry a valid
 * signature, and handling is idempotent: PayMongo may deliver the same event more than once.
 */
class PayMongoWebhookController extends Controller
{
    public function __invoke(Request $request, PayMongoClient $gateway, SubscriptionService $subs): Response
    {
        $raw = $request->getContent();
        if (! $gateway->validSignature($raw, (string) $request->header('Paymongo-Signature'))) {
            return response('Invalid signature', 400);
        }

        $event = (json_decode($raw, true) ?: [])['data'] ?? [];
        $type = $event['type'] ?? ($event['attributes']['type'] ?? null);
        if ($type !== 'checkout_session.payment.paid') {
            return response('OK', 200); // other events are not needed
        }

        $session = $event['data'] ?? ($event['attributes']['data'] ?? []);
        $attrs = $session['attributes'] ?? [];
        $reference = (string) ($attrs['reference_number'] ?? '');
        $sessionId = $session['id'] ?? null;

        $payment = SubscriptionPayment::query()
            ->when($sessionId, fn ($q) => $q->where('provider_session_id', $sessionId))
            ->first()
            ?? (preg_match('/^MIGO-SUB-(\d+)$/', $reference, $m) ? SubscriptionPayment::find((int) $m[1]) : null);

        if (! $payment) {
            report(new \RuntimeException('PayMongo webhook for an unknown payment: '.$reference));

            return response('OK', 200);
        }

        $paid = $attrs['payments'][0]['attributes'] ?? [];
        // The amount PayMongo really collected must match the plan price we stored (centavos).
        if (isset($paid['amount']) && (int) $paid['amount'] !== (int) round($payment->amount * 100)) {
            report(new \RuntimeException("PayMongo amount mismatch on payment #{$payment->id}"));

            return response('OK', 200);
        }

        try {
            $subs->activate($payment, null, [
                'method' => $paid['source']['type'] ?? null,
                'provider_payment_id' => $attrs['payments'][0]['id'] ?? null,
            ]);
        } catch (ValidationException) {
            // already activated by an earlier delivery: nothing to do
        } catch (\Throwable $e) {
            report($e);

            return response('Error', 500); // PayMongo retries
        }

        return response('OK', 200);
    }
}
