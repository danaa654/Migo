<?php

use App\Http\Controllers\Admin\DispatchMonitorController;
use App\Http\Controllers\Admin\DispatchSettingsController;
use App\Http\Controllers\Admin\PassengerManagementController;
use App\Http\Controllers\Admin\RiderAccreditationController;
use App\Http\Controllers\Admin\RiderManagementController;
use App\Http\Controllers\Admin\StaffAccountController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\BikerAccreditationController;
use App\Http\Controllers\BikerDashboardController;
use App\Http\Controllers\BikerServiceRequestController;
use App\Http\Controllers\CustomerAuth\CustomerPhoneController;
use App\Http\Controllers\CustomerAuth\EmailOtpController;
use App\Http\Controllers\CustomerAuth\GoogleController;
use App\Http\Controllers\CustomerAuth\PhoneOtpController;
use App\Http\Controllers\CustomerBookingController;
use App\Http\Controllers\CustomerDashboardController;
use App\Http\Controllers\CustomerProfileController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Registration\BikerRegistrationController;
use App\Http\Controllers\Registration\RiderEmailOtpController;
use App\Http\Controllers\RiderDispatchController;
use App\Http\Controllers\Teams\TeamInvitationController;
use App\Http\Middleware\EnsureActiveAdmin;
use App\Http\Middleware\EnsureTeamMembership;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::inertia('/', 'welcome')->name('home');

// Public information pages linked from the welcome page footer.
Route::inertia('privacy', 'legal', ['page' => 'privacy'])->name('legal.privacy');
Route::inertia('terms', 'legal', ['page' => 'terms'])->name('legal.terms');

// Public login. GET /login (Customer: Google / phone OTP, Rider: email + password) and POST /login are served by Fortify.
// The account type is never chosen by the user: it comes from users.role, and the response redirects
// to the matching dashboard (see App\Http\Responses\LoginResponse).
// Old bookmarks from the three-card login keep working by redirecting to the new pages.
Route::redirect('login/customer', '/login');
Route::redirect('login/biker', '/login');
Route::redirect('login/admin', '/admin/login');

// Dedicated administrator login (reached from the footer "Admin Login" link). It posts to Fortify's POST /login
// with portal=admin, where only ACTIVE administrators are accepted. There is intentionally no admin registration.
Route::middleware('guest')->get('admin/login', fn (Request $request) => Inertia::render('auth/admin-login', [
    'status' => $request->session()->get('status'),
]))->name('admin.login');

// Customer sign-in (no registration form): Google OAuth, phone number + SMS one-time code, or email + emailed one-time code. The first successful
// sign-in creates the customer account; the role is fixed on the server. Riders and admins keep email + password.
Route::middleware('guest')->prefix('auth')->group(function () {
    Route::get('google/redirect', [GoogleController::class, 'redirect'])->middleware('throttle:20,1')->name('auth.google.redirect');
    Route::get('google/callback', [GoogleController::class, 'callback'])->middleware('throttle:20,1')->name('auth.google.callback');
    Route::post('otp/send', [PhoneOtpController::class, 'send'])->middleware('throttle:30,1')->name('auth.otp.send');
    Route::post('otp/verify', [PhoneOtpController::class, 'verify'])->middleware('throttle:20,1')->name('auth.otp.verify');
    Route::post('email-otp/send', [EmailOtpController::class, 'send'])->middleware('throttle:30,1')->name('auth.email-otp.send');
    Route::post('email-otp/verify', [EmailOtpController::class, 'verify'])->middleware('throttle:20,1')->name('auth.email-otp.verify');
});

// Registration is for riders/drivers only. There is deliberately no administrator registration and no customer
// registration: the role is fixed by the controller on the server and is never read from the request.
// /register still works and goes straight to the rider form.
Route::middleware('guest')->group(function () {
    Route::redirect('register', '/register/biker')->name('register');

    Route::get('register/biker', [BikerRegistrationController::class, 'create'])->name('register.biker');
    Route::post('register/biker', [BikerRegistrationController::class, 'store'])->middleware('throttle:10,1')->name('register.biker.store');

    // Rider registration: the applicant must prove the email with an emailed code before the form can be submitted.
    Route::post('register/biker/email-otp/send', [RiderEmailOtpController::class, 'send'])->middleware('throttle:30,1')->name('register.biker.email-otp.send');
    Route::post('register/biker/email-otp/verify', [RiderEmailOtpController::class, 'verify'])->middleware('throttle:20,1')->name('register.biker.email-otp.verify');
});

// Public booking page: guests can plan a ride (map, pickup, destination, distance). They sign in only when they
// press "Sign in to book"; after Google / phone sign-in they come back here (see App\Support\BookingResume).
Route::get('book', [CustomerBookingController::class, 'guest'])->name('book.guest');

// Fare quote shown before the customer confirms (public, read-only, nothing is saved).
Route::get('book/quote', [CustomerBookingController::class, 'quote'])->middleware('throttle:60,1')->name('book.quote');

// Generic entry point (also Fortify's "home"): sends any signed-in user to the dashboard for their role.
Route::middleware('auth')->get('dashboard', fn (Request $request) => redirect($request->user()->dashboardPath()));

// Customer and Biker dashboards. Role is enforced on the server by the "role" middleware.
// These are declared before the legacy {current_team}/dashboard route so they are matched first.
Route::middleware(['auth', 'role:customer'])->prefix('customer')->group(function () {
    // First-time phone customers must save their full name before they can use anything below (customer.profile).
    Route::middleware('customer.profile')->group(function () {
        Route::get('dashboard', CustomerDashboardController::class)->name('customer.dashboard');

        // Bookings: book a ride, see my bookings, cancel a pending booking. Always scoped to the signed-in customer.
        Route::get('book', [CustomerBookingController::class, 'create'])->name('customer.book');
        Route::get('bookings', [CustomerBookingController::class, 'index'])->name('customer.bookings');
        Route::post('bookings', [CustomerBookingController::class, 'store'])->middleware('throttle:20,1')->name('customer.bookings.store');
        Route::post('bookings/{booking}/cancel', [CustomerBookingController::class, 'cancel'])->name('customer.bookings.cancel');

        // Ride status page (searching -> rider found -> live tracking -> completed). Always scoped to the signed-in customer.
        Route::get('ride/{booking}', [CustomerBookingController::class, 'show'])->name('customer.ride');
        Route::get('ride/{booking}/live', [CustomerBookingController::class, 'live'])->middleware('throttle:90,1')->name('customer.ride.live');
        Route::post('bookings/{booking}/retry', [CustomerBookingController::class, 'retry'])->middleware('throttle:10,1')->name('customer.bookings.retry');
        Route::post('bookings/{booking}/rate', [CustomerBookingController::class, 'rate'])->middleware('throttle:10,1')->name('customer.bookings.rate');
    });

    // The customer's own profile: full name, sign-in methods, phone (verified by SMS code) and, for password accounts, password.
    Route::get('profile', [CustomerProfileController::class, 'edit'])->name('customer.profile');
    Route::patch('profile', [CustomerProfileController::class, 'update'])->name('customer.profile.update');
    Route::put('profile/password', [CustomerProfileController::class, 'updatePassword'])->name('customer.profile.password');

    // Add or confirm the phone number with an SMS code (same OTP engine as the login).
    Route::post('profile/phone/send', [CustomerPhoneController::class, 'send'])->middleware('throttle:20,1')->name('customer.profile.phone.send');
    Route::post('profile/phone/verify', [CustomerPhoneController::class, 'verify'])->middleware('throttle:20,1')->name('customer.profile.phone.verify');
});
Route::middleware(['auth', 'role:biker'])->prefix('biker')->group(function () {
    Route::get('dashboard', BikerDashboardController::class)->name('biker.dashboard');
    Route::post('notifications/read', [BikerDashboardController::class, 'markNotificationsRead'])->name('biker.notifications.read');

    // Read-only accreditation progress for the signed-in biker. Riders cannot change any accreditation status.
    Route::get('accreditation', BikerAccreditationController::class)->name('biker.accreditation');

    // Restricted biker function: only bikers whose application an administrator has approved.
    Route::get('service-requests', BikerServiceRequestController::class)->middleware('biker.approved')->name('biker.service-requests');

    // Real-time dispatch (rider side). Accredited, active bikers only. All decisions are made by the server.
    Route::middleware('biker.approved')->prefix('dispatch')->name('biker.dispatch.')->group(function () {
        Route::get('/', [RiderDispatchController::class, 'index'])->name('index');
        Route::get('state', [RiderDispatchController::class, 'state'])->middleware('throttle:90,1')->name('state');
        Route::post('location', [RiderDispatchController::class, 'location'])->middleware('throttle:30,1')->name('location');
        Route::post('online', [RiderDispatchController::class, 'online'])->middleware('throttle:20,1')->name('online');
        Route::post('offline', [RiderDispatchController::class, 'offline'])->middleware('throttle:20,1')->name('offline');
        Route::post('offers/{offer}/accept', [RiderDispatchController::class, 'accept'])->whereNumber('offer')->middleware('throttle:30,1')->name('offers.accept');
        Route::post('offers/{offer}/decline', [RiderDispatchController::class, 'decline'])->whereNumber('offer')->middleware('throttle:30,1')->name('offers.decline');
        Route::post('bookings/{booking}/cancel', [RiderDispatchController::class, 'cancel'])->middleware('throttle:10,1')->name('bookings.cancel');
        Route::post('bookings/{booking}/arrived', [RiderDispatchController::class, 'arrived'])->middleware('throttle:20,1')->name('bookings.arrived');
        Route::post('bookings/{booking}/start', [RiderDispatchController::class, 'start'])->middleware('throttle:20,1')->name('bookings.start');
        Route::post('bookings/{booking}/complete', [RiderDispatchController::class, 'complete'])->middleware('throttle:20,1')->name('bookings.complete');
        Route::post('bookings/{booking}/rate', [RiderDispatchController::class, 'rate'])->middleware('throttle:10,1')->name('bookings.rate');
    });
});

// Admin portal (Laravel session auth + MySQL). Every /admin page requires an active administrator.
Route::middleware(['auth', EnsureActiveAdmin::class])->prefix('admin')->group(function () {
    Route::get('dashboard', AdminDashboardController::class)->middleware('admin.area:dashboard')->name('admin.dashboard');

    // Rider Management (administrator-facing label for the existing biker records).
    Route::prefix('riders')->middleware('admin.area:riders')->name('admin.riders.')->group(function () {
        Route::get('/', [RiderManagementController::class, 'index'])->name('index');
        Route::get('{rider}', [RiderManagementController::class, 'show'])->name('show');
        Route::get('{rider}/documents/{type}', [RiderManagementController::class, 'document'])->name('document');
        Route::post('{rider}/approve', [RiderManagementController::class, 'approve'])->name('approve');
        Route::post('{rider}/reject', [RiderManagementController::class, 'reject'])->name('reject');
        Route::post('{rider}/suspend', [RiderManagementController::class, 'suspend'])->name('suspend');
        Route::post('{rider}/reactivate', [RiderManagementController::class, 'reactivate'])->name('reactivate');

        // Accreditation workflow: documents (in person) -> orientation -> motorcycle inspection -> final accreditation.
        Route::prefix('{rider}/accreditation')->name('accreditation.')->group(function () {
            Route::get('/', [RiderAccreditationController::class, 'show'])->name('show');
            Route::post('documents', [RiderAccreditationController::class, 'verifyDocuments'])->name('documents');
            Route::post('orientation', [RiderAccreditationController::class, 'scheduleOrientation'])->name('orientation.schedule');
            Route::post('orientation/{orientation}/result', [RiderAccreditationController::class, 'orientationResult'])->name('orientation.result');
            Route::post('inspection', [RiderAccreditationController::class, 'recordInspection'])->name('inspection');
            Route::post('grant', [RiderAccreditationController::class, 'grant'])->name('grant');
            Route::post('revoke', [RiderAccreditationController::class, 'revoke'])->name('revoke');
            Route::post('remarks', [RiderAccreditationController::class, 'remarks'])->name('remarks');
        });
    });

    // Passenger Management: Administrator and Support Staff can read; only the Administrator can change a status.
    Route::prefix('passengers')->middleware('admin.area:passengers')->name('admin.passengers.')->group(function () {
        Route::get('/', [PassengerManagementController::class, 'index'])->name('index');
        Route::get('{passenger}', [PassengerManagementController::class, 'show'])->name('show');
        Route::middleware(['admin.area:passengers_manage', 'throttle:20,1'])->group(function () {
            Route::post('{passenger}/suspend', [PassengerManagementController::class, 'suspend'])->name('suspend');
            Route::post('{passenger}/deactivate', [PassengerManagementController::class, 'deactivate'])->name('deactivate');
            Route::post('{passenger}/reactivate', [PassengerManagementController::class, 'reactivate'])->name('reactivate');
        });
    });

    // Booking Management = live dispatch monitor. Admins can watch everything and cancel / restart a search, but they
    // can never assign a rider: assignment only happens when a rider accepts (DispatchService::accept).
    Route::prefix('bookings')->middleware('admin.area:bookings')->name('admin.bookings.')->group(function () {
        Route::get('/', [DispatchMonitorController::class, 'index'])->name('index');
        Route::get('live', [DispatchMonitorController::class, 'live'])->middleware('throttle:90,1')->name('live');
        Route::get('{booking}/history', [DispatchMonitorController::class, 'history'])->middleware('throttle:60,1')->name('history');
        Route::post('{booking}/cancel', [DispatchMonitorController::class, 'cancel'])->middleware('throttle:20,1')->name('cancel');
        Route::post('{booking}/retry', [DispatchMonitorController::class, 'retry'])->middleware('throttle:20,1')->name('retry');
    });

    // Staff Accounts: only the Administrator, and only for Operations Admin and Support Staff accounts.
    Route::prefix('staff')->middleware('admin.area:staff')->name('admin.staff.')->group(function () {
        Route::get('/', [StaffAccountController::class, 'index'])->name('index');
        Route::post('/', [StaffAccountController::class, 'store'])->middleware('throttle:20,1')->name('store');
        Route::post('{staff}/suspend', [StaffAccountController::class, 'suspend'])->middleware('throttle:20,1')->name('suspend');
        Route::post('{staff}/reactivate', [StaffAccountController::class, 'reactivate'])->middleware('throttle:20,1')->name('reactivate');
        Route::post('{staff}/invite', [StaffAccountController::class, 'invite'])->middleware('throttle:10,1')->name('invite');
    });

    // Admin Settings = dispatch settings (Administrator only; only a super administrator can change them).
    Route::get('settings', [DispatchSettingsController::class, 'edit'])->middleware('admin.area:settings')->name('admin.settings');
    Route::put('settings', [DispatchSettingsController::class, 'update'])->middleware(['admin.area:settings', 'throttle:20,1'])->name('admin.settings.update');

    // Modules built in later phases render a placeholder inside the admin layout. Each one is tied to an area
    // (see AdminProfile::AREAS): Operations Admin get subscriptions; Support Staff get tickets, complaints and incidents.
    foreach ([
        'subscriptions' => ['Subscription Management', 'subscriptions'],
        'complaints' => ['Complaint Management', 'support'],
        'complaints/{complaint}' => ['Complaint Review', 'support'],
        'tickets' => ['Ticket Management', 'support'],
        'incidents' => ['Incident Reports', 'support'],
        'reports' => ['Reports and Analytics', 'reports'],
        'notifications' => ['Notifications', 'notifications'],
    ] as $path => [$title, $area]) {
        Route::inertia($path, 'admin/placeholder', ['title' => $title])->middleware("admin.area:{$area}");
    }
});

Route::prefix('{current_team}')
    ->middleware(['auth', 'verified', EnsureTeamMembership::class])
    ->group(function () {
        Route::get('dashboard', DashboardController::class)->name('dashboard');
    });

Route::middleware(['auth'])->group(function () {
    Route::post('invitations/{invitation}/accept', [TeamInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [TeamInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';