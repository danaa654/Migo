<?php

return [
    /*
    | Push notifications (rider and passenger devices that are in the background or closed).
    | "log"  = write the push to the Laravel log (default, safe for local development)
    | "null" = send nothing
    | A real provider (FCM / Web Push) is added as another driver inside App\Services\Dispatch\PushNotifier.
    | A push failure is always caught and reported: it can never break dispatch.
    */
    'push' => [
        'driver' => env('DISPATCH_PUSH_DRIVER', 'log'),
    ],
];
