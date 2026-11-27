<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Subscription Management. The free trial is NOT a plan and NOT a payment: it is a rider_subscriptions row of
 * type "trial". Paid purchases keep a snapshot of the plan (name / duration / price) so editing a plan later never
 * changes history. Trial daily usage is derived from the existing bookings table (no second counter).
 * Includes the plan card colour and the payment-gateway (PayMongo) columns.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $t) {
            $t->id();
            $t->string('name', 80);
            $t->text('description')->nullable();
            $t->string('color', 7)->nullable(); // card colour chosen by the admin (#RRGGBB). Null = the app picks one by plan name.
            $t->unsignedSmallInteger('duration_value');
            $t->string('duration_unit', 10)->default('month'); // day | month | year
            $t->decimal('price', 10, 2);
            $t->boolean('is_active')->default(true);
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('rider_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('rider_id')->constrained('riders')->cascadeOnDelete();
            $t->foreignId('subscription_plan_id')->nullable()->constrained('subscription_plans')->nullOnDelete();
            $t->string('plan_name_snapshot', 80);
            $t->string('duration_snapshot', 40);
            $t->decimal('price_snapshot', 10, 2)->default(0);
            $t->string('subscription_type', 10); // trial | paid
            $t->string('status', 15); // active | scheduled | expired | cancelled
            $t->timestamp('starts_at');
            $t->timestamp('expires_at');
            $t->unsignedBigInteger('subscription_payment_id')->nullable()->index();
            // One free trial per verified rider identity (hash of the licence number). NULL for paid rows.
            $t->string('trial_identity', 64)->nullable()->unique();
            $t->timestamps();
            $t->index(['rider_id', 'status', 'expires_at']);
            $t->index(['status', 'expires_at']);
        });

        Schema::create('subscription_payments', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('rider_id')->constrained('riders')->cascadeOnDelete();
            $t->foreignId('rider_subscription_id')->nullable()->constrained('rider_subscriptions')->nullOnDelete();
            $t->foreignId('subscription_plan_id')->nullable()->constrained('subscription_plans')->nullOnDelete();
            $t->string('plan_name_snapshot', 80);
            $t->string('duration_snapshot', 40);
            $t->unsignedSmallInteger('duration_value');
            $t->string('duration_unit', 10);
            $t->decimal('amount', 10, 2);
            $t->string('payment_method', 30);
            // Payment gateway (PayMongo webhook confirms the payment).
            $t->string('provider', 20)->nullable();
            $t->string('provider_session_id', 100)->nullable()->unique();
            $t->string('provider_payment_id', 100)->nullable();
            $t->text('checkout_url')->nullable();
            $t->string('transaction_reference', 100)->nullable();
            $t->string('payment_proof')->nullable(); // private disk path, only served to authorised admins
            $t->string('status', 15)->default('pending'); // pending | verified | rejected | refunded
            $t->foreignUuid('verified_by')->nullable()->constrained('admin_profiles')->nullOnDelete();
            $t->timestamp('verified_at')->nullable();
            $t->string('rejection_reason', 300)->nullable();
            $t->timestamps();
            $t->index(['status', 'created_at']);
            $t->index(['rider_id', 'status']);
            $t->index('transaction_reference');
        });

        // One row per reminder actually sent, so the scheduler can never send the same reminder twice.
        Schema::create('subscription_notice_log', function (Blueprint $t) {
            $t->id();
            $t->foreignId('rider_subscription_id')->constrained('rider_subscriptions')->cascadeOnDelete();
            $t->string('notice', 40);
            $t->timestamp('created_at')->useCurrent();
            $t->unique(['rider_subscription_id', 'notice']);
        });

        $now = now();
        foreach ([
            ['Basic', '3 months of unlimited booking access.', '#F5C542', 3, 'month', 599, 1],
            ['Standard', '6 months of unlimited booking access.', '#2C4F73', 6, 'month', 1099, 2],
            ['Premium', '1 year of unlimited booking access.', '#171717', 12, 'month', 1999, 3],
        ] as [$name, $desc, $color, $value, $unit, $price, $sort]) {
            DB::table('subscription_plans')->insert([
                'name' => $name, 'description' => $desc, 'color' => $color, 'duration_value' => $value,
                'duration_unit' => $unit, 'price' => $price, 'is_active' => true, 'sort_order' => $sort,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_notice_log');
        Schema::dropIfExists('subscription_payments');
        Schema::dropIfExists('rider_subscriptions');
        Schema::dropIfExists('subscription_plans');
    }
};
