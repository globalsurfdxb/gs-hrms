'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { TEXTAREA_STYLE, useActor } from '@/components/hiring/HiringBits';
import { EMPLOYEES } from '@/lib/data';
import { addDays, todayISO } from '@/lib/dates';
import { mergeValues, renderText, sendMail, useHiringMail } from '@/lib/hiringMail';
import { useHiring } from '@/lib/hiringStore';
import { EMAIL_RE } from '@/lib/options';
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
  return <span className="hm-chip" style={{ background: '#e7f0fc', color: '#2f6fd6' }}>Form sent · not opened</span>;
}

/** What the joiner should have ready, by work location, for the {{onboarding.documents}} field. */
const readyList = (location: string) =>
  (location === 'Kochi'
    ? ['Passport (if you have one), PAN and Aadhaar', 'A passport size photo', 'Bank account details (account number and IFSC)', 'Education and experience certificates', 'Two emergency contacts']
    : ['Passport (and your visa or Emirates ID if you have them)', 'A passport size photo', 'Bank account details (an IBAN if possible)', 'Education and experience certificates', 'Two emergency contacts'])
    .map((x) => `- ${x}`)
    .join('\n');

function SendDialog({ offer, candidate, job, invite, onClose, onSent }: { offer: Offer; candidate: Candidate; job?: Job; invite?: OnboardingInvite; onClose: () => void; onSent: (text: string) => void }) {
  const actor = useActor();
  const s = useHiring();
  const mail = useHiringMail();
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
    extra: { 'onboarding.link': formLink(token), 'onboarding.dueDate': fmt(due), 'onboarding.documents': readyList(offer.location) },
  });
  const subjectGen = renderText(tpl?.subject ?? '', values);
  const bodyGen = renderText(tpl?.body ?? '', values);
  const subject = subjectEdit ?? subjectGen.text;
  const body = bodyEdit ?? bodyGen.text;
  const unresolved = [...new Set([...renderText(subject, {}).missing, ...renderText(body, {}).missing])];
  const edited = subjectEdit !== null || bodyEdit !== null;

  const send = () => {
    if (!EMAIL_RE.test(work.trim())) return setError('Enter the company email address the joiner will use.');
    if (personal.trim() && !EMAIL_RE.test(personal.trim())) return setError('The personal email address does not look right.');
    if (!subject.trim() || !body.trim()) return setError('The email needs a subject and a message.');
    if (unresolved.length) return setError(`These fields have no value: ${unresolved.map((k) => `{{${k}}}`).join(', ')}. Remove them or fix them in the email.`);
    const inv = sendInvite({ offerId: offer.id, candidateId: candidate.id, name: candidate.name, location: offer.location, toWork: work.trim().toLowerCase(), toPersonal: personal.trim().toLowerCase(), joiningDate: offer.joiningDate, dueDate: due, token }, actor.name);
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
          <input type="date" value={due} min={todayISO()} max={offer.joiningDate} onChange={(e) => setDue(e.target.value)} />
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
