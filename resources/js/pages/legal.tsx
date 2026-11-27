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
                heading: 'About this policy',
                body: 'Migo is a ride and delivery platform that connects customers with registered riders and drivers. This policy explains what information we collect and how we use it.',
            },
            {
                heading: 'What we collect',
                body: "Visitors can browse the public pages without an account. Customers do not fill in a registration form: they sign in with their Google account. When you sign in with Google we collect the name and email address of your Google account (we never receive your Google password), and a profile photo if you choose to upload one. Riders and drivers who register provide their name, email address, contact number and password. They also provide their home address, driver's license number and expiry date, plate number and, optionally, a profile photo. Supporting documents, such as a driver's license, vehicle registration, official receipt and NBI clearance, are uploaded so an administrator can review the application. Passwords are stored only as a hash. A session cookie keeps a signed-in user signed in.",
            },
            {
                heading: 'Sign-in and payment services',
                body: "Google sign-in is provided by Google and is subject to Google's own privacy policy. Rider subscription payments are completed on the payment provider's secure checkout page. We receive the payment status but do not store your card details.",
            },
            {
                heading: 'How we use your information',
                body: 'Your name, email address and contact details are used to identify your account, run the ride and delivery features, review rider applications and respond to support requests. Documents uploaded by riders are visible only to the administrators who review them and to the rider who submitted them.',
            },
            {
                heading: 'Changes to this policy',
                body: 'We may update this policy from time to time. Continuing to use the website after an update means you accept the revised policy.',
            },
        ],
    },
    terms: {
        title: 'Terms and Conditions',
        sections: [
            {
                heading: 'About Migo',
                body: 'Migo is a ride and delivery platform that connects customers with registered riders and drivers. By using this website you agree to these terms.',
            },
            {
                heading: 'Customer accounts',
                body: 'Customers do not fill in a registration form. You sign in with your Google account, and a customer account is created automatically the first time you sign in successfully. By signing in, you agree to the collection of your Google name and email address as described in the Privacy Policy.',
            },
            {
                heading: 'Rider and driver accounts',
                body: 'Bikers and drivers apply for an account through the rider registration form. Each application must be approved by an administrator. Approved riders must then complete the accreditation process, which covers document verification, orientation and a vehicle inspection, before they can accept service requests.',
            },
            {
                heading: 'Administrator accounts',
                body: 'Administrator accounts are created only by an authorized person. There is no public administrator registration.',
            },
            {
                heading: 'Trademarks',
                body: 'The Migo name and logo may not be used without permission.',
            },
            {
                heading: 'Changes to these terms',
                body: 'We may update these terms from time to time. Continuing to use the website after an update means you accept the revised terms.',
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
                    &copy; Migo. All rights reserved.
                </footer>
            </div>
        </>
    );
}