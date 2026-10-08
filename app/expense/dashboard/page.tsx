'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { defaultScope, employeeById } from '@/lib/data';
import { useExpense } from '@/context/ExpenseContext';
import { ExpenseClaim } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { CheckIcon, GridIcon, InboxIcon, ReceiptIcon, TagIcon } from '@/components/icons';

const sumBy = (list: ExpenseClaim[]) => {
  const by: Record<string, number> = {};
  list.forEach((c) => (by[c.currency] = (by[c.currency] ?? 0) + c.amount));
  return by;
};
const fmt = (cur: string, n: number) => `${cur} ${n.toLocaleString('en-US')}`;
/** Per-currency totals; amounts in different currencies are never added together. */
const moneyText = (by: Record<string, number>) => {
  const parts = Object.entries(by).map(([cur, n]) => fmt(cur, n));
  return parts.length ? parts.join(' · ') : '—';
};
const moneyStack = (by: Record<string, number>) => {
  const parts = Object.entries(by);
  if (!parts.length) return '—';
  return (
    <>
      {parts.map(([cur, n]) => (
        <span key={cur} className="rq-money">
          {fmt(cur, n)}
        </span>
      ))}
    </>
  );
};

export default function ExpenseDashboardPage() {
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { locations, locationName } = useOrg();
  const { claims } = useExpense();
  const [pick, setPick] = useState<string | null>(null);
  const loc = pick ?? defaultScope(role, me.location);
  const scopeName = loc === 'All' ? 'All locations' : locationName(loc);

  const scoped = claims.filter((c) => {
    const l = employeeById(c.employeeId)?.location;
    return !!l && (loc === 'All' || l === loc);
  });
  const of = (s: ExpenseClaim['status']) => scoped.filter((c) => c.status === s);
  const pending = of('Pending');
  const approved = of('Approved');
  const rejected = of('Rejected');
  const currencies = [...new Set(scoped.map((c) => c.currency))].sort();

  // Spend means approved claims only; everything submitted is shown separately.
  const byCategory = (cur: string) =>
    Object.entries(
      approved
        .filter((c) => c.currency === cur)
        .reduce<Record<string, number>>((acc, c) => {
          acc[c.category] = (acc[c.category] ?? 0) + c.amount;
          return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]);
  const tops = currencies.map((cur) => ({ cur, top: byCategory(cur)[0] })).filter((t) => t.top);
  const topNames = [...new Set(tops.map((t) => t.top[0]))];

  return (
    <div className="tx-page">
      <PageHeader eyebrow="Expense Claims" title="Expense Dashboard" description={`Claim volume and approved spend for ${scopeName}${currencies.length ? ` (${currencies.join(' and ')}, shown separately)` : ''}.`} />

      <div className="tbar" style={{ marginBottom: 14 }}>
        <select className="chip" value={loc} onChange={(e) => setPick(e.target.value)} aria-label="Filter by location">
          <option value="All">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <span className="tx-count">{scoped.length} claim(s) in scope</span>
      </div>

      <StatStrip
        items={[
          { label: 'Total claims', value: scoped.length, icon: <ReceiptIcon />, tone: 'blue', hint: `Submitted value ${moneyText(sumBy(scoped))}`, href: '/expense/claims' },
          { label: 'Pending approval', value: pending.length, icon: <InboxIcon />, tone: 'amber', hint: `Pending value ${moneyText(sumBy(pending))}`, href: '/expense/approvals' },
          { label: 'Approved spend', value: moneyStack(sumBy(approved)), icon: <CheckIcon />, tone: 'green', hint: `${approved.length} approved claim(s) · ${scopeName}` },
          { label: 'Top category', value: topNames.length ? topNames.join(' · ') : '—', icon: <GridIcon />, tone: 'purple', hint: tops.length ? `By approved spend · ${tops.map((t) => fmt(t.cur, t.top[1])).join(' · ')}` : 'No approved spend yet' },
        ]}
      />

      <div className="g2">
        <Card>
          <CardHeader title="Approved spend by category" sub={`${scopeName} · approved claims only · ${moneyText(sumBy(approved))}`} />
          {!approved.length ? (
            <EmptyState icon={<TagIcon />} title="No approved spend yet" description={`No claims have been approved for ${scopeName}.`} />
          ) : (
            currencies.map((cur) => {
              const rows = byCategory(cur);
              if (!rows.length) return null;
              const max = Math.max(1, ...rows.map(([, n]) => n));
              const total = rows.reduce((n, [, v]) => n + v, 0);
              return (
                <div key={cur} className="tx-spend">
                  {currencies.length > 1 && <div className="rq-cur">{cur}</div>}
                  {rows.map(([cat, amt]) => (
                    <div key={cat} className="tx-spend-row">
                      <span className="tx-cat-ic">
                        <TagIcon />
                      </span>
                      <div className="tx-t">{cat}</div>
                      <div className="tx-bar">
                        <i style={{ width: `${(amt / max) * 100}%` }} />
                      </div>
                      <div className="tx-spend-n">
                        {fmt(cur, amt)}
                        <small>{total ? Math.round((amt / total) * 100) : 0}%</small>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
          <div className="rq-status">
            <div className="rq-status-h">Claim value by status</div>
            <table>
              <tbody>
                {(
                  [
                    ['Submitted (all claims)', scoped],
                    ['Pending', pending],
                    ['Approved (spend)', approved],
                    ['Rejected', rejected],
                  ] as [string, ExpenseClaim[]][]
                ).map(([label, list]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="mono">{list.length}</td>
                    <td className="mono">{moneyText(sumBy(list))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent claims"
            sub={scopeName}
            action={
              <Link href="/expense/claims" className="lnk">
                View all →
              </Link>
            }
          />
          {!scoped.length ? (
            <EmptyState icon={<ReceiptIcon />} title="No claims yet" description={`Claims filed for ${scopeName} will show up here.`} />
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
