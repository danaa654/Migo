<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPayment extends Model
{
    /** Labels for the method PayMongo reports (shown in history). Unknown values are shown as they come. */
    public const METHODS = [
        'xendit' => 'Xendit',
        'paymongo' => 'PayMongo',
        'ewallet' => 'E-wallet',
        'credit_card' => 'Card',
        'qr_code' => 'QR Ph',
        'direct_debit' => 'Online banking',
        'retail_outlet' => 'Over the counter',
        'card' => 'Card',
        'gcash' => 'GCash',
        'paymaya' => 'Maya',
        'qrph' => 'QR Ph',
        'grab_pay' => 'GrabPay',
    ];

    protected $fillable = ['rider_id', 'rider_subscription_id', 'subscription_plan_id', 'plan_name_snapshot', 'duration_snapshot',
        'duration_value', 'duration_unit', 'amount', 'payment_method', 'provider', 'provider_session_id', 'provider_payment_id', 'checkout_url',
        'transaction_reference', 'payment_proof', 'status',
        'verified_by', 'verified_at', 'rejection_reason'];

    protected function casts(): array
    {
        return ['amount' => 'float', 'verified_at' => 'datetime'];
    }
}
