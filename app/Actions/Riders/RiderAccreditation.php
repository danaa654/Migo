<?php

namespace App\Actions\Riders;

use App\Models\AdminProfile;
use App\Models\MotorcycleInspection;
use App\Models\Rider;
use App\Models\RiderAccreditationHistory;
use App\Models\RiderDocumentVerification;
use App\Models\RiderOrientation;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The only place that changes a rider's accreditation statuses:
 *   document_verification_status, orientation_status, inspection_status, accreditation_status.
 * (application_status / account_status stay in UpdateRiderStatus.)
 *
 * Sequential flow:  application approved -> documents verified in person -> orientation completed
 *                   -> motorcycle inspection passed -> administrator explicitly grants accreditation.
 *
 * Every public method runs in one transaction on a locked rider row, re-checks the acting staff member and the
 * rider's current state, records the responsible staff member, appends to rider_accreditation_history (and the
 * existing audit_logs) and notifies the rider through the existing notifications table.
 *
 * Authorization failures throw AuthorizationException (HTTP 403); workflow violations throw AccreditationException.
 */
class RiderAccreditation
{
    /** Equipment that must be present for a motorcycle to pass. */
    public const REQUIRED_EQUIPMENT = [
        'rider_helmet', 'passenger_helmet', 'side_mirrors', 'headlight', 'tail_and_brake_lights', 'horn', 'turn_signals',
    ];

    public const REQUIRED_DOCUMENTS = ['license', 'registration', 'receipt', 'nbi'];

    /* ---------------------------------------------------------------- Stage 3: face-to-face document check */

    /**
     * @param  array{status: string, documents_checked?: array<string, bool>, verified_on?: mixed, office_location?: ?string, remarks?: ?string}  $data
     */
    public function recordDocumentVerification(Rider $rider, AdminProfile $staff, array $data): RiderDocumentVerification
    {
        return $this->transact($rider, $staff, function (Rider $r) use ($staff, $data) {
            $this->guardNotAccredited($r);
            if ($r->application_status !== 'approved') {
                throw new AccreditationException('The online application must be approved before documents can be verified in person.');
            }

            $status = $data['status'];
            $checked = $this->normalizeFlags($data['documents_checked'] ?? [], self::REQUIRED_DOCUMENTS);
            $remarks = $this->clean($data['remarks'] ?? null);

            if ($status === 'verified') {
                $missing = array_keys(array_filter($checked, fn ($seen) => ! $seen));
                if ($missing) {
                    throw new AccreditationException('Original documents must all be physically checked before marking verified. Not checked: '.implode(', ', $missing).'.');
                }
                if ($r->license_expiry?->isPast()) {
                    throw new AccreditationException("The driver's license on record has expired; documents cannot be verified.");
                }
            } elseif ($status === 'failed' && $remarks === null) {
                throw new AccreditationException('Remarks are required when document verification fails (incomplete or invalid documents).');
            }

            $record = RiderDocumentVerification::create([
                'rider_id' => $r->id,
                'status' => $status,
                'documents_checked' => $checked,
                'verified_at' => $data['verified_on'] ?? now(),
                'verified_by' => $staff->id,
                'office_location' => $this->clean($data['office_location'] ?? null),
                'remarks' => $remarks,
            ]);

            $from = $r->document_verification_status;
            $r->forceFill(['document_verification_status' => $status])->save();
            $this->log($r, $staff, 'documents', 'documents.'.$status, $from, $status, $remarks);
            $this->notify($r, 'documents_'.$status, 'Document verification: '.ucfirst($status),
                $status === 'verified' ? 'Your original documents were verified at the Migo office.'
                    : ($status === 'failed' ? 'Your documents did not pass verification. '.$remarks : 'Your document verification is pending.'));
            $this->syncAccreditation($r, $staff);

            return $record;
        });
    }

    /* ---------------------------------------------------------------- Stage 4: orientation */

    /** @param  array{scheduled_at: mixed, location: string, facilitator_id: string, remarks?: ?string}  $data */
    public function scheduleOrientation(Rider $rider, AdminProfile $staff, array $data): RiderOrientation
    {
        return $this->transact($rider, $staff, function (Rider $r) use ($staff, $data) {
            $this->guardNotAccredited($r);
            if ($r->document_verification_status !== 'verified') {
                throw new AccreditationException('Documents must be verified in person before orientation can be scheduled.');
            }
            if ($r->orientation_status === 'completed') {
                throw new AccreditationException('Orientation is already completed.');
            }

            $facilitator = $this->activeStaff($data['facilitator_id'], 'facilitator');
            $at = Carbon::parse($data['scheduled_at']);
            if ($at->isPast()) {
                throw new AccreditationException('The orientation must be scheduled for a future date and time.');
            }

            // A reschedule supersedes the open schedule; the old row is kept (status "cancelled").
            RiderOrientation::where('rider_id', $r->id)->where('status', 'scheduled')->update(['status' => 'cancelled']);

            $orientation = RiderOrientation::create([
                'rider_id' => $r->id,
                'status' => 'scheduled',
                'scheduled_at' => $at,
                'location' => trim($data['location']),
                'facilitator_id' => $facilitator->id,
                'scheduled_by' => $staff->id,
                'remarks' => $this->clean($data['remarks'] ?? null),
            ]);

            $from = $r->orientation_status;
            $r->forceFill(['orientation_status' => 'scheduled'])->save();
            $this->log($r, $staff, 'orientation', 'orientation.scheduled', $from, 'scheduled',
                $at->toDateTimeString().' @ '.$orientation->location.' (facilitator: '.$facilitator->full_name.')');
            $this->notify($r, 'orientation_scheduled', 'Orientation scheduled',
                'Your rider orientation is on '.$at->format('M j, Y g:i A').' at '.$orientation->location.'.');
            $this->syncAccreditation($r, $staff);

            return $orientation;
        });
    }

    /**
     * Records attendance and the outcome. Only the assigned facilitator (or a super administrator) may do this.
     *
     * @param  array{attended: bool, result: string, remarks?: ?string}  $data  result: completed | failed
     */
    public function recordOrientationResult(Rider $rider, RiderOrientation $orientation, AdminProfile $staff, array $data): RiderOrientation
    {
        return $this->transact($rider, $staff, function (Rider $r) use ($orientation, $staff, $data) {
            $this->guardNotAccredited($r);
            $o = RiderOrientation::query()->lockForUpdate()->findOrFail($orientation->id);
            if ($o->rider_id !== $r->id) {
                throw new AccreditationException('This orientation does not belong to the rider.');
            }
            if ($o->status !== 'scheduled') {
                throw new AccreditationException('Only a scheduled orientation can be completed or failed.');
            }
            if (! $this->isSuperAdmin($staff) && $o->facilitator_id !== $staff->id) {
                throw new AuthorizationException('Only the assigned facilitator or a super administrator can record the orientation result.');
            }

            $attended = (bool) $data['attended'];
            $result = $data['result'];
            $remarks = $this->clean($data['remarks'] ?? null);
            if ($result === 'completed' && ! $attended) {
                throw new AccreditationException('A rider who did not attend cannot be marked as having completed the orientation.');
            }
            if ($result === 'failed' && $remarks === null) {
                throw new AccreditationException('Remarks are required when an orientation is failed.');
            }

            $o->forceFill([
                'status' => $result,
                'attended' => $attended,
                'attendance_recorded_at' => now(),
                'completed_at' => $result === 'completed' ? now() : null,
                'completed_by' => $staff->id,
                'remarks' => $remarks ?? $o->remarks,
            ])->save();

            $from = $r->orientation_status;
            $r->forceFill(['orientation_status' => $result])->save();
            $this->log($r, $staff, 'orientation', 'orientation.'.$result, $from, $result,
                ($attended ? 'Attended. ' : 'Did not attend. ').($remarks ?? ''));
            $this->notify($r, 'orientation_'.$result, 'Orientation '.$result,
                $result === 'completed' ? 'You completed the Migo rider orientation.' : 'Your orientation was marked as failed. '.$remarks);
            $this->syncAccreditation($r, $staff);

            return $o->refresh();
        });
    }

    /* ---------------------------------------------------------------- Stage 5: motorcycle inspection */

    /**
     * Records one inspection (the first, or a reinspection after a failed/pending one).
     * The inspector is the acting staff member, or - for a super administrator - the staff member named in inspector_id.
     *
     * @param  array<string, mixed>  $data
     */
    public function recordInspection(Rider $rider, AdminProfile $staff, array $data): MotorcycleInspection
    {
        return $this->transact($rider, $staff, function (Rider $r) use ($staff, $data) {
            $this->guardNotAccredited($r);
            if ($r->orientation_status !== 'completed') {
                throw new AccreditationException('The rider must complete orientation before the motorcycle inspection.');
            }

            $inspector = $staff;
            if (! empty($data['inspector_id']) && $data['inspector_id'] !== $staff->id) {
                if (! $this->isSuperAdmin($staff)) {
                    throw new AuthorizationException('Only a super administrator can record an inspection on behalf of another inspector.');
                }
                $inspector = $this->activeStaff($data['inspector_id'], 'inspector');
            }

            $status = $data['status'];
            $equipment = $this->normalizeFlags($data['safety_equipment'] ?? [], self::REQUIRED_EQUIPMENT);
            $roadworthy = (bool) $data['roadworthy'];
            $plate = Str::upper(trim($data['plate_number']));
            $expiry = Carbon::parse($data['registration_expiry']);
            $findings = $this->clean($data['findings'] ?? null);

            if ($status === 'passed') {
                $problems = [];
                if (! $roadworthy) {
                    $problems[] = 'the motorcycle is not roadworthy';
                }
                if ($missing = array_keys(array_filter($equipment, fn ($has) => ! $has))) {
                    $problems[] = 'required safety equipment is missing ('.implode(', ', $missing).')';
                }
                if (($data['condition'] ?? null) === 'poor') {
                    $problems[] = 'the motorcycle condition is poor';
                }
                if ($expiry->isPast()) {
                    $problems[] = 'the registration has expired';
                }
                if (! \App\Support\PlateNumber::same($plate, $r->motorcycle_plate_number)) {
                    $problems[] = 'the plate number does not match the one on the rider\'s application';
                }
                if ($problems) {
                    throw new AccreditationException('The inspection cannot be marked as passed: '.implode('; ', $problems).'.');
                }
            } elseif ($status === 'failed' && $findings === null) {
                throw new AccreditationException('Findings are required when a motorcycle fails inspection.');
            }

            $previous = MotorcycleInspection::where('rider_id', $r->id)->orderByDesc('id')->first();

            $inspection = MotorcycleInspection::create([
                'rider_id' => $r->id,
                'reinspection_of_id' => $previous?->id,
                'status' => $status,
                'make' => trim($data['make']),
                'model' => trim($data['model']),
                'plate_number' => $plate,
                'registration_number' => trim($data['registration_number']),
                'registration_expiry' => $expiry->toDateString(),
                'condition' => $data['condition'],
                'safety_equipment' => $equipment,
                'roadworthy' => $roadworthy,
                'inspected_at' => $data['inspected_at'] ?? now(),
                'inspector_id' => $inspector->id,
                'findings' => $findings,
                'remarks' => $this->clean($data['remarks'] ?? null),
            ]);

            $from = $r->inspection_status;
            $r->forceFill(['inspection_status' => $status])->save();
            $this->log($r, $staff, 'inspection', ($previous ? 'reinspection.' : 'inspection.').$status, $from, $status,
                trim(($findings ?? '').' '.($inspection->remarks ?? '')) ?: null);
            $this->notify($r, 'inspection_'.$status, 'Motorcycle inspection: '.ucfirst($status),
                $status === 'passed' ? 'Your motorcycle passed inspection.'
                    : ($status === 'failed' ? 'Your motorcycle failed inspection. A reinspection is needed. '.$findings : 'Your motorcycle inspection is pending.'));
            $this->syncAccreditation($r, $staff);

            return $inspection;
        });
    }

    /* ---------------------------------------------------------------- Stage 6: final accreditation */

    public function grant(Rider $rider, AdminProfile $staff, ?string $remarks = null): Rider
    {
        return $this->transact($rider, $staff, function (Rider $r) use ($staff, $remarks) {
            if ($r->accreditation_status === 'accredited') {
                throw new AccreditationException('This rider is already accredited.');
            }
            if ($missing = $this->missingRequirements($r)) {
                throw new AccreditationException('Final accreditation is not allowed yet: '.implode(' ', $missing));
            }
            if ($r->account_status === 'suspended') {
                throw new AccreditationException('A suspended account must be reactivated before the rider can be accredited.');
            }

            $from = $r->accreditation_status;
            // Granting also activates the account (an inactive account becomes active); suspended was rejected above.
            $r->forceFill([
                'accreditation_status' => 'accredited',
                'accredited_at' => now(),
                'accredited_by' => $staff->id,
                'accreditation_remarks' => $this->clean($remarks),
                'revoked_at' => null, 'revoked_by' => null, 'revocation_reason' => null,
                'account_status' => 'active',
            ])->save();

            $this->log($r, $staff, 'accreditation', 'accreditation.granted', $from, 'accredited', $remarks);
            $this->notify($r, 'accreditation_granted', 'You are accredited',
                'Congratulations! You are now an accredited Migo rider and can accept bookings.');

            // The free trial starts now: this is the moment the rider becomes eligible to receive bookings.
            try {
                app(\App\Services\Subscriptions\SubscriptionService::class)->startTrial($r);
            } catch (\Throwable $e) {
                report($e); // never block accreditation because of the trial
            }

            return $r;
        });
    }

    public function revoke(Rider $rider, AdminProfile $staff, string $reason): Rider
    {
        return $this->transact($rider, $staff, function (Rider $r) use ($staff, $reason) {
            if ($r->accreditation_status !== 'accredited') {
                throw new AccreditationException('Only an accredited rider can have accreditation revoked.');
            }
            $reason = $this->clean($reason);
            if ($reason === null) {
                throw new AccreditationException('A reason is required to revoke accreditation.');
            }

            $r->forceFill([
                'accreditation_status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => $staff->id, 'revocation_reason' => $reason,
            ])->save();

            $this->log($r, $staff, 'accreditation', 'accreditation.revoked', 'accredited', 'revoked', $reason);
            $this->notify($r, 'accreditation_revoked', 'Accreditation revoked',
                'Your Migo accreditation was revoked and you can no longer accept bookings. Reason: '.$reason);

            return $r;
        });
    }

    /** Administrative remark on a rider; the previous remark stays in the history log. */
    public function addRemarks(Rider $rider, AdminProfile $staff, string $remarks): Rider
    {
        return $this->transact($rider, $staff, function (Rider $r) use ($staff, $remarks) {
            $remarks = $this->clean($remarks);
            if ($remarks === null) {
                throw new AccreditationException('Remarks cannot be empty.');
            }
            $r->forceFill(['admin_remarks' => $remarks])->save();
            $this->log($r, $staff, 'remarks', 'remarks.updated', null, null, $remarks);

            return $r;
        });
    }

    /* ---------------------------------------------------------------- Rules + read model */

    /** @return list<string> Reasons the rider cannot yet be accredited (empty = eligible). */
    public function missingRequirements(Rider $rider): array
    {
        $missing = [];
        if ($rider->application_status !== 'approved') {
            $missing[] = 'The initial application is not approved.';
        }
        if ($rider->document_verification_status !== 'verified') {
            $missing[] = 'Original documents have not been verified in person.';
        }
        if ($rider->orientation_status !== 'completed') {
            $missing[] = 'Orientation has not been completed.';
        }
        if ($rider->inspection_status !== 'passed') {
            $missing[] = 'The motorcycle inspection has not been passed.';
        }

        return $missing;
    }

    /**
     * Progress summary. $forRider = true returns only what the rider may see (no staff names or internal remarks).
     *
     * @return array<string, mixed>
     */
    public function summary(Rider $rider, bool $forRider = false): array
    {
        $rider->refresh();
        $missing = $this->missingRequirements($rider);

        $summary = [
            'statuses' => [
                'application' => $rider->application_status,
                'document_verification' => $rider->document_verification_status,
                'orientation' => $rider->orientation_status,
                'motorcycle_inspection' => $rider->inspection_status,
                'accreditation' => $rider->accreditation_status,
                'account' => $rider->account_status,
            ],
            'eligible_for_final_approval' => $missing === [],
            'missing_requirements' => $missing,
            'can_accept_bookings' => $rider->canAcceptRequests(),
            'orientation' => ($o = $rider->orientations()->where('status', 'scheduled')->reorder()->orderByDesc('id')->first())
                ? ['scheduled_at' => $o->scheduled_at?->toIso8601String(), 'location' => $o->location] : null,
        ];

        if ($forRider) {
            $summary['rejection_reason'] = $rider->application_status === 'rejected' ? $rider->rejection_reason : null;
            $summary['document_remarks'] = $rider->document_verification_status === 'failed' ? $rider->documentVerifications()->reorder()->orderByDesc('id')->value('remarks') : null;
            $summary['orientation_remarks'] = $rider->orientation_status === 'failed' ? $rider->orientations()->reorder()->orderByDesc('id')->value('remarks') : null;
            $summary['inspection_remarks'] = $rider->inspection_status === 'failed' ? $rider->inspections()->reorder()->orderByDesc('id')->value('findings') : null;
            $summary['revocation_reason'] = $rider->accreditation_status === 'revoked' ? $rider->revocation_reason : null;

            return $summary;
        }

        $summary['rejection_reason'] = $rider->rejection_reason;
        $summary['admin_remarks'] = $rider->admin_remarks;
        $summary['accredited_at'] = $rider->accredited_at?->toIso8601String();
        $summary['revocation_reason'] = $rider->revocation_reason;
        $summary['document_verifications'] = $rider->documentVerifications()->with('verifier:id,full_name')->get();
        $summary['orientations'] = $rider->orientations()->with('facilitator:id,full_name')->get();
        $summary['inspections'] = $rider->inspections()->with('inspector:id,full_name')->get();
        $summary['history'] = $rider->accreditationHistory()->with('actor:id,full_name')->get();

        return $summary;
    }

    /* ---------------------------------------------------------------- Internals */

    /** @template T  @param callable(Rider): T $work @return T */
    private function transact(Rider $rider, AdminProfile $staff, callable $work): mixed
    {
        $this->authorizeStaff($staff);

        return DB::transaction(function () use ($rider, $staff, $work) {
            $locked = Rider::query()->lockForUpdate()->findOrFail($rider->id);

            // Nobody can act on their own rider application, even an administrator who is also a rider.
            if ($locked->user_id !== null && $locked->user_id === $staff->user_id) {
                throw new AuthorizationException('You cannot change your own accreditation.');
            }

            return $work($locked);
        });
    }

    /** Only an ACTIVE administrator account (role admin + active admin profile) is authorized staff. */
    private function authorizeStaff(AdminProfile $staff): void
    {
        $user = $staff->user;
        if (! $staff->isActive() || ! $user || ! $user->canAccessAdminArea('riders') || $user->adminProfile?->id !== $staff->id) {
            throw new AuthorizationException('Only active administrators or authorized staff can record accreditation activities.');
        }
    }

    private function activeStaff(string $adminProfileId, string $label): AdminProfile
    {
        $profile = AdminProfile::query()->find($adminProfileId);
        if (! $profile || ! $profile->user?->canAccessAdminArea('riders')) {
            throw new AccreditationException("The selected {$label} is not an active staff member.");
        }

        return $profile;
    }

    private function isSuperAdmin(AdminProfile $staff): bool
    {
        return $staff->role === 'super_admin';
    }

    /** A completed accreditation is changed only by revoking it first, so history is never silently rewritten. */
    private function guardNotAccredited(Rider $rider): void
    {
        if ($rider->accreditation_status === 'accredited') {
            throw new AccreditationException('This rider is already accredited. Revoke the accreditation before changing a completed stage.');
        }
    }

    /** Moves not_accredited <-> for_final_approval as stages pass or fail. Revoked/accredited are never changed here. */
    private function syncAccreditation(Rider $rider, AdminProfile $staff): void
    {
        if (! in_array($rider->accreditation_status, ['not_accredited', 'for_final_approval'], true)) {
            return;
        }

        $target = $this->missingRequirements($rider) === [] ? 'for_final_approval' : 'not_accredited';
        if ($target !== $rider->accreditation_status) {
            $from = $rider->accreditation_status;
            $rider->forceFill(['accreditation_status' => $target])->save();
            $this->log($rider, $staff, 'accreditation', 'accreditation.'.$target, $from, $target, null);
        }
    }

    /** Appends to rider_accreditation_history and to the existing audit_logs (shown on the rider's page). */
    public function log(Rider $rider, AdminProfile $actor, string $stage, string $action, ?string $from, ?string $to, ?string $remarks): void
    {
        RiderAccreditationHistory::create([
            'rider_id' => $rider->id, 'stage' => $stage, 'action' => $action,
            'from_status' => $from, 'to_status' => $to, 'actor_id' => $actor->id, 'remarks' => $remarks,
        ]);

        DB::table('audit_logs')->insert([
            'id' => (string) Str::uuid(), 'admin_id' => $actor->id, 'action' => 'rider.'.$action,
            'description' => $remarks, 'subject_type' => 'rider', 'subject_id' => $rider->id, 'created_at' => now(),
        ]);
    }

    private function notify(Rider $rider, string $type, string $title, string $message): void
    {
        if (! $rider->user_id) {
            return;
        }

        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $rider->user_id, 'title' => $title, 'message' => trim($message),
            'notification_type' => 'rider_'.$type, 'is_read' => false, 'created_at' => now(),
        ]);
    }

    /**
     * Keeps only the known keys, as strict booleans (missing key = false).
     *
     * @param  array<string, mixed>  $input
     * @param  list<string>  $keys
     * @return array<string, bool>
     */
    private function normalizeFlags(array $input, array $keys): array
    {
        $out = [];
        foreach ($keys as $key) {
            $out[$key] = filter_var($input[$key] ?? false, FILTER_VALIDATE_BOOLEAN);
        }

        return $out;
    }

    private function clean(?string $text): ?string
    {
        $text = trim((string) $text);

        return $text === '' ? null : $text;
    }
}
