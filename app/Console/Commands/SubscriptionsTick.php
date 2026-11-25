<?php

namespace App\Console\Commands;

use App\Services\Subscriptions\SubscriptionService;
use Illuminate\Console\Command;

class SubscriptionsTick extends Command
{
    protected $signature = 'subscriptions:tick';

    protected $description = 'Start queued renewals, mark ended subscriptions as expired and send reminders';

    public function handle(SubscriptionService $subs): int
    {
        $r = $subs->tick();
        $this->info("activated {$r['activated']}, expired {$r['expired']}, reminders {$r['reminders']}");

        return self::SUCCESS;
    }
}
