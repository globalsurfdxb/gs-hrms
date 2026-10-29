'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { DownloadIcon, PeopleIcon, ReportsIcon, StarIcon, UserXIcon, ClockIcon } from '@/components/icons';
import { HiringHeader, empName } from '@/components/hiring/HiringBits';
import { useScoped } from '@/components/hiring/useScoped';
import { downloadCsv } from '@/lib/csv';
import { daysBetween, todayISO } from '@/lib/dates';
import { candById, isActiveApp, recruiterIdOf } from '@/lib/hiringStore';
import { SOURCES, STAGES } from '@/lib/hiringTypes';

/** Funnel, sources, rejection reasons and ageing for the chosen location. Phase 1 keeps these to the data the pipeline already records. */
export default function HiringReportsPage() {
  const { s, jobs: allJobs, applications: allApplications, offers: allOffers, loc } = useScoped();
  const today = todayISO();
  const [recruiter, setRecruiter] = useState('All');

  // Everything below follows the chosen recruiter, so a recruiter's own funnel, sources and ageing can be read on their own.
  const recruiters = [...new Set(allJobs.map((j) => recruiterIdOf(j) ?? ''))].filter(Boolean);
  const picked = recruiters.includes(recruiter) ? recruiter : 'All';
  const jobs = picked === 'All' ? allJobs : allJobs.filter((j) => recruiterIdOf(j) === picked);
  const jobIds = new Set(jobs.map((j) => j.id));
  const applications = allApplications.filter((a) => jobIds.has(a.jobId));
  const appIds = new Set(applications.map((a) => a.id));
  const offers = allOffers.filter((o) => appIds.has(o.applicationId));

  const recruiterRows = recruiters.map((id) => {
    const mine = allJobs.filter((j) => recruiterIdOf(j) === id);
    const ids = new Set(mine.map((j) => j.id));
    const apps = allApplications.filter((a) => ids.has(a.jobId));
    const appSet = new Set(apps.map((a) => a.id));
    const offs = allOffers.filter((o) => appSet.has(o.applicationId));
    return {
      id,
      jobs: mine,
      open: mine.filter((j) => j.status === 'Open').length,
      active: apps.filter(isActiveApp).length,
      applied: apps.length,
      interviews: apps.filter((a) => a.history.some((h) => h.to === 'Technical Interview' || h.to === 'HR Interview') || STAGES.indexOf(a.stage) >= 2).length,
      offers: offs.filter((o) => o.status !== 'Draft' && o.status !== 'Revoked').length,
      hires: offs.filter((o) => o.status === 'Accepted').length,
    };
  });

  // A candidate has "reached" a stage if their history ever entered it (or they sit at or beyond it).
  const reached = (stage: (typeof STAGES)[number]) => applications.filter((a) => a.history.some((h) => h.to === stage) || STAGES.indexOf(a.stage) >= STAGES.indexOf(stage)).length;
  const funnel = STAGES.map((st) => ({ stage: st, count: reached(st) }));
  const top = Math.max(1, funnel[0].count);

  const sources = SOURCES.map((src) => {
    const apps = applications.filter((a) => candById(s, a.candidateId)?.source === src);
    const hires = offers.filter((o) => o.status === 'Accepted' && apps.some((a) => a.id === o.applicationId)).length;
    return { source: src, applied: apps.length, interviewed: apps.filter((a) => a.history.some((h) => h.to === 'Technical Interview' || h.to === 'HR Interview') || STAGES.indexOf(a.stage) >= 2).length, hires };
  }).filter((r) => r.applied > 0);

  const reasons = new Map<string, number>();
  applications.filter((a) => a.exit === 'Rejected').forEach((a) => reasons.set(a.exitReason ?? 'Other', (reasons.get(a.exitReason ?? 'Other') ?? 0) + 1));
  const reasonRows = [...reasons.entries()].sort((a, b) => b[1] - a[1]);

  const ageing = jobs
    .filter((j) => j.status === 'Open' || j.status === 'On Hold')
    .map((j) => ({ job: j, days: daysBetween(j.createdAt.slice(0, 10), today), active: applications.filter((a) => a.jobId === j.id && isActiveApp(a)).length }))
    .sort((a, b) => b.days - a.days);

  const timeToHire = offers
    .filter((o) => o.status === 'Accepted' && o.respondedAt)
    .map((o) => {
      const a = s.applications.find((x) => x.id === o.applicationId);
      const j = a && s.jobs.find((x) => x.id === a.jobId);
      return a && j ? { dept: j.department, days: daysBetween(a.appliedAt.slice(0, 10), (o.respondedAt as string).slice(0, 10)) } : null;
    })
    .filter((x): x is { dept: string; days: number } => !!x);
  const byDept = new Map<string, number[]>();
  timeToHire.forEach((t) => byDept.set(t.dept, [...(byDept.get(t.dept) ?? []), t.days]));

  const workload = new Map<string, { jobs: number; active: number }>();
  jobs.filter((j) => j.status === 'Open').forEach((j) => {
    const w = workload.get(j.hiringManagerId) ?? { jobs: 0, active: 0 };
    workload.set(j.hiringManagerId, { jobs: w.jobs + 1, active: w.active + applications.filter((a) => a.jobId === j.id && isActiveApp(a)).length });
  });

  const exportCsv = () => {
    downloadCsv(`hiring-funnel-${loc}${picked === 'All' ? '' : `-${empName(picked).toLowerCase().replace(/\s+/g, '-')}`}.csv`, ['Section', 'Item', 'Count', 'Detail'], [
      ...funnel.map((f) => ['Funnel', f.stage, f.count, `${Math.round((f.count / top) * 100)}% of applied`]),
      ...sources.map((r) => ['Source', r.source, r.applied, `${r.interviewed} interviewed, ${r.hires} hired`]),
      ...reasonRows.map(([r, n]) => ['Rejection reason', r, n, '']),
      ...ageing.map((a) => ['Open position ageing', `${a.job.code} ${a.job.title}`, a.days, `${a.active} active candidates`]),
      ...recruiterRows.map((r) => ['Recruiter', empName(r.id), r.jobs.length, `${r.open} open, ${r.active} active candidates, ${r.interviews} interviewed, ${r.offers} offers, ${r.hires} hired: ${r.jobs.map((j) => j.code).join(' ')}`]),
    ]);
  };

  return (
    <div className="hm-page">
      <HiringHeader
        title="Reports"
        description={picked === 'All' ? 'How the pipeline converts, where candidates come from and why they leave.' : `Showing only the jobs recruited by ${empName(picked)}.`}
        actions={
          <>
            {recruiters.length > 0 && (
              <select className="hm-rsel" value={picked} onChange={(e) => setRecruiter(e.target.value)} aria-label="Recruiter">
                <option value="All">All recruiters</option>
                {recruiters.map((id) => (
                  <option key={id} value={id}>
                    {empName(id)}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={exportCsv} disabled={!applications.length}>
              <DownloadIcon /> Export CSV
            </Button>
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'Applications', value: applications.length, icon: <PeopleIcon />, tone: 'blue', hint: 'All time, this location' },
          { label: 'Reached interview', value: reached('Technical Interview'), icon: <StarIcon />, tone: 'purple', hint: `${applications.length ? Math.round((reached('Technical Interview') / applications.length) * 100) : 0}% of applicants` },
          { label: 'Rejected', value: applications.filter((a) => a.exit === 'Rejected').length, icon: <UserXIcon />, tone: 'red', hint: 'With a recorded reason' },
          { label: 'Open > 30 days', value: ageing.filter((a) => a.days > 30).length, icon: <ClockIcon />, tone: 'amber', hint: 'Positions that need attention' },
        ]}
      />

      <Card>
        <CardHeader title="Recruiters" sub="Each recruiter's jobs and results. Choose one to see the whole report for their jobs only." />
        {!recruiterRows.length ? (
          <EmptyState icon={<PeopleIcon />} title="No jobs yet" description="Recruiters appear once a job is created." />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Recruiter</th>
                  <th>Jobs</th>
                  <th>Active candidates</th>
                  <th>Interviewed</th>
                  <th>Offers</th>
                  <th>Hired</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recruiterRows.map((r) => (
                  <tr key={r.id} className={picked === r.id ? 'hm-row-on' : ''}>
                    <td>
                      <b>{empName(r.id)}</b>
                      <div className="tx-s faint">
                        {r.open} open · {r.jobs.length} in total
                      </div>
                    </td>
                    <td>
                      <div className="hm-chips">
                        {r.jobs.map((j) => (
                          <Link key={j.id} href={`/hiring/jobs/${j.id}`} className="hm-chip on" title={`${j.title} · ${j.status}`}>
                            {j.code} {j.title}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="mono">{r.active}</td>
                    <td className="mono">{r.interviews}</td>
                    <td className="mono">{r.offers}</td>
                    <td className="mono">{r.hires}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" variant={picked === r.id ? 'primary' : 'ghost'} onClick={() => setRecruiter(picked === r.id ? 'All' : r.id)}>
                        {picked === r.id ? 'Show all' : 'Filter report'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="hm-grid hm-grid-wide row-gap">
        <Card>
          <CardHeader title="Funnel conversion" sub="Candidates who reached each stage" />
          {!applications.length ? (
            <EmptyState icon={<ReportsIcon />} title="No applications yet" description="The funnel fills in as candidates are added." />
          ) : (
            <div className="hm-funnel">
              {funnel.map((f, i) => (
                <div key={f.stage} className="hm-funnel-row">
                  <span className="l">{f.stage}</span>
                  <span className="bar">
                    <i style={{ width: `${(f.count / top) * 100}%` }} />
                  </span>
                  <span className="n">
                    {f.count}
                    <small>{i === 0 ? '' : funnel[i - 1].count ? `${Math.round((f.count / funnel[i - 1].count) * 100)}%` : '—'}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Source effectiveness" sub="Applicants, interviews and accepted offers" />
          {!sources.length ? (
            <EmptyState icon={<ReportsIcon />} title="No data" description="Sources appear once candidates are added." />
          ) : (
            <div className="tx-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Applied</th>
                    <th>Interviewed</th>
                    <th>Hired</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((r) => (
                    <tr key={r.source}>
                      <td>{r.source}</td>
                      <td className="mono">{r.applied}</td>
                      <td className="mono">{r.interviewed}</td>
                      <td className="mono">{r.hires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="hm-grid hm-grid-wide row-gap">
        <Card>
          <CardHeader title="Rejection reasons" />
          {!reasonRows.length ? (
            <EmptyState icon={<UserXIcon />} title="No rejections" description="Reasons are recorded whenever a candidate is rejected." />
          ) : (
            <div className="hm-funnel">
              {reasonRows.map(([reason, n]) => (
                <div key={reason} className="hm-funnel-row">
                  <span className="l wide">{reason}</span>
                  <span className="bar">
                    <i style={{ width: `${(n / reasonRows[0][1]) * 100}%` }} />
                  </span>
                  <span className="n">{n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Time to hire by department" sub="Days from applying to offer accepted" />
          {!byDept.size ? (
            <EmptyState icon={<ClockIcon />} title="No accepted offers yet" description="Appears after the first offer is accepted." />
          ) : (
            <div className="tx-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Hires</th>
                    <th>Average days</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byDept.entries()].map(([d, list]) => (
                    <tr key={d}>
                      <td>{d}</td>
                      <td className="mono">{list.length}</td>
                      <td className="mono">{Math.round(list.reduce((a, b) => a + b, 0) / list.length)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="hm-grid hm-grid-wide row-gap">
        <Card>
          <CardHeader title="Open position ageing" sub="Days since each open job was created" />
          {!ageing.length ? (
            <EmptyState icon={<ClockIcon />} title="No open jobs" description="Open jobs and how long they have been open show here." />
          ) : (
            <div className="tx-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Days open</th>
                    <th>Active candidates</th>
                  </tr>
                </thead>
                <tbody>
                  {ageing.map((a) => (
                    <tr key={a.job.id}>
                      <td>
                        {a.job.title}
                        <div className="tx-s faint">{a.job.code}</div>
                      </td>
                      <td className="mono">{a.days}</td>
                      <td className="mono">{a.active}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Hiring manager workload" sub="Open jobs and active candidates" />
          {!workload.size ? (
            <EmptyState icon={<PeopleIcon />} title="No open jobs" description="Workload appears when jobs are open." />
          ) : (
            <div className="tx-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Hiring manager</th>
                    <th>Open jobs</th>
                    <th>Active candidates</th>
                  </tr>
                </thead>
                <tbody>
                  {[...workload.entries()].map(([id, w]) => (
                    <tr key={id}>
                      <td>{empName(id)}</td>
                      <td className="mono">{w.jobs}</td>
                      <td className="mono">{w.active}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
