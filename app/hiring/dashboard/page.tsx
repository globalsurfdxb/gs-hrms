'use client';

import Link from 'next/link';
import { daysBetween, todayISO, addDays } from '@/lib/dates';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { ChevronRightIcon, ClockIcon, FileTextIcon, InboxIcon, JoinIcon, PeopleIcon, PlusIcon, ReportsIcon, StarIcon } from '@/components/icons';
import { HiringHeader, InterviewBadge, StageBadge, empName, fmtDate, fmtDateTime, money, payUnit } from '@/components/hiring/HiringBits';
import { useScoped } from '@/components/hiring/useScoped';
import { candById, canDecideStep, isActiveApp, jobById } from '@/lib/hiringStore';
import { STAGES } from '@/lib/hiringTypes';
import { useApp } from '@/context/AppContext';

const STAGE_SHORT: Record<(typeof STAGES)[number], string> = { Applied: 'Applied', Screening: 'Screening', 'Technical Interview': 'Technical', 'HR Interview': 'HR round', Offer: 'Offer', Hired: 'Hired' };

export default function HiringDashboardPage() {
  const { s, level, me, loc, currency, jobs, requisitions, applications, interviews, offers } = useScoped();
  const { role } = useApp();
  const today = todayISO();

  const openJobs = jobs.filter((j) => j.status === 'Open');
  const openPositions = openJobs.reduce((n, j) => n + Math.max(0, j.positions - j.filled), 0);
  const active = applications.filter(isActiveApp);
  const activeCandidates = new Set(active.map((a) => a.candidateId)).size;
  const weekEnd = addDays(today, 6);
  const thisWeek = interviews.filter((i) => i.status === 'Scheduled' && i.date >= today && i.date <= weekEnd);
  const todays = interviews.filter((i) => i.status === 'Scheduled' && i.date === today);
  const pendingOffers = offers.filter((o) => ['Draft', 'Pending Approval', 'Approved', 'Sent'].includes(o.status));
  const responded = offers.filter((o) => ['Accepted', 'Declined', 'Expired'].includes(o.status));
  const accepted = offers.filter((o) => o.status === 'Accepted');
  const acceptance = responded.length ? Math.round((accepted.length / responded.length) * 100) : null;
  const times = accepted
    .map((o) => {
      const a = s.applications.find((x) => x.id === o.applicationId);
      return a && o.respondedAt ? daysBetween(a.appliedAt.slice(0, 10), o.respondedAt.slice(0, 10)) : null;
    })
    .filter((n): n is number => n !== null);
  const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  const myApprovals = requisitions.filter((r) => {
    if (r.status !== 'Pending Approval') return false;
    const step = r.approvals.find((a) => a.status === 'Pending');
    return !!step && canDecideStep(step.label, role, me.id, r);
  });
  const expiring = offers.filter((o) => o.status === 'Sent' && daysBetween(today, o.expiryDate) <= 3 && daysBetween(today, o.expiryDate) >= -1);
  const readyToOnboard = offers.filter((o) => o.status === 'Accepted' && !o.employeeId);

  const attention: { key: string; icon: React.ReactNode; title: string; sub: string; href: string; tone: 'amber' | 'blue' | 'red' | 'green' }[] = [
    ...myApprovals.map((r) => ({ key: r.id, icon: <InboxIcon />, title: `${r.code} awaits your approval`, sub: `${r.title} · ${r.positions} position${r.positions === 1 ? '' : 's'} · ${r.department}`, href: `/hiring/requisitions/${r.id}`, tone: 'amber' as const })),
    ...todays.map((i) => {
      const a = s.applications.find((x) => x.id === i.applicationId);
      return { key: i.id, icon: <ClockIcon />, title: `Interview today at ${i.time}`, sub: `${candById(s, a?.candidateId ?? '')?.name ?? 'Candidate'} · ${i.round} · ${i.mode}`, href: '/hiring/interviews', tone: 'blue' as const };
    }),
    ...expiring.map((o) => {
      const a = s.applications.find((x) => x.id === o.applicationId);
      const left = daysBetween(today, o.expiryDate);
      return { key: o.id, icon: <FileTextIcon />, title: `${o.code} expires ${left <= 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`}`, sub: `${candById(s, a?.candidateId ?? '')?.name ?? 'Candidate'} · offer sent`, href: '/hiring/offers', tone: 'red' as const };
    }),
    ...readyToOnboard.map((o) => {
      const a = s.applications.find((x) => x.id === o.applicationId);
      return { key: `r-${o.id}`, icon: <JoinIcon />, title: 'Accepted offer ready for onboarding', sub: `${candById(s, a?.candidateId ?? '')?.name ?? 'Candidate'} · joins ${fmtDate(o.joiningDate)}`, href: '/hiring/offers', tone: 'green' as const };
    }),
  ];

  const upcoming = interviews.filter((i) => i.status === 'Scheduled' && i.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 5);
  const activity = applications
    .flatMap((a) => a.history.filter((h) => h.from !== '—').map((h) => ({ ...h, app: a })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  // Candidates who have reached each stage, for the funnel.
  const reached = STAGES.map((st) => applications.filter((a) => a.history.some((h) => h.to === st) || STAGES.indexOf(a.stage) >= STAGES.indexOf(st)).length);
  const top = Math.max(1, reached[0]);

  return (
    <div className="hm-page">
      <HiringHeader
        title="Hiring dashboard"
        description="Headcount approved, candidates in the pipeline, interviews and offers, in one place."
        actions={
          <>
            <Link href="/hiring/candidates?add=1">
              <Button>
                <PlusIcon /> Add candidate
              </Button>
            </Link>
            <Link href="/hiring/requisitions?new=1">
              <Button variant="primary">
                <PlusIcon /> New requisition
              </Button>
            </Link>
          </>
        }
        bar={level === 'manager' ? <span className="hm-foot-inline">Showing your own requisitions and jobs</span> : undefined}
      />

      <StatStrip
        items={[
          { label: 'Open positions', value: openPositions, icon: <JoinIcon />, tone: 'blue', hint: `${openJobs.length} open job${openJobs.length === 1 ? '' : 's'}`, href: '/hiring/jobs' },
          { label: 'Active candidates', value: activeCandidates, icon: <PeopleIcon />, tone: 'purple', hint: 'In the pipeline now', href: '/hiring/candidates' },
          { label: 'Interviews this week', value: thisWeek.length, icon: <ClockIcon />, tone: 'amber', hint: `${todays.length} today`, href: '/hiring/interviews' },
          { label: 'Offers pending', value: pendingOffers.length, icon: <FileTextIcon />, tone: 'teal', hint: 'Draft or awaiting reply', href: '/hiring/offers' },
          { label: 'Avg. time-to-hire', value: avgTime === null ? '—' : `${avgTime} days`, icon: <StarIcon />, tone: 'green', hint: 'Applied to offer accepted' },
          { label: 'Offer acceptance', value: acceptance === null ? '—' : `${acceptance}%`, icon: <ReportsIcon />, tone: 'gray', hint: `${responded.length} answered offer${responded.length === 1 ? '' : 's'}` },
        ]}
      />

      <div className="hm-grid">
        <Card>
          <CardHeader title="Needs attention" sub={attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'}` : 'Nothing is waiting on you'} />
          {!attention.length ? (
            <EmptyState icon={<StarIcon />} title="All clear" description="No approvals, interviews or offers need action right now." />
          ) : (
            <div className="hm-att">
              {attention.map((a) => (
                <Link key={a.key} href={a.href} className="hm-att-row">
                  <span className={`hm-att-ic ${a.tone}`}>{a.icon}</span>
                  <span className="hm-att-tx">
                    <b>{a.title}</b>
                    <small>{a.sub}</small>
                  </span>
                  <ChevronRightIcon />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming interviews" sub={`${upcoming.length} scheduled`} action={<Link href="/hiring/interviews" className="lnk">All interviews →</Link>} />
          {!upcoming.length ? (
            <EmptyState icon={<ClockIcon />} title="No interviews scheduled" description="Schedule one from a candidate or the pipeline." />
          ) : (
            <div className="hm-att">
              {upcoming.map((i) => {
                const a = s.applications.find((x) => x.id === i.applicationId);
                const c = candById(s, a?.candidateId ?? '');
                return (
                  <Link key={i.id} href={a ? `/hiring/candidates/${a.candidateId}` : '/hiring/interviews'} className="hm-att-row">
                    <span className="hm-att-ic blue">
                      <ClockIcon />
                    </span>
                    <span className="hm-att-tx">
                      <b>{c?.name ?? 'Candidate'}</b>
                      <small>
                        {i.round} · {fmtDate(i.date)} {i.time} · {i.panelIds.map(empName).join(', ')}
                      </small>
                    </span>
                    <InterviewBadge status={i.status} />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="hm-grid hm-grid-wide">
        <Card>
          <CardHeader title="Open jobs" sub={`${openJobs.length} in ${loc === 'Kochi' ? 'India' : 'the UAE'}`} action={<Link href="/hiring/jobs" className="lnk">All jobs →</Link>} />
          {!openJobs.length ? (
            <EmptyState icon={<JoinIcon />} title="No open jobs" description="Approve a requisition and create a job from it to start hiring." />
          ) : (
            <div className="hm-jobs one">
              {openJobs.map((j) => {
                const apps = applications.filter((a) => a.jobId === j.id);
                const counts = STAGES.map((st) => apps.filter((a) => a.stage === st && !a.exit).length);
                return (
                  <Link key={j.id} href={`/hiring/jobs/${j.id}`} className="hm-job">
                    <div className="hm-job-top">
                      <div>
                        <div className="nm">{j.title}</div>
                        <div className="sb">
                          {j.code} · {j.department} · {money(j.budgetMin, currency)} – {money(j.budgetMax, currency)} {payUnit(currency)}
                        </div>
                      </div>
                      <span className="hm-fill">
                        {j.filled}/{j.positions} filled
                      </span>
                    </div>
                    <div className="hm-stages" aria-label="Candidates per stage">
                      {STAGES.map((st, i) => (
                        <span key={st} className={counts[i] ? 'on' : ''} title={`${st}: ${counts[i]}`}>
                          <b>{counts[i]}</b>
                          <small>{STAGE_SHORT[st]}</small>
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Pipeline funnel" sub="Candidates who reached each stage" action={level === 'full' ? <Link href="/hiring/reports" className="lnk">Reports →</Link> : undefined} />
          {!applications.length ? (
            <EmptyState icon={<ReportsIcon />} title="No applications yet" description="The funnel fills in as candidates are added." />
          ) : (
            <div className="hm-funnel">
              {STAGES.map((st, i) => (
                <div key={st} className="hm-funnel-row">
                  <span className="l">{st}</span>
                  <span className="bar">
                    <i style={{ width: `${(reached[i] / top) * 100}%` }} />
                  </span>
                  <span className="n">
                    {reached[i]}
                    <small>{i === 0 ? '' : reached[i - 1] ? `${Math.round((reached[i] / reached[i - 1]) * 100)}%` : '—'}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="row-gap">
        <CardHeader title="Recent pipeline activity" sub="Latest stage changes" />
        {!activity.length ? (
          <EmptyState icon={<StarIcon />} title="No activity yet" description="Stage changes appear here as candidates move." />
        ) : (
          <div className="hm-feed">
            {activity.map((h) => {
              const c = candById(s, h.app.candidateId);
              const j = jobById(s, h.app.jobId);
              return (
                <div key={h.id} className="hm-feed-row">
                  <span className="dotm" />
                  <div>
                    <b>{c?.name}</b> {h.from} → <b>{h.to}</b>
                    <small>
                      {j?.title} · by {h.by} · {fmtDateTime(h.at)}
                    </small>
                  </div>
                  <StageBadge stage={h.app.stage} exit={h.app.exit} />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
