'use client';

import { DateField } from '@/components/ui/DateField';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { TEXTAREA_STYLE, useActor } from '@/components/hiring/HiringBits';
import { COMPANIES, EMPLOYEES } from '@/lib/data';
import { companyOfOffer } from '@/lib/hiringLetters';
import { addDays, todayISO } from '@/lib/dates';
import { mergeValues, renderText, sendMail, useHiringMail } from '@/lib/hiringMail';
import { useHiring } from '@/lib/hiringStore';
import { ENTITY_NAME } from '@/lib/org';
import { EMAIL_RE } from '@/lib/options';
import { docRequestFor, receivedForJoining, useDocRequests } from '@/lib/hiringDocs';
import { OnboardingInvite, formLink, inviteForOffer, newToken, sendInvite, useInvites } from '@/lib/onboardingForms';
import { Candidate, Job, Offer } from '@/lib/hiringTypes';

const fmt = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The proposed company mailbox: first name at the company domain, made unique against existing people. */
export function suggestedWorkEmail(name: string): string {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  const taken = new Set(EMPLOYEES.map((e) => e.email.toLowerCase()));
  if (!first) return '';
  let mail = `${first}@gs-it.ae`;
  const last = name.trim().split(/\s+/).slice(1).join('').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (taken.has(mail) && last) mail = `${first}.${last}@gs-it.ae`;
  return mail;
}

/** What HR sees for an accepted offer's joining form, and what they can do about it. */
export function JoiningFormActions({ offer, candidate, job, onNotice }: { offer: Offer; candidate?: Candidate; job?: Job; onNotice: (text: string) => void }) {
  const invites = useInvites();
  const invite = inviteForOffer(invites, offer.id);
  const [open, setOpen] = useState(false);

  return (
    <>
      <FormChip invite={invite} />
      {invite?.status !== 'Submitted' && (
        <Button size="sm" variant={invite ? 'ghost' : 'primary'} onClick={() => setOpen(true)} title="Email the new joiner a link to fill in their own details">
          {invite ? 'Resend joining form' : 'Send joining form'}
        </Button>
      )}
      {invite && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(formLink(invite.token));
            onNotice('Joining form link copied.');
          }}
        >
          Copy form link
        </Button>
      )}
      {open && candidate && <SendDialog offer={offer} candidate={candidate} job={job} invite={invite} onClose={() => setOpen(false)} onSent={onNotice} />}
    </>
  );
}

export function FormChip({ invite }: { invite?: OnboardingInvite }) {
  if (!invite) return <span className="hm-chip">Joining form not sent</span>;
  if (invite.status === 'Submitted') return <span className="hm-chip on">Form submitted · review it</span>;
  if (invite.status === 'Opened') return <span className="hm-chip" style={{ background: '#fdf3df', color: '#B45309' }}>Form opened{invite.data ? ' · in progress' : ''}</span>;
  if (invite.emailed === false) return <span className="hm-chip" style={{ background: '#eef1f6', color: '#4b5563' }}>Link created · not emailed</span>;
  return <span className="hm-chip" style={{ background: '#e7f0fc', color: '#2f6fd6' }}>Form sent · not opened</span>;
}

/** What the joiner should have ready, by work location, for the {{onboarding.documents}} field. */
const readyList = (location: string) =>
  (location === 'Kochi'
    ? ['Passport (if you have one), PAN and Aadhaar', 'A passport size photo', 'Bank account details (account number and IFSC)', 'Education and experience certificates', 'Two emergency contacts']
    : ['Passport (and your visa or Emirates ID if you have them)', 'A passport size photo', 'Bank account details (an IBAN if possible)', 'Education and experience certificates', 'Two emergency contacts'])
    .map((x) => `- ${x}`)
    .join('\n');

/** A line for the email naming the papers HR already verified before the offer, so the joiner does not send them again. */
const alreadyHeld = (names: string[]) => (names.length ? `

You have already shared and we have verified: ${names.join(', ')}. You do not need to send those again.` : '');

function SendDialog({ offer, candidate, job, invite, onClose, onSent }: { offer: Offer; candidate: Candidate; job?: Job; invite?: OnboardingInvite; onClose: () => void; onSent: (text: string) => void }) {
  const actor = useActor();
  const s = useHiring();
  const mail = useHiringMail();
  const docReqs = useDocRequests();
  const [work, setWork] = useState(invite?.toWork ?? suggestedWorkEmail(candidate.name));
  const [personal, setPersonal] = useState(invite?.toPersonal ?? candidate.email);
  const [due, setDue] = useState(() => {
    if (invite?.dueDate) return invite.dueDate;
    const d = addDays(offer.joiningDate, -3);
    return d < todayISO() ? addDays(todayISO(), 3) : d;
  });
  // The link is fixed now so the preview shows the real one.
  const [token] = useState(() => invite?.token ?? newToken());
  const [subjectEdit, setSubjectEdit] = useState<string | null>(null);
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  const [error, setError] = useState('');

  const tpl = mail.templates.find((t) => t.id === 'tpl-joining');
  const values = mergeValues(s, {
    candidateId: candidate.id,
    applicationId: offer.applicationId,
    offer,
    recruiter: actor.name,
    extra: { 'onboarding.link': formLink(token), 'onboarding.dueDate': fmt(due), 'onboarding.documents': readyList(offer.location) + alreadyHeld(Object.keys(receivedForJoining(docRequestFor(docReqs, offer.applicationId)))) },
  });
  const subjectGen = renderText(tpl?.subject ?? '', values);
  const bodyGen = renderText(tpl?.body ?? '', values);
  const subject = subjectEdit ?? subjectGen.text;
  const body = bodyEdit ?? bodyGen.text;
  const unresolved = [...new Set([...renderText(subject, {}).missing, ...renderText(body, {}).missing])];
  const edited = subjectEdit !== null || bodyEdit !== null;

  /** Skip the email: make the link and copy it, so HR can share it another way (WhatsApp, a call, in person). */
  const linkOnly = () => {
    if (!EMAIL_RE.test(work.trim())) return setError('Enter the company email address the joiner will use.');
    if (personal.trim() && !EMAIL_RE.test(personal.trim())) return setError('The personal email address does not look right.');
    const inv = sendInvite({ offerId: offer.id, candidateId: candidate.id, name: candidate.name, location: offer.location, company: COMPANIES.find((c) => c.id === companyOfOffer(s, offer))?.name, toWork: work.trim().toLowerCase(), toPersonal: personal.trim().toLowerCase(), joiningDate: offer.joiningDate, dueDate: due, token, emailed: false }, actor.name);
    void navigator.clipboard?.writeText(formLink(inv.token));
    onSent('Joining form link created and copied. No email was sent: share the link with the joiner yourself. It works like the emailed link.');
    onClose();
  };

  const send = () => {
    if (!EMAIL_RE.test(work.trim())) return setError('Enter the company email address the joiner will use.');
    if (personal.trim() && !EMAIL_RE.test(personal.trim())) return setError('The personal email address does not look right.');
    if (!subject.trim() || !body.trim()) return setError('The email needs a subject and a message.');
    if (unresolved.length) return setError(`These fields have no value: ${unresolved.map((k) => `{{${k}}}`).join(', ')}. Remove them or fix them in the email.`);
    const inv = sendInvite({ offerId: offer.id, candidateId: candidate.id, name: candidate.name, location: offer.location, company: COMPANIES.find((c) => c.id === companyOfOffer(s, offer))?.name, toWork: work.trim().toLowerCase(), toPersonal: personal.trim().toLowerCase(), joiningDate: offer.joiningDate, dueDate: due, token, emailed: true }, actor.name);
    sendMail({ candidateId: candidate.id, applicationId: offer.applicationId, templateName: 'Joining form', to: inv.toWork, cc: inv.toPersonal, subject: subject.trim(), body, by: actor.name, trigger: 'Joining form' });
    onSent(`Joining form ${invite ? 'sent again' : 'sent'} to ${inv.toWork}${inv.toPersonal ? ` (copy to ${inv.toPersonal})` : ''}. Email is logged in the sandbox; nothing is delivered until a mail server is connected.`);
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Send joining form"
      description={`${candidate.name} · ${job?.title ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={linkOnly} title="Do not email anything. Create the link and copy it, so you can share it another way">
            Skip email: just copy the link
          </Button>
          <Button variant="primary" onClick={send}>
            {invite ? 'Send again' : 'Send form'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="tx-err" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div className="form-grid hm-form">
        <div className="fg full">
          <label>Company email *</label>
          <input type="email" value={work} onChange={(e) => setWork(e.target.value)} autoComplete="off" />
          <span className="hint">The mailbox they will use at work. Check it matches the account IT creates for them.</span>
        </div>
        <div className="fg full">
          <label>Copy to personal email</label>
          <input type="email" value={personal} onChange={(e) => setPersonal(e.target.value)} autoComplete="off" />
          <span className="hint">They may not be able to open the company mailbox before day one, so the same email goes here too.</span>
        </div>
        <div className="fg full">
          <label>Complete by</label>
          <DateField value={due} min={todayISO()} max={offer.joiningDate} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>

      <div className="jf-mail">
        <div className="jf-mail-head">
          <b>The email they will get</b>
          <span className="faint">
            Edit it for this person, or change the wording for everyone under{' '}
            <Link href="/hiring/operations/templates" className="hm-link">
              Operations → Email templates
            </Link>{' '}
            (“Joining form”).
          </span>
        </div>
        <div className="jf-mail-meta">
          <div>
            <span>To</span> {work || '—'}
          </div>
          {personal && (
            <div>
              <span>Cc</span> {personal}
            </div>
          )}
        </div>
        <div className="fg full">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubjectEdit(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Message</label>
          <textarea rows={16} value={body} onChange={(e) => setBodyEdit(e.target.value)} style={TEXTAREA_STYLE} />
        </div>
        {edited && (
          <button
            type="button"
            className="lnk"
            onClick={() => {
              setSubjectEdit(null);
              setBodyEdit(null);
            }}
          >
            Reset to the template
          </button>
        )}
        {!tpl && <div className="tx-err">The “Joining form” template is missing. Add it under Operations → Email templates.</div>}
      </div>

      <div className="note-box" style={{ marginTop: 14 }}>
        <div>They get a private link to fill in personal details, identity, bank, emergency contacts, education, work experience and documents. When they submit, you review it and start onboarding with everything filled in. Document files are recorded by name only until file storage is connected.</div>
      </div>
    </Drawer>
  );
}

/* ---------------------------------------------------------------------- onboarding started by hand */

/** The joining form for someone onboarded without an accepted offer. Once HR has typed the name and personal email
    they can email the joiner the private link, or just copy it. The form is kept under `inviteKey`. */
export function ManualShareCard({ inviteKey, name, personalEmail, location, jobTitle, joiningDate }: { inviteKey: string; name: string; personalEmail: string; location: string; jobTitle: string; joiningDate: string }) {
  const invites = useInvites();
  const [note, setNote] = useState('');
  const invite = inviteForOffer(invites, inviteKey);
  const [open, setOpen] = useState(false);
  const actor = useActor();
  if (invite?.status === 'Submitted') return null;
  const ready = name.trim().length > 1 && EMAIL_RE.test(personalEmail.trim());

  const copyOnly = () => {
    const due = joiningDate && joiningDate > todayISO() ? addDays(joiningDate, -3) > todayISO() ? addDays(joiningDate, -3) : addDays(todayISO(), 3) : addDays(todayISO(), 7);
    const inv = sendInvite({ offerId: inviteKey, candidateId: inviteKey, name: name.trim(), location, toWork: '', toPersonal: personalEmail.trim().toLowerCase(), joiningDate, dueDate: invite?.dueDate ?? due, token: invite?.token, emailed: invite?.emailed ?? false }, actor.name);
    void navigator.clipboard?.writeText(formLink(inv.token));
    setNote('Joining form link copied. Share it with the joiner yourself. It works like the emailed link.');
  };

  return (
    <div className="note-box" style={{ marginBottom: 14, alignItems: 'flex-start' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
      </svg>
      <div style={{ flex: 1 }}>
        <b>{invite ? 'Joining form shared' : 'Let the joiner fill in their own details'}</b>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
          {ready
            ? invite
              ? 'The joiner has their private link. When they submit it, use Fill from their form here to bring their details in.'
              : 'Send a private form to the personal email you entered, or copy the link and share it yourself. Their answers can then fill this wizard.'
            : 'Enter the joiner’s name and personal email to share a private joining form with them.'}
        </div>
        <div className="jf-acts">
          {invite && <FormChip invite={invite} />}
          <Button size="sm" variant={invite ? 'ghost' : 'primary'} disabled={!ready} onClick={() => setOpen(true)}>
            {invite ? 'Email the link again' : 'Email the link'}
          </Button>
          <Button size="sm" variant="ghost" disabled={!ready} onClick={copyOnly}>
            Copy link
          </Button>
        </div>
        {note && (
          <div role="status" style={{ marginTop: 8, fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>
            {note}
          </div>
        )}
      </div>
      {open && <ManualShareDrawer inviteKey={inviteKey} invite={invite} name={name.trim()} personalEmail={personalEmail.trim().toLowerCase()} location={location} jobTitle={jobTitle} joiningDate={joiningDate} onClose={() => setOpen(false)} onSent={setNote} />}
    </div>
  );
}

function ManualShareDrawer({ inviteKey, invite, name, personalEmail, location, jobTitle, joiningDate, onClose, onSent }: { inviteKey: string; invite?: OnboardingInvite; name: string; personalEmail: string; location: string; jobTitle: string; joiningDate: string; onClose: () => void; onSent: (text: string) => void }) {
  const actor = useActor();
  const mail = useHiringMail();
  const [due, setDue] = useState(() => invite?.dueDate ?? (joiningDate && addDays(joiningDate, -3) > todayISO() ? addDays(joiningDate, -3) : addDays(todayISO(), 7)));
  const [token] = useState(() => invite?.token ?? newToken());
  const [subjectEdit, setSubjectEdit] = useState<string | null>(null);
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  const [error, setError] = useState('');
  const tpl = mail.templates.find((t) => t.id === 'tpl-joining');
  const values: Record<string, string> = {
    'candidate.firstName': name.split(/\s+/)[0],
    'company.name': ENTITY_NAME,
    'job.title': jobTitle || 'a member of our team',
    'offer.joiningDate': joiningDate ? fmt(joiningDate) : 'the date we confirm with you',
    'recruiter.name': actor.name,
    'onboarding.link': formLink(token),
    'onboarding.dueDate': fmt(due),
    'onboarding.documents': readyList(location),
  };
  const subject = subjectEdit ?? renderText(tpl?.subject ?? '', values).text;
  const body = bodyEdit ?? renderText(tpl?.body ?? '', values).text;
  const unresolved = [...new Set([...renderText(subject, {}).missing, ...renderText(body, {}).missing])];

  const send = () => {
    if (!subject.trim() || !body.trim()) return setError('The email needs a subject and a message.');
    if (unresolved.length) return setError(`These fields have no value: ${unresolved.map((k) => `{{${k}}}`).join(', ')}.`);
    const inv = sendInvite({ offerId: inviteKey, candidateId: inviteKey, name, location, toWork: '', toPersonal: personalEmail, joiningDate, dueDate: due, token, emailed: true }, actor.name);
    sendMail({ candidateId: inviteKey, templateName: 'Joining form', to: personalEmail, subject: subject.trim(), body, by: actor.name, trigger: 'Joining form' });
    onSent(`Joining form sent to ${inv.toPersonal}. Email is logged in the sandbox; nothing is delivered until a mail server is connected.`);
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Email the joining form"
      description={name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={send}>
            {invite ? 'Send again' : 'Send form'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="tx-err" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div className="form-grid hm-form">
        <div className="fg full">
          <label>To</label>
          <input value={personalEmail} readOnly style={{ background: 'var(--bg)' }} />
          <span className="hint">The personal email entered in the wizard. Change it there first if it is wrong.</span>
        </div>
        <div className="fg full">
          <label>Complete by</label>
          <DateField value={due} min={todayISO()} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Subject *</label>
          <input value={subject} onChange={(e) => setSubjectEdit(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Message *</label>
          <textarea rows={14} value={body} onChange={(e) => setBodyEdit(e.target.value)} style={TEXTAREA_STYLE} />
          <span className="hint">
            To change the wording for everyone, edit the “Joining form” template under{' '}
            <Link href="/hiring/operations/templates" className="hm-link">
              Operations → Email templates
            </Link>
            .
          </span>
        </div>
      </div>
    </Drawer>
  );
}
