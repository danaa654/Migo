<?php

namespace App\Actions\Passengers;

use RuntimeException;

/** Thrown when a requested passenger status change is not allowed from the passenger's current state. */
class PassengerStatusException extends RuntimeException {}