'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { ArrowLeftIcon, HistoryIcon, JoinIcon, PlusIcon, WarnIcon } from '@/components/icons';
import { Banner, Hero, JobBadge, fmtDate, payUnit } from '@/components/hiring/HiringBits';
import { ServerRecruiterDrawer } from '@/components/hiring/ServerJobForm';
import { ServerPipeline } from '@/components/hiring/ServerPipeline';
import { ServerCandidateDrawer } from '@/components/hiring/ServerCandidateForm';
import { ApiError, errorMessage } from '@/lib/api';
import { can } from '@/lib/access';
import { usePermissions } from '@/lib/auth';
import { ServerApplication, pipelineApi } from '@/lib/candidatesApi';
import { JOB_ACTION_LABEL, JOB_STATUS, JobAction, type ServerJobDetail as JobData, jobsApi } from '@/lib/jobsApi';
import { EMPLOYMENT, amount } from '@/lib/requisitionsApi';

/* One job from the backend (local development). Status buttons come from `viewer.actions` and the recruiter button
   from `viewer.canChangeRecruiter` (BR-HIR-021), so the screen does not repeat the rules. The Pipeline tab needs
   Candidates → View; Add candidate needs Candidates → Add and an open job. The History tab lists the job's own changes.
   Interviews and offers connect in later steps. */

const Read = ({ l, children }: { l: string; children: React.ReactNode }) => (
  <div className="tx-read">
    <div className="l">{l}</div>
    <div className="v">{children}</div>
  </div>
);

const NotFound = () => (
  <div className="hm-page">
    <Card>
      <EmptyState icon={<JoinIcon />} title="Job not found" description="It may have been removed, or it belongs to another hiring manager." />
      <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
        <Link href="/hiring/jobs" className="btn ghost">
          Back to jobs
        </Link>
      </div>
    </Card>
  </div>
);

const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const localTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function ServerJobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<JobData | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'pipeline' | 'details' | 'history'>('pipeline');
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  const [apps, setApps] = useState<ServerApplication[] | null>(null);
  const [appsError, setAppsError] = useState('');
  const [adding, setAdding] = useState(false);
  const perms = usePermissions() ?? [];
  const seesCandidates = can(perms, 'hiring:recruiting:candidates');
  const canAdd = can(perms, 'hiring:recruiting:candidates', 'add');
  const notify = useCallback((text: string, tone: 'info' | 'warn' = 'info') => setMsg({ text, tone }), []);

  useEffect(() => {
    let live = true;
    jobsApi
      .get(id)
      .then((j) => live && setJob(j))
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setMissing(true);
        else setLoadError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [id]);

  // Every application on the job, for the board (see ServerPipeline).
  const loadApps = useCallback(() => {
    let live = true;
    if (seesCandidates) {
      pipelineApi
        .all(id)
        .then((rows) => {
          if (!live) return;
          setApps(rows);
          setAppsError('');
        })
        .catch((e) => live && setAppsError(errorMessage(e)));
    }
    return () => {
      live = false;
    };
  }, [id, seesCandidates]);
  useEffect(loadApps, [loadApps]);
  const onApps = useCallback((change: (rows: ServerApplication[]) => ServerApplication[]) => setApps((rows) => (rows ? change(rows) : rows)), []);

  if (missing) return <NotFound />;
  if (!job) {
    return (
      <div className="hm-page">
        <Link href="/hiring/jobs" className="hub-back">
          <ArrowLeftIcon />
          Back to jobs
        </Link>
        {loadError ? <Banner tone="warn">The job could not be loaded: {loadError}</Banner> : <p className="sb">Loading…</p>}
      </div>
    );
  }

  const act = async (action: JobAction) => {
    if (busy) return;
    setBusy(true);
    try {
      const j = await jobsApi.act(job.id, action);
      setJob(j);
      setMsg({ text: `Job is now ${JOB_STATUS[j.status].toLowerCase()}.`, tone: 'info' });
    } catch (e) {
      setMsg({ text: errorMessage(e), tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const status = JOB_STATUS[job.status];
  const cur = job.budgetMin.currency;
  const awaiting = !job.recruiter;
  const history = [...job.history].reverse();
  const days = [...new Set(history.map((h) => localDay(h.at)))];
  // Live from the loaded pipeline once it is there: active = not closed out and not hired (the server's count).
  const counts = apps ? { active: apps.filter((a) => !a.exit && a.stage !== 'HIRED').length, total: apps.length } : job.candidates;
  const open = job.status === 'OPEN';

  return (
    <div className="hm-page">
      <Link href="/hiring/jobs" className="hub-back">
        <ArrowLeftIcon />
        Back to jobs
      </Link>
      <Hero
        icon={<JoinIcon />}
        title={job.title}
        badges={<JobBadge status={status} />}
        meta={[job.code, job.department.name, job.location.name, EMPLOYMENT[job.employmentType], `Hiring manager: ${job.hiringManager.name}`, `Recruiter: ${job.recruiter?.name ?? 'not chosen yet'}`]}
        actions={
          <>
            {job.viewer.actions.map((a) => (
              <Button key={a} disabled={busy} onClick={() => act(a)}>
                {JOB_ACTION_LABEL[a]}
              </Button>
            ))}
            {job.viewer.canChangeRecruiter && (
              <Button variant={awaiting ? 'primary' : undefined} onClick={() => setChanging(true)}>
                {awaiting ? 'Choose recruiter' : 'Change recruiter'}
              </Button>
            )}
            {canAdd && (
              <Button variant="primary" onClick={() => setAdding(true)} disabled={!open} title={open ? undefined : 'Candidates can be added while the job is open'}>
                <PlusIcon /> Add candidate
              </Button>
            )}
          </>
        }
        stats={[
          { label: 'Positions filled', value: `${job.filled}/${job.positions}`, progress: job.positions ? (job.filled / job.positions) * 100 : 0, hint: job.status === 'FILLED' ? 'Job is filled' : `${Math.max(0, job.positions - job.filled)} to go` },
          { label: 'Active candidates', value: counts.active, hint: `${counts.total} applied in total` },
          { label: 'Closes', value: fmtDate(job.closingDate), hint: `${amount(job.budgetMin)} – ${amount(job.budgetMax)} ${payUnit(cur)}` },
        ]}
      />
      {msg && (
        <Banner tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Banner>
      )}
      {awaiting && (
        <div className="note-box" style={{ marginBottom: 14 }}>
          <WarnIcon />
          <div>{job.viewer.canChangeRecruiter ? 'This job has no recruiter yet. Choose who will run it.' : `Waiting for ${job.taManager?.name ?? 'the Talent Acquisition Manager'} to choose the recruiter.`}</div>
        </div>
      )}

      <div className="subseg hm-tabs" role="tablist" aria-label="Job sections">
        {(['pipeline', 'details', 'history'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'pipeline' ? 'Pipeline' : t === 'details' ? 'Job details' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'pipeline' ? (
        <Card>
          <CardHeader title="Candidate pipeline" sub="Drag a card to a column, or use Move to… on the card. Rejecting asks for a reason." />
          {!seesCandidates ? (
            <div className="note-box" style={{ margin: '0 20px 20px' }}>
              <WarnIcon />
              <div>Seeing candidates needs Candidates → View. The counts above are live.</div>
            </div>
          ) : appsError ? (
            <Banner tone="warn">
              The candidates could not be loaded: {appsError}{' '}
              <button type="button" className="btn sm ghost" onClick={loadApps}>
                Try again
              </button>
            </Banner>
          ) : !apps ? (
            <p className="sb" style={{ padding: '0 20px 20px' }}>
              Loading…
            </p>
          ) : (
            <ServerPipeline job={job} apps={apps} onApps={onApps} notify={notify} />
          )}
        </Card>
      ) : tab === 'history' ? (
        <Card>
          <CardHeader title="Job history" sub={`${history.length} event${history.length === 1 ? '' : 's'} since ${fmtDate(job.createdAt)}`} />
          {!history.length ? (
            <EmptyState icon={<HistoryIcon />} title="Nothing here yet" description="Changes to the job are listed here as they happen." />
          ) : (
            <div className="hm-hist">
              {days.map((d) => (
                <section key={d}>
                  <h4>{fmtDate(d)}</h4>
                  {history
                    .filter((h) => localDay(h.at) === d)
                    .map((h) => (
                      <div key={h.id} className="hm-feed-row">
                        <span className="dotm job" />
                        <div>
                          {h.text}
                          <small>
                            {h.by} · {localTime(h.at)}
                          </small>
                        </div>
                        <span className="hm-hist-k">Job</span>
                      </div>
                    ))}
                </section>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="hm-grid hm-grid-wide">
          <Card>
            <CardHeader title="Role" />
            <div style={{ padding: '0 20px 18px' }}>
              <Read l="Description">
                <div className="hm-pre">{job.description}</div>
              </Read>
              <Read l="Key skills">
                <div className="hm-tags big">
                  {job.skills.map((k) => (
                    <span key={k}>{k}</span>
                  ))}
                </div>
              </Read>
              <Read l="Experience">
                {job.expMin} – {job.expMax} years
              </Read>
              <Read l="Qualifications">{job.qualifications || '—'}</Read>
              <Read l="Designation">{job.designation?.name ?? '—'}</Read>
            </div>
          </Card>
          <Card>
            <CardHeader title="Hiring" />
            <div style={{ padding: '0 20px 18px' }}>
              <Read l="Requisition">
                <Link href={`/hiring/requisitions/${job.requisition.id}`} className="lnk">
                  {job.requisition.code}
                </Link>
              </Read>
              <Read l={`Budget (${payUnit(cur)})`}>
                {amount(job.budgetMin)} – {amount(job.budgetMax)}
              </Read>
              <Read l="Interview panel">{job.panel.map((p) => p.name).join(', ') || '—'}</Read>
              <Read l="Employee referrals">{job.referralEligible ? 'Open to referrals' : 'Not eligible'}</Read>
              <Read l="Closing date">{fmtDate(job.closingDate)}</Read>
              <Read l="Created">
                {job.createdBy.name} · {fmtDate(job.createdAt)}
              </Read>
            </div>
          </Card>
        </div>
      )}

      <ServerRecruiterDrawer
        job={changing ? job : null}
        onClose={() => setChanging(false)}
        onDone={(j) => {
          setChanging(false);
          setJob(j);
          setMsg({ text: `${j.code} is now recruited by ${j.recruiter?.name ?? '—'}.`, tone: 'info' });
        }}
      />
      <ServerCandidateDrawer
        job={adding ? job : null}
        applied={new Set((apps ?? []).map((a) => a.candidate.id))}
        onClose={() => setAdding(false)}
        onDone={(text) => {
          setAdding(false);
          notify(text);
          loadApps();
        }}
      />
    </div>
  );
}
