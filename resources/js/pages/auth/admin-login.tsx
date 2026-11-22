import MigoAuthShell from '@/components/migo-auth-shell';
import MigoLoginForm from '@/components/migo-login-form';

/** Dedicated administrator login (GET /admin/login). No registration link: administrators are created by authorized staff only. */
export default function AdminLogin({ status }: { status?: string }) {
    return (
        <MigoAuthShell
            title="Administrator Login"
            subtitle="Authorized administrators only. Enter your credentials to access the system management dashboard."
            adminLink={false}
        >
            <MigoLoginForm portal="admin" status={status} />
        </MigoAuthShell>
    );
}
