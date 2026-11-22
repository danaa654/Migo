<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Adds the NBI Clearance upload to the existing riders table. Nullable, so existing riders are untouched. */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('riders', 'nbi_clearance')) {
            Schema::table('riders', function (Blueprint $t) {
                $t->string('nbi_clearance')->nullable(); // path on the private "local" disk
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('riders', 'nbi_clearance')) {
            Schema::table('riders', function (Blueprint $t) {
                $t->dropColumn('nbi_clearance');
            });
        }
    }
};
