'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { ASSETS, EMPLOYEES } from '@/lib/data';
import { REQUIRED_DOCS } from '@/lib/profiles';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { useDocuments } from '@/context/DocumentsContext';
import { Employee } from '@/lib/types';
import { FIELDS, DocRow, EducationRow, EmergencyRow, EmployeeForm, ExperienceRow, FamilyRow, MoneyRow, canEditEmployees, canEditSensitive, diffForm, filled, filledContacts, saveEmployee, toForm, useEmployeeVersion } from '@/lib/employeeStore';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Button } from '@/components/ui/Card';
import { ArrowLeftIcon, PlusIcon, ShieldIcon, UploadIcon, XIcon } from '@/components/icons';

/* ---------- small form helpers ---------- */
type Errs = Record<string, string>;
const withCurrent = (options: string[], current: string) => (current && !options.includes(current) ? [current, ...options] : options);
const GENDERS = ['Male', 'Female', 'Other'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
const BLOOD = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const TYPES = ['Permanent', 'Contract', 'Probation'];
const MODES = ['Onsite', 'Remote', 'Hybrid'];

function Fg({ label, required, full, hint, error, children }: { label: string; required?: boolean; full?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={`fg ${full ? 'full' : ''}`}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {error ? <span className="hint" style={{ color: 'var(--danger)' }}>{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

const Sub = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div className="subhd" style={first ? { marginTop: 0 } : { marginTop: 22 }}>
    {children}
  </div>
);

const TEXTAREA: React.CSSProperties = { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: 'inherit', fontSize: 13, resize: 'vertical' };

/** A list of repeatable entries, each a small card with a remove button. */
function RowList<T extends object>({ rows, onChange, blank, title, addLabel, empty, render }: { rows: T[]; onChange: (r: T[]) => void; blank: () => T; title: string; addLabel: string; empty: string; render: (row: T, set: (patch: Partial<T>) => void, i: number) => React.ReactNode }) {
  return (
    <div>
      {!rows.length && <div className="erow-empty">{empty}</div>}
      {rows.map((row, i) => (
        <div key={i} className="erow">
          <div className="erow-h">
            <b>
              {title} #{i + 1}
            </b>
            <button type="button" className="icon-act" title={`Remove ${title.toLowerCase()} #${i + 1}`} aria-label={`Remove ${title.toLowerCase()} #${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <XIcon />
            </button>
          </div>
          <div className="form-grid">{render(row, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))), i)}</div>
        </div>
      ))}
      <button type="button" className="addnew" onClick={() => onChange([...rows, blank()])}>
        <PlusIcon /> {addLabel}
      </button>
    </div>
  );
}

/** Label + amount lines for salary components. */
function MoneyList({ rows, onChange, currency, addLabel, errs, prefix }: { rows: MoneyRow[]; onChange: (r: MoneyRow[]) => void; currency: string; addLabel: string; errs: Errs; prefix: string }) {
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="mrow">
          <div>
            <input value={r.label} placeholder="Component, e.g. Basic salary" onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Component name" />
            {errs[`${prefix}.${i}.label`] && <span className="hint" style={{ color: 'var(--danger)' }}>{errs[`${prefix}.${i}.label`]}</span>}
          </div>
          <div>
            <div className="mamt">
              <span>{currency}</span>
              <input type="number" min="0" value={r.amount} placeholder="0" onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} aria-label="Amount" />
            </div>
            {errs[`${prefix}.${i}.amount`] && <span className="hint" style={{ color: 'var(--danger)' }}>{errs[`${prefix}.${i}.amount`]}</span>}
          </div>
          <button type="button" className="icon-act" title="Remove line" aria-label="Remove line" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <XIcon />
          </button>
        </div>
      ))}
      <button type="button" className="addnew" onClick={() => onChange([...rows, { label: '', amount: '' }])}>
        <PlusIcon /> {addLabel}
      </button>
    </div>
  );
}

const sum = (rows: MoneyRow[]) => filled(rows).reduce((n, x) => n + (Number(x.amount) || 0), 0);
const fmt = (currency: string, n: number) => `${currency} ${n.toLocaleString('en-US')}`;

/* ---------- document upload ---------- */
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.doc,.docx';
const MAX_BYTES = 10 * 1024 * 1024;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Attach, replace or open the file kept for one document of one employee. Files attach right away. */
function useAttach(empId: string, name: string, onAttached?: () => void) {
  const { fileFor, upload } = useDocuments();
  const [err, setErr] = useState('');
  const file = fileFor(empId, name);
  const take = (f?: File | null) => {
    if (!f) return;
    if (!/\.(pdf|png|jpe?g|docx?)$/i.test(f.name)) return setErr('Use a PDF, image or Word file.');
    if (f.size > MAX_BYTES) return setErr('That file is over 10 MB.');
    setErr('');
    upload(empId, name, f);
    onAttached?.();
  };
  return { file, err, take };
}

function FileAttach({ empId, name, onAttached }: { empId: string; name: string; onAttached?: () => void }) {
  const { file, err, take } = useAttach(empId, name, onAttached);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="udoc-f">
      {file ? (
        <>
          <a href={file.url} target="_blank" rel="noreferrer" className="udoc-name" title={`Open ${file.name}`}>
            {file.name}
          </a>
          <small>
            {kb(file.size)} · {file.uploadedOn}
          </small>
        </>
      ) : (
        <span className="udoc-none">No file attached</span>
      )}
      <input ref={ref} type="file" accept={ACCEPT} hidden onChange={(ev) => (take(ev.target.files?.[0]), (ev.target.value = ''))} />
      <button type="button" className="btn ghost sm" disabled={!name.trim()} onClick={() => ref.current?.click()}>
        <UploadIcon /> {file ? 'Replace' : 'Upload'}
      </button>
      {err && <span className="udoc-err">{err}</span>}
    </span>
  );
}

/** A required document: tick when on file, attach the file here, or drop it onto the row. */
function RequiredDocRow({ empId, name, ticked, onTick }: { empId: string; name: string; ticked: boolean; onTick: (on: boolean) => void }) {
  const { file, err, take } = useAttach(empId, name, () => onTick(true));
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const on = ticked || !!file;
  return (
    <div
      className={`udoc ${on ? 'on' : ''} ${over ? 'over' : ''}`}
      onDragOver={(ev) => (ev.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(ev) => (ev.preventDefault(), setOver(false), take(ev.dataTransfer.files?.[0]))}
    >
      <label className="udoc-l" title={file ? 'A file is attached, so this stays ticked' : 'Tick when the document is on file'}>
        <input type="checkbox" checked={on} disabled={!!file} onChange={(ev) => onTick(ev.target.checked)} />
        <span className="nm">{name}</span>
      </label>
      <span className="udoc-f">
        {file ? (
          <>
            <a href={file.url} target="_blank" rel="noreferrer" className="udoc-name" title={`Open ${file.name}`}>
              {file.name}
            </a>
            <small>
              {kb(file.size)} · {file.uploadedOn}
            </small>
          </>
        ) : (
          <span className="udoc-none">{on ? 'On file (no copy attached)' : 'Drop a file here or upload'}</span>
        )}
        <input ref={ref} type="file" accept={ACCEPT} hidden onChange={(ev) => (take(ev.target.files?.[0]), (ev.target.value = ''))} />
        <button type="button" className="btn ghost sm" onClick={() => ref.current?.click()}>
          <UploadIcon /> {file ? 'Replace' : 'Upload'}
        </button>
      </span>
      {err && <div className="udoc-err">{err}</div>}
    </div>
  );
}

/* ---------- validation ---------- */
function validate(f: EmployeeForm, india: boolean): Errs {
  const e: Errs = {};
  const v = f.v;
  const today = new Date().toISOString().slice(0, 10);
  if (!v.name.trim()) e.name = 'Name is required.';
  if (v.dob && v.dob > today) e.dob = 'Date of birth cannot be in the future.';
  if (!v.dateOfJoining) e.dateOfJoining = 'Joining date is required.';
  if (v.personalEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.personalEmail.trim())) e.personalEmail = 'That doesn’t look like an email address.';
  if (!v.company) e.company = 'Choose an organization.';
  if (!v.department) e.department = 'Choose a department.';
  if (!v.designation) e.designation = 'Choose a designation.';
  if (!v.passportNumber.trim()) e.passportNumber = 'Passport number is required.';
  if (india) {
    if (v.aadhaar.trim() && !/^\d{12}$/.test(v.aadhaar.replace(/\s/g, ''))) e.aadhaar = 'Aadhaar is 12 digits.';
    if (v.pan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.pan.trim().toUpperCase())) e.pan = 'PAN looks like ABCDE1234F.';
    if (v.uan.trim() && !/^\d{12}$/.test(v.uan.trim())) e.uan = 'UAN is 12 digits.';
  } else {
    if (v.emiratesId.trim() && !/^784-\d{4}-\d{7}-\d$/.test(v.emiratesId.trim())) e.emiratesId = 'Format: 784-YYYY-NNNNNNN-N.';
    if (v.labourCardIssue && v.labourCardExpiry && v.labourCardExpiry < v.labourCardIssue) e.labourCardExpiry = 'Expiry is before the issue date.';
  }
  if (!v.bankName.trim()) e.bankName = 'Bank name is required.';
  if (!v.accountNumber.trim()) e.accountNumber = india ? 'Account number is required.' : 'IBAN is required.';
  f.emergency.forEach((r, i) => {
    if (filledContacts([r]).length && !r.name.trim()) e[`emergency.${i}.name`] = 'Name is required.';
    if (filledContacts([r]).length && !r.mobile.trim()) e[`emergency.${i}.mobile`] = 'Mobile number is required.';
  });
  f.experience.forEach((r, i) => {
    if (filled([r]).length && !r.company.trim()) e[`experience.${i}.company`] = 'Company is required.';
    if (r.from && r.to && r.to < r.from) e[`experience.${i}.to`] = 'End date is before the start date.';
  });
  f.education.forEach((r, i) => {
    if (filled([r]).length && !r.institution.trim()) e[`education.${i}.institution`] = 'School / university is required.';
    if (r.startYear && r.endYear && Number(r.endYear) < Number(r.startYear)) e[`education.${i}.endYear`] = 'Ending year is before the starting year.';
  });
  f.family.forEach((r, i) => {
    if (filled([r]).length && !r.name.trim()) e[`family.${i}.name`] = 'Name is required.';
  });
  (['earnings', 'deductions'] as const).forEach((k) =>
    f[k].forEach((r, i) => {
      if (!filled([r]).length) return;
      if (!r.label.trim()) e[`${k}.${i}.label`] = 'Name the component.';
      if (r.amount === '' || Number(r.amount) < 0 || Number.isNaN(Number(r.amount))) e[`${k}.${i}.amount`] = 'Enter an amount of 0 or more.';
    }),
  );
  f.documents.forEach((r, i) => {
    if (filled([r]).length && !r.type.trim()) e[`documents.${i}.type`] = 'Document name is required.';
  });
  return e;
}

/* What belongs to one country only. Moving someone between locations drops the other country's details
   (they come back if the move is undone) and switches the lists that depend on the country. */
const UAE_ONLY = ['emiratesId', 'visaExpiry', 'emiratesIdExpiry', 'labourCardIssue', 'labourCardExpiry'];
const INDIA_ONLY = ['aadhaar', 'pan', 'uan'];
const UAE_DOCS = ['Residence Visa', 'Emirates ID', 'Labour Card'];
const TO_INDIA: Record<string, string> = { 'Local Emergency Contact (UAE)': 'Primary Emergency Contact', 'Home Country Emergency Contact': 'Alternate Emergency Contact' };
const TO_UAE: Record<string, string> = { 'Primary Emergency Contact': 'Local Emergency Contact (UAE)', 'Alternate Emergency Contact': 'Home Country Emergency Contact' };
const fieldLabel = (k: string) => FIELDS.find((x) => x.key === k)?.label ?? k;

/** Which tab an error belongs to. */
const TAB_OF = (key: string, idTab: string): string => {
  const head = key.split('.')[0];
  if (['name', 'dob', 'personalEmail'].includes(head)) return 'Personal';
  if (['dateOfJoining', 'company', 'department', 'designation'].includes(head)) return 'Employment';
  if (['passportNumber', 'aadhaar', 'pan', 'uan', 'emiratesId', 'labourCardExpiry'].includes(head)) return idTab;
  if (head === 'emergency') return 'Emergency';
  if (['experience', 'education'].includes(head)) return 'Experience & Education';
  if (head === 'family') return 'Family';
  if (['bankName', 'accountNumber'].includes(head)) return 'Bank & PF';
  if (['earnings', 'deductions'].includes(head)) return 'Salary';
  if (head === 'documents') return 'Documents';
  return 'Personal';
};

export default function EditEmployeePage() {
  const params = useParams<{ code: string }>();
  const version = useEmployeeVersion();
  const { role } = useApp();
  const e = useMemo(() => EMPLOYEES.find((x) => x.employeeCode === params.code), [params.code, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e) return notFound();
  if (!canEditEmployees(role)) return <NoAccess code={e.employeeCode} />;
  return <Editor key={e.id} e={e} />;
}

function NoAccess({ code }: { code: string }) {
  return (
    <div>
      <Link href={`/directory/${code}`} className="svc-back">
        <ArrowLeftIcon /> Back to profile
      </Link>
      <div className="card" style={{ padding: 28, textAlign: 'center' }}>
        <h3>You can&apos;t edit employee records</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6 }}>Editing is limited to Super Admin, HR and Office Admin. Raise a change request from My Space instead.</p>
      </div>
    </div>
  );
}

function Editor({ e }: { e: Employee }) {
  const router = useRouter();
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { companies, departments, designations, locations, locationDef, locationName } = useOrg();
  const sensitive = canEditSensitive(role);
  const [form, setForm] = useState<EmployeeForm>(() => toForm(e));
  const [tab, setTab] = useState('Personal');
  const [attempted, setAttempted] = useState(false);
  const [review, setReview] = useState(false);
  const [adapted, setAdapted] = useState<string[]>([]);
  const { fileFor } = useDocuments();
  const orig = useMemo(() => toForm(e), [e]);

  const v = form.v;
  const set = (k: string, val: string) => setForm((f) => ({ ...f, v: { ...f.v, [k]: val } }));
  const setList = <K extends keyof EmployeeForm>(k: K, val: EmployeeForm[K]) => setForm((f) => ({ ...f, [k]: val }));

  const isIndia = locationDef(v.location)?.template === 'india';
  const idTab = isIndia ? 'Passport / Aadhaar / PAN' : 'Passport / Visa / EID';
  const TABS = ['Personal', 'Employment', idTab, 'Emergency', 'Experience & Education', 'Family', ...(sensitive ? ['Bank & PF', 'Salary'] : []), 'Documents', 'Assets'];
  const requiredDocs = isIndia ? REQUIRED_DOCS.india : REQUIRED_DOCS.uae;
  const currency = v.currency || e.profile.salary.currency;

  const changes = diffForm(e, form);
  const errors = useMemo(() => validate(form, isIndia), [form, isIndia]);
  const errorTabs = new Set(Object.keys(errors).map((k) => TAB_OF(k, idTab)));
  const err = (k: string) => (attempted ? errors[k] : undefined);
  const shownErrors = (key: string) => (attempted ? errors[key] : undefined);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!changes.length) return;
    const h = (ev: BeforeUnloadEvent) => (ev.preventDefault(), (ev.returnValue = ''));
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [changes.length]);

  /* organisation cascade */
  const company = companies.find((c) => c.name === v.company);
  const deptOptions = withCurrent([...new Set(company ? departments.filter((d) => d.companyId === company.id && d.locations.includes(v.location)).map((d) => d.name) : [])], v.department);
  const dept = departments.find((d) => d.companyId === company?.id && d.name === v.department);
  const desigOptions = withCurrent(designations.filter((x) => x.departmentId === dept?.id).map((x) => x.title), v.designation);
  const seating = withCurrent(locationDef(v.location)?.seating ?? [], v.seatingLocation);
  const managerOptions = useMemo(() => {
    const below = new Set<string>();
    const walk = (id: string) => EMPLOYEES.filter((x) => x.reportingManagerId === id).forEach((x) => (below.add(x.id), walk(x.id)));
    walk(e.id);
    return EMPLOYEES.filter((x) => x.id !== e.id && !below.has(x.id) && x.employmentStatus !== 'Inactive').map((x) => ({ value: x.id, label: x.name, meta: x.employeeCode }));
  }, [e.id]);

  const assets = ASSETS.filter((a) => a.assignedTo === e.employeeCode);

  /* Changing the work location also changes everything that depends on it, and says what it did. */
  const tpl = (loc: string) => locationDef(loc)?.template ?? 'uae';
  const changeLocation = (loc: string) => {
    if (loc === form.v.location) return;
    const def = locationDef(loc);
    const from = tpl(form.v.location);
    const to = tpl(loc);
    const back = tpl(orig.v.location) === to;
    const nv: Record<string, string> = { ...form.v, location: loc };
    const next: EmployeeForm = { ...form, v: nv };
    const notes: string[] = [];

    if (def) notes.push(`Working week and leave policy now follow ${def.name}: ${def.workingHours}.`);
    nv.seatingLocation = loc === orig.v.location ? orig.v.seatingLocation : (def?.seating[0] ?? '');
    if (def && nv.currency !== def.currency) {
      nv.currency = def.currency;
      notes.push(`Currency is now ${def.currency}. Salary amounts are not converted, so review them on the Salary tab.`);
    }

    // organisation: keep the department and designation if they also exist in the new location
    const co = companies.find((c) => c.name === nv.company);
    if (loc === orig.v.location && !nv.department) {
      // back to where they started: restore the original placement
      nv.department = orig.v.department;
      nv.designation = orig.v.designation;
    }
    const dep = departments.find((d) => d.companyId === co?.id && d.name === nv.department && d.locations.includes(loc));
    if (!dep) {
      if (nv.department) notes.push(`Department and designation were cleared because ${nv.company} has no "${nv.department}" in ${def?.name ?? loc}. Choose them again.`);
      nv.department = '';
      nv.designation = '';
    } else if (!designations.some((x) => x.departmentId === dep.id && x.title === nv.designation)) {
      nv.designation = '';
      notes.push('Designation was cleared. Choose one for this location.');
    }

    if (to !== from) {
      const drop = to === 'india' ? UAE_ONLY : INDIA_ONLY;
      const bring = to === 'india' ? INDIA_ONLY : UAE_ONLY;
      const dropped = drop.filter((k) => nv[k]);
      drop.forEach((k) => (nv[k] = ''));
      bring.forEach((k) => {
        if (back) nv[k] = orig.v[k];
      });
      if (dropped.length) notes.push(`${to === 'india' ? 'UAE' : 'India'}-only details were cleared (${dropped.map(fieldLabel).join(', ')}). They return if you switch back.`);
      if (to === 'india') notes.push('Add the Aadhaar, PAN and UAN details on the identity and Bank & PF tabs.');
      else notes.push('Add the Emirates ID, visa and labour card details on the identity tab.');

      const modes = to === 'india' ? ['Bank Transfer', 'Cheque'] : ['WPS Transfer', 'Bank Transfer'];
      if (back) nv.paymentMode = orig.v.paymentMode;
      else if (!modes.includes(nv.paymentMode)) {
        nv.paymentMode = modes[0];
        notes.push(`Payment mode is now ${nv.paymentMode}. Review the bank details on the Bank & PF tab.`);
      }
      const required = to === 'india' ? REQUIRED_DOCS.india : REQUIRED_DOCS.uae;
      next.uploadedDocs = back ? [...orig.uploadedDocs] : form.uploadedDocs.filter((d) => required.includes(d));
      next.documents = to === 'india' ? form.documents.filter((d) => !UAE_DOCS.includes(d.type)) : back ? orig.documents.map((d) => ({ ...d })) : form.documents;
      next.emergency = form.emergency.map((r) => ({ ...r, group: (to === 'india' ? TO_INDIA : TO_UAE)[r.group] ?? r.group }));
      notes.push(`Required documents and emergency-contact groups switched to the ${to === 'india' ? 'India' : 'UAE'} lists.`);
    }
    setForm(next);
    setAdapted(notes);
  };

  const save = () => {
    setAttempted(true);
    const first = Object.keys(errors)[0];
    if (first) {
      setTab(TAB_OF(first, idTab));
      return;
    }
    if (!changes.length) return;
    const done = saveEmployee(e.id, form, me.name);
    try {
      sessionStorage.setItem('gsit.flash', JSON.stringify({ code: e.employeeCode, labels: done.map((c) => c.label) }));
    } catch {
      /* the banner is a nicety */
    }
    router.push(`/directory/${e.employeeCode}`);
  };
  const cancel = () => {
    if (changes.length && !window.confirm(`Discard ${changes.length} unsaved change${changes.length === 1 ? '' : 's'}?`)) return;
    router.push(`/directory/${e.employeeCode}`);
  };

  const input = (k: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <input {...props} value={v[k] ?? ''} onChange={(ev) => set(k, ev.target.value)} />;
  const select = (k: string, options: string[]) => (
    <select value={v[k] ?? ''} onChange={(ev) => set(k, ev.target.value)}>
      {withCurrent(options, v[k] ?? '').map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <div className="editpage">
      <Link href={`/directory/${e.employeeCode}`} className="svc-back" onClick={(ev) => changes.length && !window.confirm('Discard your unsaved changes?') && ev.preventDefault()}>
        <ArrowLeftIcon /> Back to profile
      </Link>

      {adapted.length > 0 && (
        <div className="note-box warn adapt-note">
          <ShieldIcon />
          <div style={{ flex: 1 }}>
            <b>Location changed to {locationName(v.location)} — these fields were adjusted:</b>
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

      <div className="card">
        <div className="profile-hd">
          <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
            {e.avatarInitials}
          </div>
          <div style={{ flex: 1 }}>
            <h2>Edit {e.name}</h2>
            <div className="meta">
              <span>{e.employeeCode}</span>
              <span>·</span>
              <span>{e.designation}</span>
              <span>·</span>
              <span>{e.department}</span>
              <span>·</span>
              <span>{locationName(e.location)}</span>
            </div>
            <div className="flags">
              <span className="roleflag">Editing — changes apply when you save</span>
            </div>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'on' : ''}`}>
              {t}
              {attempted && errorTabs.has(t) && <span className="tab-err" title="This tab has errors" />}
            </button>
          ))}
        </div>

        <div style={{ padding: 22 }}>
          {/* ---------------- Personal ---------------- */}
          {tab === 'Personal' && (
            <div>
              <Sub first>Identity</Sub>
              <div className="form-grid">
                <Fg label="Full name (as per passport)" required error={err('name')}>
                  {input('name')}
                </Fg>
                <Fg label="Date of birth" error={err('dob')}>
                  {input('dob', { type: 'date' })}
                </Fg>
                <Fg label="Nationality">{input('nationality')}</Fg>
                <Fg label="Gender">{select('gender', GENDERS)}</Fg>
                <Fg label="Marital status">{select('maritalStatus', MARITAL)}</Fg>
                <Fg label="Blood group">{select('bloodGroup', BLOOD)}</Fg>
              </div>
              <Sub>Contact</Sub>
              <div className="form-grid">
                <Fg label="Personal mobile">{input('personalMobile', { type: 'tel' })}</Fg>
                <Fg label="Personal email" error={err('personalEmail')}>
                  {input('personalEmail', { type: 'email' })}
                </Fg>
                <Fg label="Work email (sign-in ID)" hint="Used to sign in, so it can't be changed here.">
                  <input value={e.email} readOnly style={{ background: 'var(--bg)' }} />
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

          {/* ---------------- Employment ---------------- */}
          {tab === 'Employment' && (
            <div>
              <Sub first>Job</Sub>
              <div className="form-grid">
                <Fg label="Employee ID" hint="Assigned at onboarding.">
                  <input value={e.employeeCode} readOnly style={{ background: 'var(--bg)' }} />
                </Fg>
                <Fg label="Organization" required error={err('company')}>
                  <select
                    value={v.company}
                    onChange={(ev) => setForm((f) => ({ ...f, v: { ...f.v, company: ev.target.value, department: '', designation: '' } }))}
                  >
                    {withCurrent(companies.map((c) => c.name), v.company).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Fg>
                <Fg label="Department" required error={err('department')} hint={v.company && !deptOptions.length ? `${v.company} has no departments in ${locationName(v.location)}. Choose another organization, or add departments under Administration → Departments & Designations.` : undefined}>
                  <select value={v.department} onChange={(ev) => setForm((f) => ({ ...f, v: { ...f.v, department: ev.target.value, designation: '' } }))}>
                    <option value="">Select…</option>
                    {deptOptions.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Fg>
                <Fg label="Designation" required error={err('designation')}>
                  <select value={v.designation} onChange={(ev) => set('designation', ev.target.value)} disabled={!v.department}>
                    <option value="">{v.department ? 'Select…' : 'Choose a department first'}</option>
                    {desigOptions.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Fg>
                <Fg label="Reporting manager" hint="Nobody in their own reporting line is listed.">
                  <SearchSelect options={[{ value: '', label: 'No manager' }, ...managerOptions]} value={v.reportingManagerId} onChange={(val) => set('reportingManagerId', val)} placeholder="Search by name or employee ID…" />
                </Fg>
                <Fg label="Employment type">{select('employmentType', TYPES)}</Fg>
                <Fg label="Employment status" hint="Managed by Onboarding and Offboarding.">
                  <input value={e.employmentStatus} readOnly style={{ background: 'var(--bg)' }} />
                </Fg>
              </div>
              <Sub>Dates</Sub>
              <div className="form-grid">
                <Fg label="Joining date" required error={err('dateOfJoining')}>
                  {input('dateOfJoining', { type: 'date' })}
                </Fg>
                <Fg label="Probation completion">{input('probationEnd', { type: 'date' })}</Fg>
              </div>
              <Sub>Placement</Sub>
              <div className="form-grid">
                <Fg label="Work location" hint="Changing it also updates the fields that depend on the location. A summary appears above.">
                  <select
                    value={v.location}
                    onChange={(ev) => changeLocation(ev.target.value)}
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Fg>
                <Fg label="Seating location">
                  <select value={v.seatingLocation} onChange={(ev) => set('seatingLocation', ev.target.value)}>
                    {seating.length ? seating.map((o) => <option key={o}>{o}</option>) : <option value="">No seating locations set</option>}
                  </select>
                </Fg>
                <Fg label="Work phone (official mobile)" hint={locationDef(v.location) ? `${locationDef(v.location)!.name} numbers start ${locationDef(v.location)!.phoneCode}, e.g. ${locationDef(v.location)!.phoneExample ?? ''}` : undefined}>{input('phone', { type: 'tel' })}</Fg>
                <Fg label="Extension">{input('extension')}</Fg>
              </div>
            </div>
          )}

          {/* ---------------- Identity documents ---------------- */}
          {tab === idTab && (
            <div>
              <Sub first>Passport</Sub>
              <div className="form-grid">
                <Fg label="Passport number" required error={err('passportNumber')}>
                  {input('passportNumber')}
                </Fg>
                <Fg label="Passport expiry">{input('passportExpiry', { type: 'date' })}</Fg>
              </div>
              {isIndia ? (
                <>
                  <Sub>Statutory identity (India)</Sub>
                  <div className="form-grid">
                    <Fg label="Aadhaar number" error={err('aadhaar')}>
                      {input('aadhaar', { placeholder: '12-digit Aadhaar', inputMode: 'numeric' })}
                    </Fg>
                    <Fg label="PAN number" error={err('pan')}>
                      {input('pan', { placeholder: 'ABCDE1234F' })}
                    </Fg>
                  </div>
                </>
              ) : (
                <>
                  <Sub>Residence visa &amp; Emirates ID</Sub>
                  <div className="form-grid">
                    <Fg label="Visa expiry" hint="Drives visa renewal reminders.">
                      {input('visaExpiry', { type: 'date' })}
                    </Fg>
                    <Fg label="Emirates ID number" error={err('emiratesId')}>
                      {input('emiratesId', { placeholder: '784-YYYY-NNNNNNN-N' })}
                    </Fg>
                    <Fg label="Emirates ID expiry">{input('emiratesIdExpiry', { type: 'date' })}</Fg>
                  </div>
                  <Sub>Labour card</Sub>
                  <div className="form-grid">
                    <Fg label="Issue date">{input('labourCardIssue', { type: 'date' })}</Fg>
                    <Fg label="Expiry date" error={err('labourCardExpiry')}>
                      {input('labourCardExpiry', { type: 'date' })}
                    </Fg>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------------- Emergency ---------------- */}
          {tab === 'Emergency' && (
            <RowList<EmergencyRow>
              rows={form.emergency}
              onChange={(r) => setList('emergency', r)}
              blank={() => ({ group: isIndia ? 'Primary Emergency Contact' : 'Local Emergency Contact (UAE)', name: '', relationship: '', mobile: '' })}
              title="Contact"
              addLabel="Add emergency contact"
              empty="No emergency contacts on file."
              render={(r, up, i) => (
                <>
                  <Fg label="Group" full hint="For example Local Emergency Contact, or Home Country Emergency Contact.">
                    <input value={r.group} onChange={(ev) => up({ group: ev.target.value })} />
                  </Fg>
                  <Fg label="Name" required error={shownErrors(`emergency.${i}.name`)}>
                    <input value={r.name} onChange={(ev) => up({ name: ev.target.value })} />
                  </Fg>
                  <Fg label="Relationship">
                    <input value={r.relationship} onChange={(ev) => up({ relationship: ev.target.value })} />
                  </Fg>
                  <Fg label="Mobile number" required error={shownErrors(`emergency.${i}.mobile`)}>
                    <input type="tel" value={r.mobile} onChange={(ev) => up({ mobile: ev.target.value })} />
                  </Fg>
                </>
              )}
            />
          )}

          {/* ---------------- Experience & education ---------------- */}
          {tab === 'Experience & Education' && (
            <div>
              <Sub first>Work experience</Sub>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <Fg label="Total experience before joining">{input('totalExperience', { placeholder: 'e.g. 6 years' })}</Fg>
              </div>
              <RowList<ExperienceRow>
                rows={form.experience}
                onChange={(r) => setList('experience', r)}
                blank={() => ({ company: '', location: '', from: '', to: '', title: '', mode: 'Onsite' })}
                title="Experience"
                addLabel="Add work experience"
                empty="No previous experience on file."
                render={(r, up, i) => (
                  <>
                    <Fg label="Company" required error={shownErrors(`experience.${i}.company`)}>
                      <input value={r.company} onChange={(ev) => up({ company: ev.target.value })} />
                    </Fg>
                    <Fg label="Job title">
                      <input value={r.title} onChange={(ev) => up({ title: ev.target.value })} />
                    </Fg>
                    <Fg label="Location">
                      <input value={r.location} onChange={(ev) => up({ location: ev.target.value })} />
                    </Fg>
                    <Fg label="Mode of work">
                      <select value={r.mode} onChange={(ev) => up({ mode: ev.target.value })}>
                        {withCurrent(MODES, r.mode).map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </Fg>
                    <Fg label="From">
                      <input type="date" value={r.from} onChange={(ev) => up({ from: ev.target.value })} />
                    </Fg>
                    <Fg label="To" error={shownErrors(`experience.${i}.to`)}>
                      <input type="date" value={r.to} onChange={(ev) => up({ to: ev.target.value })} />
                    </Fg>
                  </>
                )}
              />
              <Sub>Education</Sub>
              <RowList<EducationRow>
                rows={form.education}
                onChange={(r) => setList('education', r)}
                blank={() => ({ qualification: '', institution: '', course: '', field: '', startYear: '', endYear: '' })}
                title="Education"
                addLabel="Add education"
                empty="No education on file."
                render={(r, up, i) => (
                  <>
                    <Fg label="Qualification">
                      <input value={r.qualification} onChange={(ev) => up({ qualification: ev.target.value })} />
                    </Fg>
                    <Fg label="School / university" required error={shownErrors(`education.${i}.institution`)}>
                      <input value={r.institution} onChange={(ev) => up({ institution: ev.target.value })} />
                    </Fg>
                    <Fg label="Course">
                      <input value={r.course} onChange={(ev) => up({ course: ev.target.value })} />
                    </Fg>
                    <Fg label="Field of study">
                      <input value={r.field} onChange={(ev) => up({ field: ev.target.value })} />
                    </Fg>
                    <Fg label="Starting year">
                      <input inputMode="numeric" value={r.startYear} onChange={(ev) => up({ startYear: ev.target.value })} />
                    </Fg>
                    <Fg label="Ending year" error={shownErrors(`education.${i}.endYear`)}>
                      <input inputMode="numeric" value={r.endYear} onChange={(ev) => up({ endYear: ev.target.value })} />
                    </Fg>
                  </>
                )}
              />
            </div>
          )}

          {/* ---------------- Family ---------------- */}
          {tab === 'Family' && (
            <RowList<FamilyRow>
              rows={form.family}
              onChange={(r) => setList('family', r)}
              blank={() => ({ name: '', relationship: '', occupation: '' })}
              title="Family member"
              addLabel="Add family member"
              empty="No family members on file."
              render={(r, up, i) => (
                <>
                  <Fg label="Name" required error={shownErrors(`family.${i}.name`)}>
                    <input value={r.name} onChange={(ev) => up({ name: ev.target.value })} />
                  </Fg>
                  <Fg label="Relationship">
                    <input value={r.relationship} onChange={(ev) => up({ relationship: ev.target.value })} />
                  </Fg>
                  <Fg label="Occupation">
                    <input value={r.occupation} onChange={(ev) => up({ occupation: ev.target.value })} />
                  </Fg>
                </>
              )}
            />
          )}

          {/* ---------------- Bank & PF ---------------- */}
          {tab === 'Bank & PF' && sensitive && (
            <div>
              <div className="note-box" style={{ marginBottom: 16 }}>
                <ShieldIcon />
                <div>
                  This data is shared with Payroll, so changes here are logged. Fields shown for <b>{locationName(v.location)}</b>. Restricted to HR / Super Admin.
                </div>
              </div>
              <Sub first>Bank details</Sub>
              <div className="form-grid">
                <Fg label="Payment mode">{select('paymentMode', isIndia ? ['Bank Transfer', 'Cheque'] : ['WPS Transfer', 'Bank Transfer'])}</Fg>
                <Fg label="Bank name" required error={err('bankName')}>
                  {input('bankName')}
                </Fg>
                <Fg label="Account holder name">{input('accountName')}</Fg>
                <Fg label={isIndia ? 'Account number' : 'IBAN number'} required error={err('accountNumber')}>
                  {input('accountNumber')}
                </Fg>
                <Fg label={isIndia ? 'IFSC' : 'Routing / bank code'}>{input('branchCode')}</Fg>
                <Fg label="Currency" hint="Set by the work location.">
                  <input value={v.currency} readOnly style={{ background: 'var(--bg)' }} />
                </Fg>
              </div>
              {isIndia && (
                <>
                  <Sub>PF details (India)</Sub>
                  <div className="form-grid">
                    <Fg label="UAN" error={err('uan')}>
                      {input('uan', { placeholder: '12-digit UAN', inputMode: 'numeric' })}
                    </Fg>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------------- Salary ---------------- */}
          {tab === 'Salary' && sensitive && (
            <div>
              <div className="note-box" style={{ marginBottom: 16 }}>
                <ShieldIcon />
                <div>Salary structure in {currency}. Totals are calculated for you. Restricted to HR / Super Admin.</div>
              </div>
              <div className="g2">
                <div>
                  <Sub first>Earnings</Sub>
                  <MoneyList rows={form.earnings} onChange={(r) => setList('earnings', r)} currency={currency} addLabel="Add earning" errs={attempted ? errors : {}} prefix="earnings" />
                  <div className="mtotal">
                    <span>{isIndia ? 'Total earnings' : 'Total salary'}</span>
                    <b>{fmt(currency, sum(form.earnings))}</b>
                  </div>
                </div>
                <div>
                  <Sub first>Deductions</Sub>
                  <MoneyList rows={form.deductions} onChange={(r) => setList('deductions', r)} currency={currency} addLabel="Add deduction" errs={attempted ? errors : {}} prefix="deductions" />
                  <div className="mtotal">
                    <span>Total deductions</span>
                    <b>{fmt(currency, sum(form.deductions))}</b>
                  </div>
                </div>
              </div>
              <div className="mtotal net">
                <span>Net pay</span>
                <b>{fmt(currency, sum(form.earnings) - sum(form.deductions))}</b>
              </div>
            </div>
          )}

          {/* ---------------- Documents ---------------- */}
          {tab === 'Documents' && (
            <div>
              <Sub first>
                Required documents · {requiredDocs.filter((d) => form.uploadedDocs.includes(d) || !!fileFor(e.id, d)).length} of {requiredDocs.length} on file
              </Sub>
              <p className="hint" style={{ margin: '0 0 10px' }}>
                Upload a file for each document, or just tick it if the original is on file. Files attach straight away (PDF, image or Word, up to 10 MB) and do not wait for Save changes.
              </p>
              <div className="udoc-list">
                {requiredDocs.map((d) => (
                  <RequiredDocRow
                    key={d}
                    empId={e.id}
                    name={d}
                    ticked={form.uploadedDocs.includes(d)}
                    onTick={(on) => setList('uploadedDocs', on ? [...new Set([...form.uploadedDocs, d])] : form.uploadedDocs.filter((x) => x !== d))}
                  />
                ))}
              </div>
              <Sub>Dated documents</Sub>
              <RowList<DocRow>
                rows={form.documents}
                onChange={(r) => setList('documents', r)}
                blank={() => ({ id: `d-${Date.now()}`, type: '', expiryDate: '' })}
                title="Document"
                addLabel="Add dated document"
                empty="No dated documents on file."
                render={(r, up, i) => {
                  const linked = r.type === 'Passport' ? v.passportExpiry : r.type === 'Residence Visa' ? v.visaExpiry : r.type === 'Emirates ID' ? v.emiratesIdExpiry : '';
                  return (
                    <>
                      <Fg label="Document" required error={shownErrors(`documents.${i}.type`)}>
                        <input value={r.type} onChange={(ev) => up({ type: ev.target.value })} placeholder="e.g. Medical Insurance" />
                      </Fg>
                      <Fg label="Expiry date" hint={linked ? `Taken from the identity tab (${linked}).` : undefined}>
                        <input type="date" value={linked || r.expiryDate} disabled={!!linked} onChange={(ev) => up({ expiryDate: ev.target.value })} />
                      </Fg>
                      <Fg label="File" full hint={r.type.trim() ? undefined : 'Name the document first, then attach its file.'}>
                        <FileAttach empId={e.id} name={r.type.trim()} />
                      </Fg>
                    </>
                  );
                }}
              />
            </div>
          )}

          {/* ---------------- Assets ---------------- */}
          {tab === 'Assets' && (
            <div>
              <Sub first>Assigned assets · {assets.length}</Sub>
              {!assets.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No assets are assigned to {e.name}.</div>}
              {assets.map((a) => (
                <div key={a.id} className="doc">
                  <div className="fic">
                    <ShieldIcon />
                  </div>
                  <div>
                    <div className="nm">
                      {a.name} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· {a.type}</span>
                    </div>
                    <div className="mt">
                      Serial {a.serialNumber} · Assigned {a.assignedDate} · Warranty until {a.warrantyExpiry}
                    </div>
                  </div>
                </div>
              ))}
              <div className="note-box" style={{ marginTop: 14 }}>
                <ShieldIcon />
                <div>Assets are assigned and returned from Asset Management, so they aren&apos;t edited on the employee record.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {review && changes.length > 0 && (
        <div className="card editreview">
          <div className="card-head">
            <div>
              <h3>Review changes</h3>
              <div className="sub">{changes.length} field{changes.length === 1 ? '' : 's'} will change and be logged in Audit Logs.</div>
            </div>
            <button className="icon-act" onClick={() => setReview(false)} aria-label="Close review">
              <XIcon />
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{c.from}</td>
                  <td className="mono">{c.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="editbar">
        <div className="editbar-l">
          {attempted && Object.keys(errors).length > 0 ? (
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
              Fix {Object.keys(errors).length} error{Object.keys(errors).length === 1 ? '' : 's'} to save
            </span>
          ) : changes.length ? (
            <>
              <b>{changes.length}</b> unsaved change{changes.length === 1 ? '' : 's'}
              <button type="button" className="oc-link" style={{ marginLeft: 10 }} onClick={() => setReview((x) => !x)}>
                {review ? 'Hide' : 'Review'}
              </button>
            </>
          ) : (
            <span style={{ color: 'var(--muted)' }}>No changes yet</span>
          )}
        </div>
        <Button variant="ghost" onClick={cancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={!changes.length}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
