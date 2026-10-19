'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrg } from '@/context/OrgContext';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { ArrowLeftIcon, CheckIcon, InboxIcon, WarnIcon, XIcon } from '@/components/icons';
import { Banner, Hero, ReqBadge, TEXTAREA_STYLE, empName, fmtDate, fmtDateTime, money, payUnit, useActor } from '@/components/hiring/HiringBits';
import { JobDrawer, RequisitionDrawer } from '@/components/hiring/HiringForms';
import { useScoped } from '@/components/hiring/useScoped';
import { canDecideStep, decideRequisition, jobForRequisition, reqById, setRequisitionStatus, submitRequisition } from '@/lib/hiringStore';
import { Job } from '@/lib/hiringTypes';
import { useRouter } from 'next/navigation';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="tx-read">
    <div className="l">{label}</div>
    <div className="v">{children}</div>
  </div>
);

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { s, level, me, requisitions } = useScoped();
  const actor = useActor();
  const router = useRouter();
  const { companies } = useOrg();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState(false);
  const [jobFor, setJobFor] = useState(false);

  // Look the record up directly (not only in the current location) so a link always opens, but respect who may see it.
  const r = reqById(s, id);
  const mine = !!r && (level === 'full' || r.hiringManagerId === me.id || r.createdById === me.id);
  void requisitions;
  if (!r || !mine) {
    return (
      <div className="hm-page">
        <Card>
          <EmptyState icon={<InboxIcon />} title="Requisition not found" description="It may have been removed, or it belongs to another hiring manager." />
          <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
            <Link href="/hiring/requisitions" className="btn ghost">
              Back to requisitions
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const job = jobForRequisition(s, r.id);
  const company = companies.find((c) => c.id === r.companyId);
  const pending = r.approvals.find((a) => a.status === 'Pending');
  const mayDecide = r.status === 'Pending Approval' && !!pending && canDecideStep(pending.label, actor.role, me.id, r);
  const mayEdit = (r.status === 'Draft' || r.status === 'Rejected') && (level === 'full' || r.createdById === me.id || r.hiringManagerId === me.id);

  const decide = (d: 'Approved' | 'Rejected') => {
    const res = decideRequisition(r.id, d, actor, note);
    if (!res.ok) return setError(res.error);
    setError('');
    setNote('');
    setNotice(d === 'Approved' ? `${pending?.label} step approved.` : 'Requisition rejected. The requester can edit and resubmit it.');
  };

  return (
    <div className="hm-page">
      <Link href="/hiring/requisitions" className="hub-back">
        <ArrowLeftIcon />
        Back to requisitions
      </Link>
      <Hero
        icon={<InboxIcon />}
        title={r.title}
        badges={<ReqBadge status={r.status} />}
        meta={[r.code, r.department, ...(r.designationTitle ? [r.designationTitle] : []), company?.name ?? '', r.location === 'Kochi' ? 'India' : 'United Arab Emirates']}
        actions={
          <>
            {mayEdit && <Button onClick={() => setEdit(true)}>Edit</Button>}
            {mayEdit && (
              <Button
                variant="primary"
                onClick={() => {
                  const res = submitRequisition(r.id, actor);
                  setNotice(res.ok ? `${r.code} was submitted for approval.` : res.error);
                }}
              >
                {r.status === 'Rejected' ? 'Resubmit for approval' : 'Submit for approval'}
              </Button>
            )}
            {r.status === 'Approved' && !job && level === 'full' && (
              <Button variant="primary" onClick={() => setJobFor(true)}>
                Create job
              </Button>
            )}
            {job && (
              <Link href={`/hiring/jobs/${job.id}`} className="btn primary">
                Open {job.code}
              </Link>
            )}
          </>
        }
        stats={[
          { label: 'Positions', value: r.positions, hint: r.employmentType },
          { label: `Budget ${payUnit(r.currency)}`, value: `${r.currency} ${r.budgetMin.toLocaleString('en-US')}–${r.budgetMax.toLocaleString('en-US')}` },
          { label: 'Target start', value: fmtDate(r.targetStart) },
          { label: 'Hiring manager', value: empName(r.hiringManagerId) },
          { label: 'Reason', value: r.reason, hint: r.replacesId ? `Replaces ${empName(r.replacesId)}` : undefined },
        ]}
      />
      {notice && <Banner onClose={() => setNotice('')}>{notice}</Banner>}

      <div className="hm-grid hm-grid-wide">
        <Card>
          <CardHeader title="Details" />
          <div style={{ padding: '2px 20px 18px' }}>
            <Row label="Positions">{r.positions}</Row>
            <Row label="Employment type">{r.employmentType}</Row>
            <Row label="Reason">
              {r.reason}
              {r.replacesId && <span className="faint"> · replaces {empName(r.replacesId)}</span>}
            </Row>
            <Row label={`Budget (${payUnit(r.currency)})`}>
              {money(r.budgetMin, r.currency)} – {money(r.budgetMax, r.currency)}
            </Row>
            <Row label="Target start">{fmtDate(r.targetStart)}</Row>
            <Row label="Hiring manager">{empName(r.hiringManagerId)}</Row>
            <Row label="Raised by">
              {r.createdBy} <span className="faint">· {fmtDateTime(r.createdAt)}</span>
            </Row>
            <Row label="Justification">{r.justification}</Row>
          </div>
        </Card>

        <Card>
          <CardHeader title="Approval" sub="Hiring Manager → HR → Management" />
          <ol className="hm-chain">
            {r.approvals.map((a) => (
              <li key={a.label} className={a.status.toLowerCase()}>
                <span className="hm-chain-dot">{a.status === 'Approved' ? <CheckIcon /> : a.status === 'Rejected' ? <XIcon /> : null}</span>
                <div>
                  <b>{a.label}</b>
                  <small>
                    {a.status === 'Approved' || a.status === 'Rejected' ? `${a.status} by ${a.by} · ${a.at ? fmtDateTime(a.at) : ''}` : a.status === 'Pending' ? 'Waiting for a decision' : 'Not reached yet'}
                  </small>
                  {a.note && <small className="hm-chain-note">“{a.note}”</small>}
                </div>
              </li>
            ))}
          </ol>

          {r.status === 'Pending Approval' && !mayDecide && pending && (
            <div className="note-box" style={{ margin: '0 20px 18px' }}>
              <WarnIcon />
              <div>This is waiting on the {pending.label} step. Only that approver (or a Super Admin) can decide it.</div>
            </div>
          )}
          {mayDecide && (
            <div style={{ padding: '0 20px 20px' }}>
              <div className="fg full">
                <label>
                  Decision note <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(required to reject)</span>
                </label>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={TEXTAREA_STYLE} placeholder="Optional for approval" />
              </div>
              {error && <div className="tx-err" style={{ marginTop: 10 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button variant="danger" onClick={() => decide('Rejected')}>
                  Reject
                </Button>
                <Button variant="success" onClick={() => decide('Approved')}>
                  Approve {pending?.label} step
                </Button>
              </div>
            </div>
          )}
          {level === 'full' && (r.status === 'Approved' || r.status === 'On Hold') && (
            <div style={{ padding: '0 20px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {r.status === 'Approved' && (
                <Button
                  onClick={() => {
                    setRequisitionStatus(r.id, 'On Hold', actor);
                    setNotice('Requisition put on hold.');
                  }}
                >
                  Put on hold
                </Button>
              )}
              {r.status === 'On Hold' && (
                <Button
                  onClick={() => {
                    setRequisitionStatus(r.id, 'Approved', actor);
                    setNotice('Requisition is active again.');
                  }}
                >
                  Resume
                </Button>
              )}
              <Button
                onClick={() => {
                  setRequisitionStatus(r.id, 'Closed', actor);
                  setNotice('Requisition closed.');
                }}
              >
                Close requisition
              </Button>
            </div>
          )}
        </Card>
      </div>

      <RequisitionDrawer open={edit} edit={r} onClose={() => setEdit(false)} onDone={(x, submitted) => { setEdit(false); setNotice(submitted ? `${x.code} was submitted for approval.` : `${x.code} was updated.`); }} />
      <JobDrawer requisition={jobFor ? r : null} onClose={() => setJobFor(false)} onDone={(j: Job) => router.push(`/hiring/jobs/${j.id}`)} />
    </div>
  );
}
