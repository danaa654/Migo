<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a registered account (users) own its existing profile row in riders / passengers.
 * No new tables. Existing rows are kept; where a user and a profile already share an email
 * they are linked so existing accounts keep their data.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['riders' => 'biker', 'passengers' => 'customer'] as $table => $role) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            if (! Schema::hasColumn($table, 'user_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
                });
            }

            DB::table('users')->where('role', $role)->orderBy('id')->each(function ($user) use ($table) {
                DB::table($table)
                    ->where('email', $user->email)
                    ->whereNull('user_id')
                    ->update(['user_id' => $user->id]);
            });
        }
    }

    public function down(): void
    {
        foreach (['riders', 'passengers'] as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'user_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropConstrainedForeignId('user_id');
                });
            }
        }
    }
};
