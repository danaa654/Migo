<?php

namespace Tests\Feature\Auth;

use App\Models\Passenger;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * MIGO Part 2: Customer and Biker registration, biker approval gate, integration with the Part 1 login.
 * (Replaces the starter-kit registration tests, which targeted Fortify registration that this project has disabled.)
 */
class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function customerData(array $over = []): array
    {
        return array_merge([
            'full_name' => 'Maria Santos',
            'email' => 'maria@example.com',
            'phone' => '0917 123 4567',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'terms' => true,
        ], $over);
    }

    private function bikerData(array $over = []): array
    {
        return array_merge($this->customerData(['full_name' => 'Juan Dela Cruz', 'email' => 'juan@example.com']), [
            'address' => '123 Rizal St, Ipil, Zamboanga Sibugay',
            'license_number' => 'n01-23-456789',
            'license_expiry' => now()->addYear()->toDateString(),
            'motorcycle_plate_number' => 'abc 1234',
            'vehicle_type' => 'two_wheel',
        ], $over);
    }

    private function rider(User $user, string $status): Rider
    {
        return Rider::create([
            'user_id' => $user->id,
            'full_name' => $user->name,
            'email' => $user->email,
            'phone' => '09171234567',
            'address' => 'Somewhere',
            'license_number' => 'LIC-'.$user->id,
            'license_expiry' => now()->addYear()->toDateString(),
            'motorcycle_plate_number' => 'PLT-'.$user->id,
            'application_status' => $status,
        ]);
    }

    // ------------------------------------------------------------ 1-2 entry point and account type selection

    public function test_selection_page_renders(): void
    {
        $this->get('/register')->assertOk()->assertInertia(fn (Assert $p) => $p->component('auth/register'));
    }

    public function test_customer_and_biker_forms_render(): void
    {
        $this->get('/register/customer')->assertOk()->assertInertia(fn (Assert $p) => $p->component('auth/register-customer'));
        $this->get('/register/biker')->assertOk()->assertInertia(fn (Assert $p) => $p->component('auth/register-biker'));
    }

    public function test_signed_in_users_are_sent_to_their_dashboard_instead_of_registering(): void
    {
        $this->actingAs(User::factory()->create());

        $this->get('/register')->assertRedirect('/customer/dashboard');
        $this->get('/register/biker')->assertRedirect('/customer/dashboard');
    }

    // ------------------------------------------------------------ 3 + 8 customer registration

    public function test_customer_can_register_and_gets_customer_role(): void
    {
        $this->post('/register/customer', $this->customerData())
            ->assertRedirect('/login')
            ->assertSessionHas('status');

        $user = User::where('email', 'maria@example.com')->firstOrFail();
        $this->assertSame('customer', $user->role->value);
        $this->assertTrue(Hash::check('Secret123!', $user->password));
        $this->assertNotSame('Secret123!', $user->password);

        $this->assertDatabaseHas('passengers', [
            'user_id' => $user->id,
            'email' => 'maria@example.com',
            'phone' => '09171234567',
            'account_status' => 'active',
        ]);
        $this->assertGuest();
    }

    public function test_new_customer_can_log_in_and_reaches_customer_dashboard(): void
    {
        $this->post('/register/customer', $this->customerData());

        $this->post('/login', ['email' => 'maria@example.com', 'password' => 'Secret123!'])
            ->assertRedirect('/customer/dashboard');
        $this->get('/customer/dashboard')->assertOk();
    }

    public function test_email_is_normalised_to_lowercase(): void
    {
        $this->post('/register/customer', $this->customerData(['email' => '  Maria@Example.COM ']));

        $this->assertDatabaseHas('users', ['email' => 'maria@example.com']);
    }

    // ------------------------------------------------------------ 4 + 9 biker registration

    public function test_biker_can_register_as_pending_with_biker_role(): void
    {
        Storage::fake('public');

        $this->post('/register/biker', $this->bikerData(['profile_picture' => UploadedFile::fake()->image('me.jpg')]))
            ->assertRedirect('/login')
            ->assertSessionHas('status');

        $user = User::where('email', 'juan@example.com')->firstOrFail();
        $this->assertSame('biker', $user->role->value);
        $this->assertTrue(Hash::check('Secret123!', $user->password));

        $rider = $user->rider;
        $this->assertSame('pending', $rider->application_status);
        $this->assertSame('N01-23-456789', $rider->license_number);
        $this->assertSame('ABC 1234', $rider->motorcycle_plate_number);
        $this->assertNotNull($rider->profile_picture);
        Storage::disk('public')->assertExists($rider->profile_picture);
    }

    public function test_rider_can_register_as_two_wheel_biker_or_four_wheel_angcars(): void
    {
        $this->post('/register/biker', $this->bikerData())->assertRedirect('/login');
        $this->post('/register/biker', $this->bikerData([
            'email' => 'car@example.com', 'license_number' => 'N02-99-111111', 'motorcycle_plate_number' => 'XYZ 987', 'vehicle_type' => 'four_wheel',
        ]))->assertRedirect('/login');

        $this->assertSame('two_wheel', User::where('email', 'juan@example.com')->first()->rider->vehicle_type->value);
        $this->assertSame('four_wheel', User::where('email', 'car@example.com')->first()->rider->vehicle_type->value);
    }

    public function test_invalid_vehicle_type_is_rejected(): void
    {
        $this->post('/register/biker', $this->bikerData(['vehicle_type' => 'three_wheel']))->assertSessionHasErrors('vehicle_type');
        $this->assertSame(0, Rider::count());
    }

    public function test_biker_registration_works_without_a_photo(): void
    {
        $this->post('/register/biker', $this->bikerData())->assertRedirect('/login');

        $this->assertNull(User::where('email', 'juan@example.com')->first()->rider->profile_picture);
    }

    public function test_new_biker_can_log_in_and_sees_pending_status(): void
    {
        $this->post('/register/biker', $this->bikerData());

        $this->post('/login', ['email' => 'juan@example.com', 'password' => 'Secret123!'])
            ->assertRedirect('/biker/dashboard');
        $this->get('/biker/dashboard')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('biker/biker-dashboard')
            ->where('applicationStatus', 'pending'));
    }

    // ------------------------------------------------------------ 5-7 validation

    public function test_required_fields_are_validated_for_customers(): void
    {
        $this->post('/register/customer', [])->assertSessionHasErrors(['full_name', 'email', 'phone', 'password', 'terms']);
        $this->assertSame(0, User::count());
    }

    public function test_required_fields_are_validated_for_bikers(): void
    {
        $this->post('/register/biker', [])->assertSessionHasErrors([
            'full_name', 'email', 'phone', 'password', 'terms', 'address', 'license_number', 'license_expiry', 'motorcycle_plate_number', 'vehicle_type',
        ]);
        $this->assertSame(0, User::count());
        $this->assertSame(0, Rider::count());
    }

    public function test_email_format_is_validated(): void
    {
        $this->post('/register/customer', $this->customerData(['email' => 'not-an-email']))->assertSessionHasErrors('email');
    }

    public function test_passwords_must_match(): void
    {
        $this->post('/register/customer', $this->customerData(['password_confirmation' => 'Different123!']))->assertSessionHasErrors('password');
        $this->post('/register/biker', $this->bikerData(['password_confirmation' => 'Different123!']))->assertSessionHasErrors('password');
        $this->assertSame(0, User::count());
    }

    public function test_weak_password_is_rejected(): void
    {
        $this->post('/register/customer', $this->customerData(['password' => 'abc', 'password_confirmation' => 'abc']))->assertSessionHasErrors('password');
    }

    public function test_terms_must_be_accepted(): void
    {
        $this->post('/register/customer', $this->customerData(['terms' => false]))->assertSessionHasErrors('terms');
        $this->post('/register/biker', $this->bikerData(['terms' => false]))->assertSessionHasErrors('terms');
    }

    public function test_invalid_phone_numbers_are_rejected(): void
    {
        foreach (['12345', 'abcdefghijk', '0817 123 4567', '091712345678', '0917123456'] as $phone) {
            $this->post('/register/customer', $this->customerData(['phone' => $phone]))->assertSessionHasErrors('phone');
        }
        $this->post('/register/customer', $this->customerData(['phone' => '09171234567']))->assertSessionDoesntHaveErrors('phone');
    }

    // ------------------------------------------------------------ 5 duplicates

    public function test_duplicate_email_is_rejected_against_users(): void
    {
        User::factory()->create(['email' => 'maria@example.com']);

        $this->post('/register/customer', $this->customerData())->assertSessionHasErrors('email');
        $this->post('/register/biker', $this->bikerData(['email' => 'maria@example.com']))->assertSessionHasErrors('email');
    }

    public function test_duplicate_email_is_rejected_after_a_successful_registration(): void
    {
        $this->post('/register/customer', $this->customerData());
        $this->post('/register/customer', $this->customerData(['email' => 'MARIA@example.com']))->assertSessionHasErrors('email');

        $this->assertSame(1, User::count());
    }

    public function test_existing_profile_rows_are_not_claimed_or_changed_by_registration(): void
    {
        $existing = Rider::create([
            'full_name' => 'Existing Rider', 'email' => 'old@example.com', 'phone' => '09170000000',
            'license_number' => 'OLD-1', 'license_expiry' => now()->addYear()->toDateString(),
            'motorcycle_plate_number' => 'OLD 111', 'application_status' => 'approved',
        ]);
        Passenger::create(['full_name' => 'Existing Passenger', 'email' => 'oldp@example.com', 'phone' => '09170000001', 'account_status' => 'active']);

        $this->post('/register/biker', $this->bikerData(['email' => 'old@example.com']))->assertSessionHasErrors('email');
        $this->post('/register/customer', $this->customerData(['email' => 'oldp@example.com']))->assertSessionHasErrors('email');

        $this->assertSame('approved', $existing->fresh()->application_status);
        $this->assertNull($existing->fresh()->user_id);
        $this->assertSame(0, User::count());
    }

    public function test_duplicate_license_and_plate_numbers_are_rejected(): void
    {
        $this->post('/register/biker', $this->bikerData());

        $this->post('/register/biker', $this->bikerData(['email' => 'other@example.com']))
            ->assertSessionHasErrors(['license_number', 'motorcycle_plate_number']);
        $this->assertSame(1, Rider::count());
    }

    public function test_expired_license_is_rejected(): void
    {
        $this->post('/register/biker', $this->bikerData(['license_expiry' => now()->subDay()->toDateString()]))->assertSessionHasErrors('license_expiry');
    }

    public function test_profile_photo_must_be_a_small_image(): void
    {
        Storage::fake('public');

        $this->post('/register/biker', $this->bikerData(['profile_picture' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf')]))
            ->assertSessionHasErrors('profile_picture');
        $this->post('/register/biker', $this->bikerData(['profile_picture' => UploadedFile::fake()->image('big.jpg')->size(5000)]))
            ->assertSessionHasErrors('profile_picture');
        $this->assertSame(0, User::count());
    }

    // ------------------------------------------------------------ 8 role assignment cannot be tampered with

    public function test_role_cannot_be_chosen_by_the_visitor(): void
    {
        $this->post('/register/customer', $this->customerData(['role' => 'admin']));
        $this->post('/register/biker', $this->bikerData(['role' => 'admin']));

        $this->assertSame('customer', User::where('email', 'maria@example.com')->first()->role->value);
        $this->assertSame('biker', User::where('email', 'juan@example.com')->first()->role->value);
        $this->assertDatabaseMissing('users', ['role' => 'admin']);
        $this->assertDatabaseCount('admin_profiles', 0);
    }

    public function test_there_is_no_administrator_registration_route(): void
    {
        $this->get('/register/admin')->assertNotFound();
        $this->post('/register/admin', $this->customerData())->assertStatus(404);
        $this->post('/register', $this->customerData())->assertStatus(405);
    }

    // ------------------------------------------------------------ 10 biker approval gate

    public function test_pending_biker_cannot_open_restricted_biker_pages(): void
    {
        $user = User::factory()->biker()->create();
        $this->rider($user, 'pending');
        $this->actingAs($user);

        $this->get('/biker/service-requests')->assertRedirect('/biker/dashboard');
        $this->getJson('/biker/service-requests')->assertForbidden();
    }

    public function test_rejected_biker_cannot_open_restricted_biker_pages(): void
    {
        $user = User::factory()->biker()->create();
        $this->rider($user, 'rejected');

        $this->actingAs($user)->get('/biker/service-requests')->assertRedirect('/biker/dashboard');
    }

    public function test_biker_without_an_application_is_treated_as_unapproved(): void
    {
        $this->actingAs(User::factory()->biker()->create())->get('/biker/service-requests')->assertRedirect('/biker/dashboard');
    }

    public function test_approved_biker_can_open_restricted_biker_pages(): void
    {
        $user = User::factory()->biker()->create();
        $this->rider($user, 'approved');

        $this->actingAs($user)->get('/biker/service-requests')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('biker/biker-service-requests'));
    }

    public function test_approval_takes_effect_as_soon_as_status_changes(): void
    {
        $user = User::factory()->biker()->create();
        $rider = $this->rider($user, 'pending');
        $this->actingAs($user);

        $this->get('/biker/service-requests')->assertRedirect('/biker/dashboard');

        $rider->update(['application_status' => 'approved']);

        $this->get('/biker/service-requests')->assertOk();
    }

    public function test_customers_cannot_open_biker_restricted_pages(): void
    {
        $this->actingAs(User::factory()->create())->get('/biker/service-requests')->assertRedirect('/customer/dashboard');
    }
}
