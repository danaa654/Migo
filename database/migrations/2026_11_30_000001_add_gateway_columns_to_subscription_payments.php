<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Payments are now confirmed by the payment gateway (PayMongo webhook), not by an uploaded screenshot. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_payments', function (Blueprint $t) {
            $t->string('provider', 20)->nullable()->after('payment_method');
            $t->string('provider_session_id', 100)->nullable()->unique()->after('provider');
            $t->string('provider_payment_id', 100)->nullable()->after('provider_session_id');
            $t->text('checkout_url')->nullable()->after('provider_payment_id');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_payments', function (Blueprint $t) {
            $t->dropUnique(['provider_session_id']);
            $t->dropColumn(['provider', 'provider_session_id', 'provider_payment_id', 'checkout_url']);
        });
    }
};
