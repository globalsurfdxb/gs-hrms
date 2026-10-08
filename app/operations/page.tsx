'use client';

import { OPS } from '@/lib/nav';
import { EMPLOYEES, EXPENSE_CLAIMS, OFFBOARDING_REQUESTS, ONBOARDING_REQUESTS } from '@/lib/data';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { HubGrid } from '@/components/shell/HubGrid';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatStrip } from '@/components/ui/StatStrip';
import { ExitIcon, JoinIcon, PeopleIcon, ReceiptIcon } from '@/components/icons';

export default function OperationsPage() {
  useEmployeeVersion();

  const active = EMPLOYEES.filter((e) => e.employmentStatus !== 'Inactive').length;
  const joining = ONBOARDING_REQUESTS.filter((r) => r.status !== 'Approved').length;
  const leaving = OFFBOARDING_REQUESTS.filter((r) => r.status !== 'Completed').length;
  const pendingClaims = EXPENSE_CLAIMS.filter((c) => c.status === 'Pending').length;

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Operations" description="Management hub — employee lifecycle, documents and expense claims." />
      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Active employees', value: active, icon: <PeopleIcon />, tone: 'blue', href: '/directory' },
            { label: 'Joining soon', value: joining, icon: <JoinIcon />, tone: 'green', hint: 'Open onboarding cases', href: '/onboarding' },
            { label: 'Open exits', value: leaving, icon: <ExitIcon />, tone: 'purple', hint: 'Offboarding in progress', href: '/offboarding' },
            { label: 'Claims to approve', value: pendingClaims, icon: <ReceiptIcon />, tone: pendingClaims ? 'amber' : 'gray', href: '/expense/approvals' },
          ]}
        />
      </div>
      <HubGrid sections={OPS} hub="/operations" />
    </div>
  );
}
