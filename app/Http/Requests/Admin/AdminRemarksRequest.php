<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Only an ACTIVE administrator can submit this (server-side); the service re-checks staff and workflow rules. */
class AdminRemarksRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isActiveAdmin() === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'remarks' => ['required', 'string', 'min:2', 'max:2000'],
        ];
    }
}
