<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Trip tables. The trip / fare defaults live in dispatch_settings (seeded in create_dispatch_tables). */
return new class extends Migration
{
    public function up(): void
    {
        // One rating per side per booking: the passenger rates the rider, the rider rates the passenger.
        Schema::create('booking_ratings', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('booking_id')->constrained('bookings')->cascadeOnDelete();
            $t->string('rater_type', 20); // passenger | rider
            $t->unsignedBigInteger('rater_user_id')->nullable();
            $t->foreignUuid('rated_rider_id')->nullable()->constrained('riders')->nullOnDelete(); // set when a passenger rates a rider
            $t->unsignedTinyInteger('rating');
            $t->string('comment', 500)->nullable();
            $t->timestamps();
            $t->unique(['booking_id', 'rater_type']);
            $t->index(['rated_rider_id', 'rater_type']);
        });

        // GPS trail recorded while a trip is IN_PROGRESS.
        Schema::create('booking_route_points', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('booking_id')->constrained('bookings')->cascadeOnDelete();
            $t->decimal('latitude', 10, 7);
            $t->decimal('longitude', 10, 7);
            $t->decimal('speed', 6, 2)->nullable();
            $t->timestamp('recorded_at')->useCurrent();
            $t->index(['booking_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_route_points');
        Schema::dropIfExists('booking_ratings');
    }
};
