<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Throwable;

/** Props that every page inside the Biker shell (sidebar + top bar) needs. */
class BikerShellData
{
    /** For pages only accredited riders can reach (biker.approved), so accreditation is always complete. */
    public static function props(User $user): array
    {
        return [
            'account' => ['name' => $user->name, 'email' => $user->email],
            'notifications' => self::notifications($user->id),
        ];
    }

    /** @return array{unread: int, latest: mixed}|null  null when the notifications table is unavailable */
    public static function notifications(int $userId): ?array
    {
        try {
            $own = DB::table('notifications')->where('user_id', $userId);

            return [
                'unread' => (clone $own)->where('is_read', false)->count(),
                'latest' => (clone $own)->select('id', 'title', 'message', 'is_read', 'created_at')->orderByDesc('created_at')->limit(50)->get(),
            ];
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }
}
