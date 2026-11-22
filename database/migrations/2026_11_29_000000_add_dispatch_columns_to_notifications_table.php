<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dispatch notifications reuse the existing `notifications` table (no new table).
 * user_id = recipient (rider or passenger account); NULL keeps meaning "administrator feed".
 * booking_id + event let the dispatch engine find (and de-duplicate) notifications per booking.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $t) {
            if (! Schema::hasColumn('notifications', 'booking_id')) {
                $t->foreignUuid('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
                $t->string('event', 40)->nullable();
                $t->json('data')->nullable();
                $t->index(['booking_id', 'event']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $t) {
            $t->dropForeign(['booking_id']);
            $t->dropIndex(['booking_id', 'event']);
            $t->dropColumn(['booking_id', 'event', 'data']);
        });
    }
};
