'use client';

import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { employeeById } from '@/lib/data';
import { useExpense } from '@/context/ExpenseContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { CheckIcon, GridIcon, InboxIcon, ReceiptIcon, TagIcon } from '@/components/icons';

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
  const totalSpend = byCategory.reduce((n, [, v]) => n + v, 0);

  return (
    <div className="tx-page">
      <PageHeader eyebrow="Expense Claims" title="Expense Dashboard" description={`Claim volume and spend for ${location}, current cycle.`} />

      <StatStrip
        items={[
          { label: 'Total claims', value: scoped.length, icon: <ReceiptIcon />, tone: 'blue', hint: `${cur} across ${locationName(location)}`, href: '/expense/claims' },
          { label: 'Pending approval', value: pending.length, icon: <InboxIcon />, tone: 'amber', hint: `${cur} ${pendingAmount.toLocaleString()}`, href: '/expense/approvals' },
          { label: 'Approved', value: approved.length, icon: <CheckIcon />, tone: 'green', hint: `${cur} ${approvedAmount.toLocaleString()}` },
          { label: 'Top category', value: byCategory[0]?.[0] ?? '—', icon: <GridIcon />, tone: 'purple', hint: byCategory[0] ? `${cur} ${byCategory[0][1].toLocaleString()}` : 'No spend yet' },
        ]}
      />

      <div className="g2">
        <Card>
          <CardHeader title="Spend by category" sub={`${location} · this cycle · ${cur} ${totalSpend.toLocaleString()} total`} />
          {!byCategory.length ? (
            <EmptyState icon={<TagIcon />} title="No spend yet" description={`No claims have been filed for ${location} this cycle.`} />
          ) : (
            <div className="tx-spend">
              {byCategory.map(([cat, amt]) => (
                <div key={cat} className="tx-spend-row">
                  <span className="tx-cat-ic">
                    <TagIcon />
                  </span>
                  <div className="tx-t">{cat}</div>
                  <div className="tx-bar">
                    <i style={{ width: `${(amt / maxCat) * 100}%` }} />
                  </div>
                  <div className="tx-spend-n">
                    {amt.toLocaleString()}
                    <small>{totalSpend ? Math.round((amt / totalSpend) * 100) : 0}%</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent claims"
            sub={`${location}`}
            action={
              <Link href="/expense/claims" className="lnk">
                View all →
              </Link>
            }
          />
          {!scoped.length ? (
            <EmptyState icon={<ReceiptIcon />} title="No claims yet" description={`Claims filed for ${location} will show up here.`} />
          ) : (
            <div className="tx-list">
              {scoped.slice(0, 5).map((c) => {
                const e = employeeById(c.employeeId)!;
                return (
                  <div key={c.id} className="tx-item">
                    <div className="tx-av">{e.avatarInitials}</div>
                    <div className="tx-main">
                      <div className="tx-t">
                        {e.name} · {c.category}
                      </div>
                      <div className="tx-s">
                        {c.currency} {c.amount.toLocaleString()} · {c.date}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
