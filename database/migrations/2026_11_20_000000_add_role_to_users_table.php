<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds users.role (customer | biker | admin) without touching or deleting any existing row.
 *
 * Existing accounts are classified once, here, from data that already exists:
 *  - users that have an admin_profiles row          -> admin
 *  - users whose email is in the riders table       -> biker
 *  - everyone else (incl. passengers)               -> customer (column default)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role', 20)->default('customer')->after('password')->index();
            });
        }

        if (Schema::hasTable('riders')) {
            DB::table('users')
                ->whereIn('email', DB::table('riders')->select('email'))
                ->update(['role' => 'biker']);
        }

        if (Schema::hasTable('admin_profiles')) {
            // Runs last so an admin is never downgraded by an email match above.
            DB::table('users')
                ->whereIn('id', DB::table('admin_profiles')->select('user_id'))
                ->update(['role' => 'admin']);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex(['role']);
                $table->dropColumn('role');
            });
        }
    }
};
