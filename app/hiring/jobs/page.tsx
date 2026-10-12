'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { CheckIcon, JoinIcon, PeopleIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { Banner, JobBadge, HiringHeader, empName, fmtDate, money, payUnit } from '@/components/hiring/HiringBits';
import { JobDrawer } from '@/components/hiring/HiringForms';
import { useScoped } from '@/components/hiring/useScoped';
import { isActiveApp, jobForRequisition } from '@/lib/hiringStore';
import { JobStatus, Requisition } from '@/lib/hiringTypes';

const STATUSES: ('All' | JobStatus)[] = ['All', 'Open', 'Draft', 'On Hold', 'Filled', 'Closed'];

export default function JobsPage() {
  const { s, level, jobs, applications, currency, requisitions } = useScoped();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'All' | JobStatus>('All');
  const [picker, setPicker] = useState(false);
  const [from, setFrom] = useState<Requisition | null>(null);
  const [notice, setNotice] = useState('');

  const needle = q.trim().toLowerCase();
  const rows = jobs.filter((j) => (status === 'All' || j.status === status) && (!needle || `${j.code} ${j.title} ${j.department}`.toLowerCase().includes(needle)));
  const count = (st: JobStatus) => jobs.filter((j) => j.status === st).length;
  const eligible = requisitions.filter((r) => r.status === 'Approved' && !jobForRequisition(s, r.id));
  const openPositions = jobs.filter((j) => j.status === 'Open').reduce((n, j) => n + Math.max(0, j.positions - j.filled), 0);

  return (
    <div className="hm-page">
      <HiringHeader
        title="Jobs"
        description="Openings created from approved requisitions. Open a job to work its pipeline."
        actions={
          <>
            {level === 'full' && (
              <Button variant="primary" onClick={() => setPicker(true)}>
                <PlusIcon /> New job
              </Button>
            )}
          </>
        }
      />
      {notice && <Banner onClose={() => setNotice('')}>{notice}</Banner>}

      <StatStrip
        items={[
          { label: 'Open jobs', value: count('Open'), icon: <JoinIcon />, tone: 'blue', hint: `${openPositions} position${openPositions === 1 ? '' : 's'} to fill` },
          { label: 'Active candidates', value: new Set(applications.filter(isActiveApp).map((a) => a.candidateId)).size, icon: <PeopleIcon />, tone: 'purple', hint: 'Across these jobs' },
          { label: 'Positions filled', value: jobs.reduce((n, j) => n + j.filled, 0), icon: <CheckIcon />, tone: 'green', hint: `of ${jobs.reduce((n, j) => n + j.positions, 0)} approved` },
          { label: 'Ready to create', value: eligible.length, icon: <PlusIcon />, tone: 'amber', hint: 'Approved requisitions without a job' },
        ]}
      />

      <Card>
        <CardHeader title="All jobs" sub={`${rows.length} of ${jobs.length}`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, title or department…" />
          </div>
          {STATUSES.map((st) => (
            <button key={st} type="button" className={`chip ${status === st ? 'tx-chip-on' : ''}`} onClick={() => setStatus(st)}>
              {st} · {st === 'All' ? jobs.length : count(st)}
            </button>
          ))}
        </div>
        {!rows.length ? (
          <EmptyState icon={<JoinIcon />} title={jobs.length ? 'No jobs match' : 'No jobs yet'} description={jobs.length ? 'Try a different search or status.' : 'Approve a requisition, then create a job from it.'} />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Hiring manager</th>
                  <th>Filled</th>
                  <th>Candidates</th>
                  <th>Closes</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => {
                  const apps = applications.filter((a) => a.jobId === j.id);
                  return (
                    <tr key={j.id}>
                      <td>
                        <Link href={`/hiring/jobs/${j.id}`} className="hm-link">
                          <div style={{ fontWeight: 600 }}>{j.title}</div>
                          <div className="tx-s faint">
                            {j.code} · {j.department} · {money(j.budgetMin, currency)} – {money(j.budgetMax, currency)} {payUnit(currency)}
                          </div>
                        </Link>
                      </td>
                      <td>{empName(j.hiringManagerId)}</td>
                      <td className="mono">
                        <span className="hm-fill">
                          {j.filled}/{j.positions}
                        </span>
                      </td>
                      <td className="mono">
                        {apps.filter(isActiveApp).length} active <span className="faint">/ {apps.length}</span>
                      </td>
                      <td className="mono">{fmtDate(j.closingDate)}</td>
                      <td>
                        <JobBadge status={j.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/hiring/jobs/${j.id}`} className="btn sm primary">
                          Pipeline
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={picker} onClose={() => setPicker(false)} title="New job" description="A job starts from an approved requisition, so the headcount and budget are already signed off.">
        {!eligible.length ? (
          <EmptyState icon={<JoinIcon />} title="No approved requisitions are waiting" description="Raise a requisition and get it approved first. It will appear here." />
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
                    {r.code} · {r.department} · {r.positions} position{r.positions === 1 ? '' : 's'} · {money(r.budgetMin, r.currency)} – {money(r.budgetMax, r.currency)}
                  </small>
                </span>
                <span className="lnk">Create →</span>
              </button>
            ))}
          </div>
        )}
      </Drawer>
      <JobDrawer
        requisition={from}
        onClose={() => setFrom(null)}
        onDone={(j) => {
          setFrom(null);
          setNotice(`${j.code} was created${j.status === 'Open' ? ' and is open for applications' : ' as a draft'}.`);
          router.push(`/hiring/jobs/${j.id}`);
        }}
      />
    </div>
  );
}
