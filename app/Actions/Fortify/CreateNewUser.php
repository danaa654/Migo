<?php

namespace App\Actions\Fortify;

use App\Models\User;
use Laravel\Fortify\Contracts\CreatesNewUsers;

/**
 * Fortify's generic POST /register used to create a (customer) account here. Customers no longer register:
 * they sign in with Google or a phone OTP, and riders register at /register/biker. This closes the generic route.
 */
class CreateNewUser implements CreatesNewUsers
{
    /** @param  array<string, string>  $input */
    public function create(array $input): User
    {
        abort(404);
    }
}
