<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Only an ACTIVE administrator can submit this (server-side); the service re-checks staff and workflow rules. */
class RecordOrientationResultRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isActiveAdmin() === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'attended' => ['required', 'boolean'],
            'result' => ['required', Rule::in(['completed', 'failed'])],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
