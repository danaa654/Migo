import { Link } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';

export default function Placeholder({ title }: { title: string }) {
    return (
        <AdminLayout title={title}>
            <div className="rounded-lg border border-m-line bg-m-card p-8 text-center shadow-sm">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-m-muted">
                    This module has not been built yet. It will be added in a
                    later phase.
                </p>
                <Link
                    href="/admin/dashboard"
                    className="mt-5 inline-block rounded-md bg-m-forest px-4 py-2 text-sm font-medium text-white hover:bg-m-forest-hover"
                >
                    Back to Dashboard
                </Link>
            </div>
        </AdminLayout>
    );
}
