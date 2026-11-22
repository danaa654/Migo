<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingRating extends Model
{
    protected $fillable = ['booking_id', 'rater_type', 'rater_user_id', 'rated_rider_id', 'rating', 'comment'];
}
