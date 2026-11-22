import { MigoBrand, TopBar } from '@/components/migo-bar';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

type Section = { heading: string; body: string };

const pages: Record<
    'privacy' | 'terms',
    { title: string; sections: Section[] }
> = {
    privacy: {
        title: 'Privacy Policy',
        sections: [
            {
                heading: 'About this website',
                body: 'This is a proposed academic project. It is built for study and demonstration and is not a commercial service.',
            },
            {
                heading: 'What this website collects',
                body: "Visitors can browse the public pages without an account. Customers do not fill in a registration form: they sign in with Google or with their mobile number. For Google sign-in we collect the name and email address of the Google account (we never receive your Google password). For phone sign-in we collect your mobile number, which you confirm with a one-time code sent by SMS, and the full name you enter on your profile. Bikers who register provide their name, email address, contact number and password. Bikers also provide their home address, driver's license number and expiry date, motorcycle plate number and, optionally, a profile photo so an administrator can review the application. Passwords are stored only as a hash. One-time codes are stored only as a hash and expire after 5 minutes. A session cookie keeps a signed-in user signed in.",
            },
            {
                heading: 'Sign-in services',
                body: "Google sign-in is provided by Google and is subject to Google's own privacy policy. One-time codes are delivered by text message through an SMS provider, which receives your mobile number and the message so it can deliver it. Your name, email address and mobile number are used to identify your account and to run the ride features of this project.",
            },
            {
                heading: 'What this website does not collect',
                body: 'This website does not process payments, and it does not ask for government ID images. Ride bookings made here are for academic demonstration only.',
            },
            {
                heading: 'Status',
                body: 'This page is a placeholder for the academic project. It should be reviewed and completed by the project team before any real use.',
            },
        ],
    },
    terms: {
        title: 'Terms and Conditions',
        sections: [
            {
                heading: 'Academic project',
                body: 'This website is a proposed academic project built for study and demonstration.',
            },
            {
                heading: 'No real services',
                body: 'Accounts and ride bookings exist only for this academic demonstration and do not represent a real transport service.',
            },
            {
                heading: 'Accounts',
                body: 'Customers do not register: they sign in with Google or with their mobile number and a one-time SMS code, and a customer account is created automatically on the first successful sign-in. By signing in, customers agree to the collection of their Google name and email address or their mobile number as described in the Privacy Policy. Bikers and drivers apply for an account through the rider registration form. Biker accounts must be approved by an administrator and complete the accreditation process (document verification, orientation, motorcycle inspection) before they can accept service requests. Administrator accounts are created by an authorized person; there is no public administrator registration.',
            },
            {
                heading: 'Trademarks',
                body: 'Migo and its logo are used for this academic project only.',
            },
            {
                heading: 'Status',
                body: 'This page is a placeholder for the academic project. It should be reviewed and completed by the project team before any real use.',
            },
        ],
    },
};

export default function Legal({
    page = 'privacy',
}: {
    page?: 'privacy' | 'terms';
}) {
    const { title, sections } = pages[page] ?? pages.privacy;

    return (
        <>
            <Head title={title}>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <div
                className="min-h-screen bg-m-page text-m-body"
                style={{
                    fontFamily:
                        'Inter, Arial, ui-sans-serif, system-ui, sans-serif',
                }}
            >
                <TopBar width="max-w-3xl" sticky={false} left={<MigoBrand />} />
                <main className="mx-auto max-w-3xl px-5 py-10">
                    <article className="rounded-lg border border-m-line bg-m-card p-6 shadow-sm sm:p-8">
                        <h1 className="text-2xl font-semibold text-m-ink">
                            {title}
                        </h1>
                        <div className="mt-6 space-y-6">
                            {sections.map((s) => (
                                <section key={s.heading}>
                                    <h2 className="text-base font-semibold text-m-ink">
                                        {s.heading}
                                    </h2>
                                    <p className="mt-1.5 text-sm leading-relaxed text-m-muted">
                                        {s.body}
                                    </p>
                                </section>
                            ))}
                        </div>
                    </article>
                    <p className="mt-5 text-center">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 rounded text-sm font-medium text-m-accent hover:text-m-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                        >
                            <ArrowLeft className="size-4" aria-hidden /> Back to
                            Home
                        </Link>
                    </p>
                </main>
                <footer className="px-5 pb-6 text-center text-xs text-m-muted">
                    Proposed academic project.
                </footer>
            </div>
        </>
    );
}
