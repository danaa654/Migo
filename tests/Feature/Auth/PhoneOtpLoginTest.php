<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountRole;
use App\Models\LoginOtp;
use App\Models\Passenger;
use App\Models\Rider;
use App\Models\User;
use App\Services\Sms\LogSmsSender;
use App\Services\Sms\SmsSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\Support\FakeSmsSender;
use Tests\TestCase;

class PhoneOtpLoginTest extends TestCase
{
    use RefreshDatabase;

    private FakeSmsSender $sms;

    private const PHONE = '09171234567';

    private const E164 = '+639171234567';

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->sms = new FakeSmsSender;
        $this->app->instance(SmsSender::class, $this->sms);
    }

    private function send(string $phone = self::PHONE)
    {
        return $this->postJson('/auth/otp/send', ['phone' => $phone]);
    }

    private function verify(string $code, string $phone = self::PHONE)
    {
        return $this->postJson('/auth/otp/verify', ['phone' => $phone, 'code' => $code]);
    }

    private function wrongCode(): string
    {
        return $this->sms->lastCode() === '000000' ? '111111' : '000000';
    }

    // ---- send ---------------------------------------------------------------------------------------------------

    public function test_send_stores_only_a_hash_and_sends_the_sms(): void
    {
        $response = $this->send('9171234567')->assertOk()->assertJson(['resend_in' => 60]);

        $code = $this->sms->lastCode();
        $this->assertSame(self::E164, $this->sms->sent[0]['to']);
        $this->assertStringNotContainsString($code, $response->getContent(), 'the code must never be in the HTTP response');

        $otp = LoginOtp::firstOrFail();
        $this->assertSame(self::E164, $otp->phone);
        $this->assertNotSame($code, $otp->code_hash);
        $this->assertStringNotContainsString($code, json_encode($otp->getAttributes()));
        $this->assertTrue($otp->expires_at->between(now()->addMinutes(4), now()->addMinutes(5)->addSecond()));
        $this->assertSame(0, $otp->attempts);
        $this->assertNull($otp->consumed_at);
    }

    public function test_the_response_is_the_same_for_registered_and_unregistered_numbers(): void
    {
        User::factory()->create(['phone' => '+639180000000', 'phone_verified_at' => now()]);

        $registered = $this->send('09180000000');
        $unknown = $this->send('09191111111');

        $this->assertSame($registered->status(), $unknown->status());
        $this->assertSame($registered->json(), $unknown->json());
    }

    public function test_a_new_code_invalidates_the_previous_unused_one(): void
    {
        $this->send()->assertOk();
        $first = $this->sms->lastCode();

        $this->travel(61)->seconds();
        $this->send()->assertOk();
        $second = $this->sms->lastCode();
        $this->assertNotSame($first, $second);

        $this->verify($first)->assertStatus(422);
        $this->assertGuest();
        $this->verify($second)->assertOk();
    }

    public function test_resend_cooldown_is_60_seconds(): void
    {
        $this->send()->assertOk();

        $this->send()->assertStatus(429)->assertJsonStructure(['message', 'retry_after']);
        $this->assertCount(1, $this->sms->sent);

        $this->travel(61)->seconds();
        $this->send()->assertOk();
    }

    public function test_max_three_sends_per_phone_in_ten_minutes(): void
    {
        foreach ([0, 61, 61] as $wait) {
            $this->travel($wait)->seconds();
            $this->send()->assertOk();
        }

        $this->travel(61)->seconds(); // cooldown is over, but this is the 4th code inside 10 minutes
        $this->send()->assertStatus(429);
        $this->assertCount(3, $this->sms->sent);

        $this->travel(10)->minutes();
        $this->send()->assertOk();
    }

    public function test_the_ip_is_throttled_across_many_numbers(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->send('0917000'.str_pad((string) $i, 4, '0', STR_PAD_LEFT))->assertOk();
        }

        $this->send('09179999999')->assertStatus(429);
    }

    public function test_a_failed_sms_does_not_leave_a_code_behind(): void
    {
        $this->sms->fail = true;

        $this->send()->assertStatus(503);
        $this->assertSame(0, LoginOtp::count());
    }

    public function test_the_log_driver_refuses_to_run_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->expectException(RuntimeException::class);
        (new LogSmsSender)->send(self::E164, 'Migo: code 123456');
    }

    // ---- verify -------------------------------------------------------------------------------------------------

    public function test_first_successful_sign_in_creates_the_customer_and_the_passenger_profile(): void
    {
        $this->send()->assertOk();

        $this->verify($this->sms->lastCode())
            ->assertOk()
            ->assertJson(['redirect' => '/customer/dashboard']);

        $user = User::where('phone', self::E164)->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame(AccountRole::Customer, $user->role);
        $this->assertNotNull($user->phone_verified_at);
        $this->assertNull($user->email);

        $passenger = Passenger::where('user_id', $user->id)->firstOrFail();
        $this->assertSame(self::PHONE, $passenger->phone); // Passenger.phone stays in the existing local format
        $this->assertSame('active', $passenger->account_status);
    }

    public function test_a_new_phone_customer_must_complete_the_profile_before_booking(): void
    {
        $this->send()->assertOk();
        $this->verify($this->sms->lastCode())->assertOk();

        $this->get('/customer/dashboard')->assertRedirect('/customer/profile');
        $this->get('/customer/book')->assertRedirect('/customer/profile');
        $this->get('/customer/profile')->assertOk();

        $this->patch('/customer/profile', ['full_name' => 'Juan Dela Cruz'])->assertRedirect('/customer/dashboard');

        $user = User::where('phone', self::E164)->firstOrFail();
        $this->assertFalse($user->needsProfileCompletion());
        $this->assertSame('Juan Dela Cruz', $user->passenger->full_name);
        $this->get('/customer/book')->assertOk();
    }

    public function test_a_wrong_code_is_rejected_and_the_right_one_still_works(): void
    {
        $this->send()->assertOk();
        $code = $this->sms->lastCode();

        $this->verify($this->wrongCode())->assertStatus(422)->assertJsonFragment(['message' => 'Mali ang code. 4 subok na lang ang natitira.']);
        $this->assertGuest();
        $this->assertSame(1, LoginOtp::first()->attempts);

        $this->verify($code)->assertOk();
    }

    public function test_an_expired_code_is_rejected(): void
    {
        $this->send()->assertOk();
        $code = $this->sms->lastCode();

        $this->travel(6)->minutes();

        $this->verify($code)->assertStatus(422);
        $this->assertGuest();
        $this->assertSame(0, User::count());
    }

    public function test_a_code_can_only_be_used_once(): void
    {
        $this->send()->assertOk();
        $code = $this->sms->lastCode();

        $this->verify($code)->assertOk();
        $this->post('/logout');
        $this->assertGuest();

        $this->verify($code)->assertStatus(422);
        $this->assertGuest();
        $this->assertSame(1, User::count());
        $this->assertNotNull(LoginOtp::first()->consumed_at);
    }

    public function test_five_wrong_attempts_kill_the_code_even_for_the_right_digits(): void
    {
        $this->send()->assertOk();
        $code = $this->sms->lastCode();
        $wrong = $this->wrongCode();

        foreach (range(1, 4) as $i) {
            $this->verify($wrong)->assertStatus(422);
        }
        $this->verify($wrong)->assertStatus(422)->assertJsonFragment(['message' => 'Masyadong maraming maling subok. Mag-request ng bagong code.']);

        $this->verify($code)->assertStatus(422);
        $this->assertGuest();
        $this->assertSame(0, User::count());
    }

    public function test_the_code_must_be_six_digits(): void
    {
        $this->send()->assertOk();

        $this->verify('12345')->assertStatus(422)->assertJsonValidationErrors('code');
        $this->verify('abcdef')->assertStatus(422)->assertJsonValidationErrors('code');
    }

    public function test_verifying_without_asking_for_a_code_fails(): void
    {
        $this->verify('123456')->assertStatus(422);
        $this->assertGuest();
    }

    public function test_an_existing_customer_found_by_users_phone_is_signed_in_not_duplicated(): void
    {
        $customer = User::factory()->create(['phone' => self::E164, 'phone_verified_at' => now()]);
        Passenger::create(['user_id' => $customer->id, 'full_name' => $customer->name, 'email' => $customer->email, 'phone' => self::PHONE, 'account_status' => 'active']);

        $this->send()->assertOk();
        $this->verify($this->sms->lastCode())->assertOk();

        $this->assertAuthenticatedAs($customer);
        $this->assertSame(1, User::count());
        $this->assertSame(1, Passenger::count());
    }

    public function test_an_existing_customer_is_linked_by_the_phone_on_their_passenger_profile(): void
    {
        $customer = User::factory()->create(['name' => 'Maria Santos']);
        Passenger::create(['user_id' => $customer->id, 'full_name' => 'Maria Santos', 'email' => $customer->email, 'phone' => self::PHONE, 'account_status' => 'active']);

        $this->send('+639171234567')->assertOk();
        $this->verify($this->sms->lastCode(), '+639171234567')->assertOk();

        $this->assertAuthenticatedAs($customer);
        $this->assertSame(1, User::count());
        $this->assertSame(1, Passenger::count());
        $this->assertSame(self::E164, $customer->fresh()->phone);
        $this->assertNotNull($customer->fresh()->phone_verified_at);
        $this->assertSame('Maria Santos', $customer->fresh()->name);
    }

    public function test_a_rider_phone_is_rejected(): void
    {
        Rider::factory()->withUser()->create(['phone' => self::PHONE]);

        $this->send()->assertOk(); // same answer as any other number
        $this->verify($this->sms->lastCode())
            ->assertStatus(403)
            ->assertJsonFragment(['message' => 'Please use the Rider login.']);

        $this->assertGuest();
        $this->assertSame(1, User::count());
        $this->assertSame(AccountRole::Biker, User::firstOrFail()->role);
    }

    public function test_a_biker_or_admin_user_phone_is_rejected(): void
    {
        User::factory()->biker()->create(['phone' => '+639170000001', 'phone_verified_at' => now()]);
        User::factory()->admin()->create(['phone' => '+639170000002', 'phone_verified_at' => now()]);

        foreach (['09170000001', '09170000002'] as $phone) {
            $this->send($phone)->assertOk();
            $this->verify($this->sms->lastCode(), $phone)->assertStatus(403)->assertJsonFragment(['message' => 'Please use the Rider login.']);
            $this->assertGuest();
        }

        $this->assertSame(2, User::count());
    }

    public function test_the_role_can_never_be_chosen_by_the_request(): void
    {
        $this->send()->assertOk();

        $this->postJson('/auth/otp/verify', ['phone' => self::PHONE, 'code' => $this->sms->lastCode(), 'role' => 'admin'])->assertOk();

        $this->assertSame(AccountRole::Customer, User::where('phone', self::E164)->firstOrFail()->role);
    }

    public function test_the_login_page_opens_on_the_customer_option(): void
    {
        $this->get('/login')->assertOk()->assertInertia(fn ($page) => $page->component('auth/login')->where('tab', 'customer'));
        $this->get('/login?tab=rider')->assertInertia(fn ($page) => $page->where('tab', 'rider'));
    }

    public function test_a_signed_in_customer_can_confirm_a_phone_number_on_the_profile(): void
    {
        $customer = User::factory()->create();
        Passenger::create(['user_id' => $customer->id, 'full_name' => $customer->name, 'email' => $customer->email, 'phone' => '', 'account_status' => 'active']);

        $this->actingAs($customer)->postJson('/customer/profile/phone/send', ['phone' => self::PHONE])->assertOk();
        $this->actingAs($customer)->postJson('/customer/profile/phone/verify', ['phone' => self::PHONE, 'code' => $this->sms->lastCode()])->assertOk();

        $this->assertSame(self::E164, $customer->fresh()->phone);
        $this->assertSame(self::PHONE, $customer->passenger->fresh()->phone);
    }

    public function test_a_customer_cannot_claim_a_number_used_by_another_account(): void
    {
        User::factory()->create(['phone' => self::E164, 'phone_verified_at' => now()]);
        $other = User::factory()->create();

        $this->actingAs($other)->postJson('/customer/profile/phone/send', ['phone' => self::PHONE])->assertStatus(422);
        $this->assertCount(0, $this->sms->sent);
    }
}
