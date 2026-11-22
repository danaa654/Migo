<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One emailed one-time code. Only a keyed hash of the code is stored, never the code itself.
 *
 * @property int $id
 * @property string $email lower-cased
 * @property string $code_hash
 * @property Carbon $expires_at
 * @property int $attempts
 * @property Carbon|null $consumed_at
 * @property string|null $ip_address
 */
#[Hidden(['code_hash'])]
class EmailLoginOtp extends Model
{
    protected $table = 'email_login_otps';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'consumed_at' => 'datetime', 'attempts' => 'integer'];
    }
}
