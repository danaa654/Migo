<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Complaint;
use App\Services\Complaints\ReportFilingService;
use App\Support\BikerShellData;
use App\Support\SupportCategories;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A rider's Support Center: send a complaint (about a passenger of one of their trips), a support request or an
 * incident report, and follow what the support team decided. Accredited riders only (biker.approved), and every
 * query is scoped to the signed-in rider's profile. Mirrors CustomerComplaintController.
 */
class BikerComplaintController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $rider = $user->rider ?? abort(403);

        $reports = Complaint::query()
            ->with('booking:id,booking_reference')
            ->where('reporter_type', 'rider')->where('reporter_id', $rider->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (Complaint $c) => [
                'id' => $c->id,
                'type' => $c->report_type,
                'type_label' => SupportCategories::typeLabel($c->report_type),
                'category' => SupportCategories::label($c->complaint_category),
                'description' => $c->description,
                'status' => $c->complaint_status,
                // The staff note is only shown once the report is closed.
                'response' => ! $c->isOpen() ? $c->resolution_note : null,
                'resolved_at' => $c->resolved_at?->toIso8601String(),
                'created_at' => $c->created_at?->toIso8601String(),
                'occurred_at' => $c->occurred_at?->toIso8601String(),
                'location' => $c->incident_location,
                'trip' => $c->booking ? ['reference' => $c->booking->booking_reference, 'party' => null] : null,
            ])->values();

        // Only trips assigned to this rider (and that have a passenger) can be reported.
        $bookings = Booking::query()
            ->with('passenger:id,full_name')
            ->where('rider_id', $rider->id)->whereNotNull('passenger_id')
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn (Booking $b) => [
                'id' => $b->id,
                'reference' => $b->booking_reference,
                'service' => $b->service_type?->label(),
                'party' => $b->passenger?->full_name,
                'created_at' => $b->created_at?->toIso8601String(),
            ])->values();

        $preselect = (string) $request->query('booking', '');

        return Inertia::render('biker/biker-complaints', [
            ...BikerShellData::props($user),
            'reports' => $reports,
            'bookings' => $bookings,
            'types' => SupportCategories::typeOptions(),
            'categories' => SupportCategories::allOptions('rider'),
            'preselect' => $bookings->contains('id', $preselect) ? $preselect : null,
            'openCount' => $reports->whereIn('status', Complaint::OPEN)->whereIn('type', ['complaint', 'support'])->count(),
            'maxOpen' => ReportFilingService::MAX_OPEN,
            'partyLabel' => 'Passenger',
            'tripRequiredForComplaint' => true,
        ]);
    }

    public function store(Request $request, ReportFilingService $filing): RedirectResponse
    {
        $rider = $request->user()->rider ?? abort(403);

        $request->merge(['description' => trim((string) $request->input('description'))]);
        $v = $filing->validation($request, 'rider');
        $data = $request->validate($v['rules'], $v['messages']);

        if ($errors = $filing->file('rider', $rider, $data)) {
            return back()->withErrors($errors)->withInput();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Your '.SupportCategories::noun($data['type']).' was sent. We will review it and update you here.']);

        return redirect('/biker/complaints');
    }
}
