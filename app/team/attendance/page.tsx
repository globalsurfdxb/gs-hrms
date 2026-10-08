'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { ATTENDANCE_TODAY, REFERENCE_TODAY, directReports, matchesEmployee } from '@/lib/data';
import { AttendanceStatus } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { EmpId } from '@/components/ui/EmployeeBits';
import { CheckIcon, ClockIcon, PeopleIcon, SearchIcon, UserXIcon } from '@/components/icons';

const TONE = { Present: 'active', WFH: 'info', Leave: 'pending', Absent: 'expired' } as const;
const FILTERS: ('All' | AttendanceStatus)[] = ['All', 'Present', 'WFH', 'Leave', 'Absent'];

export default function TeamAttendancePage() {
  const me = useCurrentEmployee();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'All' | AttendanceStatus>('All');
  const team = directReports(me.id);
  const rows = team.map((e) => ({ e, a: ATTENDANCE_TODAY.find((x) => x.employeeId === e.id) }));

  const present = rows.filter((r) => r.a?.status === 'Present' || r.a?.status === 'WFH').length;
  const onLeave = rows.filter((r) => r.a?.status === 'Leave').length;
  const absent = rows.filter((r) => r.a?.status === 'Absent').length;
  const countOf = (s: 'All' | AttendanceStatus) => (s === 'All' ? rows.length : rows.filter((r) => r.a?.status === s).length);
  const visible = rows.filter((r) => (status === 'All' || r.a?.status === status) && matchesEmployee(r.e, q));
  const filtered = !!q.trim() || status !== 'All';

  return (
    <div className="tx-page">
      <PageHeader eyebrow="Team" title="Team Attendance" description={`Who's in today, ${REFERENCE_TODAY} — your direct reports.`} />

      <StatStrip
        items={[
          { label: 'Direct reports', value: team.length, icon: <PeopleIcon />, tone: 'blue', hint: 'On your team' },
          { label: 'In today', value: present, icon: <CheckIcon />, tone: 'green', hint: team.length ? `${Math.round((present / team.length) * 100)}% of the team` : undefined },
          { label: 'On leave', value: onLeave, icon: <ClockIcon />, tone: 'amber', hint: 'Approved leave today' },
          { label: 'Absent', value: absent, icon: <UserXIcon />, tone: 'red', hint: absent ? 'No check-in recorded' : 'Everyone accounted for' },
        ]}
      />

      <Card>
        <CardHeader title="Team status" sub={`${team.length} direct report(s) · ${REFERENCE_TODAY}`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          {FILTERS.map((f) => (
            <button key={f} type="button" className={`chip ${status === f ? 'tx-chip-on' : ''}`} onClick={() => setStatus(f)}>
              {f === 'All' ? 'All' : f === 'WFH' ? 'Remote' : f} · {countOf(f)}
            </button>
          ))}
        </div>
        {!visible.length ? (
          <EmptyState
            icon={<ClockIcon />}
            title={filtered ? 'No matches' : 'No direct reports'}
            description={filtered ? 'No team members match your search or filter.' : 'You have no direct reports to track attendance for.'}
          />
        ) : (
          <div className="tx-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Check in</th>
                  <th>Check out</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ e, a }) => (
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
                    <td>
                      <Badge tone={a ? TONE[a.status] : 'inactive'}>{a?.status ?? 'Unknown'}</Badge>
                    </td>
                    <td className="mono">{a?.checkIn ?? '—'}</td>
                    <td className="mono">{a?.checkOut ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!!visible.length && (
          <div className="tfoot">
            <span>
              Showing {visible.length} of {rows.length}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
