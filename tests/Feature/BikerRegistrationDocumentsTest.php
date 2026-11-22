<?php

namespace Tests\Feature;

use App\Models\Rider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Biker registration requires the four supporting uploads and the document consent. */
class BikerRegistrationDocumentsTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $override = []): array
    {
        return array_merge([
            'vehicle_type' => 'two_wheel', 'full_name' => 'Juan Dela Cruz', 'email' => 'juan@example.com', 'phone' => '09171234567',
            'address' => 'Ipil, Zamboanga Sibugay', 'license_number' => 'N01-23-456789', 'license_expiry' => now()->addYear()->toDateString(),
            'motorcycle_plate_number' => 'ABC 1234', 'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'terms' => true, 'document_consent' => true,
            'license_document' => UploadedFile::fake()->image('license.jpg'),
            'registration_document' => UploadedFile::fake()->image('orcr.png'),
            'official_receipt' => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf'),
            'nbi_clearance' => UploadedFile::fake()->create('nbi.pdf', 100, 'application/pdf'),
        ], $override);
    }

    public function test_registration_with_all_documents_succeeds_and_stores_them_privately(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $this->post('/register/biker', $this->payload())->assertRedirect('/login');

        $rider = Rider::where('email', 'juan@example.com')->firstOrFail();
        $this->assertSame('pending', $rider->application_status);
        foreach (['license_document', 'registration_document', 'official_receipt', 'nbi_clearance'] as $column) {
            $this->assertNotNull($rider->{$column});
            Storage::disk('local')->assertExists($rider->{$column});
        }
    }

    public function test_each_document_is_required(): void
    {
        Storage::fake('local');

        foreach (['license_document', 'registration_document', 'official_receipt', 'nbi_clearance'] as $field) {
            $data = $this->payload();
            unset($data[$field]);
            $this->post('/register/biker', $data)->assertSessionHasErrors($field);
        }
        $this->assertSame(0, Rider::count());
    }

    public function test_document_consent_is_required(): void
    {
        $this->post('/register/biker', $this->payload(['document_consent' => false]))->assertSessionHasErrors('document_consent');
        $this->assertSame(0, Rider::count());
    }

    public function test_disguised_or_oversized_files_are_rejected(): void
    {
        Storage::fake('local');

        // A script renamed to .pdf is not a real PDF; a 6 MB file is over the limit.
        $fake = UploadedFile::fake()->createWithContent('license.pdf', '<?php echo 1;');
        $this->post('/register/biker', $this->payload(['license_document' => $fake]))->assertSessionHasErrors('license_document');
        $this->post('/register/biker', $this->payload(['nbi_clearance' => UploadedFile::fake()->create('nbi.pdf', 6000, 'application/pdf')]))->assertSessionHasErrors('nbi_clearance');
        $this->assertSame(0, Rider::count());
    }

    public function test_expired_license_is_rejected(): void
    {
        $this->post('/register/biker', $this->payload(['license_expiry' => now()->subDay()->toDateString()]))->assertSessionHasErrors('license_expiry');
    }
}
