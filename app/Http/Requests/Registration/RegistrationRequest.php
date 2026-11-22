<?php

namespace App\Http\Requests\Registration;

use App\Concerns\PasswordValidationRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Rules shared by Customer and Biker registration. Role is never read from the request. */
abstract class RegistrationRequest extends FormRequest
{
    use PasswordValidationRules;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'full_name' => preg_replace('/\s+/u', ' ', trim((string) $this->input('full_name'))),
            'email' => Str::lower(trim((string) $this->input('email'))),
            'phone' => $this->normalizePhone((string) $this->input('phone')),
        ]);
    }

    /** Strips spaces and punctuation; a leading +63 is written as 0 so the stored format is always 09XXXXXXXXX. */
    private function normalizePhone(string $phone): string
    {
        $phone = preg_replace('/[\s\-().]/', '', $phone) ?? '';

        return str_starts_with($phone, '+63') ? '0'.substr($phone, 3) : $phone;
    }

    /** @return array<string, mixed> */
    protected function commonRules(): array
    {
        return [
            // A FULL name: letters only (plus space . ' - and accents) with at least a first and a last name.
            'full_name' => [
                'required', 'string', 'max:255', "regex:/^[\p{L}][\p{L}\p{M}.'’\- ]*$/u",
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $words = array_filter(explode(' ', (string) $value), fn ($w) => mb_strlen(str_replace(['.', "'", '’', '-'], '', $w)) >= 2);
                    if (count($words) < 2) {
                        $fail('Enter your full name: first name and last name.');
                    }
                },
            ],
            // An email may belong to only one account/profile anywhere in the system.
            'email' => [
                'required', 'string', 'email:rfc', 'max:255',
                Rule::unique('users', 'email'),
                Rule::unique('riders', 'email'),
                Rule::unique('passengers', 'email'),
            ],
            'phone' => ['required', 'string', 'regex:/^09\d{9}$/'],
            'password' => $this->passwordRules(),
            'terms' => ['accepted'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'full_name.required' => 'Full name is required.',
            'full_name.regex' => 'Full name may only contain letters, spaces, periods, apostrophes and hyphens.',
            'email.required' => 'Email address is required.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'This email address is already registered.',
            'phone.required' => 'Contact number is required.',
            'phone.regex' => 'Contact number must be exactly 11 digits and start with 09, for example 09171234567.',
            'password.required' => 'Password is required.',
            'password.confirmed' => 'Password and confirm password do not match.',
            'terms.accepted' => 'You must agree to the Terms and Conditions to register.',
        ];
    }
}
