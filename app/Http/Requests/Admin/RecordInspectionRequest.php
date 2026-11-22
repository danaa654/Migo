<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Only an ACTIVE administrator can submit this (server-side); the service re-checks staff and workflow rules. */
class RecordInspectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isActiveAdmin() === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['pending', 'passed', 'failed'])],
            'make' => ['required', 'string', 'max:60'],
            'model' => ['required', 'string', 'max:60'],
            'plate_number' => ['required', 'string', 'max:30'],
            'registration_number' => ['required', 'string', 'max:60'],
            'registration_expiry' => ['required', 'date'],
            'condition' => ['required', Rule::in(['excellent', 'good', 'fair', 'poor'])],
            'safety_equipment' => ['required', 'array'],
            'safety_equipment.*' => ['boolean'],
            'roadworthy' => ['required', 'boolean'],
            'inspected_on' => ['nullable', 'date', 'before_or_equal:now'],
            'inspector_id' => ['nullable', 'uuid', 'exists:admin_profiles,id'],
            'findings' => ['nullable', 'string', 'max:3000'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
