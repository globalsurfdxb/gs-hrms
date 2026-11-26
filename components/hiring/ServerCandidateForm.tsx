'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Card';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Fg, TEXTAREA_STYLE, payUnit, useHiringLocation } from '@/components/hiring/HiringBits';
import { ApiError, errorMessage } from '@/lib/api';
import { can } from '@/lib/access';
import { useAuth, usePermissions } from '@/lib/auth';
import { SOURCES, Source } from '@/lib/hiringTypes';
import { EMAIL_RE } from '@/lib/options';
import { AMOUNT_RE } from '@/lib/requisitionsApi';
import { type PickPerson, type ServerJob, jobsApi } from '@/lib/jobsApi';
import { CreateCandidateBody, DuplicateCandidate, SOURCE_CODE, candidatesApi } from '@/lib/candidatesApi';

/* Add a candidate, from the backend (local development). The same form as CandidateForm in HiringForms.tsx. From a
   job page the job is fixed; from the Candidates page an open job is chosen, or — with full hiring access — none, and
   the candidate stays in the talent pool of the chosen location (without full access a job is required, BR-HIR-022).
   While the email or phone is typed, the server is asked who is already on file (only people the caller may see,
   BR-HIR-007/022); someone found can be added to the job instead. Salary fields show only to callers who may see
   salary on that job: full hiring access, its hiring manager or its recruiter. The referrer list comes from
   /hiring/people. */

const VISAS = ['Employment visa', 'Visit visa', 'Golden visa', 'Spouse / dependant visa', 'Cancelled visa', 'Needs sponsorship'];
const YEARS_RE = /^\d{1,2}(\.\d)?$/;

const blank = (locationId: string) => ({
  jobId: '',
  locationId,
  name: '',
  email: '',
  phone: '',
  currentCity: '',
  currentCompany: '',
  currentTitle: '',
  experienceYears: '',
  noticeDays: '',
  currentSalary: '',
  expectedSalary: '',
  visaStatus: '',
  source: 'LinkedIn' as Source,
  referrerId: '',
  agency: '',
  cvName: '',
  links: '',
  tags: '',
  note: '',
  consent: false,
});
type Form = ReturnType<typeof blank>;

/** `job`: add to this job (job page); otherwise one is chosen. `applied`: candidate ids already on that job.
    `onDone` gets the message to show and the candidate's id. */
export function ServerCandidateDrawer({
  open,
  job,
  applied,
  onClose,
  onDone,
}: {
  open: boolean;
  job?: ServerJob;
  applied?: Set<string>;
  onClose: () => void;
  onDone: (text: string, candidateId: string) => void;
}) {
  return open ? <CandidateForm key={job?.id ?? 'any'} preset={job} applied={applied ?? new Set()} onClose={onClose} onDone={onDone} /> : null;
}

function CandidateForm({ preset, applied, onClose, onDone }: { preset?: ServerJob; applied: Set<string>; onClose: () => void; onDone: (text: string, candidateId: string) => void }) {
  const perms = usePermissions() ?? [];
  const me = useAuth().user?.employeeId;
  const { loc, locations } = useHiringLocation();
  const [v, setV] = useState<Form>(() => blank(loc));
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [people, setPeople] = useState<PickPerson[] | null>(null);
  const [openJobs, setOpenJobs] = useState<ServerJob[] | null>(preset ? [] : null);
  const set = <K extends keyof Form>(k: K, val: Form[K]) => setV((p) => ({ ...p, [k]: val }));

  // Without a fixed job: the open jobs the caller may add to (their own unless they have full access).
  useEffect(() => {
    if (preset) return;
    let live = true;
    jobsApi
      .open()
      .then((j) => live && setOpenJobs(j))
      .catch(() => live && setOpenJobs([]));
    return () => {
      live = false;
    };
  }, [preset]);

  const full = can(perms, 'hiring:recruiting:jobs') && can(perms, 'hiring:requisitions:requisitions');
  const job = preset ?? openJobs?.find((j) => j.id === v.jobId);
  const seesPay = full || (!!me && !!job && (me === job.hiringManager.id || me === job.recruiter?.id));
  const locationId = job?.location.id ?? v.locationId;
  const cur = job?.budgetMin.currency ?? locations.find((l) => l.id === locationId)?.currency ?? 'AED';
  const india = locationId === 'Kochi';

  // Who is already on file with this email or phone, asked once the typing pauses.
  const email = v.email.trim();
  const phone = v.phone.trim();
  const dupKey = `${EMAIL_RE.test(email) ? email.toLowerCase() : ''}|${phone.replace(/\D/g, '').length >= 7 ? phone : ''}`;
  const [found, setFound] = useState<{ key: string; list: DuplicateCandidate[] }>({ key: '', list: [] });
  useEffect(() => {
    if (dupKey === '|') return;
    const [e, p] = dupKey.split('|');
    let live = true;
    const t = setTimeout(() => {
      candidatesApi
        .duplicates(e, p)
        .then((list) => live && setFound({ key: dupKey, list }))
        .catch(() => live && setFound({ key: dupKey, list: [] }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [dupKey]);
  const dups = dupKey !== '|' && found.key === dupKey ? found.list : [];

  const chooseSource = (source: Source) => {
    set('source', source);
    if (source === 'Employee Referral' && people === null) {
      jobsApi
        .people()
        .then(setPeople)
        .catch(() => setPeople([]));
    }
  };

  const tags = v.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const errors: Record<string, string> = {};
  if (!job && !full) errors.jobId = 'Choose one of your open jobs.';
  if (v.name.trim().length < 2) errors.name = 'Name is required.';
  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email)) errors.email = 'That does not look like an email address.';
  if (!phone) errors.phone = 'Phone number is required.';
  else if (phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a valid phone number.';
  if (!YEARS_RE.test(v.experienceYears.trim()) || Number(v.experienceYears) > 60) errors.experienceYears = 'Enter total experience in years (up to 60, one decimal).';
  if (v.noticeDays.trim() !== '' && !(/^\d{1,3}$/.test(v.noticeDays.trim()) && Number(v.noticeDays) <= 365)) errors.noticeDays = 'Enter whole days, up to 365.';
  if (seesPay && v.currentSalary.trim() && !AMOUNT_RE.test(v.currentSalary.trim())) errors.currentSalary = 'Enter an amount, such as 9000.';
  if (seesPay && v.expectedSalary.trim() && !AMOUNT_RE.test(v.expectedSalary.trim())) errors.expectedSalary = 'Enter an amount, such as 11000.';
  if (v.source === 'Employee Referral' && !v.referrerId) errors.referrerId = 'Choose the referring employee.';
  if (v.source === 'Agency' && !v.agency.trim()) errors.agency = 'Enter the agency name.';
  if (tags.length > 20) errors.tags = 'Use at most 20 tags.';
  else if (tags.some((t) => t.length > 40)) errors.tags = 'Keep each tag to 40 characters.';
  if (!v.consent) errors.consent = 'Confirm the candidate has consented to their data being stored.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const doneText = (name: string) => (preset ? `${name} was added to the pipeline at Applied.` : job ? `${name} was added and applied to ${job.title}.` : `${name} was added to the talent pool.`);

  const save = async () => {
    setAttempted(true);
    setServerError('');
    if (Object.keys(errors).length || dups.length || busy) return;
    const opt = (s: string) => s.trim() || undefined;
    const body: CreateCandidateBody = {
      name: v.name.trim(),
      email,
      phone,
      jobId: job?.id,
      locationId: job ? undefined : v.locationId,
      currentCity: opt(v.currentCity),
      currentCompany: opt(v.currentCompany),
      currentTitle: opt(v.currentTitle),
      experienceYears: Number(v.experienceYears),
      noticeDays: v.noticeDays.trim() === '' ? undefined : Number(v.noticeDays),
      currentSalary: seesPay ? opt(v.currentSalary) : undefined,
      expectedSalary: seesPay ? opt(v.expectedSalary) : undefined,
      visaStatus: india ? undefined : opt(v.visaStatus),
      source: SOURCE_CODE[v.source],
      referrerId: v.source === 'Employee Referral' ? v.referrerId : undefined,
      agency: v.source === 'Agency' ? v.agency.trim() : undefined,
      cvName: opt(v.cvName),
      links: opt(v.links),
      tags,
      note: opt(v.note),
      consent: v.consent,
    };
    setBusy(true);
    try {
      const c = await candidatesApi.create(body);
      onDone(doneText(c.name), c.id);
    } catch (e) {
      setServerError(errorMessage(e));
      // Saved before the check came back: show who it is (only someone the caller may see has an id).
      if (e instanceof ApiError && e.code === 'candidate.duplicate' && e.details?.candidateId) {
        const key = dupKey;
        candidatesApi
          .duplicates(email, phone)
          .then((list) => setFound({ key, list }))
          .catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  };

  const addExisting = async (c: DuplicateCandidate) => {
    if (busy || !job) return;
    setBusy(true);
    setServerError('');
    try {
      await candidatesApi.apply(c.id, job.id);
      onDone(preset ? `${c.name} was added to the pipeline at Applied.` : `${c.name} was added to ${job.title} at Applied.`, c.id);
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const referrers = (people ?? []).map((p) => ({ value: p.id, label: p.name, meta: [p.employeeCode, p.designation].filter(Boolean).join(' · ') }));

  return (
    <Drawer
      open
      onClose={onClose}
      title={preset ? `Add candidate to ${preset.title}` : 'Add candidate'}
      description="Duplicates are checked by email and phone before anything is saved."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || dups.length > 0}>
            {busy ? 'Saving…' : 'Save candidate'}
          </Button>
        </>
      }
    >
      {serverError && (
        <div className="tx-err" style={{ marginBottom: 12 }}>
          {serverError}
        </div>
      )}
      {dups.length > 0 && (
        <div className="hm-dup" role="alert">
          <b>Already in the system</b>
          {dups.map((c) => (
            <div key={c.id} className="hm-dup-row">
              <div>
                <div className="nm">{c.name}</div>
                <div className="sb">
                  {c.email} · {c.phone}
                </div>
              </div>
              <div className="hm-dup-act">
                <Link href={`/hiring/candidates/${c.id}`} className="btn sm ghost">
                  Open profile
                </Link>
                {job && applied.has(c.id) && <span className="hint">Already applied to this job</span>}
                {job && !applied.has(c.id) && (
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => addExisting(c)}>
                    Add to {job.title}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-grid hm-form">
        {!preset && (
          <Fg label="Apply to job" required={!full} error={shown('jobId')} hint={full ? 'Leave empty to keep the candidate in the talent pool.' : 'One of your open jobs.'} full>
            <select value={v.jobId} disabled={openJobs === null} onChange={(e) => set('jobId', e.target.value)}>
              <option value="">{openJobs === null ? 'Loading…' : full ? 'No job yet' : 'Choose a job…'}</option>
              {(openJobs ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} · {j.title} · {j.location.name}
                </option>
              ))}
            </select>
          </Fg>
        )}
        {!job && full && (
          <Fg label="Location" required>
            <select value={v.locationId} onChange={(e) => set('locationId', e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Fg>
        )}
        <Fg label="Full name" required error={shown('name')}>
          <input value={v.name} maxLength={120} onChange={(e) => set('name', e.target.value)} />
        </Fg>
        <Fg label="Email" required error={shown('email')}>
          <input type="email" value={v.email} maxLength={254} onChange={(e) => set('email', e.target.value)} />
        </Fg>
        <Fg label="Phone" required error={shown('phone')} hint="Include the country code.">
          <input type="tel" value={v.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} placeholder={india ? '+91 98765 43210' : '+971 50 123 4567'} />
        </Fg>
        <Fg label="Current city">
          <input value={v.currentCity} maxLength={120} onChange={(e) => set('currentCity', e.target.value)} />
        </Fg>
        <Fg label="Current company">
          <input value={v.currentCompany} maxLength={120} onChange={(e) => set('currentCompany', e.target.value)} />
        </Fg>
        <Fg label="Current title">
          <input value={v.currentTitle} maxLength={120} onChange={(e) => set('currentTitle', e.target.value)} />
        </Fg>
        <Fg label="Total experience (years)" required error={shown('experienceYears')}>
          <input type="number" min={0} max={60} step="0.5" value={v.experienceYears} onChange={(e) => set('experienceYears', e.target.value)} />
        </Fg>
        <Fg label="Notice period (days)" error={shown('noticeDays')}>
          <input type="number" min={0} max={365} value={v.noticeDays} onChange={(e) => set('noticeDays', e.target.value)} />
        </Fg>
        {seesPay && (
          <>
            <Fg label={`Current salary (${cur} ${payUnit(cur)})`} error={shown('currentSalary')}>
              <input inputMode="decimal" value={v.currentSalary} onChange={(e) => set('currentSalary', e.target.value)} />
            </Fg>
            <Fg label={`Expected salary (${cur} ${payUnit(cur)})`} error={shown('expectedSalary')}>
              <input inputMode="decimal" value={v.expectedSalary} onChange={(e) => set('expectedSalary', e.target.value)} />
            </Fg>
          </>
        )}
        {!india && (
          <Fg label="Visa / work-permit status">
            <select value={v.visaStatus} onChange={(e) => set('visaStatus', e.target.value)}>
              <option value="">Not specified</option>
              {VISAS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Fg>
        )}
        <Fg label="Source" required>
          <select value={v.source} onChange={(e) => chooseSource(e.target.value as Source)}>
            {SOURCES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Fg>
        {v.source === 'Employee Referral' && (
          <Fg label="Referred by" required error={shown('referrerId')}>
            <SearchSelect options={referrers} value={v.referrerId} onChange={(x) => set('referrerId', x)} placeholder={people === null ? 'Loading…' : 'Search employee…'} emptyText="Nobody found" />
          </Fg>
        )}
        {v.source === 'Agency' && (
          <Fg label="Agency name" required error={shown('agency')}>
            <input value={v.agency} maxLength={120} onChange={(e) => set('agency', e.target.value)} />
          </Fg>
        )}
        <Fg label="CV" hint={v.cvName ? 'Only the file name is kept for now.' : 'PDF or Word file.'}>
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => set('cvName', e.target.files?.[0]?.name ?? '')} />
        </Fg>
        <Fg label="LinkedIn / portfolio">
          <input value={v.links} maxLength={500} onChange={(e) => set('links', e.target.value)} placeholder="linkedin.com/in/…" />
        </Fg>
        <Fg label="Tags" hint="Separate with commas." error={shown('tags')} full>
          <input value={v.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Shortlisted, Fortinet NSE4" />
        </Fg>
        <Fg label="Notes" full>
          <textarea rows={3} value={v.note} maxLength={2000} onChange={(e) => set('note', e.target.value)} style={TEXTAREA_STYLE} />
        </Fg>
        <Fg label="Data consent" error={shown('consent')} full>
          <label className="hm-check">
            <input type="checkbox" checked={v.consent} onChange={(e) => set('consent', e.target.checked)} /> The candidate has consented to Global Surf IT storing and processing their data for recruitment. The date is recorded.
          </label>
        </Fg>
      </div>
    </Drawer>
  );
}
