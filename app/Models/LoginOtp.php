<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One SMS one-time code. Only a keyed hash of the code is stored, never the code itself.
 *
 * @property int $id
 * @property string $phone E.164
 * @property string $code_hash
 * @property Carbon $expires_at
 * @property int $attempts
 * @property Carbon|null $consumed_at
 * @property string|null $ip_address
 */
#[Hidden(['code_hash'])]
class LoginOtp extends Model
{
    protected $table = 'login_otps';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'consumed_at' => 'datetime', 'attempts' => 'integer'];
    }
}
