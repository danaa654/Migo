<?php

namespace App\Services\Sms;

interface SmsSender
{
    /**
     * @param  string  $to  E.164 number, for example +639171234567
     *
     * @throws \Throwable when the message could not be handed to the provider
     */
    public function send(string $to, string $message): void;
}
