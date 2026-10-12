'use client';

import { useEffect, useRef, useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Card';
import { Fg, TEXTAREA_STYLE, fmtDateTime, useActor } from '@/components/hiring/HiringBits';
import { appById, candById, getHiring } from '@/lib/hiringStore';
import { Candidate, Application, Interview, Offer } from '@/lib/hiringTypes';
import { MailContext, MailMessage, RuleKey, messagesFor, prepareMail, renderText, sendMail, useHiringMail } from '@/lib/hiringMail';

/* The email pieces used on the pipeline, candidate profile, interviews and offers. Everything is logged in sandbox
   mode: the dialogs say so, so nobody believes a message was delivered. */

const unresolved = (text: string) => [...new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];

interface Outcome {
  ok: boolean;
  error?: string;
  /** Applications that actually moved (defaults to all of them). */
  moved?: string[];
}

interface Pending {
  appIds: string[];
  key: RuleKey;
  /** Does the pipeline change. Absent when the change already happened (interview scheduled, offer sent). */
  perform?: () => Outcome;
  interview?: Interview;
  offer?: Offer;
  title: string | ((r: Outcome) => string);
}

export type Notify = (text: string, tone?: 'info' | 'warn') => void;

/** Runs a pipeline change and sends the email the stage rules ask for: straight away, after a Send / Edit / Skip
    choice, or not at all. `request` is for a change the user is about to make; `after` is for one already made. */
export function useStageMail(notify: Notify) {
  const actor = useActor();
  const mail = useHiringMail();
  const [pending, setPending] = useState<Pending | null>(null);

  const ctxFor = (appId: string, p?: Pick<Pending, 'interview' | 'offer'>): MailContext | null => {
    const a = appById(getHiring(), appId);
    return a ? { candidateId: a.candidateId, applicationId: a.id, interview: p?.interview, offer: p?.offer, recruiter: actor.name } : null;
  };

  const deliver = (appIds: string[], key: RuleKey, extra?: Pick<Pending, 'interview' | 'offer'>, edited?: { subject: string; body: string }): number => {
    const rule = mail.rules.find((r) => r.key === key);
    if (!rule?.templateId) return 0;
    let n = 0;
    appIds.forEach((id) => {
      const ctx = ctxFor(id, extra);
      const prepared = ctx && prepareMail(rule.templateId, ctx);
      if (!ctx || !prepared) return;
      sendMail({ candidateId: ctx.candidateId, applicationId: id, templateName: prepared.template.name, to: prepared.to, subject: edited?.subject ?? prepared.subject, body: edited?.body ?? prepared.body, by: actor.name, trigger: key });
      n++;
    });
    return n;
  };

  const finish = (p: Pending, send: boolean, edited?: { subject: string; body: string }) => {
    let moved = p.appIds;
    let note = '';
    let result: Outcome = { ok: true };
    if (p.perform) {
      result = p.perform();
      if (!result.ok) {
        setPending(null);
        return notify(result.error ?? 'That change could not be made.', 'warn');
      }
      moved = result.moved ?? p.appIds;
    }
    const n = send ? deliver(moved, p.key, p, edited) : 0;
    note = n ? ` ${n} email${n === 1 ? '' : 's'} logged (sandbox, nothing was delivered).` : send ? '' : ' No email was sent.';
    setPending(null);
    notify(`${typeof p.title === 'function' ? p.title(result) : p.title}${note}`, result.error ? 'warn' : 'info');
  };

  const run = (p: Pending) => {
    const rule = mail.rules.find((r) => r.key === p.key);
    if (!rule || rule.mode === 'off' || !rule.templateId) return finish(p, false, undefined);
    if (rule.mode === 'auto') {
      // Straight away, but never with blanks in it.
      const ctx = ctxFor(p.appIds[0], p);
      const prepared = ctx && prepareMail(rule.templateId, ctx);
      return finish(p, !!prepared && prepared.missing.length === 0);
    }
    setPending(p);
  };

  return {
    /** A change the user is about to make; `title` is what to tell them once it is done. */
    request: (appIds: string[], key: RuleKey, perform: () => Outcome, title: Pending['title']) => run({ appIds, key, perform, title }),
    /** An event that already happened (interview scheduled, offer sent): offer the email for it. */
    after: (appId: string, key: RuleKey, extra: Pick<Pending, 'interview' | 'offer'>, title: Pending['title']) => run({ appIds: [appId], key, title, ...extra }),
    dialog: <StageMailDialog pending={pending} onCancel={() => setPending(null)} onFinish={finish} ctxFor={ctxFor} />,
  };
}

function StageMailDialog({ pending, onCancel, onFinish, ctxFor }: { pending: Pending | null; onCancel: () => void; onFinish: (p: Pending, send: boolean, edited?: { subject: string; body: string }) => void; ctxFor: (appId: string, p?: Pick<Pending, 'interview' | 'offer'>) => MailContext | null }) {
  const mail = useHiringMail();
  const [edit, setEdit] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const first = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  });

  const rule = pending && mail.rules.find((r) => r.key === pending.key);
  const ctx = pending ? ctxFor(pending.appIds[0], pending) : null;
  const prepared = rule && ctx ? prepareMail(rule.templateId, ctx) : null;
  const preparedKey = pending ? `${pending.key}|${pending.appIds.join(',')}` : '';

  useEffect(() => {
    if (!prepared) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdit(false);
    setSubject(prepared.subject);
    setBody(prepared.body);
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparedKey]);

  if (!pending || !prepared) return null;
  const many = pending.appIds.length > 1;
  const cand = ctx && candById(getHiring(), ctx.candidateId);
  const missing = unresolved(`${edit ? subject : prepared.subject}\n${edit ? body : prepared.body}`);
  const edited = edit ? { subject, body } : undefined;

  return (
    <div className="fm-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="fm-dialog hm-mail-dialog" role="dialog" aria-modal="true" aria-label="Send email">
        <h3>{pending.perform ? 'Email the candidate?' : 'Send the email for this?'}</h3>
        <p>
          {many ? `${pending.appIds.length} candidates will each get “${prepared.template.name}”.` : `“${prepared.template.name}” goes to ${cand?.name} (${prepared.to}).`} It is only logged for now: no mail server is connected, so nothing is delivered.
        </p>
        {many && <p className="hint">Preview for the first candidate:</p>}
        <div className="hm-mail-prev">
          <div className="hm-mail-row">
            <span>To</span>
            {many ? 'Each candidate individually' : prepared.to}
          </div>
          <div className="hm-mail-row">
            <span>Subject</span>
            {edit && !many ? <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" /> : prepared.subject}
          </div>
          {edit && !many ? <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} style={TEXTAREA_STYLE} aria-label="Message" /> : <pre>{prepared.body}</pre>}
          {prepared.attachments.length > 0 && <div className="hm-mail-att">Attachments: {prepared.attachments.join(', ')}</div>}
        </div>
        {missing.length > 0 && (
          <div className="note-box hm-warn" style={{ marginTop: 10 }}>
            <div>
              Missing details: {missing.map((m) => `{{${m}}}`).join(', ')}. {pending.key.includes('Interview') ? 'Schedule the interview first, or edit the message.' : 'Edit the message or skip the email.'}
            </div>
          </div>
        )}
        <div className="fm-dialog-act hm-mail-act">
          <button type="button" className="btn ghost" onClick={onCancel}>
            {pending.perform ? 'Cancel change' : 'Close'}
          </button>
          {!many && (
            <button type="button" className="btn ghost" onClick={() => setEdit((v) => !v)}>
              {edit ? 'Back to preview' : 'Edit before sending'}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => onFinish(pending, false)}>
            Skip email
          </button>
          <button ref={first} type="button" className="btn primary" disabled={missing.length > 0} onClick={() => onFinish(pending, true, edited)}>
            Send email
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- compose from the profile */

export function ComposeDrawer({ candidate, application, open, onClose, onSent }: { candidate: Candidate; application?: Application; open: boolean; onClose: () => void; onSent: (m: MailMessage) => void }) {
  return open ? <ComposeForm key={candidate.id + (application?.id ?? '')} candidate={candidate} application={application} onClose={onClose} onSent={onSent} /> : null;
}

function ComposeForm({ candidate, application, onClose, onSent }: { candidate: Candidate; application?: Application; onClose: () => void; onSent: (m: MailMessage) => void }) {
  const mail = useHiringMail();
  const actor = useActor();
  const apps = application ? [application] : getHiring().applications.filter((a) => a.candidateId === candidate.id);
  const [appId, setAppId] = useState(application?.id ?? apps[0]?.id ?? '');
  const [tplId, setTplId] = useState('');
  const [v, setV] = useState({ cc: '', bcc: '', subject: '', body: '' });
  const [attempted, setAttempted] = useState(false);
  const templates = mail.templates.filter((t) => t.location === 'Both' || t.location === candidate.location);

  const apply = (id: string, forApp = appId) => {
    setTplId(id);
    if (!id) return;
    const p = prepareMail(id, { candidateId: candidate.id, applicationId: forApp || undefined, recruiter: actor.name });
    if (p) setV((x) => ({ ...x, subject: p.subject, body: p.body }));
  };

  const missing = unresolved(`${v.subject}\n${v.body}`);
  const errors: Record<string, string> = {};
  if (!v.subject.trim()) errors.subject = 'Add a subject.';
  if (!v.body.trim()) errors.body = 'Write the message.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);
  const tpl = mail.templates.find((t) => t.id === tplId);

  const send = () => {
    setAttempted(true);
    if (Object.keys(errors).length || missing.length) return;
    onSent(sendMail({ candidateId: candidate.id, applicationId: appId || undefined, templateName: tpl?.name, to: candidate.email, cc: v.cc.trim(), bcc: v.bcc.trim(), subject: v.subject.trim(), body: v.body, by: actor.name, trigger: 'Manual' }));
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Email ${candidate.name}`}
      description="Sandbox: the message is saved on the candidate's Emails list. Nothing is delivered until a mail server is connected."
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
      <div className="form-grid hm-form">
        <Fg label="To" full>
          <input value={candidate.email} readOnly style={{ background: 'var(--bg)' }} />
        </Fg>
        <Fg label="CC">
          <input value={v.cc} onChange={(e) => setV((x) => ({ ...x, cc: e.target.value }))} />
        </Fg>
        <Fg label="BCC">
          <input value={v.bcc} onChange={(e) => setV((x) => ({ ...x, bcc: e.target.value }))} />
        </Fg>
        {apps.length > 1 && (
          <Fg label="About which job" full>
            <select
              value={appId}
              onChange={(e) => {
                setAppId(e.target.value);
                if (tplId) apply(tplId, e.target.value);
              }}
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {getHiring().jobs.find((j) => j.id === a.jobId)?.title}
                </option>
              ))}
            </select>
          </Fg>
        )}
        <Fg label="Template" hint="Pick one to fill in the subject and message, then edit as you like." full>
          <select value={tplId} onChange={(e) => apply(e.target.value)}>
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Fg>
        <Fg label="Subject" required error={shown('subject')} full>
          <input value={v.subject} onChange={(e) => setV((x) => ({ ...x, subject: e.target.value }))} />
        </Fg>
        <Fg label="Message" required error={shown('body')} full>
          <textarea rows={11} value={v.body} onChange={(e) => setV((x) => ({ ...x, body: e.target.value }))} style={TEXTAREA_STYLE} />
        </Fg>
        {tpl && tpl.attachments.length > 0 && (
          <div className="fg full">
            <span className="hint">Template attachments (added when a mail server is connected): {tpl.attachments.join(', ')}</span>
          </div>
        )}
        {attempted && missing.length > 0 && (
          <div className="fg full">
            <div className="note-box hm-warn">
              <div>Fill in or remove: {missing.map((m) => `{{${m}}}`).join(', ')}</div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

/* ---------------------------------------------------------------------- list of sent messages */

export function MailList({ messages, empty = 'No emails yet.' }: { messages: MailMessage[]; empty?: string }) {
  if (!messages.length) return <div className="hm-col-empty" style={{ padding: '4px 20px 18px' }}>{empty}</div>;
  return (
    <div className="hm-mails">
      {messages.map((m) => (
        <details key={m.id}>
          <summary>
            <span className="hm-mail-sub">{m.subject}</span>
            <span className="hm-mail-meta">
              {m.trigger} · {fmtDateTime(m.at)}
            </span>
            <span className={`hm-mail-st ${m.status === 'Sent' ? 'ok' : 'bad'}`}>{m.status}</span>
          </summary>
          <div className="hm-mail-body">
            <div className="hm-mail-row">
              <span>From</span>
              {m.from}
            </div>
            <div className="hm-mail-row">
              <span>To</span>
              {m.to}
              {m.cc ? ` · cc ${m.cc}` : ''}
            </div>
            <div className="hm-mail-row">
              <span>Via</span>
              {m.provider} · by {m.by}
            </div>
            <pre>{m.body}</pre>
          </div>
        </details>
      ))}
    </div>
  );
}

export const candidateMessages = (mail: ReturnType<typeof useHiringMail>, candidateId: string) => messagesFor(mail, candidateId);
export { renderText };
