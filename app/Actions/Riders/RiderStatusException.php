<?php

namespace App\Actions\Riders;

use RuntimeException;

/** Thrown when a requested rider status change is not allowed from the rider's current state. */
class RiderStatusException extends RuntimeException {}
