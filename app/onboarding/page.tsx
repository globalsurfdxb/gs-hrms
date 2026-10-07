'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { EMPLOYEES, ONBOARDING_REQUESTS, REFERENCE_TODAY, nextEmployeeCode } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Location, LocationDef } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { CheckIcon, UploadIcon, XIcon } from '@/components/icons';

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

function Fg({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="fg">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ type = 'text', placeholder, value, onChange, readOnly }: { type?: string; placeholder?: string; value?: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  return <input type={type} placeholder={placeholder} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} readOnly={readOnly} style={readOnly ? { background: 'var(--bg)', color: 'var(--text)' } : undefined} />;
}

function Select({ options, value, onChange }: { options: string[]; value?: string; onChange?: (v: string) => void }) {
  return (
    <select value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

function TextArea({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="fg full">
      <label>{label}</label>
      <textarea rows={5} placeholder={placeholder} style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
    </div>
  );
}

function PhoneInput({ code, digits, placeholder }: { code: string; digits: number; placeholder: string }) {
  const [v, setV] = useState('');
  return (
    <>
      <div style={{ display: 'flex' }}>
        <span style={{ display: 'grid', placeItems: 'center', padding: '0 12px', border: '1px solid var(--border)', borderRight: 'none', borderRadius: 'var(--r-sm) 0 0 var(--r-sm)', background: 'var(--bg)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{code}</span>
        <input
          type="tel"
          inputMode="numeric"
          value={v}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, digits))}
          style={{ flex: 1, minWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
        />
      </div>
      <span className="hint">{digits}-digit number without the country code</span>
    </>
  );
}

function Phone({ def }: { def: LocationDef }) {
  return <PhoneInput key={def.id} code={def.phoneCode} digits={def.phoneDigits} placeholder={def.phoneExample ?? '0'.repeat(def.phoneDigits)} />;
}

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

function Repeatable({ label, title, children }: { label: string; title: string; children: () => React.ReactNode }) {
  const [ids, setIds] = useState<number[]>([0]);
  return (
    <>
      {ids.map((id, i) => (
        <div key={id} style={i > 0 ? { marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' } : undefined}>
          {i > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                {title} #{i + 1}
              </span>
              <button type="button" className="icon-act" title={`Remove ${title.toLowerCase()} #${i + 1}`} onClick={() => setIds((prev) => prev.filter((x) => x !== id))}>
                <XIcon />
              </button>
            </div>
          )}
          {children()}
        </div>
      ))}
      <AddNew label={label} onClick={() => setIds((prev) => [...prev, Math.max(...prev) + 1])} />
    </>
  );
}

export default function OnboardingPage() {
  const { location } = useApp();
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [office, setOffice] = useState<Location>(location);
  const [done, setDone] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [visaStep, setVisaStep] = useState(0);
  const [assetFlags, setAssetFlags] = useState<Set<string>>(new Set(['Laptop', 'Access card']));
  const [notifyDocs, setNotifyDocs] = useState(true);
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [reminderDays, setReminderDays] = useState<Set<string>>(new Set(REMINDER_DAYS));
  const [reminderTo, setReminderTo] = useState<Set<string>>(new Set(['Employee', 'HR']));

  const { companies, departments, designations, locations, locationsLabel, locationDef } = useOrg();
  const def = locationDef(office) ?? locations[0];
  const isIndia = def.template === 'india';
  const country = def.name;
  const uaeDef = locations.find((l) => l.id === 'Dubai') ?? def;
  const steps = STEPS.map((s, i) => (i === 2 && isIndia ? 'Passport / Aadhaar / PAN' : s));
  const selectedCompany = companies.find((c) => c.id === organizationId);
  const companyDepts = selectedCompany ? departments.filter((d) => d.companyId === selectedCompany.id && d.locations.includes(office)) : [];
  const selectedDept = companyDepts.find((d) => d.id === departmentId);
  const deptDesigs = selectedDept ? designations.filter((x) => x.departmentId === selectedDept.id) : [];
  const employeeCode = nextEmployeeCode(createdCount);
  const setExpiry = (doc: string, v: string) => setExpiries((prev) => ({ ...prev, [doc]: v }));
  const docList = isIndia
    ? ['Passport Copy', 'Signed Company Offer Letter', 'Highest Educational Certificate', 'PAN Card', 'Aadhaar Card', 'Passbook / Bank Statement', 'Signed NDA', 'Signed Employment Contract', 'Insurance Document', 'KPI', 'Passport Size Photo', 'Casual Photo']
    : ['Passport Copy', 'Signed Company Offer Letter', 'Attested Educational Certificate', 'Labour Card', 'Residence Visa', 'Emirates ID', 'Signed NDA', 'UAE Driving Licence', 'Medical Insurance E-Card', 'KPI', 'Passport Size Photo', 'Casual Photo'];
  const expiringDocs = docList.filter((d) => EXPIRING_DOCS.includes(d));
  const dated = expiringDocs.filter((d) => expiries[d]);
  const nearest = dated.length ? dated.reduce((a, b) => (expiries[a] <= expiries[b] ? a : b)) : null;
  const deptValue = selectedDept?.name ?? 'Select…';
  const managers = EMPLOYEES.filter((e) => e.employmentStatus === 'Active').map((e) => ({ value: e.id, label: e.name, meta: e.employeeCode }));

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
    return d.toISOString().slice(0, 10);
  }, [joiningDate]);

  const toggleFlag = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSet(next);
  };

  if (!showWizard) {
    return (
      <div>
        <PageHeader
          eyebrow="Module 02 · Lifecycle"
          title="Onboarding"
          description="A guided 10-step wizard capturing the full employee record. Creates the employee and triggers asset provisioning and RMS enrolment."
          actions={
            <Button variant="primary" onClick={() => setShowWizard(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              New onboarding
            </Button>
          }
        />
        <Card>
          <CardHeader title="In-progress onboardings" sub="Across both locations" />
          {ONBOARDING_REQUESTS.map((r) => (
            <div key={r.id} className="doc" style={{ margin: '9px 16px' }}>
              <div className="fic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M19 8v6M22 11h-6" />
                </svg>
              </div>
              <div>
                <div className="nm">{r.candidateName}</div>
                <div className="mt">
                  {r.designation} · {r.department} · {r.location} · Starts {r.startDate}
                </div>
              </div>
              <div className="rt" style={{ gap: 12 }}>
                <div style={{ width: 110 }}>
                  <div style={{ height: 6, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(r.step / 10) * 100}%`, background: 'var(--primary)', borderRadius: 6 }} />
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>Step {r.step}/10</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="New onboarding"
        title={fullName || 'New candidate'}
        description="A guided 10-step wizard capturing the full employee record. Creates the employee and triggers asset provisioning and RMS enrolment."
      />

      <Card>
        <div className="stepper">
          {steps.map((s, i) => (
            <div key={i} className="step">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={`num ${i < step ? 'done' : i === step ? 'active' : ''}`}>{i < step ? <CheckIcon style={{ width: 14, height: 14 }} /> : i + 1}</div>
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
          <div style={step === 0 ? undefined : { display: 'none' }}>
              <h3>Personal details</h3>
              <p className="desc">Identity information for the new joiner. Age is auto-calculated from date of birth.</p>
              <div className="fg full" style={{ marginBottom: 18 }}>
                <label>
                  Work location <span className="req">*</span>
                </label>
                <div className="subseg" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
                  {locations.map((l) => (
                    <button key={l.id} type="button" className={l.id === def.id ? 'on' : ''} onClick={() => setOffice(l.id)}>
                      {l.name}
                    </button>
                  ))}
                </div>
                <span className="hint">Choose this first. Phone format, address, identity documents, bank, salary and document lists adapt to the location.</span>
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
                <Fg label="Full Name (as per passport)" required>
                  <Input placeholder="e.g. Zayd Rahman" value={fullName} onChange={setFullName} />
                </Fg>
                <Fg label="Personal Mobile Number" required>
                  <Phone def={def} />
                </Fg>
                <Fg label="Personal Email ID" required>
                  <Input type="email" placeholder="name@email.com" />
                </Fg>
                <Fg label="Date of birth" required>
                  <Input type="date" value={dob} onChange={setDob} />
                </Fg>
                <Fg label="Age">
                  <Input value={age} readOnly placeholder="auto from DOB" />
                </Fg>
                <Fg label="Nationality" required>
                  <Select options={['Select nationality…', 'India', 'Pakistan', 'UAE', 'Egypt', 'Jordan', 'Philippines']} />
                </Fg>
                <Fg label="Gender">
                  <Select options={['Select…', 'Male', 'Female']} />
                </Fg>
                <Fg label="Marital status">
                  <Select options={['Single', 'Married']} />
                </Fg>
                <Fg label="Blood group">
                  <Select options={['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']} />
                </Fg>
                <TextArea label={`Current address (${country})`} placeholder={ADDRESS[def.template]} />
                <TextArea label="Permanent address (home country)" placeholder={isIndia ? ADDRESS.india : 'House / Flat Number:\nBuilding / House Name:\nCity / District:\nState / Province:\nCountry:\nPostal Code:'} />
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
                <Fg label="Organization" required>
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
                <Fg label="Department" required>
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
                <Fg label="Designation" required>
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
                <Fg label="Reporting manager" required>
                  <SearchSelect options={managers} value={managerId} onChange={setManagerId} placeholder="Search by name or employee ID…" emptyText="No employees found" />
                </Fg>
                <Fg label="Employment type" required>
                  <Select options={['Permanent', 'Temporary', 'Contract', 'Trainee']} />
                </Fg>
                <Fg label="Joining date" required>
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
                  <Select key={def.id} options={def.seating.length ? def.seating : ['No seating locations set']} />
                  {!def.seating.length && <span className="hint">Add seating locations for {country} under Administration → System Settings.</span>}
                </Fg>
                <Fg label="Work Phone (Official Mobile)">
                  <Phone def={def} />
                </Fg>
                <Fg label="Extension">
                  <Input placeholder="e.g. 712" />
                </Fg>
                {isIndia && (
                  <Fg label="Work Phone — UAE">
                    <Phone def={uaeDef} />
                  </Fg>
                )}
              </div>
          </div>

          {isIndia && (
            <div style={step === 2 ? undefined : { display: 'none' }}>
              <h3>Passport / Aadhaar / PAN details</h3>
              <p className="desc">Statutory identity documents for India. Aadhaar and PAN are used for payroll, PF and tax filing.</p>
              <div className="form-grid">
                <Fg label="Passport Number">
                  <Input placeholder="e.g. K1234567" />
                </Fg>
                <Fg label="Passport Expiry Date">
                  <Input type="date" value={expiries['Passport Copy'] ?? ''} onChange={(v) => setExpiry('Passport Copy', v)} />
                </Fg>
                <Fg label="Aadhaar Number" required>
                  <Input placeholder="12-digit Aadhaar" />
                </Fg>
                <Fg label="PAN Number" required>
                  <Input placeholder="e.g. ABCDE1234F" />
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
                <Fg label="Passport Number" required>
                  <Input />
                </Fg>
                <Fg label="Emirates ID">
                  <Input placeholder="784-…." />
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
                  <Input type="date" />
                </Fg>
                <Fg label="Labour Card Expiry Date">
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
              <p className="desc">
                {isIndia ? 'Emergency contacts in India. Add as many as needed.' : 'Local (UAE) and home-country contacts. Add as many as needed.'}
              </p>
              <div className="subhd">{isIndia ? 'Primary Emergency Contact' : 'Local Emergency Contact (UAE)'}</div>
              <Repeatable label={isIndia ? 'primary contact' : 'local contact'} title={isIndia ? 'Primary contact' : 'Local contact'}>
                {() => (
                  <div className="form-grid">
                <Fg label="Name">
                  <Input />
                </Fg>
                <Fg label="Relationship">
                  <Input />
                </Fg>
                <Fg label="Mobile Number">
                  <Phone def={def} />
                </Fg>
              </div>
                )}
              </Repeatable>
              <div className="subhd" style={{ marginTop: 16 }}>
                {isIndia ? 'Alternate Emergency Contact' : 'Home Country Emergency Contact'}
              </div>
              <Repeatable label={isIndia ? 'alternate contact' : 'home contact'} title={isIndia ? 'Alternate contact' : 'Home contact'}>
                {() => (
                  <div className="form-grid">
                <Fg label="Name">
                  <Input />
                </Fg>
                <Fg label="Relationship">
                  <Input />
                </Fg>
                <Fg label="Mobile Number">
                  {isIndia ? <Phone def={def} /> : <Input type="tel" placeholder="+ country code …" />}
                </Fg>
              </div>
                )}
              </Repeatable>
          </div>

          <div style={step === 4 ? undefined : { display: 'none' }}>
              <h3>Work experience &amp; education</h3>
              <p className="desc">Prior experience and qualifications. Add multiple entries.</p>
              <div className="subhd">Work Experience</div>
              <Repeatable label="experience" title="Experience">
                {() => (
                  <div className="form-grid">
                <Fg label="Total Years of Experience">
                  <Input />
                </Fg>
                <Fg label="Company Name">
                  <Input />
                </Fg>
                <Fg label="Location">
                  <Input />
                </Fg>
                <Fg label="From Date">
                  <Input type="date" />
                </Fg>
                <Fg label="To Date">
                  <Input type="date" />
                </Fg>
                <Fg label="Job Title">
                  <Input />
                </Fg>
                <Fg label="Mode of work">
                  <Select options={['Onsite', 'Remote']} />
                </Fg>
              </div>
                )}
              </Repeatable>
              <div className="subhd" style={{ marginTop: 16 }}>
                Education
              </div>
              <Repeatable label="education" title="Education">
                {() => (
                  <div className="form-grid">
                <Fg label="Highest Educational Qualification">
                  <Input />
                </Fg>
                <Fg label="School / University">
                  <Input />
                </Fg>
                <Fg label="Course Name">
                  <Input />
                </Fg>
                <Fg label="Field of study">
                  <Input />
                </Fg>
                <Fg label="Starting Year">
                  <Input />
                </Fg>
                <Fg label="Ending Year">
                  <Input />
                </Fg>
                <Fg label="Actual Duration of Course">
                  <Input />
                </Fg>
              </div>
                )}
              </Repeatable>
          </div>

          <div style={step === 5 ? undefined : { display: 'none' }}>
              <h3>Family</h3>
              <p className="desc">Family members. Add multiple entries.</p>
              <Repeatable label="family member" title="Family member">
                {() => (
                  <div className="form-grid">
                <Fg label="Name">
                  <Input />
                </Fg>
                <Fg label="Relationship">
                  <Input />
                </Fg>
                <Fg label="Occupation">
                  <Input />
                </Fg>
              </div>
                )}
              </Repeatable>
          </div>

          <div style={step === 6 ? undefined : { display: 'none' }}>
              <h3>Bank &amp; PF details</h3>
              <p className="desc">Salary account. This data is automatically shared with Payroll.</p>
              <div className="hint" style={{ marginBottom: 14 }}>
                Showing fields for <b>{country}</b>. Change the work location in step 1.
              </div>
              <div className="form-grid">
                <Fg label="Payment Mode" required>
                  <Select options={isIndia ? ['Bank Transfer', 'Cheque'] : ['WPS Transfer', 'Bank Transfer']} />
                </Fg>
                <Fg label="Bank Name" required>
                  <Input />
                </Fg>
                <Fg label="Account Holder Name" required>
                  <Input value={fullName} readOnly />
                </Fg>
                <Fg label="Account Number" required>
                  <Input />
                </Fg>
                {isIndia ? (
                  <Fg label="IFSC" required>
                    <Input />
                  </Fg>
                ) : (
                  <>
                    <Fg label="IBAN Number" required>
                      <Input placeholder="AE•• •••• ••••" />
                    </Fg>
                    <Fg label="Routing Number">
                      <Input placeholder="MOL-ENBD-…" />
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
                    <Fg label="UAN">
                      <Input placeholder="12-digit UAN" />
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
                    <Fg label="Basic">
                      <Input type="number" />
                    </Fg>
                    <Fg label="House Rent Allowance">
                      <Input type="number" />
                    </Fg>
                    <Fg label="Fixed Allowance">
                      <Input type="number" />
                    </Fg>
                    <Fg label="Other Allowance">
                      <Input type="number" />
                    </Fg>
                    <Fg label="Total Earnings">
                      <Input readOnly placeholder="auto" />
                    </Fg>
                  </div>
                  <div className="subhd" style={{ marginTop: 14 }}>
                    Deductions
                  </div>
                  <div className="form-grid">
                    <Fg label="Advance Amount">
                      <Input type="number" />
                    </Fg>
                    <Fg label="EPF Contribution">
                      <Input type="number" />
                    </Fg>
                    <Fg label="Other Deductions">
                      <Input type="number" />
                    </Fg>
                    <Fg label="Total Deductions">
                      <Input readOnly placeholder="auto" />
                    </Fg>
                  </div>
                  <div className="subhd" style={{ marginTop: 14 }}>
                    Take Home Salary
                  </div>
                  <div className="form-grid">
                    <Fg label="Take Home Salary Amount (Net Pay)">
                      <Input readOnly placeholder="auto" />
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
                    <Fg label="Basic Salary" required>
                      <Input type="number" placeholder={def.currency} />
                    </Fg>
                    <Fg label="Transportation Allowance">
                      <Input type="number" placeholder={def.currency} />
                    </Fg>
                    <Fg label="Accommodation Allowance">
                      <Input type="number" placeholder={def.currency} />
                    </Fg>
                    <Fg label="Total Salary">
                      <Input readOnly placeholder={`${def.currency} · auto`} />
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
              <p className="desc">Pre-provision assets and route for HR Manager sign-off.</p>
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
              <div className="g2">
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
                    <span className="k">Approver</span>
                    <span className="v">Muneer (General Manager)</span>
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
              <div className="note-box row-gap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="m9 11 3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <div>
                  On approval: employee record is created, bank &amp; salary details sync to Payroll, document expiries enrol into RMS, and a
                  post-onboarding self-service form is emailed for any pending fields.
                </div>
              </div>
            </>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-50)', color: '#15803D', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
                <CheckIcon style={{ width: 28, height: 28 }} />
              </div>
              <h3 style={{ marginTop: 16 }}>Employee created</h3>
              <p style={{ marginTop: 4, color: 'var(--muted)', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                {fullName || 'The employee'} (ID {nextEmployeeCode(createdCount - 1)}) has been added to the {country} directory. Bank &amp; salary details synced to Payroll, document
                expiries enrolled into Renewal Management, and assets ({assetFlags.size ? Array.from(assetFlags).join(', ') : 'none selected'})
                have been queued for provisioning.
              </p>
              <Button
                variant="primary"
                style={{ marginTop: 18 }}
                onClick={() => {
                  setShowWizard(false);
                  setStep(0);
                  setDone(false);
                  setFullName('');
                  setDob('');
                  setJoiningDate('');
                  setOrganizationId('');
                  setDepartmentId('');
                  setDesignationId('');
                  setManagerId('');
                  setVisaStep(0);
                  setExpiries({});
                  setReminderDays(new Set(REMINDER_DAYS));
                  setReminderTo(new Set(['Employee', 'HR']));
                }}
              >
                Back to onboarding list
              </Button>
            </div>
          )}
        </div>

        {!done && (
          <div className="wizfoot">
            <div className="autosave">
              <span className="dot" /> Draft saved automatically
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {step === 0 && (
                <Button variant="ghost" onClick={() => setShowWizard(false)}>
                  Cancel
                </Button>
              )}
              <Button variant="primary" onClick={() => (step === STEPS.length - 1 ? (setDone(true), setCreatedCount((c) => c + 1)) : setStep((s) => s + 1))}>
                {step === STEPS.length - 1 ? 'Create employee' : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
