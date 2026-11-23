<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Passenger Management. No new tables: `passengers` gets the reason shown to a suspended passenger.
 * The decision history is stored in the existing `audit_logs` table (subject_type = 'passenger').
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('passengers') && ! Schema::hasColumn('passengers', 'suspension_reason')) {
            Schema::table('passengers', function (Blueprint $t) {
                $t->text('suspension_reason')->nullable()->after('account_status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('passengers') && Schema::hasColumn('passengers', 'suspension_reason')) {
            Schema::table('passengers', function (Blueprint $t) {
                $t->dropColumn('suspension_reason');
            });
        }
    }
};