<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Core operational tables: riders, passengers, bookings, complaints, notifications, audit_logs.
 *
 * Every later "add_*" column is built in here, so `php artisan migrate:fresh` creates the final schema directly:
 *  - riders:        user link, vehicle type, management/review columns, accreditation, NBI clearance, avatar
 *  - passengers:    user link, nullable email, suspension reason, avatar
 *  - bookings:      coordinates, dispatch timestamps/fares, service types (MIGOMOTO / MIGOCARS / MIGODALA), delivery vehicle
 *  - complaints:    booking / against / assignee / resolution, report type (complaint | support | incident)
 *  - notifications: recipient user_id, dispatch booking_id / event / data
 *  - audit_logs:    subject_type / subject_id
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('riders', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $t->string('full_name');
            $t->string('email')->unique();
            $t->string('phone', 30);
            $t->string('address')->nullable();
            $t->string('profile_picture')->nullable();   // live selfie from registration (accreditation record, never changed by the rider)
            $t->string('avatar_path')->nullable();       // photo the rider chooses to show; falls back to profile_picture
            $t->string('license_number')->unique();
            $t->date('license_expiry');
            $t->string('motorcycle_plate_number')->unique();
            $t->string('vehicle_type', 20)->default('two_wheel'); // two_wheel (Biker) | four_wheel (Angcars)

            $t->enum('application_status', ['pending', 'approved', 'rejected'])->default('pending');
            $t->string('account_status', 20)->default('active');  // active | inactive | suspended
            $t->text('rejection_reason')->nullable();
            $t->text('suspension_reason')->nullable();
            $t->timestamp('reviewed_at')->nullable();
            $t->foreignUuid('reviewed_by')->nullable()->constrained('admin_profiles')->nullOnDelete();

            // Paths on the private "local" disk; served to administrators only.
            $t->string('license_document')->nullable();
            $t->string('registration_document')->nullable();
            $t->string('official_receipt')->nullable();
            $t->string('nbi_clearance')->nullable();

            // Face-to-face accreditation: one status column per stage.
            $t->string('document_verification_status', 20)->default('pending');   // pending | verified | failed
            $t->string('orientation_status', 20)->default('pending');             // pending | scheduled | completed | failed
            $t->string('inspection_status', 20)->default('pending');              // pending | passed | failed
            $t->string('accreditation_status', 30)->default('not_accredited');    // not_accredited | for_final_approval | accredited | revoked

            $t->timestamp('accredited_at')->nullable();
            $t->foreignUuid('accredited_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
            $t->text('accreditation_remarks')->nullable();

            $t->timestamp('revoked_at')->nullable();
            $t->foreignUuid('revoked_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
            $t->text('revocation_reason')->nullable();

            $t->text('admin_remarks')->nullable();
            $t->timestamps();

            $t->index('application_status');
            $t->index('account_status');
            $t->index('vehicle_type');
            $t->index('document_verification_status');
            $t->index('orientation_status');
            $t->index('inspection_status');
            $t->index('accreditation_status');
            $t->index('created_at');
        });

        Schema::create('passengers', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $t->string('full_name');
            $t->string('email')->nullable()->unique();   // nullable: phone-only customers have no email
            $t->string('phone', 30);
            $t->enum('account_status', ['active', 'suspended', 'deactivated'])->default('active');
            $t->text('suspension_reason')->nullable();
            $t->string('avatar_path')->nullable();
            $t->timestamps();
            $t->index('account_status');
        });

        Schema::create('bookings', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('booking_reference', 20)->nullable()->unique();
            $t->string('service_type', 12)->default('MIGOMOTO')->index(); // MIGOMOTO | MIGOCARS | MIGODALA
            $t->foreignUuid('passenger_id')->nullable()->constrained('passengers')->nullOnDelete();
            $t->foreignUuid('rider_id')->nullable()->constrained('riders')->nullOnDelete();
            $t->unsignedTinyInteger('passenger_count')->nullable(); // rides only

            $t->string('pickup_location');
            $t->string('destination');
            $t->decimal('pickup_lat', 10, 7)->nullable();
            $t->decimal('pickup_lng', 10, 7)->nullable();
            $t->decimal('destination_lat', 10, 7)->nullable();
            $t->decimal('destination_lng', 10, 7)->nullable();

            // Pickup / delivery details (MigoDala fields are only used by deliveries).
            $t->string('notes', 300)->nullable();
            $t->string('recipient_name', 120)->nullable();
            $t->string('recipient_phone', 30)->nullable();
            $t->string('item_description', 255)->nullable();
            $t->string('package_size', 20)->nullable();
            $t->string('delivery_vehicle', 20)->nullable(); // two_wheel | four_wheel; null = the service's default vehicle

            $t->decimal('estimated_distance', 8, 2)->nullable();      // km
            $t->unsignedInteger('estimated_duration')->nullable();    // minutes
            $t->decimal('estimated_fare', 10, 2)->nullable();
            $t->decimal('final_fare', 10, 2)->nullable();

            // Status values: see App\Enums\BookingStatus (string, not an enum column).
            $t->string('booking_status', 30)->default('pending');
            $t->timestamp('booking_date')->nullable();
            $t->timestamp('requested_at')->nullable();
            $t->timestamp('search_started_at')->nullable();
            $t->decimal('current_search_radius_km', 5, 2)->nullable();
            $t->timestamp('last_expansion_at')->nullable();
            $t->timestamp('assigned_at')->nullable();
            $t->timestamp('arrived_at')->nullable();
            $t->timestamp('started_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->timestamp('cancelled_at')->nullable();

            $t->timestamp('created_at')->useCurrent();
            $t->timestamp('updated_at')->nullable();

            $t->index('booking_status');
            $t->index('booking_date');
            $t->index('created_at');
            $t->index(['booking_status', 'requested_at'], 'bookings_status_requested_idx');
            $t->index(['rider_id', 'booking_status'], 'bookings_rider_status_idx');
        });

        Schema::create('complaints', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('report_type', 20)->default('complaint')->index(); // complaint | support | incident
            $t->uuid('reporter_id');
            $t->enum('reporter_type', ['rider', 'passenger']);
            $t->foreignUuid('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $t->string('against_type', 20)->nullable();                   // rider | passenger
            $t->uuid('against_id')->nullable();
            $t->string('complaint_category');
            $t->text('description');
            $t->timestamp('occurred_at')->nullable();                     // incident reports only
            $t->string('incident_location')->nullable();                  // incident reports only
            $t->enum('complaint_status', ['pending', 'under_investigation', 'resolved', 'rejected'])->default('pending');
            $t->foreignUuid('assigned_to')->nullable()->constrained('admin_profiles')->nullOnDelete();
            $t->text('resolution_note')->nullable();
            $t->timestamp('resolved_at')->nullable();
            $t->timestamps();

            $t->index(['reporter_type', 'reporter_id']);
            $t->index('complaint_status');
            $t->index('created_at');
        });

        Schema::create('notifications', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete(); // recipient; NULL = administrator feed
            $t->foreignUuid('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $t->string('title');
            $t->text('message');
            $t->string('notification_type', 50);
            $t->string('event', 40)->nullable();
            $t->json('data')->nullable();
            $t->boolean('is_read')->default(false);
            $t->timestamp('created_at')->useCurrent();

            $t->index('is_read');
            $t->index('created_at');
            $t->index(['user_id', 'created_at']);
            $t->index(['booking_id', 'event']);
        });

        Schema::create('audit_logs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('admin_id')->nullable()->constrained('admin_profiles')->nullOnDelete();
            $t->string('action');
            $t->text('description')->nullable();
            $t->string('subject_type', 30)->nullable();
            $t->uuid('subject_id')->nullable();
            $t->timestamp('created_at')->useCurrent();

            $t->index('created_at');
            $t->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        foreach (['audit_logs', 'notifications', 'complaints', 'bookings', 'passengers', 'riders'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
