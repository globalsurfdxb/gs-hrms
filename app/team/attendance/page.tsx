'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { ATTENDANCE_TODAY, REFERENCE_TODAY, directReports, matchesEmployee } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmpId, ListSearch } from '@/components/ui/EmployeeBits';
import { ClockIcon } from '@/components/icons';

const TONE = { Present: 'active', WFH: 'info', Leave: 'pending', Absent: 'expired' } as const;

export default function TeamAttendancePage() {
  const me = useCurrentEmployee();
  const [q, setQ] = useState('');
  const team = directReports(me.id);
  const rows = team.map((e) => ({ e, a: ATTENDANCE_TODAY.find((x) => x.employeeId === e.id) }));

  const present = rows.filter((r) => r.a?.status === 'Present' || r.a?.status === 'WFH').length;
  const onLeave = rows.filter((r) => r.a?.status === 'Leave').length;
  const absent = rows.filter((r) => r.a?.status === 'Absent').length;
  const visible = rows.filter((r) => matchesEmployee(r.e, q));

  return (
    <div>
      <PageHeader eyebrow="Team · Attendance" title="Team Attendance" description={`Who's in today, ${REFERENCE_TODAY} — your direct reports.`} />

      <div className="g3">
        <div className="compcard">
          <div className="ttl">In today</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700, color: '#15803D' }}>
            {present}
          </div>
        </div>
        <div className="compcard">
          <div className="ttl">On leave</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700, color: '#B45309' }}>
            {onLeave}
          </div>
        </div>
        <div className="compcard">
          <div className="ttl">Absent</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700, color: '#B91C1C' }}>
            {absent}
          </div>
        </div>
      </div>

      <Card className="row-gap">
        <CardHeader title="Team status" sub={`${team.length} direct report(s)`} />
        <ListSearch value={q} onChange={setQ} shown={visible.length} total={rows.length} />
        {!visible.length ? (
          <EmptyState icon={<ClockIcon />} title={q ? 'No matches' : 'No direct reports'} description={q ? 'No team members match your search.' : 'You have no direct reports to track attendance for.'} />
        ) : (
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
                    <div className="person">
                      <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                        {e.avatarInitials}
                      </div>
                      <span className="nm">
                        {e.name}
                        <EmpId code={e.employeeCode} />
                      </span>
                    </div>
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
        )}
      </Card>
    </div>
  );
}
