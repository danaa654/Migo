<?php

namespace App\Enums;

/** Kind of vehicle a rider drives: two wheels is a "Biker", four wheels is "MigoCars". */
enum VehicleType: string
{
    case TwoWheel = 'two_wheel';
    case FourWheel = 'four_wheel';

    public function label(): string
    {
        return match ($this) {
            self::TwoWheel => 'Biker (2 wheels)',
            self::FourWheel => 'MigoCars (4 wheels)',
        };
    }
}