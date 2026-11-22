<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountRole;
use App\Models\Passenger;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RegistrationChangesTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_registration_routes_are_gone(): void
    {
        $this->get('/register/customer')->assertNotFound();
        $this->post('/register/customer', [
            'full_name' => 'Juan Dela Cruz', 'email' => 'juan@example.com', 'phone' => '09171234567',
            'password' => 'password', 'password_confirmation' => 'password', 'terms' => '1',
        ])->assertNotFound();

        $this->assertSame(0, User::count());
    }

    public function test_the_generic_register_post_cannot_create_an_account(): void
    {
        $this->post('/register', [
            'name' => 'Juan Dela Cruz', 'email' => 'juan@example.com',
            'password' => 'password', 'password_confirmation' => 'password',
        ]);

        $this->assertSame(0, User::count());
    }

    public function test_register_goes_straight_to_the_rider_form(): void
    {
        $this->get('/register')->assertRedirect('/register/biker');
        $this->withoutVite()->get('/register/biker')->assertOk()->assertInertia(fn ($p) => $p->component('auth/register-biker'));
    }

    public function test_existing_customers_are_untouched(): void
    {
        $customer = User::factory()->create(['email' => 'keep@example.com']);
        Passenger::create(['user_id' => $customer->id, 'full_name' => 'Keep Me', 'email' => 'keep@example.com', 'phone' => '09171234567', 'account_status' => 'active']);

        $this->get('/register/customer')->assertNotFound();

        $this->assertDatabaseHas('users', ['id' => $customer->id, 'email' => 'keep@example.com']);
        $this->assertDatabaseHas('passengers', ['email' => 'keep@example.com', 'phone' => '09171234567']);
    }

    public function test_rider_registration_still_works(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $this->post('/register/biker', [
            'full_name' => 'Pedro Penduko',
            'email' => 'pedro@example.com',
            'phone' => '09171234567',
            'password' => 'Str0ng!Passw0rd#2026',
            'password_confirmation' => 'Str0ng!Passw0rd#2026',
            'terms' => '1',
            'document_consent' => '1',
            'vehicle_type' => 'two_wheel',
            'address' => '123 Colon St, Cebu City',
            'license_number' => 'N01-23-456789',
            'license_expiry' => now()->addYear()->toDateString(),
            'motorcycle_plate_number' => 'ABC 1234',
            'license_document' => UploadedFile::fake()->image('license.jpg'),
            'registration_document' => UploadedFile::fake()->image('orcr.jpg'),
            'official_receipt' => UploadedFile::fake()->image('or.jpg'),
            'nbi_clearance' => UploadedFile::fake()->create('nbi.pdf', 100, 'application/pdf'),
        ])->assertRedirect('/login');

        $user = User::where('email', 'pedro@example.com')->firstOrFail();
        $this->assertSame(AccountRole::Biker, $user->role);
        $this->assertSame('pending', Rider::where('user_id', $user->id)->firstOrFail()->application_status);
    }
}
