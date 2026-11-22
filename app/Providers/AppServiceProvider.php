<?php

namespace App\Providers;

use App\Services\Sms\LogSmsSender;
use App\Services\Sms\SemaphoreSmsSender;
use App\Services\Sms\SmsSender;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use InvalidArgumentException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // SMS_DRIVER picks how OTP texts are sent: "log" (local/dev) or "semaphore" (Philippines).
        $this->app->bind(SmsSender::class, fn () => match (config('sms.driver')) {
            'log' => new LogSmsSender,
            'semaphore' => new SemaphoreSmsSender(
                config('sms.semaphore.api_key'),
                config('sms.semaphore.sender_name'),
                (string) config('sms.semaphore.endpoint'),
            ),
            default => throw new InvalidArgumentException('Unknown SMS_DRIVER "'.config('sms.driver').'". Use "log" or "semaphore".'),
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // When APP_URL is https (e.g. a Cloudflare tunnel), generate https links for assets and routes.
        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
