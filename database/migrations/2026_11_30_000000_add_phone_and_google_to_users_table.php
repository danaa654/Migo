<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Customer sign-in with Google or phone OTP. ADDITIVE ONLY: no row is deleted or rewritten.
 *
 *  - users.google_id (unique, nullable)
 *  - users.phone (E.164, unique, nullable) and users.phone_verified_at   <- single source of truth for the phone login
 *  - users.email and passengers.email become NULLABLE so a phone-only customer needs no email.
 *    Existing values are untouched; MySQL/MariaDB/SQLite unique indexes allow many NULLs.
 *  - users.password stays NOT NULL: passwordless customers get a random, unusable hash.
 *
 * passengers.phone keeps the existing local format (09XXXXXXXXX) and is kept in sync from users.phone in code.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'google_id')) {
                $table->string('google_id', 64)->nullable()->unique()->after('email');
            }
            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 20)->nullable()->unique()->after('google_id');
            }
            if (! Schema::hasColumn('users', 'phone_verified_at')) {
                $table->timestamp('phone_verified_at')->nullable()->after('phone');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });

        if (Schema::hasTable('passengers')) {
            Schema::table('passengers', function (Blueprint $table) {
                $table->string('email')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        // Only restore NOT NULL when no phone-only account exists, so rolling back can never fail or lose data.
        if (! DB::table('users')->whereNull('email')->exists()) {
            Schema::table('users', fn (Blueprint $table) => $table->string('email')->nullable(false)->change());
        }
        if (Schema::hasTable('passengers') && ! DB::table('passengers')->whereNull('email')->exists()) {
            Schema::table('passengers', fn (Blueprint $table) => $table->string('email')->nullable(false)->change());
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropUnique(['phone']);
            $table->dropColumn(['google_id', 'phone', 'phone_verified_at']);
        });
    }
};
