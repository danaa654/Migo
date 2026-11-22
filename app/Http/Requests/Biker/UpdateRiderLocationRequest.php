<?php

namespace App\Http\Requests\Biker;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRiderLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the route is already limited to accredited bikers
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'heading' => ['nullable', 'numeric', 'between:0,360'],
            'speed' => ['nullable', 'numeric', 'min:0', 'max:400'],
        ];
    }
}
