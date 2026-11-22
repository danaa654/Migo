<?php

namespace App\Http\Requests\Registration;

use App\Enums\VehicleType;
use Illuminate\Validation\Rule;

class RegisterBikerRequest extends RegistrationRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        $this->merge([
            'address' => trim((string) $this->input('address')),
            'license_number' => strtoupper(trim((string) $this->input('license_number'))),
            'motorcycle_plate_number' => strtoupper(trim((string) $this->input('motorcycle_plate_number'))),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            ...$this->commonRules(),
            'vehicle_type' => ['required', Rule::enum(VehicleType::class)],
            'address' => ['required', 'string', 'max:255'],
            'license_number' => ['required', 'string', 'max:50', 'regex:/^[A-Z0-9\- ]+$/', Rule::unique('riders', 'license_number')],
            'license_expiry' => ['required', 'date', 'after:today'],
            'motorcycle_plate_number' => ['required', 'string', 'max:20', 'regex:/^[A-Z0-9\- ]+$/', Rule::unique('riders', 'motorcycle_plate_number')],
            'profile_picture' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            // Required supporting documents. Real file contents are checked (extension AND detected MIME type); administrators
            // pre-screen them online, then check the ORIGINALS in person (face-to-face verification).
            'license_document' => $this->documentRules(),
            'registration_document' => $this->documentRules(),
            'official_receipt' => $this->documentRules(),
            'nbi_clearance' => $this->documentRules(),
            'document_consent' => ['accepted'],
        ];
    }

    /** @return list<string> */
    private function documentRules(): array
    {
        return ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'mimetypes:image/jpeg,image/png,application/pdf', 'max:5120'];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'vehicle_type.required' => 'Please choose 2 wheels (Biker) or 4 wheels (Angcars).',
            'vehicle_type.enum' => 'Please choose 2 wheels (Biker) or 4 wheels (Angcars).',
            'address.required' => 'Home address is required.',
            'license_number.required' => "Driver's license number is required.",
            'license_number.regex' => 'License number may only contain letters, numbers, spaces and dashes.',
            'license_number.unique' => 'This license number is already registered.',
            'license_expiry.required' => 'License expiry date is required.',
            'license_expiry.after' => 'Your license must not be expired.',
            'motorcycle_plate_number.required' => 'Plate number is required.',
            'motorcycle_plate_number.regex' => 'Plate number may only contain letters, numbers, spaces and dashes.',
            'motorcycle_plate_number.unique' => 'This plate number is already registered.',
            'profile_picture.image' => 'The profile photo must be an image.',
            'profile_picture.mimes' => 'The profile photo must be a JPG or PNG file.',
            'profile_picture.max' => 'The profile photo must not be larger than 2 MB.',
            'license_document.required' => "Upload your driver's license (photo or scan).",
            'registration_document.required' => 'Upload your motorcycle registration (OR/CR) or the allowed alternative document.',
            'official_receipt.required' => 'Upload your official receipt.',
            'nbi_clearance.required' => 'Upload your NBI Clearance (or NBI receipt with a Barangay or Police Clearance, combined in one PDF).',
            'nbi_clearance.mimes' => 'The NBI clearance file must be a JPG, PNG or PDF.',
            'nbi_clearance.mimetypes' => 'The NBI clearance file must be a real JPG, PNG or PDF.',
            'nbi_clearance.max' => 'The NBI clearance file must not be larger than 5 MB.',
            'license_document.mimetypes' => "The driver's license file must be a real JPG, PNG or PDF.",
            'registration_document.mimetypes' => 'The registration file must be a real JPG, PNG or PDF.',
            'official_receipt.mimetypes' => 'The official receipt file must be a real JPG, PNG or PDF.',
            'document_consent.accepted' => 'You must consent to Migo collecting and storing your documents to apply.',
            'license_document.mimes' => "The driver's license file must be a JPG, PNG or PDF.",
            'registration_document.mimes' => 'The registration file must be a JPG, PNG or PDF.',
            'official_receipt.mimes' => 'The official receipt file must be a JPG, PNG or PDF.',
            'license_document.max' => "The driver's license file must not be larger than 5 MB.",
            'registration_document.max' => 'The registration file must not be larger than 5 MB.',
            'official_receipt.max' => 'The official receipt file must not be larger than 5 MB.',
        ];
    }
}
