<?php

namespace App\Http\Requests\Registration;

use App\Enums\VehicleType;
use App\Support\RiderEmailProof;
use Illuminate\Support\Facades\DB;
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
        $common = $this->commonRules();

        return [
            ...$common,
            // The email must have been proven with the emailed code in this same browser session (RiderEmailOtpController).
            'email' => [
                ...$common['email'],
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! RiderEmailProof::isVerified($this->session(), (string) $value)) {
                        $fail('Verify this email with the 6-digit code we send you before submitting.');
                    }
                },
            ],
            'vehicle_type' => ['required', Rule::enum(VehicleType::class)],
            'address' => ['required', 'string', 'max:255'],
            'license_number' => ['required', 'string', 'max:50', 'regex:/^[A-Z0-9\- ]+$/', $this->uniqueIgnoringSpacesAndDashes('license_number', 'This license number is already registered.')],
            'license_expiry' => ['required', 'date', 'after:today'],
            'motorcycle_plate_number' => ['required', 'string', 'max:20', 'regex:/^[A-Z0-9\- ]+$/', $this->uniqueIgnoringSpacesAndDashes('motorcycle_plate_number', 'This plate number is already registered.')],
            // Mandatory selfie captured live with the device camera (the column stays nullable for riders registered before
            // this rule existed). Real file contents are checked: extension AND detected MIME type, never a Base64 string.
            'profile_picture' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120'],
            // Required supporting documents. Real file contents are checked (extension AND detected MIME type); administrators
            // pre-screen them online, then check the ORIGINALS in person (face-to-face verification).
            'license_document' => $this->documentRules(),
            'registration_document' => $this->documentRules(),
            'official_receipt' => $this->documentRules(),
            'nbi_clearance' => $this->documentRules(),
            'document_consent' => ['accepted'],
        ];
    }

    /**
     * "ABC 123", "ABC-123" and "ABC123" are the same plate. The value is still saved as typed (upper-case); only the
     * comparison ignores spaces and dashes, so riders registered before this rule are matched too.
     */
    private function uniqueIgnoringSpacesAndDashes(string $column, string $message): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($column, $message): void {
            $key = \App\Support\PlateNumber::normalize((string) $value);
            if ($key === '') {
                return;
            }

            $taken = DB::table('riders')
                ->whereRaw("replace(replace(upper({$column}), ' ', ''), '-', '') = ?", [$key])
                ->exists();

            if ($taken) {
                $fail($message);
            }
        };
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
            'vehicle_type.required' => 'Please choose 2 wheels (Biker) or 4 wheels (MigoCars).',
            'vehicle_type.enum' => 'Please choose 2 wheels (Biker) or 4 wheels (MigoCars).',
            'address.required' => 'Home address is required.',
            'license_number.required' => "Driver's license number is required.",
            'license_number.regex' => 'License number may only contain letters, numbers, spaces and dashes.',
            'license_number.unique' => 'This license number is already registered.',
            'license_expiry.required' => 'License expiry date is required.',
            'license_expiry.after' => 'Your license must not be expired.',
            'motorcycle_plate_number.required' => 'Plate number is required.',
            'motorcycle_plate_number.regex' => 'Plate number may only contain letters, numbers, spaces and dashes.',
            'motorcycle_plate_number.unique' => 'This plate number is already registered.',
            'profile_picture.required' => 'A profile photo is required. Open the camera and take a clear photo of your face.',
            'profile_picture.file' => 'The profile photo could not be uploaded. Please take it again.',
            'profile_picture.uploaded' => 'The profile photo could not be uploaded. Please take it again.',
            'profile_picture.image' => 'The profile photo must be an image.',
            'profile_picture.mimes' => 'The profile photo must be a JPG, PNG or WEBP file.',
            'profile_picture.mimetypes' => 'The profile photo must be a real JPG, PNG or WEBP image.',
            'profile_picture.max' => 'The profile photo must not be larger than 5 MB.',
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