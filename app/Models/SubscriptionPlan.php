<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    public const UNITS = ['day', 'month', 'year'];

    protected $fillable = ['name', 'description', 'duration_value', 'duration_unit', 'price', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['price' => 'float', 'is_active' => 'boolean', 'duration_value' => 'integer'];
    }

    /** "3 months", "1 year" ... */
    public function durationLabel(): string
    {
        return self::label($this->duration_value, $this->duration_unit);
    }

    public static function label(int $value, string $unit): string
    {
        // 12 months is shown as 1 year, to match how the plans are sold.
        if ($unit === 'month' && $value % 12 === 0) {
            [$value, $unit] = [intdiv($value, 12), 'year'];
        }

        return $value.' '.$unit.($value === 1 ? '' : 's');
    }

    public function monthlyEquivalent(): ?float
    {
        $months = match ($this->duration_unit) {
            'month' => $this->duration_value,
            'year' => $this->duration_value * 12,
            default => null,
        };

        return $months ? round($this->price / $months, 2) : null;
    }
}
