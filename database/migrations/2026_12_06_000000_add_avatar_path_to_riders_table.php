<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Riders keep TWO photos:
 *  - profile_picture: the live selfie taken at registration. Part of the accreditation record. Riders can never change it.
 *  - avatar_path:     the photo the rider chooses to show (sidebar, and passengers during a trip). Falls back to profile_picture.
 * Additive and nullable, so no existing row or rider account is touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('riders', 'avatar_path')) {
            Schema::table('riders', function (Blueprint $table) {
                $table->string('avatar_path')->nullable()->after('profile_picture');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('riders', 'avatar_path')) {
            Schema::table('riders', function (Blueprint $table) {
                $table->dropColumn('avatar_path');
            });
        }
    }
};
