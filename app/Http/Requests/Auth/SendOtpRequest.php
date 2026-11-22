<?php

namespace App\Http\Requests\Auth;

use App\Support\PhilippinePhone;
use Illuminate\Foundation\Http\FormRequest;

class SendOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'phone' => [
                'required', 'string', 'max:30',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (PhilippinePhone::normalize((string) $value) === null) {
                        $fail('Hindi valid ang number. Gamitin ang 09171234567, 9171234567 o +639171234567.');
                    }
                },
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['phone.required' => 'Ilagay ang mobile number mo.'];
    }

    /** The validated number in E.164. */
    public function e164(): string
    {
        return PhilippinePhone::normalize((string) $this->validated('phone'));
    }
}
