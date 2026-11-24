<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per upheld complaint: the penalty points given to the person the complaint was against, the action the
 * administrator chose, and (for a timed suspension) when it ends. A brand new table, so no existing table changes.
 * Points count only until expires_at; active points = sum of points where expires_at is in the future.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('complaint_penalties', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('complaint_id', 36)->unique();          // one penalty per complaint
            $table->string('subject_type', 20);                    // rider | passenger (who received the points)
            $table->string('subject_id', 36);
            $table->string('severity', 20);                        // minor | serious
            $table->unsignedTinyInteger('points');
            $table->string('action', 30);                          // none | warning | final_warning | suspend_7 | suspend_30 | suspend_indefinite
            $table->timestamp('suspension_ends_at')->nullable();   // null for a warning or an indefinite suspension
            $table->timestamp('suspension_lifted_at')->nullable(); // set once the timed suspension was lifted automatically
            $table->string('suspension_reason', 255)->nullable();  // the exact text stored on the account, used to avoid lifting someone else's suspension
            $table->timestamp('expires_at');                       // points stop counting after this
            $table->string('decided_by', 36)->nullable();          // admin_profiles.id
            $table->timestamp('created_at')->useCurrent();

            $table->index(['subject_type', 'subject_id', 'expires_at']);
            $table->index('suspension_ends_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('complaint_penalties');
    }
};
