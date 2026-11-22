<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rider accreditation. No new rider/user table: the existing `riders` row gets one status column PER process
 * (application_status and account_status already exist and are left untouched).
 *
 * Every column has a default or is nullable, so existing riders keep all their data. Existing riders start at
 * pending / not_accredited: face-to-face accreditation is required before anyone can accept bookings.
 *
 *  document_verification_status  pending | verified | failed
 *  orientation_status            pending | scheduled | completed | failed
 *  inspection_status             pending | passed | failed
 *  accreditation_status          not_accredited | for_final_approval | accredited | revoked
 *  account_status (existing)     active | inactive | suspended   (string column, no schema change needed)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('riders', function (Blueprint $t) {
            if (! Schema::hasColumn('riders', 'accreditation_status')) {
                $t->string('document_verification_status', 20)->default('pending');
                $t->string('orientation_status', 20)->default('pending');
                $t->string('inspection_status', 20)->default('pending');
                $t->string('accreditation_status', 30)->default('not_accredited');

                $t->timestamp('accredited_at')->nullable();
                $t->foreignUuid('accredited_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->text('accreditation_remarks')->nullable();

                $t->timestamp('revoked_at')->nullable();
                $t->foreignUuid('revoked_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->text('revocation_reason')->nullable();

                $t->text('admin_remarks')->nullable();

                $t->index('document_verification_status');
                $t->index('orientation_status');
                $t->index('inspection_status');
                $t->index('accreditation_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('riders', function (Blueprint $t) {
            if (Schema::hasColumn('riders', 'accreditation_status')) {
                $t->dropConstrainedForeignId('accredited_by');
                $t->dropConstrainedForeignId('revoked_by');
                $t->dropIndex(['document_verification_status']);
                $t->dropIndex(['orientation_status']);
                $t->dropIndex(['inspection_status']);
                $t->dropIndex(['accreditation_status']);
                $t->dropColumn([
                    'document_verification_status', 'orientation_status', 'inspection_status', 'accreditation_status',
                    'accredited_at', 'accreditation_remarks', 'revoked_at', 'revocation_reason', 'admin_remarks',
                ]);
            }
        });
    }
};
