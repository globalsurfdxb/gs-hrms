'use client';

import { useState } from 'react';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { DateField } from '@/components/ui/DateField';
import { Fg, TEXTAREA_STYLE, fmtDate, useActor } from '@/components/hiring/HiringBits';
import { COMPANIES } from '@/lib/data';
import { addDays, todayISO } from '@/lib/dates';
import { prepareMail, renderText, sendMail } from '@/lib/hiringMail';
import { getHiring, jobById, useHiring } from '@/lib/hiringStore';
import { Application, Candidate } from '@/lib/hiringTypes';
import {
  DocRequest,
  DocItem,
  docRequestFor,
  docsLabel,
  docsLink,
  getDocRequests,
  issuesText,
  markDocsMailed,
  referralComplete,
  rejectItem,
  rejectReferral,
  reopenDocs,
  requestDocs,
  slotList,
  useDocRequests,
  verifiedCount,
  verifyItem,
  verifyReferral,
  waiveDocs,
} from '@/lib/hiringDocs';

type Notify = (text: string, tone?: 'info' | 'warn') => void;
type MailKind = 'request' | 'fix' | 'verified';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const newToken = () => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** A short status chip for lists: where this candidate's documents stand before the offer. */
export function DocsChip({ applicationId }: { applicationId: string }) {
  const list = useDocRequests();
  const l = docsLabel(docRequestFor(list, applicationId));
  return <span className={`dc-chip tone-${l.tone}`}>{l.text}</span>;
}

/** The company the offer would come from, for the email wording. */
function companyOf(application: Application): string | undefined {
  const j = jobById(getHiring(), application.jobId);
  return COMPANIES.find((c) => c.id === j?.companyId)?.name;
}

function MailDrawer({ kind, application, candidate, req, onClose, onSent }: { kind: MailKind; application: Application; candidate: Candidate; req?: DocRequest; onClose: () => void; onSent: (text: string) => void }) {
  const actor = useActor();
  const s = useHiring();
  const job = jobById(s, application.jobId);
  const [token] = useState(() => req?.token ?? newToken());
  const [due, setDue] = useState(() => req?.dueDate ?? addDays(todayISO(), 5));
  const [subjectEdit, setSubjectEdit] = useState<string | null>(null);
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  const [error, setError] = useState('');

  const templateId = kind === 'request' ? 'tpl-docs-request' : kind === 'fix' ? 'tpl-docs-fix' : 'tpl-docs-verified';
  const location = job?.location ?? candidate.location;
  const extra: Record<string, string> = { 'docs.link': docsLink(token), 'docs.dueDate': fmtDate(due), 'docs.list': slotList(location), 'docs.issues': req ? issuesText(req) : '' };
  const prepared = prepareMail(templateId, { candidateId: candidate.id, applicationId: application.id, recruiter: actor.name, extra });
  const subject = subjectEdit ?? prepared?.subject ?? '';
  const body = bodyEdit ?? prepared?.body ?? '';
  const unresolved = [...new Set([...renderText(subject, {}).missing, ...renderText(body, {}).missing])];

  const title = kind === 'request' ? (req ? 'Ask for the documents again' : 'Request documents') : kind === 'fix' ? 'Ask the candidate to send documents again' : 'Tell the candidate their documents are verified';

  const send = () => {
    if (!candidate.email) return setError('This candidate has no email address.');
    if (!subject.trim() || !body.trim()) return setError('The email needs a subject and a message.');
    if (unresolved.length) return setError(`These fields have no value: ${unresolved.map((k) => `{{${k}}}`).join(', ')}.`);
    if (kind === 'request') {
      if (!due) return setError('Choose the date by which the documents should be sent.');
      requestDocs({ applicationId: application.id, candidateId: candidate.id, name: candidate.name, email: candidate.email, location, jobTitle: job?.title ?? 'the role', company: companyOf(application), dueDate: due, token }, actor.name);
    } else if (req) markDocsMailed(req.id, kind === 'fix' ? 'fix' : 'verified');
    sendMail({ candidateId: candidate.id, applicationId: application.id, templateName: prepared?.template.name, to: candidate.email, subject: subject.trim(), body, by: actor.name, trigger: kind === 'request' ? 'Documents request' : kind === 'fix' ? 'Documents: send again' : 'Documents verified' });
    onSent(`${kind === 'request' ? 'Documents request' : kind === 'fix' ? 'Request to send again' : 'Documents verified email'} sent to ${candidate.email}. Email is logged in the sandbox; nothing is delivered until a mail server is connected.`);
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      description={`${candidate.name} · ${job?.title ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={send}>
            Send email
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Fg label="To" full>
          <input value={candidate.email} readOnly style={{ background: 'var(--bg)' }} />
        </Fg>
        {kind === 'request' && (
          <Fg label="Documents to be sent by" required full hint="The candidate sees this date on their page and in the email.">
            <DateField value={due} min={todayISO()} onChange={(e) => setDue(e.target.value)} />
          </Fg>
        )}
        <Fg label="Subject" required full>
          <input value={subject} onChange={(e) => setSubjectEdit(e.target.value)} />
        </Fg>
        <Fg label="Message" required full hint="Edit it for this candidate if you want. To change it for everyone, edit the template under Operations → Email templates.">
          <textarea rows={14} value={body} onChange={(e) => setBodyEdit(e.target.value)} style={TEXTAREA_STYLE} />
        </Fg>
      </div>
      {error && (
        <div className="tx-err" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </Drawer>
  );
}

function WaiveDrawer({ application, candidate, onClose, onDone }: { application: Application; candidate: Candidate; onClose: () => void; onDone: (text: string) => void }) {
  const actor = useActor();
  const s = useHiring();
  const job = jobById(s, application.jobId);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    const r = waiveDocs(
      application.id,
      { applicationId: application.id, candidateId: candidate.id, name: candidate.name, email: candidate.email, location: job?.location ?? candidate.location, jobTitle: job?.title ?? 'the role', company: companyOf(application), dueDate: todayISO() },
      reason,
      actor.name,
    );
    if (!r.ok) return setError(r.error);
    onDone(`Document check skipped for ${candidate.name}. The offer letter can now be created.`);
    onClose();
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title="Skip the document check"
      description={`${candidate.name} · ${job?.title ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Skip the check
          </Button>
        </>
      }
    >
      <div className="note-box warn" style={{ marginBottom: 14 }}>
        <div>The offer letter can be created without collecting or verifying documents. Use this only when the papers are already on file, for example an internal move. The reason is recorded in the audit log.</div>
      </div>
      <Fg label="Reason" required full>
        <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} style={TEXTAREA_STYLE} placeholder="For example: internal transfer, documents already on file" />
      </Fg>
      {error && (
        <div className="tx-err" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </Drawer>
  );
}

/** HR's side: ask for the documents, then check each one. When all are verified the candidate is told and the offer
    letter can be created. */
export function DocsPanel({ application, candidate, canAct, notify }: { application: Application; candidate: Candidate; canAct: boolean; notify: Notify }) {
  const actor = useActor();
  const s = useHiring();
  const list = useDocRequests();
  const req = docRequestFor(list, application.id);
  const job = jobById(s, application.jobId);
  const [mail, setMail] = useState<MailKind | null>(null);
  const [waiving, setWaiving] = useState(false);
  const [back, setBack] = useState<{ key: string; note: string } | null>(null);
  const [error, setError] = useState('');

  const label = docsLabel(req);
  const required = req?.items.filter((i) => i.required) ?? [];
  const needsFixMail = !!req && req.status === 'Needs changes' && !req.fixMailAt;

  const afterVerify = (r: { ok: true } | { ok: false; error: string }, justVerified?: boolean) => {
    if (!r.ok) return setError(r.error);
    setError('');
    // When that was the last item, offer the "documents verified" email straight away.
    if (justVerified && getDocRequests().find((x) => x.applicationId === application.id)?.status === 'Verified') setMail('verified');
  };

  const sendBack = () => {
    if (!req || !back) return;
    const r = back.key === '__ref' ? rejectReferral(req.id, back.note, actor.name) : rejectItem(req.id, back.key, back.note, actor.name);
    if (!r.ok) return setError(r.error);
    setBack(null);
    setError('');
  };

  const row = (it: DocItem) => {
    const open = back?.key === it.key;
    return (
      <div key={it.key} className={`dc-hr ${it.status.toLowerCase()}`}>
        <div className="dc-hr-main">
          <div className="dc-hr-t">
            <b>{it.label}</b>
            {!it.required && <span className="dc-opt-tag">Optional</span>}
            <em className={`dc-st ${it.status.toLowerCase()}`}>{it.status === 'Pending' ? 'Not sent' : it.status}</em>
          </div>
          {it.files.length ? (
            <ul className="dc-hr-files">
              {it.files.map((f, n) => (
                <li key={`${f.name}-${n}`}>
                  {f.name} <small>{kb(f.size)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dc-hr-none">{it.hint}</div>
          )}
          {it.status === 'Rejected' && it.note && <div className="dc-hr-note">Sent back: {it.note}</div>}
          {it.status === 'Verified' && it.verifiedBy && <div className="dc-hr-by">Verified by {it.verifiedBy}</div>}
        </div>
        {canAct && req && !['Declined', 'Waived'].includes(req.status) && (
          <div className="dc-hr-act">
            {it.status !== 'Verified' && (
              <Button size="sm" variant="success" disabled={!it.files.length} onClick={() => afterVerify(verifyItem(req.id, it.key, actor.name), true)}>
                Verify
              </Button>
            )}
            {it.files.length > 0 && it.status !== 'Rejected' && (
              <Button size="sm" variant="ghost" onClick={() => setBack({ key: it.key, note: '' })}>
                Send back
              </Button>
            )}
          </div>
        )}
        {open && back && (
          <div className="dc-hr-back">
            <input autoFocus value={back.note} onChange={(e) => setBack({ key: it.key, note: e.target.value })} placeholder="What is wrong? For example: the copy is blurred" aria-label="What is wrong with this document" />
            <Button size="sm" variant="primary" onClick={sendBack}>
              Send back
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBack(null)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader title="Pre-offer documents" sub={`${job?.title ?? ''} · collect and verify before the offer letter`} action={<span className={`dc-chip tone-${label.tone}`}>{label.text}</span>} />
      <div className="dc-panel">
        {!req && (
          <>
            <p className="dc-lead">
              Before the offer letter is created, ask {candidate.name.split(/\s+/)[0]} to confirm they want to proceed and to send their documents with a background-verification referral. You verify each one here, then the candidate is told and the offer letter can be created.
            </p>
            {canAct && (
              <div className="dc-btns">
                <Button variant="primary" onClick={() => setMail('request')}>
                  Request documents
                </Button>
                <Button variant="ghost" onClick={() => setWaiving(true)}>
                  Skip the check…
                </Button>
              </div>
            )}
          </>
        )}

        {req && (
          <>
            <div className="dc-meta">
              <span>
                Requested {fmtDate(req.sentAt.slice(0, 10))} by {req.sentBy} · to {req.email} · send by {fmtDate(req.dueDate)}
              </span>
              <span className="dc-meta-act">
                {canAct && req.status !== 'Waived' && req.status !== 'Declined' && (
                  <>
                    <button
                      type="button"
                      className="lnk"
                      onClick={() => {
                        void navigator.clipboard?.writeText(docsLink(req.token));
                        notify('Documents link copied.');
                      }}
                    >
                      Copy link
                    </button>
                    <button type="button" className="lnk" onClick={() => setMail('request')}>
                      Ask again
                    </button>
                  </>
                )}
              </span>
            </div>

            {req.status === 'Declined' && (
              <div className="note-box warn">
                <div>
                  <b>{candidate.name} does not want to proceed.</b>
                  {req.declineReason ? ` “${req.declineReason}”` : ''} You can close the application from the pipeline, or reopen the request if they change their mind.
                  {canAct && (
                    <div style={{ marginTop: 8 }}>
                      <Button size="sm" variant="ghost" onClick={() => reopenDocs(req.id, actor.name)}>
                        Reopen the request
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {req.status === 'Waived' && req.waived && (
              <div className="note-box">
                <div>
                  <b>Document check skipped</b> by {req.waived.by}: {req.waived.reason}. The offer letter can be created.
                  {canAct && (
                    <div style={{ marginTop: 8 }}>
                      <Button size="sm" variant="ghost" onClick={() => reopenDocs(req.id, actor.name)}>
                        Collect the documents instead
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {req.status !== 'Declined' && req.status !== 'Waived' && (
              <>
                <div className="dc-willing">
                  <b>Willing to proceed:</b> {req.willing === 'yes' ? `Yes, confirmed ${req.willingAt ? fmtDate(req.willingAt.slice(0, 10)) : ''}` : 'Not confirmed yet'}
                </div>
                <div className="dc-rows">
                  {req.items.map(row)}
                  <div className={`dc-hr ${req.bgvStatus.toLowerCase()}`}>
                    <div className="dc-hr-main">
                      <div className="dc-hr-t">
                        <b>Background verification referral</b>
                        <em className={`dc-st ${req.bgvStatus.toLowerCase()}`}>{req.bgvStatus === 'Pending' ? 'Not sent' : req.bgvStatus}</em>
                      </div>
                      {referralComplete(req.bgv) ? (
                        <div className="dc-hr-ref">
                          {req.bgv.name} · {req.bgv.designation} · <a href={`tel:${req.bgv.phone}`}>{req.bgv.phone}</a>
                        </div>
                      ) : (
                        <div className="dc-hr-none">Contact person name, designation and number.</div>
                      )}
                      {req.bgvStatus === 'Rejected' && req.bgvNote && <div className="dc-hr-note">Sent back: {req.bgvNote}</div>}
                    </div>
                    {canAct && (
                      <div className="dc-hr-act">
                        {req.bgvStatus !== 'Verified' && (
                          <Button size="sm" variant="success" disabled={!referralComplete(req.bgv)} onClick={() => afterVerify(verifyReferral(req.id, actor.name), true)}>
                            Verify
                          </Button>
                        )}
                        {referralComplete(req.bgv) && req.bgvStatus !== 'Rejected' && (
                          <Button size="sm" variant="ghost" onClick={() => setBack({ key: '__ref', note: '' })}>
                            Send back
                          </Button>
                        )}
                      </div>
                    )}
                    {back?.key === '__ref' && (
                      <div className="dc-hr-back">
                        <input autoFocus value={back.note} onChange={(e) => setBack({ key: '__ref', note: e.target.value })} placeholder="What should they correct?" aria-label="What should be corrected" />
                        <Button size="sm" variant="primary" onClick={sendBack}>
                          Send back
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setBack(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="dc-foot">
                  <span>
                    <b>{verifiedCount(req)}</b> of {required.length} required documents verified{req.bgvStatus === 'Verified' ? ' · referral verified' : ''}
                  </span>
                  {canAct && req.status !== 'Verified' && (
                    <button type="button" className="lnk" onClick={() => setWaiving(true)}>
                      Skip the check…
                    </button>
                  )}
                </div>
              </>
            )}

            {needsFixMail && canAct && (
              <div className="note-box warn">
                <div>
                  You sent something back. Let the candidate know what to send again.
                  <div style={{ marginTop: 8 }}>
                    <Button size="sm" variant="primary" onClick={() => setMail('fix')}>
                      Email what to send again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {req.status === 'Verified' && (
              <div className="note-box" style={{ background: '#effaf3', borderColor: '#bfe8cf' }}>
                <div>
                  <b>All documents are verified.</b> {req.verifiedMailAt ? `The candidate was told on ${fmtDate(req.verifiedMailAt.slice(0, 10))}.` : 'Tell the candidate, then create the offer letter.'}
                  {canAct && !req.verifiedMailAt && (
                    <div style={{ marginTop: 8 }}>
                      <Button size="sm" variant="primary" onClick={() => setMail('verified')}>
                        Email: documents verified
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <div className="tx-err" role="alert" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
      </div>

      {mail && <MailDrawer kind={mail} application={application} candidate={candidate} req={req} onClose={() => setMail(null)} onSent={notify} />}
      {waiving && <WaiveDrawer application={application} candidate={candidate} onClose={() => setWaiving(false)} onDone={notify} />}
    </Card>
  );
}
