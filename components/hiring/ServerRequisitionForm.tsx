'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/context/OrgContext';
import { errorMessage } from '@/lib/api';
import { todayISO } from '@/lib/dates';
import { EMPLOYMENT_KINDS, EmploymentKind, REQUISITION_REASONS, RequisitionReason } from '@/lib/hiringTypes';
import {
  AMOUNT_RE,
  EMPLOYMENT,
  EMPLOYMENT_OF,
  REASON,
  REASON_OF,
  ReplaceablePerson,
  RequisitionBody,
  RequisitionScope,
  ServerRequisition,
  requisitionsApi,
} from '@/lib/requisitionsApi';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Fg, TEXTAREA_STYLE, payUnit, useHiringLocation } from '@/components/hiring/HiringBits';

/* The "New requisition" / "Edit" drawer against the backend (local development). Same form and checks as the demo
   RequisitionDrawer; what the caller may choose comes from GET /hiring/requisitions/scope (BR-HIR-019): with full
   hiring access any active company, department and hiring manager; otherwise only their own departments, with
   themselves as hiring manager. The server repeats every check, and its message is shown when it refuses. */

const NEW_DESIGNATION = '__new__';

interface Form {
  locationId: string;
  companyId: string;
  departmentId: string;
  designationId: string;
  /** A new title asked for instead of a designation (BR-HIR-020); null when choosing one from the list. */
  proposed: string | null;
  title: string;
  positions: string;
  employmentType: EmploymentKind;
  reason: RequisitionReason;
  replacesId: string;
  budgetMin: string;
  budgetMax: string;
  targetStart: string;
  hiringManagerId: string;
  justification: string;
}

const fromServer = (r: ServerRequisition): Form => ({
  locationId: r.location.id,
  companyId: r.company.id,
  departmentId: r.department.id,
  designationId: r.designation?.id ?? '',
  proposed: r.designation ? null : r.proposedDesignation,
  title: r.title,
  positions: String(r.positions),
  employmentType: EMPLOYMENT[r.employmentType],
  reason: REASON[r.reason],
  replacesId: r.replaces?.id ?? '',
  budgetMin: r.budgetMin.amount.replace(/\.00$/, ''),
  budgetMax: r.budgetMax.amount.replace(/\.00$/, ''),
  targetStart: r.targetStart,
  hiringManagerId: r.hiringManager.id,
  justification: r.justification,
});

export function ServerRequisitionDrawer({ open, edit, onClose, onDone }: { open: boolean; edit?: ServerRequisition; onClose: () => void; onDone: (r: ServerRequisition, submitted: boolean) => void }) {
  const [scope, setScope] = useState<RequisitionScope | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let live = true;
    requisitionsApi
      .scope()
      .then((s) => live && setScope(s))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [open]);
  if (!open) return null;
  if (!scope) {
    return (
      <Drawer open onClose={onClose} wide title={edit ? `Edit ${edit.code}` : 'New requisition'}>
        {error ? <div className="tx-err">{error}</div> : <p className="sb">Loading…</p>}
      </Drawer>
    );
  }
  return <RequisitionForm key={edit?.id ?? 'new'} scope={scope} edit={edit} onClose={onClose} onDone={onDone} />;
}

function RequisitionForm({ scope, edit, onClose, onDone }: { scope: RequisitionScope; edit?: ServerRequisition; onClose: () => void; onDone: (r: ServerRequisition, submitted: boolean) => void }) {
  const { companies, departments, designations, locations, locationDef } = useOrg();
  const { loc } = useHiringLocation();
  const locked = scope.restricted;

  const blank = (): Form => {
    const first = scope.departments[0];
    return {
      locationId: locked ? (scope.defaultLocationId ?? first?.locations[0]?.id ?? loc) : loc,
      companyId: first?.company.id ?? '',
      departmentId: first?.id ?? '',
      designationId: '',
      proposed: null,
      title: '',
      positions: '1',
      employmentType: 'Full-time',
      reason: 'New role',
      replacesId: '',
      budgetMin: '',
      budgetMax: '',
      targetStart: '',
      hiringManagerId: scope.hiringManager?.id ?? '',
      justification: '',
    };
  };
  const original = useMemo(() => (edit ? fromServer(edit) : null), [edit]);
  const [v, setV] = useState<Form>(() => original ?? blank());
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [people, setPeople] = useState<ReplaceablePerson[] | null>(null);
  const set = <K extends keyof Form>(k: K, val: Form[K]) => setV((p) => ({ ...p, [k]: val }));
  const cur = locationDef(v.locationId)?.currency ?? 'AED';
  const today = todayISO();

  // The people of the chosen department, for "Employee being replaced".
  const replacing = v.reason === 'Replacement';
  useEffect(() => {
    if (!replacing || !v.departmentId) return;
    let live = true;
    requisitionsApi
      .departmentPeople(v.departmentId)
      .then((p) => live && setPeople(p))
      .catch(() => live && setPeople([]));
    return () => {
      live = false;
      setPeople(null);
    };
  }, [replacing, v.departmentId]);

  // Full access: every active company; departments working in the location first (all of the company's otherwise).
  const cos = companies.filter((c) => c.status === 'Active');
  const ofCompany = departments.filter((d) => d.companyId === v.companyId);
  const inLocation = ofCompany.filter((d) => d.locations.includes(v.locationId));
  const depts = inLocation.length ? inLocation : ofCompany;
  const desigs = designations.filter((d) => d.departmentId === v.departmentId);

  // Restricted: their departments. One the requisition already sits in (raised for them by HR) stays choosable.
  const scopeDepts = useMemo(() => {
    const list = scope.departments.map((d) => ({ id: d.id, name: d.name, company: d.company, locations: d.locations }));
    if (edit && !list.some((d) => d.id === edit.department.id)) list.push({ id: edit.department.id, name: edit.department.name, company: edit.company, locations: [edit.location] });
    return list;
  }, [scope, edit]);
  const pickedDept = scopeDepts.find((d) => d.id === v.departmentId);
  const multiLocation = (pickedDept?.locations.length ?? 0) > 1;
  const managerName = edit && locked ? edit.hiringManager.name : (scope.hiringManager?.name ?? '');

  const errors: Record<string, string> = {};
  if (!v.title.trim()) errors.title = 'Job title is required.';
  if (v.proposed !== null) {
    const t = v.proposed.trim();
    if (t.length < 2 || t.length > 80) errors.designation = 'Enter the new designation (2–80 characters).';
    else if (desigs.some((d) => d.title.toLowerCase() === t.toLowerCase())) errors.designation = 'That designation already exists in this department. Choose it from the list.';
  } else if (desigs.length && !v.designationId) errors.designation = 'Choose a designation.';
  if (!v.companyId) errors.companyId = locked ? 'Your company is not set up under Administration → Companies.' : 'Choose a company.';
  if (!v.departmentId) errors.departmentId = locked && !scopeDepts.length ? 'Your department is not set up under Administration → Departments & Designations.' : 'Choose a department.';
  const positions = Number(v.positions);
  if (!Number.isInteger(positions) || positions < 1 || positions > 500) errors.positions = 'Enter 1 to 500 positions.';
  if (replacing && !v.replacesId) errors.replacesId = 'Choose the employee being replaced.';
  if (!AMOUNT_RE.test(v.budgetMin.trim()) || !(Number(v.budgetMin) > 0)) errors.budgetMin = 'Enter the minimum.';
  if (!AMOUNT_RE.test(v.budgetMax.trim()) || !(Number(v.budgetMax) > 0)) errors.budgetMax = 'Enter the maximum.';
  else if (!errors.budgetMin && Number(v.budgetMin) > Number(v.budgetMax)) errors.budgetMax = 'Maximum is below the minimum.';
  if (!v.targetStart) errors.targetStart = 'Choose a target start date.';
  else if (!edit && v.targetStart < today) errors.targetStart = 'The start date is in the past.';
  if (!locked && !v.hiringManagerId) errors.hiringManagerId = 'Choose the hiring manager.';
  if (!v.justification.trim()) errors.justification = 'Add a short justification for approvers.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  // The designation belongs to a department, so it goes when the department does; so does a title only filled from it.
  const desigTitle = (p: Form) => (p.proposed ?? designations.find((d) => d.id === p.designationId)?.title ?? '');
  const dropDesignation = (p: Form): Partial<Form> => ({ designationId: '', proposed: null, replacesId: '', title: desigTitle(p) && p.title === desigTitle(p) ? '' : p.title });

  const pickScoped = (id: string) => {
    const d = scopeDepts.find((x) => x.id === id);
    const ids = d?.locations.map((l) => l.id) ?? [];
    setV((p) => ({ ...p, departmentId: id, companyId: d?.company.id ?? '', locationId: ids.includes(p.locationId) ? p.locationId : (ids[0] ?? p.locationId), ...dropDesignation(p) }));
  };
  const changeLocation = (id: string) => {
    // The company stays; the department only if the company runs it in the new location.
    const keep = locked || !!departments.find((x) => x.id === v.departmentId)?.locations.includes(id);
    setV((p) => ({ ...p, locationId: id, ...(keep ? {} : { departmentId: '', ...dropDesignation(p) }) }));
  };

  const body = (): RequisitionBody => ({
    title: v.title.trim(),
    companyId: v.companyId,
    departmentId: v.departmentId,
    ...(v.proposed !== null ? { proposedDesignation: v.proposed.trim() } : { designationId: v.designationId || null }),
    locationId: v.locationId,
    positions,
    employmentType: EMPLOYMENT_OF[v.employmentType],
    reason: REASON_OF[v.reason],
    ...(replacing && { replacesEmployeeId: v.replacesId }),
    budgetMin: v.budgetMin.trim(),
    budgetMax: v.budgetMax.trim(),
    targetStart: v.targetStart,
    ...(!locked && { hiringManagerId: v.hiringManagerId }),
    justification: v.justification.trim(),
  });

  /** On an edit only what changed is sent, so the server checks only that (BR-HIR-019). */
  const changes = (): Partial<RequisitionBody> => {
    const next = body();
    const before = original!;
    const out: Partial<RequisitionBody> = {};
    const put = <K extends keyof RequisitionBody>(k: K, changed: boolean) => {
      if (changed) out[k] = next[k];
    };
    put('title', next.title !== before.title.trim());
    put('companyId', v.companyId !== before.companyId);
    put('departmentId', v.departmentId !== before.departmentId);
    // A new department clears the designation on the server, so the choice is always sent with it.
    const designationChanged =
      v.departmentId !== before.departmentId ||
      (v.proposed !== null ? before.proposed === null || v.proposed.trim() !== before.proposed.trim() : before.proposed !== null || v.designationId !== before.designationId);
    if (designationChanged) {
      if (v.proposed !== null) out.proposedDesignation = v.proposed.trim();
      else out.designationId = v.designationId || null;
    }
    put('locationId', v.locationId !== before.locationId);
    put('positions', v.positions !== before.positions);
    put('employmentType', v.employmentType !== before.employmentType);
    put('reason', v.reason !== before.reason);
    if (replacing && v.replacesId !== before.replacesId) out.replacesEmployeeId = v.replacesId;
    put('budgetMin', v.budgetMin.trim() !== before.budgetMin);
    put('budgetMax', v.budgetMax.trim() !== before.budgetMax);
    put('targetStart', v.targetStart !== before.targetStart);
    if (!locked) put('hiringManagerId', v.hiringManagerId !== before.hiringManagerId);
    put('justification', next.justification !== before.justification.trim());
    return out;
  };

  const save = async (submit: boolean) => {
    setAttempted(true);
    if (Object.keys(errors).length || busy) return;
    setBusy(true);
    setServerError('');
    try {
      if (edit) {
        const diff = changes();
        let r = Object.keys(diff).length ? await requisitionsApi.update(edit.id, diff) : edit;
        if (submit) r = await requisitionsApi.submit(edit.id);
        onDone(r, submit);
      } else {
        onDone(await requisitionsApi.create({ ...body(), submit }), submit);
      }
    } catch (e) {
      setServerError(errorMessage(e));
      setBusy(false);
    }
  };

  const companyName = companies.find((c) => c.id === v.companyId)?.name ?? pickedDept?.company.name ?? '';
  const deptName = pickedDept?.name ?? departments.find((d) => d.id === v.departmentId)?.name ?? '';
  const locationOptions = (ids: string[]) => locations.filter((l) => ids.includes(l.id));
  const replaceOptions = (people ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    meta: [p.employeeCode, p.designation, p.status === 'INACTIVE' ? 'left' : p.status === 'OFFBOARDING' ? 'leaving' : ''].filter(Boolean).join(' · '),
  }));
  if (edit?.replaces && !replaceOptions.some((o) => o.value === edit.replaces!.id)) replaceOptions.unshift({ value: edit.replaces.id, label: edit.replaces.name, meta: edit.replaces.employeeCode });
  const managerOptions = scope.hiringManagers.map((p) => ({ value: p.id, label: p.name, meta: p.employeeCode }));
  if (edit && !locked && !managerOptions.some((o) => o.value === edit.hiringManager.id)) managerOptions.unshift({ value: edit.hiringManager.id, label: edit.hiringManager.name, meta: edit.hiringManager.employeeCode });

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      title={edit ? `Edit ${edit.code}` : 'New requisition'}
      description="Ask for headcount. It goes Hiring Manager → HR → Management before a job can be opened."
      footer={
        <>
          {serverError && (
            <div className="tx-err" style={{ marginRight: 'auto' }}>
              {serverError}
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => save(false)}>
            {edit ? 'Save changes' : 'Save draft'}
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => save(true)}>
            {edit?.status === 'REJECTED' ? 'Save and resubmit' : 'Submit for approval'}
          </Button>
        </>
      }
    >
      <div className="form-grid hm-form">
        {locked ? (
          scopeDepts.length > 1 ? (
            <>
              <Fg label="Department" required error={shown('departmentId')} hint={`${companyName} · Hiring manager: ${managerName}`} full={!multiLocation}>
                <select value={v.departmentId} onChange={(e) => pickScoped(e.target.value)}>
                  <option value="">Select…</option>
                  {scopeDepts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.company.name}
                    </option>
                  ))}
                </select>
              </Fg>
              {multiLocation && (
                <Fg label="Location" required>
                  <select value={v.locationId} onChange={(e) => changeLocation(e.target.value)}>
                    {locationOptions(pickedDept!.locations.map((l) => l.id)).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Fg>
              )}
            </>
          ) : (
            <>
              <Fg label="Requesting for" error={shown('companyId') ?? shown('departmentId')} hint="You can ask for headcount in your own team only." full>
                <div className="hm-scope">
                  <strong>{companyName || '—'}</strong>
                  <span>{deptName || '—'}</span>
                  {!multiLocation && <span>{locationDef(v.locationId)?.name ?? v.locationId}</span>}
                  <span>Hiring manager: {managerName || '—'}</span>
                </div>
              </Fg>
              {multiLocation && (
                <Fg label="Location" required hint={`${deptName} works in more than one country. Choose where this role is based.`} full>
                  <select value={v.locationId} onChange={(e) => changeLocation(e.target.value)}>
                    {locationOptions(pickedDept!.locations.map((l) => l.id)).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Fg>
              )}
            </>
          )
        ) : (
          <>
            <Fg label="Location" required>
              <select value={v.locationId} onChange={(e) => changeLocation(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Fg>
            <Fg label="Company" required error={shown('companyId')}>
              <select value={v.companyId} onChange={(e) => setV((p) => ({ ...p, companyId: e.target.value, departmentId: '', ...dropDesignation(p) }))}>
                <option value="">Select…</option>
                {cos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Fg>
            <Fg label="Department" required error={shown('departmentId')}>
              <select value={v.departmentId} disabled={!v.companyId} onChange={(e) => setV((p) => ({ ...p, departmentId: e.target.value, ...dropDesignation(p) }))}>
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
        <Fg label="Designation" required={desigs.length > 0 || v.proposed !== null} error={v.proposed !== null ? undefined : shown('designation')} hint="The grade. It carries through to the job and onboarding." full={locked}>
          <select
            value={v.proposed !== null ? NEW_DESIGNATION : v.designationId}
            disabled={!v.departmentId}
            onChange={(e) => {
              const id = e.target.value;
              // The job title follows the designation until it has been typed by hand.
              if (id === NEW_DESIGNATION) setV((p) => ({ ...p, designationId: '', proposed: '', title: desigTitle(p) && p.title === desigTitle(p) ? '' : p.title }));
              else {
                const t = designations.find((d) => d.id === id)?.title ?? '';
                setV((p) => ({ ...p, designationId: id, proposed: null, title: !p.title.trim() || p.title === desigTitle(p) ? t : p.title }));
              }
            }}
          >
            <option value="">{!v.departmentId ? 'Choose a department first' : 'Select…'}</option>
            {desigs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
            {v.departmentId && <option value={NEW_DESIGNATION}>+ Request a new designation…</option>}
          </select>
        </Fg>
        {v.proposed !== null && (
          <Fg label="New designation" required error={shown('designation')} hint={`Added to ${deptName || 'the department'} only once this requisition is approved. Until then it stays a request.`} full>
            <input
              value={v.proposed}
              maxLength={80}
              placeholder="e.g. Senior Cloud Engineer"
              onChange={(e) => {
                const t = e.target.value;
                setV((p) => ({ ...p, proposed: t, title: !p.title.trim() || p.title === p.proposed ? t : p.title }));
              }}
            />
          </Fg>
        )}
        <Fg label="Job title" required error={shown('title')} hint="Shown on the careers page. Fills from the designation; edit it if the advert should read differently." full>
          <input value={v.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Network Engineer" />
        </Fg>
        <Fg label="Number of positions" required error={shown('positions')}>
          <input type="number" min={1} max={500} value={v.positions} onChange={(e) => set('positions', e.target.value)} />
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
        {replacing && (
          <Fg label="Employee being replaced" required error={shown('replacesId')} hint={v.departmentId ? `People in ${deptName || 'the department'}, including those who have left.` : 'Choose a department first.'} full>
            <SearchSelect options={replaceOptions} value={v.replacesId} onChange={(x) => set('replacesId', x)} placeholder={people === null && v.departmentId ? 'Loading…' : 'Search employee…'} emptyText="Nobody in this department" disabled={!v.departmentId} />
          </Fg>
        )}
        {!locked && (
          <Fg label="Hiring manager" required error={shown('hiringManagerId')} hint="People who can approve requisitions (Team Lead and above)." full>
            <SearchSelect options={managerOptions} value={v.hiringManagerId} onChange={(x) => set('hiringManagerId', x)} placeholder="Search employee…" />
          </Fg>
        )}
        <Fg label={`Budget min (${cur} ${payUnit(cur)})`} required error={shown('budgetMin')}>
          <input inputMode="decimal" value={v.budgetMin} onChange={(e) => set('budgetMin', e.target.value)} />
        </Fg>
        <Fg label={`Budget max (${cur} ${payUnit(cur)})`} required error={shown('budgetMax')}>
          <input inputMode="decimal" value={v.budgetMax} onChange={(e) => set('budgetMax', e.target.value)} />
        </Fg>
        <Fg label="Justification" required error={shown('justification')} full>
          <textarea rows={4} maxLength={2000} value={v.justification} onChange={(e) => set('justification', e.target.value)} placeholder="Why is this headcount needed?" style={TEXTAREA_STYLE} />
        </Fg>
      </div>
    </Drawer>
  );
}
