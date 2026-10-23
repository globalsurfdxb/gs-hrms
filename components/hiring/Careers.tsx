'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EMPLOYEES } from '@/lib/data';
import { todayISO } from '@/lib/dates';
import { EMAIL_RE } from '@/lib/options';
import { ENTITY_NAME } from '@/lib/org';
import { GS_LOGO } from '@/lib/brandAssets';
import { Fg, TEXTAREA_STYLE } from '@/components/hiring/HiringBits';
import { Actor, addCandidate, applyToJob, findDuplicates, getHiring } from '@/lib/hiringStore';
import { sendRuleMail } from '@/lib/hiringMail';
import { Job, Source } from '@/lib/hiringTypes';

/* The public side of hiring: anyone with a link can read an open job and apply, without signing in. The page is
   shown outside the app shell (see AppShell). With no backend yet, an application is saved in this browser's store;
   a server endpoint replaces `submitApplication` later. */

/** Job boards the public link can be tracked for: the `src` value in the link becomes the candidate's source. */
export const BOARDS: { id: string; label: string; source: Source }[] = [
  { id: 'indeed', label: 'Indeed', source: 'Indeed' },
  { id: 'linkedin', label: 'LinkedIn', source: 'LinkedIn' },
  { id: 'naukri', label: 'Naukri', source: 'Naukri' },
  { id: 'bayt', label: 'Bayt', source: 'Bayt' },
];

export const careersPath = (job: Pick<Job, 'code'>, ref?: string, src?: string) => {
  const q = [ref ? `ref=${encodeURIComponent(ref)}` : '', src ? `src=${encodeURIComponent(src)}` : ''].filter(Boolean).join('&');
  return `/careers/${job.code}${q ? `?${q}` : ''}`;
};

/** Where an applicant says they came from, from the link's `src` value. */
export const sourceFromParam = (src: string | null): Source => BOARDS.find((b) => b.id === (src ?? '').toLowerCase())?.source ?? 'Careers Page';

/** A job accepts applications while it is open and not past its closing date. */
export const acceptingApplications = (j: Job) => j.status === 'Open' && j.closingDate >= todayISO();

const PUBLIC_ACTOR: Actor = { id: 'careers-page', name: 'Careers page', role: 'Employee' };

export function CareersFrame({ children, foot, title = 'Careers', hero, wide, landing, minimal }: { children: React.ReactNode; foot?: React.ReactNode; title?: string; hero?: React.ReactNode; wide?: boolean; landing?: boolean; minimal?: boolean }) {
  return (
    <div className="cr-page">
      <header className="cr-top">
        <div className="cr-top-in">
          {minimal ? (
            <span className="cr-brand" aria-label={`${ENTITY_NAME} ${title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GS_LOGO} alt="" />
              <small>{title}</small>
            </span>
          ) : (
          <Link href="/careers" className="cr-brand" aria-label={`${ENTITY_NAME} ${title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GS_LOGO} alt="" />
            <small>{title}</small>
          </Link>
          )}
          {minimal ? null : landing ? (
            <nav className="cr-nav" aria-label="Page sections">
              <Link href="/careers#roles">Open roles</Link>
              <Link href="/careers#process">How we hire</Link>
              <a href="#contact">Contact</a>
              <Link href="/careers#roles" className="cr-nav-cta">
                View openings
              </Link>
            </nav>
          ) : (
            <a className="cr-mail" href="mailto:hr@globalsurf.ae">
              hr@globalsurf.ae
            </a>
          )}
        </div>
      </header>
      {hero}
      <main className={`cr-main ${wide ? 'wide' : ''} ${landing ? 'landing' : ''}`}>{children}</main>
      <footer className="cr-foot" id="contact">
        <div className="cr-foot-in">
          <div className="cr-foot-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GS_LOGO} alt={ENTITY_NAME} />
            <p>Managed IT, cloud and network services from Dubai and Kochi.</p>
          </div>
          <div>
            <h4>Dubai</h4>
            <p>
              SIT Tower, Dubai
              <br />
              United Arab Emirates
            </p>
          </div>
          <div>
            <h4>Kochi</h4>
            <p>
              Trans Asia Cyberpark, Infopark Phase 2
              <br />
              Kakkanad, Cochin 682303
            </p>
          </div>
          <div>
            <h4>Talk to HR</h4>
            <p>
              <a href="mailto:hr@globalsurf.ae">hr@globalsurf.ae</a>
              <br />
              +91 8075490551
            </p>
          </div>
        </div>
        <div className="cr-foot-legal">
          {foot ?? `${ENTITY_NAME} · We store your details only to consider you for this and similar roles, and you can ask us to remove them at any time.`}
        </div>
      </footer>
    </div>
  );
}

export function Pay({ job }: { job: Job }) {
  // Pay ranges are internal; the public page shows the role, place and requirements only.
  return <>{job.employmentType} · {job.location === 'Kochi' ? 'Kochi, India' : 'Dubai, United Arab Emirates'}</>;
}

/** A referral code is an employee code; it only counts for an active employee and a job that takes referrals. */
export function referrerFor(job: Job, ref: string | null) {
  if (!ref || !job.referralEligible) return undefined;
  return EMPLOYEES.find((e) => e.employeeCode.toLowerCase() === ref.toLowerCase() && e.employmentStatus === 'Active');
}

export function ApplyForm({ job, refCode, src = null }: { job: Job; refCode: string | null; src?: string | null }) {
  const referrer = referrerFor(job, refCode);
  const [v, setV] = useState({ name: '', email: '', phone: '', company: '', title: '', years: '', notice: '', links: '', cvName: '', note: '', consent: false });
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  const errors: Record<string, string> = {};
  if (!v.name.trim()) errors.name = 'Please enter your name.';
  if (!v.email.trim()) errors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(v.email.trim())) errors.email = 'That does not look like an email address.';
  if (!v.phone.trim()) errors.phone = 'Please enter your phone number.';
  else if (v.phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a valid phone number.';
  if (v.years === '' || !(Number(v.years) >= 0)) errors.years = 'Enter your total experience in years.';
  if (!v.cvName) errors.cv = 'Please attach your CV.';
  if (!v.consent) errors.consent = 'Please confirm you agree to us storing your details.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(errors).length) return;
    const store = getHiring();
    const j = store.jobs.find((x) => x.id === job.id);
    if (!j || !acceptingApplications(j)) return setError('This role is no longer accepting applications.');
    const existing = findDuplicates(store, v.email, v.phone)[0];
    if (existing) {
      // Someone who is already on file just gets the new application; we do not tell the visitor who is on file.
      if (store.applications.some((a) => a.candidateId === existing.id && a.jobId === job.id)) return setError('You have already applied for this role. We will be in touch if your profile is a fit.');
      const r = applyToJob(existing.id, job.id, PUBLIC_ACTOR);
      if (!r.ok) return setError(r.error);
      sendRuleMail('Applied', r.application.id, PUBLIC_ACTOR.name);
      return setDone(true);
    }
    const r = addCandidate(
      {
        name: v.name,
        email: v.email,
        phone: v.phone.trim(),
        location: job.location,
        currentCity: '',
        currentCompany: v.company.trim(),
        currentTitle: v.title.trim(),
        experienceYears: Number(v.years),
        noticeDays: v.notice === '' ? 0 : Number(v.notice),
        currency: job.currency,
        visaStatus: '',
        source: referrer ? 'Employee Referral' : sourceFromParam(src),
        referrerId: referrer?.id,
        cvName: v.cvName,
        links: v.links.trim(),
        tags: [],
        note: v.note,
        consent: v.consent,
      },
      job.id,
      PUBLIC_ACTOR,
    );
    if (!r.ok) return setError(r.error);
    // The confirmation email goes straight out when the Applied rule is set to send automatically.
    if (r.application) sendRuleMail('Applied', r.application.id, PUBLIC_ACTOR.name);
    setDone(true);
  };

  if (done)
    return (
      <div className="cr-card cr-done">
        <div className="cr-done-ic">✓</div>
        <h2>Thank you, {v.name.trim().split(/\s+/)[0]}</h2>
        <p>
          Your application for <b>{job.title}</b> has been received. Our hiring team reviews every application and will contact you at {v.email.trim()} if your profile is a fit.
        </p>
        <Link href="/careers" className="btn ghost">
          See other openings
        </Link>
      </div>
    );

  return (
    <form className="cr-card cr-apply" onSubmit={submit} noValidate>
      <div className="ap-head">
        <h2>Apply for this role</h2>
        <p>It takes about three minutes. Fields marked * are required.</p>
      </div>
      {referrer && <div className="cr-ref">Referred by {referrer.name.split(' ')[0]} from our team.</div>}
      {error && <div className="tx-err" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="ap-group">
        <h3>
          <span>1</span> About you
        </h3>
        <div className="form-grid hm-form">
          <Fg label="Full name" required error={shown('name')}>
            <input value={v.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
          </Fg>
          <Fg label="Email" required error={shown('email')}>
            <input type="email" value={v.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
          </Fg>
          <Fg label="Phone" required error={shown('phone')} hint="Include the country code.">
            <input type="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder={job.location === 'Kochi' ? '+91 98765 43210' : '+971 50 123 4567'} autoComplete="tel" />
          </Fg>
          <Fg label="LinkedIn or portfolio">
            <input value={v.links} onChange={(e) => set('links', e.target.value)} placeholder="linkedin.com/in/…" />
          </Fg>
        </div>
      </div>

      <div className="ap-group">
        <h3>
          <span>2</span> Your experience
        </h3>
        <div className="form-grid hm-form">
          <Fg label="Total experience (years)" required error={shown('years')}>
            <input type="number" min={0} step="0.5" value={v.years} onChange={(e) => set('years', e.target.value)} />
          </Fg>
          <Fg label="Notice period (days)">
            <input type="number" min={0} value={v.notice} onChange={(e) => set('notice', e.target.value)} />
          </Fg>
          <Fg label="Current company">
            <input value={v.company} onChange={(e) => set('company', e.target.value)} />
          </Fg>
          <Fg label="Current job title">
            <input value={v.title} onChange={(e) => set('title', e.target.value)} />
          </Fg>
        </div>
      </div>

      <div className="ap-group">
        <h3>
          <span>3</span> CV and anything else
        </h3>
        <div className="form-grid hm-form">
          <Fg label="CV" required error={shown('cv')} full>
            <label className={`ap-drop ${v.cvName ? 'has' : ''}`}>
              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => set('cvName', e.target.files?.[0]?.name ?? '')} />
              <span className="ap-drop-ic" aria-hidden>
                {v.cvName ? '✓' : '↑'}
              </span>
              <span className="ap-drop-tx">
                <b>{v.cvName || 'Choose your CV'}</b>
                <small>{v.cvName ? 'Click to choose a different file' : 'PDF or Word file'}</small>
              </span>
            </label>
          </Fg>
          <Fg label="Anything you would like us to know" full>
            <textarea rows={3} value={v.note} onChange={(e) => set('note', e.target.value)} style={TEXTAREA_STYLE} />
          </Fg>
        </div>
      </div>

      <div className="ap-consent">
        <label className="hm-check">
          <input type="checkbox" checked={v.consent} onChange={(e) => set('consent', e.target.checked)} />
          <span>I agree to {ENTITY_NAME} storing and processing my details to consider me for this and similar roles.</span>
        </label>
        {shown('consent') && <div className="tx-err">{shown('consent')}</div>}
      </div>
      <button type="submit" className="btn primary ap-submit">
        Submit application
      </button>
    </form>
  );
}
