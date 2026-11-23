<?php

namespace App\Http\Controllers\Registration;

use App\Enums\AccountRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Registration\RegisterBikerRequest;
use App\Models\Rider;
use App\Models\User;
use App\Support\RiderEmailProof;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class BikerRegistrationController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('auth/register-biker');
    }

    public function store(RegisterBikerRequest $request): RedirectResponse
    {
        $data = $request->validated();
        // Required live selfie (validated as a real JPG/PNG/WEBP, max 5 MB). Stored as a file under a random name; only the
        // path is saved in the rider's record. It belongs to the Rider row created below for this same registration.
        $photo = $request->file('profile_picture')->store('rider-photos', 'public');
        // Verification documents are private: stored on the "local" disk and only served to administrators.
        $documents = [];
        foreach (['license_document', 'registration_document', 'official_receipt', 'nbi_clearance'] as $field) {
            $documents[$field] = $request->file($field)?->store('rider-documents', 'local');
        }

        try {
            DB::transaction(function () use ($data, $photo, $documents) {
                $user = (new User([
                    'name' => $data['full_name'],
                    'email' => $data['email'],
                    'password' => $data['password'], // hashed by the User model cast
                ]))->forceFill(['role' => AccountRole::Biker->value, 'email_verified_at' => now()]); // email proven by the emailed code
                $user->save();

                // Every new biker starts as "pending" until an administrator approves the application.
                Rider::create([
                    'user_id' => $user->id,
                    'full_name' => $data['full_name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'address' => $data['address'],
                    'profile_picture' => $photo,
                    'license_number' => $data['license_number'],
                    'license_expiry' => $data['license_expiry'],
                    'motorcycle_plate_number' => $data['motorcycle_plate_number'],
                    'vehicle_type' => $data['vehicle_type'],
                    'application_status' => 'pending',
                    ...$documents,
                ]);
            });
        } catch (Throwable $e) {
            if ($photo) {
                Storage::disk('public')->delete($photo);
            }
            Storage::disk('local')->delete(array_filter($documents));

            if ($e instanceof UniqueConstraintViolationException) {
                return back()->withInput($request->except('password', 'password_confirmation', 'profile_picture'))
                    ->withErrors(['email' => 'This email, license number or plate number is already registered.']);
            }

            throw $e;
        }

        RiderEmailProof::forget($request->session());

        return redirect('/login')->with(
            'status',
            'Application submitted. You can sign in now, but you can accept service requests only after an administrator approves your application and you complete face-to-face verification, orientation, motorcycle inspection and final accreditation.',
        );
    }
}
