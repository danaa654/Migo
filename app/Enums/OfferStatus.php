<?php

namespace App\Enums;

enum OfferStatus: string
{
    case Sent = 'sent';
    case Accepted = 'accepted';
    case Declined = 'declined';
    case Expired = 'expired';
    case Cancelled = 'cancelled';
    case LostToAnotherRider = 'lost_to_another_rider';
}
