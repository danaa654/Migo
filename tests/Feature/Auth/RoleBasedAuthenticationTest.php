<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * MIGO Part 1: unified Customer/Biker login, separate Administrator login,
 * role-based redirects and server-side route protection.
 */
class RoleBasedAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    // ---------------------------------------------------------------- login pages

    public function test_unified_login_page_renders_without_account_type_selection(): void
    {
        $this->get('/login')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('auth/login'));
    }

    public function test_admin_login_page_renders(): void
    {
        $this->get('/admin/login')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('auth/admin-login'));
    }

    public function test_old_three_card_login_urls_redirect(): void
    {
        $this->get('/login/customer')->assertRedirect('/login');
        $this->get('/login/biker')->assertRedirect('/login');
        $this->get('/login/admin')->assertRedirect('/admin/login');
    }

    public function test_there_is_no_public_admin_registration(): void
    {
        $this->get('/admin/register')->assertNotFound();
    }

    // ---------------------------------------------------------------- 1-3 login + redirect by role

    public function test_customer_logs_in_and_lands_on_customer_dashboard(): void
    {
        $user = User::factory()->create();

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirect('/customer/dashboard');

        $this->assertAuthenticatedAs($user);
        $this->get('/customer/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('customer/customer-dashboard'));
    }

    public function test_biker_logs_in_and_lands_on_biker_dashboard(): void
    {
        $user = User::factory()->biker()->create();

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirect('/biker/dashboard');

        $this->assertAuthenticatedAs($user);
        $this->get('/biker/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('biker/biker-dashboard'));
    }

    public function test_active_admin_logs_in_through_admin_login_and_lands_on_admin_dashboard(): void
    {
        $user = User::factory()->admin()->create();

        $this->post('/login', ['email' => $user->email, 'password' => 'password', 'portal' => 'admin'])
            ->assertRedirect('/admin/dashboard');

        $this->assertAuthenticatedAs($user);
        $this->get('/admin/dashboard')->assertOk();
    }

    public function test_remember_me_sets_the_remember_cookie(): void
    {
        $user = User::factory()->create();

        $response = $this->post('/login', ['email' => $user->email, 'password' => 'password', 'remember' => true]);

        $response->assertRedirect('/customer/dashboard');
        $names = array_map(fn ($cookie) => $cookie->getName(), $response->headers->getCookies());
        $this->assertTrue(
            count(array_filter($names, fn ($name) => str_starts_with($name, 'remember_web_'))) > 0,
            'Expected a remember_web_* cookie after logging in with Remember Me.',
        );
    }

    // ---------------------------------------------------------------- 4 invalid credentials / wrong portal

    public function test_wrong_password_is_rejected_on_both_forms(): void
    {
        $customer = User::factory()->create();
        $admin = User::factory()->admin()->create();

        $this->post('/login', ['email' => $customer->email, 'password' => 'nope'])->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->post('/login', ['email' => $admin->email, 'password' => 'nope', 'portal' => 'admin'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_unknown_email_is_rejected(): void
    {
        $this->post('/login', ['email' => 'nobody@example.com', 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_admin_cannot_sign_in_through_the_public_form(): void
    {
        $admin = User::factory()->admin()->create();

        $this->post('/login', ['email' => $admin->email, 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_customer_and_biker_cannot_sign_in_through_the_admin_form(): void
    {
        $customer = User::factory()->create();
        $biker = User::factory()->biker()->create();

        $this->post('/login', ['email' => $customer->email, 'password' => 'password', 'portal' => 'admin'])->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->post('/login', ['email' => $biker->email, 'password' => 'password', 'portal' => 'admin'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_inactive_admin_cannot_sign_in(): void
    {
        $admin = User::factory()->admin('suspended')->create();

        $this->post('/login', ['email' => $admin->email, 'password' => 'password', 'portal' => 'admin'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_admin_role_without_admin_profile_cannot_sign_in(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['role' => 'admin'])->save();

        $this->post('/login', ['email' => $user->email, 'password' => 'password', 'portal' => 'admin'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    // ---------------------------------------------------------------- 5 + 7 unauthorized / direct URL access

    public function test_guests_are_redirected_to_the_right_login(): void
    {
        $this->get('/customer/dashboard')->assertRedirect('/login');
        $this->get('/biker/dashboard')->assertRedirect('/login');
        $this->get('/admin/dashboard')->assertRedirect('/admin/login');
        $this->get('/admin/riders')->assertRedirect('/admin/login');
    }

    public function test_customer_cannot_open_biker_or_admin_pages(): void
    {
        $this->actingAs(User::factory()->create());

        $this->get('/biker/dashboard')->assertRedirect('/customer/dashboard');
        $this->get('/admin/dashboard')->assertRedirect('/customer/dashboard');
        $this->get('/admin/riders')->assertRedirect('/customer/dashboard');
        $this->assertAuthenticated();
    }

    public function test_biker_cannot_open_customer_or_admin_pages(): void
    {
        $this->actingAs(User::factory()->biker()->create());

        $this->get('/customer/dashboard')->assertRedirect('/biker/dashboard');
        $this->get('/admin/dashboard')->assertRedirect('/biker/dashboard');
        $this->assertAuthenticated();
    }

    public function test_admin_cannot_open_customer_or_biker_dashboards(): void
    {
        $this->actingAs(User::factory()->admin()->create());

        $this->get('/customer/dashboard')->assertRedirect('/admin/dashboard');
        $this->get('/biker/dashboard')->assertRedirect('/admin/dashboard');
    }

    public function test_json_requests_with_the_wrong_role_get_403(): void
    {
        $this->actingAs(User::factory()->create());

        $this->getJson('/admin/dashboard')->assertForbidden();
        $this->getJson('/biker/dashboard')->assertForbidden();
    }

    public function test_admin_who_is_deactivated_mid_session_is_signed_out(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin);

        $admin->adminProfile->update(['status' => 'inactive']);

        $this->get('/admin/dashboard')->assertRedirect('/admin/login');
        $this->assertGuest();
    }

    public function test_signed_in_users_visiting_login_pages_go_to_their_own_dashboard(): void
    {
        $this->actingAs(User::factory()->biker()->create());

        $this->get('/login')->assertRedirect('/biker/dashboard');
        $this->get('/admin/login')->assertRedirect('/biker/dashboard');
    }

    public function test_generic_dashboard_url_redirects_by_role(): void
    {
        $this->actingAs(User::factory()->biker()->create());

        $this->get('/dashboard')->assertRedirect('/biker/dashboard');
    }

    // ---------------------------------------------------------------- 6 logout

    public function test_logout_ends_the_session_for_every_role(): void
    {
        foreach ([User::factory()->create(), User::factory()->biker()->create(), User::factory()->admin()->create()] as $user) {
            $this->actingAs($user)->post('/logout')->assertRedirect('/');
            $this->assertGuest();
        }
    }

    public function test_protected_pages_are_closed_after_logout(): void
    {
        $user = User::factory()->create();

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $this->post('/logout');

        $this->get('/customer/dashboard')->assertRedirect('/login');
    }

    // ---------------------------------------------------------------- data safety

    public function test_logging_in_does_not_create_or_change_user_records(): void
    {
        $user = User::factory()->create();
        $count = User::count();

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);

        $this->assertSame($count, User::count());
        $this->assertSame($user->email, $user->fresh()->email);
    }
}
