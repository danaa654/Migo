<?php

namespace Database\Seeders;

use App\Enums\AccountRole;
use App\Enums\ServiceType;
use App\Models\AdminProfile;
use App\Models\Complaint;
use App\Models\Passenger;
use App\Models\Rider;
use App\Models\User;
use App\Services\Dispatch\DispatchService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Test data for manual testing: staff, customers (every sign-in type), riders (every accreditation stage),
 * bookings (every status and service) and Support Center reports (every type and status).
 *
 * Run it on a fresh database:  php artisan migrate:fresh --seed
 * Or on its own (after AdminSeeder):  php artisan db:seed --class=DemoDataSeeder
 * It skips itself when the demo accounts already exist, so it never duplicates rows.
 *
 * Every demo account uses the password below, except the passwordless customers (they sign in by code / Google).
 * Coordinates are approximate and centred on CENTER; change it to your own city if you like.
 */
class DemoDataSeeder extends Seeder
{
    public const PASSWORD = 'Password123';

    /** [latitude, longitude] used for the places below (Davao City). */
    private const PLACES = [
        ['Roxas Avenue, Davao City', 7.0690, 125.6120],
        ['SM City Davao, Ecoland', 7.0505, 125.5895],
        ['Abreeza Mall, J.P. Laurel Ave', 7.0910, 125.6125],
        ['Davao Doctors Hospital', 7.0705, 125.6130],
        ['Ateneo de Davao University', 7.0645, 125.6118],
        ['Matina Town Square', 7.0560, 125.5755],
        ['Davao International Airport', 7.1255, 125.6460],
        ['Bankerohan Public Market', 7.0680, 125.6020],
    ];

    /** @var array<string, User> */
    private array $users = [];

    /** @var array<string, Passenger> */
    private array $passengers = [];

    /** @var array<string, Rider> */
    private array $riders = [];

    /** @var array<string, AdminProfile> */
    private array $staff = [];

    /** @var list<array{booking: string, passenger: string, rider: string}> completed trips, used by the complaints */
    private array $trips = [];

    private array $credentials = [];

    public function run(): void
    {
        if (User::where('email', 'juan@migo.test')->exists()) {
            $this->command?->warn('Demo data already exists, skipping. Run migrate:fresh --seed to start over.');

            return;
        }

        mt_srand(2026); // same "random" data on every fresh run

        DB::transaction(function () {
            $this->staff();
            $this->customers();
            $this->riders();
            $this->bookings();
            $this->complaints();
        });

        $this->command?->info('Demo data created. Sign in with these accounts:');
        $this->command?->table(['Type', 'Email / phone', 'Password', 'Note'], $this->credentials);
    }

    /* ------------------------------------------------------------------ helpers */

    private function makeUser(string $name, ?string $email, AccountRole $role, bool $hasPassword = true, array $extra = []): User
    {
        $user = new User;
        $user->forceFill([
            'name' => $name,
            'email' => $email,
            'password' => $hasPassword ? self::PASSWORD : Str::random(64), // hashed by the model cast
            'has_password' => $hasPassword,
            'role' => $role->value,
            'email_verified_at' => $email ? now() : null,
        ] + $extra)->save();

        return $user;
    }

    private function cred(string $type, string $login, bool $password, string $note): void
    {
        $this->credentials[] = [$type, $login, $password ? self::PASSWORD : '(code / Google)', $note];
    }

    private function km(array $a, array $b): float
    {
        $r = 6371;
        $dLat = deg2rad($b[1] - $a[1]);
        $dLng = deg2rad($b[2] - $a[2]);
        $h = sin($dLat / 2) ** 2 + cos(deg2rad($a[1])) * cos(deg2rad($b[1])) * sin($dLng / 2) ** 2;

        return round(2 * $r * asin(sqrt($h)) * 1.3, 2); // x1.3: roads are longer than a straight line
    }

    /* ------------------------------------------------------------------ staff */

    private function staff(): void
    {
        $this->staff['super'] = AdminProfile::where('role', AdminProfile::ROLE_SUPER_ADMIN)->firstOrFail();
        $this->cred('Administrator', $this->staff['super']->email, true, 'Everything (AdminSeeder; uses ADMIN_PASSWORD from .env if set)');

        foreach ([
            ['ops', 'Olivia Operations', 'ops@migo.test', AdminProfile::ROLE_OPERATIONS, 'active', 'Riders, bookings, notifications'],
            ['support', 'Sam Support', 'support@migo.test', AdminProfile::ROLE_SUPPORT, 'active', 'Support Center + passengers (read-only)'],
            ['suspended', 'Sid Suspended', 'suspended-staff@migo.test', AdminProfile::ROLE_SUPPORT, 'suspended', 'Should NOT be able to sign in'],
        ] as [$key, $name, $email, $role, $status, $note]) {
            $user = $this->makeUser($name, $email, AccountRole::Admin);
            $this->staff[$key] = AdminProfile::create(['user_id' => $user->id, 'full_name' => $name, 'email' => $email, 'role' => $role, 'status' => $status]);
            $this->cred('Staff ('.$role.')', $email, true, $note.' - sign in at /admin/login');
        }
    }

    /* ------------------------------------------------------------------ customers */

    private function customers(): void
    {
        // key => [name, email, phone E.164|null, has_password, google_id, passenger status, note]
        $rows = [
            'juan' => ['Juan Dela Cruz', 'juan@migo.test', '+639171110001', true, null, 'active', 'Has a password + verified phone, no active booking: use for booking tests'],
            'maria' => ['Maria Santos', 'maria@migo.test', null, false, null, 'active', 'Email-code customer, NO password yet: test "Set a password" in Profile'],
            'pedro' => ['Pedro Reyes', 'pedro@migo.test', null, false, 'seed-google-0001', 'active', 'Google customer (fake google_id), no password'],
            'ana' => ['Ana Lopez', null, '+639171110004', false, null, 'active', 'Phone-only customer (SMS code), no email'],
            'newbie' => ['', null, '+639171110005', false, null, 'active', 'Brand new: no name yet, must complete profile before booking'],
            'liza' => ['Liza Garcia', 'liza@migo.test', '+639171110006', true, null, 'active', 'Has a rider assigned to her booking (rider_assigned)'],
            'jose' => ['Jose Ramos', 'jose@migo.test', '+639171110007', true, null, 'active', 'Has a trip in progress (live tracking)'],
            'suspended' => ['Sandra Suspended', 'suspended@migo.test', '+639171110008', true, null, 'suspended', 'Suspended passenger'],
            'deactivated' => ['Dante Deactivated', 'deactivated@migo.test', '+639171110009', true, null, 'deactivated', 'Deactivated passenger'],
        ];

        foreach ($rows as $key => [$name, $email, $phone, $hasPassword, $googleId, $status, $note]) {
            $user = $this->makeUser($name, $email, AccountRole::Customer, $hasPassword, [
                'google_id' => $googleId,
                'phone' => $phone,
                'phone_verified_at' => $phone ? now() : null,
            ]);
            $this->users[$key] = $user;
            $this->passengers[$key] = Passenger::create([
                'user_id' => $user->id,
                'full_name' => $name,
                'email' => $email,
                'phone' => $phone ? '0'.substr($phone, 3) : '',
                'account_status' => $status,
                'suspension_reason' => $status === 'active' ? null : 'Seeded for testing.',
            ]);
            $this->cred('Customer', $email ?? $phone, $hasPassword, $note);
        }
    }

    /* ------------------------------------------------------------------ riders */

    private function riders(): void
    {
        // key => [name, stage, vehicle, availability, note]
        // stage: pending | rejected | approved | docs | orientation_scheduled | inspection_failed | accredited | suspended
        $rows = [
            'r1' => ['Rico Pending', 'pending', 'two_wheel', null, 'Just applied: approve / reject it in Admin > Riders'],
            'r2' => ['Dodong Approved', 'approved', 'two_wheel', null, 'Application approved, documents NOT yet verified'],
            'r3' => ['Ramil Docs', 'docs', 'two_wheel', null, 'Documents verified, orientation not scheduled yet'],
            'r4' => ['Nonoy Orientation', 'orientation_scheduled', 'two_wheel', null, 'Orientation scheduled (not done yet)'],
            'r5' => ['Bong Inspection', 'inspection_failed', 'two_wheel', null, 'Orientation done, motorcycle inspection FAILED'],
            'r6' => ['Carlo Assigned', 'accredited', 'two_wheel', 'on_trip', 'Accredited, on liza\'s booking (rider_assigned): arrive / start / complete'],
            'r7' => ['Mario Ongoing', 'accredited', 'two_wheel', 'on_trip', 'Accredited, driving jose\'s trip (in_progress)'],
            'r8' => ['Ely Available', 'accredited', 'two_wheel', 'online_available', 'Accredited and ONLINE: receives new offers'],
            'r9' => ['Nelson Cars', 'accredited', 'four_wheel', 'online_available', 'Accredited 4-wheel (MigoCars) and ONLINE'],
            'r10' => ['Tonyo Offline', 'accredited', 'two_wheel', 'offline', 'Accredited but offline'],
            'r11' => ['Rey Suspended', 'suspended', 'two_wheel', 'offline', 'Suspended for 7 days after an upheld complaint'],
            'r12' => ['Rolly Rejected', 'rejected', 'two_wheel', null, 'Application rejected'],
        ];

        $admin = $this->staff['super'];
        $i = 0;

        foreach ($rows as $key => [$name, $stage, $vehicle, $availability, $note]) {
            $i++;
            $email = $key.'@migo.test';
            $user = $this->makeUser($name, $email, AccountRole::Biker);
            $approved = ! in_array($stage, ['pending', 'rejected'], true);
            $accredited = in_array($stage, ['accredited', 'suspended'], true);
            $docsDone = in_array($stage, ['docs', 'orientation_scheduled', 'inspection_failed', 'accredited', 'suspended'], true);
            $orientationDone = in_array($stage, ['inspection_failed', 'accredited', 'suspended'], true);

            $rider = Rider::unguarded(fn () => Rider::create([
                'user_id' => $user->id,
                'full_name' => $name,
                'email' => $email,
                'phone' => '0917222'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'address' => 'Purok '.$i.', Barangay Sample, Davao City',
                'license_number' => 'N03-26-'.str_pad((string) (100000 + $i), 6, '0', STR_PAD_LEFT),
                'license_expiry' => now()->addYears(2)->toDateString(),
                'motorcycle_plate_number' => 'ABC '.(1000 + $i),
                'vehicle_type' => $vehicle,
                'application_status' => $stage === 'pending' ? 'pending' : ($stage === 'rejected' ? 'rejected' : 'approved'),
                'account_status' => $stage === 'suspended' ? 'suspended' : 'active',
                'rejection_reason' => $stage === 'rejected' ? 'License photo is unreadable. Please apply again.' : null,
                'suspension_reason' => $stage === 'suspended' ? 'Suspended for 7 days after an upheld complaint.' : null,
                'reviewed_at' => $approved || $stage === 'rejected' ? now()->subDays(20) : null,
                'reviewed_by' => $approved || $stage === 'rejected' ? $admin->id : null,
                'license_document' => 'rider-documents/license.jpg',
                'registration_document' => 'rider-documents/registration.jpg',
                'official_receipt' => 'rider-documents/receipt.jpg',
                'nbi_clearance' => 'rider-documents/nbi.pdf',
                'document_verification_status' => $docsDone ? 'verified' : 'pending',
                'orientation_status' => $orientationDone ? 'completed' : ($stage === 'orientation_scheduled' ? 'scheduled' : 'pending'),
                'inspection_status' => $accredited ? 'passed' : ($stage === 'inspection_failed' ? 'failed' : 'pending'),
                'accreditation_status' => $accredited ? 'accredited' : 'not_accredited',
                'accredited_at' => $accredited ? now()->subDays(15) : null,
                'accredited_by' => $accredited ? $admin->id : null,
                'created_at' => now()->subDays(40 - $i),
                'updated_at' => now()->subDays(1),
            ]));
            $this->riders[$key] = $rider;

            $this->accreditationRecords($rider, $stage, $admin);

            if ($availability !== null) {
                $this->presence($rider, $availability, $i);
            }

            $this->cred('Rider', $email, true, $note);
        }
    }

    private function accreditationRecords(Rider $rider, string $stage, AdminProfile $admin): void
    {
        $history = fn (string $st, string $action, ?string $from, ?string $to, int $daysAgo, ?string $remarks = null) => DB::table('rider_accreditation_history')->insert([
            'rider_id' => $rider->id, 'stage' => $st, 'action' => $action, 'from_status' => $from, 'to_status' => $to,
            'actor_id' => $admin->id, 'remarks' => $remarks, 'created_at' => now()->subDays($daysAgo),
        ]);

        $history('application', $stage === 'rejected' ? 'rejected' : ($stage === 'pending' ? 'submitted' : 'approved'), 'pending', $stage === 'pending' ? 'pending' : ($stage === 'rejected' ? 'rejected' : 'approved'), 20);

        if (in_array($stage, ['docs', 'orientation_scheduled', 'inspection_failed', 'accredited', 'suspended'], true)) {
            DB::table('rider_document_verifications')->insert([
                'rider_id' => $rider->id, 'status' => 'verified',
                'documents_checked' => json_encode(['license' => true, 'registration' => true, 'receipt' => true, 'nbi' => true]),
                'verified_at' => now()->subDays(18), 'verified_by' => $admin->id, 'office_location' => 'Migo Main Office',
                'remarks' => null, 'created_at' => now()->subDays(18), 'updated_at' => now()->subDays(18),
            ]);
            $history('documents', 'documents_verified', 'pending', 'verified', 18);
        }

        if ($stage === 'orientation_scheduled') {
            DB::table('rider_orientations')->insert([
                'rider_id' => $rider->id, 'status' => 'scheduled', 'scheduled_at' => now()->addDays(3)->setTime(9, 0),
                'location' => 'Migo Main Office, Training Room', 'facilitator_id' => $admin->id, 'scheduled_by' => $admin->id,
                'created_at' => now()->subDay(), 'updated_at' => now()->subDay(),
            ]);
            $history('orientation', 'orientation_scheduled', 'pending', 'scheduled', 1);
        }

        if (in_array($stage, ['inspection_failed', 'accredited', 'suspended'], true)) {
            DB::table('rider_orientations')->insert([
                'rider_id' => $rider->id, 'status' => 'completed', 'scheduled_at' => now()->subDays(17)->setTime(9, 0),
                'location' => 'Migo Main Office, Training Room', 'facilitator_id' => $admin->id, 'scheduled_by' => $admin->id,
                'attended' => true, 'attendance_recorded_at' => now()->subDays(17), 'completed_at' => now()->subDays(17), 'completed_by' => $admin->id,
                'created_at' => now()->subDays(18), 'updated_at' => now()->subDays(17),
            ]);
            $history('orientation', 'orientation_completed', 'scheduled', 'completed', 17);

            $failed = $stage === 'inspection_failed';
            $equipment = ['rider_helmet' => true, 'passenger_helmet' => ! $failed, 'side_mirrors' => true, 'headlight' => true, 'tail_and_brake_lights' => true, 'horn' => true, 'turn_signals' => true];
            DB::table('motorcycle_inspections')->insert([
                'rider_id' => $rider->id, 'status' => $failed ? 'failed' : 'passed',
                'make' => 'Honda', 'model' => 'TMX 155', 'plate_number' => $rider->motorcycle_plate_number,
                'registration_number' => 'MV-'.random_int(100000, 999999), 'registration_expiry' => now()->addYear()->toDateString(),
                'condition' => $failed ? 'fair' : 'good', 'safety_equipment' => json_encode($equipment), 'roadworthy' => ! $failed,
                'inspected_at' => now()->subDays(16), 'inspector_id' => $admin->id,
                'findings' => $failed ? 'No passenger helmet. Please bring one and ask for a re-inspection.' : null,
                'created_at' => now()->subDays(16), 'updated_at' => now()->subDays(16),
            ]);
            $history('inspection', $failed ? 'inspection_failed' : 'inspection_passed', 'pending', $failed ? 'failed' : 'passed', 16);
        }

        if (in_array($stage, ['accredited', 'suspended'], true)) {
            $history('accreditation', 'accreditation_granted', 'not_accredited', 'accredited', 15);
        }
    }

    private function presence(Rider $rider, string $status, int $i): void
    {
        $online = $status !== 'offline';
        DB::table('rider_availability')->insert([
            'rider_id' => $rider->id, 'availability_status' => $status, 'is_online' => $online,
            'last_active_at' => $online ? now() : now()->subDay(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        // Close to the first demo place so a booking from there finds them. A fresh position only lasts about a minute
        // (location_freshness_seconds): log in as the rider and keep the dispatch page open to refresh it.
        [, $lat, $lng] = self::PLACES[0];
        DB::table('rider_locations')->insert([
            'rider_id' => $rider->id, 'latitude' => $lat + ($i % 4) * 0.002, 'longitude' => $lng + ($i % 3) * 0.002,
            'heading' => 90, 'speed' => 0, 'accuracy' => 10, 'last_location_update' => $online ? now() : now()->subDay(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    /* ------------------------------------------------------------------ bookings */

    /**
     * @param  array<string, mixed>  $a
     */
    private function booking(array $a): string
    {
        $id = (string) Str::uuid();
        $service = $a['service'] ?? ServiceType::MigoMoto;
        $from = self::PLACES[$a['from']];
        $to = self::PLACES[$a['to']];
        $km = $this->km($from, $to);
        $fare = DispatchService::fareForKm($km, $service)['total'];
        $at = $a['at'];
        $status = $a['status'];
        $passenger = $this->passengers[$a['passenger']];
        $rider = isset($a['rider']) ? $this->riders[$a['rider']] : null;
        $delivery = $service === ServiceType::MigoDala;

        DB::table('bookings')->insert([
            'id' => $id,
            'booking_reference' => 'BK-'.$at->format('ymd').'-'.Str::upper(Str::random(5)),
            'passenger_id' => $passenger->id,
            'rider_id' => $rider?->id,
            'pickup_location' => $from[0], 'destination' => $to[0],
            'pickup_lat' => $from[1], 'pickup_lng' => $from[2], 'destination_lat' => $to[1], 'destination_lng' => $to[2],
            'booking_status' => $status,
            'booking_date' => $at, 'requested_at' => $at, 'created_at' => $at, 'updated_at' => $at,
            'service_type' => $service->value,
            'passenger_count' => $delivery ? null : ($service === ServiceType::MigoCars ? 2 : 1),
            'notes' => $a['notes'] ?? null,
            'recipient_name' => $delivery ? 'Carmen Villanueva' : null,
            'recipient_phone' => $delivery ? '09171234567' : null,
            'item_description' => $delivery ? 'Documents in a brown envelope' : null,
            'package_size' => $delivery ? 'small' : null,
            'estimated_distance' => $km, 'estimated_duration' => max(3, (int) round($km * 3)), 'estimated_fare' => $fare,
            'final_fare' => $status === 'completed' ? $fare : null,
            'search_started_at' => $at, 'current_search_radius_km' => 1,
            'assigned_at' => $rider ? $at->copy()->addMinutes(1) : null,
            'arrived_at' => in_array($status, ['rider_arrived', 'in_progress', 'completed'], true) ? $at->copy()->addMinutes(6) : null,
            'started_at' => in_array($status, ['in_progress', 'completed'], true) ? $at->copy()->addMinutes(8) : null,
            'completed_at' => $status === 'completed' ? $at->copy()->addMinutes(8 + max(3, (int) round($km * 3))) : null,
            'cancelled_at' => str_starts_with($status, 'cancelled') ? $at->copy()->addMinutes(3) : null,
        ]);

        $this->bookingHistory($id, $status, $at, $passenger, $rider);

        if ($rider) {
            $this->offers($id, $rider, $at, $status);
        }

        return $id;
    }

    private function bookingHistory(string $id, string $final, $at, Passenger $passenger, ?Rider $rider): void
    {
        $steps = match ($final) {
            'completed' => [['searching_for_rider', 'system'], ['rider_assigned', 'rider'], ['rider_arrived', 'rider'], ['in_progress', 'rider'], ['completed', 'rider']],
            'in_progress' => [['searching_for_rider', 'system'], ['rider_assigned', 'rider'], ['rider_arrived', 'rider'], ['in_progress', 'rider']],
            'rider_assigned' => [['searching_for_rider', 'system'], ['rider_assigned', 'rider']],
            'cancelled_by_passenger' => [['searching_for_rider', 'system'], ['cancelled_by_passenger', 'passenger']],
            'cancelled_by_rider' => [['searching_for_rider', 'system'], ['rider_assigned', 'rider'], ['cancelled_by_rider', 'rider']],
            'no_rider_found' => [['searching_for_rider', 'system'], ['no_rider_found', 'system']],
            'expired' => [['searching_for_rider', 'system'], ['expired', 'system']],
            default => [['searching_for_rider', 'system']],
        };

        $prev = 'pending';
        foreach ($steps as $n => [$status, $actor]) {
            DB::table('booking_status_history')->insert([
                'booking_id' => $id, 'previous_status' => $prev, 'new_status' => $status,
                'changed_by' => match ($actor) {
                    'passenger' => $passenger->user_id,
                    'rider' => $rider?->user_id,
                    default => null,
                },
                'actor_type' => $actor, 'remarks' => null, 'created_at' => $at->copy()->addMinutes($n * 2),
            ]);
            $prev = $status;
        }
    }

    private function offers(string $id, Rider $rider, $at, string $status): void
    {
        DB::table('rider_booking_offers')->insert([
            'booking_id' => $id, 'rider_id' => $rider->id, 'distance_to_pickup' => random_int(300, 1800), 'estimated_pickup_time' => random_int(3, 9),
            'offer_status' => 'accepted', 'notified_at' => $at, 'expires_at' => $at->copy()->addSeconds(20), 'responded_at' => $at->copy()->addSeconds(8),
            'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    private function rate(string $id, string $passengerKey, string $riderKey, int $stars, string $comment, $at): void
    {
        DB::table('booking_ratings')->insert([
            'booking_id' => $id, 'rater_type' => 'passenger', 'rater_user_id' => $this->users[$passengerKey]->id,
            'rated_rider_id' => $this->riders[$riderKey]->id, 'rating' => $stars, 'comment' => $comment, 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    private function bookings(): void
    {
        $now = now();

        // 1) Past completed trips for the reports and the support complaints (spread over 28 days, all service types).
        $customers = ['juan', 'maria', 'pedro', 'ana', 'liza', 'jose'];
        $riderPool = ['r6', 'r7', 'r8', 'r10', 'r11']; // two-wheel riders
        $comments = [5 => 'Fast and polite, thank you!', 4 => 'Good ride.', 3 => 'Okay, a bit late.', 2 => 'Rider took a long route.'];

        for ($n = 0; $n < 16; $n++) {
            $cars = $n % 6 === 5;
            $service = $cars ? ServiceType::MigoCars : ($n % 5 === 3 ? ServiceType::MigoDala : ServiceType::MigoMoto);
            $rider = $cars ? 'r9' : $riderPool[$n % count($riderPool)];
            $passenger = $customers[$n % count($customers)];
            $at = $now->copy()->subDays((int) round(2 + $n * 1.7))->setTime(random_int(7, 20), random_int(0, 59));
            $from = $n % 8;
            $to = ($n * 3 + 2) % 8;
            if ($from === $to) {
                $to = ($to + 1) % 8;
            }

            $id = $this->booking(['status' => 'completed', 'service' => $service, 'passenger' => $passenger, 'rider' => $rider, 'from' => $from, 'to' => $to, 'at' => $at]);
            $this->trips[] = ['booking' => $id, 'passenger' => $passenger, 'rider' => $rider];

            if ($n % 3 !== 2) {
                $stars = [5, 5, 4, 4, 3, 2][$n % 6];
                $this->rate($id, $passenger, $rider, $stars, $comments[$stars], $at->copy()->addHour());
            }
        }

        // 2) Cancelled / unmatched bookings.
        $this->booking(['status' => 'cancelled_by_passenger', 'passenger' => 'juan', 'from' => 1, 'to' => 4, 'at' => $now->copy()->subDays(1)->setTime(10, 15)]);
        $this->booking(['status' => 'cancelled_by_passenger', 'passenger' => 'maria', 'rider' => 'r8', 'from' => 3, 'to' => 5, 'at' => $now->copy()->subDays(3)->setTime(18, 5), 'notes' => 'Changed my mind']);
        $this->booking(['status' => 'cancelled_by_rider', 'passenger' => 'pedro', 'rider' => 'r10', 'from' => 2, 'to' => 7, 'at' => $now->copy()->subDays(4)->setTime(8, 30)]);
        $this->booking(['status' => 'no_rider_found', 'passenger' => 'ana', 'from' => 6, 'to' => 0, 'at' => $now->copy()->subDays(2)->setTime(23, 40)]);
        $this->booking(['status' => 'expired', 'passenger' => 'juan', 'from' => 5, 'to' => 1, 'at' => $now->copy()->subDays(6)->setTime(5, 10)]);

        // 3) Active trips so the rider and live-tracking screens can be tested right away.
        $this->booking(['status' => 'rider_assigned', 'passenger' => 'liza', 'rider' => 'r6', 'from' => 0, 'to' => 2, 'at' => $now->copy()->subMinutes(4), 'notes' => 'Wait by the main gate, please.']);

        $ongoing = $this->booking(['status' => 'in_progress', 'service' => ServiceType::MigoMoto, 'passenger' => 'jose', 'rider' => 'r7', 'from' => 4, 'to' => 6, 'at' => $now->copy()->subMinutes(14)]);
        [$a, $b] = [self::PLACES[4], self::PLACES[6]];
        foreach ([0.1, 0.25, 0.4, 0.55] as $k => $t) {
            DB::table('booking_route_points')->insert([
                'booking_id' => $ongoing, 'latitude' => $a[1] + ($b[1] - $a[1]) * $t, 'longitude' => $a[2] + ($b[2] - $a[2]) * $t,
                'speed' => 28 + $k * 2, 'recorded_at' => $now->copy()->subMinutes(6 - $k),
            ]);
        }
    }

    /* ------------------------------------------------------------------ complaints / support center */

    private function complaints(): void
    {
        $support = $this->staff['support'];
        $super = $this->staff['super'];
        $now = now();

        // Pick trips by position so each report points at a different completed trip.
        $trip = fn (int $i) => $this->trips[$i];

        $seed = [
            // [type, reporter, category, status, trip, description, daysAgo, extra]
            ['complaint', 'passenger', 'unsafe_driving', 'pending', 0, 'The rider drove very fast and overtook between trucks. I was scared the whole trip.', 1, []],
            ['complaint', 'passenger', 'overcharging', 'under_investigation', 1, 'I was asked to pay more than the fare shown in the app.', 3, ['assigned_to' => $support->id]],
            ['complaint', 'passenger', 'harassment', 'resolved', 'r11', 'The rider kept asking for my number and made inappropriate comments.', 5, ['assigned_to' => $super->id, 'resolution_note' => 'Complaint upheld. The rider is suspended for 7 days.', 'penalty' => 'suspend_7']],
            ['complaint', 'passenger', 'rider_behavior', 'resolved', 'r10', 'Rider was rude when I asked him to slow down.', 5, ['assigned_to' => $support->id, 'resolution_note' => 'Upheld as a minor complaint. Written warning sent to the rider.', 'penalty' => 'warning']],
            ['complaint', 'rider', 'no_show', 'pending', 2, 'The passenger was not at the pickup point and did not answer calls.', 2, []],
            ['complaint', 'rider', 'rude_behavior', 'rejected', 3, 'The passenger complained about the route.', 6, ['assigned_to' => $support->id, 'resolution_note' => 'Not enough evidence of rude behavior. No action taken.']],
            ['support', 'passenger', 'payment_help', 'pending', null, 'How do I get a receipt for my last trip? I need it for work.', 1, []],
            ['support', 'rider', 'app_problem', 'resolved', null, 'The map froze when I tried to start a trip.', 5, ['assigned_to' => $support->id, 'resolution_note' => 'Fixed in the latest update. Please reload the page.']],
            ['incident', 'passenger', 'accident', 'pending', 4, 'The motorcycle slipped on a wet road. We both fell but nobody was badly hurt.', 0, ['occurred_at' => $now->copy()->subDays(8), 'incident_location' => 'Roxas Avenue near the overpass']],
            ['incident', 'rider', 'road_hazard', 'under_investigation', 5, 'A large pothole near the market caused a near accident.', 4, ['assigned_to' => $super->id, 'occurred_at' => $now->copy()->subDays(10), 'incident_location' => 'Bankerohan Public Market entrance']],
        ];

        foreach ($seed as [$type, $reporter, $category, $status, $tripRef, $description, $daysAgo, $extra]) {
            $at = $now->copy()->subDays($daysAgo)->subHours(random_int(0, 6));
            $t = is_int($tripRef) ? $trip($tripRef) : (is_string($tripRef) ? collect($this->trips)->first(fn ($x) => $x['rider'] === $tripRef) : null);
            $reporterProfile = $reporter === 'passenger' ? ($t ? $this->passengers[$t['passenger']] : $this->passengers['juan']) : ($t ? $this->riders[$t['rider']] : $this->riders['r8']);
            $againstType = null;
            $againstId = null;
            if ($t && $type !== 'support') {
                $againstType = $reporter === 'passenger' ? 'rider' : 'passenger';
                $againstId = $reporter === 'passenger' ? $this->riders[$t['rider']]->id : $this->passengers[$t['passenger']]->id;
            }

            $complaint = Complaint::unguarded(fn () => Complaint::create([
                'reporter_id' => $reporterProfile->id,
                'reporter_type' => $reporter,
                'report_type' => $type,
                'complaint_category' => $category,
                'description' => $description,
                'complaint_status' => $status,
                'booking_id' => $t['booking'] ?? null,
                'against_type' => $againstType,
                'against_id' => $againstId,
                'assigned_to' => $extra['assigned_to'] ?? null,
                'resolution_note' => $extra['resolution_note'] ?? null,
                'resolved_at' => in_array($status, ['resolved', 'rejected'], true) ? $at->copy()->addDays(1) : null,
                'occurred_at' => $extra['occurred_at'] ?? null,
                'incident_location' => $extra['incident_location'] ?? null,
                'created_at' => $at,
                'updated_at' => $at,
            ]));

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(), 'admin_id' => null, 'action' => 'complaint.filed', 'description' => null,
                'subject_type' => 'complaint', 'subject_id' => $complaint->id, 'created_at' => $at,
            ]);

            // Administrator notification feed (user_id NULL), unread while the report is still pending.
            $noun = $type === 'support' ? 'support request' : ($type === 'incident' ? 'incident report' : 'complaint');
            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(),
                'title' => $type === 'incident' ? 'New incident report (safety)' : 'New '.$noun,
                'message' => ($reporterProfile->full_name ?: 'A '.$reporter).' sent a '.$noun.'.',
                'notification_type' => $type.'_filed',
                'data' => json_encode(['url' => '/admin/complaints/'.$complaint->id]),
                'is_read' => $status !== 'pending', 'created_at' => $at,
            ]);

            if (isset($extra['penalty']) && $againstType === 'rider') {
                $this->penalty($complaint, $againstId, $extra['penalty'], $category, $super);
            }
        }
    }

    private function penalty(Complaint $complaint, string $riderId, string $action, string $category, AdminProfile $by): void
    {
        $serious = in_array($category, ['harassment', 'unsafe_driving'], true);
        $createdAt = $complaint->resolved_at ?? now();
        $suspends = $action === 'suspend_7';
        $reason = 'Suspended for 7 days after an upheld complaint.'; // same text as riders.suspension_reason of the suspended rider

        DB::table('complaint_penalties')->insert([
            'id' => (string) Str::uuid(), 'complaint_id' => $complaint->id, 'subject_type' => 'rider', 'subject_id' => $riderId,
            'severity' => $serious ? 'serious' : 'minor', 'points' => $serious ? 3 : 1, 'action' => $action,
            'suspension_ends_at' => $suspends ? now()->addDays(3) : null, 'suspension_lifted_at' => null,
            'suspension_reason' => $suspends ? $reason : null,
            'expires_at' => $createdAt->copy()->addDays(90), 'decided_by' => $by->id, 'created_at' => $createdAt,
        ]);

        DB::table('audit_logs')->insert([
            'id' => (string) Str::uuid(), 'admin_id' => $by->id, 'action' => 'complaint.penalty_applied', 'description' => $action,
            'subject_type' => 'complaint', 'subject_id' => $complaint->id, 'created_at' => $createdAt,
        ]);
    }
}