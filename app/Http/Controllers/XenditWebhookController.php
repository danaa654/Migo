<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPayment;
use App\Services\Subscriptions\SubscriptionService;
use App\Services\Subscriptions\XenditClient;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

/**
 * Xendit -> MIGO ("Invoices paid" callback). The ONLY place a subscription payment becomes "paid" for Xendit.
 * The x-callback-token header must match, the paid amount must match the plan price, and repeats are ignored.
 */
class XenditWebhookController extends Controller
{
    public function __invoke(Request $request, XenditClient $xendit, SubscriptionService $subs): Response
    {
        if (! $xendit->validToken((string) $request->header('x-callback-token'))) {
            \Log::warning('Xendit webhook rejected: x-callback-token missing or not equal to XENDIT_CALLBACK_TOKEN.');

            return response('Invalid token', 400);
        }

        $b = $request->json()->all();
        \Log::info('Xendit webhook received', ['external_id' => $b['external_id'] ?? null, 'status' => $b['status'] ?? null]);
        $status = strtoupper((string) ($b['status'] ?? ''));
        if (! in_array($status, ['PAID', 'SETTLED'], true)) {
            return response('OK', 200); // EXPIRED / other events: nothing to activate
        }

        $invoiceId = $b['id'] ?? null;
        $reference = (string) ($b['external_id'] ?? '');

        $payment = ($invoiceId ? SubscriptionPayment::where('provider_session_id', $invoiceId)->first() : null)
            ?? (preg_match('/^MIGO-SUB-(\d+)$/', $reference, $m) ? SubscriptionPayment::find((int) $m[1]) : null);

        if (! $payment) {
            report(new \RuntimeException('Xendit callback for an unknown payment: '.$reference));

            return response('OK', 200);
        }

        $paid = (float) ($b['paid_amount'] ?? $b['amount'] ?? 0);
        if (abs($paid - (float) $payment->amount) > 0.01) {
            report(new \RuntimeException("Xendit amount mismatch on payment #{$payment->id}: got {$paid}"));

            return response('OK', 200);
        }

        try {
            $subs->activate($payment, null, [
                'method' => strtolower((string) ($b['payment_channel'] ?? $b['payment_method'] ?? 'xendit')),
                'provider_payment_id' => $b['payment_id'] ?? $invoiceId,
            ]);
        } catch (ValidationException) {
            // already activated by an earlier delivery
        } catch (\Throwable $e) {
            report($e);

            return response('Error', 500); // Xendit retries
        }

        return response('OK', 200);
    }
}