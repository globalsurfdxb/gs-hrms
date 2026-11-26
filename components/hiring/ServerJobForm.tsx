'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/context/OrgContext';
import { errorMessage } from '@/lib/api';
import { addDays, todayISO } from '@/lib/dates';
import { PickPerson, RecruiterPool, ServerJob, ServerJobDetail, jobsApi } from '@/lib/jobsApi';
import { ServerRequisition } from '@/lib/requisitionsApi';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { XIcon } from '@/components/icons';
import { Fg, TEXTAREA_STYLE } from '@/components/hiring/HiringBits';

/* Job drawers against the backend (local development): "Create job" from an approved requisition and "Choose /
   Change recruiter". People to pick come from GET /hiring/people and the Talent Acquisition team from
   GET /hiring/recruiters (BR-HIR-021); the server repeats every check and its message is shown when it refuses. */

const option = (p: PickPerson) => ({ value: p.id, label: p.name, meta: [p.employeeCode, p.designation].filter(Boolean).join(' · ') });

/** Active employees to pick from, loaded once per drawer. */
function usePeople() {
  const [people, setPeople] = useState<PickPerson[] | null>(null);
  useEffect(() => {
    let live = true;
    jobsApi
      .people()
      .then((p) => live && setPeople(p))
      .catch(() => live && setPeople([]));
    return () => {
      live = false;
    };
  }, []);
  return people;
}

/** Picks several employees: a search box to add, chips to remove. `known` names people already chosen. */
export function ServerPanelPicker({ people, value, onChange, known = [], label = 'Add panel member…' }: { people: PickPerson[] | null; value: string[]; onChange: (v: string[]) => void; known?: { id: string; name: string }[]; label?: string }) {
  const options = (people ?? []).filter((p) => !value.includes(p.id)).map(option);
  const nameOf = (id: string) => people?.find((p) => p.id === id)?.name ?? known.find((p) => p.id === id)?.name ?? '…';
  return (
    <div>
      <SearchSelect options={options} value="" onChange={(v) => v && onChange([...value, v])} placeholder={people ? label : 'Loading…'} emptyText="Everyone is already added" disabled={!people} />
      {value.length > 0 && (
        <div className="hm-chips">
          {value.map((id) => (
            <span key={id} className="hm-chip">
              {nameOf(id)}
              <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => onChange(value.filter((x) => x !== id))}>
                <XIcon />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- create job */

export function ServerJobDrawer({ requisition, onClose, onDone }: { requisition: ServerRequisition | null; onClose: () => void; onDone: (j: ServerJobDetail) => void }) {
  return requisition ? <JobForm key={requisition.id} requisition={requisition} onClose={onClose} onDone={onDone} /> : null;
}

function JobForm({ requisition: r, onClose, onDone }: { requisition: ServerRequisition; onClose: () => void; onDone: (j: ServerJobDetail) => void }) {
  const { designations } = useOrg();
  const people = usePeople();
  const [pool, setPool] = useState<RecruiterPool | null>(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let live = true;
    jobsApi
      .recruiters()
      .then((p) => live && setPool(p))
      .catch((e) => live && setLoadError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);

  const desigs = designations.filter((d) => d.departmentId === r.department.id);
  const [v, setV] = useState({
    designationId: r.designation?.id ?? '',
    description: '',
    skills: '',
    expMin: '2',
    expMax: '6',
    qualifications: '',
    panelIds: [r.hiringManager.id],
    recruiterId: '',
    referralEligible: true,
    closingDate: addDays(todayISO(), 30),
    publish: true,
  });
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  const handOver = !!pool?.handsOver;
  const recruiterOptions = pool ? (pool.taManager ? pool.pool : (people ?? [])).map(option) : [];
  const expMin = Number(v.expMin);
  const expMax = Number(v.expMax);
  const skills = [...new Set(v.skills.split(',').map((s) => s.trim()).filter(Boolean))];

  const errors: Record<string, string> = {};
  if (!v.description.trim()) errors.description = 'Add a job description.';
  if (!skills.length) errors.skills = 'List at least one key skill.';
  else if (skills.length > 30 || skills.some((s) => s.length > 60)) errors.skills = 'Up to 30 skills of 60 characters each.';
  if (!Number.isInteger(expMin) || expMin < 0 || expMin > 50 || v.expMin.trim() === '') errors.expMin = 'Enter the minimum years (0–50).';
  if (!Number.isInteger(expMax) || expMax > 50 || v.expMax.trim() === '' || expMax < expMin) errors.expMax = 'Maximum is below the minimum.';
  if (pool && !handOver && !v.recruiterId) errors.recruiterId = 'Choose the recruiter who will run this job.';
  if (!v.panelIds.length) errors.panelIds = 'Add at least one interviewer.';
  else if (v.panelIds.length > 20) errors.panelIds = 'Up to 20 interviewers.';
  if (!v.closingDate) errors.closingDate = 'Choose a closing date.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const submit = async () => {
    setAttempted(true);
    if (!pool || Object.keys(errors).length || busy) return;
    setBusy(true);
    setError('');
    try {
      onDone(
        await jobsApi.create(r.id, {
          ...(v.designationId && { designationId: v.designationId }),
          description: v.description.trim(),
          skills,
          expMin,
          expMax,
          qualifications: v.qualifications.trim() || undefined,
          panelIds: v.panelIds,
          ...(!handOver && { recruiterId: v.recruiterId }),
          referralEligible: v.referralEligible,
          closingDate: v.closingDate,
          publish: v.publish,
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Create job from ${r.code}`}
      description={`${r.title} · ${r.department.name} · ${r.positions} position${r.positions === 1 ? '' : 's'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !pool} onClick={submit}>
            {v.publish ? 'Create and open job' : 'Save as draft'}
          </Button>
        </>
      }
    >
      {(error || loadError) && (
        <div className="tx-err" style={{ marginBottom: 12 }}>
          {error || loadError}
        </div>
      )}
      <div className="form-grid hm-form">
        <Fg label="Designation" hint="Used to prefill onboarding for the hire." full>
          <select value={v.designationId} onChange={(e) => set('designationId', e.target.value)}>
            {!v.designationId && <option value="">From the requisition</option>}
            {desigs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </Fg>
        <Fg label="Job description" required error={shown('description')} full hint="One responsibility per line.">
          <textarea rows={6} maxLength={5000} value={v.description} onChange={(e) => set('description', e.target.value)} style={TEXTAREA_STYLE} />
        </Fg>
        <Fg label="Key skills" required error={shown('skills')} hint="Separate with commas." full>
          <input value={v.skills} onChange={(e) => set('skills', e.target.value)} placeholder="Cisco, Fortinet, SD-WAN" />
        </Fg>
        <Fg label="Experience from (years)" required error={shown('expMin')}>
          <input type="number" min={0} max={50} value={v.expMin} onChange={(e) => set('expMin', e.target.value)} />
        </Fg>
        <Fg label="Experience to (years)" required error={shown('expMax')}>
          <input type="number" min={0} max={50} value={v.expMax} onChange={(e) => set('expMax', e.target.value)} />
        </Fg>
        <Fg label="Qualifications" full>
          <input value={v.qualifications} maxLength={500} onChange={(e) => set('qualifications', e.target.value)} placeholder="e.g. CCNA or higher" />
        </Fg>
        {!pool ? (
          <Fg label="Recruiter" full>
            <p className="sb">{loadError ? '—' : 'Loading…'}</p>
          </Fg>
        ) : handOver && pool.taManager ? (
          <Fg label="Recruiter" hint="The job goes to the Talent Acquisition Manager, who chooses the recruiter once it is created." full>
            <div className="hm-scope">
              <strong>{pool.taManager.name}</strong>
              <span>Talent Acquisition Manager</span>
              <span>chooses the recruiter</span>
            </div>
          </Fg>
        ) : (
          <Fg label="Recruiter" required error={shown('recruiterId')} hint="Runs this job: screening, scheduling and offers. Reports can be filtered by recruiter." full>
            <SearchSelect options={recruiterOptions} value={v.recruiterId} onChange={(x) => set('recruiterId', x)} placeholder="Search recruiter…" />
          </Fg>
        )}
        <Fg label="Interview panel" required error={shown('panelIds')} full>
          <ServerPanelPicker people={people} value={v.panelIds} onChange={(x) => set('panelIds', x)} known={[r.hiringManager]} />
        </Fg>
        <Fg label="Closing date" required error={shown('closingDate')}>
          <DateField value={v.closingDate} min={todayISO()} onChange={(e) => set('closingDate', e.target.value)} />
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

/* ---------------------------------------------------------------------- recruiter */

export function ServerRecruiterDrawer({ job, onClose, onDone }: { job: ServerJob | null; onClose: () => void; onDone: (j: ServerJobDetail) => void }) {
  return job ? <RecruiterForm key={job.id} job={job} onClose={onClose} onDone={onDone} /> : null;
}

function RecruiterForm({ job, onClose, onDone }: { job: ServerJob; onClose: () => void; onDone: (j: ServerJobDetail) => void }) {
  const people = usePeople();
  const [pool, setPool] = useState<RecruiterPool | null>(null);
  const [who, setWho] = useState(job.recruiter?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    jobsApi
      .recruiters()
      .then((p) => live && setPool(p))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);
  // From the Talent Acquisition team once there is one; otherwise anyone active. The current recruiter stays listed.
  const options = useMemo(() => {
    const list = (pool?.pool.length ? pool.pool : (people ?? [])).map(option);
    if (job.recruiter && !list.some((o) => o.value === job.recruiter!.id)) list.unshift({ value: job.recruiter.id, label: job.recruiter.name, meta: job.recruiter.employeeCode });
    return list;
  }, [pool, people, job.recruiter]);

  const save = async () => {
    if (!who) return setError('Choose a recruiter.');
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onDone(await jobsApi.setRecruiter(job.id, who));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={job.recruiter ? 'Change recruiter' : 'Choose recruiter'}
      description={`${job.code} · ${job.title}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !pool} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      {error && <div className="tx-err" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid hm-form">
        <Fg label="Recruiter" required hint="Runs this job: screening, scheduling and offers." full>
          <SearchSelect options={options} value={who} onChange={setWho} placeholder={pool ? 'Search recruiter…' : 'Loading…'} />
        </Fg>
      </div>
    </Drawer>
  );
}
