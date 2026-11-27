<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Optional profile photo chosen by the staff member (shown in the admin sidebar and on their profile page). */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('admin_profiles', 'avatar_path')) {
            Schema::table('admin_profiles', function (Blueprint $table) {
                $table->string('avatar_path')->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('admin_profiles', 'avatar_path')) {
            Schema::table('admin_profiles', function (Blueprint $table) {
                $table->dropColumn('avatar_path');
            });
        }
    }
};
