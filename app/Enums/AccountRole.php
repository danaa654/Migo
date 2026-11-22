<?php

namespace App\Enums;

/**
 * The three MIGO account types. The value is what is stored in users.role.
 */
enum AccountRole: string
{
    case Customer = 'customer';
    case Biker = 'biker';
    case Admin = 'admin';

    /** The dashboard this role lands on after signing in. */
    public function dashboardPath(): string
    {
        return match ($this) {
            self::Customer => '/customer/dashboard',
            self::Biker => '/biker/dashboard',
            self::Admin => '/admin/dashboard',
        };
    }

    /** Roles that sign in through the public (Customer/Biker) login form. */
    public static function publicRoles(): array
    {
        return [self::Customer, self::Biker];
    }
}
