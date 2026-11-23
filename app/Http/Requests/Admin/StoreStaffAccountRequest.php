<?php

namespace App\Http\Requests\Admin;

use App\Models\AdminProfile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Only an Administrator may create staff accounts, and only the two staff types in AdminProfile::CREATABLE_ROLES. */
class StoreStaffAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canAccessAdminArea('staff') === true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'full_name' => trim((string) $this->input('full_name')),
            'email' => Str::lower(trim((string) $this->input('email'))),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email:rfc', 'max:254', Rule::unique('users', 'email'), Rule::unique('admin_profiles', 'email')],
            'role' => ['required', Rule::in(AdminProfile::CREATABLE_ROLES)],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'full_name.required' => 'Enter the staff member\'s full name.',
            'email.required' => 'Enter the staff member\'s email address.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'This email already has an account.',
            'role.required' => 'Choose a role.',
            'role.in' => 'You can only create Operations Admin or Support Staff accounts.',
        ];
    }
}
