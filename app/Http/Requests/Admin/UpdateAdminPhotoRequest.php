<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAdminPhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the route is already behind EnsureActiveAdmin
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        // Real file contents are checked (extension AND detected MIME type).
        return [
            'avatar' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'avatar.required' => 'Choose a photo first.',
            'avatar.file' => 'The photo could not be uploaded. Please try again.',
            'avatar.uploaded' => 'The photo could not be uploaded. Please try again.',
            'avatar.image' => 'The photo must be an image.',
            'avatar.mimes' => 'The photo must be a JPG, PNG or WEBP file.',
            'avatar.mimetypes' => 'The photo must be a real JPG, PNG or WEBP image.',
            'avatar.max' => 'The photo must not be larger than 5 MB.',
        ];
    }
}
