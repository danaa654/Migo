<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Real-time dispatch. Extends the EXISTING bookings table (no duplicate "ride_bookings" table):
 * bookings.rider_id is the assigned rider, bookings.pickup_location / destination are the addresses,
 * pickup_lat/lng and destination_lat/lng are the coordinates. Existing rows are converted to the new statuses.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) bookings: status enum -> string, new columns, status data conversion.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE bookings MODIFY booking_status VARCHAR(30) NOT NULL DEFAULT 'pending'");
        }

        Schema::table('bookings', function (Blueprint $t) {
            $add = fn (string $c, callable $f) => Schema::hasColumn('bookings', $c) ?: $f();
            $add('booking_reference', fn () => $t->string('booking_reference', 20)->nullable()->unique());
            $add('estimated_distance', fn () => $t->decimal('estimated_distance', 8, 2)->nullable()); // km
            $add('estimated_duration', fn () => $t->unsignedInteger('estimated_duration')->nullable()); // minutes
            $add('estimated_fare', fn () => $t->decimal('estimated_fare', 10, 2)->nullable());
            $add('final_fare', fn () => $t->decimal('final_fare', 10, 2)->nullable());
            $add('requested_at', fn () => $t->timestamp('requested_at')->nullable());
            $add('search_started_at', fn () => $t->timestamp('search_started_at')->nullable());
            $add('current_search_radius_km', fn () => $t->decimal('current_search_radius_km', 5, 2)->nullable());
            $add('last_expansion_at', fn () => $t->timestamp('last_expansion_at')->nullable());
            $add('assigned_at', fn () => $t->timestamp('assigned_at')->nullable());
            $add('arrived_at', fn () => $t->timestamp('arrived_at')->nullable());
            $add('started_at', fn () => $t->timestamp('started_at')->nullable());
            $add('completed_at', fn () => $t->timestamp('completed_at')->nullable());
            $add('cancelled_at', fn () => $t->timestamp('cancelled_at')->nullable());
            $add('updated_at', fn () => $t->timestamp('updated_at')->nullable());
        });

        // Convert legacy rows. Old "pending" had no dispatch, so it becomes searching and is picked up by the dispatcher.
        foreach (['pending' => 'searching_for_rider', 'accepted' => 'rider_assigned', 'ongoing' => 'in_progress',
            'cancelled' => 'cancelled_by_passenger'] as $old => $new) {
            DB::table('bookings')->where('booking_status', $old)->update(['booking_status' => $new]);
        }
        DB::table('bookings')->whereNull('requested_at')->update(['requested_at' => DB::raw('coalesce(booking_date, created_at)')]);

        Schema::table('bookings', function (Blueprint $t) {
            $t->index(['booking_status', 'requested_at'], 'bookings_status_requested_idx');
            $t->index(['rider_id', 'booking_status'], 'bookings_rider_status_idx');
        });

        // 2) Live rider position (one row per rider, overwritten on every update).
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

        // 3) Rider availability state machine.
        Schema::create('rider_availability', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('rider_id')->unique()->constrained('riders')->cascadeOnDelete();
            $t->string('availability_status', 30)->default('offline');
            $t->boolean('is_online')->default(false);
            $t->timestamp('last_active_at')->nullable();
            $t->timestamps();
            $t->index(['is_online', 'availability_status']);
        });

        // 4) One offer per (booking, rider): the unique key is what stops duplicate notifications on radius expansion.
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

        // 5) Audit trail of every status change.
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

        // 6) Admin-editable dispatch settings (key/value).
        Schema::create('dispatch_settings', function (Blueprint $t) {
            $t->string('key', 60)->primary();
            $t->string('value', 255);
            $t->timestamp('updated_at')->nullable();
            $t->unsignedBigInteger('updated_by')->nullable();
        });

        $now = now();
        foreach ([
            'search_radii_km' => '1,2,3,5,8', 'expansion_interval_seconds' => '20', 'offer_expiration_seconds' => '20',
            'max_search_duration_seconds' => '180', 'location_freshness_seconds' => '60', 'initial_dispatch_all' => '1',
        ] as $key => $value) {
            DB::table('dispatch_settings')->insert(['key' => $key, 'value' => $value, 'updated_at' => $now]);
        }
    }

    public function down(): void
    {
        foreach (['dispatch_settings', 'booking_status_history', 'rider_booking_offers', 'rider_availability', 'rider_locations'] as $table) {
            Schema::dropIfExists($table);
        }
        // bookings is left in place: dropping the new columns/statuses would destroy dispatch history.
    }
};
