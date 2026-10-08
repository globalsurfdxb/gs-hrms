'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { ATTENDANCE_TODAY, LEAVE_BALANCES, LEAVE_REQUESTS, REFERENCE_TODAY } from '@/lib/data';
import { AttendanceStatus, LeaveRequest, LeaveType } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button, EmptyState } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { StatStrip, Tone } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { CheckIcon, ClockIcon, InboxIcon, ListIcon, SearchIcon, UserIcon } from '@/components/icons';

const LEAVE_TYPES: LeaveType[] = ['Annual', 'Sick', 'Casual', 'Unpaid'];
const LEAVE_COLOR: Record<LeaveType, { tone: string; bar: string }> = {
  Annual: { tone: 'blue', bar: '#2f6fd6' },
  Sick: { tone: 'red', bar: '#d5493f' },
  Casual: { tone: 'green', bar: '#1f9d63' },
  Unpaid: { tone: 'gray', bar: '#6b7690' },
};
const ATT_TONE: Record<AttendanceStatus, { badge: 'active' | 'info' | 'pending' | 'expired'; tone: Tone }> = {
  Present: { badge: 'active', tone: 'green' },
  WFH: { badge: 'info', tone: 'blue' },
  Leave: { badge: 'pending', tone: 'amber' },
  Absent: { badge: 'expired', tone: 'red' },
};
const REQ_TONE: Record<LeaveRequest['status'], string> = { Pending: 'amber', Approved: 'green', Rejected: 'red' };

type StatusFilter = 'all' | LeaveRequest['status'];

export default function MyLeaveAttendancePage() {
  const me = useCurrentEmployee();
  const [requests, setRequests] = useState<LeaveRequest[]>(LEAVE_REQUESTS);
  const [type, setType] = useState<LeaveType>('Annual');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const balances = LEAVE_BALANCES.filter((b) => b.employeeId === me.id);
  const mine = requests.filter((r) => r.employeeId === me.id).slice().reverse();
  const today = ATTENDANCE_TODAY.find((a) => a.employeeId === me.id);
  const countOf = (s: LeaveRequest['status']) => mine.filter((r) => r.status === s).length;

  const left = balances.reduce((n, b) => n + (b.entitled - b.taken), 0);
  const taken = balances.reduce((n, b) => n + b.taken, 0);

  const needle = q.trim().toLowerCase();
  const shown = mine.filter((r) => (status === 'all' || r.status === status) && (!needle || `${r.type} ${r.reason} ${r.fromDate} ${r.toDate}`.toLowerCase().includes(needle)));

  const rangeInvalid = !!from && !!to && to < from;
  const daysFor = (f: string, t: string) => Math.max(1, Math.round((new Date(t).getTime() - new Date(f).getTime()) / 86400000) + 1);

  const submit = () => {
    if (!from || !to || rangeInvalid) return;
    const days = daysFor(from, to);
    setRequests((prev) => [...prev, { id: `lv-${Date.now()}`, employeeId: me.id, type, fromDate: from, toDate: to, days, reason: reason || '—', status: 'Pending' }]);
    setFrom('');
    setTo('');
    setReason('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  };

  return (
    <div>
      <PageHeader eyebrow="My Space" title="Leave & Attendance" description="Your leave balance, attendance status and time-off requests." />

      <div className="ss-strip">
        <StatStrip
          items={[
            { label: 'Leave days left', value: left, icon: <ClockIcon />, tone: 'green', hint: `Across ${balances.length} leave type(s)` },
            { label: 'Days taken', value: taken, icon: <CheckIcon />, tone: 'blue', hint: 'This leave year' },
            { label: 'Pending requests', value: countOf('Pending'), icon: <InboxIcon />, tone: 'amber', hint: 'Awaiting approval' },
            { label: 'Today', value: today?.status ?? 'No record', icon: <UserIcon />, tone: today ? ATT_TONE[today.status].tone : 'gray', hint: REFERENCE_TODAY },
          ]}
        />
      </div>

      <div className="g3">
        {balances.map((b) => {
          const c = LEAVE_COLOR[b.type];
          return (
            <div key={b.type} className="ss-bal">
              <div className="ss-bal-h">
                <span className={`ss-ic sm ss-tone-${c.tone}`}>
                  <ClockIcon />
                </span>
                {b.type} leave
              </div>
              <div className="ss-bal-n">
                {b.entitled - b.taken} <span>of {b.entitled} days left</span>
              </div>
              <div className="ss-bar">
                <i style={{ width: `${(b.taken / b.entitled) * 100}%`, background: c.bar }} />
              </div>
              <div className="ss-bal-f">
                <span>{b.taken} taken</span>
                <span>{b.entitled} entitled</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="g2 row-gap">
        <Card>
          <CardHeader title="Today's attendance" sub={REFERENCE_TODAY} />
          <div className="ss-today">
            {today ? (
              <>
                <div className="ss-today-s">
                  <span className={`ss-ic ss-tone-${ATT_TONE[today.status].tone}`}>
                    <UserIcon />
                  </span>
                  <div>
                    <Badge tone={ATT_TONE[today.status].badge}>{today.status}</Badge>
                    <div className="ss-hint" style={{ marginTop: 4 }}>
                      {today.checkIn ? 'Checked in for the day' : 'No check-in recorded'}
                    </div>
                  </div>
                </div>
                {today.checkIn && (
                  <div className="ss-today-t">
                    <div>
                      <small>Checked in</small>
                      <b>{today.checkIn}</b>
                    </div>
                    <div>
                      <small>Checked out</small>
                      <b>{today.checkOut ?? '—'}</b>
                    </div>
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
          <CardHeader title="Request leave" sub="Sent to your manager for approval" />
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
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="fg full">
                <label>Reason</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason" />
              </div>
            </div>
          </div>
          <div className="wizfoot">
            {submitted ? (
              <span className="ss-ok">
                <CheckIcon style={{ width: 15, height: 15 }} /> Sent for approval
              </span>
            ) : rangeInvalid ? (
              <span className="ss-hint" style={{ color: '#b91c1c' }}>
                End date is before the start date
              </span>
            ) : from && to ? (
              <span className="ss-hint">{daysFor(from, to)} day(s) requested</span>
            ) : (
              <span />
            )}
            <Button variant="primary" disabled={!from || !to || rangeInvalid} onClick={submit}>
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
          <>
            <div className="tbar">
              <div className="tsearch">
                <SearchIcon />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by type, reason or date…" />
              </div>
              <FilterChips
                value={status}
                onChange={setStatus}
                options={[
                  { key: 'all', label: 'All', count: mine.length },
                  { key: 'Pending', label: 'Pending', count: countOf('Pending') },
                  { key: 'Approved', label: 'Approved', count: countOf('Approved') },
                  { key: 'Rejected', label: 'Rejected', count: countOf('Rejected') },
                ]}
              />
            </div>
            <div className="ss-list">
              {!shown.length && <EmptyState icon={<ListIcon />} title="No matches" description="No leave requests match your search or filter." />}
              {shown.map((r) => (
                <div key={r.id} className="doc">
                  <span className={`ss-ic ss-tone-${REQ_TONE[r.status]}`}>
                    <ClockIcon />
                  </span>
                  <div className="ss-body">
                    <div className="ss-nm">
                      {r.type} leave
                      <span className="ss-tag alt">{r.days} day(s)</span>
                    </div>
                    <div className="ss-mt">
                      {r.fromDate} → {r.toDate}
                    </div>
                    <div className="ss-sub">{r.reason}</div>
                  </div>
                  <div className="rt">
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
            <div className="ss-foot">
              <span>
                Showing {shown.length} of {mine.length} request(s)
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
