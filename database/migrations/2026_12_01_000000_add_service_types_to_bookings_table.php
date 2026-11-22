<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * MigoMoto / MigoCars / MigoDala. Extends the EXISTING bookings table (no second bookings table):
 * every existing booking becomes MIGOMOTO, so history, dispatch and the admin/rider screens keep working.
 *
 * It also adds the fare settings for the two new services. The values are only STARTING rates, stored in
 * dispatch_settings so a super administrator can change them under Admin > Settings (they are not in code).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $t) {
            $add = fn (string $c, callable $f) => Schema::hasColumn('bookings', $c) ?: $f();
            $add('service_type', fn () => $t->string('service_type', 12)->default('MIGOMOTO')->index());
            $add('passenger_count', fn () => $t->unsignedTinyInteger('passenger_count')->nullable()); // rides only
            $add('notes', fn () => $t->string('notes', 300)->nullable());                              // pickup or delivery notes
            $add('recipient_name', fn () => $t->string('recipient_name', 120)->nullable());            // MigoDala only
            $add('recipient_phone', fn () => $t->string('recipient_phone', 30)->nullable());
            $add('item_description', fn () => $t->string('item_description', 255)->nullable());
            $add('package_size', fn () => $t->string('package_size', 20)->nullable());
        });

        DB::table('bookings')->whereNull('passenger_count')->where('service_type', 'MIGOMOTO')->update(['passenger_count' => 1]);

        $now = now();
        foreach ([
            'fare_cars_base_php' => '50', 'fare_cars_base_km' => '1', 'fare_cars_per_km_php' => '15', 'fare_cars_minimum_php' => '50',
            'fare_dala_base_php' => '30', 'fare_dala_base_km' => '1', 'fare_dala_per_km_php' => '12', 'fare_dala_minimum_php' => '30',
            'migomoto_max_passengers' => '1', 'migocars_max_passengers' => '4',
        ] as $key => $value) {
            if (! DB::table('dispatch_settings')->where('key', $key)->exists()) {
                DB::table('dispatch_settings')->insert(['key' => $key, 'value' => $value, 'updated_at' => $now]);
            }
        }
    }

    public function down(): void
    {
        DB::table('dispatch_settings')->whereIn('key', [
            'fare_cars_base_php', 'fare_cars_base_km', 'fare_cars_per_km_php', 'fare_cars_minimum_php',
            'fare_dala_base_php', 'fare_dala_base_km', 'fare_dala_per_km_php', 'fare_dala_minimum_php',
            'migomoto_max_passengers', 'migocars_max_passengers',
        ])->delete();

        Schema::table('bookings', function (Blueprint $t) {
            $t->dropIndex(['service_type']);
            $t->dropColumn(['service_type', 'passenger_count', 'notes', 'recipient_name', 'recipient_phone', 'item_description', 'package_size']);
        });
    }
};
