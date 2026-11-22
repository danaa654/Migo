<?php

namespace App\Actions\Riders;

/** A requested accreditation step is not allowed from the rider's current state (HTTP 422 / error toast). */
class AccreditationException extends RiderStatusException {}
