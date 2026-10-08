'use client';

import { OPS } from '@/lib/nav';
import { EMPLOYEES, ONBOARDING_REQUESTS, employeeById } from '@/lib/data';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { HEADCOUNT_NOTE, countHeadcount, employeesInScope, inScope } from '@/lib/headcount';
import { useApp } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { useExpense } from '@/context/ExpenseContext';
import { useSeparation } from '@/context/SeparationContext';
import { HubGrid } from '@/components/shell/HubGrid';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatStrip } from '@/components/ui/StatStrip';
import { ExitIcon, JoinIcon, PeopleIcon, ReceiptIcon } from '@/components/icons';

export default function OperationsPage() {
  useEmployeeVersion();
  const { location } = useApp();
  const { locationName } = useOrg();
  const { claims } = useExpense();
  const { cases, statusOf } = useSeparation();

  // Same scope and counting rules as the Dashboard, Directory and the approval pages these tiles link to.
  const hc = countHeadcount(employeesInScope(location, EMPLOYEES), statusOf);
  const openOnboarding = ONBOARDING_REQUESTS.filter((r) => r.status !== 'Approved' && inScope(location, r.location)).length;
  const openExits = cases.filter((c) => c.status !== 'Completed' && inScope(location, employeeById(c.employeeId)?.location ?? '')).length;
  const pendingClaims = claims.filter((c) => c.status === 'Pending' && inScope(location, employeeById(c.employeeId)?.location ?? '')).length;

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Operations" description={`Management hub — employee lifecycle, documents and expense claims for ${locationName(location)}.`} />
      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Active employees', value: hc.active, icon: <PeopleIcon />, tone: 'blue', hint: `${hc.total} total incl. joining`, href: '/directory' },
            { label: 'Joining', value: hc.joining, icon: <JoinIcon />, tone: 'green', hint: `${openOnboarding} open onboarding case${openOnboarding === 1 ? '' : 's'}`, href: '/onboarding' },
            { label: 'Exiting', value: openExits, icon: <ExitIcon />, tone: 'purple', hint: 'Open offboarding cases', href: '/offboarding' },
            { label: 'Claims to approve', value: pendingClaims, icon: <ReceiptIcon />, tone: pendingClaims ? 'amber' : 'gray', href: '/expense/approvals' },
          ]}
        />
      </div>
      <p className="rs-defn">{HEADCOUNT_NOTE}</p>
      <HubGrid sections={OPS} hub="/operations" />
    </div>
  );
}
