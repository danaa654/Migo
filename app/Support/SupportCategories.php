<?php

namespace App\Support;

/**
 * Report types and their categories for the Support Center. The key is stored in complaints.complaint_category.
 * Complaint categories differ by who files (a passenger reports a rider, a rider reports a passenger).
 */
class SupportCategories
{
    /** type => [label shown on the type picker, short hint, noun used in messages] */
    public const TYPES = [
        'complaint' => ['label' => 'Complaint', 'hint' => 'Report the behavior of a rider or passenger.', 'noun' => 'complaint'],
        'support' => ['label' => 'Support request', 'hint' => 'Ask for help or report a problem. It never names anyone.', 'noun' => 'support request'],
        'incident' => ['label' => 'Incident report', 'hint' => 'Report an accident or a safety problem. Handled first.', 'noun' => 'incident report'],
    ];

    public const COMPLAINT = [
        'passenger' => [
            'rider_behavior' => 'Rude or unprofessional rider',
            'unsafe_driving' => 'Unsafe driving',
            'harassment' => 'Harassment or inappropriate behavior',
            'overcharging' => 'Overcharging or fare dispute',
            'late_or_no_show' => 'Rider was late or did not show up',
            'vehicle_condition' => 'Vehicle or equipment condition',
            'lost_item' => 'Lost item',
            'other' => 'Something else',
        ],
        'rider' => [
            'rude_behavior' => 'Rude or disrespectful passenger',
            'harassment' => 'Harassment or inappropriate behavior',
            'unsafe_conduct' => 'Unsafe conduct during the trip',
            'no_show' => 'Passenger did not show up',
            'fare_dispute' => 'Refused to pay or fare dispute',
            'property_damage' => 'Damage to my motorcycle or equipment',
            'false_booking' => 'Fake or prank booking',
            'other' => 'Something else',
        ],
    ];

    public const SUPPORT = [
        'passenger' => [
            'payment_help' => 'Payment or fare question',
            'booking_help' => 'Help with a booking',
            'account_help' => 'Account or profile help',
            'app_problem' => 'App problem or bug',
            'feedback' => 'Suggestion or feedback',
            'support_other' => 'Something else',
        ],
        'rider' => [
            'payment_help' => 'Payment or fare question',
            'booking_help' => 'Help with a trip or booking',
            'account_help' => 'Account or accreditation help',
            'app_problem' => 'App problem or bug',
            'feedback' => 'Suggestion or feedback',
            'support_other' => 'Something else',
        ],
    ];

    public const INCIDENT = [
        'accident' => 'Accident or collision',
        'injury' => 'Someone was hurt',
        'threat' => 'Threat or feeling unsafe',
        'road_hazard' => 'Road or area hazard',
        'incident_other' => 'Other safety concern',
    ];

    /** @return array<string, string> key => label for one type and reporter ('passenger' | 'rider'). */
    public static function for(string $type, string $reporter): array
    {
        return match ($type) {
            'support' => self::SUPPORT[$reporter] ?? [],
            'incident' => self::INCIDENT,
            default => self::COMPLAINT[$reporter] ?? [],
        };
    }

    /** @return list<array{key: string, label: string}> */
    public static function options(string $type, string $reporter): array
    {
        return collect(self::for($type, $reporter))->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all();
    }

    /** @return array<string, list<array{key: string, label: string}>> */
    public static function allOptions(string $reporter): array
    {
        return collect(array_keys(self::TYPES))->mapWithKeys(fn ($t) => [$t => self::options($t, $reporter)])->all();
    }

    /** @return list<array{key: string, label: string, hint: string}> */
    public static function typeOptions(): array
    {
        return collect(self::TYPES)->map(fn ($t, $key) => ['key' => $key, 'label' => $t['label'], 'hint' => $t['hint']])->values()->all();
    }

    public static function typeLabel(?string $type): string
    {
        return self::TYPES[$type ?? 'complaint']['label'] ?? 'Complaint';
    }

    public static function noun(?string $type): string
    {
        return self::TYPES[$type ?? 'complaint']['noun'] ?? 'complaint';
    }

    /** Label for any stored category key, whichever type or reporter it came from. */
    public static function label(string $key): string
    {
        foreach ([self::COMPLAINT['passenger'], self::COMPLAINT['rider'], self::SUPPORT['passenger'], self::SUPPORT['rider'], self::INCIDENT] as $list) {
            if (isset($list[$key])) {
                return $list[$key];
            }
        }

        return \Illuminate\Support\Str::headline($key);
    }
}
