<?php

namespace Tests\Feature;

use App\Actions\Riders\RiderAccreditation;
use App\Models\MotorcycleInspection;
use App\Models\Rider;
use App\Models\RiderAccreditationHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * End-to-end tests of the MIGO rider accreditation workflow (Part 1 backend + Part 2 admin / rider integration).
 * Everything goes through the real HTTP routes, so middleware, FormRequests and the RiderAccreditation service are exercised.
 */
class RiderAccreditationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin('active', 'super_admin')->create();
    }

    private function url(Rider $rider, string $path = ''): string
    {
        return "/admin/riders/{$rider->id}".$path;
    }

    private function inspectionPayload(Rider $rider, array $override = []): array
    {
        return array_merge([
            'status' => 'passed',
            'make' => 'Honda', 'model' => 'Click 125',
            'plate_number' => $rider->motorcycle_plate_number,
            'registration_number' => 'REG-12345',
            'registration_expiry' => now()->addYear()->toDateString(),
            'condition' => 'good',
            'safety_equipment' => array_fill_keys(RiderAccreditation::REQUIRED_EQUIPMENT, true),
            'roadworthy' => true,
        ], $override);
    }

    /** Runs stages 2-5 through the HTTP endpoints and returns the rider ready for final approval. */
    private function readyForFinalApproval(): Rider
    {
        $rider = Rider::factory()->withUser()->create();
        $this->actingAs($this->admin);

        $this->post($this->url($rider, '/approve'))->assertRedirect();
        $this->post($this->url($rider, '/accreditation/documents'), [
            'status' => 'verified', 'documents_checked' => ['license' => true, 'registration' => true, 'receipt' => true, 'nbi' => true],
        ])->assertRedirect();
        $this->post($this->url($rider, '/accreditation/orientation'), [
            'scheduled_at' => now()->addDays(2)->format('Y-m-d H:i:s'), 'location' => 'MIGO Office',
            'facilitator_id' => $this->admin->adminProfile->id,
        ])->assertRedirect();
        $orientation = $rider->orientations()->latest('id')->first();
        $this->post($this->url($rider, "/accreditation/orientation/{$orientation->id}/result"), ['attended' => true, 'result' => 'completed'])->assertRedirect();
        $this->post($this->url($rider, '/accreditation/inspection'), $this->inspectionPayload($rider))->assertRedirect();

        return $rider->fresh();
    }

    public function test_full_workflow_ends_with_an_accredited_rider_who_can_accept_bookings(): void
    {
        $rider = $this->readyForFinalApproval();

        $this->assertSame('approved', $rider->application_status);
        $this->assertSame('verified', $rider->document_verification_status);
        $this->assertSame('completed', $rider->orientation_status);
        $this->assertSame('passed', $rider->inspection_status);
        $this->assertSame('for_final_approval', $rider->accreditation_status);
        $this->assertFalse($rider->canAcceptRequests(), 'Passing every stage is not enough: the administrator must grant accreditation.');

        $this->post($this->url($rider, '/accreditation/grant'), ['remarks' => 'All good.'])->assertRedirect();

        $rider->refresh();
        $this->assertSame('accredited', $rider->accreditation_status);
        $this->assertSame($this->admin->adminProfile->id, $rider->accredited_by);
        $this->assertNotNull($rider->accredited_at);
        $this->assertTrue($rider->canAcceptRequests());

        // Booking-related page opens for the accredited, active rider.
        $this->actingAs($rider->user)->get('/biker/service-requests')->assertOk();

        // Every stage left a record and a history entry with the responsible staff member.
        $this->assertDatabaseHas('rider_document_verifications', ['rider_id' => $rider->id, 'status' => 'verified', 'verified_by' => $this->admin->adminProfile->id]);
        $this->assertDatabaseHas('rider_orientations', ['rider_id' => $rider->id, 'status' => 'completed', 'attended' => true]);
        $this->assertDatabaseHas('motorcycle_inspections', ['rider_id' => $rider->id, 'status' => 'passed', 'inspector_id' => $this->admin->adminProfile->id]);
        $this->assertDatabaseHas('rider_accreditation_history', ['rider_id' => $rider->id, 'action' => 'accreditation.granted', 'to_status' => 'accredited']);
        $this->assertGreaterThanOrEqual(6, RiderAccreditationHistory::where('rider_id', $rider->id)->count());
        $this->assertDatabaseHas('notifications', ['user_id' => $rider->user_id, 'notification_type' => 'rider_accreditation_granted']);
    }

    public function test_application_cannot_be_approved_without_the_required_uploads(): void
    {
        $rider = Rider::factory()->withUser()->withoutDocuments()->create(['nbi_clearance' => null]);

        $this->actingAs($this->admin)->post($this->url($rider, '/approve'))->assertRedirect();

        $this->assertSame('pending', $rider->fresh()->application_status);
        $this->assertDatabaseMissing('notifications', ['user_id' => $rider->user_id, 'notification_type' => 'rider_approved']);
    }

    public function test_initial_approval_alone_does_not_allow_booking_functions(): void
    {
        $rider = Rider::factory()->withUser()->create();
        $this->actingAs($this->admin)->post($this->url($rider, '/approve'));

        $rider->refresh();
        $this->assertSame('approved', $rider->application_status);
        $this->assertFalse($rider->canAcceptRequests());

        $this->actingAs($rider->user)->get('/biker/service-requests')->assertRedirect('/biker/dashboard');
        $this->actingAs($rider->user)->getJson('/biker/service-requests')->assertForbidden();
    }

    public function test_stages_cannot_be_skipped(): void
    {
        $rider = Rider::factory()->withUser()->create(); // application still pending
        $this->actingAs($this->admin);

        $this->post($this->url($rider, '/accreditation/documents'), ['status' => 'verified', 'documents_checked' => ['license' => true, 'registration' => true, 'receipt' => true, 'nbi' => true]]);
        $this->assertSame('pending', $rider->fresh()->document_verification_status);

        $this->post($this->url($rider, '/accreditation/grant'));
        $this->assertSame('not_accredited', $rider->fresh()->accreditation_status);
    }

    public function test_failed_inspection_blocks_accreditation_until_a_reinspection_passes(): void
    {
        $rider = $this->readyForFinalApproval();

        // Failed inspection (after the first pass) -> back to not accredited, grant refused.
        $this->post($this->url($rider, '/accreditation/inspection'), $this->inspectionPayload($rider, [
            'status' => 'failed', 'roadworthy' => false, 'findings' => 'Brake lights not working.',
        ]))->assertRedirect();

        $rider->refresh();
        $this->assertSame('failed', $rider->inspection_status);
        $this->assertSame('not_accredited', $rider->accreditation_status);
        $this->post($this->url($rider, '/accreditation/grant'))->assertRedirect();
        $this->assertSame('not_accredited', $rider->fresh()->accreditation_status);
        $this->assertFalse($rider->fresh()->canAcceptRequests());

        // Reinspection passes; the failed record is preserved and linked.
        $this->post($this->url($rider, '/accreditation/inspection'), $this->inspectionPayload($rider))->assertRedirect();
        $rider->refresh();
        $this->assertSame('passed', $rider->inspection_status);
        $this->assertSame('for_final_approval', $rider->accreditation_status);
        $this->assertSame(3, MotorcycleInspection::where('rider_id', $rider->id)->count());
        $this->assertNotNull(MotorcycleInspection::where('rider_id', $rider->id)->orderByDesc('id')->first()->reinspection_of_id);

        $this->post($this->url($rider, '/accreditation/grant'))->assertRedirect();
        $this->assertTrue($rider->fresh()->canAcceptRequests());
    }

    public function test_inspection_cannot_pass_with_missing_equipment_or_a_wrong_plate(): void
    {
        $rider = $this->readyForFinalApproval();
        $this->post($this->url($rider, '/accreditation/inspection'), $this->inspectionPayload($rider, [
            'plate_number' => 'WRONG-PLATE',
            'safety_equipment' => array_merge(array_fill_keys(RiderAccreditation::REQUIRED_EQUIPMENT, true), ['horn' => false]),
        ]));

        $this->assertSame(1, MotorcycleInspection::where('rider_id', $rider->id)->count(), 'The invalid pass must not be saved.');
        $this->assertSame('passed', $rider->fresh()->inspection_status);
    }

    public function test_suspended_or_revoked_rider_cannot_accept_bookings(): void
    {
        $rider = $this->readyForFinalApproval();
        $this->post($this->url($rider, '/accreditation/grant'));
        $this->actingAs($rider->user)->get('/biker/service-requests')->assertOk();

        $this->actingAs($this->admin)->post($this->url($rider, '/suspend'), ['reason' => 'Safety complaint under review.']);
        $this->assertFalse($rider->fresh()->canAcceptRequests());
        $this->actingAs($rider->user)->get('/biker/service-requests')->assertRedirect('/biker/dashboard');

        $this->actingAs($this->admin)->post($this->url($rider, '/reactivate'));
        $this->assertTrue($rider->fresh()->canAcceptRequests());

        $this->post($this->url($rider, '/accreditation/revoke'), ['reason' => 'Violation of rider rules.']);
        $this->assertSame('revoked', $rider->fresh()->accreditation_status);
        $this->assertFalse($rider->fresh()->canAcceptRequests());
        $this->actingAs($rider->user)->get('/biker/service-requests')->assertRedirect('/biker/dashboard');
    }

    public function test_unaccredited_rider_cannot_reach_service_requests(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();
        $this->actingAs($rider->user)->get('/biker/service-requests')->assertRedirect('/biker/dashboard');
    }

    public function test_riders_and_customers_cannot_modify_accreditation_records(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();
        $customer = User::factory()->create();

        foreach ([$rider->user, $customer] as $user) {
            $this->actingAs($user);
            $this->postJson($this->url($rider, '/approve'))->assertForbidden();
            $this->postJson($this->url($rider, '/accreditation/documents'), ['status' => 'verified'])->assertForbidden();
            $this->postJson($this->url($rider, '/accreditation/grant'))->assertForbidden();
            $this->postJson($this->url($rider, '/accreditation/revoke'), ['reason' => 'x'])->assertForbidden();
        }

        $rider->refresh();
        $this->assertSame('pending', $rider->document_verification_status);
        $this->assertSame('not_accredited', $rider->accreditation_status);
    }

    public function test_inactive_administrator_cannot_record_verification(): void
    {
        $inactive = User::factory()->admin('inactive')->create();
        $rider = Rider::factory()->withUser()->approved()->create();

        $this->actingAs($inactive)->postJson($this->url($rider, '/accreditation/documents'), [
            'status' => 'verified', 'documents_checked' => ['license' => true, 'registration' => true, 'receipt' => true, 'nbi' => true],
        ])->assertForbidden();
        $this->assertSame('pending', $rider->fresh()->document_verification_status);
    }

    public function test_rider_sees_only_their_own_progress(): void
    {
        $rider = Rider::factory()->withUser()->approved()->create();
        $other = Rider::factory()->withUser()->create();

        $this->actingAs($rider->user)->getJson('/biker/accreditation')
            ->assertOk()
            ->assertJsonPath('statuses.application', 'approved')
            ->assertJsonPath('can_accept_bookings', false)
            ->assertJsonMissingPath('admin_remarks')
            ->assertJsonMissingPath('history');

        // The biker dashboard receives the same rider-safe summary.
        $this->actingAs($rider->user)->get('/biker/dashboard')->assertInertia(fn (Assert $page) => $page
            ->component('biker/biker-dashboard')
            ->where('accreditation.statuses.accreditation', 'not_accredited')
            ->where('accreditation.can_accept_bookings', false));

        // There is no route a rider can use to change their own status.
        $this->actingAs($rider->user)->postJson('/biker/accreditation', ['accreditation_status' => 'accredited'])->assertStatus(405);
        $this->assertSame('not_accredited', $rider->fresh()->accreditation_status);
        $this->assertSame('not_accredited', $other->fresh()->accreditation_status);
    }

    public function test_rider_management_page_shows_real_statistics_and_filters(): void
    {
        Rider::factory()->count(2)->create();                       // pending applications
        Rider::factory()->approved()->create();                     // pending documents
        Rider::factory()->accredited()->create();                   // accredited
        Rider::factory()->rejected()->create();
        Rider::factory()->approved()->suspended()->create();

        $this->actingAs($this->admin)->get('/admin/riders')->assertInertia(fn (Assert $page) => $page
            ->component('admin/riders/index')
            ->where('stats.total', 6)
            ->where('stats.pending', 2)
            ->where('stats.rejected', 1)
            ->where('stats.accredited', 1)
            ->where('stats.suspended', 1)
            ->where('stats.pending_documents', 2)   // approved + suspended-approved, documents not yet verified
            ->has('riders.data', 6));

        $this->actingAs($this->admin)->get('/admin/riders?accreditation=accredited')->assertInertia(fn (Assert $page) => $page
            ->has('riders.data', 1)->where('riders.data.0.accreditation_status', 'accredited'));
    }

    public function test_existing_riders_keep_their_data_and_start_unaccredited(): void
    {
        $rider = Rider::factory()->approved()->create(['full_name' => 'Existing Rider']);

        $this->assertDatabaseHas('riders', ['id' => $rider->id, 'full_name' => 'Existing Rider', 'application_status' => 'approved', 'accreditation_status' => 'not_accredited']);
        $this->assertSame(1, Rider::count(), 'No duplicate rider rows are created.');
    }
}
