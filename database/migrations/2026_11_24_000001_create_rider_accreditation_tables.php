<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-stage records for rider accreditation. Staff are existing admin_profiles rows (the MIGO RBAC), riders are
 * existing riders rows. A new verification / schedule / inspection never overwrites an old
 * one (orientation rows are only updated with attendance/result, and every change is logged in
 * rider_accreditation_history), so previous decisions are preserved. Integer ids give a reliable "latest record" order.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('rider_document_verifications')) {
            Schema::create('rider_document_verifications', function (Blueprint $t) {
                $t->id();
                $t->foreignUuid('rider_id')->constrained('riders')->restrictOnDelete();
                $t->string('status', 20);                       // pending | verified | failed
                $t->json('documents_checked')->nullable();      // {license, registration, receipt} => original seen (bool)
                $t->timestamp('verified_at');                   // date of the face-to-face check
                $t->foreignUuid('verified_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->string('office_location')->nullable();
                $t->text('remarks')->nullable();                // incomplete / invalid documents
                $t->timestamps();
                $t->index(['rider_id', 'id']);
            });
        }

        if (! Schema::hasTable('rider_orientations')) {
            Schema::create('rider_orientations', function (Blueprint $t) {
                $t->id();
                $t->foreignUuid('rider_id')->constrained('riders')->restrictOnDelete();
                $t->string('status', 20);                       // scheduled | completed | failed | cancelled (superseded by a reschedule)
                $t->timestamp('scheduled_at');
                $t->string('location');
                $t->foreignUuid('facilitator_id')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->foreignUuid('scheduled_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->boolean('attended')->nullable();            // null until attendance is recorded
                $t->timestamp('attendance_recorded_at')->nullable();
                $t->timestamp('completed_at')->nullable();
                $t->foreignUuid('completed_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->text('remarks')->nullable();
                $t->timestamps();
                $t->index(['rider_id', 'id']);
            });
        }

        if (! Schema::hasTable('motorcycle_inspections')) {
            Schema::create('motorcycle_inspections', function (Blueprint $t) {
                $t->id();
                $t->foreignUuid('rider_id')->constrained('riders')->restrictOnDelete();
                $t->foreignId('reinspection_of_id')->nullable()->constrained('motorcycle_inspections')->nullOnDelete();
                $t->string('status', 20);                       // pending | passed | failed
                $t->string('make', 60);
                $t->string('model', 60);
                $t->string('plate_number', 30);
                $t->string('registration_number', 60);
                $t->date('registration_expiry');
                $t->string('condition', 20);                    // excellent | good | fair | poor
                $t->json('safety_equipment');                   // item => present (bool)
                $t->boolean('roadworthy');
                $t->timestamp('inspected_at');
                $t->foreignUuid('inspector_id')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->text('findings')->nullable();
                $t->text('remarks')->nullable();
                $t->timestamps();
                $t->index(['rider_id', 'id']);
                $t->index('plate_number');
            });
        }

        if (! Schema::hasTable('rider_accreditation_history')) {
            Schema::create('rider_accreditation_history', function (Blueprint $t) {
                $t->id();
                $t->foreignUuid('rider_id')->constrained('riders')->restrictOnDelete();
                $t->string('stage', 30);                        // application | documents | orientation | inspection | accreditation | account | remarks
                $t->string('action', 50);
                $t->string('from_status', 30)->nullable();
                $t->string('to_status', 30)->nullable();
                $t->foreignUuid('actor_id')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->text('remarks')->nullable();
                $t->timestamp('created_at')->useCurrent();
                $t->index(['rider_id', 'id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('rider_accreditation_history');
        Schema::dropIfExists('motorcycle_inspections');
        Schema::dropIfExists('rider_orientations');
        Schema::dropIfExists('rider_document_verifications');
    }
};
