<?php

namespace App\Services\Complaints;

use App\Models\Booking;
use App\Models\Complaint;
use App\Support\SupportCategories;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Filing side of the Support Center, shared by the passenger and rider controllers.
 * $reporter is 'passenger' or 'rider'; $profile is that person's own profile row (never read from the request).
 */
class ReportFilingService
{
    /** Complaints and support requests waiting for staff, per person. Incident reports are never blocked by it. */
    public const MAX_OPEN = 5;

    /** @return array{rules: array<string, mixed>, messages: array<string, string>} */
    public function validation(Request $request, string $reporter): array
    {
        $type = $request->input('type');
        $type = in_array($type, Complaint::TYPES, true) ? $type : Complaint::TYPE_COMPLAINT;
        $tripRequired = $reporter === 'rider' && $type === Complaint::TYPE_COMPLAINT;

        return [
            'rules' => [
                'type' => ['required', Rule::in(Complaint::TYPES)],
                'category' => ['required', Rule::in(array_keys(SupportCategories::for($type, $reporter)))],
                'description' => ['required', 'string', 'min:10', 'max:2000'],
                'booking_id' => [$tripRequired ? 'required' : 'nullable', 'uuid'],
                'occurred_at' => [$type === Complaint::TYPE_INCIDENT ? 'required' : 'nullable', 'date', 'before_or_equal:now', 'after:'.now()->subYear()->toDateString()],
                'incident_location' => [$type === Complaint::TYPE_INCIDENT ? 'required' : 'nullable', 'string', 'max:255'],
            ],
            'messages' => [
                'type.required' => 'Please choose what you want to send.',
                'type.in' => 'Please choose what you want to send.',
                'category.required' => 'Please choose what this is about.',
                'category.in' => 'Please choose what this is about.',
                'description.required' => 'Please describe what happened.',
                'description.min' => 'Please give a little more detail (at least 10 characters).',
                'description.max' => 'Please keep it under 2000 characters.',
                'booking_id.required' => 'Please choose the trip this is about.',
                'booking_id.uuid' => 'Please choose one of your trips.',
                'occurred_at.required' => 'Please tell us when it happened.',
                'occurred_at.date' => 'Please enter a valid date and time.',
                'occurred_at.before_or_equal' => 'The time it happened cannot be in the future.',
                'occurred_at.after' => 'Please report incidents from the last year only.',
                'incident_location.required' => 'Please tell us where it happened.',
                'incident_location.max' => 'Please keep the location under 255 characters.',
            ],
        ];
    }

    /**
     * Creates the report, its first history line and the notifications in one transaction.
     *
     * @param  array<string, mixed>  $data  validated input
     * @return array<string, string>|null  validation errors to send back, or null when the report was filed
     */
    public function file(string $reporter, object $profile, array $data): ?array
    {
        $type = $data['type'];
        $other = $reporter === 'rider' ? 'passenger' : 'rider';
        $noun = SupportCategories::noun($type);

        return DB::transaction(function () use ($reporter, $other, $profile, $data, $type, $noun) {
            // Locking the reporter's row keeps two quick submissions from slipping past the limit below.
            $me = $profile->newQuery()->lockForUpdate()->findOrFail($profile->id);

            $counted = Complaint::query()->where('reporter_type', $reporter)->where('reporter_id', $me->id)->whereIn('complaint_status', Complaint::OPEN);
            if ($type !== Complaint::TYPE_INCIDENT
                && (clone $counted)->whereIn('report_type', [Complaint::TYPE_COMPLAINT, Complaint::TYPE_SUPPORT])->count() >= self::MAX_OPEN) {
                return ['limit' => 'You already have '.self::MAX_OPEN.' reports being reviewed. Please wait for the support team to respond before sending another.'];
            }

            $booking = null;
            if (! empty($data['booking_id'])) {
                $booking = $this->ownBooking($reporter, $me->id, $data['booking_id']);
                if (! $booking) {
                    return ['booking_id' => 'Please choose one of your own trips.'];
                }
                if ($type === Complaint::TYPE_COMPLAINT && (clone $counted)->where('report_type', Complaint::TYPE_COMPLAINT)->where('booking_id', $booking->id)->exists()) {
                    return ['booking_id' => 'You already have a complaint being reviewed for this trip.'];
                }
            }

            // Support requests never name anyone. A complaint or incident names the other party of the chosen trip.
            $againstId = null;
            if ($booking && $type !== Complaint::TYPE_SUPPORT) {
                $againstId = $reporter === 'rider' ? $booking->passenger_id : $booking->rider_id;
            }

            $report = Complaint::create([
                'reporter_id' => $me->id,
                'reporter_type' => $reporter,
                'report_type' => $type,
                'complaint_category' => $data['category'],
                'description' => $data['description'],
                'complaint_status' => 'pending',
                'booking_id' => $booking?->id,
                'against_type' => $againstId ? $other : null,
                'against_id' => $againstId,
                'occurred_at' => $type === Complaint::TYPE_INCIDENT ? Carbon::parse($data['occurred_at'])->setTimezone(config('app.timezone')) : null,
                'incident_location' => $type === Complaint::TYPE_INCIDENT ? trim($data['incident_location']) : null,
            ]);

            // First line of the report's history in Admin > Support Center (no staff member yet).
            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'admin_id' => null,
                'action' => 'complaint.filed',
                'description' => null,
                'subject_type' => 'complaint',
                'subject_id' => $report->id,
                'created_at' => now(),
            ]);

            // Administrator feed (user_id NULL), same table the rest of the admin notifications use.
            $who = $me->full_name !== '' ? $me->full_name : 'A '.$reporter;
            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(),
                'title' => $type === Complaint::TYPE_INCIDENT ? 'New incident report (safety)' : 'New '.$noun,
                'message' => $who.' sent a '.$noun.': '.SupportCategories::label($data['category']).'.',
                'notification_type' => $type.'_filed',
                'is_read' => false,
                'created_at' => now(),
            ]);

            // Let the other party know a report was filed about this trip. Kept vague on purpose: no category, no text
            // and no name, so nobody can retaliate before support has looked at it. Support requests never notify.
            if ($booking && $againstId) {
                $table = $other === 'rider' ? 'riders' : 'passengers';
                $userId = DB::table($table)->where('id', $againstId)->value('user_id');
                if ($userId) {
                    DB::table('notifications')->insert([
                        'id' => (string) Str::uuid(),
                        'user_id' => $userId,
                        'title' => 'A '.$reporter.' filed a report',
                        'message' => 'A '.$reporter.' filed a report about trip '.($booking->booking_reference ?? 'your recent trip').'. Our support team will review it and contact you if they need anything from you.',
                        'notification_type' => 'complaint_received',
                        'is_read' => false,
                        'created_at' => now(),
                    ]);
                }
            }

            return null;
        });
    }

    /** A trip that belongs to this reporter (and has the other party on it). */
    private function ownBooking(string $reporter, string $profileId, string $bookingId): ?Booking
    {
        return Booking::query()->where('id', $bookingId)
            ->when($reporter === 'rider',
                fn ($q) => $q->where('rider_id', $profileId)->whereNotNull('passenger_id'),
                fn ($q) => $q->where('passenger_id', $profileId)->whereNotNull('rider_id'))
            ->first();
    }
}
