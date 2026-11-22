<?php

namespace App\Enums;

enum RiderAvailabilityStatus: string
{
    case Offline = 'offline';
    case OnlineAvailable = 'online_available';
    case OnTrip = 'on_trip';
    case AcceptingBooking = 'accepting_booking';
    case Unavailable = 'unavailable';
}
