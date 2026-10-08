'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { LEAVE_BALANCES, LEAVE_REQUESTS, directReports, employeeById, matchesEmployee } from '@/lib/data';
import { LeaveRequest, LeaveType } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { EmpId } from '@/components/ui/EmployeeBits';
import { CheckIcon, ClockIcon, InboxIcon, SearchIcon, UserXIcon } from '@/components/icons';

const TYPES: ('All' | LeaveType)[] = ['All', 'Annual', 'Sick', 'Casual', 'Unpaid'];
const BALANCE_TYPES: LeaveType[] = ['Annual', 'Sick', 'Casual'];

export default function TeamLeavePage() {
  const me = useCurrentEmployee();
  const team = directReports(me.id);
  const teamIds = new Set(team.map((t) => t.id));
  const [requests, setRequests] = useState<LeaveRequest[]>(LEAVE_REQUESTS);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'All' | LeaveType>('All');

  const allTeamRequests = requests.filter((r) => teamIds.has(r.employeeId));
  const teamRequests = allTeamRequests.filter((r) => (type === 'All' || r.type === type) && matchesEmployee(employeeById(r.employeeId)!, q));
  const visibleTeam = team.filter((e) => matchesEmployee(e, q));
  const pending = teamRequests.filter((r) => r.status === 'Pending');
  const resolved = teamRequests.filter((r) => r.status !== 'Pending');
  const filtered = !!q.trim() || type !== 'All';

  const allPending = allTeamRequests.filter((r) => r.status === 'Pending');
  const pendingDays = allPending.reduce((n, r) => n + r.days, 0);
  const approved = allTeamRequests.filter((r) => r.status === 'Approved').length;
  const rejected = allTeamRequests.filter((r) => r.status === 'Rejected').length;

  const act = (id: string, status: LeaveRequest['status']) => setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

  return (
    <div className="tx-page">
      <PageHeader eyebrow="Team" title="Team Leave" description="Leave requests and balances for your direct reports." />

      <StatStrip
        items={[
          { label: 'Awaiting approval', value: allPending.length, icon: <InboxIcon />, tone: 'amber', hint: allPending.length ? 'Needs your decision' : 'Nothing waiting' },
          { label: 'Days requested', value: pendingDays, icon: <ClockIcon />, tone: 'blue', hint: 'Across pending requests' },
          { label: 'Approved', value: approved, icon: <CheckIcon />, tone: 'green', hint: 'Requests approved' },
          { label: 'Rejected', value: rejected, icon: <UserXIcon />, tone: 'red', hint: 'Requests declined' },
        ]}
      />

      <Card>
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team by name or employee ID…" />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value as 'All' | LeaveType)} className="chip">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All leave types' : `${t} leave`}
              </option>
            ))}
          </select>
          <span className="sp" />
          <span className="tx-count">
            {teamRequests.length} of {allTeamRequests.length} request(s)
          </span>
        </div>
      </Card>

      <Card className="row-gap">
        <CardHeader title="Pending approval" sub={`${pending.length} request(s)`} />
        {!pending.length ? (
          <EmptyState
            icon={<InboxIcon />}
            title={filtered ? 'No matches' : 'Inbox zero'}
            description={filtered ? 'No pending requests match your search or filter.' : 'No leave requests awaiting your approval.'}
          />
        ) : (
          <div className="tx-list">
            {pending.map((r) => {
              const e = employeeById(r.employeeId)!;
              return (
                <div key={r.id} className="tx-item">
                  <div className="tx-av">{e.avatarInitials}</div>
                  <div className="tx-main">
                    <div className="tx-t">
                      {e.name}
                      <EmpId code={e.employeeCode} />
                    </div>
                    <div className="tx-s">
                      {r.fromDate} → {r.toDate} · {r.reason}
                    </div>
                  </div>
                  <span className="tx-pill">
                    {r.type} · {r.days} day(s)
                  </span>
                  <div className="tx-actions">
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
          </div>
        )}
      </Card>

      <Card className="row-gap">
        <CardHeader title="Resolved" sub={`${resolved.length} request(s)`} />
        {!resolved.length ? (
          <EmptyState icon={<CheckIcon />} title={filtered ? 'No matches' : 'Nothing resolved yet'} description={filtered ? 'No resolved requests match your search or filter.' : 'Approved and rejected requests will appear here.'} />
        ) : (
          <div className="tx-list">
            {resolved.map((r) => {
              const e = employeeById(r.employeeId)!;
              return (
                <div key={r.id} className="tx-item">
                  <div className="tx-av gray">{e.avatarInitials}</div>
                  <div className="tx-main">
                    <div className="tx-t">
                      {e.name}
                      <EmpId code={e.employeeCode} /> · {r.type} leave
                    </div>
                    <div className="tx-s">
                      {r.fromDate} → {r.toDate} · {r.days} day(s)
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="row-gap">
        <CardHeader title="Team leave balances" sub={`${team.length} direct report(s) · days remaining this year`} />
        {!visibleTeam.length ? (
          <EmptyState icon={<SearchIcon />} title={team.length ? 'No matches' : 'No direct reports'} description={team.length ? 'No team members match your search.' : 'You have no direct reports to show balances for.'} />
        ) : (
          <div className="tx-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  {BALANCE_TYPES.map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTeam.map((e) => {
                  const bal = LEAVE_BALANCES.filter((b) => b.employeeId === e.id);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/directory/${e.employeeCode}`} className="person">
                          <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                            {e.avatarInitials}
                          </div>
                          <div>
                            <div className="nm">
                              {e.name}
                              <EmpId code={e.employeeCode} />
                            </div>
                            <div className="sb">{e.designation}</div>
                          </div>
                        </Link>
                      </td>
                      {BALANCE_TYPES.map((t) => {
                        const b = bal.find((x) => x.type === t);
                        if (!b) return <td key={t} className="mono">—</td>;
                        const left = b.entitled - b.taken;
                        const usedPct = b.entitled > 0 ? Math.min(100, Math.round((b.taken / b.entitled) * 100)) : 0;
                        return (
                          <td key={t}>
                            <div className="tx-bal">
                              <b>{left}</b>
                              <small>left of {b.entitled}</small>
                              <div className="tx-bar">
                                <i className={usedPct >= 90 ? 'red' : usedPct >= 70 ? 'amber' : undefined} style={{ width: `${usedPct}%` }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!!visibleTeam.length && (
          <div className="tfoot">
            <span>
              Showing {visibleTeam.length} of {team.length}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
