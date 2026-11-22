<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

/** Full name only. The phone changes only through the SMS-code flow; the email is a sign-in identity. */
class UpdateCustomerProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'full_name' => preg_replace('/\s+/u', ' ', trim((string) $this->input('full_name'))),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'full_name' => [
                'required', 'string', 'max:255', "regex:/^[\p{L}][\p{L}\p{M}.'’\- ]*$/u",
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $words = array_filter(explode(' ', (string) $value), fn ($w) => mb_strlen(str_replace(['.', "'", '’', '-'], '', $w)) >= 2);
                    if (count($words) < 2) {
                        $fail('Enter your full name: first name and last name.');
                    }
                },
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'full_name.required' => 'Full name is required.',
            'full_name.regex' => 'Full name may only contain letters, spaces, periods, apostrophes and hyphens.',
        ];
    }
}
