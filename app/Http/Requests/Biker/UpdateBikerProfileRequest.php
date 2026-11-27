<?php

namespace App\Http\Requests\Biker;

use Illuminate\Foundation\Http\FormRequest;

/** Only contact details can be edited. Name, plate, licence and vehicle belong to the accreditation record. */
class UpdateBikerProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Same normalisation as registration: "+63 917 123 4567" and "0917-123-4567" both become 09171234567.
        $phone = preg_replace('/[\s\-().]/', '', (string) $this->input('phone')) ?? '';
        $this->merge([
            'phone' => str_starts_with($phone, '+63') ? '0'.substr($phone, 3) : $phone,
            'address' => trim((string) $this->input('address')),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'regex:/^09\d{9}$/'],
            'address' => ['required', 'string', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'phone.required' => 'Contact number is required.',
            'phone.regex' => 'Contact number must be exactly 11 digits and start with 09, for example 09171234567.',
            'address.required' => 'Address is required.',
            'address.max' => 'Address must not be longer than 255 characters.',
        ];
    }
}