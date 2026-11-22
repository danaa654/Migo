<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Only an ACTIVE administrator can submit this (server-side); the service re-checks staff and workflow rules. */
class RecordDocumentVerificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isActiveAdmin() === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['pending', 'verified', 'failed'])],
            'documents_checked' => ['nullable', 'array'],
            'documents_checked.*' => ['boolean'],
            'verified_on' => ['nullable', 'date', 'before_or_equal:now'],
            'office_location' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
