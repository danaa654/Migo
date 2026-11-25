<?php

use App\Http\Middleware\EnsureAdminArea;
use App\Http\Middleware\EnsureApprovedBiker;
use App\Http\Middleware\EnsureCustomerProfileComplete;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetTeamUrlDefaults;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trust the Cloudflare tunnel proxy so Laravel sees the request as https.
        $middleware->trustProxies(at: '*');

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // Payment providers post confirmations here without a browser session; they are verified by signature instead.
        $middleware->validateCsrfTokens(except: ['webhooks/paymongo', 'webhooks/xendit']);

        $middleware->alias([
            'role' => EnsureRole::class,
            'admin.area' => EnsureAdminArea::class,
            'biker.approved' => EnsureApprovedBiker::class,
            'customer.profile' => EnsureCustomerProfileComplete::class,
        ]);

        // Signed-out visitors: admin URLs go to the admin login, everything else to the public login.
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('admin', 'admin/*') ? '/admin/login' : ($request->is('customer/book') ? '/book' : '/login'));

        // Signed-in users who open a guest-only page (/login, /admin/login) go to their own role dashboard.
        $middleware->redirectUsersTo(fn (Request $request) => $request->user()?->dashboardPath() ?? '/');

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            SetTeamUrlDefaults::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
