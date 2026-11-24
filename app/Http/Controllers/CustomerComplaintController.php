<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Complaint;
use App\Services\Complaints\ReportFilingService;
use App\Support\SupportCategories;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A passenger's Support Center: send a complaint, a support request or an incident report (optionally about a trip)
 * and follow what the support team decided. Every query is scoped to the signed-in customer's passenger profile.
 */
class CustomerComplaintController extends Controller
{
    public function index(Request $request): Response
    {
        $passenger = $request->user()->passenger ?? abort(403);

        $reports = Complaint::query()
            ->with('booking.rider:id,full_name')
            ->where('reporter_type', 'passenger')->where('reporter_id', $passenger->id)
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
                'trip' => $c->booking ? ['reference' => $c->booking->booking_reference, 'party' => $c->booking->rider?->full_name] : null,
            ])->values();

        // Only trips that had a rider can be reported.
        $bookings = Booking::query()
            ->with('rider:id,full_name')
            ->where('passenger_id', $passenger->id)->whereNotNull('rider_id')
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn (Booking $b) => [
                'id' => $b->id,
                'reference' => $b->booking_reference,
                'service' => $b->service_type?->label(),
                'party' => $b->rider?->full_name,
                'created_at' => $b->created_at?->toIso8601String(),
            ])->values();

        $preselect = (string) $request->query('booking', '');

        return Inertia::render('customer/customer-complaints', [
            'reports' => $reports,
            'bookings' => $bookings,
            'types' => SupportCategories::typeOptions(),
            'categories' => SupportCategories::allOptions('passenger'),
            'preselect' => $bookings->contains('id', $preselect) ? $preselect : null,
            'openCount' => $reports->whereIn('status', Complaint::OPEN)->whereIn('type', ['complaint', 'support'])->count(),
            'maxOpen' => ReportFilingService::MAX_OPEN,
            'partyLabel' => 'Rider',
            'tripRequiredForComplaint' => false,
        ]);
    }

    public function store(Request $request, ReportFilingService $filing): RedirectResponse
    {
        $passenger = $request->user()->passenger ?? abort(403);

        $request->merge(['description' => trim((string) $request->input('description'))]);
        $v = $filing->validation($request, 'passenger');
        $data = $request->validate($v['rules'], $v['messages']);

        if ($errors = $filing->file('passenger', $passenger, $data)) {
            return back()->withErrors($errors)->withInput();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Your '.SupportCategories::noun($data['type']).' was sent. We will review it and update you here.']);

        return redirect('/customer/complaints');
    }
}
