<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingStatusHistory extends Model
{
    protected $table = 'booking_status_history';

    public const UPDATED_AT = null;

    protected $fillable = ['booking_id', 'previous_status', 'new_status', 'changed_by', 'actor_type', 'remarks'];
}
