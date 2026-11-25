<?php

/**
 * Which payment provider the subscription checkout uses. Keys come from .env and stay on the server.
 *
 *   PAYMENT_DRIVER=xendit                (or "paymongo")
 *   XENDIT_SECRET_KEY=xnd_development_...   Settings > Developers > API Keys (create it in TEST mode, write access for Money-in / Invoices)
 *   XENDIT_CALLBACK_TOKEN=...               Settings > Developers > Webhooks > "Webhook verification token"
 */
return [
    'driver' => env('PAYMENT_DRIVER', 'xendit'),

    'xendit' => [
        'secret' => env('XENDIT_SECRET_KEY'),
        'callback_token' => env('XENDIT_CALLBACK_TOKEN'),
        'base_url' => 'https://api.xendit.co',
        'invoice_minutes' => 60, // how long the checkout page stays open
    ],
];
