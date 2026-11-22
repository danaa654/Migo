<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The email + password flows must behave exactly as before the customer redesign. */
class RiderAndAdminLoginUnchangedTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_rider_signs_in_with_email_and_password(): void
    {
        $biker = User::factory()->biker()->create(['email' => 'rider@example.com']);

        $this->post('/login', ['email' => 'rider@example.com', 'password' => 'password'])->assertRedirect('/biker/dashboard');

        $this->assertAuthenticatedAs($biker);
    }

    public function test_a_wrong_rider_password_is_rejected(): void
    {
        User::factory()->biker()->create(['email' => 'rider@example.com']);

        $this->from('/login')->post('/login', ['email' => 'rider@example.com', 'password' => 'nope'])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_an_active_admin_signs_in_through_the_admin_portal(): void
    {
        $admin = User::factory()->admin()->create(['email' => 'boss@example.com']);

        $this->post('/login', ['email' => 'boss@example.com', 'password' => 'password', 'portal' => 'admin'])->assertRedirect('/admin/dashboard');

        $this->assertAuthenticatedAs($admin);
    }

    public function test_an_admin_cannot_use_the_public_form_and_a_rider_cannot_use_the_admin_form(): void
    {
        User::factory()->admin()->create(['email' => 'boss@example.com']);
        User::factory()->biker()->create(['email' => 'rider@example.com']);

        $this->from('/login')->post('/login', ['email' => 'boss@example.com', 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->from('/admin/login')->post('/login', ['email' => 'rider@example.com', 'password' => 'password', 'portal' => 'admin'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_existing_customers_with_a_password_can_still_sign_in(): void
    {
        $customer = User::factory()->create(['email' => 'old@example.com']);

        $this->post('/login', ['email' => 'old@example.com', 'password' => 'password'])->assertRedirect('/customer/dashboard');

        $this->assertAuthenticatedAs($customer);
    }

    public function test_passwordless_accounts_cannot_be_used_on_the_password_form(): void
    {
        User::factory()->create(['email' => 'g@example.com', 'google_id' => 'g-1']);

        $this->from('/login')->post('/login', ['email' => 'g@example.com', 'password' => ''])->assertSessionHasErrors();

        $this->assertGuest();
    }
}
