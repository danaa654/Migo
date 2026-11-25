<?php

namespace App\Console\Commands;

use App\Models\Rider;
use App\Services\Subscriptions\SubscriptionService;
use Illuminate\Console\Command;

class SubscriptionsBackfillTrials extends Command
{
    protected $signature = 'subscriptions:backfill-trials';

    protected $description = 'Give the one free trial to riders who were accredited before subscriptions existed';

    public function handle(SubscriptionService $subs): int
    {
        $n = 0;
        Rider::where('application_status', 'approved')->where('accreditation_status', 'accredited')->where('account_status', 'active')
            ->each(function (Rider $r) use ($subs, &$n) {
                if ($subs->startTrial($r)) {
                    $n++;
                }
            });
        $this->info("Started {$n} free trial(s).");

        return self::SUCCESS;
    }
}
