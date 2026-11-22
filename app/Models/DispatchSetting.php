<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class DispatchSetting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public const CREATED_AT = null;

    protected $fillable = ['key', 'value', 'updated_by'];

    /** @return array<string, string> all settings, cached for 60 s. */
    public static function all_(): array
    {
        return Cache::remember('dispatch_settings', 60, fn () => static::query()->pluck('value', 'key')->all());
    }

    public static function get(string $key, string $default): string
    {
        return self::all_()[$key] ?? $default;
    }

    public static function flush(): void
    {
        Cache::forget('dispatch_settings');
    }
}
