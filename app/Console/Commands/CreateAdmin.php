<?php

namespace App\Console\Commands;

use App\Enums\AccountRole;
use App\Models\AdminProfile;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CreateAdmin extends Command
{
    protected $signature = 'admin:create {--name=} {--email=} {--password=} {--role=admin : admin or super_admin}';

    protected $description = 'Create an administrator account (there is no public admin registration)';

    public function handle(): int
    {
        $name = $this->option('name') ?: $this->ask('Full name');
        $email = $this->option('email') ?: $this->ask('Email address');
        $password = $this->option('password') ?: $this->secret('Password (min 8 characters)');
        $role = $this->option('role');

        if (! filter_var($email, FILTER_VALIDATE_EMAIL) || strlen((string) $password) < 8 || ! in_array($role, ['admin', 'super_admin'], true)) {
            $this->error('Invalid input: use a valid email, a password of at least 8 characters, and role admin or super_admin.');

            return self::FAILURE;
        }
        if (User::where('email', $email)->exists()) {
            $this->error("A user with {$email} already exists.");

            return self::FAILURE;
        }

        DB::transaction(function () use ($name, $email, $password, $role) {
            $user = User::create(['name' => $name, 'email' => $email, 'password' => $password]);
            $user->forceFill(['email_verified_at' => now(), 'role' => AccountRole::Admin->value])->save();
            AdminProfile::create(['user_id' => $user->id, 'full_name' => $name, 'email' => $email, 'role' => $role, 'status' => 'active']);
        });

        $this->info("Administrator {$email} created.");

        return self::SUCCESS;
    }
}
