<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Only an ACTIVE administrator can submit this (server-side); the service re-checks staff and workflow rules. */
class ScheduleOrientationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isActiveAdmin() === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'scheduled_at' => ['required', 'date', 'after:now'],
            'location' => ['required', 'string', 'max:255'],
            'facilitator_id' => ['required', 'uuid', 'exists:admin_profiles,id'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
