<?php

namespace App\Http\Requests\Customer;

use App\Concerns\PasswordValidationRules;
use Illuminate\Foundation\Http\FormRequest;

/** First password for a signed-in customer who has none yet (no current password to confirm). */
class SetCustomerPasswordRequest extends FormRequest
{
    use PasswordValidationRules;

    public function authorize(): bool
    {
        return true; // the controller checks User::canSetPassword()
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'password' => $this->passwordRules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'password.required' => 'Password is required.',
            'password.confirmed' => 'Password and confirmation do not match.',
        ];
    }
}