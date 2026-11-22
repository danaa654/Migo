<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountRole;
use App\Models\Passenger;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class GoogleLoginTest extends TestCase
{
    use RefreshDatabase;

    private const RIDER_MESSAGE = 'This email is a rider/admin account. Please use the Rider login.';

    private function mockGoogle(string $id, string $email, string $name = 'Ana Reyes', bool $verified = true): void
    {
        $google = (new SocialiteUser)->map(['id' => $id, 'name' => $name, 'email' => $email])->setRaw(['email_verified' => $verified]);

        $provider = Mockery::mock(Provider::class);
        $provider->shouldReceive('user')->andReturn($google);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);
    }

    public function test_the_redirect_route_sends_the_browser_to_google(): void
    {
        $provider = Mockery::mock(Provider::class);
        $provider->shouldReceive('redirect')->andReturn(redirect('https://accounts.google.com/o/oauth2/auth'));
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $this->get('/auth/google/redirect')->assertRedirect('https://accounts.google.com/o/oauth2/auth');
    }

    public function test_a_new_google_user_becomes_a_customer_with_a_passenger_profile(): void
    {
        $this->mockGoogle('g-123', 'Ana@Example.com');

        // A role in the request must be ignored: the server decides.
        $this->get('/auth/google/callback?role=admin')->assertRedirect('/customer/dashboard');

        $user = User::where('google_id', 'g-123')->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame(AccountRole::Customer, $user->role);
        $this->assertSame('ana@example.com', $user->email);
        $this->assertNotNull($user->email_verified_at);
        $this->assertSame('Ana Reyes', $user->name);
        $this->assertNotEmpty($user->password); // random, unusable

        $passenger = Passenger::where('user_id', $user->id)->firstOrFail();
        $this->assertSame('active', $passenger->account_status);
        $this->assertSame('ana@example.com', $passenger->email);
    }

    public function test_a_returning_google_user_is_logged_in_without_a_duplicate(): void
    {
        $user = User::factory()->create(['google_id' => 'g-123', 'email' => 'ana@example.com']);
        Passenger::create(['user_id' => $user->id, 'full_name' => $user->name, 'email' => $user->email, 'phone' => '', 'account_status' => 'active']);
        $this->mockGoogle('g-123', 'ana@example.com');

        $this->get('/auth/google/callback')->assertRedirect('/customer/dashboard');

        $this->assertAuthenticatedAs($user);
        $this->assertSame(1, User::count());
        $this->assertSame(1, Passenger::count());
    }

    public function test_an_existing_customer_with_the_same_email_is_linked_not_duplicated(): void
    {
        $customer = User::factory()->unverified()->create(['email' => 'ana@example.com', 'name' => 'Ana Reyes']);
        Passenger::create(['user_id' => $customer->id, 'full_name' => 'Ana Reyes', 'email' => 'ana@example.com', 'phone' => '09171234567', 'account_status' => 'active']);
        $this->mockGoogle('g-999', 'ANA@example.com');

        $this->get('/auth/google/callback')->assertRedirect('/customer/dashboard');

        $this->assertAuthenticatedAs($customer);
        $this->assertSame(1, User::count());
        $this->assertSame(1, Passenger::count());
        $this->assertSame('g-999', $customer->fresh()->google_id);
        $this->assertNotNull($customer->fresh()->email_verified_at);
        $this->assertSame('09171234567', $customer->passenger->fresh()->phone);
    }

    public function test_a_legacy_passenger_row_without_a_login_is_linked(): void
    {
        $passenger = Passenger::create(['user_id' => null, 'full_name' => 'Old Customer', 'email' => 'old@example.com', 'phone' => '09171234567', 'account_status' => 'active']);
        $this->mockGoogle('g-555', 'old@example.com', 'Old Customer');

        $this->get('/auth/google/callback')->assertRedirect('/customer/dashboard');

        $this->assertSame(1, Passenger::count());
        $this->assertSame(User::where('google_id', 'g-555')->value('id'), $passenger->fresh()->user_id);
    }

    public function test_a_biker_email_is_rejected(): void
    {
        $biker = User::factory()->biker()->create(['email' => 'rider@example.com']);
        $this->mockGoogle('g-777', 'rider@example.com');

        $this->get('/auth/google/callback')
            ->assertRedirect('/login?tab=rider')
            ->assertSessionHasErrors(['google' => self::RIDER_MESSAGE]);

        $this->assertGuest();
        $this->assertNull($biker->fresh()->google_id);
        $this->assertSame(1, User::count());
    }

    public function test_an_admin_email_is_rejected(): void
    {
        $admin = User::factory()->admin()->create(['email' => 'boss@example.com']);
        $this->mockGoogle('g-888', 'boss@example.com');

        $this->get('/auth/google/callback')
            ->assertRedirect('/login?tab=rider')
            ->assertSessionHasErrors(['google' => self::RIDER_MESSAGE]);

        $this->assertGuest();
        $this->assertNull($admin->fresh()->google_id);
    }

    public function test_a_rider_application_without_a_login_is_rejected_too(): void
    {
        Rider::factory()->create(['email' => 'pending@example.com']);
        $this->mockGoogle('g-444', 'pending@example.com');

        $this->get('/auth/google/callback')->assertSessionHasErrors(['google' => self::RIDER_MESSAGE]);

        $this->assertGuest();
        $this->assertSame(0, User::count());
    }

    public function test_an_email_google_has_not_verified_is_never_used(): void
    {
        $customer = User::factory()->create(['email' => 'ana@example.com']);
        $this->mockGoogle('g-321', 'ana@example.com', verified: false);

        $this->get('/auth/google/callback')->assertRedirect('/login')->assertSessionHasErrors('google');

        $this->assertGuest();
        $this->assertNull($customer->fresh()->google_id);
    }

    public function test_a_failed_google_handshake_returns_to_the_login_page(): void
    {
        $provider = Mockery::mock(Provider::class);
        $provider->shouldReceive('user')->andThrow(new RuntimeException('invalid state'));
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $this->get('/auth/google/callback')->assertRedirect('/login')->assertSessionHasErrors('google');
        $this->assertGuest();
    }
}
