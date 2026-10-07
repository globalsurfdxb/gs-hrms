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
  ROLE_SCOPE,
  directReports,
  employeeById,
} from '@/lib/data';
import { EmployeeRequest } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
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

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="note-box row-gap" style={{ marginBottom: 16 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

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

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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

export default function DashboardPage() {
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { locations, locationName } = useOrg();
  const { stateOf, visaExpiryOf } = useVisa();
  const { requests, act } = useRequests();
  const { cases, statusOf, isAssetReturned } = useSeparation();
  const { reviews } = usePerformance();
  const { records } = useLearning();
  const { claims } = useExpense();
  const { rowsFor, daysOf, stateOf: docState } = useExpiry();
  const [loc, setLoc] = useState('All');
  const now = useNow();

  if (role === 'Employee') {
    const myRequests = requests.filter((r) => r.employeeId === me.id);
    const pending = myRequests.filter((r) => r.status === 'Pending');
    const docsOnFile = me.documents.length;
    return (
      <div>
        <PageHeader eyebrow="My Space · Overview" title={`${greetingAt(now)}, ${me.name.split(' ')[0]}`} description="Your personal snapshot — requests, documents and expiry status." />
        <NoteBox>
          <b>Employee view.</b> {ROLE_SCOPE.Employee}
        </NoteBox>
        <div className="g4">
          <StatCard icon={<FolderIcon />} bg="var(--primary-50)" fg="var(--primary)" value={myRequests.length} label="My requests" foot={`${pending.length} pending HR action`} />
          <StatCard icon={<InboxIcon />} bg="var(--success-50)" fg="#15803D" value={`${docsOnFile}`} label="My documents" foot="on file" />
          <StatCard
            icon={<IdIcon />}
            bg="var(--danger-50)"
            fg="#B91C1C"
            value={visaExpiryOf(me) ? (stateOf(me) === 'ok' ? 'Valid' : stateOf(me) === 'soon' ? 'Soon' : 'Expired') : '—'}
            label="My visa status"
            foot={visaExpiryOf(me) ?? 'Not applicable'}
          />
          <StatCard icon={<PeopleIcon />} bg="var(--primary-50)" fg="var(--primary)" value={me.department} label="Department" foot={me.designation} />
        </div>
        <Card className="row-gap">
          <CardHeader title="My requests" sub="Self-service items" action={<Link href="/requests" className="lnk">Open →</Link>} />
          <div style={{ padding: '12px 16px' }}>
            {myRequests.length ? (
              myRequests.map((r) => (
                <div key={r.id} className="doc">
                  <div className="fic">
                    <InboxIcon />
                  </div>
                  <div>
                    <div className="nm">{r.type}</div>
                    <div className="mt">{r.details}</div>
                  </div>
                  <div className="rt">
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">
                <p>No requests on file.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (role === 'Team Lead') {
    const team = directReports(me.id);
    const teamIds = new Set(team.map((t) => t.id));
    const awaiting = requests.filter((r) => r.status === 'Pending' && r.routedTo === 'Manager' && teamIds.has(r.employeeId));
    const teamDubai = team.filter((t) => t.location === 'Dubai');
    const expiringTeam = teamDubai.filter((t) => stateOf(t) === 'soon' || stateOf(t) === 'expired');
    const onboardingTeam = team.filter((t) => t.employmentStatus === 'Onboarding');
    return (
      <div>
        <PageHeader eyebrow="My Space · Overview" title={`${greetingAt(now)}, ${me.name.split(' ')[0]}`} description="Your team's snapshot — approvals, visa renewals and onboarding." />
        <NoteBox>
          <b>Team Lead view.</b> {ROLE_SCOPE['Team Lead']}
        </NoteBox>
        <div className="g4">
          <StatCard icon={<PeopleIcon />} bg="var(--primary-50)" fg="var(--primary)" value={team.length} label="My team members" foot={`in ${me.department}`} />
          <StatCard icon={<InboxIcon />} bg="var(--warning-50)" fg="#B45309" value={awaiting.length} label="Pending my approval" foot="requests routed to me" />
          <StatCard icon={<JoinIcon />} bg="var(--success-50)" fg="#15803D" value={onboardingTeam.length} label="Team onboarding" foot="in progress" />
          <StatCard icon={<IdIcon />} bg="var(--danger-50)" fg="#B91C1C" value={teamDubai.length ? expiringTeam.length : '—'} label="Team visa renewals" foot={teamDubai.length ? 'Dubai team members' : 'No Dubai reports'} />
        </div>
        <Card className="row-gap">
          <CardHeader title="Awaiting my approval" sub="Requests routed to Manager" />
          <div style={{ padding: '12px 16px' }}>
            {awaiting.length ? (
              awaiting.map((r) => <ApprovalRow key={r.id} r={r} onAct={act} />)
            ) : (
              <div className="empty">
                <p>Nothing pending your approval.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

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
            <span className="dh-pill" title="The sample records in this workspace are dated to this day">
              Records as of {new Date(REFERENCE_TODAY).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
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
