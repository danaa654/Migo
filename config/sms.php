<?php

return [

    /*
    | SMS_DRIVER: "log" (default; writes the message to storage/logs/laravel.log, local/dev ONLY)
    |             "semaphore" (real SMS in the Philippines, https://semaphore.co)
    | The log driver refuses to run when APP_ENV=production so an OTP can never be written to production logs.
    */
    'driver' => env('SMS_DRIVER', 'log'),

    'semaphore' => [
        'api_key' => env('SEMAPHORE_API_KEY'),
        'sender_name' => env('SEMAPHORE_SENDER_NAME'), // optional; must be approved by Semaphore, else leave empty
        'endpoint' => env('SEMAPHORE_ENDPOINT', 'https://api.semaphore.co/api/v4/messages'),
    ],

];
