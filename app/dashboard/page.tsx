'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import {
  ASSETS,
  ATTENDANCE_TODAY,
  BUSINESS_RENEWALS,
  EMPLOYEES,
  LEAVE_REQUESTS,
  ONBOARDING_REQUESTS,
  PAYROLL_TREND,
  REFERENCE_TODAY,
  directReports,
  employeeById,
} from '@/lib/data';
import { EmployeeRequest } from '@/lib/types';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { RenewalCalendar } from '@/components/charts/RenewalCalendar';
import { LineChart } from '@/components/charts/LineChart';
import { Donut } from '@/components/charts/Donut';
import { BookIcon, ChevronRightIcon, ClockIcon, DownloadIcon, ExitIcon, FolderIcon, IdIcon, InboxIcon, JoinIcon, PackageIcon, PeopleIcon, PlusIcon, ReceiptIcon, RefreshIcon, StarIcon } from '@/components/icons';
import { EmpId } from '@/components/ui/EmployeeBits';
import { useVisa } from '@/context/VisaContext';
import { useOrg } from '@/context/OrgContext';
import { useRequests } from '@/context/RequestsContext';
import { useSeparation } from '@/context/SeparationContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useLearning } from '@/context/LearningContext';
import { useExpense } from '@/context/ExpenseContext';
import { useExpiry } from '@/context/ExpiryContext';

const daysUntil = (dateStr: string) => Math.round((new Date(dateStr).getTime() - new Date(REFERENCE_TODAY).getTime()) / 86400000);

/* Live clock: ticks every 30 s. The server snapshot is 0, so the first paint is neutral and hydration never mismatches. */
const subscribeClock = (cb: () => void) => {
  const id = setInterval(cb, 30000);
  return () => clearInterval(id);
};
const minuteNow = () => Math.floor(Date.now() / 60000) * 60000;
const useNow = () => useSyncExternalStore(subscribeClock, minuteNow, () => 0);

const greetingAt = (ms: number) => {
  if (!ms) return 'Welcome';
  const h = new Date(ms).getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const liveLabel = (ms: number) =>
  ms
    ? `${new Date(ms).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : ' ';

const ASSET_COLORS: Record<string, string> = { Laptop: '#28469A', Monitor: '#3B82F6', Phone: '#22C55E', Vehicle: '#F59E0B' };

function ApprovalRow({ r, onAct }: { r: EmployeeRequest; onAct: (id: string, status: EmployeeRequest['status']) => void }) {
  const e = employeeById(r.employeeId)!;
  return (
    <div className="doc">
      <div className="fic">
        <InboxIcon />
      </div>
      <div>
        <div className="nm">
          {e.name}
          <EmpId code={e.employeeCode} /> · {r.type}
        </div>
        <div className="mt">{r.details}</div>
      </div>
      <div className="rt" style={{ gap: 6 }}>
        <Button size="sm" variant="success" onClick={() => onAct(r.id, 'Approved')}>
          Approve
        </Button>
        <Button size="sm" variant="danger" onClick={() => onAct(r.id, 'Rejected')}>
          Reject
        </Button>
      </div>
    </div>
  );
}

const initialsOf = (name: string) => {
  const w = name.split(/\s+/).filter(Boolean);
  return (w.length === 1 ? w[0].slice(0, 2) : w.map((x) => x[0]).slice(0, 2).join('')).toUpperCase();
};

/** Days until the next occurrence of a month/day (used for birthdays and work anniversaries). */
const daysToNext = (isoDate: string) => {
  const t = new Date(REFERENCE_TODAY);
  const d = new Date(isoDate);
  let next = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (next < new Date(t.getFullYear(), t.getMonth(), t.getDate())) next = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next.getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86400000);
};

function Kpi({ href, icon, bg, fg, value, label, foot }: { href: string; icon: React.ReactNode; bg: string; fg: string; value: React.ReactNode; label: string; foot: string }) {
  return (
    <Link href={href} className="dk">
      <span className="dk-ic" style={{ background: bg, color: fg }}>
        {icon}
      </span>
      <div className="dk-main">
        <div className="dk-v">{value}</div>
        <div className="dk-l">{label}</div>
        <div className="dk-f">{foot}</div>
      </div>
      <span className="dk-go">
        <ChevronRightIcon />
      </span>
    </Link>
  );
}

function AttentionRow({ href, icon, title, sub, count, tone }: { href: string; icon: React.ReactNode; title: string; sub: string; count: number; tone: 'expired' | 'soon' | 'pending' | 'active' | 'info' }) {
  return (
    <Link href={href} className={`da-row ${count ? '' : 'quiet'}`}>
      <span className={`da-ic t-${count ? tone : 'inactive'}`}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="da-t">{title}</div>
        <div className="da-s">{sub}</div>
      </div>
      <Badge tone={count ? tone : 'inactive'}>{count}</Badge>
      <span className="da-go">
        <ChevronRightIcon />
      </span>
    </Link>
  );
}


const ATT_TONE = { Present: 'active', WFH: 'info', Leave: 'soon', Absent: 'expired' } as const;
const ATT_LABEL = { Present: 'In office', WFH: 'Working from home', Leave: 'On leave', Absent: 'Absent' } as const;
const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const dueText = (n: number) => (n < 0 ? `Expired ${-n}d ago` : n === 0 ? 'Expires today' : `In ${n} days`);

function QuickActions({ items }: { items: { href: string; label: string; icon: React.ReactNode; bg: string; fg: string }[] }) {
  return (
    <div className="qa-grid">
      {items.map((a) => (
        <Link key={a.href + a.label} href={a.href} className="qa">
          <span className="qa-ic" style={{ background: a.bg, color: a.fg }}>
            {a.icon}
          </span>
          {a.label}
        </Link>
      ))}
    </div>
  );
}

/* ---------- Employee: my day, my requests, my renewals ---------- */
function EmployeeHome({ now }: { now: number }) {
  const me = useCurrentEmployee();
  const { locationDef, locationName } = useOrg();
  const { visaExpiryOf } = useVisa();
  const { requests } = useRequests();
  const { reviews } = usePerformance();
  const { records } = useLearning();
  const { claims } = useExpense();
  const { rowsFor, daysOf, stateOf: docState } = useExpiry();
  const { isAssetReturned } = useSeparation();

  const myRequests = requests.filter((r) => r.employeeId === me.id);
  const pending = myRequests.filter((r) => r.status === 'Pending');
  const today = ATTENDANCE_TODAY.find((a) => a.employeeId === me.id);
  const upcomingLeave = LEAVE_REQUESTS.filter((r) => r.employeeId === me.id && r.status !== 'Rejected' && r.toDate >= REFERENCE_TODAY).sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
  const docs = rowsFor([me])
    .map((r) => ({ r, days: daysOf(r) }))
    .sort((a, b) => a.days - b.days);
  const expiring = docs.filter((d) => d.days <= 90);
  const visa = visaExpiryOf(me);
  const visaDays = visa ? daysUntil(visa) : null;
  const assets = ASSETS.filter((a) => a.assignedTo === me.employeeCode && a.status !== 'Returned' && !isAssetReturned(a.id));
  const review = reviews.find((r) => r.employeeId === me.id && r.status !== 'Completed');
  const courses = records.filter((r) => r.employeeId === me.id && r.status !== 'Completed');
  const openClaims = claims.filter((c) => c.employeeId === me.id && c.status === 'Pending');
  const hours = locationDef(me.location)?.workingHours ?? '—';

  return (
    <div>
      <div className="dh">
        <div className="dh-main">
          <div className="dh-eyebrow" suppressHydrationWarning>{liveLabel(now)}</div>
          <h1 className="dh-title">
            {greetingAt(now)}, {me.name.split(' ')[0]}
          </h1>
          <p className="dh-sub">
            {today ? (
              <span className="dh-pill">
                {ATT_LABEL[today.status]}
                {today.checkIn ? ` · in ${today.checkIn}` : ''}
              </span>
            ) : (
              <span className="dh-pill">No attendance record today</span>
            )}
            {pending.length > 0 && (
              <Link href="/my/requests" className="dh-pill">
                <b>{pending.length}</b> request{pending.length === 1 ? '' : 's'} pending
              </Link>
            )}
            {expiring.length > 0 && (
              <Link href="/my/expiry" className="dh-pill warn">
                <b>{expiring.length}</b> document{expiring.length === 1 ? '' : 's'} expiring soon
              </Link>
            )}
            <span className="dh-pill">
              {locationName(me.location)} · {hours}
            </span>
          </p>
        </div>
        <div className="dh-side">
          <div className="dh-acts">
            <Link href="/modules/leave-attendance/leave/my/requests" className="dh-btn">
              <ClockIcon /> Apply for leave
            </Link>
            <Link href="/requests" className="dh-btn solid">
              <PlusIcon /> New request
            </Link>
          </div>
        </div>
      </div>

      <div className="dk-grid">
        <Kpi href="/my/requests" icon={<FolderIcon />} bg="#e7f0fc" fg="#2f6fd6" value={myRequests.length} label="My requests" foot={`${pending.length} waiting for HR`} />
        <Kpi
          href="/my/expiry"
          icon={<IdIcon />}
          bg={visaDays !== null && visaDays <= 90 ? '#fce9e7' : '#e7f6ee'}
          fg={visaDays !== null && visaDays <= 90 ? '#d5493f' : '#1f9d63'}
          value={visa ? (visaDays! < 0 ? 'Expired' : visaDays! <= 90 ? 'Renew soon' : 'Valid') : '—'}
          label="Residence visa"
          foot={visa ? `${visa} · ${dueText(visaDays!)}` : 'Not applicable'}
        />
        <Kpi href="/my/files" icon={<InboxIcon />} bg="#f0eafc" fg="#7a4bd0" value={me.documents.length} label="Documents on file" foot={expiring.length ? `${expiring.length} expiring within 90 days` : 'None expiring soon'} />
        <Kpi href="/my/assets" icon={<PackageIcon />} bg="#fdf3df" fg="#c6851b" value={assets.length} label="Assets with me" foot={assets.length ? assets.map((a) => a.type).join(', ') : 'Nothing assigned'} />
      </div>

      <div className="dg2 row-gap">
        <Card>
          <CardHeader title="My requests" sub="Self-service items and where they are" action={<Link href="/my/requests" className="lnk">Open →</Link>} />
          {myRequests.length ? (
            <div className="da-list">
              {myRequests.map((r) => (
                <div key={r.id} className="da-row">
                  <span className="da-ic t-info">
                    <InboxIcon />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="da-t">{r.type}</div>
                    <div className="da-s">
                      {r.details} · raised {fmtDay(r.raisedOn)} · with {r.routedTo}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <p>You have no requests. Raise one for an address change, a document or a bank update.</p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="My renewals" sub="Your documents, soonest first" action={<Link href="/my/expiry" className="lnk">Open →</Link>} />
          {docs.length ? (
            <div className="da-list">
              {docs.slice(0, 5).map(({ r, days }) => (
                <div key={r.key} className="da-row">
                  <span className={`da-ic t-${docState(r) === 'expired' ? 'expired' : docState(r) === 'soon' ? 'soon' : 'active'}`}>
                    <ClockIcon />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="da-t">{r.type}</div>
                    <div className="da-s">
                      {r.expiry} · {dueText(days)}
                    </div>
                  </div>
                  <Badge tone={docState(r) === 'expired' ? 'expired' : docState(r) === 'soon' ? 'soon' : 'active'}>{docState(r) === 'ok' ? 'Valid' : docState(r) === 'soon' ? 'Soon' : 'Expired'}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <p>No dated documents on file.</p>
            </div>
          )}
        </Card>
      </div>

      <div className="dg3 row-gap">
        <Card>
          <CardHeader title="Today at work" sub={fmtDay(REFERENCE_TODAY)} action={<Link href="/modules/leave-attendance" className="lnk">Open →</Link>} />
          <div className="at-body">
            {today ? (
              <>
                <div className="me-status">
                  <Badge tone={ATT_TONE[today.status]}>{ATT_LABEL[today.status]}</Badge>
                  {today.checkIn && (
                    <span>
                      <b>{today.checkIn}</b> in{today.checkOut ? <> · <b>{today.checkOut}</b> out</> : null}
                    </span>
                  )}
                </div>
                <div className="at-d">Working hours {hours}</div>
              </>
            ) : (
              <div className="at-d">No attendance recorded for today.</div>
            )}
            <div className="at-sub">Upcoming leave</div>
            {upcomingLeave.length ? (
              upcomingLeave.slice(0, 3).map((r) => (
                <div key={r.id} className="at-leave">
                  <span className="at-av">{r.days}d</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="at-n">{r.type} leave</div>
                    <div className="at-d">
                      {fmtDay(r.fromDate)}
                      {r.toDate !== r.fromDate ? ` → ${fmtDay(r.toDate)}` : ''} · {r.status}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="at-d" style={{ padding: '6px 0' }}>No leave booked.</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Growth" sub="Reviews, training and claims" />
          <div className="da-list">
            <AttentionRow href="/performance" icon={<StarIcon />} title="Performance review" sub={review ? `${review.cycle} · ${review.status} · due ${fmtDay(review.dueDate)}` : 'Nothing open'} count={review ? 1 : 0} tone="info" />
            <AttentionRow href="/learning" icon={<BookIcon />} title="Training assigned" sub={courses.length ? courses.map((c) => c.course).slice(0, 2).join(', ') : 'You are all caught up'} count={courses.length} tone="pending" />
            <AttentionRow href="/expense/claims" icon={<ReceiptIcon />} title="Expense claims" sub="Waiting for approval" count={openClaims.length} tone="soon" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Quick actions" sub="Jump straight into a task" />
          <QuickActions
            items={[
              { href: '/modules/leave-attendance/leave/my/requests', label: 'Apply for leave', icon: <ClockIcon />, bg: '#e7f0fc', fg: '#2f6fd6' },
              { href: '/modules/leave-attendance/attendance/my/regularization', label: 'Regularize attendance', icon: <RefreshIcon />, bg: '#e7f6ee', fg: '#1f9d63' },
              { href: '/requests', label: 'Raise a request', icon: <InboxIcon />, bg: '#f0eafc', fg: '#7a4bd0' },
              { href: '/expense/new', label: 'New expense claim', icon: <ReceiptIcon />, bg: '#fce9e7', fg: '#d5493f' },
              { href: '/my/payslips', label: 'My payslips', icon: <DownloadIcon />, bg: '#fdf3df', fg: '#c6851b' },
              { href: `/directory/${me.employeeCode}`, label: 'My profile', icon: <PeopleIcon />, bg: '#e3f4f8', fg: '#0e8fa8' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

/* ---------- Team Lead: my team today, what needs my decision ---------- */
function TeamLeadHome({ now }: { now: number }) {
  const me = useCurrentEmployee();
  const { locationName } = useOrg();
  const { requests, act } = useRequests();
  const { reviews } = usePerformance();
  const { records } = useLearning();
  const { rowsFor, daysOf, stateOf: docState } = useExpiry();

  const team = directReports(me.id).filter((t) => t.employmentStatus !== 'Inactive');
  const ids = new Set(team.map((t) => t.id));
  const awaiting = requests.filter((r) => r.status === 'Pending' && r.routedTo === 'Manager' && ids.has(r.employeeId));
  const leavePending = LEAVE_REQUESTS.filter((r) => r.status === 'Pending' && ids.has(r.employeeId));
  const todayRows = team.map((t) => ({ t, a: ATTENDANCE_TODAY.find((x) => x.employeeId === t.id) }));
  const count = (k: string) => todayRows.filter((x) => x.a?.status === k).length;
  const out = count('Leave') + count('Absent');
  const renewals = rowsFor(team)
    .map((r) => ({ r, days: daysOf(r) }))
    .filter((d) => d.days <= 90)
    .sort((a, b) => a.days - b.days);
  const reviewsOpen = reviews.filter((r) => ids.has(r.employeeId) && (r.status === 'Self Assessment' || r.status === 'Manager Review'));
  const reviewsOverdue = reviews.filter((r) => ids.has(r.employeeId) && r.status !== 'Completed' && r.dueDate < REFERENCE_TODAY).length;
  const coursesOverdue = records.filter((r) => ids.has(r.employeeId) && r.status !== 'Completed' && !!r.dueDate && r.dueDate < REFERENCE_TODAY).length;
  const needs = awaiting.length + leavePending.length;
  const total = team.length || 1;

  return (
    <div>
      <div className="dh">
        <div className="dh-main">
          <div className="dh-eyebrow" suppressHydrationWarning>{liveLabel(now)}</div>
          <h1 className="dh-title">
            {greetingAt(now)}, {me.name.split(' ')[0]}
          </h1>
          <p className="dh-sub">
            {needs ? (
              <Link href="/team/leave" className="dh-pill">
                <b>{needs}</b> item{needs === 1 ? '' : 's'} need your decision
              </Link>
            ) : (
              <span className="dh-pill">Nothing is waiting for your decision</span>
            )}
            {renewals.some((d) => d.days < 0) && (
              <Link href="/team/expiry" className="dh-pill warn">
                <b>{renewals.filter((d) => d.days < 0).length}</b> team renewal{renewals.filter((d) => d.days < 0).length === 1 ? '' : 's'} overdue
              </Link>
            )}
            <span className="dh-pill">
              <b>{team.length}</b> direct report{team.length === 1 ? '' : 's'} · {me.department}
            </span>
            <span className="dh-pill">{locationName(me.location)}</span>
          </p>
        </div>
        <div className="dh-side">
          <div className="dh-acts">
            <Link href="/team/directory" className="dh-btn">
              <PeopleIcon /> Team directory
            </Link>
            <Link href="/modules/leave-attendance/home/team/approvals" className="dh-btn solid">
              <InboxIcon /> Review approvals
            </Link>
          </div>
        </div>
      </div>

      <div className="dk-grid">
        <Kpi href="/team/directory" icon={<PeopleIcon />} bg="#e7f0fc" fg="#2f6fd6" value={team.length} label="My team" foot={`in ${me.department}`} />
        <Kpi href="/modules/leave-attendance/home/team/approvals" icon={<InboxIcon />} bg="#fdf3df" fg="#c6851b" value={needs} label="Waiting for my decision" foot={`${awaiting.length} request${awaiting.length === 1 ? '' : 's'} · ${leavePending.length} leave`} />
        <Kpi href="/modules/leave-attendance/attendance/team/summary" icon={<ClockIcon />} bg="#e7f6ee" fg="#1f9d63" value={`${team.length - out}/${team.length}`} label="Working today" foot={`${count('Leave')} on leave · ${count('Absent')} absent`} />
        <Kpi href="/team/expiry" icon={<RefreshIcon />} bg="#fce9e7" fg="#d5493f" value={renewals.length} label="Team renewals" foot={renewals.length ? `Next: ${renewals[0].r.type} · ${renewals[0].r.employee.name.split(' ')[0]}` : 'Nothing due in 90 days'} />
      </div>

      <div className="dg2 row-gap">
        <Card>
          <CardHeader title="Waiting for my decision" sub="Requests routed to me and leave to approve" />
          <div>
            {awaiting.map((r) => (
              <ApprovalRow key={r.id} r={r} onAct={act} />
            ))}
            {leavePending.map((r) => {
              const e = employeeById(r.employeeId);
              return (
                <div key={r.id} className="doc">
                  <div className="fic">
                    <ClockIcon />
                  </div>
                  <div>
                    <div className="nm">
                      {e?.name} {e && <EmpId code={e.employeeCode} />} · {r.type} leave
                    </div>
                    <div className="mt">
                      {fmtDay(r.fromDate)}
                      {r.toDate !== r.fromDate ? ` → ${fmtDay(r.toDate)}` : ''} · {r.days} day{r.days === 1 ? '' : 's'} · {r.reason}
                    </div>
                  </div>
                  <div className="rt">
                    <Link href="/modules/leave-attendance/home/team/approvals" className="btn sm">
                      Review
                    </Link>
                  </div>
                </div>
              );
            })}
            {!needs && (
              <div className="empty">
                <p>Nothing is waiting for your decision.</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="My team today" sub={`${team.length} people · ${fmtDay(REFERENCE_TODAY)}`} action={<Link href="/team/attendance" className="lnk">Open →</Link>} />
          <div className="at-body">
            <div className="at-bar" aria-label="Team attendance today">
              {(['Present', 'WFH', 'Leave', 'Absent'] as const).map((k) => (
                <i key={k} style={{ width: `${(count(k) / total) * 100}%`, background: { Present: '#1f9d63', WFH: '#2f6fd6', Leave: '#c6851b', Absent: '#d5493f' }[k] }} title={`${ATT_LABEL[k]}: ${count(k)}`} />
              ))}
            </div>
            {todayRows.map(({ t, a }) => (
              <div key={t.id} className="at-leave">
                <span className="at-av">{initialsOf(t.name)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="at-n">{t.name}</div>
                  <div className="at-d">
                    {t.designation}
                    {a?.checkIn ? ` · in ${a.checkIn}` : ''}
                  </div>
                </div>
                {a ? <Badge tone={ATT_TONE[a.status]}>{ATT_LABEL[a.status]}</Badge> : <Badge tone="inactive">No record</Badge>}
              </div>
            ))}
            {!team.length && <div className="at-d">No one reports to you yet.</div>}
          </div>
        </Card>
      </div>

      <div className="dg3 row-gap">
        <Card>
          <CardHeader title="Team renewals" sub="Documents expiring within 90 days" action={<Link href="/team/expiry" className="lnk">Open →</Link>} />
          {renewals.length ? (
            <div className="da-list">
              {renewals.slice(0, 5).map(({ r, days }) => (
                <div key={r.key} className="da-row">
                  <span className={`da-ic t-${docState(r) === 'expired' ? 'expired' : 'soon'}`}>
                    <ClockIcon />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="da-t">
                      {r.type} · {r.employee.name}
                    </div>
                    <div className="da-s">
                      {r.expiry} · {dueText(days)}
                    </div>
                  </div>
                  <Badge tone={docState(r) === 'expired' ? 'expired' : 'soon'}>{docState(r) === 'expired' ? 'Expired' : 'Soon'}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <p>No team documents expire in the next 90 days.</p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Team growth" sub="Reviews and training" />
          <div className="da-list">
            <AttentionRow href="/performance" icon={<StarIcon />} title="Reviews in progress" sub={`${reviewsOverdue} overdue`} count={reviewsOpen.length} tone="info" />
            <AttentionRow href="/learning" icon={<BookIcon />} title="Training overdue" sub="Assigned courses past their due date" count={coursesOverdue} tone="expired" />
            <AttentionRow href="/team/separation" icon={<ExitIcon />} title="Offboarding" sub="Team members leaving" count={team.filter((t) => t.employmentStatus === 'Offboarding').length} tone="soon" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Quick actions" sub="Jump straight into a task" />
          <QuickActions
            items={[
              { href: '/modules/leave-attendance/home/team/approvals', label: 'Approve leave', icon: <ClockIcon />, bg: '#e7f0fc', fg: '#2f6fd6' },
              { href: '/team/attendance', label: 'Team attendance', icon: <PeopleIcon />, bg: '#e7f6ee', fg: '#1f9d63' },
              { href: '/team/leave', label: 'Team leave', icon: <RefreshIcon />, bg: '#f0eafc', fg: '#7a4bd0' },
              { href: '/performance', label: 'Review a teammate', icon: <StarIcon />, bg: '#fdf3df', fg: '#c6851b' },
              { href: '/team/visa', label: 'Visa renewals', icon: <IdIcon />, bg: '#fce9e7', fg: '#d5493f' },
              { href: '/requests', label: 'Raise a request', icon: <InboxIcon />, bg: '#e3f4f8', fg: '#0e8fa8' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { locations, locationName } = useOrg();
  const { requests, act } = useRequests();
  const { cases, statusOf, isAssetReturned } = useSeparation();
  const { reviews } = usePerformance();
  const { records } = useLearning();
  const { claims } = useExpense();
  const { rowsFor, daysOf, stateOf: docState } = useExpiry();
  const [loc, setLoc] = useState('All');
  const now = useNow();

  if (role === 'Employee') return <EmployeeHome now={now} />;
  if (role === 'Team Lead') return <TeamLeadHome now={now} />;

  // ---- Administrator / HR view: live across every module ----
  const inLoc = (employeeLocation: string) => loc === 'All' || employeeLocation === loc;
  const people = EMPLOYEES.filter((e) => statusOf(e) !== 'Inactive' && inLoc(e.location));
  const peopleIds = new Set(people.map((e) => e.id));
  const onboarding = people.filter((e) => statusOf(e) === 'Onboarding');
  const scopeName = loc === 'All' ? 'all locations' : locationName(loc);

  const byDept = Object.entries(
    people.reduce<Record<string, number>>((acc, e) => {
      acc[e.department] = (acc[e.department] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxDept = Math.max(1, ...byDept.map(([, n]) => n));

  const joinedThisQuarter = people.filter((e) => {
    const d = daysUntil(e.dateOfJoining);
    return d <= 0 && d >= -90;
  }).length;
  const joiningToday = onboarding.filter((e) => e.dateOfJoining === REFERENCE_TODAY);
  const onboardingRequests = ONBOARDING_REQUESTS.filter((r) => inLoc(r.location));
  const stepsRemaining = onboardingRequests.reduce((n, r) => n + (10 - r.step), 0);

  const docRows = rowsFor(people);
  const employeeRenewals = docRows.map((r) => ({
    id: r.key,
    label: `${r.type} · ${r.employee.name} (${r.employee.employeeCode})`,
    sub: 'HR',
    offsetDays: daysOf(r),
  }));
  const businessRenewals = BUSINESS_RENEWALS.filter((b) => loc === 'All' || b.location === 'Both' || b.location === loc).map((b) => ({
    id: b.id,
    label: b.label,
    sub: b.owner,
    offsetDays: b.offsetDays,
  }));
  const renewalPool = [...employeeRenewals, ...businessRenewals].filter((it) => it.offsetDays <= 90).sort((a, b) => a.offsetDays - b.offsetDays);
  const overdueCount = renewalPool.filter((it) => it.offsetDays < 0).length;
  const due30Count = renewalPool.filter((it) => it.offsetDays >= 0 && it.offsetDays <= 30).length;

  const pendingRequests = requests.filter((r) => r.status === 'Pending' && peopleIds.has(r.employeeId));
  const pendingClaims = claims.filter((c) => c.status === 'Pending' && inLoc(employeeById(c.employeeId)?.location ?? ''));
  const openCases = cases.filter((c) => c.status !== 'Completed' && inLoc(employeeById(c.employeeId)?.location ?? ''));
  const casesAwaiting = openCases.filter((c) => c.status === 'Pending Approval').length;
  const reviewsOpen = reviews.filter((r) => (r.status === 'Self Assessment' || r.status === 'Manager Review') && peopleIds.has(r.employeeId));
  const reviewsOverdue = reviews.filter((r) => r.status !== 'Completed' && r.dueDate < REFERENCE_TODAY && peopleIds.has(r.employeeId)).length;
  const coursesOverdue = records.filter((r) => r.status !== 'Completed' && !!r.dueDate && r.dueDate < REFERENCE_TODAY && peopleIds.has(r.employeeId)).length;
  const coursesOpen = records.filter((r) => r.status === 'In Progress' && peopleIds.has(r.employeeId)).length;
  const docsExpired = docRows.filter((r) => docState(r) === 'expired').length;
  const docsSoon = docRows.filter((r) => daysOf(r) >= 0 && daysOf(r) <= 30).length;

  const assetCounts = ASSETS.filter((a) => peopleIds.has(employeeById(a.assignedTo)?.id ?? '') && a.status !== 'Returned' && !isAssetReturned(a.id)).reduce<Record<string, number>>((acc, a) => {
    const key = ASSET_COLORS[a.type] ? a.type : 'Other';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const assetSegments = Object.entries(assetCounts).map(([label, count]) => ({ label, count, color: ASSET_COLORS[label] ?? '#9CA3AF' }));
  const assetTotal = assetSegments.reduce((n, s) => n + s.count, 0);


  // attendance + leave (from the attendance and leave records)
  const attToday = ATTENDANCE_TODAY.filter((a) => peopleIds.has(a.employeeId));
  const attCount = (k: string) => attToday.filter((a) => a.status === k).length;
  const attPresent = attCount('Present');
  const attWfh = attCount('WFH');
  const attLeave = attCount('Leave');
  const attAbsent = attCount('Absent');
  const attTotal = attToday.length || 1;
  const pendingLeave = LEAVE_REQUESTS.filter((r) => r.status === 'Pending' && peopleIds.has(r.employeeId));

  // celebrations in the next 30 days
  const celebrations = people
    .flatMap((e) => {
      const out: { id: string; name: string; code: string; kind: 'Birthday' | 'Work anniversary'; in: number; note: string }[] = [];
      const b = daysToNext(e.dob);
      if (b <= 60) out.push({ id: `b-${e.id}`, name: e.name, code: e.employeeCode, kind: 'Birthday', in: b, note: '' });
      const a = daysToNext(e.dateOfJoining);
      const years = new Date(new Date(REFERENCE_TODAY).getTime() + a * 86400000).getFullYear() - new Date(e.dateOfJoining).getFullYear();
      if (a <= 60 && years >= 1 && e.employmentStatus !== 'Onboarding') out.push({ id: `a-${e.id}`, name: e.name, code: e.employeeCode, kind: 'Work anniversary', in: a, note: `${years} yr` });
      return out;
    })
    .sort((x, y) => x.in - y.in)
    .slice(0, 6);

  const attention = [
    { href: '/requests', icon: <InboxIcon />, title: 'Employee requests', sub: 'Pending HR / manager approval', count: pendingRequests.length, tone: 'pending' as const },
    { href: '/expense/approvals', icon: <ReceiptIcon />, title: 'Expense claims', sub: 'Awaiting approval', count: pendingClaims.length, tone: 'pending' as const },
    { href: '/offboarding', icon: <ExitIcon />, title: 'Offboarding cases', sub: `${casesAwaiting} awaiting final approval`, count: openCases.length, tone: 'soon' as const },
    { href: '/performance', icon: <StarIcon />, title: 'Performance reviews', sub: `In progress · ${reviewsOverdue} overdue`, count: reviewsOpen.length, tone: 'info' as const },
    { href: '/learning', icon: <BookIcon />, title: 'Training assignments', sub: `${coursesOpen} in progress`, count: coursesOverdue, tone: 'expired' as const },
    { href: '/employee-expiry', icon: <ClockIcon />, title: 'Document expiry', sub: `${docsSoon} more expire within 30 days`, count: docsExpired, tone: 'expired' as const },
  ].sort((a, b) => b.count - a.count);
  const attentionTotal = attention.reduce((n, a) => n + a.count, 0);
  const needsYou = pendingRequests.length + pendingClaims.length + casesAwaiting;

  const exportSnapshot = () => {
    const rows: [string, string | number][] = [
      ['Scope', scopeName],
      ['Date', REFERENCE_TODAY],
      ['Total employees', people.length],
      ['Joined this quarter', joinedThisQuarter],
      ['Pending onboarding', onboarding.length],
      ['Upcoming renewals (90 days)', renewalPool.length],
      ['Overdue renewals', overdueCount],
      ['Employee requests pending', pendingRequests.length],
      ['Expense claims awaiting approval', pendingClaims.length],
      ['Offboarding cases open', openCases.length],
      ['Performance reviews in progress', reviewsOpen.length],
      ['Training assignments overdue', coursesOverdue],
      ['Documents expired', docsExpired],
    ];
    const csv = rows.map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`).join('\n');
    const url = URL.createObjectURL(new Blob([`"Metric","Value"\n${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-snapshot.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="dh">
        <div className="dh-main">
          <div className="dh-eyebrow" suppressHydrationWarning>{liveLabel(now)}</div>
          <h1 className="dh-title">
            {greetingAt(now)}, {me.name.split(' ')[0]}
          </h1>
          <p className="dh-sub">
            {needsYou ? (
              <>
                <Link href="/requests" className="dh-pill">
                  <b>{needsYou}</b> item{needsYou === 1 ? '' : 's'} need your decision
                </Link>
              </>
            ) : (
              <span className="dh-pill">Nothing is waiting for your decision</span>
            )}
            {overdueCount > 0 && (
              <Link href="/employee-expiry" className="dh-pill warn">
                <b>{overdueCount}</b> renewal{overdueCount === 1 ? '' : 's'} overdue
              </Link>
            )}
            <span className="dh-pill">
              <b>{people.length}</b> people · {scopeName}
            </span>
          </p>
        </div>
        <div className="dh-side">
          <div className="dh-seg" role="tablist" aria-label="Location">
            {['All', ...locations.map((l) => l.id)].map((id) => (
              <button key={id} role="tab" aria-selected={loc === id} className={loc === id ? 'on' : ''} onClick={() => setLoc(id)}>
                {id === 'All' ? 'All locations' : locationName(id)}
              </button>
            ))}
          </div>
          <div className="dh-acts">
            <button className="dh-btn" onClick={exportSnapshot}>
              <DownloadIcon /> Export snapshot
            </button>
            <Link href="/onboarding" className="dh-btn solid">
              <PlusIcon /> New onboarding
            </Link>
          </div>
        </div>
      </div>

      <div className="dk-grid">
        <Kpi href="/directory" icon={<PeopleIcon />} bg="#e7f0fc" fg="#2f6fd6" value={people.length} label="Total employees" foot={joinedThisQuarter ? `▲ ${joinedThisQuarter} joined this quarter` : scopeName} />
        <Kpi
          href="/onboarding"
          icon={<JoinIcon />}
          bg="#e7f6ee"
          fg="#1f9d63"
          value={joiningToday.length}
          label="Joining today"
          foot={joiningToday.length ? `${joiningToday[0].name} (${joiningToday[0].employeeCode}) · ${joiningToday[0].department}` : 'No new joiners today'}
        />
        <Kpi href="/onboarding" icon={<PackageIcon />} bg="#fdf3df" fg="#c6851b" value={onboarding.length} label="Pending onboarding" foot={stepsRemaining ? `${stepsRemaining} step(s) remaining` : 'All steps complete'} />
        <Kpi href="/employee-expiry" icon={<RefreshIcon />} bg="#fce9e7" fg="#d5493f" value={renewalPool.length} label="Upcoming renewals" foot={`${overdueCount} overdue · ${due30Count} due ≤30d`} />
      </div>

      <div className="dg2 row-gap">
        <Card>
          <CardHeader title="Needs attention" sub={`${attentionTotal} open item${attentionTotal === 1 ? '' : 's'} across modules · ${scopeName}`} />
          <div className="da-list">
            {attention.map((a) => (
              <AttentionRow key={a.href} {...a} />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Renewal calendar" sub="Next 90 days · Employee & Business" action={<Link href="/employee-expiry" className="lnk">Open expiry →</Link>} />
          {renewalPool.length ? (
            <RenewalCalendar items={renewalPool} />
          ) : (
            <div className="empty">
              <p>Nothing due in the next 90 days.</p>
            </div>
          )}
        </Card>
      </div>

      <div className="dg3 row-gap">
        <Card>
          <CardHeader title="Attendance today" sub={`${attToday.length} people · ${scopeName}`} action={<Link href="/modules/leave-attendance" className="lnk">Open →</Link>} />
          <div className="at-body">
            <div className="at-bar" aria-label="Attendance today">
              <i style={{ width: `${(attPresent / attTotal) * 100}%`, background: '#1f9d63' }} title={`In office: ${attPresent}`} />
              <i style={{ width: `${(attWfh / attTotal) * 100}%`, background: '#2f6fd6' }} title={`Work from home: ${attWfh}`} />
              <i style={{ width: `${(attLeave / attTotal) * 100}%`, background: '#c6851b' }} title={`On leave: ${attLeave}`} />
              <i style={{ width: `${(attAbsent / attTotal) * 100}%`, background: '#d5493f' }} title={`Absent: ${attAbsent}`} />
            </div>
            <div className="at-legend">
              <span><i style={{ background: '#1f9d63' }} /> In office <b>{attPresent}</b></span>
              <span><i style={{ background: '#2f6fd6' }} /> WFH <b>{attWfh}</b></span>
              <span><i style={{ background: '#c6851b' }} /> On leave <b>{attLeave}</b></span>
              <span><i style={{ background: '#d5493f' }} /> Absent <b>{attAbsent}</b></span>
            </div>
            <div className="at-sub">Pending leave requests</div>
            {pendingLeave.length ? (
              pendingLeave.slice(0, 3).map((r) => {
                const e = employeeById(r.employeeId);
                return (
                  <div key={r.id} className="at-leave">
                    <span className="at-av">{initialsOf(e?.name ?? '?')}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="at-n">{e?.name}</div>
                      <div className="at-d">
                        {r.type} · {r.fromDate}
                        {r.toDate !== r.fromDate ? ` → ${r.toDate}` : ''} · {r.days}d
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="at-d" style={{ padding: '6px 0' }}>No pending leave requests.</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Celebrations" sub="Birthdays & work anniversaries · next 60 days" />
          {celebrations.length ? (
            <div className="cel-list">
              {celebrations.map((c) => (
                <div key={c.id} className="cel-row">
                  <span className={`cel-ic ${c.kind === 'Birthday' ? 'b' : 'a'}`}>{c.kind === 'Birthday' ? '🎂' : '★'}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="at-n">
                      {c.name} <EmpId code={c.code} />
                    </div>
                    <div className="at-d">{c.kind}{c.note ? ` · ${c.note}` : ""}</div>
                  </div>
                  <span className={`cel-when ${c.in === 0 ? 'today' : ''}`}>{c.in === 0 ? 'Today' : c.in === 1 ? 'Tomorrow' : `in ${c.in} days`}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <p>No birthdays or anniversaries in the next 60 days.</p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick actions" sub="Jump straight into a task" />
          <div className="qa-grid">
            {[
              { href: '/onboarding', label: 'New onboarding', icon: <JoinIcon />, bg: '#e7f0fc', fg: '#2f6fd6' },
              { href: '/offboarding', label: 'Start offboarding', icon: <ExitIcon />, bg: '#f0eafc', fg: '#7a4bd0' },
              { href: '/performance', label: 'Start review cycle', icon: <StarIcon />, bg: '#fdf3df', fg: '#c6851b' },
              { href: '/learning', label: 'Assign a course', icon: <BookIcon />, bg: '#e7f6ee', fg: '#1f9d63' },
              { href: '/expense/new', label: 'New expense claim', icon: <ReceiptIcon />, bg: '#fce9e7', fg: '#d5493f' },
              { href: '/employee-expiry', label: 'Track a document', icon: <ClockIcon />, bg: '#e3f4f8', fg: '#0e8fa8' },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="qa">
                <span className="qa-ic" style={{ background: a.bg, color: a.fg }}>
                  {a.icon}
                </span>
                {a.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="dg3 row-gap">
        <Card>
          <CardHeader title="Employees by department" sub={scopeName} />
          <div className="barchart">
            {byDept.map(([dept, n]) => (
              <div key={dept} className="bc-row">
                <div className="bl">{dept}</div>
                <div className="bc-track">
                  <div className="bc-fill" style={{ width: `${(n / maxDept) * 100}%` }}>
                    {n}
                  </div>
                </div>
                <span className="bv" />
              </div>
            ))}
            {!byDept.length && <div className="empty">No employees in {scopeName}.</div>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Asset distribution" sub="Assigned, not yet returned" />
          {assetTotal ? (
            <Donut segments={assetSegments} total={assetTotal} centerLabel="assets" />
          ) : (
            <div className="empty">
              <p>No assets assigned in {scopeName}.</p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Payroll cost trend" sub="Last 6 months · UAE · AED" action={<Badge tone="active">July ready</Badge>} />
          {loc === 'All' || loc === 'Dubai' ? (
            <LineChart data={PAYROLL_TREND} />
          ) : (
            <div className="empty">
              <p>The payroll trend is tracked for the UAE (AED) payroll only.</p>
            </div>
          )}
        </Card>
      </div>

      <Card className="row-gap">
        <CardHeader title="Pending employee requests" sub={`${scopeName} · routed to HR / Manager`} action={<Link href="/requests" className="lnk">Open →</Link>} />
        <div>
          {pendingRequests.length ? (
            pendingRequests.map((r) => <ApprovalRow key={r.id} r={r} onAct={act} />)
          ) : (
            <div className="empty">
              <p>No pending requests for {scopeName}.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
