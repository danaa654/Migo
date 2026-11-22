<?php

namespace Database\Factories;

use App\Models\Rider;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Rider> */
class RiderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => null,
            'full_name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '09'.fake()->numerify('#########'),
            'address' => fake()->address(),
            'license_number' => 'LIC-'.Str::upper(Str::random(8)),
            'license_expiry' => now()->addYear()->toDateString(),
            'motorcycle_plate_number' => 'PLT-'.Str::upper(Str::random(6)),
            'vehicle_type' => 'two_wheel',
            'application_status' => 'pending',
            'account_status' => 'active',
            'document_verification_status' => 'pending',
            'orientation_status' => 'pending',
            'inspection_status' => 'pending',
            'accreditation_status' => 'not_accredited',
            'license_document' => 'rider-documents/license.jpg',
            'registration_document' => 'rider-documents/registration.jpg',
            'official_receipt' => 'rider-documents/receipt.jpg',
            'nbi_clearance' => 'rider-documents/nbi.pdf',
        ];
    }

    /** Also creates the linked biker account (users row) so the rider can sign in. */
    public function withUser(): static
    {
        return $this->state(function () {
            $user = User::factory()->biker()->create();

            return ['user_id' => $user->id, 'full_name' => $user->name, 'email' => $user->email];
        });
    }

    /** A legacy / incomplete application with no uploads (cannot be approved online). */
    public function withoutDocuments(): static
    {
        return $this->state(['license_document' => null, 'registration_document' => null, 'official_receipt' => null, 'nbi_clearance' => null]);
    }

    public function approved(): static
    {
        return $this->state(['application_status' => 'approved']);
    }

    /** Statuses only (no stage records): use the accreditation endpoints/service to build real history. */
    public function accredited(): static
    {
        return $this->approved()->state([
            'document_verification_status' => 'verified', 'orientation_status' => 'completed',
            'inspection_status' => 'passed', 'accreditation_status' => 'accredited', 'accredited_at' => now(),
        ]);
    }

    public function rejected(string $reason = 'Documents are unclear.'): static
    {
        return $this->state(['application_status' => 'rejected', 'rejection_reason' => $reason]);
    }

    public function suspended(string $reason = 'Policy violation.'): static
    {
        return $this->state(['account_status' => 'suspended', 'suspension_reason' => $reason]);
    }
}
