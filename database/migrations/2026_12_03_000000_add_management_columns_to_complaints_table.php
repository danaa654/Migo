<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Complaint Management. No new tables: `complaints` gets the booking it is about, who it is against,
 * the staff member handling it and how it ended. Decision history lives in `audit_logs` (subject_type = 'complaint').
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('complaints')) {
            return;
        }

        Schema::table('complaints', function (Blueprint $t) {
            if (! Schema::hasColumn('complaints', 'booking_id')) {
                $t->foreignUuid('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            }
            if (! Schema::hasColumn('complaints', 'against_type')) {
                $t->string('against_type', 20)->nullable(); // rider | passenger
                $t->uuid('against_id')->nullable();
            }
            if (! Schema::hasColumn('complaints', 'assigned_to')) {
                $t->foreignUuid('assigned_to')->nullable()->constrained('admin_profiles')->nullOnDelete();
            }
            if (! Schema::hasColumn('complaints', 'resolution_note')) {
                $t->text('resolution_note')->nullable();
                $t->timestamp('resolved_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('complaints')) {
            return;
        }

        Schema::table('complaints', function (Blueprint $t) {
            foreach (['booking_id', 'assigned_to'] as $fk) {
                if (Schema::hasColumn('complaints', $fk)) {
                    $t->dropConstrainedForeignId($fk);
                }
            }
            $cols = array_values(array_filter(['against_type', 'against_id', 'resolution_note', 'resolved_at'], fn ($c) => Schema::hasColumn('complaints', $c)));
            if ($cols) {
                $t->dropColumn($cols);
            }
        });
    }
};