import CustomerShell from '@/components/customer-shell';
import SupportCenter, { type SupportCenterProps } from '@/components/support-center';

type Props = Omit<SupportCenterProps, 'variant' | 'postUrl'>;

/** Passenger side of the Support Center: complaint, support request or incident report in one page. */
export default function CustomerComplaints(props: Props) {
    return (
        <CustomerShell title="Support">
            <SupportCenter variant="customer" postUrl="/customer/complaints" {...props} />
        </CustomerShell>
    );
}
