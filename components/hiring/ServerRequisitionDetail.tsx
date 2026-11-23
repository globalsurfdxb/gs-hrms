'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { ArrowLeftIcon, CheckIcon, InboxIcon, WarnIcon, XIcon } from '@/components/icons';
import { Banner, Hero, ReqBadge, TEXTAREA_STYLE, fmtDate, fmtDateTime, payUnit } from '@/components/hiring/HiringBits';
import { ServerRequisitionDrawer } from '@/components/hiring/ServerRequisitionForm';
import { ApiError, errorMessage } from '@/lib/api';
import { EMPLOYMENT, REASON, REQ_STATUS, STEP_LABEL, ServerRequisition, amount, designationOf, requisitionsApi } from '@/lib/requisitionsApi';

/* One requisition from the backend (local development). Buttons follow `viewer` from the server: edit and submit,
   decide the pending step, hold / resume / close. Every action returns the updated requisition. Opening a job from it
   comes with the jobs screens; until then an existing job shows its code only. */

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="tx-read">
    <div className="l">{label}</div>
    <div className="v">{children}</div>
  </div>
);

const NotFound = () => (
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

export function ServerRequisitionDetail({ id }: { id: string }) {
  const [r, setR] = useState<ServerRequisition | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    let live = true;
    requisitionsApi
      .get(id)
      .then((x) => live && setR(x))
      .catch((e) => {
        if (!live) return;
        // A malformed id is a 400; either way there is nothing to show.
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setMissing(true);
        else setLoadError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (missing) return <NotFound />;
  if (!r) {
    return (
      <div className="hm-page">
        <Link href="/hiring/requisitions" className="hub-back">
          <ArrowLeftIcon />
          Back to requisitions
        </Link>
        {loadError ? <Banner tone="warn">The requisition could not be loaded: {loadError}</Banner> : <p className="sb">Loading…</p>}
      </div>
    );
  }

  /** Runs an action; the server's answer replaces the page's copy. */
  const act = async (run: () => Promise<ServerRequisition>, done: (x: ServerRequisition) => string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const x = await run();
      setR(x);
      setNotice(done(x));
      setNote('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const status = REQ_STATUS[r.status];
  const pending = r.steps.find((s) => s.status === 'PENDING');
  const pendingLabel = pending ? STEP_LABEL[pending.label] : '';
  const d = designationOf(r);
  const allApproved = r.steps.length > 0 && r.steps.every((s) => s.status === 'APPROVED');
  const cur = r.budgetMin.currency;
  const { viewer } = r;

  const decide = (decision: 'APPROVED' | 'REJECTED') => {
    if (decision === 'REJECTED' && !note.trim()) return setError('Add a note to say why it is rejected.');
    void act(
      () => requisitionsApi.decide(r.id, decision, note.trim()),
      () => (decision === 'APPROVED' ? `${pendingLabel} step approved.` : 'Requisition rejected. The requester can edit and resubmit it.'),
    );
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
        badges={<ReqBadge status={status} />}
        meta={[r.code, r.department.name, ...(d ? [d.isNew ? `${d.title} (new)` : d.title] : []), r.company.name, r.location.name]}
        actions={
          <>
            {viewer.canEdit && <Button onClick={() => setEdit(true)}>Edit</Button>}
            {viewer.canEdit && (
              <Button variant="primary" disabled={busy} onClick={() => act(() => requisitionsApi.submit(r.id), (x) => `${x.code} was submitted for approval.`)}>
                {r.status === 'REJECTED' ? 'Resubmit for approval' : 'Submit for approval'}
              </Button>
            )}
            {r.job && <span className="btn ghost" title="The jobs screens connect to the server next">{r.job.code}</span>}
          </>
        }
        stats={[
          { label: 'Positions', value: r.positions, hint: EMPLOYMENT[r.employmentType] },
          { label: `Budget ${payUnit(cur)}`, value: `${amount(r.budgetMin)}–${amount(r.budgetMax).replace(`${cur} `, '')}` },
          { label: 'Target start', value: fmtDate(r.targetStart) },
          { label: 'Hiring manager', value: r.hiringManager.name },
          { label: 'Reason', value: REASON[r.reason], hint: r.replaces ? `Replaces ${r.replaces.name}` : undefined },
        ]}
      />
      {notice && <Banner onClose={() => setNotice('')}>{notice}</Banner>}

      <div className="hm-grid hm-grid-wide">
        <Card>
          <CardHeader title="Details" />
          <div style={{ padding: '2px 20px 18px' }}>
            <Row label="Positions">{r.positions}</Row>
            <Row label="Employment type">{EMPLOYMENT[r.employmentType]}</Row>
            {d && (
              <Row label="Designation">
                {d.title}
                {d.isNew && <span className="faint"> · {allApproved ? `new, added to ${r.department.name}` : `new: added to ${r.department.name} once this is approved`}</span>}
              </Row>
            )}
            <Row label="Reason">
              {REASON[r.reason]}
              {r.replaces && <span className="faint"> · replaces {r.replaces.name}</span>}
            </Row>
            <Row label={`Budget (${payUnit(cur)})`}>
              {amount(r.budgetMin)} – {amount(r.budgetMax)}
            </Row>
            <Row label="Target start">{fmtDate(r.targetStart)}</Row>
            <Row label="Hiring manager">{r.hiringManager.name}</Row>
            <Row label="Raised by">
              {r.createdBy.name} <span className="faint">· {fmtDateTime(r.createdAt)}</span>
            </Row>
            <Row label="Justification">{r.justification}</Row>
          </div>
        </Card>

        <Card>
          <CardHeader title="Approval" sub="Hiring Manager → HR → Management" />
          {r.steps.length === 0 ? (
            <p className="sb" style={{ padding: '4px 20px 18px' }}>
              Not submitted yet. The approval chain starts when it is submitted.
            </p>
          ) : (
            <ol className="hm-chain">
              {r.steps.map((s) => (
                <li key={s.position} className={s.status.toLowerCase()}>
                  <span className="hm-chain-dot">{s.status === 'APPROVED' ? <CheckIcon /> : s.status === 'REJECTED' ? <XIcon /> : null}</span>
                  <div>
                    <b>{STEP_LABEL[s.label]}</b>
                    <small>
                      {s.status === 'APPROVED' || s.status === 'REJECTED'
                        ? `${s.status === 'APPROVED' ? 'Approved' : 'Rejected'} by ${s.decidedBy?.name ?? '—'} · ${s.decidedAt ? fmtDateTime(s.decidedAt) : ''}`
                        : s.status === 'PENDING'
                          ? 'Waiting for a decision'
                          : 'Not reached yet'}
                    </small>
                    {s.note && <small className="hm-chain-note">“{s.note}”</small>}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {r.status === 'PENDING_APPROVAL' && !viewer.canDecide && pending && (
            <div className="note-box" style={{ margin: '0 20px 18px' }}>
              <WarnIcon />
              <div>This is waiting on the {pendingLabel} step. Only that approver (or a Super Admin) can decide it.</div>
            </div>
          )}
          {viewer.canDecide && (
            <div style={{ padding: '0 20px 20px' }}>
              <div className="fg full">
                <label>
                  Decision note <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(required to reject)</span>
                </label>
                <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} style={TEXTAREA_STYLE} placeholder="Optional for approval" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button variant="danger" disabled={busy} onClick={() => decide('REJECTED')}>
                  Reject
                </Button>
                <Button variant="success" disabled={busy} onClick={() => decide('APPROVED')}>
                  Approve {pendingLabel} step
                </Button>
              </div>
            </div>
          )}
          {viewer.canManage && (
            <div style={{ padding: '0 20px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {r.status === 'APPROVED' && (
                <Button disabled={busy} onClick={() => act(() => requisitionsApi.hold(r.id), () => 'Requisition put on hold.')}>
                  Put on hold
                </Button>
              )}
              {r.status === 'ON_HOLD' && (
                <Button disabled={busy} onClick={() => act(() => requisitionsApi.resume(r.id), () => 'Requisition is active again.')}>
                  Resume
                </Button>
              )}
              <Button disabled={busy} onClick={() => act(() => requisitionsApi.close(r.id), () => 'Requisition closed.')}>
                Close requisition
              </Button>
            </div>
          )}
          {error && (
            <div className="tx-err" style={{ margin: '0 20px 18px' }}>
              {error}
            </div>
          )}
        </Card>
      </div>

      <ServerRequisitionDrawer
        open={edit}
        edit={r}
        onClose={() => setEdit(false)}
        onDone={(x, submitted) => {
          setEdit(false);
          setR(x);
          setNotice(submitted ? `${x.code} was submitted for approval.` : `${x.code} was updated.`);
        }}
      />
    </div>
  );
}
