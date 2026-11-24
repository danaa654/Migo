<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Support Center: one inbox for every report. No new tables and nothing is dropped.
 * Existing rows become report_type = 'complaint' through the column default.
 *   report_type:        complaint | support | incident
 *   occurred_at:        incident reports only (when it happened)
 *   incident_location:  incident reports only (where it happened, free text)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('complaints')) {
            return;
        }

        Schema::table('complaints', function (Blueprint $t) {
            if (! Schema::hasColumn('complaints', 'report_type')) {
                $t->string('report_type', 20)->default('complaint')->index();
            }
            if (! Schema::hasColumn('complaints', 'occurred_at')) {
                $t->timestamp('occurred_at')->nullable();
            }
            if (! Schema::hasColumn('complaints', 'incident_location')) {
                $t->string('incident_location')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('complaints')) {
            return;
        }

        Schema::table('complaints', function (Blueprint $t) {
            if (Schema::hasColumn('complaints', 'report_type')) {
                $t->dropIndex(['report_type']);
            }
            $cols = array_values(array_filter(['report_type', 'occurred_at', 'incident_location'], fn ($c) => Schema::hasColumn('complaints', $c)));
            if ($cols) {
                $t->dropColumn($cols);
            }
        });
    }
};
