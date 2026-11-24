<?php

namespace App\Http\Requests\Admin;

use App\Services\Complaints\ComplaintPenaltyService;
use Illuminate\Validation\Rule;

/** Resolve = a resolution note plus a finding. An upheld complaint also needs a severity and an action. */
class ResolveComplaintRequest extends SuspendRiderRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'finding' => ['required', Rule::in(['upheld', 'not_upheld'])],
            'severity' => ['required_if:finding,upheld', 'nullable', Rule::in(array_keys(ComplaintPenaltyService::POINTS))],
            'action' => ['required_if:finding,upheld', 'nullable', Rule::in(array_keys(ComplaintPenaltyService::ACTIONS))],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'finding.required' => 'Choose whether the complaint is upheld or not.',
            'finding.in' => 'Choose whether the complaint is upheld or not.',
            'severity.required_if' => 'Choose how serious the violation is.',
            'action.required_if' => 'Choose the action to take.',
        ];
    }
}
