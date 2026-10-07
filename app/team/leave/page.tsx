'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { LEAVE_BALANCES, LEAVE_REQUESTS, directReports, employeeById, matchesEmployee } from '@/lib/data';
import { LeaveRequest } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmpId, ListSearch } from '@/components/ui/EmployeeBits';
import { ClockIcon } from '@/components/icons';

export default function TeamLeavePage() {
  const me = useCurrentEmployee();
  const team = directReports(me.id);
  const teamIds = new Set(team.map((t) => t.id));
  const [requests, setRequests] = useState<LeaveRequest[]>(LEAVE_REQUESTS);
  const [q, setQ] = useState('');

  const teamRequests = requests.filter((r) => teamIds.has(r.employeeId) && matchesEmployee(employeeById(r.employeeId)!, q));
  const visibleTeam = team.filter((e) => matchesEmployee(e, q));
  const pending = teamRequests.filter((r) => r.status === 'Pending');
  const resolved = teamRequests.filter((r) => r.status !== 'Pending');

  const act = (id: string, status: LeaveRequest['status']) => setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

  return (
    <div>
      <PageHeader eyebrow="Team · Leave" title="Team Leave" description="Leave requests and balances for your direct reports." />

      <Card>
        <CardHeader title="Pending approval" sub={`${pending.length} request(s)`} />
        <ListSearch value={q} onChange={setQ} shown={visibleTeam.length} total={team.length} placeholder="Search team by name or employee ID…" />
        {!pending.length ? (
          <EmptyState icon={<ClockIcon />} title="Inbox zero" description="No leave requests awaiting your approval." />
        ) : (
          pending.map((r) => {
            const e = employeeById(r.employeeId)!;
            return (
              <div key={r.id} className="doc">
                <div className="fic">
                  <ClockIcon />
                </div>
                <div>
                  <div className="nm">
                    {e.name}
                    <EmpId code={e.employeeCode} /> · {r.type} leave · {r.days} day(s)
                  </div>
                  <div className="mt">
                    {r.fromDate} → {r.toDate} · {r.reason}
                  </div>
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
          })
        )}
      </Card>

      <Card className="row-gap">
        <CardHeader title="Resolved" sub={`${resolved.length} request(s)`} />
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
                  <EmpId code={e.employeeCode} /> · {r.type} leave
                </div>
                <div className="mt">
                  {r.fromDate} → {r.toDate}
                </div>
              </div>
              <div className="rt">
                <StatusBadge status={r.status} />
              </div>
            </div>
          );
        })}
        {!resolved.length && (
          <div className="empty">
            <p>Nothing resolved yet.</p>
          </div>
        )}
      </Card>

      <Card className="row-gap">
        <CardHeader title="Team leave balances" sub={`${team.length} direct report(s)`} />
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Annual</th>
              <th>Sick</th>
              <th>Casual</th>
            </tr>
          </thead>
          <tbody>
            {visibleTeam.map((e) => {
              const bal = LEAVE_BALANCES.filter((b) => b.employeeId === e.id);
              const find = (t: string) => bal.find((b) => b.type === t);
              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/directory/${e.employeeCode}`} className="person">
                      <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                        {e.avatarInitials}
                      </div>
                      <span className="nm">
                        {e.name}
                        <EmpId code={e.employeeCode} />
                      </span>
                    </Link>
                  </td>
                  <td className="mono">{find('Annual') ? `${find('Annual')!.entitled - find('Annual')!.taken} left` : '—'}</td>
                  <td className="mono">{find('Sick') ? `${find('Sick')!.entitled - find('Sick')!.taken} left` : '—'}</td>
                  <td className="mono">{find('Casual') ? `${find('Casual')!.entitled - find('Casual')!.taken} left` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
