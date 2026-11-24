import type { Notifications } from '@/components/biker-notifications';
import BikerShell from '@/components/biker-shell';
import SupportCenter, { type SupportCenterProps } from '@/components/support-center';

type Props = Omit<SupportCenterProps, 'variant' | 'postUrl'> & {
    account: { name: string; email: string };
    notifications: Notifications;
};

/** Restricted: the server only serves this page to accredited bikers. Complaint, support request or incident report. */
export default function BikerComplaints({ account, notifications, ...rest }: Props) {
    return (
        <BikerShell
            account={account}
            canBook
            active="complaints"
            notifications={notifications}
            progress={{ cleared: 6, total: 6 }}
        >
            <div className="flex flex-col gap-4">
                <SupportCenter variant="biker" postUrl="/biker/complaints" {...rest} />
            </div>
        </BikerShell>
    );
}
