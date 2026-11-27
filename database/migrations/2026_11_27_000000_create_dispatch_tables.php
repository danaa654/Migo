<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Real-time dispatch tables. The bookings table itself (with its dispatch columns) is created in
 * create_admin_operations_tables.
 *
 * dispatch_settings is seeded here with every default (dispatch, trip / fares, and the MigoCars / MigoDala rates).
 * They are only STARTING values: a super administrator can change them under Admin > Settings.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Live rider position (one row per rider, overwritten on every update).
        Schema::create('rider_locations', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('rider_id')->unique()->constrained('riders')->cascadeOnDelete();
            $t->decimal('latitude', 10, 7);
            $t->decimal('longitude', 10, 7);
            $t->decimal('heading', 5, 2)->nullable();
            $t->decimal('speed', 6, 2)->nullable(); // km/h
            $t->decimal('accuracy', 7, 2)->nullable(); // metres
            $t->timestamp('last_location_update');
            $t->timestamps();
            $t->index(['latitude', 'longitude']);
            $t->index('last_location_update');
        });

        // Rider availability state machine.
        Schema::create('rider_availability', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('rider_id')->unique()->constrained('riders')->cascadeOnDelete();
            $t->string('availability_status', 30)->default('offline');
            $t->boolean('is_online')->default(false);
            $t->timestamp('last_active_at')->nullable();
            $t->timestamps();
            $t->index(['is_online', 'availability_status']);
        });

        // One offer per (booking, rider): the unique key is what stops duplicate notifications on radius expansion.
        Schema::create('rider_booking_offers', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('booking_id')->constrained('bookings')->cascadeOnDelete();
            $t->foreignUuid('rider_id')->constrained('riders')->cascadeOnDelete();
            $t->unsignedInteger('distance_to_pickup'); // metres
            $t->unsignedInteger('estimated_pickup_time'); // minutes
            $t->string('offer_status', 30)->default('sent');
            $t->timestamp('notified_at')->nullable();
            $t->timestamp('expires_at');
            $t->timestamp('responded_at')->nullable();
            $t->timestamps();
            $t->unique(['booking_id', 'rider_id']);
            $t->index(['rider_id', 'offer_status', 'expires_at']);
            $t->index(['booking_id', 'offer_status']);
        });

        // Audit trail of every status change.
        Schema::create('booking_status_history', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('booking_id')->constrained('bookings')->cascadeOnDelete();
            $t->string('previous_status', 30)->nullable();
            $t->string('new_status', 30);
            $t->unsignedBigInteger('changed_by')->nullable(); // users.id; null = system
            $t->string('actor_type', 20); // passenger | rider | admin | system
            $t->string('remarks')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['booking_id', 'id']);
        });

        // Admin-editable settings (key/value).
        Schema::create('dispatch_settings', function (Blueprint $t) {
            $t->string('key', 60)->primary();
            $t->string('value', 255);
            $t->timestamp('updated_at')->nullable();
            $t->unsignedBigInteger('updated_by')->nullable();
        });

        $now = now();
        foreach ([
            // Dispatch
            'search_radii_km' => '1,2,3,5,8',
            'expansion_interval_seconds' => '20',
            'offer_expiration_seconds' => '20',
            'max_search_duration_seconds' => '180',
            'location_freshness_seconds' => '60',
            'initial_dispatch_all' => '1',
            // Trip + MigoMoto fare (the un-prefixed keys)
            'arrival_radius_meters' => '300',
            'fare_base_php' => '20',
            'fare_base_km' => '1',
            'fare_per_km_php' => '10',
            'fare_minimum_php' => '20',
            // MigoCars fare
            'fare_cars_base_php' => '50',
            'fare_cars_base_km' => '1',
            'fare_cars_per_km_php' => '15',
            'fare_cars_minimum_php' => '50',
            // MigoDala fare
            'fare_dala_base_php' => '30',
            'fare_dala_base_km' => '1',
            'fare_dala_per_km_php' => '12',
            'fare_dala_minimum_php' => '30',
            // Passenger limits
            'migomoto_max_passengers' => '1',
            'migocars_max_passengers' => '4',
        ] as $key => $value) {
            DB::table('dispatch_settings')->insert(['key' => $key, 'value' => $value, 'updated_at' => $now]);
        }
    }

    public function down(): void
    {
        foreach (['dispatch_settings', 'booking_status_history', 'rider_booking_offers', 'rider_availability', 'rider_locations'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
