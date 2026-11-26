'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { CheckIcon, JoinIcon, PeopleIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { Banner, JobBadge, HiringHeader, fmtDate, payUnit, useHiringLocation } from '@/components/hiring/HiringBits';
import { ServerJobDrawer } from '@/components/hiring/ServerJobForm';
import { errorMessage } from '@/lib/api';
import { can } from '@/lib/access';
import { usePermissions } from '@/lib/auth';
import { JobStatus } from '@/lib/hiringTypes';
import { JOB_STATUS, ServerJob, jobsApi } from '@/lib/jobsApi';
import { ServerRequisition, amount, requisitionsApi } from '@/lib/requisitionsApi';

/* The Jobs list from the backend (local development). The server returns the jobs the caller may see (BR-HIR-022) in
   the chosen location; search, status and recruiter filter that list here. "New job" (full hiring access) picks an
   approved requisition that has no job yet. */

const STATUSES: ('All' | JobStatus)[] = ['All', 'Open', 'Draft', 'On Hold', 'Filled', 'Closed'];

export function ServerJobs() {
  const { loc } = useHiringLocation();
  const perms = usePermissions() ?? [];
  const router = useRouter();
  // Full hiring access = Jobs and Requisitions → View (the server's rule); creating also needs Jobs → Add.
  const full = can(perms, 'hiring:recruiting:jobs') && can(perms, 'hiring:requisitions:requisitions');
  const canCreate = full && can(perms, 'hiring:recruiting:jobs', 'add');
  const [jobs, setJobs] = useState<ServerJob[] | null>(null);
  const [eligible, setEligible] = useState<ServerRequisition[]>([]);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'All' | JobStatus>('All');
  const [recruiter, setRecruiter] = useState('All');
  const [picker, setPicker] = useState(false);
  const [from, setFrom] = useState<ServerRequisition | null>(null);

  const load = useCallback(() => {
    let live = true;
    jobsApi
      .all(loc)
      .then((j) => {
        if (!live) return;
        setJobs(j);
        setLoadError('');
      })
      .catch((e) => live && setLoadError(errorMessage(e)));
    if (canCreate) {
      requisitionsApi
        .all(loc)
        .then((r) => live && setEligible(r.filter((x) => x.viewer.canCreateJob)))
        .catch(() => live && setEligible([]));
    }
    return () => {
      live = false;
    };
  }, [loc, canCreate]);
  useEffect(load, [load]);

  const list = jobs ?? [];
  const label = (j: ServerJob) => JOB_STATUS[j.status];
  const needle = q.trim().toLowerCase();
  const recruiters = [...new Map(list.filter((j) => j.recruiter).map((j) => [j.recruiter!.id, j.recruiter!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = list.filter(
    (j) =>
      (status === 'All' || label(j) === status) &&
      (recruiter === 'All' || (j.recruiter?.id ?? '') === recruiter) &&
      (!needle || `${j.code} ${j.title} ${j.department.name}`.toLowerCase().includes(needle)),
  );
  const count = (st: JobStatus) => list.filter((j) => label(j) === st).length;
  const open = list.filter((j) => j.status === 'OPEN');
  const openPositions = open.reduce((n, j) => n + Math.max(0, j.positions - j.filled), 0);

  return (
    <div className="hm-page">
      <HiringHeader
        title="Jobs"
        description="Openings created from approved requisitions. Open a job to work its pipeline."
        actions={
          canCreate && (
            <Button variant="primary" onClick={() => setPicker(true)}>
              <PlusIcon /> New job
            </Button>
          )
        }
      />
      {loadError && (
        <Banner tone="warn">
          Jobs could not be loaded: {loadError}{' '}
          <button type="button" className="btn sm ghost" onClick={load}>
            Try again
          </button>
        </Banner>
      )}

      <StatStrip
        items={[
          { label: 'Open jobs', value: open.length, icon: <JoinIcon />, tone: 'blue', hint: `${openPositions} position${openPositions === 1 ? '' : 's'} to fill` },
          { label: 'Active candidates', value: list.reduce((n, j) => n + j.candidates.active, 0), icon: <PeopleIcon />, tone: 'purple', hint: 'Across these jobs' },
          { label: 'Positions filled', value: list.reduce((n, j) => n + j.filled, 0), icon: <CheckIcon />, tone: 'green', hint: `of ${list.reduce((n, j) => n + j.positions, 0)} approved` },
          ...(canCreate ? [{ label: 'Ready to create', value: eligible.length, icon: <PlusIcon />, tone: 'amber' as const, hint: 'Approved requisitions without a job' }] : []),
        ]}
      />

      <Card>
        <CardHeader title="All jobs" sub={jobs ? `${rows.length} of ${list.length}` : 'Loading…'} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, title or department…" />
          </div>
          {full && recruiters.length > 0 && (
            <select className="chip" value={recruiter} onChange={(e) => setRecruiter(e.target.value)} aria-label="Recruiter">
              <option value="All">All recruiters</option>
              {recruiters.map(([id, name]) => (
                <option key={id} value={id}>
                  {name} · {list.filter((j) => j.recruiter?.id === id).length}
                </option>
              ))}
            </select>
          )}
          {STATUSES.map((st) => (
            <button key={st} type="button" className={`chip ${status === st ? 'tx-chip-on' : ''}`} onClick={() => setStatus(st)}>
              {st} · {st === 'All' ? list.length : count(st)}
            </button>
          ))}
        </div>
        {!jobs ? (
          <p className="sb" style={{ padding: '16px 20px' }}>
            {loadError ? '—' : 'Loading…'}
          </p>
        ) : !rows.length ? (
          <EmptyState
            icon={<JoinIcon />}
            title={list.length ? 'No jobs match' : 'No jobs yet'}
            description={list.length ? 'Try a different search or status.' : full ? 'Approve a requisition, then create a job from it.' : 'Jobs you recruit for or manage appear here.'}
          />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Hiring manager</th>
                  <th>Recruiter</th>
                  <th>Filled</th>
                  <th>Candidates</th>
                  <th>Closes</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link href={`/hiring/jobs/${j.id}`} className="hm-link">
                        <div style={{ fontWeight: 600 }}>{j.title}</div>
                        <div className="tx-s faint">
                          {j.code} · {j.department.name} · {amount(j.budgetMin)} – {amount(j.budgetMax)} {payUnit(j.budgetMin.currency)}
                        </div>
                      </Link>
                    </td>
                    <td>{j.hiringManager.name}</td>
                    <td>{j.recruiter?.name ?? <span className="faint">Awaiting {j.taManager?.name ?? 'recruiter'}</span>}</td>
                    <td className="mono">
                      <span className="hm-fill">
                        {j.filled}/{j.positions}
                      </span>
                    </td>
                    <td className="mono">
                      {j.candidates.active} active <span className="faint">/ {j.candidates.total}</span>
                    </td>
                    <td className="mono">{fmtDate(j.closingDate)}</td>
                    <td>
                      <JobBadge status={label(j)} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/hiring/jobs/${j.id}`} className="btn sm primary">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={picker} onClose={() => setPicker(false)} title="New job" description="A job starts from an approved requisition, so the headcount and budget are already signed off.">
        {!eligible.length ? (
          <>
            <EmptyState icon={<JoinIcon />} title="No approved requisitions are waiting" description="Every approved requisition here already has a job. To open a new role, raise a requisition and get it approved; it will then appear here." />
            <div style={{ textAlign: 'center' }}>
              <Link href="/hiring/requisitions?new=1" className="btn primary">
                <PlusIcon /> Raise a requisition
              </Link>
            </div>
          </>
        ) : (
          <div className="hm-pick">
            {eligible.map((r) => (
              <button
                key={r.id}
                type="button"
                className="hm-pick-row"
                onClick={() => {
                  setPicker(false);
                  setFrom(r);
                }}
              >
                <span>
                  <b>{r.title}</b>
                  <small>
                    {r.code} · {r.department.name} · {r.positions} position{r.positions === 1 ? '' : 's'} · {amount(r.budgetMin)} – {amount(r.budgetMax)}
                  </small>
                </span>
                <span className="lnk">Create →</span>
              </button>
            ))}
          </div>
        )}
      </Drawer>
      <ServerJobDrawer
        requisition={from}
        onClose={() => setFrom(null)}
        onDone={(j) => {
          setFrom(null);
          router.push(`/hiring/jobs/${j.id}`);
        }}
      />
    </div>
  );
}
