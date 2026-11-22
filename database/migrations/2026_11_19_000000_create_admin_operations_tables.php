<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tables the admin dashboard reads from. admin_profiles already exists (earlier migration)
 * and is intentionally not recreated. Each table is only created if it is missing.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('riders')) {
            Schema::create('riders', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->string('full_name');
                $t->string('email')->unique();
                $t->string('phone', 30);
                $t->string('address')->nullable();
                $t->string('profile_picture')->nullable();
                $t->string('license_number')->unique();
                $t->date('license_expiry');
                $t->string('motorcycle_plate_number')->unique();
                $t->enum('application_status', ['pending', 'approved', 'rejected'])->default('pending');
                $t->timestamps();
                $t->index('application_status');
                $t->index('created_at');
            });
        }

        if (! Schema::hasTable('passengers')) {
            Schema::create('passengers', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->string('full_name');
                $t->string('email')->unique();
                $t->string('phone', 30);
                $t->enum('account_status', ['active', 'suspended', 'deactivated'])->default('active');
                $t->timestamps();
                $t->index('account_status');
            });
        }

        if (! Schema::hasTable('bookings')) {
            Schema::create('bookings', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->foreignUuid('passenger_id')->nullable()->constrained('passengers')->nullOnDelete();
                $t->foreignUuid('rider_id')->nullable()->constrained('riders')->nullOnDelete();
                $t->string('pickup_location');
                $t->string('destination');
                $t->enum('booking_status', ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'])->default('pending');
                $t->timestamp('booking_date')->nullable();
                $t->timestamp('created_at')->useCurrent();
                $t->index('booking_status');
                $t->index('booking_date');
                $t->index('created_at');
            });
        }

        if (! Schema::hasTable('complaints')) {
            Schema::create('complaints', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->uuid('reporter_id');
                $t->enum('reporter_type', ['rider', 'passenger']);
                $t->string('complaint_category');
                $t->text('description');
                $t->enum('complaint_status', ['pending', 'under_investigation', 'resolved', 'rejected'])->default('pending');
                $t->timestamps();
                $t->index(['reporter_type', 'reporter_id']);
                $t->index('complaint_status');
                $t->index('created_at');
            });
        }

        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->string('title');
                $t->text('message');
                $t->string('notification_type', 50);
                $t->boolean('is_read')->default(false);
                $t->timestamp('created_at')->useCurrent();
                $t->index('is_read');
                $t->index('created_at');
            });
        }

        if (! Schema::hasTable('audit_logs')) {
            Schema::create('audit_logs', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->foreignUuid('admin_id')->nullable()->constrained('admin_profiles')->nullOnDelete();
                $t->string('action');
                $t->text('description')->nullable();
                $t->timestamp('created_at')->useCurrent();
                $t->index('created_at');
            });
        }
    }

    public function down(): void
    {
        foreach (['audit_logs', 'notifications', 'complaints', 'bookings', 'passengers', 'riders'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
