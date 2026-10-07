'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useExpense } from '@/context/ExpenseContext';
import { employeeById, matchesEmployee } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { ReceiptIcon } from '@/components/icons';
import { EmpId, ListSearch } from '@/components/ui/EmployeeBits';

export default function ExpenseApprovalsPage() {
  const { location } = useApp();
  const { categories, claims, decide } = useExpense();
  const me = useCurrentEmployee();
  const [q, setQ] = useState('');

  const allPending = claims.filter((c) => c.status === 'Pending' && employeeById(c.employeeId)?.location === location);
  const pending = allPending.filter((c) => matchesEmployee(employeeById(c.employeeId)!, q));
  const act = (id: string, status: 'Approved' | 'Rejected') => decide(id, status, me.name, '');

  return (
    <div>
      <PageHeader eyebrow="Expense Claims" title="Approvals" description={`Claims awaiting management sign-off — ${location}.`} />
      <Card>
        <CardHeader title="Pending approval" sub={`${allPending.length} claim(s)`} />
        <ListSearch value={q} onChange={setQ} shown={pending.length} total={allPending.length} />
        {!pending.length ? (
          <EmptyState icon={<ReceiptIcon />} title={q ? 'No matches' : 'Inbox zero'} description={q ? 'No claims match your search.' : `No claims awaiting approval for ${location}.`} />
        ) : (
          pending.map((c) => {
            const e = employeeById(c.employeeId)!;
            const cat = categories.find((x) => x.name === c.category);
            const limit = cat?.limits[c.currency] ?? Infinity;
            const overLimit = c.amount > limit;
            return (
              <div key={c.id} style={{ borderTop: '1px solid var(--border-soft)', padding: '14px 18px' }}>
                <div className="doc" style={{ border: 'none', margin: 0, padding: 0 }}>
                  <div className="fic">
                    <ReceiptIcon />
                  </div>
                  <Link href={`/directory/${e.employeeCode}`} style={{ flex: 1 }}>
                    <div className="nm">
                      {e.name}
                      <EmpId code={e.employeeCode} /> · {c.category} · {c.currency} {c.amount.toLocaleString()}
                    </div>
                    <div className="mt">
                      {c.project} · {c.description}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>Submitted {c.date}</div>
                  </Link>
                  <div className="rt" style={{ gap: 6 }}>
                    <Button size="sm" variant="success" onClick={() => act(c.id, 'Approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => act(c.id, 'Rejected')}>
                      Reject
                    </Button>
                  </div>
                </div>
                {overLimit && (
                  <div className="note-box warn" style={{ marginTop: 10 }}>
                    Exceeds the {c.currency} {limit.toLocaleString()} policy limit for {c.category} — requires an additional management sign-off.
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
