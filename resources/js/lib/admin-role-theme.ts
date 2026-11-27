/**
 * Visual identity per admin-portal role (AdminProfile::ROLE_*).
 *   green  -> Administrator (super_admin, legacy admin)
 *   orange -> Operations Admin
 *   blue   -> Support Staff
 *
 * Class names are written out in full so Tailwind can detect them.
 */
export type AdminRoleTheme = {
    /** Role name shown under "MIGO" in the sidebar header. */
    label: string;
    /** Sidebar header (logo block) background. */
    sidebarHeader: string;
    /** Dashboard welcome banner background. */
    banner: string;
    /** Welcome title colour. */
    bannerTitle: string;
    /** "Welcome Back, ...!" */
    greeting: string;
    /** Line under the greeting. */
    tagline: string;
};

const administrator: AdminRoleTheme = {
    label: 'System Administrator',
    sidebarHeader: 'from-[#1B5240] via-[#17483A] to-[#0F2F25]',
    banner: 'from-m-mint via-m-mint to-[#C9E6D3] dark:to-[#244A3B]',
    bannerTitle: 'text-m-forest dark:text-m-ink',
    greeting: 'Welcome Back, Admin!',
    tagline: 'Here\u2019s an overview of your Migo management system.',
};

const operations: AdminRoleTheme = {
    label: 'Operations Admin',
    sidebarHeader: 'from-[#EA7A1C] via-[#D96A10] to-[#A9500C]',
    banner: 'from-[#FDEBD8] via-[#FDEBD8] to-[#F8D3A8] dark:from-[#3A2614] dark:via-[#3A2614] dark:to-[#5A3818]',
    bannerTitle: 'text-[#B85410] dark:text-[#FFB067]',
    greeting: 'Welcome Back, Operations Admin!',
    tagline: 'Here\u2019s an overview of your Migo operations.',
};

const support: AdminRoleTheme = {
    label: 'Support Staff',
    sidebarHeader: 'from-[#2F6FB5] via-[#265E9C] to-[#173D68]',
    banner: 'from-[#E1ECF8] via-[#E1ECF8] to-[#BCD5F0] dark:from-[#16283D] dark:via-[#16283D] dark:to-[#23406A]',
    bannerTitle: 'text-[#1F5A99] dark:text-[#8FC1F5]',
    greeting: 'Welcome Back, Support Staff!',
    tagline: 'Here\u2019s an overview of your Migo support center.',
};

const themes: Record<string, AdminRoleTheme> = {
    super_admin: administrator,
    admin: administrator,
    operations_admin: operations,
    support_staff: support,
};

export const adminRoleTheme = (role?: string | null): AdminRoleTheme =>
    (role && themes[role]) || administrator;