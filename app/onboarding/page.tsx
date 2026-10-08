'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { EMPLOYEES, ONBOARDING_REQUESTS, REFERENCE_TODAY, ROLE_SCOPE, nextEmployeeCode } from '@/lib/data';
import { SYSTEM_ROLES } from '@/lib/access';
import { useOrg } from '@/context/OrgContext';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Location, LocationDef, Role } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { StatStrip } from '@/components/ui/StatStrip';
import { daysBetween, todayISO } from '@/lib/dates';
import { EducationRow, EmergencyRow, ExperienceRow, FamilyRow, MoneyRow, DocRow, addEmployee, useEmployeeVersion } from '@/lib/employeeStore';
import { BLOOD_GROUPS, EMAIL_RE, EMPLOYMENT_TYPES, GENDERS, MARITAL_STATUSES, NATIONALITIES, WORK_MODES, ibanError, ifscError, indiaAccountError, phoneOk } from '@/lib/options';
import { chainSteps } from '@/lib/workflow';
import { CheckIcon, ClockIcon, JoinIcon, SearchIcon, ShieldIcon, UploadIcon, XIcon } from '@/components/icons';

const STEPS = ['Personal', 'Employment', 'Passport / Visa / EID', 'Emergency', 'Experience & Education', 'Family', 'Bank & PF', 'Salary', 'Documents', 'Assets & Approval'];

const ASSET_OPTIONS = ['Laptop', 'Monitor', 'Phone', 'Access card', 'SIM', 'Headset', 'Software licence'];

const VISA_STAGES: { group: string; stages: string[] }[] = [
  { group: 'Preparation & Documents', stages: ['Visa Request Initiated', 'Documents Collection & Verification', 'MOHRE Job Offer Creation', 'Employee Signature'] },
  { group: 'Work Permit', stages: ['Work Permit Submitted to MOHRE', 'Work Permit Approved'] },
  { group: 'Entry Permit', stages: ['Entry Permit Submitted to GDRFA', 'Entry Permit Issued', 'Share Entry Permit with Employee', 'Employee Enters UAE', 'ILOE Completed'] },
  { group: 'Medical & Insurance', stages: ['Medical Fitness Test', 'Health Insurance Application', 'Health Insurance Issued'] },
  { group: 'Emirates ID & Residence', stages: ['Emirates ID Application', 'Biometrics Completed', 'MOHRE Employment Contract Submitted', 'Residence Permit Submitted to GDRFA', 'Residence Permit Issued', 'Emirates ID Issued'] },
];

const VISA_FLAT = VISA_STAGES.flatMap((g) => g.stages);
const VISA_OUTPUTS = [
  { label: 'Work Permit', stage: 'Work Permit Approved' },
  { label: 'Entry Permit', stage: 'Entry Permit Issued' },
  { label: 'Medical Fitness', stage: 'Medical Fitness Test' },
  { label: 'Health Insurance', stage: 'Health Insurance Issued' },
  { label: 'Emirates ID', stage: 'Emirates ID Issued' },
  { label: 'Residence Permit', stage: 'Residence Permit Issued' },
];

const INDIA_EARN = ['Basic', 'House Rent Allowance', 'Fixed Allowance', 'Other Allowance'];
const INDIA_DED = ['Advance Amount', 'EPF Contribution', 'Other Deductions'];
const UAE_EARN = ['Basic Salary', 'Transportation Allowance', 'Accommodation Allowance'];

/** A labelled field. With an error, the message shows under it and the control inside is marked aria-invalid and
    pointed at the message (set on the DOM node so it works for any control, SearchSelect included). */
function Fg({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  const errId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea');
    if (!el) return;
    if (error) {
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', errId);
    } else {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    }
  }, [error, errId]);
  return (
    <div ref={box} className="fg">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {error && (
        <span id={errId} className="hint" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

function Input({ type = 'text', placeholder, value, onChange, readOnly }: { type?: string; placeholder?: string; value?: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  return <input type={type} placeholder={placeholder} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} readOnly={readOnly} style={readOnly ? { background: 'var(--bg)', color: 'var(--text)' } : undefined} />;
}

function Select({ options, value, onChange, placeholder }: { options: string[]; value?: string; onChange?: (v: string) => void; placeholder?: string }) {
  return (
    <select value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

function TextArea({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="fg full">
      <label>{label}</label>
      <textarea rows={5} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
    </div>
  );
}

/** A phone number typed as digits only, behind a fixed country code. The value is the digits. */
function PhoneInput({ code, digits, placeholder, value, onChange }: { code: string; digits: number; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <div style={{ display: 'flex' }}>
        <span style={{ display: 'grid', placeItems: 'center', padding: '0 12px', border: '1px solid var(--border)', borderRight: 'none', borderRadius: 'var(--r-sm) 0 0 var(--r-sm)', background: 'var(--bg)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{code}</span>
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, digits))}
          style={{ flex: 1, minWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
        />
      </div>
      <span className="hint">{digits}-digit number without the country code</span>
    </>
  );
}

function Phone({ def, value, onChange }: { def: LocationDef; value: string; onChange: (v: string) => void }) {
  return <PhoneInput key={def.id} code={def.phoneCode} digits={def.phoneDigits} placeholder={def.phoneExample ?? '0'.repeat(def.phoneDigits)} value={value} onChange={onChange} />;
}

const phoneFmt = (def: LocationDef, digits: string) => (digits ? `${def.phoneCode} ${digits}` : '');

const ADDRESS: Record<LocationDef['template'], string> = {
  uae: 'Flat / Villa Number:\nBuilding Name:\nArea / Community:\nEmirate:\nPO Box:',
  india: 'House / Flat Number:\nBuilding / House Name:\nStreet / Locality:\nDistrict / City:\nState:\nPIN Code:',
};

const EXPIRING_DOCS = ['Passport Copy', 'Residence Visa', 'Emirates ID', 'Labour Card', 'UAE Driving Licence', 'Medical Insurance E-Card', 'Insurance Document'];
const REMINDER_DAYS = ['90', '60', '30', '7'];
const REMINDER_TO = ['Employee', 'HR', 'Reporting manager'];

const daysUntil = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [ty, tm, td] = REFERENCE_TODAY.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
};

function expiryNote(date: string): { text: string; color: string } | null {
  if (!date) return null;
  const n = daysUntil(date);
  if (n < 0) return { text: `Already expired ${-n} day(s) ago`, color: '#B91C1C' };
  if (n <= 90) return { text: `Expires in ${n} day(s) — reminders start immediately`, color: '#B45309' };
  return { text: `Expires in ${n} days`, color: 'var(--muted)' };
}

function UploadBox({ label, expiry }: { label: string; expiry?: { value: string; onChange: (v: string) => void } }) {
  const note = expiry ? expiryNote(expiry.value) : null;
  return (
    <div className="fg">
      <label>{label}</label>
      <div className="uploader" style={{ padding: 14 }}>
        <UploadIcon style={{ margin: '0 auto 8px' }} />
        Drop file or click to upload
      </div>
      {expiry && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
            Expiry date <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· used for reminders</span>
          </label>
          <input type="date" value={expiry.value} onChange={(e) => expiry.onChange(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
          {note && <span className="hint" style={{ color: note.color }}>{note.text}</span>}
        </div>
      )}
    </div>
  );
}

function ChipToggle({ items, selected, onToggle, format = (x) => x }: { items: string[]; selected: Set<string>; onToggle: (v: string) => void; format?: (v: string) => string }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
      {items.map((x) => (
        <button
          key={x}
          type="button"
          className="chip"
          onClick={() => onToggle(x)}
          style={selected.has(x) ? { background: 'var(--primary-50)', borderColor: 'var(--primary-100)', color: 'var(--primary)' } : undefined}
        >
          {format(x)}
        </button>
      ))}
    </div>
  );
}

function AddNew({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="addnew" type="button" onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add another {label}
    </button>
  );
}

/** A list of repeatable entries whose values live in the page, so they are saved with the record. */
function Repeatable<T extends object>({ label, title, rows, onChange, blank, render }: { label: string; title: string; rows: T[]; onChange: (rows: T[]) => void; blank: () => T; render: (row: T, patch: (p: Partial<T>) => void, i: number) => React.ReactNode }) {
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} style={i > 0 ? { marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' } : undefined}>
          {i > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                {title} #{i + 1}
              </span>
              <button type="button" className="icon-act" title={`Remove ${title.toLowerCase()} #${i + 1}`} aria-label={`Remove ${title.toLowerCase()} #${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <XIcon />
              </button>
            </div>
          )}
          {render(row, (p) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r))), i)}
        </div>
      ))}
      <AddNew label={label} onClick={() => onChange([...rows, blank()])} />
    </>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const blankContact = (): EmergencyRow => ({ group: '', name: '', relationship: '', mobile: '' });
const blankExperience = (): ExperienceRow => ({ company: '', location: '', from: '', to: '', title: '', mode: 'Onsite' });
const blankEducation = (): EducationRow => ({ qualification: '', institution: '', course: '', field: '', startYear: '', endYear: '' });
const blankFamily = (): FamilyRow => ({ name: '', relationship: '', occupation: '' });
const anyFilled = (r: object, ignore: string[] = []) => Object.entries(r).some(([k, x]) => !ignore.includes(k) && String(x).trim() !== '');

interface Problem {
  key: string;
  step: number;
  msg: string;
}

export default function OnboardingPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [listQ, setListQ] = useState('');
  const [listStatus, setListStatus] = useState<'All' | (typeof ONBOARDING_REQUESTS)[number]['status']>('All');
  useEmployeeVersion();

  if (showWizard) return <Wizard onClose={() => setShowWizard(false)} />;

  const pipeline = ONBOARDING_REQUESTS;
  const awaiting = pipeline.filter((r) => r.status === 'Pending Approval').length;
  const soon = pipeline.filter((r) => {
    const d = daysBetween(REFERENCE_TODAY, r.startDate);
    return d >= 0 && d <= 30;
  }).length;
  const avgProgress = pipeline.length ? Math.round((pipeline.reduce((n, r) => n + r.step, 0) / pipeline.length / STEPS.length) * 100) : 0;
  const needle = listQ.trim().toLowerCase();
  const listed = pipeline.filter(
    (r) => (listStatus === 'All' || r.status === listStatus) && (!needle || `${r.candidateName} ${r.designation} ${r.department} ${r.location}`.toLowerCase().includes(needle)),
  );
  const startLabel = (iso: string) => {
    const d = daysBetween(REFERENCE_TODAY, iso);
    return d === 0 ? 'Starts today' : d > 0 ? `Starts in ${d} day${d === 1 ? '' : 's'}` : `Started ${-d} day${d === -1 ? '' : 's'} ago`;
  };
  return (
    <div>
      <PageHeader
        eyebrow="Employee Lifecycle"
        title="Onboarding"
        description="A guided 10-step wizard capturing the full employee record. Creates the employee as Onboarding and sends the request through the approval chain."
        actions={
          <Button variant="primary" onClick={() => setShowWizard(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            New onboarding
          </Button>
        }
      />

      <StatStrip
        items={[
          { label: 'In the pipeline', value: pipeline.length, icon: <JoinIcon />, tone: 'blue', hint: 'New joiners being set up' },
          { label: 'Awaiting approval', value: awaiting, icon: <ShieldIcon />, tone: 'amber', hint: 'Ready for sign-off' },
          { label: 'Starting in 30 days', value: soon, icon: <ClockIcon />, tone: 'purple', hint: 'Joining date approaching' },
          { label: 'Average progress', value: `${avgProgress}%`, icon: <CheckIcon />, tone: 'green', hint: `Of ${STEPS.length} wizard steps` },
        ]}
      />

      <Card className="row-gap">
        <CardHeader title="In-progress onboardings" sub="Across all locations" />
        <div className="tbar">
          <div className="tsearch" style={{ width: 260 }}>
            <SearchIcon />
            <input value={listQ} onChange={(e) => setListQ(e.target.value)} placeholder="Search candidate, role or department…" />
          </div>
          <select value={listStatus} onChange={(e) => setListStatus(e.target.value as typeof listStatus)} className="chip">
            <option value="All">All statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
          </select>
          {(needle || listStatus !== 'All') && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setListQ('');
                setListStatus('All');
              }}
            >
              <XIcon /> Clear filters
            </button>
          )}
          <span className="sp" />
          <span className="lc-count">
            {listed.length} of {pipeline.length}
          </span>
        </div>

        {!listed.length ? (
          <div>
            <EmptyState
              icon={<JoinIcon />}
              title={pipeline.length ? 'No matching onboardings' : 'No onboardings in progress'}
              description={pipeline.length ? 'Try a different search or filter.' : 'Start a new onboarding to capture a joiner’s record and provision their assets.'}
            />
            {!pipeline.length && (
              <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
                <Button variant="primary" onClick={() => setShowWizard(true)}>
                  New onboarding
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="lc-list">
            {listed.map((r) => (
              <div key={r.id} className="doc">
                <div className="lc-onb-row" style={{ flex: 1, minWidth: 0 }}>
                  <Avatar initials={initialsOf(r.candidateName)} seed={r.department} size={42} />
                  <div className="grow">
                    <div className="nm">{r.candidateName}</div>
                    <div className="mt">
                      {r.designation} · {r.department} · {r.location} · {r.role}
                    </div>
                    <div className="mt" style={{ marginTop: 2 }}>
                      {startLabel(r.startDate)} · {r.startDate}
                    </div>
                  </div>
                  <div className="lc-onb-prog">
                    <div className="lc-prog">
                      <i style={{ width: `${(r.step / STEPS.length) * 100}%` }} />
                    </div>
                    <span>
                      Step {r.step}/{STEPS.length}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!!listed.length && (
          <div className="tfoot lc-foot">
            <span>
              Showing {listed.length} of {pipeline.length} onboarding{pipeline.length === 1 ? '' : 's'}
            </span>
            <span>Start a new onboarding to add another joiner</span>
          </div>
        )}
      </Card>
    </div>
  );
}

function Wizard({ onClose }: { onClose: () => void }) {
  const { location } = useApp();
  const me = useCurrentEmployee();
  const [step, setStep] = useState(0);
  const [office, setOffice] = useState<Location>(location);
  const [created, setCreated] = useState<{ code: string; name: string; email: string; role: Role; country: string; assets: string } | null>(null);
  const done = created !== null;
  /** Steps the user has tried to leave (or submit) with problems; their errors are shown. */
  const [attempted, setAttempted] = useState<number[]>([]);

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [role, setRole] = useState<Role>('Employee');
  const [workEmail, setWorkEmail] = useState('');
  const [roleError, setRoleError] = useState('');
  const [visaStep, setVisaStep] = useState(0);
  const [assetFlags, setAssetFlags] = useState<Set<string>>(new Set(['Laptop', 'Access card']));
  const [notifyDocs, setNotifyDocs] = useState(true);
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [reminderDays, setReminderDays] = useState<Set<string>>(new Set(REMINDER_DAYS));
  const [reminderTo, setReminderTo] = useState<Set<string>>(new Set(['Employee', 'HR']));

  /* every other field, keyed like the employee record (see FIELDS in lib/employeeStore) */
  const [fv, setFv] = useState<Record<string, string>>({ maritalStatus: 'Single', employmentType: 'Permanent' });
  const f = (k: string) => fv[k] ?? '';
  const setF = (k: string, val: string) => setFv((p) => ({ ...p, [k]: val }));
  const [sal, setSal] = useState<Record<string, string>>({});
  const [emA, setEmA] = useState<EmergencyRow[]>([blankContact()]);
  const [emB, setEmB] = useState<EmergencyRow[]>([blankContact()]);
  const [exp, setExp] = useState<ExperienceRow[]>([blankExperience()]);
  const [edu, setEdu] = useState<EducationRow[]>([blankEducation()]);
  const [fam, setFam] = useState<FamilyRow[]>([blankFamily()]);

  const { companies, departments, designations, locations, locationsLabel, locationDef } = useOrg();
  const def = locationDef(office) ?? locations[0];
  const isIndia = def.template === 'india';
  const country = def.name;
  const steps = STEPS.map((s, i) => (i === 2 && isIndia ? 'Passport / Aadhaar / PAN' : s));
  const selectedCompany = companies.find((c) => c.id === organizationId);
  const companyDepts = selectedCompany ? departments.filter((d) => d.companyId === selectedCompany.id && d.locations.includes(office)) : [];
  const selectedDept = companyDepts.find((d) => d.id === departmentId);
  const deptDesigs = selectedDept ? designations.filter((x) => x.departmentId === selectedDept.id) : [];
  const employeeCode = nextEmployeeCode();
  const suggestedEmail = fullName.trim() ? `${fullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '')}@gs-it.ae` : '';
  const signInEmail = (workEmail.trim() || suggestedEmail).toLowerCase();
  const emailTaken = !!signInEmail && EMPLOYEES.some((e) => e.email.toLowerCase() === signInEmail);
  const setExpiry = (doc: string, v: string) => setExpiries((prev) => ({ ...prev, [doc]: v }));
  const docList = isIndia
    ? ['Passport Copy', 'Signed Company Offer Letter', 'Highest Educational Certificate', 'PAN Card', 'Aadhaar Card', 'Passbook / Bank Statement', 'Signed NDA', 'Signed Employment Contract', 'Insurance Document', 'KPI', 'Passport Size Photo', 'Casual Photo']
    : ['Passport Copy', 'Signed Company Offer Letter', 'Attested Educational Certificate', 'Labour Card', 'Residence Visa', 'Emirates ID', 'Signed NDA', 'UAE Driving Licence', 'Medical Insurance E-Card', 'KPI', 'Passport Size Photo', 'Casual Photo'];
  const expiringDocs = docList.filter((d) => EXPIRING_DOCS.includes(d));
  const dated = expiringDocs.filter((d) => expiries[d]);
  const nearest = dated.length ? dated.reduce((a, b) => (expiries[a] <= expiries[b] ? a : b)) : null;
  const deptValue = selectedDept?.name ?? 'Select…';
  const managers = EMPLOYEES.filter((e) => e.employmentStatus === 'Active').map((e) => ({ value: e.id, label: e.name, meta: e.employeeCode }));
  const managerName = EMPLOYEES.find((e) => e.id === managerId)?.name;
  const seatValue = f('seatingLocation') || def.seating[0] || '';
  const payModes = isIndia ? ['Bank Transfer', 'Cheque'] : ['WPS Transfer', 'Bank Transfer'];
  const payMode = f('paymentMode') || payModes[0];
  const earnLabels = isIndia ? INDIA_EARN : UAE_EARN;
  const dedLabels = isIndia ? INDIA_DED : [];
  const amt = (l: string) => (Number.isFinite(Number(sal[l])) ? Number(sal[l] || 0) : 0);
  const totalEarn = earnLabels.reduce((n, l) => n + amt(l), 0);
  const totalDed = dedLabels.reduce((n, l) => n + amt(l), 0);
  /** The approval line comes from Administration → Workflow Settings. */
  const approvalLine = chainSteps('onboarding');

  const age = useMemo(() => {
    if (!dob) return '';
    const d = new Date(dob);
    const diff = new Date().getFullYear() - d.getFullYear();
    return isNaN(diff) ? '' : String(diff);
  }, [dob]);

  const probationDate = useMemo(() => {
    if (!joiningDate) return '';
    const d = new Date(joiningDate);
    d.setMonth(d.getMonth() + 6);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }, [joiningDate]);

  const toggleFlag = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSet(next);
  };

  /* A change of location swaps the phone format, bank fields, salary lines and document list, so what was typed
     for the old country is cleared rather than carried over. */
  const changeOffice = (id: Location) => {
    if (id === office) return;
    setOffice(id);
    setFv((p) => ({ maritalStatus: p.maritalStatus, employmentType: p.employmentType, gender: p.gender, bloodGroup: p.bloodGroup, nationality: p.nationality, personalEmail: p.personalEmail, currentAddress: p.currentAddress, permanentAddress: p.permanentAddress, extension: p.extension, passportNumber: p.passportNumber, totalExperience: p.totalExperience, bankName: p.bankName }));
    setSal({});
    setExpiries({});
    setEmA((r) => r.map((x) => ({ ...x, mobile: '' })));
    setEmB((r) => r.map((x) => ({ ...x, mobile: '' })));
    setAttempted([]);
  };

  /* ---------- validation: every required field marked * ---------- */
  const problems: Problem[] = [];
  const add = (key: string, s: number, msg: string) => problems.push({ key, step: s, msg });
  const digitsMsg = `Enter all ${def.phoneDigits} digits of the number.`;
  if (!fullName.trim()) add('name', 0, 'Full name is required.');
  if (!f('personalMobile')) add('personalMobile', 0, 'Personal mobile number is required.');
  else if (f('personalMobile').length !== def.phoneDigits) add('personalMobile', 0, digitsMsg);
  if (!f('personalEmail').trim()) add('personalEmail', 0, 'Personal email is required.');
  else if (!EMAIL_RE.test(f('personalEmail').trim())) add('personalEmail', 0, 'That doesn’t look like an email address.');
  if (!dob) add('dob', 0, 'Date of birth is required.');
  else if (dob > todayISO()) add('dob', 0, 'Date of birth cannot be in the future.');
  if (!f('nationality')) add('nationality', 0, 'Choose a nationality.');

  if (!organizationId) add('organization', 1, 'Choose an organization.');
  if (!departmentId) add('department', 1, 'Choose a department.');
  if (!designationId) add('designation', 1, 'Choose a designation.');
  if (!managerId) add('manager', 1, 'Choose a reporting manager.');
  if (!f('employmentType')) add('employmentType', 1, 'Choose an employment type.');
  if (!joiningDate) add('joiningDate', 1, 'Joining date is required.');
  if (!signInEmail) add('workEmail', 1, 'Work email is required (enter one, or enter the full name to get a suggestion).');
  else if (!EMAIL_RE.test(signInEmail)) add('workEmail', 1, 'Enter a valid work email address.');
  else if (emailTaken) add('workEmail', 1, `${signInEmail} already belongs to another employee. Enter a different work email.`);
  if (f('phone') && f('phone').length !== def.phoneDigits) add('phone', 1, digitsMsg);

  if (!f('passportNumber').trim()) add('passportNumber', 2, 'Passport number is required.');
  if (isIndia) {
    if (!f('aadhaar').trim()) add('aadhaar', 2, 'Aadhaar number is required.');
    else if (!/^\d{12}$/.test(f('aadhaar').replace(/\s/g, ''))) add('aadhaar', 2, 'Aadhaar is 12 digits.');
    if (!f('pan').trim()) add('pan', 2, 'PAN number is required.');
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f('pan').trim().toUpperCase())) add('pan', 2, 'PAN looks like ABCDE1234F.');
  } else {
    if (f('emiratesId').trim() && !/^784-\d{4}-\d{7}-\d$/.test(f('emiratesId').trim())) add('emiratesId', 2, 'Format: 784-YYYY-NNNNNNN-N.');
    if (f('labourCardIssue') && expiries['Labour Card'] && expiries['Labour Card'] < f('labourCardIssue')) add('labourCardExpiry', 2, 'Expiry is before the issue date.');
  }

  const contactProblems = (rows: EmergencyRow[], tag: string, localPhone: boolean) =>
    rows.forEach((r, i) => {
      if (!anyFilled(r, ['group'])) return;
      if (!r.name.trim()) add(`${tag}.${i}.name`, 3, 'Name is required.');
      if (!r.mobile.trim()) add(`${tag}.${i}.mobile`, 3, 'Mobile number is required.');
      else if (localPhone ? r.mobile.length !== def.phoneDigits : !phoneOk(r.mobile)) add(`${tag}.${i}.mobile`, 3, localPhone ? digitsMsg : 'Enter a valid mobile number (7 to 15 digits).');
    });
  contactProblems(emA, 'emA', true);
  contactProblems(emB, 'emB', isIndia);

  exp.forEach((r, i) => {
    if (anyFilled(r, ['mode']) && !r.company.trim()) add(`exp.${i}.company`, 4, 'Company is required.');
    if (r.from && r.to && r.to < r.from) add(`exp.${i}.to`, 4, 'End date is before the start date.');
  });
  edu.forEach((r, i) => {
    if (anyFilled(r) && !r.institution.trim()) add(`edu.${i}.institution`, 4, 'School / university is required.');
    if (r.startYear && r.endYear && Number(r.endYear) < Number(r.startYear)) add(`edu.${i}.endYear`, 4, 'Ending year is before the starting year.');
  });
  fam.forEach((r, i) => {
    if (anyFilled(r) && !r.name.trim()) add(`fam.${i}.name`, 5, 'Name is required.');
  });

  if (!f('bankName').trim()) add('bankName', 6, 'Bank name is required.');
  if (isIndia) {
    const a = indiaAccountError(f('accountNumber'));
    if (a) add('accountNumber', 6, a);
    const c = ifscError(f('branchCode'));
    if (c) add('branchCode', 6, c);
    if (f('uan').trim() && !/^\d{12}$/.test(f('uan').replace(/\s/g, ''))) add('uan', 6, 'UAN is 12 digits.');
  } else {
    const a = ibanError(f('accountNumber'));
    if (a) add('accountNumber', 6, a);
  }

  [...earnLabels, ...dedLabels].forEach((l) => {
    if (sal[l] !== undefined && sal[l] !== '' && (!Number.isFinite(Number(sal[l])) || Number(sal[l]) < 0)) add(`sal.${l}`, 7, 'Enter an amount of 0 or more.');
  });
  if (!sal[earnLabels[0]] || Number(sal[earnLabels[0]]) <= 0) add(`sal.${earnLabels[0]}`, 7, `${earnLabels[0]} is required.`);

  const shownErr = (key: string) => problems.find((p) => p.key === key && attempted.includes(p.step))?.msg;
  const summary = problems.filter((p) => attempted.includes(p.step));
  const stepHasProblems = (i: number) => attempted.includes(i) && problems.some((p) => p.step === i);

  const focusFirstInvalid = () => {
    setTimeout(() => document.querySelector<HTMLElement>('.wizbody [aria-invalid="true"]')?.focus(), 60);
  };

  const submit = () => {
    const dateRows = expiringDocs
      .filter((d) => expiries[d])
      .map((d, i): DocRow => ({ id: `d${i + 1}`, type: d === 'Passport Copy' ? 'Passport' : d, expiryDate: expiries[d] }));
    const money = (labels: string[]): MoneyRow[] => labels.filter((l) => sal[l] !== undefined && sal[l] !== '').map((l) => ({ label: l, amount: String(Number(sal[l])) }));
    const contacts = (rows: EmergencyRow[], group: string, local: boolean) => rows.filter((r) => anyFilled(r, ['group'])).map((r) => ({ ...r, group, name: r.name.trim(), mobile: local ? phoneFmt(def, r.mobile) : r.mobile.trim() }));
    const v: Record<string, string> = {
      name: fullName.trim(),
      dob,
      nationality: f('nationality'),
      gender: f('gender'),
      maritalStatus: f('maritalStatus'),
      bloodGroup: f('bloodGroup'),
      personalMobile: phoneFmt(def, f('personalMobile')),
      personalEmail: f('personalEmail').trim(),
      currentAddress: f('currentAddress'),
      permanentAddress: f('permanentAddress'),
      company: selectedCompany?.name ?? '',
      department: selectedDept?.name ?? '',
      designation: designations.find((x) => x.id === designationId)?.title ?? '',
      reportingManagerId: managerId,
      employmentType: f('employmentType'),
      dateOfJoining: joiningDate,
      probationEnd: probationDate,
      location: def.id,
      seatingLocation: seatValue,
      phone: phoneFmt(def, f('phone')),
      extension: f('extension'),
      passportNumber: f('passportNumber').trim(),
      passportExpiry: expiries['Passport Copy'] ?? '',
      emiratesId: isIndia ? '' : f('emiratesId'),
      visaExpiry: isIndia ? '' : (expiries['Residence Visa'] ?? ''),
      emiratesIdExpiry: isIndia ? '' : (expiries['Emirates ID'] ?? ''),
      labourCardIssue: isIndia ? '' : f('labourCardIssue'),
      labourCardExpiry: isIndia ? '' : (expiries['Labour Card'] ?? ''),
      aadhaar: isIndia ? f('aadhaar').replace(/\s/g, '') : '',
      pan: isIndia ? f('pan').trim().toUpperCase() : '',
      uan: isIndia ? f('uan').replace(/\s/g, '') : '',
      paymentMode: payMode,
      bankName: f('bankName').trim(),
      accountName: fullName.trim(),
      accountNumber: isIndia ? f('accountNumber').replace(/\s/g, '') : f('accountNumber').replace(/\s/g, '').toUpperCase(),
      branchCode: isIndia ? f('branchCode').trim().toUpperCase() : f('branchCode').trim(),
      currency: def.currency,
      totalExperience: f('totalExperience'),
    };
    const emergency = [
      ...contacts(emA, isIndia ? 'Primary Emergency Contact' : 'Local Emergency Contact (UAE)', true),
      ...contacts(emB, isIndia ? 'Alternate Emergency Contact' : 'Home Country Emergency Contact', isIndia),
    ];
    const hire = addEmployee({
      v,
      emergency,
      experience: exp.filter((r) => anyFilled(r, ['mode'])),
      education: edu.filter((r) => anyFilled(r)),
      family: fam.filter((r) => anyFilled(r)),
      earnings: money(earnLabels),
      deductions: money(dedLabels),
      documents: dateRows,
      email: signInEmail,
      role,
      by: me.name,
      step: STEPS.length,
    });
    if (!hire) {
      setRoleError('The employee could not be created: the work email is already in use or the name is missing.');
      return;
    }
    setCreated({ code: hire.employeeCode, name: hire.name, email: hire.email, role, country, assets: assetFlags.size ? Array.from(assetFlags).join(', ') : 'none selected' });
  };

  const next = () => {
    setRoleError('');
    const here = problems.filter((p) => p.step === step);
    if (here.length) {
      setAttempted((a) => (a.includes(step) ? a : [...a, step]));
      focusFirstInvalid();
      return;
    }
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Last step: every step must be valid before anything is created.
    if (problems.length) {
      const bad = [...new Set(problems.map((p) => p.step))].sort((a, b) => a - b);
      setAttempted(bad);
      setStep(bad[0]);
      focusFirstInvalid();
      return;
    }
    submit();
  };

  return (
    <div>
      <PageHeader
        eyebrow="New onboarding"
        title={fullName || 'New candidate'}
        description="A guided 10-step wizard capturing the full employee record. Creates the employee as Onboarding and sends the request through the approval chain."
      />

      <Card className="lc-wiz">
        <div className="lc-wiz-top">
          <div className="t">
            {done ? 'Completed' : <>Step <b>{step + 1}</b> of {steps.length}</>}
            {!done && <> · {steps[step]}</>}
          </div>
          <div className={`lc-prog ${done ? 'ok' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done ? steps.length : step + 1}>
            <i style={{ width: `${((done ? steps.length : step + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="p">{Math.round(((done ? steps.length : step + 1) / steps.length) * 100)}%</div>
        </div>
        <div className="stepper">
          {steps.map((s, i) => (
            <div key={i} className={`step ${done || i < step ? 'done' : i === step ? 'active' : ''} ${!done && stepHasProblems(i) ? 'fm-bad' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={`num ${i < step ? 'done' : i === step ? 'active' : ''}`}>{done || (i < step && !stepHasProblems(i)) ? <CheckIcon style={{ width: 14, height: 14 }} /> : i + 1}</div>
                <span className="lb" style={i <= step ? { color: 'var(--text)' } : undefined}>
                  <small>Step {i + 1}</small>
                  {s}
                </span>
              </div>
              {i < steps.length - 1 && <div className={`step-line ${i < step ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="wizbody">
          {!done && summary.length > 0 && (
            <div className="fm-errsum" role="alert">
              <div>
                <b>
                  Fix {summary.length} error{summary.length === 1 ? '' : 's'} to continue
                </b>
                <ul>
                  {summary.map((p) => (
                    <li key={p.key}>
                      <button type="button" onClick={() => setStep(p.step)}>
                        {steps[p.step]}: {p.msg}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div style={step === 0 ? undefined : { display: 'none' }}>
            <h3>Personal details</h3>
            <p className="desc">Identity information for the new joiner. Age is auto-calculated from date of birth.</p>
            <div className="fg full" style={{ marginBottom: 18 }}>
              <label>
                Work location <span className="req">*</span>
              </label>
              <div className="subseg" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
                {locations.map((l) => (
                  <button key={l.id} type="button" className={l.id === def.id ? 'on' : ''} onClick={() => changeOffice(l.id)}>
                    {l.name}
                  </button>
                ))}
              </div>
              <span className="hint">Choose this first. Phone format, address, identity documents, bank, salary and document lists adapt to the location. Changing it clears the details typed for the previous location.</span>
            </div>
            <div className="fg full" style={{ marginBottom: 14 }}>
              <label>Photos</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['Passport size photo', 'Casual photo 1', 'Casual photo 2'].map((l) => (
                  <div key={l} className="uploader" style={{ flex: 1, minWidth: 160, padding: 14 }}>
                    <UploadIcon style={{ margin: '0 auto 8px' }} />
                    {l}
                  </div>
                ))}
              </div>
            </div>
            <div className="form-grid">
              <Fg label="Full Name (as per passport)" required error={shownErr('name')}>
                <Input placeholder="e.g. Zayd Rahman" value={fullName} onChange={setFullName} />
              </Fg>
              <Fg label="Personal Mobile Number" required error={shownErr('personalMobile')}>
                <Phone def={def} value={f('personalMobile')} onChange={(x) => setF('personalMobile', x)} />
              </Fg>
              <Fg label="Personal Email ID" required error={shownErr('personalEmail')}>
                <Input type="email" placeholder="name@email.com" value={f('personalEmail')} onChange={(x) => setF('personalEmail', x)} />
              </Fg>
              <Fg label="Date of birth" required error={shownErr('dob')}>
                <Input type="date" value={dob} onChange={setDob} />
              </Fg>
              <Fg label="Age">
                <Input value={age} readOnly placeholder="auto from DOB" />
              </Fg>
              <Fg label="Nationality" required error={shownErr('nationality')}>
                <Select options={NATIONALITIES} placeholder="Select nationality…" value={f('nationality')} onChange={(x) => setF('nationality', x)} />
              </Fg>
              <Fg label="Gender">
                <Select options={GENDERS} placeholder="Select…" value={f('gender')} onChange={(x) => setF('gender', x)} />
              </Fg>
              <Fg label="Marital status">
                <Select options={MARITAL_STATUSES} value={f('maritalStatus')} onChange={(x) => setF('maritalStatus', x)} />
              </Fg>
              <Fg label="Blood group">
                <Select options={BLOOD_GROUPS} placeholder="Select…" value={f('bloodGroup')} onChange={(x) => setF('bloodGroup', x)} />
              </Fg>
              <TextArea label={`Current address (${country})`} placeholder={ADDRESS[def.template]} value={f('currentAddress')} onChange={(x) => setF('currentAddress', x)} />
              <TextArea label="Permanent address (home country)" placeholder={isIndia ? ADDRESS.india : 'House / Flat Number:\nBuilding / House Name:\nCity / District:\nState / Province:\nCountry:\nPostal Code:'} value={f('permanentAddress')} onChange={(x) => setF('permanentAddress', x)} />
            </div>
          </div>

          <div style={step === 1 ? undefined : { display: 'none' }}>
            <h3>Employment</h3>
            <p className="desc">Job details. Probation completion auto-fills to 6 months after joining.</p>
            <div className="form-grid">
              <Fg label="Employee ID">
                <Input readOnly value={employeeCode} />
                <span className="hint">Generated automatically</span>
              </Fg>
              <Fg label="Organization" required error={shownErr('organization')}>
                <SearchSelect
                  options={companies.map((c) => ({ value: c.id, label: c.name, meta: c.status === 'Inactive' ? `${c.shortCode} · Inactive` : c.shortCode }))}
                  value={organizationId}
                  onChange={(v) => {
                    setOrganizationId(v);
                    setDepartmentId('');
                    setDesignationId('');
                  }}
                  emptyText="No companies found"
                />
                {!companies.length && <span className="hint">No companies yet. Add one under Administration → Companies.</span>}
              </Fg>
              <Fg label="Department" required error={shownErr('department')}>
                <SearchSelect
                  options={companyDepts.map((d) => ({ value: d.id, label: d.name, meta: locationsLabel(d.locations) }))}
                  value={departmentId}
                  onChange={(v) => {
                    setDepartmentId(v);
                    setDesignationId('');
                  }}
                  placeholder={selectedCompany ? 'Select department…' : 'Select an organization first'}
                  emptyText="No departments found"
                  disabled={!selectedCompany}
                />
                {selectedCompany && !companyDepts.length && <span className="hint">No departments for {selectedCompany.name} in {country}. Add them under Administration → Departments &amp; Designations.</span>}
              </Fg>
              <Fg label="Designation" required error={shownErr('designation')}>
                <SearchSelect
                  options={deptDesigs.map((x) => ({ value: x.id, label: x.title }))}
                  value={designationId}
                  onChange={setDesignationId}
                  placeholder={selectedDept ? 'Select designation…' : 'Select a department first'}
                  emptyText="No designations found"
                  disabled={!selectedDept}
                />
                {selectedDept && !deptDesigs.length && <span className="hint">No designations in {selectedDept.name} yet. Add them under Administration → Departments &amp; Designations.</span>}
              </Fg>
              <Fg label="Reporting manager" required error={shownErr('manager')}>
                <SearchSelect options={managers} value={managerId} onChange={setManagerId} placeholder="Search by name or employee ID…" emptyText="No employees found" />
              </Fg>
              <Fg label="Employment type" required error={shownErr('employmentType')}>
                <Select options={EMPLOYMENT_TYPES} value={f('employmentType')} onChange={(x) => setF('employmentType', x)} />
              </Fg>
              <Fg label="System role" required>
                <Select options={SYSTEM_ROLES} value={role} onChange={(v) => setRole(v as Role)} />
                <span className="hint">{ROLE_SCOPE[role]}</span>
                {(role === 'Super Admin' || role === 'HR') && (
                  <span className="hint" style={{ color: '#B45309' }}>
                    This role can see salary, bank and identity documents, so it needs the approver&apos;s sign-off in the last step.
                  </span>
                )}
                <span className="hint">Fine-tune what each role can view, add, edit or delete under Administration → Roles &amp; Permissions.</span>
              </Fg>
              <Fg label="Work email (sign-in ID)" required error={shownErr('workEmail')}>
                <Input type="email" placeholder={suggestedEmail || 'name@gs-it.ae'} value={workEmail} onChange={setWorkEmail} />
                <span className="hint">{signInEmail ? `Signs in as ${signInEmail}.` : 'Used to sign in.'} Leave blank to use the suggested address.</span>
              </Fg>
              <Fg label="Joining date" required error={shownErr('joiningDate')}>
                <Input type="date" value={joiningDate} onChange={setJoiningDate} />
              </Fg>
              <Fg label="Probation Completion Date">
                <Input readOnly value={probationDate} placeholder="auto — +6 months" />
              </Fg>
              <Fg label="Work location">
                <Input readOnly value={country} />
                <span className="hint">Set in step 1</span>
              </Fg>
              <Fg label="Seating Location">
                <Select options={def.seating.length ? def.seating : ['No seating locations set']} value={def.seating.length ? seatValue : undefined} onChange={(x) => setF('seatingLocation', x)} />
                {!def.seating.length && <span className="hint">Add seating locations for {country} under Administration → System Settings.</span>}
              </Fg>
              <Fg label="Work Phone (Official Mobile)" error={shownErr('phone')}>
                <Phone def={def} value={f('phone')} onChange={(x) => setF('phone', x)} />
              </Fg>
              <Fg label="Extension">
                <Input placeholder="e.g. 712" value={f('extension')} onChange={(x) => setF('extension', x)} />
              </Fg>
            </div>
          </div>

          {isIndia && (
            <div style={step === 2 ? undefined : { display: 'none' }}>
              <h3>Passport / Aadhaar / PAN details</h3>
              <p className="desc">Statutory identity documents for India. Aadhaar and PAN are used for payroll, PF and tax filing.</p>
              <div className="form-grid">
                <Fg label="Passport Number" required error={shownErr('passportNumber')}>
                  <Input placeholder="e.g. K1234567" value={f('passportNumber')} onChange={(x) => setF('passportNumber', x)} />
                </Fg>
                <Fg label="Passport Expiry Date">
                  <Input type="date" value={expiries['Passport Copy'] ?? ''} onChange={(v) => setExpiry('Passport Copy', v)} />
                </Fg>
                <Fg label="Aadhaar Number" required error={shownErr('aadhaar')}>
                  <Input placeholder="12-digit Aadhaar" value={f('aadhaar')} onChange={(x) => setF('aadhaar', x)} />
                </Fg>
                <Fg label="PAN Number" required error={shownErr('pan')}>
                  <Input placeholder="e.g. ABCDE1234F" value={f('pan')} onChange={(x) => setF('pan', x.toUpperCase())} />
                </Fg>
              </div>
              <div className="note-box" style={{ marginTop: 10 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                </svg>
                <div>Visa, Emirates ID and Labour Card apply to UAE employees only, so they are not collected for India.</div>
              </div>
            </div>
          )}

          {!isIndia && (
            <div style={step === 2 ? undefined : { display: 'none' }}>
              <h3>Passport / Visa / EID details</h3>
              <p className="desc">Statutory identity documents. Expiry dates flow into Renewal Management.</p>
              <div className="form-grid">
                <Fg label="Passport Number" required error={shownErr('passportNumber')}>
                  <Input value={f('passportNumber')} onChange={(x) => setF('passportNumber', x)} />
                </Fg>
                <Fg label="Emirates ID" error={shownErr('emiratesId')}>
                  <Input placeholder="784-YYYY-NNNNNNN-N" value={f('emiratesId')} onChange={(x) => setF('emiratesId', x)} />
                </Fg>
                <Fg label="Passport Expiry Date">
                  <Input type="date" value={expiries['Passport Copy'] ?? ''} onChange={(v) => setExpiry('Passport Copy', v)} />
                </Fg>
                <Fg label="Visa Expiry Date">
                  <Input type="date" value={expiries['Residence Visa'] ?? ''} onChange={(v) => setExpiry('Residence Visa', v)} />
                </Fg>
                <Fg label="EID Expiry Date">
                  <Input type="date" value={expiries['Emirates ID'] ?? ''} onChange={(v) => setExpiry('Emirates ID', v)} />
                </Fg>
                <Fg label="Labour Card Issue Date">
                  <Input type="date" value={f('labourCardIssue')} onChange={(x) => setF('labourCardIssue', x)} />
                </Fg>
                <Fg label="Labour Card Expiry Date" error={shownErr('labourCardExpiry')}>
                  <Input type="date" value={expiries['Labour Card'] ?? ''} onChange={(v) => setExpiry('Labour Card', v)} />
                </Fg>
              </div>
              <div className="note-box" style={{ marginTop: 10 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                </svg>
                <div>Visa / EID / Labour Card apply to UAE employees.</div>
              </div>

              <div className="subhd" style={{ marginTop: 18 }}>
                New Employment Visa Workflow
              </div>
              <p className="desc">Track the employment visa stage by stage. Mark each stage complete as it finishes, or click any stage to jump straight to it.</p>
              <div className="tbar" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', marginBottom: 12 }}>
                <div style={{ fontSize: 13 }}>
                  {visaStep >= VISA_FLAT.length ? (
                    <b>All {VISA_FLAT.length} visa stages complete</b>
                  ) : (
                    <>
                      Current stage: <b>{VISA_FLAT[visaStep]}</b> <span style={{ color: 'var(--muted)' }}>({visaStep + 1} of {VISA_FLAT.length})</span>
                    </>
                  )}
                </div>
                <span className="sp" />
                <Button size="sm" onClick={() => setVisaStep((v) => Math.max(0, v - 1))} disabled={visaStep === 0}>
                  Undo
                </Button>
                <Button size="sm" variant="primary" onClick={() => setVisaStep((v) => Math.min(VISA_FLAT.length, v + 1))} disabled={visaStep >= VISA_FLAT.length}>
                  <CheckIcon /> Mark stage complete
                </Button>
              </div>
              {VISA_STAGES.map((g, gi) => (
                <div key={g.group} style={{ marginBottom: 14 }}>
                  <div className="subhd" style={{ marginTop: gi === 0 ? 4 : 14 }}>
                    {g.group}
                  </div>
                  <div className="aflow">
                    {g.stages.map((s, si) => {
                      const globalIdx = VISA_STAGES.slice(0, gi).reduce((n, x) => n + x.stages.length, 0) + si;
                      const state = globalIdx < visaStep ? 'done' : globalIdx === visaStep ? 'cur' : '';
                      return (
                        <div
                          key={s}
                          role="button"
                          tabIndex={0}
                          className={`node ${state}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setVisaStep(globalIdx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setVisaStep(globalIdx);
                            }
                          }}
                        >
                          <div className="role">{s}</div>
                          <div className="act">{state === 'done' ? 'Completed' : state === 'cur' ? 'In progress' : 'Pending'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="card" style={{ marginTop: 6 }}>
                <div className="card-head">
                  <div>
                    <h3>Visa Process Completed</h3>
                    <div className="sub">Final outputs</div>
                  </div>
                  <StatusBadge status={visaStep >= VISA_FLAT.length ? 'Completed' : visaStep > 0 ? 'In Progress' : 'Pending'} />
                </div>
                <div style={{ padding: '14px 18px 18px' }}>
                  <div className="g3">
                    {VISA_OUTPUTS.map((o) => {
                      const ready = visaStep > VISA_FLAT.indexOf(o.stage);
                      return (
                        <div key={o.label} className="doc" style={{ margin: 0 }}>
                          <div className="fic">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <path d="M14 2v6h6" />
                            </svg>
                          </div>
                          <div>
                            <div className="nm">{o.label}</div>
                            <div className="mt" style={ready ? { color: '#15803D', fontWeight: 600 } : undefined}>
                              {ready ? 'Ready' : 'Generated on completion'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="note-box" style={{ marginTop: 12 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                    </svg>
                    <div>Process may vary depending on emirate, free zone, or employee status.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={step === 3 ? undefined : { display: 'none' }}>
            <h3>Emergency contacts</h3>
            <p className="desc">{isIndia ? 'Emergency contacts in India. Add as many as needed.' : 'Local (UAE) and home-country contacts. Add as many as needed.'}</p>
            <div className="subhd">{isIndia ? 'Primary Emergency Contact' : 'Local Emergency Contact (UAE)'}</div>
            <Repeatable<EmergencyRow>
              label={isIndia ? 'primary contact' : 'local contact'}
              title={isIndia ? 'Primary contact' : 'Local contact'}
              rows={emA}
              onChange={setEmA}
              blank={blankContact}
              render={(r, up, i) => (
                <div className="form-grid">
                  <Fg label="Name" error={shownErr(`emA.${i}.name`)}>
                    <Input value={r.name} onChange={(x) => up({ name: x })} />
                  </Fg>
                  <Fg label="Relationship">
                    <Input value={r.relationship} onChange={(x) => up({ relationship: x })} />
                  </Fg>
                  <Fg label="Mobile Number" error={shownErr(`emA.${i}.mobile`)}>
                    <Phone def={def} value={r.mobile} onChange={(x) => up({ mobile: x })} />
                  </Fg>
                </div>
              )}
            />
            <div className="subhd" style={{ marginTop: 16 }}>
              {isIndia ? 'Alternate Emergency Contact' : 'Home Country Emergency Contact'}
            </div>
            <Repeatable<EmergencyRow>
              label={isIndia ? 'alternate contact' : 'home contact'}
              title={isIndia ? 'Alternate contact' : 'Home contact'}
              rows={emB}
              onChange={setEmB}
              blank={blankContact}
              render={(r, up, i) => (
                <div className="form-grid">
                  <Fg label="Name" error={shownErr(`emB.${i}.name`)}>
                    <Input value={r.name} onChange={(x) => up({ name: x })} />
                  </Fg>
                  <Fg label="Relationship">
                    <Input value={r.relationship} onChange={(x) => up({ relationship: x })} />
                  </Fg>
                  <Fg label="Mobile Number" error={shownErr(`emB.${i}.mobile`)}>
                    {isIndia ? <Phone def={def} value={r.mobile} onChange={(x) => up({ mobile: x })} /> : <Input type="tel" placeholder="+ country code …" value={r.mobile} onChange={(x) => up({ mobile: x })} />}
                  </Fg>
                </div>
              )}
            />
          </div>

          <div style={step === 4 ? undefined : { display: 'none' }}>
            <h3>Work experience &amp; education</h3>
            <p className="desc">Prior experience and qualifications. Add multiple entries.</p>
            <div className="subhd">Work Experience</div>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <Fg label="Total Experience before joining">
                <Input placeholder="e.g. 6 years" value={f('totalExperience')} onChange={(x) => setF('totalExperience', x)} />
              </Fg>
            </div>
            <Repeatable<ExperienceRow>
              label="experience"
              title="Experience"
              rows={exp}
              onChange={setExp}
              blank={blankExperience}
              render={(r, up, i) => (
                <div className="form-grid">
                  <Fg label="Company Name" error={shownErr(`exp.${i}.company`)}>
                    <Input value={r.company} onChange={(x) => up({ company: x })} />
                  </Fg>
                  <Fg label="Location">
                    <Input value={r.location} onChange={(x) => up({ location: x })} />
                  </Fg>
                  <Fg label="From Date">
                    <Input type="date" value={r.from} onChange={(x) => up({ from: x })} />
                  </Fg>
                  <Fg label="To Date" error={shownErr(`exp.${i}.to`)}>
                    <Input type="date" value={r.to} onChange={(x) => up({ to: x })} />
                  </Fg>
                  <Fg label="Job Title">
                    <Input value={r.title} onChange={(x) => up({ title: x })} />
                  </Fg>
                  <Fg label="Mode of work">
                    <Select options={WORK_MODES} value={r.mode} onChange={(x) => up({ mode: x })} />
                  </Fg>
                </div>
              )}
            />
            <div className="subhd" style={{ marginTop: 16 }}>
              Education
            </div>
            <Repeatable<EducationRow>
              label="education"
              title="Education"
              rows={edu}
              onChange={setEdu}
              blank={blankEducation}
              render={(r, up, i) => (
                <div className="form-grid">
                  <Fg label="Highest Educational Qualification">
                    <Input value={r.qualification} onChange={(x) => up({ qualification: x })} />
                  </Fg>
                  <Fg label="School / University" error={shownErr(`edu.${i}.institution`)}>
                    <Input value={r.institution} onChange={(x) => up({ institution: x })} />
                  </Fg>
                  <Fg label="Course Name">
                    <Input value={r.course} onChange={(x) => up({ course: x })} />
                  </Fg>
                  <Fg label="Field of study">
                    <Input value={r.field} onChange={(x) => up({ field: x })} />
                  </Fg>
                  <Fg label="Starting Year">
                    <Input value={r.startYear} onChange={(x) => up({ startYear: x })} />
                  </Fg>
                  <Fg label="Ending Year" error={shownErr(`edu.${i}.endYear`)}>
                    <Input value={r.endYear} onChange={(x) => up({ endYear: x })} />
                  </Fg>
                </div>
              )}
            />
          </div>

          <div style={step === 5 ? undefined : { display: 'none' }}>
            <h3>Family</h3>
            <p className="desc">Family members. Add multiple entries.</p>
            <Repeatable<FamilyRow>
              label="family member"
              title="Family member"
              rows={fam}
              onChange={setFam}
              blank={blankFamily}
              render={(r, up, i) => (
                <div className="form-grid">
                  <Fg label="Name" error={shownErr(`fam.${i}.name`)}>
                    <Input value={r.name} onChange={(x) => up({ name: x })} />
                  </Fg>
                  <Fg label="Relationship">
                    <Input value={r.relationship} onChange={(x) => up({ relationship: x })} />
                  </Fg>
                  <Fg label="Occupation">
                    <Input value={r.occupation} onChange={(x) => up({ occupation: x })} />
                  </Fg>
                </div>
              )}
            />
          </div>

          <div style={step === 6 ? undefined : { display: 'none' }}>
            <h3>Bank &amp; PF details</h3>
            <p className="desc">Salary account. This data is shared with Payroll once the onboarding is approved.</p>
            <div className="hint" style={{ marginBottom: 14 }}>
              Showing fields for <b>{country}</b>. Change the work location in step 1.
            </div>
            <div className="form-grid">
              <Fg label="Payment Mode" required>
                <Select options={payModes} value={payMode} onChange={(x) => setF('paymentMode', x)} />
              </Fg>
              <Fg label="Bank Name" required error={shownErr('bankName')}>
                <Input value={f('bankName')} onChange={(x) => setF('bankName', x)} />
              </Fg>
              <Fg label="Account Holder Name" required>
                <Input value={fullName} readOnly />
              </Fg>
              {isIndia ? (
                <>
                  <Fg label="Account Number" required error={shownErr('accountNumber')}>
                    <Input value={f('accountNumber')} onChange={(x) => setF('accountNumber', x)} placeholder="9 to 18 digits" />
                  </Fg>
                  <Fg label="IFSC" required error={shownErr('branchCode')}>
                    <Input value={f('branchCode')} onChange={(x) => setF('branchCode', x.toUpperCase())} placeholder="e.g. HDFC0001234" />
                  </Fg>
                </>
              ) : (
                <>
                  <Fg label="IBAN Number" required error={shownErr('accountNumber')}>
                    <Input placeholder="AE•• •••• •••• •••• •••• •••" value={f('accountNumber')} onChange={(x) => setF('accountNumber', x)} />
                    <span className="hint">AE + 21 digits (23 characters). Spaces are ignored.</span>
                  </Fg>
                  <Fg label="Routing Number">
                    <Input placeholder="MOL-ENBD-…" value={f('branchCode')} onChange={(x) => setF('branchCode', x)} />
                  </Fg>
                </>
              )}
            </div>
            {isIndia && (
              <>
                <div className="subhd" style={{ marginTop: 14 }}>
                  PF Details (India)
                </div>
                <div className="form-grid">
                  <Fg label="UAN" error={shownErr('uan')}>
                    <Input placeholder="12-digit UAN" value={f('uan')} onChange={(x) => setF('uan', x)} />
                  </Fg>
                </div>
              </>
            )}
          </div>

          <div style={step === 7 ? undefined : { display: 'none' }}>
            <h3>Salary</h3>
            <p className="desc">Salary structure for the selected location.</p>
            <div className="hint" style={{ marginBottom: 14 }}>
              Showing fields for <b>{country}</b>. Change the work location in step 1.
            </div>
            {isIndia ? (
              <>
                <div className="subhd">Earnings</div>
                <div className="form-grid">
                  {INDIA_EARN.map((l, i) => (
                    <Fg key={l} label={l} required={i === 0} error={shownErr(`sal.${l}`)}>
                      <Input type="number" value={sal[l] ?? ''} onChange={(x) => setSal((p) => ({ ...p, [l]: x }))} />
                    </Fg>
                  ))}
                  <Fg label="Total Earnings">
                    <Input readOnly value={String(totalEarn)} />
                  </Fg>
                </div>
                <div className="subhd" style={{ marginTop: 14 }}>
                  Deductions
                </div>
                <div className="form-grid">
                  {INDIA_DED.map((l) => (
                    <Fg key={l} label={l} error={shownErr(`sal.${l}`)}>
                      <Input type="number" value={sal[l] ?? ''} onChange={(x) => setSal((p) => ({ ...p, [l]: x }))} />
                    </Fg>
                  ))}
                  <Fg label="Total Deductions">
                    <Input readOnly value={String(totalDed)} />
                  </Fg>
                </div>
                <div className="subhd" style={{ marginTop: 14 }}>
                  Take Home Salary
                </div>
                <div className="form-grid">
                  <Fg label="Take Home Salary Amount (Net Pay)">
                    <Input readOnly value={String(totalEarn - totalDed)} />
                  </Fg>
                </div>
                <div className="subhd" style={{ marginTop: 16 }}>
                  Benefits Contribution Summary
                </div>
                <table style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                  <thead>
                    <tr>
                      <th>Benefits</th>
                      <th>Employee Contribution</th>
                      <th>Employer Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['EPF Contribution', '₹1,800.00', '₹550.00'],
                      ['EPS Contribution', '₹0.00', '₹1,250.00'],
                      ['Employer EDLI Contribution', '₹0.00', '₹75.00'],
                      ['Employer EPF Admin Charges', '₹0.00', '₹75.00'],
                      ['Total Contribution', '₹1,800.00', '₹1,950.00'],
                    ].map((r, i) => (
                      <tr key={r[0]} style={i === 4 ? { fontWeight: 700, background: 'var(--bg)' } : undefined}>
                        <td>{r[0]}</td>
                        <td className="mono">{r[1]}</td>
                        <td className="mono">{r[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <div className="subhd">Earnings ({country})</div>
                <div className="form-grid">
                  {UAE_EARN.map((l, i) => (
                    <Fg key={l} label={l} required={i === 0} error={shownErr(`sal.${l}`)}>
                      <Input type="number" placeholder={def.currency} value={sal[l] ?? ''} onChange={(x) => setSal((p) => ({ ...p, [l]: x }))} />
                    </Fg>
                  ))}
                  <Fg label="Total Salary">
                    <Input readOnly value={`${def.currency} ${totalEarn.toLocaleString('en-US')}`} />
                  </Fg>
                </div>
                <div className="note-box" style={{ marginTop: 12 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                  </svg>
                  <div>Total Salary auto-sums the components and flows into the WPS payroll file.</div>
                </div>
              </>
            )}
          </div>

          <div style={step === 8 ? undefined : { display: 'none' }}>
            <h3>Documents</h3>
            <p className="desc">Upload the required documents for the selected location. Documents that expire need an expiry date so reminders can be sent.</p>
            <div className="hint" style={{ marginBottom: 14 }}>
              Showing fields for <b>{country}</b>. Change the work location in step 1.
            </div>
            <label className="notify-check" style={{ margin: '0 0 12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={notifyDocs} onChange={(e) => setNotifyDocs(e.target.checked)} className="chk" style={{ width: 15, height: 15 }} />
              Notify employee when documents are uploaded
            </label>
            <div className="subhd">Expiry reminders</div>
            <p className="desc">Employees are notified automatically before any document with an expiry date runs out.</p>
            <div className="form-grid" style={{ marginBottom: 6 }}>
              <div className="fg">
                <label>Remind before expiry</label>
                <ChipToggle items={REMINDER_DAYS} selected={reminderDays} onToggle={(v) => toggleFlag(reminderDays, setReminderDays, v)} format={(d) => `${d} days`} />
              </div>
              <div className="fg">
                <label>Notify</label>
                <ChipToggle items={REMINDER_TO} selected={reminderTo} onToggle={(v) => toggleFlag(reminderTo, setReminderTo, v)} />
              </div>
            </div>
            <div className="note-box" style={{ marginBottom: 14 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
              </svg>
              <div>
                {dated.length} of {expiringDocs.length} expiry dates entered
                {nearest ? ` · nearest: ${nearest} on ${expiries[nearest]} (${daysUntil(expiries[nearest]) < 0 ? 'already expired' : `${daysUntil(expiries[nearest])} days`})` : ''}.{' '}
                {reminderDays.size && reminderTo.size
                  ? `Reminders go to ${Array.from(reminderTo).join(', ')} ${Array.from(reminderDays).sort((x, y) => Number(y) - Number(x)).join(' / ')} days before each expiry.`
                  : 'Select at least one reminder interval and one recipient to enable reminders.'}
              </div>
            </div>
            <div className="subhd">Documents</div>
            <div className="form-grid">
              {docList.map((d) => (
                <UploadBox key={d} label={d} expiry={EXPIRING_DOCS.includes(d) ? { value: expiries[d] ?? '', onChange: (v) => setExpiry(d, v) } : undefined} />
              ))}
            </div>
            {!isIndia && (
              <>
                <div className="subhd" style={{ marginTop: 14 }}>
                  UAE Sales Team only
                </div>
                <div className="form-grid">
                  {['Self Approval Document Signed', 'Target Incentive Agreement'].map((d) => (
                    <UploadBox key={d} label={d} />
                  ))}
                </div>
              </>
            )}
          </div>

          {step === 9 && !done && (
            <>
              <h3>Assets &amp; approval</h3>
              <p className="desc">Pre-provision assets and send the request through the onboarding approval line.</p>
              <div className="subhd">Assets required</div>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 16 }}>
                {ASSET_OPTIONS.map((x) => (
                  <button
                    key={x}
                    type="button"
                    className="chip"
                    onClick={() => toggleFlag(assetFlags, setAssetFlags, x)}
                    style={assetFlags.has(x) ? { background: 'var(--primary-50)', borderColor: 'var(--primary-100)', color: 'var(--primary)' } : undefined}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="subhd">Review</div>
              <div className="lc-sum">
                <Avatar initials={fullName.trim() ? initialsOf(fullName.trim()) : '?'} seed={deptValue} size={48} />
                <div>
                  <div className="lc-sum-n">{fullName.trim() || 'New candidate'}</div>
                  <div className="lc-sum-s">
                    {designations.find((x) => x.id === designationId)?.title ?? 'Designation not set'} · {selectedDept?.name ?? 'Department not set'}
                    {selectedCompany ? ` · ${selectedCompany.name}` : ''}
                  </div>
                </div>
                <div className="lc-sum-tags">
                  <span className="lc-pill">{country}</span>
                  <span className="lc-pill">{role}</span>
                  <span className="lc-pill">{joiningDate ? `Joins ${joiningDate}` : 'Joining date not set'}</span>
                </div>
              </div>
              <div className="g2 lc-review">
                <div>
                  <div className="field">
                    <span className="k">Employee ID</span>
                    <span className="v">{employeeCode}</span>
                  </div>
                  <div className="field">
                    <span className="k">Work location</span>
                    <span className="v">{country}</span>
                  </div>
                  <div className="field">
                    <span className="k">Department</span>
                    <span className="v">{deptValue}</span>
                  </div>
                  <div className="field">
                    <span className="k">System role</span>
                    <span className="v">{role}</span>
                  </div>
                  <div className="field">
                    <span className="k">Sign-in email</span>
                    <span className="v">{signInEmail || '—'}</span>
                  </div>
                  <div className="field">
                    <span className="k">Bank &amp; salary</span>
                    <span className="v">{`${def.currency} · ${isIndia ? 'EPF/UAN' : 'WPS'}`}</span>
                  </div>
                </div>
                <div>
                  <div className="field">
                    <span className="k">Assets</span>
                    <span className="v">{assetFlags.size ? Array.from(assetFlags).join(', ') : '—'}</span>
                  </div>
                  <div className="field">
                    <span className="k">Request status</span>
                    <span className="v">Pending approval</span>
                  </div>
                  <div className="field">
                    <span className="k">Expiry reminders</span>
                    <span className="v">{dated.length ? `${dated.length} document(s) · ${Array.from(reminderDays).sort((x, y) => Number(y) - Number(x)).join('/')} days` : 'No expiry dates entered'}</span>
                  </div>
                  <div className="field">
                    <span className="k">Probation completion</span>
                    <span className="v">{probationDate || 'auto · +6 months'}</span>
                  </div>
                </div>
              </div>
              <div className="subhd" style={{ marginTop: 16 }}>
                Approval line
              </div>
              <ol className="fm-chain" aria-label="Onboarding approval line">
                {approvalLine.map((s, i) => (
                  <li key={s}>
                    <span className="lc-pill">
                      {i + 1}. {s}
                      {s === 'Manager review' && managerName ? ` (${managerName})` : ''}
                    </span>
                  </li>
                ))}
              </ol>
              <span className="hint">As configured under Administration → Workflow Settings.</span>
              <div className="note-box row-gap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="m9 11 3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <div>
                  Creating the employee adds the record with status Onboarding and an onboarding request that waits for approval. Bank &amp; salary details sync to Payroll, document expiries
                  enrol into RMS and the post-onboarding self-service form goes out once the approval line is complete.
                </div>
              </div>
            </>
          )}

          {created && (
            <div className="lc-done">
              <div className="lc-done-ic">
                <CheckIcon style={{ width: 28, height: 28 }} />
              </div>
              <h3 style={{ marginTop: 16 }}>Employee created</h3>
              <p style={{ marginTop: 4, color: 'var(--muted)', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                {created.name} (ID {created.code}) has been added to the {created.country} directory as Onboarding with the {created.role} role, and the onboarding request is pending approval
                ({approvalLine.join(' → ')}). Sign-in ID: {created.email}. Assets requested: {created.assets}. Payroll is notified once HR approves.
              </p>
              <Button variant="primary" style={{ marginTop: 18 }} onClick={onClose}>
                Back to onboarding list
              </Button>
            </div>
          )}
        </div>

        {!done && (
          <div className="wizfoot">
            <div className="autosave">
              <span className="dot" /> Draft saved automatically
              {roleError && <span style={{ marginLeft: 14, color: '#B91C1C', fontWeight: 600 }}>{roleError}</span>}
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {step === 0 && (
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
              )}
              <Button variant="primary" onClick={next}>
                {step === STEPS.length - 1 ? 'Create employee' : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
