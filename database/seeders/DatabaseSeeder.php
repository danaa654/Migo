<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // The default administrator is always created (it is the only way to reach the admin portal).
        $this->call(AdminSeeder::class);

        // Fake customers, riders, bookings and complaints for manual testing. Never runs in production.
        if (! app()->isProduction()) {
            $this->call(DemoDataSeeder::class);
        }
    }
}