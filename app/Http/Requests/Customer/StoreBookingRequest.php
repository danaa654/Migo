<?php

namespace App\Http\Requests\Customer;

use App\Enums\ServiceType;
use App\Support\PhilippinePhone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $clean = fn (string $key) => preg_replace('/\s+/u', ' ', trim((string) $this->input($key)));
        $notes = $clean('notes');

        $this->merge([
            // A request without a service is a MigoMoto ride (the original behaviour).
            'service_type' => $this->filled('service_type') ? strtoupper(trim((string) $this->input('service_type'))) : ServiceType::MigoMoto->value,
            'notes' => $notes === '' ? null : $notes,
            'recipient_name' => $clean('recipient_name'),
            'item_description' => $clean('item_description'),
            'pickup_location' => preg_replace('/\s+/u', ' ', trim((string) $this->input('pickup_location'))),
            'destination' => preg_replace('/\s+/u', ' ', trim((string) $this->input('destination'))),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $service = ServiceType::tryFrom((string) $this->input('service_type'));
        $delivery = $service?->isDelivery() ?? false;
        $max = $service?->maxPassengers() ?? 1;

        return [
            'service_type' => ['required', Rule::enum(ServiceType::class)],
            // Rides: how many people. A delivery has no passengers.
            'passenger_count' => $delivery ? ['nullable'] : ['required', 'integer', 'min:1', 'max:'.$max],
            'notes' => ['nullable', 'string', 'max:300'],
            // Deliveries (MigoDala): who receives it and what is being sent.
            'recipient_name' => $delivery ? ['required', 'string', 'min:2', 'max:120'] : ['nullable'],
            'recipient_phone' => $delivery
                ? ['required', 'string', fn ($a, $v, $fail) => PhilippinePhone::normalize((string) $v) === null ? $fail('Enter a valid Philippine mobile number, for example 0917 123 4567.') : null]
                : ['nullable'],
            'item_description' => $delivery ? ['required', 'string', 'min:3', 'max:255'] : ['nullable'],
            'package_size' => $delivery ? ['required', Rule::in(array_keys(ServiceType::PACKAGE_SIZES))] : ['nullable'],
            'pickup_location' => ['required', 'string', 'min:5', 'max:255'],
            'destination' => ['required', 'string', 'min:5', 'max:255', 'different:pickup_location'],
            // The pickup point is REQUIRED: riders are matched by distance to it. The destination pin is REQUIRED too: the fare is calculated from it and shown before the customer confirms.
            'pickup_lat' => ['required', 'numeric', 'between:-90,90'],
            'pickup_lng' => ['required', 'numeric', 'between:-180,180'],
            'destination_lat' => ['required', 'numeric', 'between:-90,90'],
            'destination_lng' => ['required', 'numeric', 'between:-180,180'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'service_type.required' => 'Choose MigoMoto, MigoCars or MigoDala.',
            'service_type.enum' => 'Choose MigoMoto, MigoCars or MigoDala.',
            'passenger_count.required' => 'Enter the number of passengers.',
            'passenger_count.integer' => 'Passengers must be a whole number.',
            'passenger_count.min' => 'At least 1 passenger is needed.',
            'passenger_count.max' => 'This service cannot carry that many passengers (maximum :max).',
            'recipient_name.required' => 'Enter the recipient\'s name.',
            'recipient_name.min' => 'Enter the recipient\'s full name.',
            'recipient_phone.required' => 'Enter the recipient\'s contact number.',
            'item_description.required' => 'Describe what is being delivered.',
            'item_description.min' => 'Describe the item in a few words.',
            'package_size.required' => 'Choose the package size.',
            'package_size.in' => 'Choose the package size.',
            'pickup_location.required' => 'Enter your pickup location.',
            'pickup_location.min' => 'Pickup location is too short. Add a street, barangay or landmark.',
            'destination.required' => 'Enter your destination.',
            'destination.min' => 'Destination is too short. Add a street, barangay or landmark.',
            'destination.different' => 'Destination must be different from the pickup location.',
            'destination_lat.required' => 'Pin your destination on the map so we can show your fare.',
            'destination_lng.required' => 'Pin your destination on the map so we can show your fare.',
            'pickup_lat.required' => 'Pin your pickup point on the map so we can find nearby riders.',
            'pickup_lng.required' => 'Pin your pickup point on the map so we can find nearby riders.',
        ];
    }
}
