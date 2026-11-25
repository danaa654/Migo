<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            // Card colour chosen by the admin, as #RRGGBB. Null = the app picks one by plan name.
            $table->string('color', 7)->nullable()->after('description');
        });

        // Keep today's look for the three existing plans so the edit form shows their colour.
        foreach (['basic' => '#F5C542', 'standard' => '#2C4F73', 'premium' => '#171717'] as $name => $hex) {
            DB::table('subscription_plans')->whereRaw('lower(name) like ?', ['%'.$name.'%'])->whereNull('color')->update(['color' => $hex]);
        }
    }

    public function down(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn('color');
        });
    }
};
