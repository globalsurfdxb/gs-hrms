'use client';

import { DateField } from '@/components/ui/DateField';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { Department } from '@/lib/types';
import { EMPLOYEES } from '@/lib/data';
import { addDays, todayISO } from '@/lib/dates';
import { EMAIL_RE } from '@/lib/options';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Card';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { XIcon } from '@/components/icons';
import { Fg, TEXTAREA_STYLE, TZ_LABEL, empName, money, payUnit, useActor, useHiringLocation } from '@/components/hiring/HiringBits';
import { canSeeSalary, hiringLevel, teamLeadScope } from '@/lib/hiringAccess';
import { sandboxTeamsLink, useHiringMail } from '@/lib/hiringMail';
import { useApp } from '@/context/AppContext';
import {
  RequisitionInput,
  addCandidate,
  appById,
  applyToJob,
  candById,
  createJob,
  createOffer,
  createRequisition,
  findDuplicates,
  interviewsForApp,
  jobById,
  recruiterIdOf,
  setJobRecruiter,
  panelClashes,
  rescheduleInterview,
  scheduleInterview,
  submitRequisition,
  updateRequisition,
  useHiring,
} from '@/lib/hiringStore';
import {
  Application,
  Candidate,
  EMPLOYMENT_KINDS,
  EmploymentKind,
  INDIA_OFFER_LINES,
  INTERVIEW_MODES,
  INTERVIEW_ROUNDS,
  InterviewMode,
  Interview,
  Job,
  Requisition,
  REQUISITION_REASONS,
  Stage,
  RequisitionReason,
  SOURCES,
  Source,
  UAE_OFFER_LINES,
} from '@/lib/hiringTypes';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const people = () => EMPLOYEES.filter((e) => e.employmentStatus === 'Active').map((e) => ({ value: e.id, label: e.name, meta: e.employeeCode }));

/** Picks several employees: a search box to add, chips to remove. */
export function PanelPicker({ value, onChange, label = 'Add panel member…' }: { value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const options = useMemo(() => people().filter((p) => !value.includes(p.value)), [value]);
  return (
    <div>
      <SearchSelect options={options} value="" onChange={(v) => v && onChange([...value, v])} placeholder={label} emptyText="Everyone is already added" />
      {value.length > 0 && (
        <div className="hm-chips">
          {value.map((id) => (
            <span key={id} className="hm-chip">
              {empName(id)}
              <button type="button" aria-label={`Remove ${empName(id)}`} onClick={() => onChange(value.filter((x) => x !== id))}>
                <XIcon />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- requisition */

export function RequisitionDrawer({ open, onClose, edit, onDone }: { open: boolean; onClose: () => void; edit?: Requisition; onDone: (r: Requisition, submitted: boolean) => void }) {
  const { loc } = useHiringLocation();
  const { role } = useApp();
  const me = useCurrentEmployee();
  const actor = useActor();
  const { companies, departments, designations, locations, locationDef } = useOrg();
  // A Team Lead can ask only for their own team, so the company, department and location are fixed to theirs.
  const scope = role === 'Team Lead' ? teamLeadScope(me, companies, departments).departments : undefined;
  const first = scope?.[0];
  const where = first ? (first.locations.includes(me.location) ? me.location : (first.locations[0] ?? me.location)) : scope ? me.location : loc;
  const blank = (): RequisitionInput => ({
    title: '',
    companyId: first?.companyId ?? '',
    departmentId: first?.id ?? '',
    department: first?.name ?? '',
    location: where,
    positions: 1,
    employmentType: 'Full-time',
    reason: 'New role',
    budgetMin: NaN,
    budgetMax: NaN,
    currency: locationDef(where)?.currency ?? 'AED',
    targetStart: '',
    hiringManagerId: role === 'Team Lead' ? me.id : '',
    justification: '',
  });
  return open ? <RequisitionForm key={edit?.id ?? 'new'} {...{ onClose, edit, onDone, blank, actor, companies, departments, designations, locations, locationDef }} scope={scope} /> : null;
}

function RequisitionForm({
  onClose,
  edit,
  onDone,
  blank,
  actor,
  companies,
  departments,
  designations,
  locations,
  locationDef,
  scope,
}: {
  onClose: () => void;
  edit?: Requisition;
  onDone: (r: Requisition, submitted: boolean) => void;
  blank: () => RequisitionInput;
  actor: ReturnType<typeof useActor>;
  companies: ReturnType<typeof useOrg>['companies'];
  departments: ReturnType<typeof useOrg>['departments'];
  designations: ReturnType<typeof useOrg>['designations'];
  locations: ReturnType<typeof useOrg>['locations'];
  locationDef: ReturnType<typeof useOrg>['locationDef'];
  /** A Team Lead's departments (their own and any they head); undefined for everyone else. */
  scope?: Department[];
}) {
  const locked = !!scope;
  const [v, setV] = useState<RequisitionInput>(() => (edit ? { ...edit } : blank()));
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof RequisitionInput>(k: K, val: RequisitionInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const cur = locationDef(v.location)?.currency ?? 'AED';

  // Every active company can hire in either location. Departments that already operate in the location come first;
  // a company with none there shows all of its departments rather than an empty list.
  const cos = companies.filter((c) => c.status === 'Active');
  const ofCompany = departments.filter((d) => d.companyId === v.companyId);
  const inLocation = ofCompany.filter((d) => d.locations.includes(v.location));
  const depts = inLocation.length ? inLocation : ofCompany;
  const desigs = designations.filter((d) => d.departmentId === v.departmentId);
  const today = todayISO();

  const errors: Record<string, string> = {};
  if (!v.title.trim()) errors.title = 'Job title is required.';
  if (desigs.length && !v.designationTitle) errors.designationTitle = 'Choose a designation.';
  if (!v.companyId) errors.companyId = locked ? 'Your company is not set up under Administration → Companies.' : 'Choose a company.';
  if (!v.departmentId) errors.departmentId = locked && !scope?.length ? 'Your department is not set up under Administration → Departments & Designations.' : 'Choose a department.';
  if (!(v.positions >= 1) || !Number.isInteger(v.positions)) errors.positions = 'Enter 1 or more positions.';
  if (v.reason === 'Replacement' && !v.replacesId) errors.replacesId = 'Choose the employee being replaced.';
  if (!(v.budgetMin > 0)) errors.budgetMin = 'Enter the minimum.';
  if (!(v.budgetMax > 0)) errors.budgetMax = 'Enter the maximum.';
  else if (v.budgetMin > v.budgetMax) errors.budgetMax = 'Maximum is below the minimum.';
  if (!v.targetStart) errors.targetStart = 'Choose a target start date.';
  else if (v.targetStart < today) errors.targetStart = 'The start date is in the past.';
  if (!v.hiringManagerId) errors.hiringManagerId = 'Choose the hiring manager.';
  if (!v.justification.trim()) errors.justification = 'Add a short justification for approvers.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  // The designation belongs to a department, so it goes when the department does. A title that was only filled from it goes too.
  const dropDesignation = (p: RequisitionInput) => ({ designationTitle: undefined, title: p.designationTitle && p.title === p.designationTitle ? '' : p.title });

  const me = useCurrentEmployee();

  // A Team Lead's departments. One the requisition already sits in (raised for them by HR) stays choosable.
  const inScope = scope ?? [];
  const current = departments.find((d) => d.id === v.departmentId);
  const scopeDepts = current && !inScope.some((d) => d.id === current.id) ? [...inScope, current] : inScope;
  const pickedDept = scopeDepts.find((d) => d.id === v.departmentId);
  const multiLocation = (pickedDept?.locations.length ?? 0) > 1;
  const companyName = companies.find((c) => c.id === v.companyId)?.name ?? '';
  const pickScoped = (id: string) => {
    const d = scopeDepts.find((x) => x.id === id);
    const loc = d ? (d.locations.includes(v.location) ? v.location : d.locations.includes(me.location) ? me.location : (d.locations[0] ?? v.location)) : v.location;
    setV((p) => ({ ...p, departmentId: id, department: d?.name ?? '', companyId: d?.companyId ?? '', location: loc, currency: locationDef(loc)?.currency ?? p.currency, ...dropDesignation(p) }));
  };

  const changeLocation = (id: string) => {
    // The company stays; the department stays only if it is one the company runs in the new location.
    const d = departments.find((x) => x.id === v.departmentId);
    const keepDept = !!d && d.locations.includes(id);
    setV((p) => ({ ...p, location: id, currency: locationDef(id)?.currency ?? p.currency, departmentId: keepDept ? p.departmentId : '', department: keepDept ? p.department : '', ...(keepDept ? {} : dropDesignation(p)) }));
  };

  const save = (submit: boolean) => {
    setAttempted(true);
    if (Object.keys(errors).length) return;
    const input: RequisitionInput = { ...v, title: v.title.trim(), currency: cur, justification: v.justification.trim(), replacesId: v.reason === 'Replacement' ? v.replacesId : undefined };
    if (edit) {
      updateRequisition(edit.id, input, actor);
      if (submit) {
        const r = submitRequisition(edit.id, actor);
        if (r.ok) return onDone(r.requisition, true);
      }
      return onDone({ ...edit, ...input }, false);
    }
    onDone(createRequisition(input, actor, submit), submit);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      title={edit ? `Edit ${edit.code}` : 'New requisition'}
      description="Ask for headcount. It goes Hiring Manager → HR → Management before a job can be opened."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save(false)}>Save draft</Button>
          <Button variant="primary" onClick={() => save(true)}>
            Submit for approval
          </Button>
        </>
      }
    >
      <div className="form-grid hm-form">
        {locked ? (
          scopeDepts.length > 1 ? (
            <>
              <Fg label="Department" required error={shown('departmentId')} hint={`${companyName} · Hiring manager: ${empName(v.hiringManagerId)}`} full={!multiLocation}>
                <select value={v.departmentId} onChange={(e) => pickScoped(e.target.value)}>
                  <option value="">Select…</option>
                  {scopeDepts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {companies.find((c) => c.id === d.companyId)?.name}
                    </option>
                  ))}
                </select>
              </Fg>
              {multiLocation && (
                <Fg label="Location" required>
                  <select value={v.location} onChange={(e) => changeLocation(e.target.value)}>
                    {locations.filter((l) => pickedDept?.locations.includes(l.id)).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Fg>
              )}
            </>
          ) : (
            <Fg label="Requesting for" error={shown('companyId') ?? shown('departmentId')} hint="You can ask for headcount in your own team only." full>
              <div className="hm-scope">
                <strong>{companyName || '—'}</strong>
                <span>{v.department || '—'}</span>
                <span>{locationDef(v.location)?.name ?? v.location}</span>
                <span>Hiring manager: {empName(v.hiringManagerId)}</span>
              </div>
            </Fg>
          )
        ) : (
          <>
            <Fg label="Location" required>
              <select value={v.location} onChange={(e) => changeLocation(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Fg>
            <Fg label="Company" required error={shown('companyId')}>
              <select value={v.companyId} onChange={(e) => setV((p) => ({ ...p, companyId: e.target.value, departmentId: '', department: '', ...dropDesignation(p) }))}>
                <option value="">Select…</option>
                {cos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Fg>
            <Fg label="Department" required error={shown('departmentId')}>
              <select
                value={v.departmentId}
                disabled={!v.companyId}
                onChange={(e) => {
                  const d = depts.find((x) => x.id === e.target.value);
                  setV((p) => ({ ...p, departmentId: e.target.value, department: d?.name ?? '', ...dropDesignation(p) }));
                }}
              >
                <option value="">{v.companyId ? 'Select…' : 'Choose a company first'}</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Fg>
          </>
        )}
        <Fg label="Designation" required={desigs.length > 0} error={shown('designationTitle')} hint="The grade. It carries through to the job and onboarding." full={locked}>
          <select
            value={v.designationTitle ?? ''}
            disabled={!v.departmentId || !desigs.length}
            onChange={(e) => {
              const t = e.target.value;
              // The job title follows the designation until it has been typed by hand.
              setV((p) => ({ ...p, designationTitle: t || undefined, title: !p.title.trim() || p.title === p.designationTitle ? t : p.title }));
            }}
          >
            <option value="">{!v.departmentId ? 'Choose a department first' : desigs.length ? 'Select…' : 'No designations in this department'}</option>
            {desigs.map((d) => (
              <option key={d.id} value={d.title}>
                {d.title}
              </option>
            ))}
          </select>
        </Fg>
        <Fg label="Job title" required error={shown('title')} hint="Shown on the careers page. Fills from the designation; edit it if the advert should read differently." full>
          <input value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Network Engineer" />
        </Fg>
        <Fg label="Number of positions" required error={shown('positions')}>
          <input type="number" min={1} value={Number.isNaN(v.positions) ? '' : v.positions} onChange={(e) => set('positions', num(e.target.value))} />
        </Fg>
        <Fg label="Employment type" required>
          <select value={v.employmentType} onChange={(e) => set('employmentType', e.target.value as EmploymentKind)}>
            {EMPLOYMENT_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Fg>
        <Fg label="Reason" required>
          <select value={v.reason} onChange={(e) => set('reason', e.target.value as RequisitionReason)}>
            {REQUISITION_REASONS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Fg>
        <Fg label="Target start date" required error={shown('targetStart')}>
          <DateField value={v.targetStart} min={today} onChange={(e) => set('targetStart', e.target.value)} />
        </Fg>
        {v.reason === 'Replacement' && (
          <Fg label="Employee being replaced" required error={shown('replacesId')} full>
            <SearchSelect
              options={EMPLOYEES.map((e) => ({ value: e.id, label: e.name, meta: `${e.employeeCode} · ${e.designation}` }))}
              value={v.replacesId ?? ''}
              onChange={(x) => set('replacesId', x)}
              placeholder="Search employee…"
            />
          </Fg>
        )}
        {!locked && (
          <Fg label="Hiring manager" required error={shown('hiringManagerId')} full>
            <SearchSelect options={people()} value={v.hiringManagerId} onChange={(x) => set('hiringManagerId', x)} placeholder="Search employee…" />
          </Fg>
        )}
        <Fg label={`Budget min (${cur} ${payUnit(cur)})`} required error={shown('budgetMin')}>
          <input type="number" min={0} value={Number.isNaN(v.budgetMin) ? '' : v.budgetMin} onChange={(e) => set('budgetMin', num(e.target.value))} />
        </Fg>
        <Fg label={`Budget max (${cur} ${payUnit(cur)})`} required error={shown('budgetMax')}>
          <input type="number" min={0} value={Number.isNaN(v.budgetMax) ? '' : v.budgetMax} onChange={(e) => set('budgetMax', num(e.target.value))} />
        </Fg>
        <Fg label="Justification" required error={shown('justification')} full>
          <textarea rows={4} value={v.justification} onChange={(e) => set('justification', e.target.value)} placeholder="Why is this headcount needed?" style={TEXTAREA_STYLE} />
        </Fg>
      </div>
    </Drawer>
  );
}

/* ---------------------------------------------------------------------- job */

export function JobDrawer({ requisition, onClose, onDone }: { requisition: Requisition | null; onClose: () => void; onDone: (j: Job) => void }) {
  return requisition ? <JobForm key={requisition.id} requisition={requisition} onClose={onClose} onDone={onDone} /> : null;
}

function JobForm({ requisition, onClose, onDone }: { requisition: Requisition; onClose: () => void; onDone: (j: Job) => void }) {
  const actor = useActor();
  const { role } = useApp();
  const { designations } = useOrg();
  const desigs = designations.filter((d) => d.departmentId === requisition.departmentId).map((d) => d.title);
  const [v, setV] = useState({
    designationTitle: requisition.designationTitle && desigs.includes(requisition.designationTitle) ? requisition.designationTitle : desigs.includes(requisition.title) ? requisition.title : (desigs[0] ?? requisition.title),
    description: '',
    skills: '',
    expMin: '2',
    expMax: '6',
    qualifications: '',
    panelIds: [requisition.hiringManagerId],
    recruiterId: role === 'HR' || role === 'Office Admin' ? actor.id : '',
    referralEligible: true,
    closingDate: addDays(todayISO(), 30),
    publish: true,
  });
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  const errors: Record<string, string> = {};
  if (!v.description.trim()) errors.description = 'Add a job description.';
  if (!v.skills.trim()) errors.skills = 'List at least one key skill.';
  if (!(num(v.expMin) >= 0)) errors.expMin = 'Enter the minimum years.';
  if (!(num(v.expMax) >= num(v.expMin))) errors.expMax = 'Maximum is below the minimum.';
  if (!v.recruiterId) errors.recruiterId = 'Choose the recruiter who will run this job.';
  if (!v.panelIds.length) errors.panelIds = 'Add at least one interviewer.';
  if (!v.closingDate) errors.closingDate = 'Choose a closing date.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(errors).length) return;
    const res = createJob(
      requisition.id,
      {
        designationTitle: v.designationTitle,
        description: v.description.trim(),
        skills: v.skills.split(',').map((s) => s.trim()).filter(Boolean),
        expMin: num(v.expMin),
        expMax: num(v.expMax),
        qualifications: v.qualifications.trim(),
        panelIds: v.panelIds,
        recruiterId: v.recruiterId,
        referralEligible: v.referralEligible,
        closingDate: v.closingDate,
        publish: v.publish,
      },
      actor,
    );
    if (!res.ok) return setError(res.error);
    onDone(res.job);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Create job from ${requisition.code}`}
      description={`${requisition.title} · ${requisition.department} · ${requisition.positions} position${requisition.positions === 1 ? '' : 's'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {v.publish ? 'Create and open job' : 'Save as draft'}
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
        <Fg label="Designation" hint="Used to prefill onboarding for the hire." full>
          {desigs.length ? (
            <select value={v.designationTitle} onChange={(e) => set('designationTitle', e.target.value)}>
              {desigs.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          ) : (
            <input value={v.designationTitle} onChange={(e) => set('designationTitle', e.target.value)} />
          )}
        </Fg>
        <Fg label="Job description" required error={shown('description')} full hint="One responsibility per line.">
          <textarea rows={6} value={v.description} onChange={(e) => set('description', e.target.value)} style={TEXTAREA_STYLE} />
        </Fg>
        <Fg label="Key skills" required error={shown('skills')} hint="Separate with commas." full>
          <input value={v.skills} onChange={(e) => set('skills', e.target.value)} placeholder="Cisco, Fortinet, SD-WAN" />
        </Fg>
        <Fg label="Experience from (years)" required error={shown('expMin')}>
          <input type="number" min={0} value={v.expMin} onChange={(e) => set('expMin', e.target.value)} />
        </Fg>
        <Fg label="Experience to (years)" required error={shown('expMax')}>
          <input type="number" min={0} value={v.expMax} onChange={(e) => set('expMax', e.target.value)} />
        </Fg>
        <Fg label="Qualifications" full>
          <input value={v.qualifications} onChange={(e) => set('qualifications', e.target.value)} placeholder="e.g. CCNA or higher" />
        </Fg>
        <Fg label="Recruiter" required error={shown('recruiterId')} hint="Runs this job: screening, scheduling and offers. Reports can be filtered by recruiter." full>
          <SearchSelect options={people()} value={v.recruiterId} onChange={(x) => set('recruiterId', x)} placeholder="Search employee…" />
        </Fg>
        <Fg label="Interview panel" required error={shown('panelIds')} full>
          <PanelPicker value={v.panelIds} onChange={(x) => set('panelIds', x)} />
        </Fg>
        <Fg label="Closing date" required error={shown('closingDate')}>
          <DateField value={v.closingDate} onChange={(e) => set('closingDate', e.target.value)} />
        </Fg>
        <div className="fg hm-checks">
          <label className="hm-check">
            <input type="checkbox" checked={v.referralEligible} onChange={(e) => set('referralEligible', e.target.checked)} /> Open to employee referrals
          </label>
          <label className="hm-check">
            <input type="checkbox" checked={v.publish} onChange={(e) => set('publish', e.target.checked)} /> Open for applications now
          </label>
        </div>
      </div>
    </Drawer>
  );
}

/** Changes who recruits for a job. */
export function RecruiterDrawer({ job, onClose, onDone }: { job: Job | null; onClose: () => void; onDone: (text: string) => void }) {
  return job ? <RecruiterForm key={job.id} job={job} onClose={onClose} onDone={onDone} /> : null;
}

function RecruiterForm({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: (text: string) => void }) {
  const actor = useActor();
  const [who, setWho] = useState(recruiterIdOf(job) ?? '');
  const [error, setError] = useState('');
  return (
    <Drawer
      open
      onClose={onClose}
      title="Change recruiter"
      description={`${job.code} · ${job.title}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!who) return setError('Choose a recruiter.');
              const r = setJobRecruiter(job.id, who, actor);
              if (!r.ok) return setError(r.error);
              onDone(`${job.code} is now recruited by ${empName(who)}.`);
            }}
          >
            Save
          </Button>
        </>
      }
    >
      {error && <div className="tx-err" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid hm-form">
        <Fg label="Recruiter" required full>
          <SearchSelect options={people()} value={who} onChange={setWho} placeholder="Search employee…" />
        </Fg>
      </div>
    </Drawer>
  );
}

/* ---------------------------------------------------------------------- candidate */

const blankCandidate = (location: string, currency: string) => ({
  name: '',
  email: '',
  phone: '',
  location,
  currentCity: '',
  currentCompany: '',
  currentTitle: '',
  experienceYears: '',
  noticeDays: '',
  currentSalary: '',
  expectedSalary: '',
  currency,
  visaStatus: '',
  source: 'LinkedIn' as Source,
  referrerId: '',
  agency: '',
  cvName: '',
  links: '',
  tags: '',
  note: '',
  consent: false,
  jobId: '',
});

export function CandidateDrawer({ open, onClose, job, onDone }: { open: boolean; onClose: () => void; job?: Job; onDone: (c: Candidate, application?: Application) => void }) {
  return open ? <CandidateForm key={job?.id ?? 'any'} job={job} onClose={onClose} onDone={onDone} /> : null;
}

function CandidateForm({ job, onClose, onDone }: { job?: Job; onClose: () => void; onDone: (c: Candidate, application?: Application) => void }) {
  const s = useHiring();
  const actor = useActor();
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { loc, currency } = useHiringLocation();
  const { locationDef } = useOrg();
  const level = hiringLevel(role);
  const [v, setV] = useState(() => ({ ...blankCandidate(job?.location ?? loc, job?.currency ?? currency), jobId: job?.id ?? '' }));
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  const openJobs = s.jobs.filter((j) => j.status === 'Open' && (level === 'full' || j.hiringManagerId === me.id));
  const chosenJob = job ?? jobById(s, v.jobId);
  const cur = chosenJob?.currency ?? locationDef(v.location)?.currency ?? currency;
  const seesPay = level === 'full' || (!!chosenJob && canSeeSalary(level, me.id, chosenJob.hiringManagerId));
  const dups = findDuplicates(s, v.email, v.phone);
  const alreadyApplied = (c: Candidate) => !!chosenJob && s.applications.some((a) => a.candidateId === c.id && a.jobId === chosenJob.id);

  const errors: Record<string, string> = {};
  if (!v.name.trim()) errors.name = 'Name is required.';
  if (!v.email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(v.email.trim())) errors.email = 'That does not look like an email address.';
  if (!v.phone.trim()) errors.phone = 'Phone number is required.';
  else if (v.phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a valid phone number.';
  if (v.experienceYears === '' || !(num(v.experienceYears) >= 0)) errors.experienceYears = 'Enter total experience in years.';
  if (v.source === 'Employee Referral' && !v.referrerId) errors.referrerId = 'Choose the referring employee.';
  if (v.source === 'Agency' && !v.agency.trim()) errors.agency = 'Enter the agency name.';
  if (!v.consent) errors.consent = 'Confirm the candidate has consented to their data being stored.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const save = () => {
    setAttempted(true);
    if (Object.keys(errors).length || dups.length) return;
    const res = addCandidate(
      {
        name: v.name,
        email: v.email,
        phone: v.phone.trim(),
        location: chosenJob?.location ?? v.location,
        currentCity: v.currentCity.trim(),
        currentCompany: v.currentCompany.trim(),
        currentTitle: v.currentTitle.trim(),
        experienceYears: num(v.experienceYears),
        noticeDays: v.noticeDays === '' ? 0 : num(v.noticeDays),
        currentSalary: seesPay && v.currentSalary !== '' ? num(v.currentSalary) : undefined,
        expectedSalary: seesPay && v.expectedSalary !== '' ? num(v.expectedSalary) : undefined,
        currency: cur,
        visaStatus: v.visaStatus.trim(),
        source: v.source,
        referrerId: v.source === 'Employee Referral' ? v.referrerId : undefined,
        agency: v.source === 'Agency' ? v.agency.trim() : undefined,
        cvName: v.cvName || undefined,
        links: v.links.trim(),
        tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean),
        note: v.note,
        consent: v.consent,
      },
      chosenJob?.id ?? null,
      actor,
    );
    if (!res.ok) return setError(res.error);
    onDone(res.candidate, res.application);
  };

  const addExisting = (c: Candidate) => {
    if (!chosenJob) return;
    const res = applyToJob(c.id, chosenJob.id, actor);
    if (!res.ok) return setError(res.error);
    onDone(c, res.application);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={job ? `Add candidate to ${job.title}` : 'Add candidate'}
      description="Duplicates are checked by email and phone before anything is saved."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={dups.length > 0}>
            Save candidate
          </Button>
        </>
      }
    >
      {error && <div className="tx-err" style={{ marginBottom: 12 }}>{error}</div>}
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
                {chosenJob && !alreadyApplied(c) && (
                  <Button size="sm" variant="primary" onClick={() => addExisting(c)}>
                    Add to {chosenJob.title}
                  </Button>
                )}
                {chosenJob && alreadyApplied(c) && <span className="hint">Already applied to this job</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-grid hm-form">
        {!job && (
          <Fg label="Apply to job" hint="Leave empty to keep the candidate in the talent pool." full>
            <select
              value={v.jobId}
              onChange={(e) => {
                const j = jobById(s, e.target.value);
                setV((p) => ({ ...p, jobId: e.target.value, location: j?.location ?? p.location, currency: j?.currency ?? p.currency }));
              }}
            >
              <option value="">No job yet</option>
              {openJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} · {j.title} · {j.location}
                </option>
              ))}
            </select>
          </Fg>
        )}
        {!chosenJob && (
          <Fg label="Location" required>
            <select value={v.location} onChange={(e) => set('location', e.target.value)}>
              <option value="Dubai">United Arab Emirates</option>
              <option value="Kochi">India</option>
            </select>
          </Fg>
        )}
        <Fg label="Full name" required error={shown('name')}>
          <input value={v.name} onChange={(e) => set('name', e.target.value)} />
        </Fg>
        <Fg label="Email" required error={shown('email')}>
          <input type="email" value={v.email} onChange={(e) => set('email', e.target.value)} />
        </Fg>
        <Fg label="Phone" required error={shown('phone')} hint="Include the country code.">
          <input type="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder={(chosenJob?.location ?? v.location) === 'Kochi' ? '+91 98765 43210' : '+971 50 123 4567'} />
        </Fg>
        <Fg label="Current city">
          <input value={v.currentCity} onChange={(e) => set('currentCity', e.target.value)} />
        </Fg>
        <Fg label="Current company">
          <input value={v.currentCompany} onChange={(e) => set('currentCompany', e.target.value)} />
        </Fg>
        <Fg label="Current title">
          <input value={v.currentTitle} onChange={(e) => set('currentTitle', e.target.value)} />
        </Fg>
        <Fg label="Total experience (years)" required error={shown('experienceYears')}>
          <input type="number" min={0} step="0.5" value={v.experienceYears} onChange={(e) => set('experienceYears', e.target.value)} />
        </Fg>
        <Fg label="Notice period (days)">
          <input type="number" min={0} value={v.noticeDays} onChange={(e) => set('noticeDays', e.target.value)} />
        </Fg>
        {seesPay && (
          <>
            <Fg label={`Current salary (${cur} ${payUnit(cur)})`}>
              <input type="number" min={0} value={v.currentSalary} onChange={(e) => set('currentSalary', e.target.value)} />
            </Fg>
            <Fg label={`Expected salary (${cur} ${payUnit(cur)})`}>
              <input type="number" min={0} value={v.expectedSalary} onChange={(e) => set('expectedSalary', e.target.value)} />
            </Fg>
          </>
        )}
        {(chosenJob?.location ?? v.location) !== 'Kochi' && (
          <Fg label="Visa / work-permit status">
            <select value={v.visaStatus} onChange={(e) => set('visaStatus', e.target.value)}>
              <option value="">Not specified</option>
              {['Employment visa', 'Visit visa', 'Golden visa', 'Spouse / dependant visa', 'Cancelled visa', 'Needs sponsorship'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Fg>
        )}
        <Fg label="Source" required>
          <select value={v.source} onChange={(e) => set('source', e.target.value as Source)}>
            {SOURCES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Fg>
        {v.source === 'Employee Referral' && (
          <Fg label="Referred by" required error={shown('referrerId')}>
            <SearchSelect options={people()} value={v.referrerId} onChange={(x) => set('referrerId', x)} placeholder="Search employee…" />
          </Fg>
        )}
        {v.source === 'Agency' && (
          <Fg label="Agency name" required error={shown('agency')}>
            <input value={v.agency} onChange={(e) => set('agency', e.target.value)} />
          </Fg>
        )}
        <Fg label="CV" hint={v.cvName ? undefined : 'PDF or Word file.'}>
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => set('cvName', e.target.files?.[0]?.name ?? '')} />
        </Fg>
        <Fg label="LinkedIn / portfolio">
          <input value={v.links} onChange={(e) => set('links', e.target.value)} placeholder="linkedin.com/in/…" />
        </Fg>
        <Fg label="Tags" hint="Separate with commas." full>
          <input value={v.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Shortlisted, Fortinet NSE4" />
        </Fg>
        <Fg label="Notes" full>
          <textarea rows={3} value={v.note} onChange={(e) => set('note', e.target.value)} style={TEXTAREA_STYLE} />
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

/* ---------------------------------------------------------------------- interview */

export function InterviewDrawer({ open, onClose, application, interview, onDone }: { open: boolean; onClose: () => void; application?: Application; interview?: Interview; onDone: (i: Interview, rescheduled: boolean) => void }) {
  return open ? <InterviewForm key={interview?.id ?? application?.id ?? 'new'} application={application} interview={interview} onClose={onClose} onDone={onDone} /> : null;
}

function InterviewForm({ application, interview, onClose, onDone }: { application?: Application; interview?: Interview; onClose: () => void; onDone: (i: Interview, rescheduled: boolean) => void }) {
  const s = useHiring();
  const actor = useActor();
  const { loc } = useHiringLocation();
  const { role } = useApp();
  const me = useCurrentEmployee();
  const level = hiringLevel(role);
  const fixed = application ?? (interview ? appById(s, interview.applicationId) : undefined);

  // Candidates at the Offer stage already have their interviews; those waiting for one come first.
  const WAITING: Stage[] = ['Screening', 'Technical Interview', 'HR Interview'];
  const booked = (id: string) => interviewsForApp(s, id).some((i) => i.status === 'Scheduled');
  const apps = s.applications
    .filter((a) => !a.exit && a.stage !== 'Hired' && a.stage !== 'Offer' && a.location === loc && (level === 'full' || jobById(s, a.jobId)?.hiringManagerId === me.id))
    .sort((a, b) => Number(WAITING.includes(b.stage) && !booked(b.id)) - Number(WAITING.includes(a.stage) && !booked(a.id)) || WAITING.indexOf(b.stage) - WAITING.indexOf(a.stage));
  const [appId, setAppId] = useState(fixed?.id ?? '');
  const app = appById(s, appId);
  const [v, setV] = useState({
    round: interview?.round ?? (app?.stage === 'HR Interview' ? 'HR Interview' : 'Technical Interview'),
    date: interview?.date ?? addDays(todayISO(), 1),
    time: interview?.time ?? '10:00',
    durationMin: String(interview?.durationMin ?? 60),
    mode: (interview?.mode ?? 'Teams') as InterviewMode,
    panelIds: interview?.panelIds ?? (app ? (jobById(s, app.jobId)?.panelIds ?? []) : []),
    link: interview?.link ?? '',
    notes: interview?.notes ?? '',
  });
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  const mail = useHiringMail();
  const teamsOn = mail.settings.teams.connected && mail.settings.teams.createLinks;
  const clashes = panelClashes(s, v, interview?.id);
  const errors: Record<string, string> = {};
  if (!appId) errors.app = 'Choose a candidate.';
  if (!v.date) errors.date = 'Choose a date.';
  else if (v.date < todayISO() && !interview) errors.date = 'The date is in the past.';
  if (!v.time) errors.time = 'Choose a time.';
  if (!v.panelIds.length) errors.panelIds = 'Add at least one panel member.';
  if (v.link.trim() && !/^https?:\/\//i.test(v.link.trim())) errors.link = 'Enter a full link starting with https://';
  const shown = (k: string) => (attempted ? errors[k] : undefined);
  const cand = app ? candById(s, app.candidateId) : undefined;
  const job = app ? jobById(s, app.jobId) : undefined;

  const save = () => {
    setAttempted(true);
    if (Object.keys(errors).length) return;
    const body = { date: v.date, time: v.time, durationMin: Number(v.durationMin), mode: v.mode, panelIds: v.panelIds, link: v.link.trim() };
    if (interview) {
      const r = rescheduleInterview(interview.id, body, actor);
      if (!r.ok) return setError(r.error);
      return onDone({ ...interview, ...body }, true);
    }
    const r = scheduleInterview({ applicationId: appId, round: v.round, notes: v.notes, ...body }, actor);
    if (!r.ok) return setError(r.error);
    onDone(r.interview, false);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={interview ? 'Reschedule interview' : 'Schedule interview'}
      description={cand && job ? `${cand.name} · ${job.title}` : 'Pick the candidate, round and panel.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {interview ? 'Save new time' : 'Schedule'}
          </Button>
        </>
      }
    >
      {error && <div className="tx-err" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid hm-form">
        <Fg label="Candidate" required error={shown('app')} full>
          {fixed ? (
            <input value={`${cand?.name ?? ''} · ${job?.title ?? ''}`} readOnly style={{ background: 'var(--bg)' }} />
          ) : (
            <SearchSelect
              options={apps.map((a) => ({
                value: a.id,
                label: candById(s, a.candidateId)?.name ?? 'Candidate',
                meta: `${jobById(s, a.jobId)?.title ?? ''} · ${a.stage}${booked(a.id) ? ' · interview booked' : ''}`,
              }))}
              value={appId}
              onChange={(id) => {
                setAppId(id);
                const a = appById(s, id);
                if (a) setV((p) => ({ ...p, panelIds: jobById(s, a.jobId)?.panelIds ?? p.panelIds, round: a.stage === 'HR Interview' ? 'HR Interview' : 'Technical Interview' }));
              }}
              placeholder="Search candidate or job…"
              emptyText="No candidate is waiting for an interview"
            />
          )}
        </Fg>
        <Fg label="Round" required>
          <select value={v.round} disabled={!!interview} onChange={(e) => set('round', e.target.value)}>
            {INTERVIEW_ROUNDS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Fg>
        <Fg label="Mode" required>
          <select value={v.mode} onChange={(e) => set('mode', e.target.value as InterviewMode)}>
            {INTERVIEW_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Fg>
        <Fg label="Date" required error={shown('date')}>
          <DateField value={v.date} min={interview ? undefined : todayISO()} onChange={(e) => set('date', e.target.value)} />
        </Fg>
        <Fg label="Time" required error={shown('time')} hint={app ? TZ_LABEL[app.location] : undefined}>
          <input type="time" value={v.time} onChange={(e) => set('time', e.target.value)} />
        </Fg>
        <Fg label="Duration">
          <select value={v.durationMin} onChange={(e) => set('durationMin', e.target.value)}>
            {[30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Fg>
        <Fg
          label={v.mode === 'Teams' ? 'Meeting link' : 'Meeting link (optional)'}
          error={shown('link')}
          hint={v.mode !== 'Teams' ? undefined : teamsOn ? 'Create a Teams meeting, or paste a link. The created link is a sandbox placeholder until the live connection exists.' : level === 'full' ? 'Paste the Teams meeting link. Connect Teams under Operations to create meetings from here.' : 'Paste the Teams meeting link from your calendar. The candidate receives it with the invitation.'}
        >
          <div className="hm-linkbox">
            <input value={v.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" />
            {v.mode === 'Teams' && teamsOn && (
              <Button size="sm" onClick={() => set('link', sandboxTeamsLink())}>
                Create Teams meeting
              </Button>
            )}
          </div>
        </Fg>
        <Fg label="Panel" required error={shown('panelIds')} full>
          <PanelPicker value={v.panelIds} onChange={(x) => set('panelIds', x)} />
        </Fg>
        {clashes.length > 0 && (
          <div className="fg full">
            <div className="note-box hm-warn">
              <div>
                {clashes.map(empName).join(', ')} {clashes.length === 1 ? 'has' : 'have'} another interview at this time. You can still schedule it.
              </div>
            </div>
          </div>
        )}
        {!interview && (
          <Fg label="Notes for the panel" full>
            <textarea rows={3} value={v.notes} onChange={(e) => set('notes', e.target.value)} style={TEXTAREA_STYLE} />
          </Fg>
        )}
      </div>
    </Drawer>
  );
}

/* ---------------------------------------------------------------------- offer */

export function OfferDrawer({ application, onClose, onDone }: { application: Application | null; onClose: () => void; onDone: (offerId: string) => void }) {
  return application ? <OfferForm key={application.id} application={application} onClose={onClose} onDone={onDone} /> : null;
}

function OfferForm({ application, onClose, onDone }: { application: Application; onClose: () => void; onDone: (offerId: string) => void }) {
  const s = useHiring();
  const actor = useActor();
  const job = jobById(s, application.jobId);
  const cand = candById(s, application.candidateId);
  const cur = job?.currency ?? 'AED';
  const labels = cur === 'INR' ? INDIA_OFFER_LINES : UAE_OFFER_LINES;
  const [lines, setLines] = useState<Record<string, string>>({});
  const [joining, setJoining] = useState(addDays(todayISO(), 30));
  const [probation, setProbation] = useState('6');
  const [expiry, setExpiry] = useState(addDays(todayISO(), 7));
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');

  const total = labels.reduce((n, l) => n + (Number(lines[l]) || 0), 0);
  const over = !!job && total > job.budgetMax;
  const errors: Record<string, string> = {};
  if (!(Number(lines[labels[0]]) > 0)) errors.basic = `${labels[0]} is required.`;
  if (!joining) errors.joining = 'Choose a joining date.';
  else if (joining < todayISO()) errors.joining = 'The joining date is in the past.';
  if (!expiry) errors.expiry = 'Choose when the offer expires.';
  else if (joining && expiry > joining) errors.expiry = 'The offer should expire before the joining date.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const save = () => {
    setAttempted(true);
    if (Object.keys(errors).length) return;
    const r = createOffer(application.id, { lines: labels.map((l) => ({ label: l, amount: Number(lines[l]) || 0 })), joiningDate: joining, probationMonths: Number(probation), expiryDate: expiry }, actor);
    if (!r.ok) return setError(r.error);
    onDone(r.offer.id);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Offer for ${cand?.name ?? 'candidate'}`}
      description={job ? `${job.code} · ${job.title} · budget ${money(job.budgetMin, cur)} – ${money(job.budgetMax, cur)} ${payUnit(cur)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save offer
          </Button>
        </>
      }
    >
      {error && <div className="tx-err" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid hm-form">
        <div className="fg full">
          <label>{cur === 'INR' ? 'Compensation breakdown (INR per year)' : 'Salary breakdown (AED per month)'}</label>
        </div>
        {labels.map((l, i) => (
          <Fg key={l} label={l} required={i === 0} error={i === 0 ? shown('basic') : undefined}>
            <input type="number" min={0} value={lines[l] ?? ''} onChange={(e) => setLines((p) => ({ ...p, [l]: e.target.value }))} />
          </Fg>
        ))}
        <div className="fg full">
          <div className={`hm-total ${over ? 'over' : ''}`}>
            <span>Total {payUnit(cur)}</span>
            <b>{money(total, cur)}</b>
          </div>
          {over && <span className="hint" style={{ color: '#B45309' }}>Above the requisition budget maximum. In a later phase this adds an extra approval step; for now it is flagged on the offer.</span>}
        </div>
        <Fg label="Joining date" required error={shown('joining')}>
          <DateField value={joining} min={todayISO()} onChange={(e) => setJoining(e.target.value)} />
        </Fg>
        <Fg label="Probation (months)">
          <select value={probation} onChange={(e) => setProbation(e.target.value)}>
            {[0, 1, 2, 3, 6].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'None' : m}
              </option>
            ))}
          </select>
        </Fg>
        <Fg label="Offer expires on" required error={shown('expiry')}>
          <DateField value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </Fg>
      </div>
    </Drawer>
  );
}
