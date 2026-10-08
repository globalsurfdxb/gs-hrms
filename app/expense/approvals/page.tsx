'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useExpense } from '@/context/ExpenseContext';
import { employeeById, matchesEmployee } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { ClockIcon, InboxIcon, ReceiptIcon, SearchIcon, WarnIcon } from '@/components/icons';
import { EmpId } from '@/components/ui/EmployeeBits';

export default function ExpenseApprovalsPage() {
  const { location } = useApp();
  const { categories, claims, decide } = useExpense();
  const me = useCurrentEmployee();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');

  const allPending = claims.filter((c) => c.status === 'Pending' && employeeById(c.employeeId)?.location === location);
  const pending = allPending.filter((c) => (category === 'All' || c.category === category) && matchesEmployee(employeeById(c.employeeId)!, q));
  const filtered = !!q.trim() || category !== 'All';
  const act = (id: string, status: 'Approved' | 'Rejected') => decide(id, status, me.name, '');

  const isOver = (c: (typeof claims)[number]) => c.amount > (categories.find((x) => x.name === c.category)?.limits[c.currency] ?? Infinity);
  const overCount = allPending.filter(isOver).length;
  const totals = allPending.reduce<Record<string, number>>((acc, c) => {
    acc[c.currency] = (acc[c.currency] ?? 0) + c.amount;
    return acc;
  }, {});
  const totalText = Object.entries(totals)
    .map(([cur, n]) => `${cur} ${n.toLocaleString('en-US')}`)
    .join(' · ');
  const oldest = allPending.map((c) => c.submittedOn ?? c.date).sort()[0];
  const people = new Set(allPending.map((c) => c.employeeId)).size;

  return (
    <div className="tx-page">
      <PageHeader eyebrow="Expense Claims" title="Approvals" description={`Claims awaiting management sign-off — ${location}.`} />

      <StatStrip
        items={[
          { label: 'Awaiting approval', value: allPending.length, icon: <InboxIcon />, tone: 'amber', hint: `From ${people} employee(s)` },
          { label: 'Pending value', value: totalText || '—', icon: <ReceiptIcon />, tone: 'blue', hint: 'Across all pending claims' },
          { label: 'Over policy limit', value: overCount, icon: <WarnIcon />, tone: overCount ? 'red' : 'gray', hint: overCount ? 'Need extra sign-off' : 'All within limits' },
          { label: 'Oldest submission', value: oldest ?? '—', icon: <ClockIcon />, tone: 'purple', hint: oldest ? 'Longest waiting' : 'Nothing waiting' },
        ]}
      />

      <Card>
        <CardHeader title="Pending approval" sub={`${allPending.length} claim(s)`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="chip">
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="sp" />
          <span className="tx-count">
            {pending.length} of {allPending.length}
          </span>
        </div>
        {!pending.length ? (
          <EmptyState icon={<ReceiptIcon />} title={filtered ? 'No matches' : 'Inbox zero'} description={filtered ? 'No claims match your search or filter.' : `No claims awaiting approval for ${location}.`} />
        ) : (
          <div className="tx-list">
            {pending.map((c) => {
              const e = employeeById(c.employeeId)!;
              const cat = categories.find((x) => x.name === c.category);
              const limit = cat?.limits[c.currency] ?? Infinity;
              const overLimit = c.amount > limit;
              return (
                <div key={c.id} className="tx-grp">
                  <div className="tx-item">
                    <Link href={`/directory/${e.employeeCode}`} className="tx-av">
                      {e.avatarInitials}
                    </Link>
                    <div className="tx-main">
                      <Link href={`/directory/${e.employeeCode}`} className="tx-t">
                        {e.name}
                        <EmpId code={e.employeeCode} />
                      </Link>
                      <div className="tx-s">
                        {c.project} · {c.description}
                      </div>
                      <div className="tx-s faint">Submitted {c.submittedOn ?? c.date}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tx-t mono" style={{ fontSize: 14 }}>
                        {c.currency} {c.amount.toLocaleString()}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        {overLimit ? <Badge tone="soon">Over limit</Badge> : <span className="tx-pill">{c.category}</span>}
                      </div>
                    </div>
                    <div className="tx-actions" style={{ marginLeft: 0 }}>
                      <Button size="sm" variant="success" onClick={() => act(c.id, 'Approved')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => act(c.id, 'Rejected')}>
                        Reject
                      </Button>
                    </div>
                  </div>
                  {overLimit && (
                    <div className="note-box warn tx-over">
                      <WarnIcon />
                      <div>
                        Exceeds the {c.currency} {limit.toLocaleString()} policy limit for {c.category} — requires an additional management sign-off.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!!pending.length && (
          <div className="tfoot">
            <span>
              Showing {pending.length} of {allPending.length}
              {overCount ? ` · ${overCount} over policy limit` : ''}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
