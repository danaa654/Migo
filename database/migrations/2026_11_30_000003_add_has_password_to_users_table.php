<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Email-code customers have an email AND no google_id, which User::canChangePassword() used to treat as
 * "has a real password". This flag says it explicitly. Existing rows default to true (unchanged behavior);
 * CustomerAccountService::newCustomer() sets it to false for every passwordless customer from now on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'has_password')) {
                $table->boolean('has_password')->default(true)->after('password');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('has_password');
        });
    }
};
