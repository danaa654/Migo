<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rider Management. No new tables: the existing riders, notifications and audit_logs tables are extended.
 * Every column is nullable or has a default, so all existing rows are preserved:
 *  - riders: account_status (separate from application_status), review/suspension reasons, optional documents.
 *  - notifications: user_id (recipient). NULL keeps meaning "administrator feed", as before.
 *  - audit_logs: subject_type / subject_id so a rider's decision history can be read back.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('riders', function (Blueprint $t) {
            if (! Schema::hasColumn('riders', 'account_status')) {
                $t->string('account_status', 20)->default('active'); // active | suspended
                $t->index('account_status');
            }
            if (! Schema::hasColumn('riders', 'rejection_reason')) {
                $t->text('rejection_reason')->nullable();
                $t->text('suspension_reason')->nullable();
                $t->timestamp('reviewed_at')->nullable();
                $t->foreignUuid('reviewed_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
                // Paths on the private "local" disk; served to administrators only.
                $t->string('license_document')->nullable();
                $t->string('registration_document')->nullable();
                $t->string('official_receipt')->nullable();
            }
        });

        Schema::table('notifications', function (Blueprint $t) {
            if (! Schema::hasColumn('notifications', 'user_id')) {
                $t->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
                $t->index(['user_id', 'created_at']);
            }
        });

        Schema::table('audit_logs', function (Blueprint $t) {
            if (! Schema::hasColumn('audit_logs', 'subject_id')) {
                $t->string('subject_type', 30)->nullable();
                $t->uuid('subject_id')->nullable();
                $t->index(['subject_type', 'subject_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $t) {
            $t->dropIndex(['subject_type', 'subject_id']);
            $t->dropColumn(['subject_type', 'subject_id']);
        });
        Schema::table('notifications', function (Blueprint $t) {
            $t->dropConstrainedForeignId('user_id');
        });
        Schema::table('riders', function (Blueprint $t) {
            $t->dropConstrainedForeignId('reviewed_by');
            $t->dropIndex(['account_status']);
            $t->dropColumn(['account_status', 'rejection_reason', 'suspension_reason', 'reviewed_at', 'license_document', 'registration_document', 'official_receipt']);
        });
    }
};
