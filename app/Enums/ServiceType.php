<?php

namespace App\Enums;

use App\Models\DispatchSetting;

/**
 * The three MIGO services. Stored on bookings.service_type exactly as the case value (MIGOMOTO, MIGOCARS, MIGODALA).
 * MigoMoto and MigoCars carry passengers; MigoDala carries a package and is a delivery, never a passenger ride.
 */
enum ServiceType: string
{
    case MigoMoto = 'MIGOMOTO';
    case MigoCars = 'MIGOCARS';
    case MigoDala = 'MIGODALA';

    public const PACKAGE_SIZES = ['small' => 'Small (fits a bag)', 'medium' => 'Medium (box / backpack)', 'large' => 'Large (bulky item)'];

    public function label(): string
    {
        return match ($this) {
            self::MigoMoto => 'MigoMoto',
            self::MigoCars => 'MigoCars',
            self::MigoDala => 'MigoDala',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::MigoMoto => 'Motorcycle ride from one place to another. Quick and affordable!',
            self::MigoCars => 'A private car for a more comfortable ride.',
            self::MigoDala => 'Packages, parcels, documents and items delivered for you.',
        };
    }

    public function isDelivery(): bool
    {
        return $this === self::MigoDala;
    }

    /** Riders are matched by vehicle: cars go to 4-wheel riders, motorcycle rides and deliveries to 2-wheel riders. */
    public function vehicleType(): VehicleType
    {
        return $this === self::MigoCars ? VehicleType::FourWheel : VehicleType::TwoWheel;
    }

    /**
     * The vehicle a booking needs. Rides use the service's vehicle. A MigoDala delivery uses the vehicle the customer chose
     * (motorcycle by default), except a Large package, which always needs a car.
     */
    public function vehicleFor(?string $packageSize, ?string $chosen): VehicleType
    {
        if (! $this->isDelivery()) {
            return $this->vehicleType();
        }
        if ($packageSize === 'large') {
            return VehicleType::FourWheel;
        }

        return VehicleType::tryFrom((string) $chosen) ?? VehicleType::TwoWheel;
    }

    /** Seats for passengers (0 for a delivery). Admin-editable through dispatch settings. */
    public function maxPassengers(): int
    {
        return match ($this) {
            self::MigoMoto => max(1, (int) DispatchSetting::get('migomoto_max_passengers', '1')),
            self::MigoCars => max(1, (int) DispatchSetting::get('migocars_max_passengers', '4')),
            self::MigoDala => 0,
        };
    }

    /**
     * dispatch_settings keys for this service's fare. MigoMoto keeps the original (un-prefixed) keys so existing
     * configuration is untouched; the other services have their own keys.
     *
     * @return array{base: string, base_km: string, per_km: string, minimum: string}
     */
    public function fareKeys(): array
    {
        $p = match ($this) {
            self::MigoMoto => 'fare_',
            self::MigoCars => 'fare_cars_',
            self::MigoDala => 'fare_dala_',
        };

        return ['base' => $p.'base_php', 'base_km' => $p.'base_km', 'per_km' => $p.'per_km_php', 'minimum' => $p.'minimum_php'];
    }

    public static function fromInput(mixed $value): self
    {
        return self::tryFrom(strtoupper(trim((string) $value))) ?? self::MigoMoto;
    }
}