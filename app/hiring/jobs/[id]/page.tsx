'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { ArrowLeftIcon, JoinIcon, PlusIcon } from '@/components/icons';
import { Banner, Hero, JobBadge, empName, fmtDate, money, payUnit, useActor } from '@/components/hiring/HiringBits';
import { CandidateDrawer, RecruiterDrawer } from '@/components/hiring/HiringForms';
import { ShareJobDrawer } from '@/components/hiring/ShareJob';
import { JobHistory } from '@/components/hiring/JobHistory';
import { Pipeline } from '@/components/hiring/Pipeline';
import { useScoped } from '@/components/hiring/useScoped';
import { appsForJob, isActiveApp, jobById, recruiterIdOf, reqById, setJobStatus } from '@/lib/hiringStore';
import { JobStatus } from '@/lib/hiringTypes';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { s, level, me } = useScoped();
  const actor = useActor();
  const [tab, setTab] = useState<'pipeline' | 'details' | 'history'>('pipeline');
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [changing, setChanging] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  const notify = (text: string, tone: 'info' | 'warn' = 'info') => setMsg({ text, tone });

  const job = jobById(s, id);
  const allowed = !!job && (level === 'full' || job.hiringManagerId === me.id);
  if (!job || !allowed) {
    return (
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
  }

  const apps = appsForJob(s, job.id);
  const req = reqById(s, job.requisitionId);
  const interviews = s.interviews.filter((i) => apps.some((a) => a.id === i.applicationId) && i.status === 'Scheduled');
  const offers = s.offers.filter((o) => apps.some((a) => a.id === o.applicationId) && ['Draft', 'Sent', 'Pending Approval', 'Approved'].includes(o.status));
  const setStatus = (st: JobStatus) => {
    setJobStatus(job.id, st, actor);
    notify(`Job is now ${st.toLowerCase()}.`);
  };
  const canManage = level === 'full';

  return (
    <div className="hm-page">
      <Link href="/hiring/jobs" className="hub-back">
        <ArrowLeftIcon />
        Back to jobs
      </Link>
      <Hero
        icon={<JoinIcon />}
        title={job.title}
        badges={<JobBadge status={job.status} />}
        meta={[job.code, job.department, job.location === 'Kochi' ? 'India' : 'United Arab Emirates', job.employmentType, `Hiring manager: ${empName(job.hiringManagerId)}`, `Recruiter: ${empName(recruiterIdOf(job))}`]}
        actions={
          <>
            {canManage && job.status === 'Draft' && <Button onClick={() => setStatus('Open')}>Open for applications</Button>}
            {canManage && job.status === 'Open' && <Button onClick={() => setStatus('On Hold')}>Put on hold</Button>}
            {canManage && job.status === 'On Hold' && <Button onClick={() => setStatus('Open')}>Resume</Button>}
            {canManage && (job.status === 'Open' || job.status === 'On Hold') && <Button onClick={() => setStatus('Closed')}>Close job</Button>}
            {canManage && job.status === 'Closed' && job.filled < job.positions && <Button onClick={() => setStatus('Open')}>Reopen</Button>}
            {canManage && <Button onClick={() => setChanging(true)}>Change recruiter</Button>}
            <Button onClick={() => setSharing(true)}>Share job</Button>
            <Button variant="primary" onClick={() => setAdding(true)} disabled={job.status === 'Closed' || job.status === 'Filled'}>
              <PlusIcon /> Add candidate
            </Button>
          </>
        }
        stats={[
          { label: 'Positions filled', value: `${job.filled}/${job.positions}`, progress: job.positions ? (job.filled / job.positions) * 100 : 0, hint: job.status === 'Filled' ? 'Job is filled' : `${Math.max(0, job.positions - job.filled)} to go` },
          { label: 'Active candidates', value: apps.filter(isActiveApp).length, hint: `${apps.length} applied in total` },
          { label: 'Interviews', value: interviews.length, hint: 'Scheduled' },
          { label: 'Offers in progress', value: offers.length, hint: 'Draft or sent' },
          { label: 'Closes', value: fmtDate(job.closingDate), hint: `${money(job.budgetMin, job.currency)} – ${money(job.budgetMax, job.currency)} ${payUnit(job.currency)}` },
        ]}
      />
      {msg && <Banner tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Banner>}

      <div className="subseg hm-tabs" role="tablist" aria-label="Job sections">
        <button role="tab" aria-selected={tab === 'pipeline'} className={tab === 'pipeline' ? 'on' : ''} onClick={() => setTab('pipeline')}>
          Pipeline
        </button>
        <button role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>
          Job details
        </button>
        <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          History
        </button>
      </div>

      {tab === 'pipeline' ? (
        <Card>
          <CardHeader title="Candidate pipeline" sub="Drag a card to a column, or use Move to… on the card. Rejecting asks for a reason." />
          <Pipeline job={job} apps={apps} notify={notify} />
        </Card>
      ) : tab === 'history' ? (
        <JobHistory job={job} />
      ) : (
        <div className="hm-grid hm-grid-wide">
          <Card>
            <CardHeader title="Role" />
            <div style={{ padding: '0 20px 18px' }}>
              <div className="tx-read"><div className="l">Description</div><div className="v hm-pre">{job.description}</div></div>
              <div className="tx-read"><div className="l">Key skills</div><div className="v"><div className="hm-tags big">{job.skills.map((k) => <span key={k}>{k}</span>)}</div></div></div>
              <div className="tx-read"><div className="l">Experience</div><div className="v">{job.expMin} – {job.expMax} years</div></div>
              <div className="tx-read"><div className="l">Qualifications</div><div className="v">{job.qualifications || '—'}</div></div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Hiring" />
            <div style={{ padding: '0 20px 18px' }}>
              <div className="tx-read"><div className="l">Requisition</div><div className="v">{req ? <Link href={`/hiring/requisitions/${req.id}`} className="lnk">{req.code}</Link> : '—'}</div></div>
              <div className="tx-read"><div className="l">Budget ({payUnit(job.currency)})</div><div className="v">{money(job.budgetMin, job.currency)} – {money(job.budgetMax, job.currency)}</div></div>
              <div className="tx-read"><div className="l">Interview panel</div><div className="v">{job.panelIds.map(empName).join(', ') || '—'}</div></div>
              <div className="tx-read"><div className="l">Employee referrals</div><div className="v">{job.referralEligible ? 'Open to referrals' : 'Not eligible'}</div></div>
              <div className="tx-read"><div className="l">Closing date</div><div className="v">{fmtDate(job.closingDate)}</div></div>
              <div className="tx-read"><div className="l">Created</div><div className="v">{job.createdBy} · {fmtDate(job.createdAt)}</div></div>
            </div>
          </Card>
        </div>
      )}

      <ShareJobDrawer job={job} open={sharing} onClose={() => setSharing(false)} />
      <RecruiterDrawer job={changing ? job : null} onClose={() => setChanging(false)} onDone={(text) => { setChanging(false); notify(text); }} />
      <CandidateDrawer
        open={adding}
        job={job}
        onClose={() => setAdding(false)}
        onDone={(c) => {
          setAdding(false);
          notify(`${c.name} was added to the pipeline at Applied.`);
        }}
      />
    </div>
  );
}
