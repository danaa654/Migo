<?php

namespace App\Enums;

/** Booking lifecycle. Stored as lowercase snake_case so existing code that compares strings keeps working. */
enum BookingStatus: string
{
    case Pending = 'pending';
    case SearchingForRider = 'searching_for_rider';
    case RiderAssigned = 'rider_assigned';
    case RiderArrived = 'rider_arrived';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case CancelledByPassenger = 'cancelled_by_passenger';
    case CancelledByRider = 'cancelled_by_rider';
    case NoRiderFound = 'no_rider_found';
    case Expired = 'expired';

    /** Statuses that block a passenger from creating another request. */
    public const ACTIVE = ['pending', 'searching_for_rider', 'rider_assigned', 'rider_arrived', 'in_progress'];

    /** Statuses in which a rider is committed to the trip. */
    public const RIDER_COMMITTED = ['rider_assigned', 'rider_arrived', 'in_progress'];

    /** @return list<self> */
    public function allowedNext(): array
    {
        return match ($this) {
            self::Pending => [self::SearchingForRider, self::CancelledByPassenger, self::Expired],
            self::SearchingForRider => [self::RiderAssigned, self::CancelledByPassenger, self::NoRiderFound, self::Expired],
            self::RiderAssigned => [self::RiderArrived, self::CancelledByPassenger, self::CancelledByRider, self::SearchingForRider],
            self::RiderArrived => [self::InProgress, self::CancelledByPassenger, self::CancelledByRider],
            self::InProgress => [self::Completed],
            self::NoRiderFound => [self::SearchingForRider],
            default => [],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedNext(), true);
    }

    public function isTerminal(): bool
    {
        return $this->allowedNext() === [];
    }
}
