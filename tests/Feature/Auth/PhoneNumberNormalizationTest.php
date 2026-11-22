<?php

namespace Tests\Feature\Auth;

use App\Support\PhilippinePhone;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PhoneNumberNormalizationTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function validNumbers(): array
    {
        return [
            'local 09' => ['09171234567'],
            'no leading zero' => ['9171234567'],
            'international' => ['+639171234567'],
            'spaces' => ['0917 123 4567'],
            'dashes and plus' => ['+63 917-123-4567'],
            'brackets and dots' => ['(0917) 123.4567'],
        ];
    }

    #[DataProvider('validNumbers')]
    public function test_valid_numbers_become_e164(string $input): void
    {
        $this->assertSame('+639171234567', PhilippinePhone::normalize($input));
    }

    /** @return array<string, array{string}> */
    public static function invalidNumbers(): array
    {
        return [
            'empty' => [''],
            'too short' => ['12345'],
            'landline style' => ['028123456'],
            'not a mobile prefix' => ['08171234567'],
            'truncated international' => ['+639171234'],
            'other country' => ['+14155552671'],
            '63 without plus' => ['639171234567'],
            'too long' => ['091712345678'],
            'letters' => ['abcdefghijk'],
        ];
    }

    #[DataProvider('invalidNumbers')]
    public function test_everything_else_is_rejected(string $input): void
    {
        $this->assertNull(PhilippinePhone::normalize($input));
    }

    public function test_local_and_variants_helpers(): void
    {
        $this->assertSame('09171234567', PhilippinePhone::toLocal('+639171234567'));
        $this->assertContains('09171234567', PhilippinePhone::variants('+639171234567'));
        $this->assertSame('+63 917 123 4567', PhilippinePhone::format('+639171234567'));
    }

    public function test_the_send_endpoint_rejects_an_invalid_number_with_a_clear_message(): void
    {
        $this->postJson('/auth/otp/send', ['phone' => '12345'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }
}
