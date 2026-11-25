<?php

/**
 * PayMongo (payment gateway). Keys come from .env and are only ever used on the server:
 *   PAYMONGO_SECRET_KEY=sk_test_...        (Dashboard > Developers > API keys)
 *   PAYMONGO_WEBHOOK_SECRET=whsec_...      (shown when you create the webhook endpoint)
 *   PAYMONGO_PAYMENT_METHODS=gcash,paymaya,card,qrph   (must be enabled in your PayMongo dashboard)
 */
return [
    'secret' => env('PAYMONGO_SECRET_KEY'),
    'webhook_secret' => env('PAYMONGO_WEBHOOK_SECRET'),
    'methods' => array_values(array_filter(array_map('trim', explode(',', (string) env('PAYMONGO_PAYMENT_METHODS', 'gcash,paymaya,card,qrph'))))),
    'base_url' => 'https://api.paymongo.com',
];
