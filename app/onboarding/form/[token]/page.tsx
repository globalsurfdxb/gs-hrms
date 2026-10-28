'use client';

import { DateField } from '@/components/ui/DateField';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { CareersFrame } from '@/components/hiring/Careers';
import { Fg, TEXTAREA_STYLE } from '@/components/hiring/HiringBits';
import { BLOOD_GROUPS, EMAIL_RE, GENDERS, MARITAL_STATUSES, NATIONALITIES, ibanError, ifscError, indiaAccountError, phoneOk } from '@/lib/options';
import { ENTITY_NAME } from '@/lib/org';
import { COMPANIES } from '@/lib/data';
import { companyOfOffer } from '@/lib/hiringLetters';
import { useHiring } from '@/lib/hiringStore';
import type { EducationRow, EmergencyRow, ExperienceRow, FamilyRow } from '@/lib/employeeStore';
import { todayISO } from '@/lib/dates';
import { docRequestFor, receivedForJoining, useDocRequests } from '@/lib/hiringDocs';
import { JoiningForm, OnboardingInvite, blankJoiningForm, inviteByToken, markOpened, saveFormDraft, submitForm, useInvites } from '@/lib/onboardingForms';

const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);
const long = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The new joiner's own page, reached from the email HR sent. No sign-in: the link is the key. They fill in their
    details, which HR then reviews and uses to start onboarding. */
export default function JoiningFormPage() {
  const { token } = useParams<{ token: string }>();
  const mounted = useMounted();
  const invites = useInvites();
  const hiring = useHiring();
  const docReqs = useDocRequests();
  const found = mounted ? inviteByToken(invites, token) : undefined;
  // The company the offer is from. Forms sent before it was recorded look it up from the offer.
  const offer = found ? hiring.offers.find((o) => o.id === found.offerId) : undefined;
  const company = found?.company ?? COMPANIES.find((c) => c.id === (offer ? companyOfOffer(hiring, offer) : undefined))?.name ?? ENTITY_NAME;
  const invite = found ? { ...found, company } : undefined;
  const foot = `${company} · This page is private to you. Your details are only used for your employment record.`;

  useEffect(() => {
    if (invite?.status === 'Sent') markOpened(token);
  }, [token, invite?.status]);

  if (!mounted) return <CareersFrame minimal title="Joining details" foot={foot}>{null}</CareersFrame>;
  if (!invite)
    return (
      <CareersFrame minimal title="Joining details" foot={foot}>
        <div className="cr-card cr-empty">
          <h2>This link is not valid</h2>
          <p>It may be mistyped or no longer active. Please contact the HR team at {ENTITY_NAME}, who can send you a new one.</p>
        </div>
      </CareersFrame>
    );
  if (invite.status === 'Submitted')
    return (
      <CareersFrame minimal title="Joining details" foot={foot}>
        <div className="cr-card cr-done">
          <div className="cr-done-ic" aria-hidden>
            ✓
          </div>
          <h2>Thank you, {invite.name.split(' ')[0]}</h2>
          <p>Your details were received{invite.submittedAt ? ` on ${long(invite.submittedAt)}` : ''}. Our HR team will review them and be in touch about your first day{invite.joiningDate ? ` on ${long(invite.joiningDate)}` : ''}.</p>
        </div>
      </CareersFrame>
    );
  // Papers HR already verified before the offer are not asked for again.
  const received = receivedForJoining(offer ? docRequestFor(docReqs, offer.applicationId) : undefined);
  return <FormBody key={invite.id} invite={invite} foot={foot} received={received} />;
}

const blankEdu = (): EducationRow => ({ qualification: '', institution: '', course: '', field: '', startYear: '', endYear: '' });
const blankFam = (): FamilyRow => ({ name: '', relationship: '', occupation: '', dob: '' });

/** First, middle and last name from a full name: first word, last word, anything between. */
const splitName = (full: string) => {
  const w = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: w[0] ?? '', lastName: w.length > 1 ? w[w.length - 1] : '', middleName: w.length > 2 ? w.slice(1, -1).join(' ') : '' };
};

/** Picks one document. Files are recorded by name only until file storage is connected. A paper HR already verified
    before the offer is shown as received instead. */
function FileField({ name, label, file, onFile, got, tag }: { name: string; label: string; file: string; onFile: (n: string) => void; got?: string[]; tag?: 'Required' | 'Optional' }) {
  const [problem, setProblem] = useState('');
  if (got)
    return (
      <div className="jf-doc got">
        <span>{label}</span>
        <small>✓ Received and verified: {got.join(', ')}</small>
      </div>
    );
  return (
    <label className="jf-doc" data-doc={name}>
      <span>
        {label}
        {tag && <i className={`ds-tag ${tag === 'Required' ? 'req' : ''}`}>{tag}</i>}
      </span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (!picked) return;
          if (!/\.(pdf|jpe?g|png)$/i.test(picked.name)) return setProblem('Use a PDF, JPG or PNG file.');
          if (picked.size > 10 * 1024 * 1024) return setProblem('The file is larger than 10 MB.');
          setProblem('');
          onFile(picked.name);
        }}
      />
      {file && <small>✓ {file}</small>}
      {problem && <small style={{ color: 'var(--danger)' }}>{problem}</small>}
    </label>
  );
}

const blankExp = (): ExperienceRow => ({ company: '', location: '', from: '', to: '', title: '', mode: 'Onsite' });

function FormBody({ invite, foot, received }: { invite: OnboardingInvite; foot: string; received: Record<string, string[]> }) {
  const india = invite.location === 'Kochi';
  const [d, setD] = useState<JoiningForm>(() => {
    const base = invite.data ?? blankJoiningForm();
    return base.fv.personalEmail === undefined && invite.toPersonal ? { ...base, fv: { ...base.fv, personalEmail: invite.toPersonal } } : base;
  });
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const f = (k: string) => d.fv[k] ?? '';
  const setF = (k: string, v: string) => setD((p) => ({ ...p, fv: { ...p.fv, [k]: v } }));

  // Keep what they have typed, so they can close the page and come back to it.
  const snapshot = JSON.stringify(d);
  useEffect(() => {
    const t = setTimeout(() => {
      saveFormDraft(invite.token, JSON.parse(snapshot) as JoiningForm);
      setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 700);
    return () => clearTimeout(t);
  }, [snapshot, invite.token]);

  const fam = d.fam ?? [blankFam()];
  /** The names HR's earlier document check uses for the papers that have their own place in this form. */
  const eduDoc = india ? 'Highest Educational Certificate' : 'Attested Educational Certificate';
  const expDoc = india ? 'Experience / Relieving Letters' : 'Experience Letters';
  /** Papers that have no place of their own above. Passport, Aadhaar, PAN, certificates and letters are attached there. */
  const docs: { name: string; required?: boolean }[] = india
    ? [{ name: 'Passport Size Photo', required: true }, { name: 'Casual Photo' }, { name: 'Passbook / Bank Statement' }, { name: 'Insurance Document' }]
    : [{ name: 'Passport Size Photo', required: true }, { name: 'Casual Photo' }, { name: 'Emirates ID' }, { name: 'Residence Visa' }, { name: 'Medical Insurance E-Card' }];
  // India names are asked in three parts; they start from the name HR has on record.
  const split = splitName(invite.name);
  const nm = (k: 'firstName' | 'middleName' | 'lastName') => (d.fv[k] !== undefined ? d.fv[k] : split[k]);
  const fullNow = india ? [nm('firstName'), nm('middleName'), nm('lastName')].map((t) => t.trim()).filter(Boolean).join(' ') : invite.name;
  /** Name as per passport / Aadhaar / PAN: suggested from the name above until it is edited. */
  const idName = (k: 'passportName' | 'aadhaarName' | 'panName' | 'accountName') => (d.fv[k] !== undefined ? d.fv[k] : fullNow);

  /* Everything the onboarding wizard needs from the joiner is required here too: personal email, identity numbers, the
     bank account (typed twice) with IFSC and branch for India or a valid IBAN for the UAE, and PF details for India.
     A field left empty is flagged once they try to submit; a wrong format is flagged as soon as it is typed. */
  const errors: Record<string, string> = {};
  const blank = new Set<string>();
  const need = (k: string, msg: string) => {
    errors[k] = msg;
    blank.add(k);
  };
  const bad = (k: string, msg: string) => {
    errors[k] = msg;
  };
  const today = todayISO();
  const hasDigit = (s: string) => /\d/.test(s);
  const filled = (r: object, ignore: string[] = []) => Object.entries(r).some(([k, x]) => !ignore.includes(k) && String(x ?? '').trim() !== '');
  // The wizard keeps local numbers (10 digits in India, 9 in the UAE). Joiners may type the country code or a leading 0.
  const digitsWanted = india ? 10 : 9;
  const countryCode = india ? '91' : '971';
  const localDigits = (raw: string) => {
    let x = raw.replace(/\D/g, '');
    if (x.length > digitsWanted && x.startsWith(countryCode)) x = x.slice(countryCode.length);
    if (x.length === digitsWanted + 1 && x.startsWith('0')) x = x.slice(1);
    return x;
  };
  const localOk = (raw: string) => /^[+\d][\d\s\-()]*$/.test(raw.trim()) && localDigits(raw).length === digitsWanted;
  const mobileMsg = `Enter a valid ${digitsWanted}-digit mobile number, with or without +${countryCode}.`;
  const ageOn = (iso: string) => {
    const [y, m, day] = iso.split('-').map(Number);
    const t = new Date();
    return t.getFullYear() - y - (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < day) ? 1 : 0);
  };

  // about you
  if (india) {
    if (!nm('firstName').trim()) need('firstName', 'Enter your first name.');
    else if (hasDigit(nm('firstName'))) bad('firstName', 'A name does not contain numbers.');
    if (hasDigit(nm('middleName'))) bad('middleName', 'A name does not contain numbers.');
    if (!nm('lastName').trim()) need('lastName', 'Enter your last name.');
    else if (hasDigit(nm('lastName'))) bad('lastName', 'A name does not contain numbers.');
  }
  if (!d.dob) need('dob', 'Enter your date of birth.');
  else if (d.dob > today) bad('dob', 'Your date of birth cannot be in the future.');
  else if (ageOn(d.dob) < 18) bad('dob', 'You must be at least 18 years old.');
  if (!f('gender')) need('gender', 'Choose one.');
  if (!f('nationality')) need('nationality', 'Choose your nationality.');
  if (f('nationality') === 'Other' && !f('nationalityOther').trim()) need('nationalityOther', 'Enter your nationality.');
  if (!f('personalMobile').trim()) need('personalMobile', 'Enter your mobile number.');
  else if (!localOk(f('personalMobile'))) bad('personalMobile', mobileMsg);
  if (!f('personalEmail').trim()) need('personalEmail', 'Enter your personal email address.');
  else if (!EMAIL_RE.test(f('personalEmail').trim())) bad('personalEmail', 'That does not look like an email address.');
  if (!f('currentAddress').trim()) need('currentAddress', 'Enter your current address.');
  else if (f('currentAddress').trim().length < 8) bad('currentAddress', 'Enter the full address.');

  // identity
  if (india) {
    if (!idName('aadhaarName').trim()) need('aadhaarName', 'Enter your name as printed on the Aadhaar card.');
    if (!f('aadhaar').trim()) need('aadhaar', 'Enter your Aadhaar number.');
    else if (!/^\d{12}$/.test(f('aadhaar').replace(/\s/g, ''))) bad('aadhaar', 'An Aadhaar number has 12 digits.');
    if (!idName('panName').trim()) need('panName', 'Enter your name as printed on the PAN card.');
    if (!f('pan').trim()) need('pan', 'Enter your PAN.');
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f('pan').trim().toUpperCase())) bad('pan', 'A PAN looks like ABCDE1234F.');
    if (!received['Aadhaar Card'] && !!f('docFile.Aadhaar Card') !== !!f('docFile.Aadhaar Card (Back)')) bad('aadhaarSides', 'Attach both sides of the Aadhaar card.');
  } else {
    if (!f('passportNumber').trim()) need('passportNumber', 'Enter your passport number.');
    if (f('emiratesId').trim() && !/^784-\d{4}-\d{7}-\d$/.test(f('emiratesId').trim())) bad('emiratesId', 'The format is 784-YYYY-NNNNNNN-N.');
  }
  if (f('passportNumber').trim()) {
    if (!/^[A-Za-z0-9]{6,9}$/.test(f('passportNumber').trim())) bad('passportNumber', 'A passport number has 6 to 9 letters and digits.');
    if (!d.passportExpiry) need('passportExpiry', 'Enter the passport expiry date.');
  }
  if (d.passportExpiry && d.passportExpiry < today) bad('passportExpiry', 'This passport has expired.');
  if (!received['Passport Copy'] && !!f('docFile.Passport Copy') !== !!f('docFile.Passport Copy (Back)')) bad('passportSides', india ? 'Attach both the front and the back page of the passport.' : 'Attach both the photo page and the last page of the passport.');

  // bank
  if (!f('bankName').trim()) need('bankName', 'Enter your bank name.');
  if (!idName('accountName').trim()) need('accountName', 'Enter the account holder name.');
  const squash = (x: string) => x.replace(/\s/g, '').toUpperCase();
  if (!f('accountNumber').trim()) need('accountNumber', india ? 'Enter your account number.' : 'Enter your IBAN.');
  else {
    const e = india ? indiaAccountError(f('accountNumber')) : ibanError(f('accountNumber'));
    if (e) bad('accountNumber', e);
  }
  const confirmTyped = f('accountNumberConfirm').trim() !== '';
  const accountMatches = confirmTyped && squash(f('accountNumberConfirm')) === squash(f('accountNumber'));
  if (!confirmTyped) need('accountConfirm', india ? 'Type the account number again to confirm it.' : 'Type the IBAN again to confirm it.');
  else if (!accountMatches) bad('accountConfirm', india ? 'The two account numbers do not match.' : 'The two IBANs do not match.');
  if (india) {
    if (!f('branchCode').trim()) need('branchCode', 'Enter the IFSC code.');
    else {
      const e = ifscError(f('branchCode'));
      if (e) bad('branchCode', e);
    }
    if (!f('branchName').trim()) need('branchName', 'Enter the branch name.');
    if (!f('pfEnrolled')) need('pfEnrolled', 'Choose Yes or No.');
    if (f('pfEnrolled') === 'Yes') {
      if (!f('uan').trim()) need('uan', 'Enter your UAN, since you are already enrolled in PF.');
      else if (!/^\d{12}$/.test(f('uan').replace(/\s/g, ''))) bad('uan', 'A UAN has 12 digits.');
      if (!f('uanMobile').trim()) need('uanMobile', 'Enter the mobile number linked to your UAN.');
      else if (!localOk(f('uanMobile'))) bad('uanMobile', mobileMsg);
    }
  }

  // emergency contacts: the first is required; the second only needs to be complete when started
  (['emA', 'emB'] as const).forEach((key) => {
    const r = d[key][0] ?? { group: '', name: '', relationship: '', mobile: '' };
    if (key === 'emB' && !filled(r, ['group'])) return;
    if (!r.name.trim()) need(`${key}.name`, 'Enter the contact’s name.');
    else if (hasDigit(r.name)) bad(`${key}.name`, 'A name does not contain numbers.');
    if (!r.relationship.trim()) need(`${key}.relationship`, 'Enter how they are related to you.');
    if (!r.mobile.trim()) need(`${key}.mobile`, 'Enter the contact’s mobile number.');
    else if (key === 'emA' || india ? !localOk(r.mobile) : !phoneOk(r.mobile)) bad(`${key}.mobile`, key === 'emA' || india ? mobileMsg : 'Enter a valid mobile number, 7 to 15 digits, with the country code.');
    else if (localOk(f('personalMobile')) && localDigits(r.mobile) === localDigits(f('personalMobile'))) bad(`${key}.mobile`, 'Give a number other than your own.');
  });

  // education, experience and family: optional, but a started entry must be complete and sensible
  const thisYear = new Date().getFullYear();
  d.edu.forEach((r, i) => {
    if (!filled(r)) return;
    if (!r.qualification.trim()) need(`edu.${i}.qualification`, 'Enter the qualification.');
    if (!r.institution.trim()) need(`edu.${i}.institution`, 'Enter the school or university.');
    const yearBad = (y: string) => !/^\d{4}$/.test(y) || Number(y) < 1950 || Number(y) > thisYear + 6;
    if (r.startYear.trim() && yearBad(r.startYear.trim())) bad(`edu.${i}.startYear`, 'Enter a 4-digit year.');
    if (r.endYear.trim() && yearBad(r.endYear.trim())) bad(`edu.${i}.endYear`, 'Enter a 4-digit year.');
    else if (r.startYear.trim() && r.endYear.trim() && Number(r.endYear) < Number(r.startYear)) bad(`edu.${i}.endYear`, 'The end year is before the start year.');
  });
  d.exp.forEach((r, i) => {
    if (!filled(r, ['mode'])) return;
    if (!r.company.trim()) need(`exp.${i}.company`, 'Enter the company name.');
    if (!r.title.trim()) need(`exp.${i}.title`, 'Enter your job title.');
    if (!r.from) need(`exp.${i}.from`, 'Enter when you started.');
    else if (r.from.slice(0, 7) > today.slice(0, 7)) bad(`exp.${i}.from`, 'The start date is in the future.');
    if (r.from && r.to && r.to < r.from) bad(`exp.${i}.to`, 'The end date is before the start date.');
  });
  fam.forEach((r, i) => {
    if (!filled(r)) return;
    if (!r.name.trim()) need(`fam.${i}.name`, 'Enter the name.');
    else if (hasDigit(r.name)) bad(`fam.${i}.name`, 'A name does not contain numbers.');
    if (!r.relationship.trim()) need(`fam.${i}.relationship`, 'Enter the relationship.');
    if (r.dob && r.dob > today) bad(`fam.${i}.dob`, 'The date of birth cannot be in the future.');
  });

  if (!f('docFile.Passport Size Photo') && !d.docs['Passport Size Photo']) need('photo', 'Attach a passport size photo.');
  if (!d.declared) need('declared', 'Please confirm the details are correct.');
  const invalid = Object.keys(errors).length;
  const shown = (k: string) => (attempted || !blank.has(k) ? errors[k] : undefined);
  const has = (...keys: string[]) => Object.keys(errors).some((k) => keys.some((p) => k === p || k.startsWith(`${p}.`)));
  const steps: { id: string; label: string; done: boolean; optional?: boolean }[] = [
    { id: 'about', label: 'About you', done: !has('firstName', 'middleName', 'lastName', 'dob', 'gender', 'nationality', 'nationalityOther', 'personalMobile', 'personalEmail', 'currentAddress') },
    { id: 'identity', label: 'Identity', optional: !india, done: !has('aadhaarName', 'panName', 'aadhaar', 'pan', 'aadhaarSides', 'passportSides', 'passportNumber', 'passportExpiry', 'emiratesId') && (india || !!f('passportNumber')) },
    { id: 'bank', label: 'Bank details', done: !has('bankName', 'accountName', 'accountNumber', 'accountConfirm', 'branchName', 'branchCode', 'pfEnrolled', 'uan', 'uanMobile') },
    { id: 'emergency', label: 'Emergency contacts', done: !has('emA', 'emB') },
    { id: 'education', label: 'Education', optional: true, done: d.edu.some((r) => r.qualification.trim() || r.institution.trim()) && !has('edu') },
    { id: 'experience', label: 'Work experience', optional: true, done: d.exp.some((r) => r.company.trim()) && !has('exp') },
    { id: 'family', label: 'Family', optional: true, done: fam.some((r) => r.name.trim()) && !has('fam') },
    { id: 'documents', label: 'Documents', done: !errors.photo },
    { id: 'confirm', label: 'Confirm and submit', done: !errors.declared },
  ];
  const banner = attempted && invalid ? `${invalid} ${invalid === 1 ? 'detail needs' : 'details need'} your attention. ${invalid === 1 ? 'It is' : 'They are'} marked below.` : error;
  const required = steps.filter((st) => !st.optional);
  const doneCount = required.filter((st) => st.done).length;
  const pct = Math.round((doneCount / required.length) * 100);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(errors).length) {
      setError('');
      document.querySelector('[aria-invalid="true"], .fm-err')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const earlier = Object.fromEntries(Object.entries(received).map(([k, v]) => [k, `${v.join(', ')} (verified earlier)`]));
    const names: Record<string, string> = { accountName: idName('accountName').trim(), ...(india ? { aadhaarName: idName('aadhaarName').trim(), panName: idName('panName').trim(), ...(f('passportNumber').trim() || d.fv.passportName !== undefined ? { passportName: idName('passportName').trim() } : {}) } : {}) };
    const parts: Record<string, string> = india ? { firstName: nm('firstName').trim(), middleName: nm('middleName').trim(), lastName: nm('lastName').trim() } : {};
    const phones: Record<string, string> = { personalMobile: localDigits(f('personalMobile')), ...(f('uanMobile').trim() ? { uanMobile: localDigits(f('uanMobile')) } : {}) };
    const contact = (row: EmergencyRow | undefined, local: boolean): EmergencyRow[] => (row ? [{ ...row, mobile: local ? localDigits(row.mobile) : row.mobile.trim() }] : []);
    const r = submitForm(invite.token, { ...d, fv: { ...d.fv, ...names, ...parts, ...phones }, emA: contact(d.emA[0], true), emB: contact(d.emB[0], india), fam, docs: { ...d.docs, ...earlier } });
    if (!r.ok) setError(r.error);
  };

  const setRow = <T extends object>(rows: T[], i: number, patch: Partial<T>) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r));

  return (
    <CareersFrame
      wide
      minimal
      title="Joining details"
      foot={foot}
      hero={
        <section className="jh">
          <span className="cr2-blob b1" aria-hidden />
          <span className="cr2-blob b2" aria-hidden />
          <div className="jh-in">
            <div className="jh-copy">
              <span className="cr2-pill">
                <i /> Welcome to {invite.company}
              </span>
              <h1>
                Complete your joining details, <em>{invite.name.split(' ')[0]}</em>
              </h1>
              <p>This takes about 10 minutes. Your answers save as you type, so you can pause and return to this same link at any time.</p>
            </div>
            <dl className="jh-facts">
              <div>
                <dt>Joining date</dt>
                <dd>{invite.joiningDate ? long(invite.joiningDate) : 'To be confirmed'}</dd>
              </div>
              <div>
                <dt>Please finish by</dt>
                <dd>{long(invite.dueDate)}</dd>
              </div>
              <div>
                <dt>Work location</dt>
                <dd>{india ? 'Kochi, India' : 'Dubai, UAE'}</dd>
              </div>
            </dl>
          </div>
        </section>
      }
    >
      <div className="jf-layout">
        <aside className="jf-side" aria-label="Form progress">
          <div className="jf-prog">
            <div className="jf-prog-top">
              <b>{pct}%</b>
              <span>
                {doneCount} of {required.length} required sections done
              </span>
            </div>
            <div className="jf-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
          <nav className="jf-steps">
            {steps.map((st, i) => (
              <a key={st.id} href={`#jf-${st.id}`} className={st.done ? 'done' : ''}>
                <span className="jf-dot">{st.done ? '✓' : i + 1}</span>
                <span className="jf-st-t">
                  {st.label}
                  {st.optional && <small>Optional</small>}
                </span>
              </a>
            ))}
          </nav>
          <p className="jf-saved">{savedAt ? `Saved automatically at ${savedAt}` : 'Saved automatically as you type'}</p>
        </aside>
      <div className="jf">
        <p className="jf-note">
          Fill in what you can now. Your answers are saved as you type, so you can close this page and come back to the same link. Fields marked * are required.
        </p>
        {banner && (
          <div className="tx-err" role="alert" style={{ marginBottom: 12 }}>
            {banner}
          </div>
        )}

        <section className="cr-card jf-sec" id="jf-about">
          <h2>About you</h2>
          <div className="form-grid hm-form">
            {india ? (
              <>
                <Fg label="First name" required error={shown('firstName')}>
                  <input value={nm('firstName')} onChange={(e) => setF('firstName', e.target.value)} autoComplete="given-name" />
                </Fg>
                <Fg label="Middle name" error={shown('middleName')}>
                  <input value={nm('middleName')} onChange={(e) => setF('middleName', e.target.value)} autoComplete="additional-name" />
                </Fg>
                <Fg label="Last name" required error={shown('lastName')}>
                  <input value={nm('lastName')} onChange={(e) => setF('lastName', e.target.value)} autoComplete="family-name" />
                </Fg>
              </>
            ) : (
              <Fg label="Full name">
                <input value={invite.name} readOnly style={{ background: 'var(--bg)' }} />
              </Fg>
            )}
            <Fg label="Date of birth" required error={shown('dob')}>
              <DateField value={d.dob} onChange={(e) => setD({ ...d, dob: e.target.value })} />
            </Fg>
            <Fg label="Gender" required error={shown('gender')}>
              <select value={f('gender')} onChange={(e) => setF('gender', e.target.value)}>
                <option value="">Select…</option>
                {GENDERS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Fg>
            <Fg label="Marital status">
              <select value={f('maritalStatus')} onChange={(e) => setF('maritalStatus', e.target.value)}>
                {MARITAL_STATUSES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Fg>
            <Fg label="Blood group">
              <select value={f('bloodGroup')} onChange={(e) => setF('bloodGroup', e.target.value)}>
                <option value="">Select…</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Fg>
            <Fg label="Nationality" required error={shown('nationality')}>
              <select value={f('nationality')} onChange={(e) => setD({ ...d, fv: { ...d.fv, nationality: e.target.value, nationalityOther: e.target.value === 'Other' ? f('nationalityOther') : '' } })}>
                <option value="">Select nationality…</option>
                {NATIONALITIES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Fg>
            {f('nationality') === 'Other' && (
              <Fg label="Your nationality" required error={shown('nationalityOther')}>
                <input value={f('nationalityOther')} onChange={(e) => setF('nationalityOther', e.target.value)} placeholder="e.g. Ethiopian" />
              </Fg>
            )}
            <Fg label="Mobile number" required error={shown('personalMobile')} hint={india ? 'e.g. +91 98765 43210' : 'e.g. +971 50 123 4567'}>
              <input type="tel" value={f('personalMobile')} onChange={(e) => setF('personalMobile', e.target.value)} autoComplete="tel" />
            </Fg>
            <Fg label="Personal email" required error={shown('personalEmail')}>
              <input type="email" value={f('personalEmail')} onChange={(e) => setF('personalEmail', e.target.value)} placeholder={invite.toPersonal || 'name@email.com'} autoComplete="email" />
            </Fg>
            <Fg label="Current address" required error={shown('currentAddress')} full>
              <textarea rows={2} value={f('currentAddress')} onChange={(e) => setF('currentAddress', e.target.value)} style={TEXTAREA_STYLE} />
            </Fg>
            <Fg label="Permanent address" full hint="Leave empty if it is the same as your current address.">
              <textarea rows={2} value={f('permanentAddress')} onChange={(e) => setF('permanentAddress', e.target.value)} style={TEXTAREA_STYLE} />
            </Fg>
          </div>
        </section>

        <section className="cr-card jf-sec" id="jf-identity">
          <h2>Identity</h2>
          {india ? (
            <>
              <p className="cr-sub" style={{ marginTop: 0 }}>
                Your passport (if you have one), Aadhaar and PAN. Upload both sides of the passport and the Aadhaar card. Payroll, PF and tax filing use these.
              </p>
              <div className="id-cols">
                <div className="id-col">
                  <div className="id-h">Passport (optional)</div>
                  <Fg label="Name as per passport" hint="Exactly as printed on the passport.">
                    <input value={idName('passportName')} onChange={(e) => setF('passportName', e.target.value)} autoComplete="off" />
                  </Fg>
                  <Fg label="Passport number" required={!india} error={shown('passportNumber')}>
                    <input value={f('passportNumber')} onChange={(e) => setF('passportNumber', e.target.value.toUpperCase())} autoComplete="off" />
                  </Fg>
                  <Fg label="Passport expiry date" error={shown('passportExpiry')}>
                    <DateField value={d.passportExpiry} onChange={(e) => setD({ ...d, passportExpiry: e.target.value })} />
                  </Fg>
                  <FileField name="Passport Copy" label="Passport: front page" file={f('docFile.Passport Copy')} onFile={(n) => setF('docFile.Passport Copy', n)} got={received['Passport Copy']} />
                  {!received['Passport Copy'] && (
                    <FileField name="Passport Copy (Back)" label="Passport: back page" file={f('docFile.Passport Copy (Back)')} onFile={(n) => setF('docFile.Passport Copy (Back)', n)} />
                  )}
                  {shown('passportSides') && <div className="tx-err">{shown('passportSides')}</div>}
                </div>
                <div className="id-col">
                  <div className="id-h">Aadhaar</div>
                  <Fg label="Name as per Aadhaar" required error={shown('aadhaarName')} hint="Exactly as printed on the Aadhaar card.">
                    <input value={idName('aadhaarName')} onChange={(e) => setF('aadhaarName', e.target.value)} autoComplete="off" />
                  </Fg>
                  <Fg label="Aadhaar number" required error={shown('aadhaar')} hint="12 digits.">
                    <input value={f('aadhaar')} onChange={(e) => setF('aadhaar', e.target.value)} inputMode="numeric" autoComplete="off" />
                  </Fg>
                  <FileField name="Aadhaar Card" label="Aadhaar card: front side" file={f('docFile.Aadhaar Card')} onFile={(n) => setF('docFile.Aadhaar Card', n)} got={received['Aadhaar Card']} />
                  {!received['Aadhaar Card'] && (
                    <FileField name="Aadhaar Card (Back)" label="Aadhaar card: back side" file={f('docFile.Aadhaar Card (Back)')} onFile={(n) => setF('docFile.Aadhaar Card (Back)', n)} />
                  )}
                  {shown('aadhaarSides') && <div className="tx-err">{shown('aadhaarSides')}</div>}
                </div>
                <div className="id-col id-pan">
                  <div className="id-h">PAN</div>
                  <Fg label="Name as per PAN" required error={shown('panName')} hint="Exactly as printed on the PAN card.">
                    <input value={idName('panName')} onChange={(e) => setF('panName', e.target.value)} autoComplete="off" />
                  </Fg>
                  <Fg label="PAN number" required error={shown('pan')} hint="For example ABCDE1234F.">
                    <input value={f('pan')} onChange={(e) => setF('pan', e.target.value.toUpperCase())} autoComplete="off" />
                  </Fg>
                  <FileField name="PAN Card" label="PAN card" file={f('docFile.PAN Card')} onFile={(n) => setF('docFile.PAN Card', n)} got={received['PAN Card']} />
                </div>
              </div>
            </>
          ) : (
            <div className="form-grid hm-form">
              <Fg label="Passport number" required={!india} error={shown('passportNumber')}>
                <input value={f('passportNumber')} onChange={(e) => setF('passportNumber', e.target.value.toUpperCase())} autoComplete="off" />
              </Fg>
              <Fg label="Passport expiry date" error={shown('passportExpiry')}>
                <DateField value={d.passportExpiry} onChange={(e) => setD({ ...d, passportExpiry: e.target.value })} />
              </Fg>
              <Fg label="Emirates ID number (if you have one)" error={shown('emiratesId')} hint="Format 784-YYYY-NNNNNNN-N.">
                <input value={f('emiratesId')} onChange={(e) => setF('emiratesId', e.target.value)} autoComplete="off" />
              </Fg>
              <div className="fg">
                <FileField name="Passport Copy" label="Passport: photo page" file={f('docFile.Passport Copy')} onFile={(n) => setF('docFile.Passport Copy', n)} got={received['Passport Copy']} />
              </div>
              {!received['Passport Copy'] && (
                <div className="fg">
                  <FileField name="Passport Copy (Back)" label="Passport: last page" file={f('docFile.Passport Copy (Back)')} onFile={(n) => setF('docFile.Passport Copy (Back)', n)} />
                </div>
              )}
              {shown('passportSides') && <div className="tx-err">{shown('passportSides')}</div>}
            </div>
          )}
        </section>

        <section className="cr-card jf-sec" id="jf-bank">
          <h2>Bank details</h2>
          <p className="cr-sub" style={{ marginTop: 0 }}>
            For your salary. {india ? 'Savings account in your own name.' : 'Your own account; an IBAN is preferred.'}
          </p>
          <div className="form-grid hm-form">
            <Fg label="Bank name" required error={shown('bankName')}>
              <input value={f('bankName')} onChange={(e) => setF('bankName', e.target.value)} />
            </Fg>
            <Fg label="Account holder name" required error={shown('accountName')} hint="Exactly as on the bank account.">
              <input value={idName('accountName')} onChange={(e) => setF('accountName', e.target.value)} autoComplete="off" />
            </Fg>
            <Fg label={india ? 'Account number' : 'IBAN / account number'} required error={shown('accountNumber')} hint={india ? '9 to 18 digits, as on your passbook or cheque book.' : 'An IBAN starts with AE and has 23 characters.'}>
              <input value={f('accountNumber')} onChange={(e) => setF('accountNumber', e.target.value)} autoComplete="off" inputMode={india ? 'numeric' : undefined} />
            </Fg>
            <Fg
              label={india ? 'Confirm account number' : 'Confirm IBAN / account number'}
              required
              error={shown('accountConfirm') ?? (confirmTyped && !accountMatches ? 'The two account numbers do not match.' : undefined)}
              hint={accountMatches && !errors.accountNumber ? '✓ Both entries match.' : 'Type it again. Pasting is turned off so we know both were typed.'}
            >
              <input
                value={f('accountNumberConfirm')}
                onChange={(e) => setF('accountNumberConfirm', e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                autoComplete="off"
                inputMode={india ? 'numeric' : undefined}
              />
            </Fg>
            {india && (
              <Fg label="Branch name" required error={shown('branchName')}>
                <input value={f('branchName')} onChange={(e) => setF('branchName', e.target.value)} autoComplete="off" />
              </Fg>
            )}
            <Fg label={india ? 'IFSC code' : 'SWIFT / branch code'} required={india} error={shown('branchCode')} hint={india ? 'For example HDFC0001234.' : undefined}>
              <input value={f('branchCode')} onChange={(e) => setF('branchCode', india ? e.target.value.toUpperCase() : e.target.value)} autoComplete="off" />
            </Fg>
          </div>
          {india && (
            <>
              <h3 style={{ margin: '20px 0 10px' }}>PF details</h3>
              <div className="form-grid hm-form">
                <Fg label="Already enrolled in PF?" required error={shown('pfEnrolled')}>
                  <select value={f('pfEnrolled')} onChange={(e) => setF('pfEnrolled', e.target.value)}>
                    <option value="">Select…</option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </Fg>
                {f('pfEnrolled') === 'Yes' && (
                  <>
                    <Fg label="UAN number" required error={shown('uan')} hint="12 digits.">
                      <input value={f('uan')} onChange={(e) => setF('uan', e.target.value)} inputMode="numeric" autoComplete="off" />
                    </Fg>
                    <Fg label="Registered mobile number linked to UAN" required error={shown('uanMobile')}>
                      <input type="tel" value={f('uanMobile')} onChange={(e) => setF('uanMobile', e.target.value)} autoComplete="off" />
                    </Fg>
                    <Fg label="Previous PF member ID" hint="If available">
                      <input value={f('pfMemberId')} onChange={(e) => setF('pfMemberId', e.target.value.toUpperCase())} autoComplete="off" />
                    </Fg>
                    <Fg label="EPS eligibility" hint="If applicable">
                      <select value={f('epsEligibility')} onChange={(e) => setF('epsEligibility', e.target.value)}>
                        <option value="">Select…</option>
                        <option>Eligible</option>
                        <option>Not eligible</option>
                        <option>Not sure</option>
                      </select>
                    </Fg>
                  </>
                )}
              </div>
            </>
          )}
        </section>

        <section className="cr-card jf-sec" id="jf-emergency">
          <h2>Emergency contacts</h2>
          {[
            { key: 'emA' as const, title: india ? 'Primary contact' : 'Contact in the UAE', required: true },
            { key: 'emB' as const, title: india ? 'Alternate contact' : 'Contact in your home country', required: false },
          ].map(({ key, title, required }) => (
            <div key={key} className="jf-group">
              <h3>
                {title}
                {required ? ' *' : ''}
              </h3>
              <div className="form-grid hm-form">
                <Fg label="Name" required={required} error={shown(`${key}.name`)}>
                  <input value={d[key][0]?.name ?? ''} onChange={(e) => setD({ ...d, [key]: setRow<EmergencyRow>(d[key], 0, { name: e.target.value }) })} />
                </Fg>
                <Fg label="Relationship" required={required} error={shown(`${key}.relationship`)}>
                  <input value={d[key][0]?.relationship ?? ''} onChange={(e) => setD({ ...d, [key]: setRow<EmergencyRow>(d[key], 0, { relationship: e.target.value }) })} />
                </Fg>
                <Fg label="Mobile number" required={required} error={shown(`${key}.mobile`)}>
                  <input type="tel" value={d[key][0]?.mobile ?? ''} onChange={(e) => setD({ ...d, [key]: setRow<EmergencyRow>(d[key], 0, { mobile: e.target.value }) })} />
                </Fg>
              </div>
            </div>
          ))}
        </section>

        <section className="cr-card jf-sec" id="jf-education">
          <h2>Education</h2>
          {received[eduDoc] && (
            <div className="note-box" style={{ marginBottom: 14, background: '#effaf3', borderColor: '#bfe8cf' }}>
              <div>
                <b>We already have your certificates.</b> You shared and HR verified them before your offer: {received[eduDoc].join(', ')}. You can still list your qualifications below.
              </div>
            </div>
          )}
          {d.edu.map((r, i) => (
            <div key={i} className="jf-group">
              <div className="jf-row">
                <h3>Qualification {i + 1}</h3>
                {d.edu.length > 1 && (
                  <button type="button" className="lnk" onClick={() => setD({ ...d, edu: d.edu.filter((_, n) => n !== i) })}>
                    Delete
                  </button>
                )}
              </div>
              <div className="form-grid hm-form">
                <Fg label="Qualification" error={shown(`edu.${i}.qualification`)}>
                  <input value={r.qualification} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { qualification: e.target.value }) })} placeholder="e.g. Bachelor's degree" />
                </Fg>
                <Fg label="Institution" error={shown(`edu.${i}.institution`)}>
                  <input value={r.institution} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { institution: e.target.value }) })} />
                </Fg>
                <Fg label="Course / field of study">
                  <input value={r.course} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { course: e.target.value }) })} />
                </Fg>
                <Fg label="Start year" error={shown(`edu.${i}.startYear`)}>
                  <input value={r.startYear} inputMode="numeric" maxLength={4} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { startYear: e.target.value }) })} />
                </Fg>
                <Fg label="End year" error={shown(`edu.${i}.endYear`)}>
                  <input value={r.endYear} inputMode="numeric" maxLength={4} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { endYear: e.target.value }) })} />
                </Fg>
                {!received[eduDoc] && (
                  <div className="fg">
                    <FileField name={`Education certificate ${i + 1}`} label="Certificate" file={r.document ?? ''} onFile={(n) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { document: n }) })} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => setD({ ...d, edu: [...d.edu, blankEdu()] })}>
            + Add another qualification
          </button>
        </section>

        <section className="cr-card jf-sec" id="jf-experience">
          <h2>Work experience</h2>
          <p className="cr-sub" style={{ marginTop: 0 }}>
            Your previous jobs, latest first. Skip this if it is your first job.
          </p>
          {received[expDoc] && (
            <div className="note-box" style={{ marginBottom: 14, background: '#effaf3', borderColor: '#bfe8cf' }}>
              <div>
                <b>We already have your experience letters.</b> You shared and HR verified them before your offer: {received[expDoc].join(', ')}.
              </div>
            </div>
          )}
          {d.exp.map((r, i) => (
            <div key={i} className="jf-group">
              <div className="jf-row">
                <h3>Job {i + 1}</h3>
                <button type="button" className="lnk" onClick={() => setD({ ...d, exp: d.exp.filter((_, n) => n !== i) })}>
                  Delete
                </button>
              </div>
              <div className="form-grid hm-form">
                <Fg label="Company" error={shown(`exp.${i}.company`)}>
                  <input value={r.company} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { company: e.target.value }) })} />
                </Fg>
                <Fg label="Job title" error={shown(`exp.${i}.title`)}>
                  <input value={r.title} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { title: e.target.value }) })} />
                </Fg>
                <Fg label="From" error={shown(`exp.${i}.from`)}>
                  <DateField mode="month" value={r.from} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { from: e.target.value }) })} />
                </Fg>
                <Fg label="To" error={shown(`exp.${i}.to`)}>
                  <DateField mode="month" value={r.to} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { to: e.target.value }) })} />
                </Fg>
                <Fg label="City / country">
                  <input value={r.location} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { location: e.target.value }) })} />
                </Fg>
                {!received[expDoc] && (
                  <div className="fg">
                    <FileField name={`Experience letter ${i + 1}`} label="Experience / relieving letter" file={r.document ?? ''} onFile={(n) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { document: n }) })} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => setD({ ...d, exp: [...d.exp, blankExp()] })}>
            + Add a job
          </button>
        </section>

        <section className="cr-card jf-sec" id="jf-family">
          <h2>Family</h2>
          <p className="cr-sub" style={{ marginTop: 0 }}>
            Your spouse, children and parents, if you would like them on record. Add as many as you need.
          </p>
          {fam.map((r, i) => (
            <div key={i} className="jf-group">
              <div className="jf-row">
                <h3>Family member {i + 1}</h3>
                {fam.length > 1 && (
                  <button type="button" className="lnk" onClick={() => setD({ ...d, fam: fam.filter((_, n) => n !== i) })}>
                    Delete
                  </button>
                )}
              </div>
              <div className="form-grid hm-form">
                <Fg label="Name" error={shown(`fam.${i}.name`)}>
                  <input value={r.name} onChange={(e) => setD({ ...d, fam: setRow<FamilyRow>(fam, i, { name: e.target.value }) })} />
                </Fg>
                <Fg label="Relationship" error={shown(`fam.${i}.relationship`)}>
                  <input value={r.relationship} onChange={(e) => setD({ ...d, fam: setRow<FamilyRow>(fam, i, { relationship: e.target.value }) })} />
                </Fg>
                <Fg label="Date of birth" error={shown(`fam.${i}.dob`)}>
                  <DateField value={r.dob ?? ''} max={todayISO()} onChange={(e) => setD({ ...d, fam: setRow<FamilyRow>(fam, i, { dob: e.target.value }) })} />
                </Fg>
                <Fg label="Occupation">
                  <input value={r.occupation} onChange={(e) => setD({ ...d, fam: setRow<FamilyRow>(fam, i, { occupation: e.target.value }) })} />
                </Fg>
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => setD({ ...d, fam: [...fam, blankFam()] })}>
            + Add a family member
          </button>
        </section>

        <section className="cr-card jf-sec" id="jf-documents">
          <h2>Documents</h2>
          <p className="cr-sub" style={{ marginTop: 0 }}>
            Your passport, Aadhaar, PAN, certificates and experience letters are attached in the sections above, so they are not asked for again here. Attach clear copies (PDF or image) and bring the originals on your first day.
          </p>
          {shown('photo') && <div className="tx-err">{shown('photo')}</div>}
          <div className="jf-docs">
            {docs.map((x) => {
              const got = received[x.name];
              return got ? (
                <div key={x.name} className="jf-doc got">
                  <span>{x.name}</span>
                  <small>✓ Received and verified: {got.join(', ')}</small>
                </div>
              ) : (
                <FileField key={x.name} name={x.name} label={x.name} tag={x.required ? 'Required' : 'Optional'} file={f(`docFile.${x.name}`)} onFile={(n) => setF(`docFile.${x.name}`, n)} />
              );
            })}
          </div>
        </section>

        <section className="cr-card jf-sec jf-confirm" id="jf-confirm">
          <h2>Confirm and submit</h2>
          <label className="hm-check">
            <input type="checkbox" checked={d.declared} onChange={(e) => setD({ ...d, declared: e.target.checked })} />
            <span>I confirm the details above are true and complete, and I agree to {invite.company} storing them for my employment record.</span>
          </label>
          {shown('declared') && <div className="tx-err">{shown('declared')}</div>}
          <button type="button" className="btn primary" style={{ marginTop: 18 }} onClick={submit}>
            Submit my details
          </button>
        </section>
      </div>
      </div>
    </CareersFrame>
  );
}
