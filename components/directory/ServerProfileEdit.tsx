'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/context/OrgContext';
import { ApiError, errorMessage } from '@/lib/api';
import { EmploymentUpdate, ServerEmployee, employeesApi } from '@/lib/employeesApi';
import { EMERGENCY_GROUPS, PROFILE_TEXT, ProfileTextKey, ProfileUpdate, ServerProfileData, profilesApi } from '@/lib/profilesApi';
import { BANK_TAB_KEYS, IB_LABELS, IbKey, ServerIdentityBank, identityBankApi } from '@/lib/identityBankApi';
import { BankFields, IbForm, IdentityFields, ibChanges, ibFormOf, identityTabName, validateIb } from '@/components/directory/ServerIdentityBank';
import { BLOOD_GROUPS, EMAIL_RE, GENDERS, MARITAL_STATUSES, NATIONALITIES, WORK_MODES, phoneOk, withCurrent } from '@/lib/options';
import { todayISO } from '@/lib/dates';
import { Fg, RowList, Sub, TEXTAREA } from '@/components/profile/EditBits';
import { DateField } from '@/components/ui/DateField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button, Card, EmptyState } from '@/components/ui/Card';
import { ArrowLeftIcon, PeopleIcon, ShieldIcon, XIcon } from '@/components/icons';

/* Edit an employee on the server (local development): the employment record (name, location, organization,
   department, designation, manager, type, joining date) and the profile (personal details, work contact and placement
   extras, emergency contacts, experience, education, family). Only what changed is sent — employment first, because a
   move between UAE and India switches the stored emergency contact groups the profile save then checks. The server
   checks access (Directory → Edit; Identity & bank → Edit for those tabs), validates again and records Audit Log entries
   per part saved. Identity and bank numbers are never loaded into the form: typing one replaces the stored number.
   Salary is not on the server yet. */

/** The employment record as the form holds it ("" = none). */
interface Job {
  fullName: string;
  locationId: string;
  companyId: string;
  departmentId: string;
  designationId: string;
  reportingManagerId: string;
  employmentType: ServerEmployee['employmentType'];
  dateOfJoining: string;
}
const JOB_KEYS = ['fullName', 'locationId', 'companyId', 'departmentId', 'designationId', 'reportingManagerId', 'employmentType', 'dateOfJoining'] as const;
const EMPLOYMENT_TYPES: { value: ServerEmployee['employmentType']; label: string }[] = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'PROBATION', label: 'Probation' },
];
const jobOf = (e: ServerEmployee): Job => ({
  fullName: e.name,
  locationId: e.location.id,
  companyId: e.company.id,
  departmentId: e.department?.id ?? '',
  designationId: e.designation?.id ?? '',
  reportingManagerId: e.reportingManager?.id ?? '',
  employmentType: e.employmentType,
  dateOfJoining: e.dateOfJoining,
});
/** Only the employment fields that changed, ready to PATCH ("" becomes null). */
function jobChanges(orig: Job, j: Job): EmploymentUpdate {
  const body: Record<string, unknown> = {};
  for (const k of JOB_KEYS) {
    const a = orig[k].trim();
    const b = j[k].trim();
    if (a !== b) body[k] = b || null;
  }
  return body as EmploymentUpdate;
}

type Text = Record<ProfileTextKey, string>;
interface Emergency {
  group: string;
  name: string;
  relationship: string;
  mobile: string;
}
interface Experience {
  company: string;
  title: string;
  location: string;
  workMode: string;
  fromDate: string;
  toDate: string;
}
interface Education {
  qualification: string;
  institution: string;
  course: string;
  field: string;
  startYear: string;
  endYear: string;
}
interface Family {
  name: string;
  relationship: string;
  occupation: string;
  dateOfBirth: string;
}
interface Form {
  v: Text;
  emergencyContacts: Emergency[];
  experience: Experience[];
  education: Education[];
  family: Family[];
}
type Errs = Record<string, string>;

const LABELS: Record<ProfileTextKey | (typeof JOB_KEYS)[number] | 'emergencyContacts' | 'experience' | 'education' | 'family', string> = {
  fullName: 'Name',
  locationId: 'Work location',
  companyId: 'Organization',
  departmentId: 'Department',
  designationId: 'Designation',
  reportingManagerId: 'Reporting manager',
  employmentType: 'Employment type',
  dateOfJoining: 'Joining date',
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  dateOfBirth: 'Date of birth',
  nationality: 'Nationality',
  gender: 'Gender',
  maritalStatus: 'Marital status',
  bloodGroup: 'Blood group',
  personalEmail: 'Personal email',
  personalMobile: 'Personal mobile',
  currentAddress: 'Current address',
  permanentAddress: 'Permanent address',
  workPhone: 'Work phone',
  extension: 'Extension',
  seatingLocation: 'Seating location',
  probationEnd: 'Probation completion',
  totalExperience: 'Total experience',
  emergencyContacts: 'Emergency contacts',
  experience: 'Work experience',
  education: 'Education',
  family: 'Family',
};

const s = (x: string | null | undefined) => x ?? '';
const yr = (n: number | null) => (n == null ? '' : String(n));
const blank = (row: object) => Object.values(row).every((x) => !String(x).trim());

function toForm(p: ServerProfileData): Form {
  const v = Object.fromEntries(PROFILE_TEXT.map((k) => [k, s(p[k])])) as Text;
  return {
    v,
    emergencyContacts: p.emergencyContacts.map((c) => ({ ...c })),
    experience: p.experience.map((x) => ({ company: x.company, title: x.title, location: x.location, workMode: x.workMode, fromDate: s(x.fromDate), toDate: s(x.toDate) })),
    education: p.education.map((x) => ({ ...x, startYear: yr(x.startYear), endYear: yr(x.endYear) })),
    family: p.family.map((x) => ({ ...x, dateOfBirth: s(x.dateOfBirth) })),
  };
}

/** The lists as the server would store them: blank rows dropped, text trimmed. */
function lists(f: Form) {
  const t = (x: string) => x.trim();
  return {
    emergencyContacts: f.emergencyContacts.filter((r) => !blank({ ...r, group: '' })).map((r) => ({ group: r.group, name: t(r.name), relationship: t(r.relationship), mobile: t(r.mobile) })),
    experience: f.experience.filter((r) => !blank({ ...r, workMode: '' })).map((r) => ({ company: t(r.company), location: t(r.location), fromDate: r.fromDate || null, toDate: r.toDate || null, title: t(r.title), workMode: r.workMode })),
    education: f.education
      .filter((r) => !blank(r))
      .map((r) => ({ qualification: t(r.qualification), institution: t(r.institution), course: t(r.course), field: t(r.field), startYear: r.startYear.trim() ? Number(r.startYear) : null, endYear: r.endYear.trim() ? Number(r.endYear) : null })),
    family: f.family.filter((r) => !blank(r)).map((r) => ({ name: t(r.name), relationship: t(r.relationship), occupation: t(r.occupation), dateOfBirth: r.dateOfBirth || null })),
  };
}

/** Only what changed, ready to PATCH. */
function changesOf(orig: Form, f: Form): ProfileUpdate {
  const body: ProfileUpdate = {};
  for (const k of PROFILE_TEXT) if (f.v[k].trim() !== orig.v[k].trim()) body[k] = f.v[k].trim() || null;
  const a = lists(orig);
  const b = lists(f);
  (Object.keys(b) as (keyof typeof b)[]).forEach((k) => {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) (body as Record<string, unknown>)[k] = b[k];
  });
  return body;
}

function validate(f: Form, groups: readonly string[]): Errs {
  const e: Errs = {};
  const v = f.v;
  const year = (x: string) => /^\d{4}$/.test(x.trim()) && Number(x) >= 1950 && Number(x) <= 2100;
  if (v.dateOfBirth && v.dateOfBirth >= todayISO()) e.dateOfBirth = 'Date of birth must be in the past.';
  if (v.personalMobile.trim() && !phoneOk(v.personalMobile)) e.personalMobile = 'Enter a valid mobile number (7 to 15 digits, e.g. +971 50 123 4567).';
  if (v.personalEmail.trim() && !EMAIL_RE.test(v.personalEmail.trim())) e.personalEmail = 'That doesn’t look like an email address.';
  if (v.workPhone.trim() && !phoneOk(v.workPhone)) e.workPhone = 'Enter a valid work phone number (7 to 15 digits).';
  if (v.extension.trim() && !/^\d{1,6}$/.test(v.extension.trim())) e.extension = 'Up to 6 digits.';
  f.emergencyContacts.forEach((r, i) => {
    if (blank({ ...r, group: '' })) return;
    if (!groups.includes(r.group)) e[`emergencyContacts.${i}.group`] = 'Choose a contact group.';
    if (!r.name.trim()) e[`emergencyContacts.${i}.name`] = 'Name is required.';
    if (!r.relationship.trim()) e[`emergencyContacts.${i}.relationship`] = 'Relationship is required.';
    if (!r.mobile.trim()) e[`emergencyContacts.${i}.mobile`] = 'Mobile number is required.';
    else if (!phoneOk(r.mobile)) e[`emergencyContacts.${i}.mobile`] = 'Enter a valid mobile number (7 to 15 digits).';
  });
  f.experience.forEach((r, i) => {
    if (blank({ ...r, workMode: '' })) return;
    if (!r.company.trim()) e[`experience.${i}.company`] = 'Company is required.';
    if (r.fromDate && r.toDate && r.toDate < r.fromDate) e[`experience.${i}.toDate`] = 'End date is before the start date.';
  });
  f.education.forEach((r, i) => {
    if (blank(r)) return;
    if (!r.qualification.trim()) e[`education.${i}.qualification`] = 'Qualification is required.';
    if (r.startYear.trim() && !year(r.startYear)) e[`education.${i}.startYear`] = 'Enter a year between 1950 and 2100.';
    if (r.endYear.trim() && !year(r.endYear)) e[`education.${i}.endYear`] = 'Enter a year between 1950 and 2100.';
    else if (year(r.startYear) && year(r.endYear) && Number(r.endYear) < Number(r.startYear)) e[`education.${i}.endYear`] = 'Ending year is before the starting year.';
  });
  f.family.forEach((r, i) => {
    if (blank(r)) return;
    if (!r.name.trim()) e[`family.${i}.name`] = 'Name is required.';
    if (!r.relationship.trim()) e[`family.${i}.relationship`] = 'Relationship is required.';
    if (r.dateOfBirth && r.dateOfBirth >= todayISO()) e[`family.${i}.dateOfBirth`] = 'Date of birth must be in the past.';
  });
  return e;
}

/** The employment checks the server makes (BR-EMP-002), so the form can say what to fix before saving. */
function validateJob(j: Job, needsDesignation: boolean): Errs {
  const e: Errs = {};
  if (!j.fullName.trim()) e.fullName = 'Name is required.';
  if (!j.companyId) e.companyId = 'Choose an organization.';
  if (!j.departmentId) e.departmentId = 'Choose a department.';
  if (j.departmentId && needsDesignation && !j.designationId) e.designationId = 'Choose a designation.';
  if (!j.dateOfJoining) e.dateOfJoining = 'Joining date is required.';
  return e;
}

const BASE_TABS = ['Personal', 'Employment', 'Emergency', 'Experience & Education', 'Family'];
type Tab = string;
const IB_KEYS = new Set<string>(Object.keys(IB_LABELS));
const TAB_OF = (key: string, idTab: string): Tab => {
  const head = key.split('.')[0];
  if (IB_KEYS.has(head)) return BANK_TAB_KEYS.includes(head as IbKey) ? 'Bank & PF' : idTab;
  if (['workPhone', 'extension', 'seatingLocation', 'probationEnd', 'locationId', 'companyId', 'departmentId', 'designationId', 'reportingManagerId', 'employmentType', 'dateOfJoining'].includes(head)) return 'Employment';
  if (head === 'emergencyContacts') return 'Emergency';
  if (['experience', 'education', 'totalExperience'].includes(head)) return 'Experience & Education';
  if (head === 'family') return 'Family';
  return 'Personal';
};

export function ServerProfileEdit({ code }: { code: string }) {
  const [state, setState] = useState<{ code: string; e?: ServerEmployee; p?: ServerProfileData; ib?: ServerIdentityBank | null; missing?: boolean; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Identity & bank only for those allowed to change it; otherwise the tabs are left out.
    const ib = identityBankApi.get(code).then(
      (x) => (x.canEdit ? x : null),
      () => null,
    );
    Promise.all([employeesApi.get(code), profilesApi.get(code), ib])
      .then(([e, p, ib]) => !cancelled && setState({ code, e, p, ib }))
      .catch((err) => !cancelled && setState({ code, missing: err instanceof ApiError && err.status === 404, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const back = (
    <Link href={`/directory/${encodeURIComponent(code)}`} className="svc-back">
      <ArrowLeftIcon /> Back to profile
    </Link>
  );
  const loaded = state?.code === code ? state : null;
  if (!loaded) {
    return (
      <div>
        {back}
        <Card>
          <div className="ad-foot">Loading…</div>
        </Card>
      </div>
    );
  }
  if (!loaded.e || !loaded.p) {
    return (
      <div>
        {back}
        <Card>
          <EmptyState icon={<PeopleIcon />} title={loaded.missing ? 'Employee not found' : 'Could not load this profile'} description={loaded.missing ? 'Nobody with this ID is in the part of the directory you can see.' : (loaded.error ?? '')} />
        </Card>
      </div>
    );
  }
  if (!loaded.p.canEdit) {
    return (
      <div>
        {back}
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <h3>You can&apos;t edit employee records</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Editing is limited to Super Admin, HR and Office Admin. Raise a change request from My Space instead.</p>
        </div>
      </div>
    );
  }
  return <Editor key={loaded.e.id} e={loaded.e} p={loaded.p} ib={loaded.ib ?? null} />;
}

function Editor({ e, p, ib: ibLoaded }: { e: ServerEmployee; p: ServerProfileData; ib: ServerIdentityBank | null }) {
  const router = useRouter();
  const { locations, companies, departments, designations, locationDef, locationName } = useOrg();
  const orig = useMemo(() => toForm(p), [p]);
  const [form, setForm] = useState<Form>(orig);
  const [jobOrig, setJobOrig] = useState<Job>(() => jobOf(e));
  const [job, setJob] = useState<Job>(() => jobOf(e));
  const [tab, setTab] = useState<Tab>('Personal');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [adapted, setAdapted] = useState<string[]>([]);
  const [people, setPeople] = useState<ServerEmployee[] | null>(null);
  const [ib, setIb] = useState<ServerIdentityBank | null>(ibLoaded);
  const ibOrig = useMemo(() => (ib ? ibFormOf(ib) : null), [ib]);
  const [ibForm, setIbForm] = useState<IbForm | null>(ibOrig);
  const setIbField = (k: IbKey, val: string) => setIbForm((f) => (f ? { ...f, [k]: val } : f));

  // Everyone, for the manager picker (editors see the whole directory).
  useEffect(() => {
    let cancelled = false;
    employeesApi
      .all()
      .then((r) => !cancelled && setPeople(r.items))
      .catch(() => !cancelled && setPeople([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const tplOf = (loc: string) => locationDef(loc)?.template ?? 'uae';
  const isIndia = tplOf(job.locationId) === 'india';
  const groups = isIndia ? EMERGENCY_GROUPS.india : EMERGENCY_GROUPS.uae;
  // A move to the other country clears its identity and bank details on save, so they are edited after the move.
  const ibMoving = !!ib && (tplOf(job.locationId) === 'india') !== (ib.template === 'INDIA');
  const ibEditable = !!ib && !!ibForm && !ibMoving;
  const idTab = ib ? identityTabName(ib) : '';
  const TABS = ib ? [...BASE_TABS.slice(0, 2), idTab, ...BASE_TABS.slice(2), 'Bank & PF'] : BASE_TABS;
  const v = form.v;
  const set = (k: ProfileTextKey, val: string) => setForm((f) => ({ ...f, v: { ...f.v, [k]: val } }));
  const setList = <K extends Exclude<keyof Form, 'v'>>(k: K, val: Form[K]) => setForm((f) => ({ ...f, [k]: val }));
  const setJ = (patch: Partial<Job>) => setJob((j) => ({ ...j, ...patch }));

  /* organisation cascade (BR-EMP-002): what fits the chosen location and organization */
  const operatesIn = (c: { location: string }, loc: string) => c.location === 'Both' || c.location === loc;
  const companyOptions = companies.filter((c) => c.id === job.companyId || (c.status === 'Active' && operatesIn(c, job.locationId)));
  const deptOptions = departments.filter((d) => d.companyId === job.companyId && (d.locations.includes(job.locationId) || d.id === job.departmentId));
  const desigOptions = designations.filter((d) => d.departmentId === job.departmentId);
  const managerOptions = useMemo(() => {
    if (!people) return [];
    const below = new Set<string>();
    const walk = (id: string) =>
      people.filter((x) => x.reportingManager?.id === id && !below.has(x.id)).forEach((x) => (below.add(x.id), walk(x.id)));
    walk(e.id);
    return people.filter((x) => x.id !== e.id && !below.has(x.id) && x.status !== 'INACTIVE').map((x) => ({ value: x.id, label: x.name, meta: x.employeeCode }));
  }, [people, e.id]);

  /* Changing the work location adjusts what depends on it, and says what it did (as the demo editor does). */
  const changeLocation = (loc: string) => {
    if (loc === job.locationId) return;
    const notes: string[] = [];
    const next: Job = { ...job, locationId: loc };
    const co = companies.find((c) => c.id === next.companyId);
    if (co && !operatesIn(co, loc)) {
      notes.push(`${co.name} does not operate in ${locationName(loc)}, so organization, department and designation were cleared. Choose them again.`);
      next.companyId = '';
      next.departmentId = '';
      next.designationId = '';
    } else if (next.departmentId && !departments.find((d) => d.id === next.departmentId)?.locations.includes(loc)) {
      notes.push(`The department does not operate in ${locationName(loc)}, so department and designation were cleared. Choose them again.`);
      next.departmentId = '';
      next.designationId = '';
    }
    const seating = locationDef(loc)?.seating ?? [];
    let nextForm = form;
    if (form.v.seatingLocation && !seating.includes(form.v.seatingLocation)) {
      notes.push(`Seating location "${form.v.seatingLocation}" is not used in ${locationName(loc)} and was cleared.`);
      nextForm = { ...nextForm, v: { ...nextForm.v, seatingLocation: '' } };
    }
    const from = tplOf(job.locationId);
    const to = tplOf(loc);
    if (from !== to) {
      const map = (g: string) => {
        const i = (EMERGENCY_GROUPS[from] as readonly string[]).indexOf(g);
        return i === -1 ? g : EMERGENCY_GROUPS[to][i];
      };
      nextForm = { ...nextForm, emergencyContacts: nextForm.emergencyContacts.map((c) => ({ ...c, group: map(c.group) })) };
      notes.push(`Emergency contact groups switched to the ${to === 'india' ? 'India' : 'UAE'} list.`);
      if (ib) {
        notes.push(`Saving clears the ${from === 'india' ? 'India' : 'UAE'} identity fields and the bank details (the passport stays). Add the ${to === 'india' ? 'India' : 'UAE'} details after saving.`);
        setIbForm(ibOrig);
      }
    }
    setJob(next);
    setForm(nextForm);
    setAdapted(notes);
  };

  const jobBody = useMemo(() => jobChanges(jobOrig, job), [jobOrig, job]);
  const body = useMemo(() => changesOf(orig, form), [orig, form]);
  const ibBody = useMemo(() => (ibEditable && ibOrig && ibForm ? ibChanges(ibOrig, ibForm) : {}), [ibEditable, ibOrig, ibForm]);
  const changed = [...Object.keys(jobBody), ...Object.keys(body), ...Object.keys(ibBody)];
  const labelOf = (k: string) => LABELS[k as keyof typeof LABELS] ?? IB_LABELS[k as IbKey] ?? k;
  const errors = useMemo(
    () => ({ ...validateJob(job, desigOptions.length > 0), ...validate(form, groups), ...(ibEditable && ib && ibForm ? validateIb(ibForm, ib) : {}) }),
    [job, form, groups, desigOptions.length, ibEditable, ib, ibForm],
  );
  const errorList = Object.entries(errors).map(([key, msg]) => ({ key, msg, tab: TAB_OF(key, idTab) }));
  const errorTabs = new Set(errorList.map((x) => x.tab));
  const err = (k: string) => (attempted ? errors[k] : undefined);

  // Warn before closing the browser tab with unsaved changes.
  useEffect(() => {
    if (!changed.length) return;
    const h = (ev: BeforeUnloadEvent) => (ev.preventDefault(), (ev.returnValue = ''));
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [changed.length]);

  const profileHref = `/directory/${encodeURIComponent(e.employeeCode)}`;
  const leave = (href: string) => (changed.length ? setLeaveTo(href) : router.push(href));

  const save = async () => {
    setAttempted(true);
    setServerError('');
    if (errorList.length) {
      setTab(errorList[0].tab);
      return;
    }
    if (!changed.length) return;
    setSaving(true);
    // Employment first: a move between UAE and India switches the stored contact groups the profile save then checks.
    const hasJob = Object.keys(jobBody).length > 0;
    if (hasJob) {
      try {
        await employeesApi.updateEmployment(e.employeeCode, jobBody);
        setJobOrig(job);
      } catch (x) {
        setServerError(errorMessage(x));
        setSaving(false);
        return;
      }
    }
    try {
      if (Object.keys(body).length) await profilesApi.update(e.employeeCode, body);
    } catch (x) {
      setServerError(hasJob ? `The employment details were saved, but the other changes were not: ${errorMessage(x)}` : errorMessage(x));
      setSaving(false);
      return;
    }
    try {
      if (Object.keys(ibBody).length) setIb(await identityBankApi.update(e.employeeCode, ibBody));
      try {
        sessionStorage.setItem('gsit.flash', JSON.stringify({ code: e.employeeCode, labels: changed.map(labelOf) }));
      } catch {
        /* the banner is a nicety */
      }
      router.push(profileHref);
    } catch (x) {
      const earlier = hasJob || Object.keys(body).length > 0;
      setServerError(earlier ? `The other changes were saved, but the identity and bank details were not: ${errorMessage(x)}` : errorMessage(x));
      setSaving(false);
    }
  };

  const input = (k: ProfileTextKey, props: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    props.type === 'date' ? <DateField value={v[k]} onChange={(ev) => set(k, ev.target.value)} /> : <input {...props} value={v[k]} onChange={(ev) => set(k, ev.target.value)} />;
  const select = (k: ProfileTextKey, options: string[]) => (
    <select value={v[k]} onChange={(ev) => set(k, ev.target.value)}>
      <option value="">{v[k] ? 'Not specified' : 'Select…'}</option>
      {withCurrent(options, v[k]).map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
  const ro = (value: string) => <input value={value} readOnly style={{ background: 'var(--bg)' }} />;

  return (
    <div className="editpage">
      <Link
        href={profileHref}
        className="svc-back"
        onClick={(ev) => {
          if (!changed.length) return;
          ev.preventDefault();
          setLeaveTo(profileHref);
        }}
      >
        <ArrowLeftIcon /> Back to profile
      </Link>

      <ConfirmDialog
        open={leaveTo !== null}
        title="Discard unsaved changes?"
        message={`You have ${changed.length} unsaved change${changed.length === 1 ? '' : 's'} on ${e.name}. Leaving now discards them.`}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setLeaveTo(null)}
        onConfirm={() => {
          const to = leaveTo;
          setLeaveTo(null);
          if (to) router.push(to);
        }}
      />

      {adapted.length > 0 && (
        <div className="note-box warn adapt-note">
          <ShieldIcon />
          <div style={{ flex: 1 }}>
            <b>Location changed to {locationName(job.locationId)} — these fields were adjusted:</b>
            <ul>
              {adapted.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <button className="icon-act" onClick={() => setAdapted([])} aria-label="Dismiss">
            <XIcon />
          </button>
        </div>
      )}

      {attempted && errorList.length > 0 && (
        <div className="fm-errsum" role="alert">
          <div>
            <b>
              Fix {errorList.length} error{errorList.length === 1 ? '' : 's'} to save
            </b>
            <ul>
              {errorList.map((x) => (
                <li key={x.key}>
                  <button type="button" onClick={() => setTab(x.tab)}>
                    {x.tab}: {x.msg}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {serverError && (
        <div className="fm-errsum" role="alert">
          <div>
            <b>The server did not save the changes</b>
            <ul>
              <li>{serverError}</li>
            </ul>
          </div>
        </div>
      )}

      <div className="card edhead">
        <div className="profile-hd">
          <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
            {e.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]!.toUpperCase())
              .join('')}
          </div>
          <div style={{ flex: 1 }}>
            <h2>Edit {e.name}</h2>
            <div className="meta">
              {[e.employeeCode, e.designation?.name, e.department?.name, locationName(e.location.id)].filter(Boolean).map((x, i) => (
                <span key={i}>
                  {i > 0 && '· '}
                  {x}
                </span>
              ))}
            </div>
            <div className="flags">
              <span className="roleflag">Editing — changes apply when you save</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ed-layout">
        <nav className="ed-nav" aria-label="Sections">
          {TABS.map((t, i) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`ed-ni ${tab === t ? 'on' : ''}`} aria-current={tab === t ? 'page' : undefined}>
              <span className="ed-nn">{i + 1}</span>
              <span className="ed-nl">{t}</span>
              {attempted && errorTabs.has(t) && <span className="tab-err" title="This section has errors" />}
            </button>
          ))}
        </nav>

        <div className="card ed-main">
          <div style={{ padding: 22 }}>
            {tab === 'Personal' && (
              <div>
                <Sub first>Identity</Sub>
                <div className="form-grid">
                  <Fg label="Full name (as per passport)" required error={err('fullName')}>
                    <input value={job.fullName} onChange={(ev) => setJ({ fullName: ev.target.value })} />
                  </Fg>
                  {isIndia && (
                    <>
                      <Fg label="First name">{input('firstName')}</Fg>
                      <Fg label="Middle name">{input('middleName')}</Fg>
                      <Fg label="Last name">{input('lastName')}</Fg>
                    </>
                  )}
                  <Fg label="Date of birth" error={err('dateOfBirth')}>
                    {input('dateOfBirth', { type: 'date' })}
                  </Fg>
                  <Fg label="Nationality">{select('nationality', NATIONALITIES)}</Fg>
                  <Fg label="Gender">{select('gender', GENDERS)}</Fg>
                  <Fg label="Marital status">{select('maritalStatus', MARITAL_STATUSES)}</Fg>
                  <Fg label="Blood group">{select('bloodGroup', BLOOD_GROUPS)}</Fg>
                </div>
                <Sub>Contact</Sub>
                <div className="form-grid">
                  <Fg label="Personal mobile" error={err('personalMobile')}>
                    {input('personalMobile', { type: 'tel' })}
                  </Fg>
                  <Fg label="Personal email" error={err('personalEmail')}>
                    {input('personalEmail', { type: 'email' })}
                  </Fg>
                  <Fg label="Work email (sign-in ID)" hint="Used to sign in, so it can't be changed here.">
                    {ro(e.email)}
                  </Fg>
                </div>
                <Sub>Addresses</Sub>
                <div className="form-grid">
                  <Fg label="Current address" full>
                    <textarea rows={4} value={v.currentAddress} onChange={(ev) => set('currentAddress', ev.target.value)} style={TEXTAREA} />
                  </Fg>
                  <Fg label="Permanent address (home country)" full>
                    <textarea rows={4} value={v.permanentAddress} onChange={(ev) => set('permanentAddress', ev.target.value)} style={TEXTAREA} />
                  </Fg>
                </div>
              </div>
            )}

            {tab === 'Employment' && (
              <div>
                <Sub first>Job</Sub>
                <div className="form-grid">
                  <Fg label="Employee ID" hint="Assigned at onboarding.">
                    {ro(e.employeeCode)}
                  </Fg>
                  <Fg label="Organization" required error={err('companyId')} hint={!companyOptions.length ? `No active organization operates in ${locationName(job.locationId)}.` : undefined}>
                    <select value={job.companyId} onChange={(ev) => setJ({ companyId: ev.target.value, departmentId: '', designationId: '' })}>
                      {!job.companyId && <option value="">Select…</option>}
                      {companyOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Fg>
                  <Fg
                    label="Department"
                    required
                    error={err('departmentId')}
                    hint={job.companyId && !deptOptions.length ? `This organization has no departments in ${locationName(job.locationId)}. Choose another organization, or add departments under Administration → Departments & Designations.` : undefined}
                  >
                    <select value={job.departmentId} onChange={(ev) => setJ({ departmentId: ev.target.value, designationId: '' })} disabled={!job.companyId}>
                      <option value="">{job.companyId ? 'Select…' : 'Choose an organization first'}</option>
                      {deptOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </Fg>
                  <Fg label="Designation" required={desigOptions.length > 0} error={err('designationId')}>
                    <select value={job.designationId} onChange={(ev) => setJ({ designationId: ev.target.value })} disabled={!job.departmentId}>
                      <option value="">{job.departmentId ? (desigOptions.length ? 'Select…' : 'No designations in this department') : 'Choose a department first'}</option>
                      {desigOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  </Fg>
                  <Fg label="Reporting manager" hint="Nobody in their own reporting line is listed." error={err('reportingManagerId')}>
                    <SearchSelect
                      options={[
                        { value: '', label: 'No manager' },
                        ...(job.reportingManagerId && !managerOptions.some((o) => o.value === job.reportingManagerId) && e.reportingManager
                          ? [{ value: e.reportingManager.id, label: e.reportingManager.name, meta: e.reportingManager.employeeCode }]
                          : []),
                        ...managerOptions,
                      ]}
                      value={job.reportingManagerId}
                      onChange={(val) => setJ({ reportingManagerId: val })}
                      placeholder={people ? 'Search by name or employee ID…' : 'Loading people…'}
                    />
                  </Fg>
                  <Fg label="Employment type">
                    <select value={job.employmentType} onChange={(ev) => setJ({ employmentType: ev.target.value as Job['employmentType'] })}>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Fg>
                  <Fg label="Employment status" hint="Managed by Onboarding and Offboarding.">
                    {ro(e.status.charAt(0) + e.status.slice(1).toLowerCase())}
                  </Fg>
                </div>
                <Sub>Dates</Sub>
                <div className="form-grid">
                  <Fg label="Joining date" required error={err('dateOfJoining')}>
                    <DateField value={job.dateOfJoining} onChange={(ev) => setJ({ dateOfJoining: ev.target.value })} />
                  </Fg>
                  <Fg label="Probation completion">{input('probationEnd', { type: 'date' })}</Fg>
                </div>
                <Sub>Placement</Sub>
                <div className="form-grid">
                  <Fg label="Work location" hint="Changing it also updates the fields that depend on the location. A summary appears above.">
                    <select value={job.locationId} onChange={(ev) => changeLocation(ev.target.value)}>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </Fg>
                  <Fg label="Seating location">{select('seatingLocation', locationDef(job.locationId)?.seating ?? [])}</Fg>
                  <Fg label="Probation completion">{input('probationEnd', { type: 'date' })}</Fg>
                  <Fg label="Work phone (official mobile)" error={err('workPhone')}>
                    {input('workPhone', { type: 'tel' })}
                  </Fg>
                  <Fg label="Extension" error={err('extension')}>
                    {input('extension', { inputMode: 'numeric' })}
                  </Fg>
                </div>
              </div>
            )}

            {tab === 'Emergency' && (
              <RowList<Emergency>
                rows={form.emergencyContacts}
                onChange={(r) => setList('emergencyContacts', r)}
                blank={() => ({ group: groups[0], name: '', relationship: '', mobile: '' })}
                title="Contact"
                addLabel="Add emergency contact"
                empty="No emergency contacts on file."
                render={(r, up, i) => (
                  <>
                    <Fg label="Group" full error={err(`emergencyContacts.${i}.group`)}>
                      <select value={r.group} onChange={(ev) => up({ group: ev.target.value })}>
                        {withCurrent([...groups], r.group).map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </Fg>
                    <Fg label="Name" required error={err(`emergencyContacts.${i}.name`)}>
                      <input value={r.name} onChange={(ev) => up({ name: ev.target.value })} />
                    </Fg>
                    <Fg label="Relationship" required error={err(`emergencyContacts.${i}.relationship`)}>
                      <input value={r.relationship} onChange={(ev) => up({ relationship: ev.target.value })} />
                    </Fg>
                    <Fg label="Mobile number" required error={err(`emergencyContacts.${i}.mobile`)}>
                      <input type="tel" value={r.mobile} onChange={(ev) => up({ mobile: ev.target.value })} />
                    </Fg>
                  </>
                )}
              />
            )}

            {tab === 'Experience & Education' && (
              <div>
                <Sub first>Work experience</Sub>
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <Fg label="Total experience before joining">{input('totalExperience', { placeholder: 'e.g. 6 years' })}</Fg>
                </div>
                <RowList<Experience>
                  rows={form.experience}
                  onChange={(r) => setList('experience', r)}
                  blank={() => ({ company: '', title: '', location: '', workMode: 'Onsite', fromDate: '', toDate: '' })}
                  title="Experience"
                  addLabel="Add work experience"
                  empty="No previous experience on file."
                  render={(r, up, i) => (
                    <>
                      <Fg label="Company" required error={err(`experience.${i}.company`)}>
                        <input value={r.company} onChange={(ev) => up({ company: ev.target.value })} />
                      </Fg>
                      <Fg label="Job title">
                        <input value={r.title} onChange={(ev) => up({ title: ev.target.value })} />
                      </Fg>
                      <Fg label="Location">
                        <input value={r.location} onChange={(ev) => up({ location: ev.target.value })} />
                      </Fg>
                      <Fg label="Mode of work">
                        <select value={r.workMode} onChange={(ev) => up({ workMode: ev.target.value })}>
                          <option value="">Not specified</option>
                          {withCurrent(WORK_MODES, r.workMode).map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </Fg>
                      <Fg label="From">
                        <DateField value={r.fromDate} onChange={(ev) => up({ fromDate: ev.target.value })} />
                      </Fg>
                      <Fg label="To" error={err(`experience.${i}.toDate`)}>
                        <DateField value={r.toDate} onChange={(ev) => up({ toDate: ev.target.value })} />
                      </Fg>
                    </>
                  )}
                />
                <Sub>Education</Sub>
                <RowList<Education>
                  rows={form.education}
                  onChange={(r) => setList('education', r)}
                  blank={() => ({ qualification: '', institution: '', course: '', field: '', startYear: '', endYear: '' })}
                  title="Education"
                  addLabel="Add education"
                  empty="No education on file."
                  render={(r, up, i) => (
                    <>
                      <Fg label="Qualification" required error={err(`education.${i}.qualification`)}>
                        <input value={r.qualification} placeholder="e.g. Bachelor's Degree" onChange={(ev) => up({ qualification: ev.target.value })} />
                      </Fg>
                      <Fg label="School / university">
                        <input value={r.institution} onChange={(ev) => up({ institution: ev.target.value })} />
                      </Fg>
                      <Fg label="Course">
                        <input value={r.course} onChange={(ev) => up({ course: ev.target.value })} />
                      </Fg>
                      <Fg label="Field of study">
                        <input value={r.field} onChange={(ev) => up({ field: ev.target.value })} />
                      </Fg>
                      <Fg label="Starting year" error={err(`education.${i}.startYear`)}>
                        <input inputMode="numeric" placeholder="YYYY" value={r.startYear} onChange={(ev) => up({ startYear: ev.target.value })} />
                      </Fg>
                      <Fg label="Ending year" error={err(`education.${i}.endYear`)}>
                        <input inputMode="numeric" placeholder="YYYY" value={r.endYear} onChange={(ev) => up({ endYear: ev.target.value })} />
                      </Fg>
                    </>
                  )}
                />
              </div>
            )}

            {ib && ibForm && tab === idTab &&
              (ibMoving ? (
                <p className="sb">The work location is changing to another country. Save the move first, then add the identity details for the new country.</p>
              ) : (
                <IdentityFields ib={ib} f={ibForm} set={setIbField} err={err} />
              ))}

            {ib && ibForm && tab === 'Bank & PF' &&
              (ibMoving ? (
                <p className="sb">The work location is changing to another country. Save the move first, then add the bank details for the new country.</p>
              ) : (
                <BankFields ib={ib} f={ibForm} set={setIbField} err={err} locationLabel={locationName(job.locationId)} />
              ))}

            {tab === 'Family' && (
              <RowList<Family>
                rows={form.family}
                onChange={(r) => setList('family', r)}
                blank={() => ({ name: '', relationship: '', occupation: '', dateOfBirth: '' })}
                title="Family member"
                addLabel="Add family member"
                empty="No family members on file."
                render={(r, up, i) => (
                  <>
                    <Fg label="Name" required error={err(`family.${i}.name`)}>
                      <input value={r.name} onChange={(ev) => up({ name: ev.target.value })} />
                    </Fg>
                    <Fg label="Relationship" required error={err(`family.${i}.relationship`)}>
                      <input value={r.relationship} onChange={(ev) => up({ relationship: ev.target.value })} />
                    </Fg>
                    <Fg label="Occupation">
                      <input value={r.occupation} onChange={(ev) => up({ occupation: ev.target.value })} />
                    </Fg>
                    <Fg label="Date of birth" error={err(`family.${i}.dateOfBirth`)}>
                      <DateField value={r.dateOfBirth} onChange={(ev) => up({ dateOfBirth: ev.target.value })} />
                    </Fg>
                  </>
                )}
              />
            )}
          </div>
        </div>
      </div>

      <div className="editbar">
        <div className="editbar-l">
          {attempted && errorList.length > 0 ? (
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
              Fix {errorList.length} error{errorList.length === 1 ? '' : 's'} to save
            </span>
          ) : changed.length ? (
            <span title={changed.map(labelOf).join(', ')}>
              <b>{changed.length}</b> unsaved change{changed.length === 1 ? '' : 's'}: {changed.map(labelOf).join(', ')}
            </span>
          ) : (
            <span style={{ color: 'var(--muted)' }}>No changes yet</span>
          )}
        </div>
        <Button variant="ghost" onClick={() => leave(profileHref)} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving || !changed.length}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
