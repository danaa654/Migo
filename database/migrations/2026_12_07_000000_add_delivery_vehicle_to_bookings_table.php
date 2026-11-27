<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * MigoDala deliveries can go by motorcycle (two_wheel) or car (four_wheel). The customer chooses (a Large package is
 * always a car) and dispatch only offers the booking to riders with that vehicle. Additive and nullable: existing
 * bookings keep working (null = the service's default vehicle, so old MigoDala deliveries stay on motorcycles).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('bookings', 'delivery_vehicle')) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->string('delivery_vehicle', 20)->nullable()->after('package_size');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('bookings', 'delivery_vehicle')) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->dropColumn('delivery_vehicle');
            });
        }
    }
};