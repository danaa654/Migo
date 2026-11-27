<?php

namespace App\Http\Controllers;

use App\Support\RiderDocuments;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A rider can open the documents they submitted. The rider is always the signed-in user's own record: there is no
 * rider id in the URL, so one rider can never reach another rider's files. View only.
 */
class BikerDocumentController extends Controller
{
    public function __invoke(Request $request, string $type): StreamedResponse
    {
        $rider = $request->user()->rider;
        abort_unless($rider, 404);

        $path = RiderDocuments::path($rider, $type);
        abort_unless($path, 404);

        return Storage::disk('local')->response($path, basename($path), [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        ], 'inline');
    }
}