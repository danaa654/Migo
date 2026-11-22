<?php

namespace Tests\Feature\Admin;

use App\Models\Rider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Admin > Rider Management: listing, search/filter/sort/pagination, profile, documents, verification, suspension, access, notifications. */
class RiderManagementTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    private function notificationsFor(Rider $rider, string $type)
    {
        return DB::table('notifications')->where('user_id', $rider->user_id)->where('notification_type', $type);
    }

    // ------------------------------------------------------------ 1. list + live statistics

    public function test_index_shows_every_rider_and_live_counts_from_the_database(): void
    {
        Rider::factory()->count(2)->create();                       // pending, active
        Rider::factory()->approved()->create();                     // approved, active
        Rider::factory()->approved()->suspended()->create();        // approved, suspended (separate statuses)
        Rider::factory()->rejected()->create();                     // rejected, active

        $this->actingAs($this->admin())->get('/admin/riders')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/riders/index')
                ->where('stats', ['total' => 5, 'pending' => 2, 'approved' => 2, 'rejected' => 1, 'suspended' => 1])
                ->has('riders.data', 5)
                ->has('riders.data.0', fn (Assert $r) => $r->hasAll(['id', 'full_name', 'email', 'phone', 'application_status', 'account_status', 'created_at'])->etc()));
    }

    public function test_index_with_no_riders_returns_zero_counts_and_an_empty_list(): void
    {
        $this->actingAs($this->admin())->get('/admin/riders')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('stats.total', 0)->where('stats.suspended', 0)->has('riders.data', 0));
    }

    public function test_placeholder_is_gone_and_other_modules_still_render(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->get('/admin/riders')->assertInertia(fn (Assert $p) => $p->component('admin/riders/index'));

        foreach (['passengers', 'bookings', 'complaints', 'reports', 'notifications', 'settings'] as $module) {
            $this->actingAs($admin)->get("/admin/{$module}")->assertOk()->assertInertia(fn (Assert $p) => $p->component('admin/placeholder'));
        }
        $this->actingAs($admin)->get('/admin/dashboard')->assertOk()->assertInertia(fn (Assert $p) => $p->component('admin/dashboard'));
    }

    // ------------------------------------------------------------ 2. search, filter, sort, pagination

    public function test_search_by_name_email_and_rider_id(): void
    {
        $juan = Rider::factory()->create(['full_name' => 'Juan Dela Cruz', 'email' => 'juan@example.com']);
        Rider::factory()->create(['full_name' => 'Maria Santos', 'email' => 'maria@example.org']);
        $admin = $this->admin();

        $this->actingAs($admin)->get('/admin/riders?search=dela+cruz')->assertInertia(fn (Assert $p) => $p->has('riders.data', 1)->where('riders.data.0.id', $juan->id));
        $this->actingAs($admin)->get('/admin/riders?search=example.org')->assertInertia(fn (Assert $p) => $p->has('riders.data', 1)->where('riders.data.0.full_name', 'Maria Santos'));
        $this->actingAs($admin)->get('/admin/riders?search='.substr($juan->id, 0, 8))->assertInertia(fn (Assert $p) => $p->has('riders.data', 1)->where('riders.data.0.id', $juan->id));
        $this->actingAs($admin)->get('/admin/riders?search=nobody-matches')->assertInertia(fn (Assert $p) => $p->has('riders.data', 0));
    }

    public function test_search_treats_like_wildcards_literally(): void
    {
        Rider::factory()->create(['full_name' => 'Juan Dela Cruz', 'email' => 'juan@example.com']);

        $this->actingAs($this->admin())->get('/admin/riders?search=%25')->assertInertia(fn (Assert $p) => $p->has('riders.data', 0));
        $this->actingAs($this->admin())->get('/admin/riders?search=_')->assertInertia(fn (Assert $p) => $p->has('riders.data', 0));
    }

    public function test_filter_by_verification_and_account_status(): void
    {
        Rider::factory()->create();
        Rider::factory()->approved()->create();
        Rider::factory()->approved()->suspended()->create();
        Rider::factory()->rejected()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->get('/admin/riders?verification=approved')->assertInertia(fn (Assert $p) => $p->has('riders.data', 2));
        $this->actingAs($admin)->get('/admin/riders?verification=pending')->assertInertia(fn (Assert $p) => $p->has('riders.data', 1));
        $this->actingAs($admin)->get('/admin/riders?account=suspended')->assertInertia(fn (Assert $p) => $p->has('riders.data', 1)->where('riders.data.0.application_status', 'approved'));
        $this->actingAs($admin)->get('/admin/riders?verification=approved&account=active')->assertInertia(fn (Assert $p) => $p->has('riders.data', 1));
        // Unknown filter values are ignored, never trusted.
        $this->actingAs($admin)->get('/admin/riders?verification=hacked')->assertInertia(fn (Assert $p) => $p->has('riders.data', 4));
    }

    public function test_sorting_and_invalid_sort_columns(): void
    {
        Rider::factory()->create(['full_name' => 'Bea']);
        Rider::factory()->create(['full_name' => 'Ana']);
        Rider::factory()->create(['full_name' => 'Cris']);
        $admin = $this->admin();

        $this->actingAs($admin)->get('/admin/riders?sort=full_name&direction=asc')->assertInertia(fn (Assert $p) => $p->where('riders.data.0.full_name', 'Ana')->where('riders.data.2.full_name', 'Cris'));
        $this->actingAs($admin)->get('/admin/riders?sort=full_name&direction=desc')->assertInertia(fn (Assert $p) => $p->where('riders.data.0.full_name', 'Cris'));
        $this->actingAs($admin)->get('/admin/riders?sort=password;drop&direction=asc')->assertOk()->assertInertia(fn (Assert $p) => $p->where('filters.sort', 'created_at'));
    }

    public function test_pagination_ten_per_page(): void
    {
        Rider::factory()->count(12)->create();
        $admin = $this->admin();

        $this->actingAs($admin)->get('/admin/riders')->assertInertia(fn (Assert $p) => $p->has('riders.data', 10)->where('riders.total', 12)->where('riders.last_page', 2));
        $this->actingAs($admin)->get('/admin/riders?page=2')->assertInertia(fn (Assert $p) => $p->has('riders.data', 2)->where('riders.current_page', 2));
    }

    // ------------------------------------------------------------ 3 + 4. profile and documents

    public function test_rider_profile_shows_stored_information_only(): void
    {
        $rider = Rider::factory()->create(['full_name' => 'Juan Dela Cruz', 'license_number' => 'N01-23-456789', 'motorcycle_plate_number' => 'ABC 1234', 'address' => null]);

        $this->actingAs($this->admin())->get("/admin/riders/{$rider->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('admin/riders/show')
                ->where('rider.full_name', 'Juan Dela Cruz')
                ->where('rider.license_number', 'N01-23-456789')
                ->where('rider.motorcycle_plate_number', 'ABC 1234')
                ->where('rider.address', null)               // nothing is invented for missing data
                ->where('rider.profile_picture_url', null)
                ->has('documents', 3)
                ->where('documents.0.available', false)
                ->has('history', 0));
    }

    public function test_unknown_rider_is_not_found(): void
    {
        $this->actingAs($this->admin())->get('/admin/riders/'.fake()->uuid())->assertNotFound();
    }

    public function test_uploaded_documents_are_listed_and_streamed_to_administrators(): void
    {
        Storage::fake('local');
        $path = UploadedFile::fake()->image('license.jpg')->store('rider-documents', 'local');
        $rider = Rider::factory()->create(['license_document' => $path]);
        $admin = $this->admin();

        $this->actingAs($admin)->get("/admin/riders/{$rider->id}")->assertInertia(fn (Assert $p) => $p
            ->where('documents.0.available', true)
            ->where('documents.0.url', "/admin/riders/{$rider->id}/documents/license")
            ->where('documents.0.is_image', true)
            ->where('documents.1.available', false));

        $this->actingAs($admin)->get("/admin/riders/{$rider->id}/documents/license")
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->actingAs($admin)->get("/admin/riders/{$rider->id}/documents/receipt")->assertNotFound();   // not uploaded
        $this->actingAs($admin)->get("/admin/riders/{$rider->id}/documents/passport")->assertNotFound();  // unknown type
    }

    public function test_documents_are_not_available_to_riders_customers_or_guests(): void
    {
        Storage::fake('local');
        $path = UploadedFile::fake()->image('license.jpg')->store('rider-documents', 'local');
        $rider = Rider::factory()->withUser()->create(['license_document' => $path]);
        $url = "/admin/riders/{$rider->id}/documents/license";

        $this->get($url)->assertRedirect('/admin/login');
        $this->actingAs($rider->user)->get($url)->assertRedirect('/biker/dashboard');
        $this->actingAs(User::factory()->create())->get($url)->assertRedirect('/customer/dashboard');
        $this->actingAs($rider->user)->getJson($url)->assertForbidden();
    }

    public function test_registration_stores_optional_documents_on_the_private_disk(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $this->post('/register/biker', [
            'full_name' => 'Juan Dela Cruz', 'email' => 'juan@example.com', 'phone' => '09171234567',
            'password' => 'Secret123!', 'password_confirmation' => 'Secret123!', 'terms' => true,
            'address' => '123 Rizal St', 'license_number' => 'N01-23-456789', 'license_expiry' => now()->addYear()->toDateString(),
            'motorcycle_plate_number' => 'ABC 1234', 'vehicle_type' => 'two_wheel',
            'license_document' => UploadedFile::fake()->image('license.jpg'),
            'official_receipt' => UploadedFile::fake()->create('or.pdf', 100, 'application/pdf'),
        ])->assertRedirect('/login');

        $rider = Rider::where('email', 'juan@example.com')->firstOrFail();
        Storage::disk('local')->assertExists($rider->license_document);
        Storage::disk('local')->assertExists($rider->official_receipt);
        $this->assertNull($rider->registration_document);
        $this->assertSame('pending', $rider->application_status);
        $this->assertSame('active', $rider->account_status);
    }

    public function test_registration_rejects_unsafe_document_types(): void
    {
        Storage::fake('local');

        $this->post('/register/biker', [
            'full_name' => 'Juan Dela Cruz', 'email' => 'juan@example.com', 'phone' => '09171234567',
            'password' => 'Secret123!', 'password_confirmation' => 'Secret123!', 'terms' => true,
            'address' => '123 Rizal St', 'license_number' => 'N01-23-456789', 'license_expiry' => now()->addYear()->toDateString(),
            'motorcycle_plate_number' => 'ABC 1234', 'vehicle_type' => 'two_wheel',
            'license_document' => UploadedFile::fake()->create('shell.php', 10, 'application/x-php'),
        ])->assertSessionHasErrors('license_document');

        $this->assertSame(0, Rider::count());
    }

    // ------------------------------------------------------------ 5 + 6. approve / reject

    public function test_admin_approves_a_pending_rider_and_the_rider_is_notified(): void
    {
        $admin = $this->admin();
        $rider = Rider::factory()->withUser()->create();

        $this->actingAs($admin)->from('/admin/riders')->post("/admin/riders/{$rider->id}/approve")->assertRedirect('/admin/riders');

        $rider->refresh();
        $this->assertSame('approved', $rider->application_status);
        $this->assertSame('active', $rider->account_status);
        $this->assertNull($rider->rejection_reason);
        $this->assertNotNull($rider->reviewed_at);
        $this->assertSame($admin->adminProfile->id, $rider->reviewed_by);
        $this->assertTrue($this->notificationsFor($rider, 'rider_approved')->exists());
        $this->assertDatabaseHas('audit_logs', ['action' => 'rider.approved', 'subject_type' => 'rider', 'subject_id' => $rider->id, 'admin_id' => $admin->adminProfile->id]);
    }

    public function test_approving_an_already_approved_rider_changes_nothing_and_sends_no_second_notification(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();

        $this->actingAs($this->admin())->post("/admin/riders/{$rider->id}/approve")->assertRedirect();

        $this->assertSame(0, $this->notificationsFor($rider, 'rider_approved')->count());
        $this->assertDatabaseMissing('audit_logs', ['subject_id' => $rider->id]);
    }

    public function test_rejection_requires_a_reason(): void
    {
        $rider = Rider::factory()->withUser()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/reject", [])->assertSessionHasErrors('reason');
        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/reject", ['reason' => 'no'])->assertSessionHasErrors('reason');

        $this->assertSame('pending', $rider->fresh()->application_status);
        $this->assertSame(0, $this->notificationsFor($rider, 'rider_rejected')->count());
    }

    public function test_admin_rejects_a_pending_rider_with_a_reason(): void
    {
        $rider = Rider::factory()->withUser()->create();

        $this->actingAs($this->admin())->post("/admin/riders/{$rider->id}/reject", ['reason' => 'The license photo is unreadable.'])->assertRedirect();

        $rider->refresh();
        $this->assertSame('rejected', $rider->application_status);
        $this->assertSame('The license photo is unreadable.', $rider->rejection_reason);
        $notice = $this->notificationsFor($rider, 'rider_rejected')->first();
        $this->assertNotNull($notice);
        $this->assertStringContainsString('The license photo is unreadable.', $notice->message);
        $this->assertDatabaseHas('audit_logs', ['action' => 'rider.rejected', 'subject_id' => $rider->id, 'description' => 'The license photo is unreadable.']);
    }

    public function test_only_pending_applications_can_be_rejected(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();

        $this->actingAs($this->admin())->post("/admin/riders/{$rider->id}/reject", ['reason' => 'Changed my mind.'])->assertRedirect();

        $this->assertSame('approved', $rider->fresh()->application_status);
    }

    public function test_a_rejected_application_can_be_reconsidered_and_the_reason_is_cleared(): void
    {
        $rider = Rider::factory()->withUser()->rejected('Blurry photo.')->create();

        $this->actingAs($this->admin())->post("/admin/riders/{$rider->id}/approve")->assertRedirect();

        $rider->refresh();
        $this->assertSame('approved', $rider->application_status);
        $this->assertNull($rider->rejection_reason);
    }

    // ------------------------------------------------------------ 7 + 8. suspend / reactivate

    public function test_admin_suspends_an_approved_rider_without_changing_verification(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();

        $this->actingAs($this->admin())->post("/admin/riders/{$rider->id}/suspend", ['reason' => 'Multiple passenger complaints.'])->assertRedirect();

        $rider->refresh();
        $this->assertSame('approved', $rider->application_status);   // verification untouched
        $this->assertSame('suspended', $rider->account_status);
        $this->assertSame('Multiple passenger complaints.', $rider->suspension_reason);
        $this->assertTrue($this->notificationsFor($rider, 'rider_suspended')->exists());
    }

    public function test_suspension_requires_a_reason_and_cannot_repeat(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/suspend", [])->assertSessionHasErrors('reason');
        $this->assertSame('active', $rider->fresh()->account_status);

        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/suspend", ['reason' => 'First suspension.']);
        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/suspend", ['reason' => 'Second suspension.']);
        $this->assertSame(1, $this->notificationsFor($rider, 'rider_suspended')->count());
    }

    public function test_admin_reactivates_a_suspended_rider(): void
    {
        $rider = Rider::factory()->withUser()->approved()->suspended()->create();

        $this->actingAs($this->admin())->post("/admin/riders/{$rider->id}/reactivate")->assertRedirect();

        $rider->refresh();
        $this->assertSame('active', $rider->account_status);
        $this->assertNull($rider->suspension_reason);
        $this->assertSame('approved', $rider->application_status);
        $this->assertTrue($this->notificationsFor($rider, 'rider_reactivated')->exists());
    }

    public function test_only_suspended_riders_can_be_reactivated(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();

        $this->actingAs($this->admin())->post("/admin/riders/{$rider->id}/reactivate")->assertRedirect();

        $this->assertSame(0, $this->notificationsFor($rider, 'rider_reactivated')->count());
    }

    public function test_decisions_appear_in_the_rider_history(): void
    {
        $rider = Rider::factory()->withUser()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/approve");
        $this->travel(1)->minutes(); // history is ordered by time, newest first
        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/suspend", ['reason' => 'Safety concern.']);

        $this->actingAs($admin)->get("/admin/riders/{$rider->id}")->assertInertia(fn (Assert $p) => $p
            ->has('history', 2)
            ->where('history.0.action', 'rider.suspended')
            ->where('history.0.reason', 'Safety concern.')
            ->where('history.0.admin_name', $admin->name)
            ->where('history.1.action', 'rider.approved'));
    }

    // ------------------------------------------------------------ 9 + 10. DB state and rider access restrictions

    public function test_approved_active_rider_can_open_service_requests(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();

        $this->actingAs($rider->user)->get('/biker/service-requests')->assertOk();
    }

    public function test_pending_rejected_and_suspended_riders_cannot_open_service_requests(): void
    {
        $pending = Rider::factory()->withUser()->create();
        $rejected = Rider::factory()->withUser()->rejected()->create();
        $suspended = Rider::factory()->withUser()->approved()->suspended()->create();

        foreach ([$pending, $rejected, $suspended] as $rider) {
            $this->actingAs($rider->user)->get('/biker/service-requests')->assertRedirect('/biker/dashboard');
            $this->actingAs($rider->user)->getJson('/biker/service-requests')->assertForbidden();
        }
    }

    public function test_suspension_takes_effect_immediately_and_reactivation_restores_access(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();
        $admin = $this->admin();

        $this->actingAs($rider->user)->get('/biker/service-requests')->assertOk();

        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/suspend", ['reason' => 'Under review.']);
        $this->actingAs($rider->user)->get('/biker/service-requests')->assertRedirect('/biker/dashboard');

        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/reactivate");
        $this->actingAs($rider->user)->get('/biker/service-requests')->assertOk();
    }

    public function test_rider_dashboard_shows_the_rejection_reason_suspension_reason_and_notifications(): void
    {
        $rejected = Rider::factory()->withUser()->create();
        $admin = $this->admin();
        $this->actingAs($admin)->post("/admin/riders/{$rejected->id}/reject", ['reason' => 'License has expired.']);

        $this->actingAs($rejected->user)->get('/biker/dashboard')->assertInertia(fn (Assert $p) => $p
            ->where('applicationStatus', 'rejected')
            ->where('rejectionReason', 'License has expired.')
            ->where('notifications.unread', 1)
            ->where('notifications.latest.0.title', 'Registration rejected'));

        $suspended = Rider::factory()->withUser()->approved()->create();
        $this->actingAs($admin)->post("/admin/riders/{$suspended->id}/suspend", ['reason' => 'Policy breach.']);

        $this->actingAs($suspended->user)->get('/biker/dashboard')->assertInertia(fn (Assert $p) => $p
            ->where('applicationStatus', 'approved')
            ->where('accountStatus', 'suspended')
            ->where('suspensionReason', 'Policy breach.'));
    }

    public function test_riders_can_only_mark_their_own_notifications_as_read(): void
    {
        $admin = $this->admin();
        $a = Rider::factory()->withUser()->create();
        $b = Rider::factory()->withUser()->create();
        $this->actingAs($admin)->post("/admin/riders/{$a->id}/approve");
        $this->actingAs($admin)->post("/admin/riders/{$b->id}/approve");

        $this->actingAs($a->user)->post('/biker/notifications/read')->assertRedirect();

        $this->assertSame(0, DB::table('notifications')->where('user_id', $a->user_id)->where('is_read', false)->count());
        $this->assertSame(1, DB::table('notifications')->where('user_id', $b->user_id)->where('is_read', false)->count());
    }

    // ------------------------------------------------------------ 11. notifications reuse the existing table, admin feed stays clean

    public function test_rider_notifications_do_not_leak_into_the_admin_notification_feed(): void
    {
        $admin = $this->admin();
        $rider = Rider::factory()->withUser()->create();
        DB::table('notifications')->insert(['id' => (string) fake()->uuid(), 'title' => 'Admin only', 'message' => 'x', 'notification_type' => 'system', 'is_read' => false]);

        $this->actingAs($admin)->post("/admin/riders/{$rider->id}/approve");

        $this->actingAs($admin)->get('/admin/riders')->assertInertia(fn (Assert $p) => $p
            ->where('adminNotifications.unread', 1)
            ->has('adminNotifications.latest', 1)
            ->where('adminNotifications.latest.0.title', 'Admin only'));
    }

    public function test_a_rider_without_a_linked_account_can_still_be_reviewed(): void
    {
        $rider = Rider::factory()->create(); // legacy row: user_id is null

        $this->actingAs($this->admin())->post("/admin/riders/{$rider->id}/approve")->assertRedirect();

        $this->assertSame('approved', $rider->fresh()->application_status);
        $this->assertSame(0, DB::table('notifications')->whereNotNull('user_id')->count());
    }

    // ------------------------------------------------------------ 12. authorization

    public function test_guests_are_sent_to_the_admin_login(): void
    {
        $rider = Rider::factory()->create();

        $this->get('/admin/riders')->assertRedirect('/admin/login');
        $this->get("/admin/riders/{$rider->id}")->assertRedirect('/admin/login');
        foreach (['approve', 'reject', 'suspend', 'reactivate'] as $action) {
            $this->post("/admin/riders/{$rider->id}/{$action}", ['reason' => 'Some reason'])->assertRedirect('/admin/login');
        }
        $this->assertSame('pending', $rider->fresh()->application_status);
    }

    public function test_customers_and_bikers_cannot_use_rider_management(): void
    {
        $rider = Rider::factory()->withUser()->create();
        $customer = User::factory()->create();

        $this->actingAs($customer)->get('/admin/riders')->assertRedirect('/customer/dashboard');
        $this->actingAs($rider->user)->get('/admin/riders')->assertRedirect('/biker/dashboard');
        $this->actingAs($rider->user)->get("/admin/riders/{$rider->id}")->assertRedirect('/biker/dashboard');

        // A biker must not be able to approve their own application.
        $this->actingAs($rider->user)->post("/admin/riders/{$rider->id}/approve")->assertRedirect('/biker/dashboard');
        $this->actingAs($customer)->post("/admin/riders/{$rider->id}/suspend", ['reason' => 'Some reason'])->assertRedirect('/customer/dashboard');
        $this->actingAs($rider->user)->postJson("/admin/riders/{$rider->id}/approve")->assertForbidden();

        $fresh = $rider->fresh();
        $this->assertSame('pending', $fresh->application_status);
        $this->assertSame('active', $fresh->account_status);
    }

    public function test_inactive_or_suspended_administrators_cannot_use_rider_management(): void
    {
        $rider = Rider::factory()->create();

        foreach (['inactive', 'suspended'] as $status) {
            $admin = User::factory()->admin($status)->create();
            $this->actingAs($admin)->post("/admin/riders/{$rider->id}/approve")->assertRedirect('/admin/login');
        }

        $this->assertSame('pending', $rider->fresh()->application_status);
    }
}
