<?php

namespace App\Console\Commands;

use App\Services\Dispatch\DispatchService;
use App\Services\Dispatch\RiderPresenceService;
use Illuminate\Console\Command;

class DispatchTick extends Command
{
    protected $signature = 'dispatch:tick';

    protected $description = 'Expire stale ride offers, expand search radii, offer to newly eligible riders, time out unmatched bookings and take silent riders offline';

    public function handle(DispatchService $dispatch, RiderPresenceService $presence): int
    {
        $offline = $presence->sweepStale();
        $s = $dispatch->tick();
        $this->line(sprintf('expired offers: %d, radius expansions: %d, new offers: %d, no rider found: %d, riders auto-offline: %d',
            $s['expired_offers'], $s['expanded'], $s['offers'], $s['no_rider'], $offline));

        return self::SUCCESS;
    }
}
