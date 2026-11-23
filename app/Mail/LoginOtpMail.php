<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Sent immediately (not queued): the customer is waiting on the login screen, so no queue worker is needed. */
class LoginOtpMail extends Mailable
{
    public function __construct(public string $code, public int $ttlMinutes) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Ang Migo verification code mo');
    }

    public function content(): Content
    {
        return new Content(view: 'mail.login-otp');
    }
}
