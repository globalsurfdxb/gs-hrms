'use client';

import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { employeeById } from '@/lib/data';
import { useExpense } from '@/context/ExpenseContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { CheckIcon, GridIcon, InboxIcon, ReceiptIcon } from '@/components/icons';

export default function ExpenseDashboardPage() {
  const { location } = useApp();
  const { locationDef, locationName } = useOrg();
  const { claims } = useExpense();
  const cur = locationDef(location)?.currency ?? 'AED';

  const scoped = claims.filter((c) => employeeById(c.employeeId)?.location === location);
  const pending = scoped.filter((c) => c.status === 'Pending');
  const approved = scoped.filter((c) => c.status === 'Approved');
  const pendingAmount = pending.reduce((n, c) => n + c.amount, 0);
  const approvedAmount = approved.reduce((n, c) => n + c.amount, 0);

  const byCategory = Object.entries(
    scoped.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + c.amount;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...byCategory.map(([, n]) => n));

  return (
    <div>
      <PageHeader eyebrow="Expense Claims" title="Expense Dashboard" description={`Claim volume and spend for ${location}, current cycle.`} />

      <div className="g4">
        <StatCard icon={<ReceiptIcon />} bg="var(--primary-50)" fg="var(--primary)" value={scoped.length} label="Total claims" foot={`${cur} across ${locationName(location)}`} />
        <StatCard icon={<InboxIcon />} bg="var(--warning-50)" fg="#B45309" value={pending.length} label="Pending approval" foot={`${cur} ${pendingAmount.toLocaleString()}`} />
        <StatCard icon={<CheckIcon />} bg="var(--success-50)" fg="#15803D" value={approved.length} label="Approved" foot={`${cur} ${approvedAmount.toLocaleString()}`} />
        <StatCard icon={<GridIcon />} bg="var(--orange-50)" fg="#C2410C" value={byCategory[0]?.[0] ?? '—'} label="Top category" foot={byCategory[0] ? `${cur} ${byCategory[0][1].toLocaleString()}` : undefined} />
      </div>

      <div className="g2 row-gap">
        <Card>
          <CardHeader title="Spend by category" sub={`${location} · this cycle`} />
          <div className="barchart">
            {byCategory.map(([cat, amt]) => (
              <div key={cat} className="bc-row">
                <div className="bl">{cat}</div>
                <div className="bc-track">
                  <div className="bc-fill" style={{ width: `${(amt / maxCat) * 100}%` }}>
                    {amt.toLocaleString()}
                  </div>
                </div>
                <span className="bv" />
              </div>
            ))}
            {!byCategory.length && <div className="empty">No claims for {location}.</div>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent claims" sub={`${location}`} action={<Link href="/expense/claims" className="lnk">View all →</Link>} />
          {scoped.slice(0, 5).map((c) => {
            const e = employeeById(c.employeeId)!;
            return (
              <div key={c.id} className="doc">
                <div className="fic">
                  <ReceiptIcon />
                </div>
                <div>
                  <div className="nm">
                    {e.name} · {c.category}
                  </div>
                  <div className="mt">
                    {c.currency} {c.amount.toLocaleString()} · {c.date}
                  </div>
                </div>
                <div className="rt">
                  <StatusBadge status={c.status === 'Approved' ? 'Approved' : c.status === 'Rejected' ? 'Rejected' : 'Pending'} />
                </div>
              </div>
            );
          })}
          {!scoped.length && <div className="empty">No claims for {location}.</div>}
        </Card>
      </div>
    </div>
  );
}
