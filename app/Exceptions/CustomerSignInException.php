<?php

namespace App\Exceptions;

use RuntimeException;

/** Customer sign-in was refused (for example the email or phone belongs to a rider/admin account). */
class CustomerSignInException extends RuntimeException {}
