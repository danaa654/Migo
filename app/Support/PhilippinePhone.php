<?php

namespace App\Support;

/**
 * Philippine mobile numbers. The canonical (stored) form is E.164: +639XXXXXXXXX.
 *
 * Accepted input (spaces, dashes, dots and brackets are ignored):
 *   09171234567, 9171234567, +639171234567
 * Everything else is rejected (returns null).
 */
final class PhilippinePhone
{
    public static function normalize(?string $input): ?string
    {
        if ($input === null) {
            return null;
        }

        $value = preg_replace('/[\s\-().]/', '', trim($input)) ?? '';

        if (preg_match('/^\+639(\d{9})$/', $value, $m) === 1
            || preg_match('/^09(\d{9})$/', $value, $m) === 1
            || preg_match('/^9(\d{9})$/', $value, $m) === 1) {
            return '+639'.$m[1];
        }

        return null;
    }

    /** +639171234567 -> 09171234567 (the format the existing passengers/riders tables already use). */
    public static function toLocal(string $e164): string
    {
        return '0'.substr($e164, 3);
    }

    /**
     * Every way the same number may already be stored in the database (legacy rows use 09XXXXXXXXX).
     *
     * @return list<string>
     */
    public static function variants(string $e164): array
    {
        return [$e164, self::toLocal($e164), substr($e164, 3), substr($e164, 1)];
    }

    /** +639171234567 -> "+63 917 123 4567" */
    public static function format(string $e164): string
    {
        return sprintf('+63 %s %s %s', substr($e164, 3, 3), substr($e164, 6, 3), substr($e164, 9));
    }
}
