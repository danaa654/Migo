<?php

namespace App\Support;

/**
 * Plate numbers are compared without spaces and dashes, so "ABC 123", "ABC-123" and "abc123" are the same plate.
 * The stored value is never rewritten; use this only when comparing.
 */
final class PlateNumber
{
    public static function normalize(?string $plate): string
    {
        return preg_replace('/[\s\-]+/', '', strtoupper((string) $plate)) ?? '';
    }

    public static function same(?string $a, ?string $b): bool
    {
        $a = self::normalize($a);

        return $a !== '' && $a === self::normalize($b);
    }
}
