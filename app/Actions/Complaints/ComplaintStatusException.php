<?php

namespace App\Actions\Complaints;

use RuntimeException;

/** Thrown when a requested complaint status change is not allowed from the complaint's current state. */
class ComplaintStatusException extends RuntimeException {}