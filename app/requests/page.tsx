'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { EMPLOYEES, employeeById, matchesEmployee } from '@/lib/data';
import { useRequests } from '@/context/RequestsContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmpId, ListSearch } from '@/components/ui/EmployeeBits';
import { InboxIcon } from '@/components/icons';

export default function RequestsPage() {
  const { location } = useApp();
  const { requests, act } = useRequests();
  const [q, setQ] = useState('');

  const scopedIds = new Set(EMPLOYEES.filter((e) => e.location === location).map((e) => e.id));
  const allScoped = requests.filter((r) => scopedIds.has(r.employeeId));
  const scoped = allScoped.filter((r) => matchesEmployee(employeeById(r.employeeId)!, q));
  const pending = scoped.filter((r) => r.status === 'Pending');
  const resolved = scoped.filter((r) => r.status !== 'Pending');


  return (
    <div>
      <PageHeader eyebrow="Module 07 · Self-service" title="Employee Requests" description={`Information updates and document requests routed to HR / Manager for approval — ${location}.`} />

      <Card>
        <CardHeader title="Pending approval" sub={`${pending.length} awaiting action`} />
        <ListSearch value={q} onChange={setQ} shown={scoped.length} total={allScoped.length} />
        {!pending.length && <EmptyState icon={<InboxIcon />} title={q ? 'No matches' : 'Inbox zero'} description={q ? 'No pending requests match your search.' : `No pending requests for ${location}.`} />}
        {pending.map((r) => {
          const e = employeeById(r.employeeId)!;
          return (
            <div key={r.id} className="doc">
              <div className="fic">
                <InboxIcon />
              </div>
              <div>
                <div className="nm">
                  {e.name}
                  <EmpId code={e.employeeCode} /> · {r.type} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· routed to {r.routedTo}</span>
                </div>
                <div className="mt">{r.details}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>Raised {r.raisedOn}</div>
              </div>
              <div className="rt" style={{ gap: 6 }}>
                <Button size="sm" variant="success" onClick={() => act(r.id, 'Approved')}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" onClick={() => act(r.id, 'Rejected')}>
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="row-gap">
        <CardHeader title="Resolved" sub={`${resolved.length} request(s)`} />
        {!resolved.length && (
          <div className="empty">
            <p>Nothing resolved yet.</p>
          </div>
        )}
        {resolved.map((r) => {
          const e = employeeById(r.employeeId)!;
          return (
            <div key={r.id} className="doc">
              <div className="fic" style={{ background: 'var(--gray-50)', color: 'var(--text-2)' }}>
                {e.avatarInitials}
              </div>
              <div>
                <div className="nm">
                  {e.name}
                  <EmpId code={e.employeeCode} /> <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· {r.type}</span>
                </div>
                <div className="mt">{r.details}</div>
              </div>
              <div className="rt">
                <StatusBadge status={r.status} />
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
