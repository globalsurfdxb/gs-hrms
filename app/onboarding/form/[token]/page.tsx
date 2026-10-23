'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { CareersFrame } from '@/components/hiring/Careers';
import { Fg, TEXTAREA_STYLE } from '@/components/hiring/HiringBits';
import { BLOOD_GROUPS, GENDERS, MARITAL_STATUSES, NATIONALITIES } from '@/lib/options';
import { ENTITY_NAME } from '@/lib/org';
import type { EducationRow, EmergencyRow, ExperienceRow } from '@/lib/employeeStore';
import { JoiningForm, OnboardingInvite, blankJoiningForm, inviteByToken, markOpened, saveFormDraft, submitForm, useInvites } from '@/lib/onboardingForms';

const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);
const long = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The new joiner's own page, reached from the email HR sent. No sign-in: the link is the key. They fill in their
    details, which HR then reviews and uses to start onboarding. */
export default function JoiningFormPage() {
  const { token } = useParams<{ token: string }>();
  const mounted = useMounted();
  const invites = useInvites();
  const invite = mounted ? inviteByToken(invites, token) : undefined;
  const foot = `${ENTITY_NAME} · This page is private to you. Your details are only used for your employment record.`;

  useEffect(() => {
    if (invite?.status === 'Sent') markOpened(token);
  }, [token, invite?.status]);

  if (!mounted) return <CareersFrame title="Joining details" foot={foot}>{null}</CareersFrame>;
  if (!invite)
    return (
      <CareersFrame title="Joining details" foot={foot}>
        <div className="cr-card cr-empty">
          <h2>This link is not valid</h2>
          <p>It may be mistyped or no longer active. Please contact the HR team at {ENTITY_NAME}, who can send you a new one.</p>
        </div>
      </CareersFrame>
    );
  if (invite.status === 'Submitted')
    return (
      <CareersFrame title="Joining details" foot={foot}>
        <div className="cr-card cr-done">
          <div className="cr-done-ic" aria-hidden>
            ✓
          </div>
          <h2>Thank you, {invite.name.split(' ')[0]}</h2>
          <p>Your details were received{invite.submittedAt ? ` on ${long(invite.submittedAt)}` : ''}. Our HR team will review them and be in touch about your first day on {long(invite.joiningDate)}.</p>
        </div>
      </CareersFrame>
    );
  return <FormBody key={invite.id} invite={invite} foot={foot} />;
}

const blankEdu = (): EducationRow => ({ qualification: '', institution: '', course: '', field: '', startYear: '', endYear: '' });
const blankExp = (): ExperienceRow => ({ company: '', location: '', from: '', to: '', title: '', mode: 'Onsite' });

function FormBody({ invite, foot }: { invite: OnboardingInvite; foot: string }) {
  const india = invite.location === 'Kochi';
  const [d, setD] = useState<JoiningForm>(() => invite.data ?? blankJoiningForm());
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

  const docs = india
    ? ['Passport Copy (if you have one)', 'Passport Size Photo', 'Highest Educational Certificate', 'PAN Card', 'Aadhaar Card', 'Passbook / Bank Statement', 'Experience / Relieving Letters']
    : ['Passport Copy', 'Passport Size Photo', 'Attested Educational Certificate', 'Emirates ID (if you have one)', 'Residence Visa (if you have one)', 'Experience Letters'];

  const errors: Record<string, string> = {};
  if (!d.dob) errors.dob = 'Enter your date of birth.';
  if (!f('gender')) errors.gender = 'Choose one.';
  if (!f('nationality')) errors.nationality = 'Choose your nationality.';
  if (f('nationality') === 'Other' && !f('nationalityOther').trim()) errors.nationalityOther = 'Enter your nationality.';
  if (!f('personalMobile').trim()) errors.personalMobile = 'Enter your mobile number.';
  if (!f('currentAddress').trim()) errors.currentAddress = 'Enter your current address.';
  if (!d.emA[0]?.name.trim() || !d.emA[0]?.mobile.trim()) errors.emA = 'Add one emergency contact with a mobile number.';
  if (!f('bankName').trim() || !f('accountNumber').trim()) errors.bank = 'Enter your bank name and account number.';
  if (!d.docs['Passport Size Photo']) errors.photo = 'Attach a passport size photo.';
  if (!d.declared) errors.declared = 'Please confirm the details are correct.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(errors).length) {
      setError('Some details are missing. They are marked below.');
      document.querySelector('[aria-invalid="true"], .fm-err')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const r = submitForm(invite.token, d);
    if (!r.ok) setError(r.error);
  };

  const setRow = <T extends object>(rows: T[], i: number, patch: Partial<T>) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r));

  return (
    <CareersFrame
      wide
      title="Joining details"
      foot={foot}
      hero={
        <section className="cr-hero job">
          <div className="cr-hero-in">
            <span className="cr-eyebrow">Welcome</span>
            <h1>Complete your joining details, {invite.name.split(' ')[0]}</h1>
            <div className="cr-hero-chips">
              <span>Joining on {long(invite.joiningDate)}</span>
              <span>Please finish by {long(invite.dueDate)}</span>
              <span>About 10 minutes</span>
            </div>
          </div>
        </section>
      }
    >
      <div className="jf">
        <p className="jf-note">
          Fill in what you can now. Your answers are saved as you type, so you can close this page and come back to the same link. {savedAt && <b>Saved at {savedAt}.</b>}
        </p>
        {error && (
          <div className="tx-err" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <section className="cr-card">
          <h2>About you</h2>
          <div className="form-grid hm-form">
            <Fg label="Full name">
              <input value={invite.name} readOnly style={{ background: 'var(--bg)' }} />
            </Fg>
            <Fg label="Date of birth" required error={shown('dob')}>
              <input type="date" value={d.dob} onChange={(e) => setD({ ...d, dob: e.target.value })} />
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
            <Fg label="Personal email">
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

        <section className="cr-card">
          <h2>Identity</h2>
          <div className="form-grid hm-form">
            <Fg label="Passport number">
              <input value={f('passportNumber')} onChange={(e) => setF('passportNumber', e.target.value.toUpperCase())} autoComplete="off" />
            </Fg>
            <Fg label="Passport expiry date">
              <input type="date" value={d.passportExpiry} onChange={(e) => setD({ ...d, passportExpiry: e.target.value })} />
            </Fg>
            {india ? (
              <>
                <Fg label="Aadhaar number">
                  <input value={f('aadhaar')} onChange={(e) => setF('aadhaar', e.target.value)} inputMode="numeric" autoComplete="off" />
                </Fg>
                <Fg label="PAN">
                  <input value={f('pan')} onChange={(e) => setF('pan', e.target.value.toUpperCase())} autoComplete="off" />
                </Fg>
                <Fg label="UAN (if you have a PF account)">
                  <input value={f('uan')} onChange={(e) => setF('uan', e.target.value)} inputMode="numeric" autoComplete="off" />
                </Fg>
              </>
            ) : (
              <Fg label="Emirates ID number (if you have one)">
                <input value={f('emiratesId')} onChange={(e) => setF('emiratesId', e.target.value)} autoComplete="off" />
              </Fg>
            )}
          </div>
        </section>

        <section className="cr-card">
          <h2>Bank details</h2>
          <p className="cr-sub" style={{ marginTop: 0 }}>
            For your salary. {india ? 'Savings account in your own name.' : 'Your own account; an IBAN is preferred.'}
          </p>
          <div className="form-grid hm-form">
            <Fg label="Bank name" required error={shown('bank')}>
              <input value={f('bankName')} onChange={(e) => setF('bankName', e.target.value)} />
            </Fg>
            <Fg label={india ? 'Account number' : 'IBAN / account number'} required>
              <input value={f('accountNumber')} onChange={(e) => setF('accountNumber', e.target.value)} autoComplete="off" />
            </Fg>
            <Fg label={india ? 'IFSC code' : 'SWIFT / branch code'}>
              <input value={f('branchCode')} onChange={(e) => setF('branchCode', india ? e.target.value.toUpperCase() : e.target.value)} autoComplete="off" />
            </Fg>
          </div>
        </section>

        <section className="cr-card">
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
                <Fg label="Name" error={key === 'emA' ? shown('emA') : undefined}>
                  <input value={d[key][0]?.name ?? ''} onChange={(e) => setD({ ...d, [key]: setRow<EmergencyRow>(d[key], 0, { name: e.target.value }) })} />
                </Fg>
                <Fg label="Relationship">
                  <input value={d[key][0]?.relationship ?? ''} onChange={(e) => setD({ ...d, [key]: setRow<EmergencyRow>(d[key], 0, { relationship: e.target.value }) })} />
                </Fg>
                <Fg label="Mobile number">
                  <input type="tel" value={d[key][0]?.mobile ?? ''} onChange={(e) => setD({ ...d, [key]: setRow<EmergencyRow>(d[key], 0, { mobile: e.target.value }) })} />
                </Fg>
              </div>
            </div>
          ))}
        </section>

        <section className="cr-card">
          <h2>Education</h2>
          {d.edu.map((r, i) => (
            <div key={i} className="jf-group">
              <div className="jf-row">
                <h3>Qualification {i + 1}</h3>
                {d.edu.length > 1 && (
                  <button type="button" className="lnk" onClick={() => setD({ ...d, edu: d.edu.filter((_, n) => n !== i) })}>
                    Remove
                  </button>
                )}
              </div>
              <div className="form-grid hm-form">
                <Fg label="Qualification">
                  <input value={r.qualification} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { qualification: e.target.value }) })} placeholder="e.g. Bachelor's degree" />
                </Fg>
                <Fg label="Institution">
                  <input value={r.institution} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { institution: e.target.value }) })} />
                </Fg>
                <Fg label="Course / field of study">
                  <input value={r.course} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { course: e.target.value }) })} />
                </Fg>
                <Fg label="Start year">
                  <input value={r.startYear} inputMode="numeric" maxLength={4} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { startYear: e.target.value }) })} />
                </Fg>
                <Fg label="End year">
                  <input value={r.endYear} inputMode="numeric" maxLength={4} onChange={(e) => setD({ ...d, edu: setRow<EducationRow>(d.edu, i, { endYear: e.target.value }) })} />
                </Fg>
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => setD({ ...d, edu: [...d.edu, blankEdu()] })}>
            + Add another qualification
          </button>
        </section>

        <section className="cr-card">
          <h2>Work experience</h2>
          <p className="cr-sub" style={{ marginTop: 0 }}>
            Your previous jobs, latest first. Skip this if it is your first job.
          </p>
          {d.exp.map((r, i) => (
            <div key={i} className="jf-group">
              <div className="jf-row">
                <h3>Job {i + 1}</h3>
                <button type="button" className="lnk" onClick={() => setD({ ...d, exp: d.exp.filter((_, n) => n !== i) })}>
                  Remove
                </button>
              </div>
              <div className="form-grid hm-form">
                <Fg label="Company">
                  <input value={r.company} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { company: e.target.value }) })} />
                </Fg>
                <Fg label="Job title">
                  <input value={r.title} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { title: e.target.value }) })} />
                </Fg>
                <Fg label="From">
                  <input type="month" value={r.from} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { from: e.target.value }) })} />
                </Fg>
                <Fg label="To">
                  <input type="month" value={r.to} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { to: e.target.value }) })} />
                </Fg>
                <Fg label="City / country">
                  <input value={r.location} onChange={(e) => setD({ ...d, exp: setRow<ExperienceRow>(d.exp, i, { location: e.target.value }) })} />
                </Fg>
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => setD({ ...d, exp: [...d.exp, blankExp()] })}>
            + Add a job
          </button>
        </section>

        <section className="cr-card">
          <h2>Documents</h2>
          <p className="cr-sub" style={{ marginTop: 0 }}>
            Attach clear copies (PDF or image). Bring the originals on your first day.
          </p>
          {shown('photo') && <div className="tx-err">{shown('photo')}</div>}
          <div className="jf-docs">
            {docs.map((name) => {
              const key = name.startsWith('Passport Size Photo') ? 'Passport Size Photo' : name;
              return (
                <label key={name} className="jf-doc">
                  <span>{name}</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setD({ ...d, docs: { ...d.docs, [key]: e.target.files?.[0]?.name ?? '' } })} />
                  {d.docs[key] && <small>✓ {d.docs[key]}</small>}
                </label>
              );
            })}
          </div>
        </section>

        <section className="cr-card">
          <label className="hm-check">
            <input type="checkbox" checked={d.declared} onChange={(e) => setD({ ...d, declared: e.target.checked })} />
            <span>I confirm the details above are true and complete, and I agree to {ENTITY_NAME} storing them for my employment record.</span>
          </label>
          {shown('declared') && <div className="tx-err">{shown('declared')}</div>}
          <button type="button" className="btn primary" style={{ marginTop: 18 }} onClick={submit}>
            Submit my details
          </button>
        </section>
      </div>
    </CareersFrame>
  );
}
