<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Riders can be 2-wheel (Biker) or 4-wheel (Angcars). Existing rows default to two_wheel,
 * so every rider registered before this change stays a Biker.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('riders') && ! Schema::hasColumn('riders', 'vehicle_type')) {
            Schema::table('riders', function (Blueprint $t) {
                $t->string('vehicle_type', 20)->default('two_wheel')->after('motorcycle_plate_number');
                $t->index('vehicle_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('riders') && Schema::hasColumn('riders', 'vehicle_type')) {
            Schema::table('riders', function (Blueprint $t) {
                $t->dropIndex(['vehicle_type']);
                $t->dropColumn('vehicle_type');
            });
        }
    }
};
