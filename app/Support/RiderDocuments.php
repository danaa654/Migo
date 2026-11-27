<?php

namespace App\Support;

use App\Models\Rider;
use Illuminate\Support\Facades\Storage;

/**
 * The four documents a rider uploads when applying. The files live on the private "local" disk, never in /storage,
 * and are only ever served through an authenticated route (administrators for any rider, a rider for their own).
 */
final class RiderDocuments
{
    /** URL type => [riders column, label] (same keys the administrator pages use). */
    public const TYPES = [
        'license' => ['license_document', "Driver's License"],
        'registration' => ['registration_document', 'Motorcycle Registration (OR/CR)'],
        'receipt' => ['official_receipt', 'Official Receipt'],
        'nbi' => ['nbi_clearance', 'NBI Clearance'],
    ];

    /** @return list<array{type: string, label: string, available: bool, is_image: bool, url: string|null}> */
    public static function forRider(Rider $rider): array
    {
        $out = [];
        foreach (self::TYPES as $type => [$column, $label]) {
            $path = $rider->{$column};
            $exists = $path && Storage::disk('local')->exists($path);
            $out[] = [
                'type' => $type,
                'label' => $label,
                'available' => (bool) $exists,
                'is_image' => $exists && in_array(strtolower(pathinfo((string) $path, PATHINFO_EXTENSION)), ['jpg', 'jpeg', 'png'], true),
                'url' => $exists ? route('biker.documents', ['type' => $type], false) : null,
            ];
        }

        return $out;
    }

    public static function path(Rider $rider, string $type): ?string
    {
        if (! isset(self::TYPES[$type])) {
            return null;
        }
        $path = $rider->{self::TYPES[$type][0]};

        return $path && Storage::disk('local')->exists($path) ? $path : null;
    }
}