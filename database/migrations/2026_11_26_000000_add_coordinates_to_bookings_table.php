<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds optional map coordinates to the existing bookings table. All columns are nullable, so existing bookings
 * and typed-address bookings keep working unchanged.
 */
return new class extends Migration
{
    private array $columns = ['pickup_lat', 'pickup_lng', 'destination_lat', 'destination_lng'];

    public function up(): void
    {
        if (! Schema::hasTable('bookings')) {
            return;
        }

        foreach ($this->columns as $column) {
            if (! Schema::hasColumn('bookings', $column)) {
                Schema::table('bookings', function (Blueprint $t) use ($column) {
                    $t->decimal($column, 10, 7)->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('bookings')) {
            return;
        }

        foreach ($this->columns as $column) {
            if (Schema::hasColumn('bookings', $column)) {
                Schema::table('bookings', function (Blueprint $t) use ($column) {
                    $t->dropColumn($column);
                });
            }
        }
    }
};
