<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Emailed one-time codes for customer sign-in. Same shape as login_otps (phone), keyed by email instead. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_login_otps', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();           // lower-cased
            $table->string('code_hash', 64);            // HMAC-SHA256, never the plain code
            $table->timestamp('expires_at');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('consumed_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['email', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_login_otps');
    }
};
