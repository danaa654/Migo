<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Optional profile photo chosen by the customer (shown in their sidebar and to the rider once a ride is accepted). */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('passengers', 'avatar_path')) {
            Schema::table('passengers', function (Blueprint $table) {
                $table->string('avatar_path')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('passengers', 'avatar_path')) {
            Schema::table('passengers', function (Blueprint $table) {
                $table->dropColumn('avatar_path');
            });
        }
    }
};
