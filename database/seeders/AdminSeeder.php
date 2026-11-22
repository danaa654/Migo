<?php

namespace Database\Seeders;

use App\Enums\AccountRole;
use App\Models\AdminProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AdminSeeder extends Seeder
{
    /**
     * Creates (or resets) the default administrator. Safe to run more than once.
     * Override the defaults with ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env.
     */
    public function run(): void
    {
        $name = env('ADMIN_NAME', 'System Administrator');
        $email = env('ADMIN_EMAIL', 'admin@migo.test');
        $password = env('ADMIN_PASSWORD', 'Password123');

        DB::transaction(function () use ($name, $email, $password) {
            $user = User::updateOrCreate(['email' => $email], ['name' => $name, 'password' => $password]);
            $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now(), 'role' => AccountRole::Admin->value])->save();

            AdminProfile::updateOrCreate(
                ['user_id' => $user->id],
                ['full_name' => $name, 'email' => $email, 'role' => 'super_admin', 'status' => 'active'],
            );
        });
    }
}
