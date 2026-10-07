'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { ATTENDANCE_TODAY, LEAVE_BALANCES, LEAVE_REQUESTS, REFERENCE_TODAY } from '@/lib/data';
import { LeaveRequest, LeaveType } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button, EmptyState } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { CheckIcon, ClockIcon } from '@/components/icons';

const LEAVE_TYPES: LeaveType[] = ['Annual', 'Sick', 'Casual', 'Unpaid'];

export default function MyLeaveAttendancePage() {
  const me = useCurrentEmployee();
  const [requests, setRequests] = useState<LeaveRequest[]>(LEAVE_REQUESTS);
  const [type, setType] = useState<LeaveType>('Annual');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const balances = LEAVE_BALANCES.filter((b) => b.employeeId === me.id);
  const mine = requests.filter((r) => r.employeeId === me.id).slice().reverse();
  const today = ATTENDANCE_TODAY.find((a) => a.employeeId === me.id);

  const submit = () => {
    if (!from || !to) return;
    const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
    setRequests((prev) => [...prev, { id: `lv-${Date.now()}`, employeeId: me.id, type, fromDate: from, toDate: to, days, reason: reason || '—', status: 'Pending' }]);
    setFrom('');
    setTo('');
    setReason('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  };

  return (
    <div>
      <PageHeader eyebrow="My Space · Leave & Attendance" title="Leave & Attendance" description="Your leave balance, attendance status and time-off requests." />

      <div className="g3">
        {balances.map((b) => (
          <div key={b.type} className="compcard">
            <div className="ttl">{b.type} leave</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
              {b.entitled - b.taken} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>of {b.entitled} left</span>
            </div>
            <div className="prog">
              <i style={{ width: `${(b.taken / b.entitled) * 100}%`, background: 'var(--primary)' }} />
            </div>
            <div className="dates">
              <span>{b.taken} taken</span>
              <span>{b.entitled} entitled</span>
            </div>
          </div>
        ))}
      </div>

      <div className="g2 row-gap">
        <Card>
          <CardHeader title="Today's attendance" sub={REFERENCE_TODAY} />
          <div style={{ padding: 18 }}>
            {today ? (
              <>
                <Badge tone={today.status === 'Present' ? 'active' : today.status === 'WFH' ? 'info' : today.status === 'Leave' ? 'pending' : 'expired'}>{today.status}</Badge>
                {today.checkIn && (
                  <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
                    Checked in {today.checkIn} · Checked out {today.checkOut}
                  </div>
                )}
              </>
            ) : (
              <div className="empty">
                <p>No attendance record for today.</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Request leave" />
          <div className="wizbody" style={{ padding: 18 }}>
            <div className="form-grid">
              <div className="fg">
                <label>Leave type</label>
                <select value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
                  {LEAVE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="fg">
                <label>To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="fg full">
                <label>Reason</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason" />
              </div>
            </div>
          </div>
          <div className="wizfoot">
            {submitted ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803D', fontSize: 12.5, fontWeight: 600 }}>
                <CheckIcon style={{ width: 15, height: 15 }} /> Sent for approval
              </span>
            ) : (
              <span />
            )}
            <Button variant="primary" disabled={!from || !to} onClick={submit}>
              Submit request
            </Button>
          </div>
        </Card>
      </div>

      <Card className="row-gap">
        <CardHeader title="My requests" sub={`${mine.length} on file`} />
        {!mine.length ? (
          <EmptyState icon={<ClockIcon />} title="No leave requests" description="Requests you submit will appear here." />
        ) : (
          mine.map((r) => (
            <div key={r.id} className="doc">
              <div className="fic">
                <ClockIcon />
              </div>
              <div>
                <div className="nm">
                  {r.type} leave · {r.days} day(s)
                </div>
                <div className="mt">
                  {r.fromDate} → {r.toDate} · {r.reason}
                </div>
              </div>
              <div className="rt">
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
