'use client';

import { DateField } from '@/components/ui/DateField';
import { Suspense, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { REQUIRED_DOCS } from '@/lib/profiles';
import { EMPLOYEES, ONBOARDING_REQUESTS, REFERENCE_TODAY, ROLE_SCOPE, nextEmployeeCode } from '@/lib/data';
import { SYSTEM_ROLES } from '@/lib/access';
import { useOrg } from '@/context/OrgContext';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Location, LocationDef, OnboardingRequest, Role } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { WithdrawOfferDialog } from '@/components/hiring/WithdrawOfferDialog';
import { JoiningFormActions, FormChip, ManualShareCard } from '@/components/onboarding/JoiningFormActions';
import { formLink, getInvites, inviteForOffer, markImported, useInvites } from '@/lib/onboardingForms';
import { Avatar } from '@/components/ui/Avatar';
import { Drawer } from '@/components/ui/Drawer';
import { TEXTAREA_STYLE } from '@/components/hiring/HiringBits';
import { StatStrip } from '@/components/ui/StatStrip';
import { daysBetween, todayISO } from '@/lib/dates';
import { PF_WAGE_CEILING, ESI_WAGE_LIMIT, indiaPayroll, uaePayroll } from '@/lib/payroll';
import { EducationRow, EmergencyRow, ExperienceRow, FamilyRow, MoneyRow, DocRow, addEmployee, canEditEmployees, decideOnboarding, employeeOfRequest, resubmitOnboarding, useEmployeeVersion, wasSentBack } from '@/lib/employeeStore';
import { BLOOD_GROUPS, EMAIL_RE, EMPLOYMENT_TYPES, GENDERS, MARITAL_STATUSES, NATIONALITIES, WORK_MODES, ibanError, ifscError, indiaAccountError, phoneOk } from '@/lib/options';
import { chainSteps } from '@/lib/workflow';
import { completeHire, getHiring, useHiring } from '@/lib/hiringStore';
import { sendRuleMail } from '@/lib/hiringMail';
import { hiringLevel } from '@/lib/hiringAccess';
import { OnboardingPrefill, onboardingPrefill, prefillProblem } from '@/lib/hiringHandoff';
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
/** Deductions HR types in. EPF, ESI and professional tax are worked out by the law, not typed. */
const INDIA_DED = ['Advance Amount', 'Other Deductions'];
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
  if (type === 'date' && !readOnly) return <DateField value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} />;
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

/** Documents that can carry typed details next to the upload: the name and number printed on the paper. */
const DOC_TEXT: Record<string, { label: string; placeholder: string }> = {
  'Passport Copy': { label: 'Passport details', placeholder: 'Passport number and the name as printed' },
  'Aadhaar Card': { label: 'Aadhaar details', placeholder: 'Aadhaar number and the name as printed' },
  'Highest Educational Certificate': { label: 'Certificate details', placeholder: 'Qualification, institution and year' },
  'Attested Educational Certificate': { label: 'Certificate details', placeholder: 'Qualification, institution and year' },
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

/** Picks a document. Files are recorded by name only until file storage is connected. */
function UploadPick({ file, onFile }: { file: string; onFile: (name: string) => void }) {
  const [problem, setProblem] = useState('');
  return (
    <>
      <label className="uploader" style={{ padding: 14, cursor: 'pointer', display: 'block' }}>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return setProblem('Use a PDF, JPG or PNG file.');
            if (f.size > 10 * 1024 * 1024) return setProblem('The file is larger than 10 MB.');
            setProblem('');
            onFile(f.name);
          }}
        />
        <UploadIcon style={{ margin: '0 auto 8px' }} />
        {file ? <b style={{ color: '#15803d' }}>✓ {file}</b> : 'Drop file or click to upload'}
      </label>
      {file && (
        <button type="button" className="lnk" style={{ textAlign: 'left', marginTop: 4 }} onClick={() => onFile('')}>
          Remove
        </button>
      )}
      {problem && <span className="hint" style={{ color: 'var(--danger)' }}>{problem}</span>}
    </>
  );
}

function UploadBox({ label, expiry, details, file, onFile, tag }: { tag?: 'Required' | 'Optional'; label: string; expiry?: { value: string; onChange: (v: string) => void }; details?: { value: string; onChange: (v: string) => void; label: string; placeholder: string }; file: string; onFile: (name: string) => void }) {
  const note = expiry ? expiryNote(expiry.value) : null;
  return (
    <div className={`fg ds-card ${file ? 'up' : ''}`}>
      <label>
        {label}
        {tag && <span className={`ds-tag ${tag === 'Required' ? 'req' : ''}`}>{tag}</span>}
      </label>
      <UploadPick file={file} onFile={onFile} />
      {details && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
            {details.label} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· optional</span>
          </label>
          <input value={details.value} onChange={(e) => details.onChange(e.target.value)} placeholder={details.placeholder} autoComplete="off" style={{ width: '100%', marginTop: 4 }} />
        </div>
      )}
      {expiry && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
            Expiry date <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· used for reminders</span>
          </label>
          <DateField value={expiry.value} onChange={(e) => expiry.onChange(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
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
  const many = rows.length > 1;
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} style={i > 0 ? { marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' } : undefined}>
          {many && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                {title} #{i + 1}
              </span>
              <button type="button" className="rep-del" title={`Delete ${title.toLowerCase()} #${i + 1}`} aria-label={`Delete ${title.toLowerCase()} #${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <XIcon /> Delete
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
const blankFamily = (): FamilyRow => ({ name: '', relationship: '', occupation: '', dob: '' });
const anyFilled = (r: object, ignore: string[] = []) => Object.entries(r).some(([k, x]) => !ignore.includes(k) && String(x).trim() !== '');

/* An unfinished onboarding is saved in this browser as the form is filled in, so a closed tab, a refresh or a
   break in the middle does not lose the work. One draft per person: a new hire, or one started from an accepted offer. */
interface Draft {
  step: number;
  office: Location;
  fullName: string;
  dob: string;
  joiningDate: string;
  organizationId: string;
  departmentId: string;
  designationId: string;
  managerId: string;
  role: Role;
  workEmail: string;
  visaStep: number;
  assetFlags: string[];
  notifyDocs: boolean;
  expiries: Record<string, string>;
  reminderDays: string[];
  reminderTo: string[];
  fv: Record<string, string>;
  sal: Record<string, string>;
  emA: EmergencyRow[];
  emB: EmergencyRow[];
  exp: ExperienceRow[];
  edu: EducationRow[];
  fam: FamilyRow[];
  /** For an onboarding started by hand: the key its joining form is kept under. */
  inviteKey?: string;
  savedAt: string;
}
const draftKey = (personId: string, offerId?: string) => `gsit.onboarding.draft.v1:${personId}:${offerId ?? 'new'}`;
function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
const clearDraft = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};
/** What the list shows about an unfinished onboarding. */
interface DraftInfo {
  /** The key of the joining form of an onboarding started by hand. */
  key?: string;
  step: number;
  name: string;
  joining: string;
  at: string;
}
const isManualDraft = (id: string) => id === 'new' || id.startsWith('new:');
/** The ids of the onboardings this person started by hand ('new:<id>', one each; 'new' is the older single draft). */
function manualDraftIds(personId: string): string[] {
  const prefix = `gsit.onboarding.draft.v1:${personId}:`;
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(`${prefix}new:`))
      .map((k) => k.slice(prefix.length));
  } catch {
    return [];
  }
}
/** The unfinished onboardings of this person ('new' for one started by hand, or an accepted offer's id), read from
    storage on the client only. */
function useDrafts(personId: string, ids: string[]): Record<string, DraftInfo> {
  const raw = useSyncExternalStore(
    () => () => {},
    () =>
      JSON.stringify(
        [...ids, ...manualDraftIds(personId)].flatMap((id) => {
          const d = loadDraft(draftKey(personId, id));
          return d ? [[id, { key: d.inviteKey, step: d.step, name: d.fullName, joining: d.joiningDate, at: d.savedAt }]] : [];
        }),
      ),
    () => '[]',
  );
  return useMemo(() => Object.fromEntries(JSON.parse(raw) as [string, DraftInfo][]), [raw]);
}
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

interface Problem {
  key: string;
  step: number;
  msg: string;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <KeyedHome />
    </Suspense>
  );
}

/** The page is rebuilt whenever the offer in the link changes, so "Start onboarding" works from this same page too
    (a link to /onboarding?hire=… from the Accepted offers card does not remount the route on its own). */
function KeyedHome() {
  const hireId = useSearchParams().get('hire');
  return <OnboardingHome key={hireId ?? 'list'} hireId={hireId} />;
}

function OnboardingHome({ hireId }: { hireId: string | null }) {
  const hiring = useHiring();
  const router = useRouter();
  // Start onboarding from Hiring Management opens the wizard already filled in from the accepted offer. The prefill is
  // read once: creating the employee uses up the offer, and the wizard must keep what it started with.
  const [prefill0] = useState(() => (hireId ? onboardingPrefill(getHiring(), hireId) : null));
  const [wizardPrefill, setWizardPrefill] = useState<OnboardingPrefill | null>(prefill0);
  const [showWizard, setShowWizard] = useState(!!prefill0);
  const [unavailable, setUnavailable] = useState(!!hireId && !prefill0);
  const [problem] = useState(() => (hireId && !prefill0 ? prefillProblem(getHiring(), hireId) : null));
  /** Which hand-started draft the wizard works on: a fresh one for "New onboarding", or the one picked to continue. */
  const [manualId, setManualId] = useState<string | null>(null);
  const startNew = () => {
    setManualId(`new:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);
    setShowWizard(true);
  };
  const continueDraft = (id: string) => {
    setManualId(id);
    setShowWizard(true);
  };
  const closeWizard = () => {
    setManualId(null);
    setShowWizard(false);
    setWizardPrefill(null);
    if (hireId) router.replace('/onboarding');
  };
  const { role: viewerRole } = useApp();
  const viewer = useCurrentEmployee();
  const [, setTick] = useState(0);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [removedNote, setRemovedNote] = useState('');
  const [reviewing, setReviewing] = useState<OnboardingRequest | null>(null);
  const waiting = hiringLevel(viewerRole) === 'full' ? hiring.offers.filter((o) => o.status === 'Accepted' && !o.employeeId) : [];
  const drafts = useDrafts(viewer.id, ['new', ...waiting.map((o) => o.id)]);
  const invites = useInvites();
  const [listQ, setListQ] = useState('');
  const [listStatus, setListStatus] = useState<'All' | (typeof ONBOARDING_REQUESTS)[number]['status']>('All');
  useEmployeeVersion();

  if (showWizard)
    return (
      <Wizard
        key={manualId ?? 'offer'}
        draftId={manualId ?? undefined}
        prefill={wizardPrefill ?? undefined}
        onClose={() => {
          setTick((n) => n + 1);
          closeWizard();
        }}
      />
    );

  const pipeline = ONBOARDING_REQUESTS;
  const awaiting = pipeline.filter((r) => r.status === 'Pending Approval').length;
  const soon = pipeline.filter((r) => {
    const d = daysBetween(REFERENCE_TODAY, r.startDate);
    return d >= 0 && d <= 30;
  }).length;
  const avgProgress = pipeline.length ? Math.round((pipeline.reduce((n, r) => n + r.step, 0) / pipeline.length / STEPS.length) * 100) : 0;
  // Onboardings that have been started but not finished: they move here from the accepted offers as soon as the wizard is opened.
  const draftRows = Object.entries(drafts)
    .filter(([id]) => isManualDraft(id) || waiting.some((o) => o.id === id))
    .map(([id, d]) => {
      const offer = hiring.offers.find((o) => o.id === id);
      const app = offer && hiring.applications.find((x) => x.id === offer.applicationId);
      const cand = app && hiring.candidates.find((c) => c.id === app.candidateId);
      const job = app && hiring.jobs.find((j) => j.id === app.jobId);
      return {
        id,
        name: d.name.trim() || cand?.name || 'New joiner',
        detail: job ? `${job.title} · ${job.department} · ${job.location}` : 'Started by hand · not yet linked to a hiring offer',
        joining: d.joining || offer?.joiningDate || '',
        step: d.step + 1,
        at: d.at,
        offerId: isManualDraft(id) ? null : id,
        formKey: isManualDraft(id) ? d.key : id,
      };
    })
    .sort((x, y) => y.at.localeCompare(x.at));
  const needle = listQ.trim().toLowerCase();
  const draftsShown = draftRows.filter((r) => (listStatus === 'All' || listStatus === 'In Progress') && (!needle || `${r.name} ${r.detail}`.toLowerCase().includes(needle)));
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
          <Button variant="primary" onClick={startNew}>
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

      {removedNote && (
        <div className="note-box" style={{ marginBottom: 14 }} role="status">
          <CheckIcon />
          <div style={{ flex: 1 }}>{removedNote}</div>
          <button type="button" className="icon-act" aria-label="Dismiss" onClick={() => setRemovedNote('')}>
            <XIcon />
          </button>
        </div>
      )}

      {unavailable && (
        <div className="note-box" style={{ marginBottom: 14 }}>
          <ShieldIcon />
          <div style={{ flex: 1 }}>{problem ?? 'That accepted offer is not available for onboarding. Open Hiring Management → Offers to check it.'}</div>
          <button type="button" className="icon-act" aria-label="Dismiss" onClick={() => setUnavailable(false)}>
            <XIcon />
          </button>
        </div>
      )}

      {waiting.filter((o) => !(o.id in drafts)).length > 0 && (
        <Card className="row-gap">
          <CardHeader title="Accepted offers" sub="From Hiring Management. Start onboarding with the candidate's details already filled in." />
          <div className="lc-list">
            {waiting.filter((o) => !(o.id in drafts)).map((o) => {
              const app = hiring.applications.find((a) => a.id === o.applicationId);
              const cand = hiring.candidates.find((c) => c.id === app?.candidateId);
              const job = hiring.jobs.find((j) => j.id === app?.jobId);
              return (
                <div key={o.id} className="doc">
                  <div className="lc-onb-row" style={{ flex: 1, minWidth: 0 }}>
                    <Avatar initials={initialsOf(cand?.name ?? '?')} seed={job?.department ?? ''} size={42} />
                    <div className="grow">
                      <div className="nm">{cand?.name}</div>
                      <div className="mt">
                        {job?.title} · {job?.department} · {job?.location} · {o.code}
                      </div>
                      <div className="mt" style={{ marginTop: 2 }}>
                        Joins {o.joiningDate}
                      </div>
                      <div className="jf-acts">
                        <JoiningFormActions offer={o} candidate={cand} job={job} onNotice={setRemovedNote} />
                      </div>
                    </div>
                    <Link href={`/onboarding?hire=${o.id}`} className="btn sm primary">
                      {inviteForOffer(invites, o.id)?.status === 'Submitted' ? 'Review and start onboarding' : 'Start onboarding'}
                    </Link>
                    <Button size="sm" variant="ghost" title="The candidate backed out after accepting" onClick={() => setWithdrawing(o.id)}>
                      Candidate backed out
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {reviewing && <ApprovalDrawer request={reviewing} onClose={() => setReviewing(null)} onDone={setRemovedNote} />}
      <WithdrawOfferDialog
        offerId={withdrawing}
        onClose={() => setWithdrawing(null)}
        onDone={(text) => {
          if (withdrawing) clearDraft(draftKey(viewer.id, withdrawing));
          setWithdrawing(null);
          setRemovedNote(text);
          setTick((n) => n + 1);
        }}
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
            {listed.length + draftsShown.length} of {pipeline.length + draftRows.length}
          </span>
        </div>

        {!listed.length && !draftsShown.length ? (
          <div>
            <EmptyState
              icon={<JoinIcon />}
              title={pipeline.length + draftRows.length ? 'No matching onboardings' : 'No onboardings in progress'}
              description={pipeline.length + draftRows.length ? 'Try a different search or filter.' : 'Start a new onboarding to capture a joiner’s record and provision their assets.'}
            />
            {!pipeline.length && !draftRows.length && (
              <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
                <Button variant="primary" onClick={startNew}>
                  New onboarding
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="lc-list">
            {draftsShown.map((r) => (
              <div key={`draft-${r.id}`} className="doc">
                <div className="lc-onb-row" style={{ flex: 1, minWidth: 0 }}>
                  <Avatar initials={initialsOf(r.name)} seed={r.name} size={42} />
                  <div className="grow">
                    <div className="nm">{r.name}</div>
                    <div className="mt">{r.detail}</div>
                    <div className="mt" style={{ marginTop: 2 }}>
                      {r.joining ? `Joins ${r.joining} · ` : ''}saved {new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at {clockTime(r.at)}
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
                  <span className="hm-chip on" style={{ background: '#fdf3df', color: '#B45309' }}>
                    Not submitted
                  </span>
                  {r.formKey && (r.offerId || inviteForOffer(invites, r.formKey)) && <FormChip invite={inviteForOffer(invites, r.formKey)} />}
                  {r.formKey && inviteForOffer(invites, r.formKey) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Copy the link of this joiner's joining form"
                      onClick={() => {
                        const inv = inviteForOffer(invites, r.formKey!);
                        if (!inv) return;
                        void navigator.clipboard?.writeText(formLink(inv.token));
                        setRemovedNote('Joining form link copied.');
                      }}
                    >
                      Copy form link
                    </Button>
                  )}
                  {r.offerId ? (
                    <Link href={`/onboarding?hire=${r.offerId}`} className="btn sm primary">
                      Continue
                    </Link>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => continueDraft(r.id)}>
                      Continue
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      clearDraft(draftKey(viewer.id, r.id));
                      setTick((n) => n + 1);
                    }}
                  >
                    Discard
                  </Button>
                  {r.offerId && (
                    <Button size="sm" variant="ghost" title="The candidate backed out after accepting" onClick={() => setWithdrawing(r.offerId)}>
                      Backed out
                    </Button>
                  )}
                </div>
              </div>
            ))}
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
                  {r.status === 'Pending Approval' &&
                    (canEditEmployees(viewerRole) ? (
                      <Button size="sm" variant="primary" title="Look over this joiner and approve the onboarding, or send it back" onClick={() => setReviewing(r)}>
                        Review &amp; approve
                      </Button>
                    ) : (
                      <span className="faint" style={{ fontSize: 12 }}>
                        Waiting for HR approval
                      </span>
                    ))}
                  {r.status === 'In Progress' && wasSentBack(r.id) && canEditEmployees(viewerRole) && (
                    <>
                      <span className="hm-chip" style={{ background: '#fdf3df', color: '#B45309' }}>
                        Sent back
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Put this onboarding in front of the approver again"
                        onClick={() => {
                          if (resubmitOnboarding(r.id, viewer.name)) setRemovedNote(`${r.candidateName} was sent for approval again.`);
                        }}
                      >
                        Send for approval again
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!!(listed.length + draftsShown.length) && (
          <div className="tfoot lc-foot">
            <span>
              Showing {listed.length + draftsShown.length} of {pipeline.length + draftRows.length} onboarding{pipeline.length + draftRows.length === 1 ? '' : 's'}
            </span>
            <span>Start a new onboarding to add another joiner</span>
          </div>
        )}
      </Card>
    </div>
  );
}

/** In the wizard: send the joiner their form to collect the rest of the details (personal, identity, bank with the
    account number typed twice, emergency contacts, education, experience), or see where that form stands. */
/** HR's decision on an onboarding that is waiting for approval: look over who is joining, then approve it or send it
    back with a note on what to fix. */
function ApprovalDrawer({ request, onClose, onDone }: { request: OnboardingRequest; onClose: () => void; onDone: (text: string) => void }) {
  const me = useCurrentEmployee();
  const emp = employeeOfRequest(request.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const chain = chainSteps('onboarding');
  const gate = chain.findIndex((c) => /approval/i.test(c));
  const rows: [string, string][] = [
    ['Employee code', emp?.employeeCode ?? '—'],
    ['Role', request.role],
    ['Position', `${request.designation} · ${request.department}`],
    ['Work location', request.location],
    ['Joining date', request.startDate],
    ['Work email', emp?.email ?? '—'],
    ['Wizard progress', `Step ${request.step} of ${STEPS.length}`],
  ];

  const approve = () => {
    if (decideOnboarding(request.id, 'approve', me.name, note)) onDone(`${request.candidateName} is approved. Payroll and HR have been told.`);
    onClose();
  };
  const sendBack = () => {
    if (!note.trim()) return setError('Say what needs to change, so the person who prepared it knows what to fix.');
    if (decideOnboarding(request.id, 'send-back', me.name, note)) onDone(`${request.candidateName} was sent back for changes.`);
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Review onboarding"
      description={`${request.candidateName} · ${request.designation}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={sendBack}>
            Send back
          </Button>
          <Button variant="primary" onClick={approve}>
            Approve
          </Button>
        </>
      }
    >
      <div className="subhd">Who is joining</div>
      <div className="ap-facts">
        {rows.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      {emp && (
        <div style={{ marginTop: 8 }}>
          <Link href={`/directory/${emp.employeeCode}`} className="btn sm ghost">
            Open the full employee record
          </Link>
        </div>
      )}

      <div className="subhd" style={{ marginTop: 18 }}>
        Approval chain
      </div>
      <ol className="hm-chain" style={{ padding: '4px 0 8px' }}>
        {chain.map((c, i) => {
          const state = i < gate ? 'approved' : i === gate ? 'pending' : '';
          return (
            <li key={c} className={state}>
              <span className="hm-chain-dot">{state === 'approved' ? <CheckIcon /> : null}</span>
              <div>
                <b>{c}</b>
                <small>{state === 'approved' ? 'Prepared' : state === 'pending' ? 'Waiting for your decision' : 'Not reached yet'}</small>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="fg full" style={{ marginTop: 6 }}>
        <label>Note {error ? '' : '(needed only when sending back)'}</label>
        <textarea
          rows={4}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setError('');
          }}
          placeholder="For example: the bank branch is missing, or the passport expiry looks wrong."
          style={TEXTAREA_STYLE}
        />
        {error && <span className="tx-err">{error}</span>}
      </div>
    </Drawer>
  );
}

function JoiningFormSend({ prefill }: { prefill: OnboardingPrefill }) {
  const s = useHiring();
  const invites = useInvites();
  const inv = inviteForOffer(invites, prefill.offerId);
  const [note, setNote] = useState('');
  const offer = s.offers.find((o) => o.id === prefill.offerId);
  const candidate = s.candidates.find((c) => c.id === prefill.candidateId);
  const job = s.jobs.find((j) => j.id === prefill.jobId);
  if (inv?.status === 'Submitted' || !offer || !candidate) return null;
  return (
    <div className="note-box" style={{ marginBottom: 14, alignItems: 'flex-start' }}>
      <JoinIcon />
      <div style={{ flex: 1 }}>
        <b>{inv ? 'Waiting for their joining form' : 'Collect the rest of their details'}</b>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
          {inv
            ? 'The form link is ready. When they submit it you can fill these steps from it. You can email it again or copy the link.'
            : 'Email the joiner a private form (or create the link and share it yourself) for their personal, identity, bank (account number typed twice to be sure), emergency, education and experience details. Then fill these steps from it instead of typing them.'}
        </div>
        <div className="jf-acts">
          <JoiningFormActions offer={offer} candidate={candidate} job={job} onNotice={setNote} />
        </div>
        {note && (
          <div role="status" style={{ marginTop: 8, fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

/** In the wizard: what HR collected and verified before the offer letter, so nobody asks for it again. */
function PreOfferNote({ prefill }: { prefill: OnboardingPrefill }) {
  if (!prefill.preDocs?.length && !prefill.referral) return null;
  return (
    <div className="note-box" style={{ marginBottom: 14, background: '#effaf3', borderColor: '#bfe8cf' }} role="status">
      <JoinIcon />
      <div style={{ flex: 1 }}>
        <b>Collected before the offer letter</b>
        {!!prefill.preDocs?.length && (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5 }}>
            {prefill.preDocs.map((d) => (
              <li key={d.label}>
                {d.label}: {d.files.join(', ')} {d.verified ? '✓ verified' : '(not verified)'}
              </li>
            ))}
          </ul>
        )}
        {prefill.referral && (
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            Background verification referral: {prefill.referral.name} · {prefill.referral.designation} · {prefill.referral.phone}
          </div>
        )}
      </div>
    </div>
  );
}

/** In the wizard: tells HR the details came from the joiner's own form, or offers to bring in a form submitted after
    this onboarding was started. */
function JoinedNote({ inviteKey, fromDraft, onImport }: { inviteKey: string; fromDraft: boolean; onImport: () => void }) {
  const invites = useInvites();
  const inv = inviteForOffer(invites, inviteKey);
  const [filled, setFilled] = useState(false);
  if (!inv || inv.status !== 'Submitted') return null;
  const when = inv.submittedAt ? new Date(inv.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  return (
    <div className="note-box" style={{ marginBottom: 14 }} role="status">
      <JoinIcon />
      <div style={{ flex: 1 }}>
        <b>{inv.name} filled in their joining form{when ? ` on ${when}` : ''}.</b>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {fromDraft ? 'This onboarding was started before they submitted. Bring their details in to fill the personal, identity, bank, emergency, education and experience steps.' : 'Those steps are already filled in from it. Check them, then complete the HR steps: role, assets, salary and approval.'}
        </div>
      </div>
      {fromDraft && (
        <Button
          size="sm"
          variant={filled ? 'ghost' : 'primary'}
          onClick={() => {
            onImport();
            setFilled(true);
          }}
        >
          {filled ? '✓ Filled in. Check each step' : 'Fill from their form'}
        </Button>
      )}
    </div>
  );
}

/** First, middle and last name from a full name: first word, last word, anything between. */
const splitName = (full: string) => {
  const w = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: w[0] ?? '', lastName: w.length > 1 ? w[w.length - 1] : '', middleName: w.length > 2 ? w.slice(1, -1).join(' ') : '' };
};

function Wizard({ onClose, prefill, draftId }: { onClose: () => void; prefill?: OnboardingPrefill; draftId?: string }) {
  const { location, role: myRole } = useApp();
  const orgNow = useOrg();
  const me = useCurrentEmployee();
  const dKey = draftKey(me.id, prefill?.offerId ?? draftId);
  const [draft] = useState(() => loadDraft(dKey));
  const [savedAt, setSavedAt] = useState<string | null>(draft?.savedAt ?? null);
  const [step, setStep] = useState(draft?.step ?? 0);
  const [office, setOffice] = useState<Location>(draft?.office ?? prefill?.location ?? location);
  const [created, setCreated] = useState<{ code: string; name: string; email: string; role: Role; country: string; assets: string } | null>(null);
  const done = created !== null;
  /** Steps the user has tried to leave (or submit) with problems; their errors are shown. */
  const [attempted, setAttempted] = useState<number[]>([]);

  const [fullName, setFullName] = useState(() => {
    if (draft) return draft.fullName;
    const p = prefill?.form?.fv;
    const joined = p?.firstName !== undefined ? [p.firstName, p.middleName, p.lastName].map((t) => (t ?? '').trim()).filter(Boolean).join(' ') : '';
    return joined || prefill?.name || '';
  });
  const [dob, setDob] = useState(draft?.dob ?? prefill?.form?.dob ?? '');
  const [joiningDate, setJoiningDate] = useState(draft?.joiningDate ?? prefill?.joiningDate ?? '');
  const [organizationId, setOrganizationId] = useState(draft?.organizationId ?? prefill?.companyId ?? '');
  const [departmentId, setDepartmentId] = useState(draft?.departmentId ?? prefill?.departmentId ?? '');
  const [designationId, setDesignationId] = useState(() => (draft ? draft.designationId : prefill ? (orgNow.designations.find((d) => d.departmentId === prefill.departmentId && d.title === prefill.designationTitle)?.id ?? '') : ''));
  const [managerId, setManagerId] = useState(draft?.managerId ?? prefill?.managerId ?? '');
  const [role, setRole] = useState<Role>(draft?.role ?? 'Employee');
  const [workEmail, setWorkEmail] = useState(draft?.workEmail ?? '');
  const [roleError, setRoleError] = useState('');
  const [visaStep, setVisaStep] = useState(draft?.visaStep ?? 0);
  const [assetFlags, setAssetFlags] = useState<Set<string>>(new Set(draft?.assetFlags ?? ['Laptop', 'Access card']));
  const [notifyDocs, setNotifyDocs] = useState(draft?.notifyDocs ?? true);
  const [expiries, setExpiries] = useState<Record<string, string>>(draft?.expiries ?? (prefill?.form?.passportExpiry ? { 'Passport Copy': prefill.form.passportExpiry } : {}));
  const [reminderDays, setReminderDays] = useState<Set<string>>(new Set(draft?.reminderDays ?? REMINDER_DAYS));
  const [reminderTo, setReminderTo] = useState<Set<string>>(new Set(draft?.reminderTo ?? ['Employee', 'HR']));

  /* every other field, keyed like the employee record (see FIELDS in lib/employeeStore) */
  const [fv, setFv] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = { maritalStatus: 'Single', employmentType: 'Permanent' };
    if (draft) return draft.fv;
    if (!prefill) return base;
    const fromForm = prefill.form?.fv ?? {};
    const def0 = orgNow.locationDef(prefill.location);
    // The candidate's number may carry the country code; keep only the digits the location's format takes.
    const raw = prefill.phone.replace(/\D/g, '');
    const code = (def0?.phoneCode ?? '').replace(/\D/g, '');
    const local = code && raw.startsWith(code) && raw.length > (def0?.phoneDigits ?? 0) ? raw.slice(code.length) : raw;
    return { ...base, employmentType: prefill.employmentType, personalEmail: prefill.personalEmail, personalMobile: local.slice(-(def0?.phoneDigits ?? local.length)), totalExperience: prefill.totalExperience, ...fromForm };
  });
  const f = (k: string) => fv[k] ?? '';
  const setF = (k: string, val: string) => setFv((p) => ({ ...p, [k]: val }));
  const [sal, setSal] = useState<Record<string, string>>(draft?.sal ?? prefill?.salary ?? {});
  const [emA, setEmA] = useState<EmergencyRow[]>(draft?.emA ?? (prefill?.form?.emA?.some((r) => r.name) ? prefill.form.emA : [blankContact()]));
  const [emB, setEmB] = useState<EmergencyRow[]>(draft?.emB ?? (prefill?.form?.emB?.some((r) => r.name) ? prefill.form.emB : [blankContact()]));
  const [exp, setExp] = useState<ExperienceRow[]>(draft?.exp ?? (prefill?.form?.exp?.length ? prefill.form.exp : [blankExperience()]));
  const [edu, setEdu] = useState<EducationRow[]>(draft?.edu ?? (prefill?.form?.edu?.some((r) => r.qualification || r.institution) ? prefill.form.edu : [blankEducation()]));
  const [fam, setFam] = useState<FamilyRow[]>(draft?.fam ?? (prefill?.form?.fam?.some((r) => r.name.trim()) ? prefill.form.fam : [blankFamily()]));
  /** Where the joining form is kept: the accepted offer's id, or a key of its own for an onboarding started by hand. */
  const [manualKey] = useState(() => draft?.inviteKey ?? `man-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  const inviteKey = prefill?.offerId ?? manualKey;

  /** Fill the form from what the joiner submitted (used when the draft was started before they sent it). */
  const importForm = () => {
    const form = inviteForOffer(getInvites(), inviteKey)?.data ?? prefill?.form;
    if (!form) return;
    setDob(form.dob);
    setFv((p) => ({ ...p, ...Object.fromEntries(Object.entries(form.fv).filter(([k]) => k !== 'accountNumberConfirm')) }));
    if (form.emA.some((r) => r.name)) setEmA(form.emA);
    if (form.emB.some((r) => r.name)) setEmB(form.emB);
    if (form.edu.some((r) => r.qualification || r.institution)) setEdu(form.edu);
    if (form.exp.length) setExp(form.exp);
    if (form.fam?.some((r) => r.name.trim())) setFam(form.fam);
    if (form.fv.firstName !== undefined) setFullName([form.fv.firstName, form.fv.middleName, form.fv.lastName].map((t) => (t ?? '').trim()).filter(Boolean).join(' '));
    if (form.passportExpiry) setExpiries((p) => ({ ...p, 'Passport Copy': form.passportExpiry }));
  };

  // Save the form a moment after each change. A form that is still empty is not worth keeping.
  const snapshot = JSON.stringify({ step, office, fullName, dob, joiningDate, organizationId, departmentId, designationId, managerId, role, workEmail, visaStep, assetFlags: [...assetFlags], notifyDocs, expiries, reminderDays: [...reminderDays], reminderTo: [...reminderTo], fv, sal, emA, emB, exp, edu, fam, inviteKey: prefill ? undefined : manualKey });

  useEffect(() => {
    if (done) {
      clearDraft(dKey);
      return;
    }
    const started = fullName.trim() !== '' || dob !== '' || workEmail.trim() !== '' || Object.entries(fv).some(([k, x]) => (x ?? '').trim() !== '' && !(k === 'maritalStatus' && x === 'Single') && !(k === 'employmentType' && x === 'Permanent'));
    if (!started) return;
    const t = setTimeout(() => {
      const at = new Date().toISOString();
      try {
        localStorage.setItem(dKey, JSON.stringify({ ...(JSON.parse(snapshot) as object), savedAt: at }));
        setSavedAt(at);
      } catch {
        /* storage full or unavailable: the form still works, it just is not kept */
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, done, dKey]);

  const { companies, departments, designations, locations, locationsLabel, locationDef } = useOrg();
  const def = locationDef(office) ?? locations[0];
  const isIndia = def.template === 'india';
  // India records also keep first, middle and last name. They start as a split of the full name and can be edited.
  const autoName = splitName(fullName);
  // The account holder starts as the employee's name and can be changed (a joint or differently spelled account).
  const holder = fv.accountName !== undefined ? fv.accountName : fullName;
  const pfYes = f('pfEnrolled') === 'Yes';
  const nm = (k: 'firstName' | 'middleName' | 'lastName') => (fv[k] !== undefined ? fv[k] : autoName[k]);
  // In India the three parts are what is typed; the full name is built from them.
  /** Name as per passport / Aadhaar / PAN: suggested from the name entered in step 1 until it is edited. */
  const idName = (k: 'passportName' | 'aadhaarName' | 'panName') => (fv[k] !== undefined ? fv[k] : fullName);
  const setPart = (k: 'firstName' | 'middleName' | 'lastName', x: string) => {
    const parts = { firstName: nm('firstName'), middleName: nm('middleName'), lastName: nm('lastName'), [k]: x };
    setFv((p) => ({ ...p, ...parts }));
    setFullName([parts.firstName, parts.middleName, parts.lastName].map((t) => t.trim()).filter(Boolean).join(' '));
  };
  const country = def.name;
  const steps = STEPS.map((s, i) => (i === 2 && isIndia ? 'Passport / Aadhaar / PAN' : s));
  const selectedCompany = companies.find((c) => c.id === organizationId);
  // Only companies that operate at this work location can be chosen (a Dubai-only company has no India departments).
  const operatesHere = (c: { location: string }) => c.location === 'Both' || c.location === office;
  const orgOptions = companies.filter((c) => operatesHere(c) || c.id === organizationId);
  const orgElsewhere = !!selectedCompany && !operatesHere(selectedCompany);
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
  const requiredList: string[] = isIndia ? REQUIRED_DOCS.india : REQUIRED_DOCS.uae;
  const twoSided = (d: string) => d === 'Aadhaar Card' || d === 'Passport Copy';
  // A certificate attached to an education entry also counts as the education certificate.
  const isUp = (d: string) => (d.includes('Educational Certificate') && edu.some((r) => (r.document ?? '').trim() !== '')) || (f(`docFile.${d}`).trim() !== '' && (!twoSided(d) || f(`docFile.${d} (Back)`).trim() !== ''));
  const reqUploaded = requiredList.filter(isUp).length;
  /** Documents that have their own upload in an earlier step: this step shows them, it does not ask again. */
  const dedicated: Record<string, { step: number; where: string }> = isIndia
    ? {
        'Passport Copy': { step: 2, where: 'Passport / Aadhaar / PAN' },
        'Aadhaar Card': { step: 2, where: 'Passport / Aadhaar / PAN' },
        'PAN Card': { step: 2, where: 'Passport / Aadhaar / PAN' },
        'Highest Educational Certificate': { step: 4, where: 'Experience & Education' },
      }
    : { 'Attested Educational Certificate': { step: 4, where: 'Experience & Education' } };
  const earlier = docList.filter((d) => dedicated[d] && !isUp(d));
  /** Every file uploaded anywhere in the wizard, with where it came from. */
  const uploaded: { key: string; label: string; file: string; from: string; remove: () => void }[] = [
    ...Object.entries(fv)
      .filter(([k, x]) => k.startsWith('docFile.') && (x ?? '').trim() !== '')
      .map(([k, x]) => {
        const name = k.slice('docFile.'.length);
        const label = name.endsWith(' (Back)') ? `${name.replace(' (Back)', '')}: back` : twoSided(name) ? `${name}: front` : name;
        return { key: k, label, file: x as string, from: '', remove: () => setF(k, '') };
      }),
    ...exp
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => (r.document ?? '').trim() !== '')
      .map(({ r, i }) => ({ key: `exp.${i}`, label: `Experience letter: ${r.company.trim() || `entry #${i + 1}`}`, file: r.document as string, from: 'Experience & Education', remove: () => setExp((p) => p.map((x, j) => (j === i ? { ...x, document: '' } : x))) })),
    ...edu
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => (r.document ?? '').trim() !== '')
      .map(({ r, i }) => ({ key: `edu.${i}`, label: `Education certificate: ${r.qualification.trim() || r.institution.trim() || `entry #${i + 1}`}`, file: r.document as string, from: 'Experience & Education', remove: () => setEdu((p) => p.map((x, j) => (j === i ? { ...x, document: '' } : x))) })),
  ];
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
  // Statutory figures, worked out by the rules for the work location (see lib/payroll.ts).
  const ind = isIndia
    ? indiaPayroll({ basic: amt('Basic'), hra: amt('House Rent Allowance'), fixed: amt('Fixed Allowance'), other: amt('Other Allowance'), pfOnFullWage: f('pfFullWage') === 'Yes' })
    : null;
  const uae = !isIndia ? uaePayroll({ basic: amt('Basic Salary'), total: totalEarn, national: f('nationality') === 'UAE' }) : null;
  const typedDed = dedLabels.reduce((n, l) => n + amt(l), 0);
  const totalDed = (ind ? ind.employeeStatutory : uae?.pensionEmployee ?? 0) + typedDed;
  const netPay = totalEarn - totalDed;
  const cur2 = (n: number) => `${isIndia ? '₹' : 'AED '}${n.toLocaleString(isIndia ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    setFv((p) => ({ maritalStatus: p.maritalStatus, employmentType: p.employmentType, gender: p.gender, bloodGroup: p.bloodGroup, nationality: p.nationality, nationalityOther: p.nationalityOther, personalEmail: p.personalEmail, currentAddress: p.currentAddress, permanentAddress: p.permanentAddress, extension: p.extension, passportNumber: p.passportNumber, totalExperience: p.totalExperience, bankName: p.bankName }));
    // An organization that does not operate at the new location cannot stay chosen.
    const keep = companies.find((c) => c.id === organizationId);
    if (keep && !(keep.location === 'Both' || keep.location === id)) {
      setOrganizationId('');
      setDepartmentId('');
      setDesignationId('');
    }
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
  if (isIndia) {
    if (!nm('firstName').trim()) add('firstName', 0, 'First name is required.');
    if (!nm('lastName').trim()) add('lastName', 0, 'Last name is required.');
  } else if (!fullName.trim()) add('name', 0, 'Full name is required.');
  if (!f('personalMobile')) add('personalMobile', 0, 'Personal mobile number is required.');
  else if (f('personalMobile').length !== def.phoneDigits) add('personalMobile', 0, digitsMsg);
  if (!f('personalEmail').trim()) add('personalEmail', 0, 'Personal email is required.');
  else if (!EMAIL_RE.test(f('personalEmail').trim())) add('personalEmail', 0, 'That doesn’t look like an email address.');
  if (!dob) add('dob', 0, 'Date of birth is required.');
  else if (dob > todayISO()) add('dob', 0, 'Date of birth cannot be in the future.');
  if (!f('nationality')) add('nationality', 0, 'Choose a nationality.');
  else if (f('nationality') === 'Other' && !f('nationalityOther').trim()) add('nationalityOther', 0, 'Enter the nationality.');

  if (!organizationId) add('organization', 1, 'Choose an organization.');
  else if (orgElsewhere && selectedCompany) add('organization', 1, `${selectedCompany.name} does not operate in ${country}. Choose another organization.`);
  if (!departmentId) add('department', 1, 'Choose a department.');
  if (!designationId) add('designation', 1, 'Choose a designation.');
  if (!managerId) add('manager', 1, 'Choose a reporting manager.');
  if (!f('employmentType')) add('employmentType', 1, 'Choose an employment type.');
  if (!joiningDate) add('joiningDate', 1, 'Joining date is required.');
  if (!signInEmail) add('workEmail', 1, 'Work email is required (enter one, or enter the full name to get a suggestion).');
  else if (!EMAIL_RE.test(signInEmail)) add('workEmail', 1, 'Enter a valid work email address.');
  else if (emailTaken) add('workEmail', 1, `${signInEmail} already belongs to another employee. Enter a different work email.`);
  if (f('phone') && f('phone').length !== def.phoneDigits) add('phone', 1, digitsMsg);

  if (!isIndia && !f('passportNumber').trim()) add('passportNumber', 2, 'Passport number is required.');
  if (isIndia) {
    if (!idName('aadhaarName').trim()) add('aadhaarName', 2, 'Name as per Aadhaar is required.');
    if (!idName('panName').trim()) add('panName', 2, 'Name as per PAN is required.');
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
  if (!holder.trim()) add('accountName', 6, 'Account holder name is required.');
  if (isIndia) {
    const a = indiaAccountError(f('accountNumber'));
    if (a) add('accountNumber', 6, a);
    if (!f('accountNumberConfirm').trim()) add('accountNumberConfirm', 6, 'Type the account number again to confirm it.');
    else if (f('accountNumberConfirm').replace(/\s/g, '') !== f('accountNumber').replace(/\s/g, '')) add('accountNumberConfirm', 6, 'The two account numbers do not match.');
    const c = ifscError(f('branchCode'));
    if (c) add('branchCode', 6, c);
    if (!f('branchName').trim()) add('branchName', 6, 'Branch name is required.');
    if (!f('pfEnrolled')) add('pfEnrolled', 6, 'Choose Yes or No.');
    if (pfYes) {
      if (!f('uan').trim()) add('uan', 6, 'UAN is required when already enrolled in PF.');
      else if (!/^\d{12}$/.test(f('uan').replace(/\s/g, ''))) add('uan', 6, 'UAN is 12 digits.');
      if (!f('uanMobile')) add('uanMobile', 6, 'Enter the mobile number linked to the UAN.');
      else if (f('uanMobile').length !== def.phoneDigits) add('uanMobile', 6, digitsMsg);
    }
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
      firstName: isIndia ? nm('firstName').trim() : '',
      middleName: isIndia ? nm('middleName').trim() : '',
      lastName: isIndia ? nm('lastName').trim() : '',
      dob,
      nationality: f('nationality') === 'Other' ? f('nationalityOther').trim() : f('nationality'),
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
      passportName: isIndia && (f('passportNumber').trim() || fv.passportName !== undefined) ? idName('passportName').trim() : '',
      aadhaarName: isIndia ? idName('aadhaarName').trim() : '',
      panName: isIndia ? idName('panName').trim() : '',
      passportExpiry: expiries['Passport Copy'] ?? '',
      emiratesId: isIndia ? '' : f('emiratesId'),
      visaExpiry: isIndia ? '' : (expiries['Residence Visa'] ?? ''),
      emiratesIdExpiry: isIndia ? '' : (expiries['Emirates ID'] ?? ''),
      labourCardIssue: isIndia ? '' : f('labourCardIssue'),
      labourCardExpiry: isIndia ? '' : (expiries['Labour Card'] ?? ''),
      aadhaar: isIndia ? f('aadhaar').replace(/\s/g, '') : '',
      pan: isIndia ? f('pan').trim().toUpperCase() : '',
      uan: isIndia && pfYes ? f('uan').replace(/\s/g, '') : '',
      pfEnrolled: isIndia ? f('pfEnrolled') : '',
      uanMobile: isIndia && pfYes ? phoneFmt(def, f('uanMobile')) : '',
      pfMemberId: isIndia && pfYes ? f('pfMemberId').trim().toUpperCase() : '',
      epsEligibility: isIndia && pfYes ? f('epsEligibility') : '',
      paymentMode: payMode,
      bankName: f('bankName').trim(),
      accountName: holder.trim(),
      accountNumber: isIndia ? f('accountNumber').replace(/\s/g, '') : f('accountNumber').replace(/\s/g, '').toUpperCase(),
      branchCode: isIndia ? f('branchCode').trim().toUpperCase() : f('branchCode').trim(),
      branchName: isIndia ? f('branchName').trim() : '',
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
      deductions: [
        ...(ind
          ? [
              { label: 'EPF Contribution', amount: String(ind.epfEmployee) },
              { label: 'ESI Contribution', amount: String(ind.esiEmployee) },
              { label: 'Professional Tax', amount: String(ind.professionalTax) },
            ].filter((r) => Number(r.amount) > 0)
          : []),
        ...(uae && uae.pensionEmployee > 0 ? [{ label: 'Pension (employee 11%)', amount: String(uae.pensionEmployee) }] : []),
        ...money(dedLabels),
      ],
      documents: dateRows,
      uploadedDocs: docList.filter(isUp),
      documentDetails: docList.filter((d) => DOC_TEXT[d] && f(`docText.${d}`).trim()).map((d) => ({ name: d, details: f(`docText.${d}`).trim() })),
      email: signInEmail,
      role,
      by: me.name,
      step: STEPS.length,
      hiredFrom: prefill ? { candidateId: prefill.candidateId, jobId: prefill.jobId, offerId: prefill.offerId } : undefined,
    });
    if (!hire) {
      setRoleError('The employee could not be created: the work email is already in use or the name is missing.');
      return;
    }
    // Hiring Management is told in the same step: candidate and employee linked, job filled count updated.
    if (prefill) {
      completeHire(prefill.offerId, { id: hire.id, code: hire.employeeCode, name: hire.name }, { id: me.id, name: me.name, role: myRole });
      if (prefill.form) markImported(prefill.offerId);
      const off = getHiring().offers.find((o) => o.id === prefill.offerId);
      // The welcome / pre-joining email for the Hired rule (logged in sandbox mode).
      if (off) sendRuleMail('Hired', off.applicationId, me.name, { includeAsk: true, offer: off });
    }
    if (!prefill) markImported(inviteKey);
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
        title={
          <>
            {fullName || 'New candidate'}
            <span className="wz-country">{country}</span>
          </>
        }
        description="A guided 10-step wizard capturing the full employee record. Creates the employee as Onboarding and sends the request through the approval chain."
      />

      {prefill && (
        <>
          <JoiningFormSend prefill={prefill} />
          <PreOfferNote prefill={prefill} />
          <JoinedNote inviteKey={prefill.offerId} fromDraft={!!draft} onImport={() => importForm()} />
        </>
      )}
      {!prefill && !done && (
        <>
          <ManualShareCard inviteKey={manualKey} name={fullName} personalEmail={f('personalEmail')} location={office} jobTitle={designations.find((d) => d.id === designationId)?.title ?? ''} joiningDate={joiningDate} />
          <JoinedNote inviteKey={manualKey} fromDraft onImport={() => importForm()} />
        </>
      )}

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
          {!done && prefill && (
            <div className="note-box" style={{ marginBottom: 14 }}>
              <ShieldIcon />
              <div>
                <b>Started from Hiring Management.</b> Filled in from offer {prefill.offerCode} for {prefill.name} ({prefill.jobCode} · {prefill.jobTitle}): name, contact, role, department, joining date, reporting manager and salary. Date of birth, identity, bank and the other personal details are not captured while hiring, so complete them as you go.
                {prefill.cvName && <> The candidate&apos;s CV ({prefill.cvName}) stays on their hiring profile.</>}
                {prefill.unmapped.length > 0 && <> {prefill.unmapped.map((u) => `${u.label} (${prefill.currency} ${u.amount.toLocaleString('en-US')})`).join(', ')} has no matching salary line here; add it if it applies.</>}
              </div>
            </div>
          )}

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
              {!isIndia && (
                <Fg label="Full Name (as per passport)" required error={shownErr('name')}>
                  <Input placeholder="e.g. Zayd Rahman" value={fullName} onChange={setFullName} />
                </Fg>
              )}
              {isIndia && (
                <>
                  <Fg label="First Name" required error={shownErr('firstName')}>
                    <Input value={nm('firstName')} onChange={(x) => setPart('firstName', x)} />
                  </Fg>
                  <Fg label="Middle Name">
                    <Input value={nm('middleName')} onChange={(x) => setPart('middleName', x)} />
                  </Fg>
                  <Fg label="Last Name" required error={shownErr('lastName')}>
                    <Input value={nm('lastName')} onChange={(x) => setPart('lastName', x)} />
                  </Fg>
                </>
              )}
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
                <Select options={NATIONALITIES} placeholder="Select nationality…" value={f('nationality')} onChange={(x) => setFv((p) => ({ ...p, nationality: x, nationalityOther: x === 'Other' ? (p.nationalityOther ?? '') : '' }))} />
              </Fg>
              {f('nationality') === 'Other' && (
                <Fg label="Specify nationality" required error={shownErr('nationalityOther')}>
                  <Input placeholder="e.g. Ethiopian" value={f('nationalityOther')} onChange={(x) => setF('nationalityOther', x)} />
                </Fg>
              )}
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
                  options={orgOptions.map((c) => ({ value: c.id, label: c.name, meta: !operatesHere(c) ? `Not in ${country}` : c.status === 'Inactive' ? `${c.shortCode} · Inactive` : c.shortCode }))}
                  value={organizationId}
                  onChange={(v) => {
                    setOrganizationId(v);
                    setDepartmentId('');
                    setDesignationId('');
                  }}
                  emptyText="No companies found"
                />
                {!companies.length && <span className="hint">No companies yet. Add one under Administration → Companies.</span>}
                {orgElsewhere && selectedCompany && <span className="hint" style={{ color: 'var(--danger)' }}>{selectedCompany.name} does not operate in {country}, so it has no departments here. Choose another organization.</span>}
                {!orgElsewhere && <span className="hint">Showing companies that operate in {country}.</span>}
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
              <div className="id-cols">
                <div className="id-col">
                  <div className="id-h">Passport</div>
                  <Fg label="Name as per Passport" error={shownErr('passportName')}>
                    <Input placeholder="Exactly as printed on the passport" value={idName('passportName')} onChange={(x) => setF('passportName', x)} />
                  </Fg>
                  <Fg label="Passport Number" error={shownErr('passportNumber')}>
                    <Input placeholder="e.g. K1234567 (if the employee has a passport)" value={f('passportNumber')} onChange={(x) => setF('passportNumber', x)} />
                  </Fg>
                  <Fg label="Passport Expiry Date">
                    <Input type="date" value={expiries['Passport Copy'] ?? ''} onChange={(v) => setExpiry('Passport Copy', v)} />
                  </Fg>
                  <Fg label="Passport Copy: Front page">
                    <UploadPick file={f('docFile.Passport Copy')} onFile={(n) => setF('docFile.Passport Copy', n)} />
                  </Fg>
                  <Fg label="Passport Copy: Back page">
                    <UploadPick file={f('docFile.Passport Copy (Back)')} onFile={(n) => setF('docFile.Passport Copy (Back)', n)} />
                    {(f('docFile.Passport Copy') !== '') !== (f('docFile.Passport Copy (Back)') !== '') && (
                      <span className="hint" style={{ color: '#b45309' }}>
                        Upload both sides of the passport.
                      </span>
                    )}
                  </Fg>
                </div>
                <div className="id-col">
                  <div className="id-h">Aadhaar</div>
                  <Fg label="Name as per Aadhaar" required error={shownErr('aadhaarName')}>
                    <Input placeholder="Exactly as printed on the Aadhaar card" value={idName('aadhaarName')} onChange={(x) => setF('aadhaarName', x)} />
                  </Fg>
                  <Fg label="Aadhaar Number" required error={shownErr('aadhaar')}>
                    <Input placeholder="12-digit Aadhaar" value={f('aadhaar')} onChange={(x) => setF('aadhaar', x)} />
                  </Fg>
                  <Fg label="Aadhaar Card: Front side">
                    <UploadPick file={f('docFile.Aadhaar Card')} onFile={(n) => setF('docFile.Aadhaar Card', n)} />
                  </Fg>
                  <Fg label="Aadhaar Card: Back side">
                    <UploadPick file={f('docFile.Aadhaar Card (Back)')} onFile={(n) => setF('docFile.Aadhaar Card (Back)', n)} />
                    {(f('docFile.Aadhaar Card') !== '') !== (f('docFile.Aadhaar Card (Back)') !== '') && (
                      <span className="hint" style={{ color: '#b45309' }}>
                        Upload both sides of the Aadhaar card.
                      </span>
                    )}
                  </Fg>
                </div>
                <div className="id-col id-pan">
                  <div className="id-h">PAN</div>
                  <Fg label="Name as per PAN" required error={shownErr('panName')}>
                    <Input placeholder="Exactly as printed on the PAN card" value={idName('panName')} onChange={(x) => setF('panName', x)} />
                  </Fg>
                  <Fg label="PAN Number" required error={shownErr('pan')}>
                    <Input placeholder="e.g. ABCDE1234F" value={f('pan')} onChange={(x) => setF('pan', x.toUpperCase())} />
                  </Fg>
                  <Fg label="PAN Card">
                    <UploadPick file={f('docFile.PAN Card')} onFile={(n) => setF('docFile.PAN Card', n)} />
                  </Fg>
                </div>
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
                  <Fg label="Experience / Relieving Letter">
                    <UploadPick file={r.document ?? ''} onFile={(n) => up({ document: n })} />
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
                  <Fg label="Education Certificate">
                    <UploadPick file={r.document ?? ''} onFile={(n) => up({ document: n })} />
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
                  <Fg label="Date of Birth">
                    <DateField value={r.dob ?? ''} max={todayISO()} onChange={(e) => up({ dob: e.target.value })} />
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
            <div className="form-grid">
              <Fg label="Payment Mode" required>
                <Select options={payModes} value={payMode} onChange={(x) => setF('paymentMode', x)} />
              </Fg>
              <Fg label="Bank Name" required error={shownErr('bankName')}>
                <Input value={f('bankName')} onChange={(x) => setF('bankName', x)} />
              </Fg>
              <Fg label="Account Holder Name" required error={shownErr('accountName')}>
                <Input value={holder} onChange={(x) => setF('accountName', x)} placeholder="As on the bank account" />
              </Fg>
              {isIndia ? (
                <>
                  <Fg label="Bank Account Number" required error={shownErr('accountNumber')}>
                    <Input value={f('accountNumber')} onChange={(x) => setF('accountNumber', x)} placeholder="9 to 18 digits" />
                  </Fg>
                  <Fg
                    label="Confirm Bank Account Number"
                    required
                    error={shownErr('accountNumberConfirm') ?? (f('accountNumberConfirm').trim() && f('accountNumberConfirm').replace(/\s/g, '') !== f('accountNumber').replace(/\s/g, '') ? 'The two account numbers do not match.' : undefined)}
                  >
                    <input
                      value={f('accountNumberConfirm')}
                      onChange={(e) => setF('accountNumberConfirm', e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      placeholder="Type the account number again"
                      autoComplete="off"
                    />
                    {f('accountNumberConfirm').trim() !== '' && f('accountNumberConfirm').replace(/\s/g, '') === f('accountNumber').replace(/\s/g, '') && <span className="hint">✓ Both entries match. Pasting is turned off, so type it again.</span>}
                  </Fg>
                  <Fg label="IFSC Code" required error={shownErr('branchCode')}>
                    <Input value={f('branchCode')} onChange={(x) => setF('branchCode', x.toUpperCase())} placeholder="e.g. HDFC0001234" />
                  </Fg>
                  <Fg label="Branch Name" required error={shownErr('branchName')}>
                    <Input value={f('branchName')} onChange={(x) => setF('branchName', x)} placeholder="e.g. Kakkanad, Kochi" />
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
                  <Fg label="Already enrolled in PF?" required error={shownErr('pfEnrolled')}>
                    <Select options={['Yes', 'No']} placeholder="Select…" value={f('pfEnrolled')} onChange={(x) => setF('pfEnrolled', x)} />
                  </Fg>
                  {pfYes && (
                    <>
                      <Fg label="UAN Number" required error={shownErr('uan')}>
                        <Input placeholder="12-digit UAN" value={f('uan')} onChange={(x) => setF('uan', x)} />
                      </Fg>
                      <Fg label="Registered mobile number linked to UAN" required error={shownErr('uanMobile')}>
                        <Phone def={def} value={f('uanMobile')} onChange={(x) => setF('uanMobile', x)} />
                      </Fg>
                      <Fg label="Previous PF Member ID (if available)">
                        <Input placeholder="e.g. KRKOC00123450000012345" value={f('pfMemberId')} onChange={(x) => setF('pfMemberId', x.toUpperCase())} />
                      </Fg>
                      <Fg label="EPS eligibility (if applicable)">
                        <Select options={['Eligible', 'Not eligible', 'Not sure']} placeholder="Select…" value={f('epsEligibility')} onChange={(x) => setF('epsEligibility', x)} />
                      </Fg>
                    </>
                  )}
                </div>
                {f('pfEnrolled') === 'No' && <div className="hint" style={{ marginTop: 8 }}>No existing PF account. Payroll will create a UAN for the employee after joining.</div>}
              </>
            )}
          </div>

          <div style={step === 7 ? undefined : { display: 'none' }}>
            <h3>Salary</h3>
            <p className="desc">Monthly salary structure. The statutory deductions and employer contributions are worked out for {country}.</p>
            {isIndia && ind ? (
              <>
                <div className="subhd">Earnings (monthly)</div>
                <div className="form-grid">
                  {INDIA_EARN.map((l, i) => (
                    <Fg key={l} label={l} required={i === 0} error={shownErr(`sal.${l}`)}>
                      <Input type="number" value={sal[l] ?? ''} onChange={(x) => setSal((p) => ({ ...p, [l]: x }))} />
                    </Fg>
                  ))}
                  <Fg label="Total Earnings (Gross)">
                    <Input readOnly value={cur2(totalEarn)} />
                  </Fg>
                </div>
                <div className="subhd" style={{ marginTop: 14 }}>
                  Deductions (monthly)
                </div>
                <div className="form-grid">
                  <Fg label="EPF Contribution (employee, 12%)">
                    <Input readOnly value={cur2(ind.epfEmployee)} />
                  </Fg>
                  <Fg label={ind.esiApplies ? 'ESI Contribution (employee, 0.75%)' : 'ESI Contribution (not applicable)'}>
                    <Input readOnly value={cur2(ind.esiEmployee)} />
                  </Fg>
                  <Fg label="Professional Tax (Kerala)">
                    <Input readOnly value={cur2(ind.professionalTax)} />
                  </Fg>
                  {INDIA_DED.map((l) => (
                    <Fg key={l} label={l} error={shownErr(`sal.${l}`)}>
                      <Input type="number" value={sal[l] ?? ''} onChange={(x) => setSal((p) => ({ ...p, [l]: x }))} />
                    </Fg>
                  ))}
                  <Fg label="Total Deductions">
                    <Input readOnly value={cur2(totalDed)} />
                  </Fg>
                </div>
                <label className="notify-check" style={{ margin: '12px 0 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={f('pfFullWage') === 'Yes'} onChange={(e) => setF('pfFullWage', e.target.checked ? 'Yes' : '')} className="chk" style={{ width: 15, height: 15 }} />
                  Contribute to PF on the full wage, above the {'₹'}{PF_WAGE_CEILING.toLocaleString('en-IN')} ceiling (voluntary higher contribution)
                </label>
                <div className="subhd" style={{ marginTop: 14 }}>
                  Take Home Salary
                </div>
                <div className="form-grid">
                  <Fg label="Take Home Salary Amount (Net Pay, before income tax)">
                    <Input readOnly value={cur2(netPay)} />
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
                      ['EPF Contribution', ind.epfEmployee, ind.epfEmployer],
                      ['EPS Contribution (pension)', 0, ind.eps],
                      ['ESI Contribution', ind.esiEmployee, ind.esiEmployer],
                      ['Employer EDLI Contribution', 0, ind.edli],
                      ['Employer EPF Admin Charges', 0, ind.admin],
                      ['Professional Tax', ind.professionalTax, 0],
                      ['Total Contribution', ind.employeeStatutory, ind.employerContributions],
                      ['Gratuity provision (not paid out monthly)', 0, ind.gratuity],
                    ].map((r, i) => (
                      <tr key={String(r[0])} style={i === 6 ? { fontWeight: 700, background: 'var(--bg)' } : undefined}>
                        <td>{r[0]}</td>
                        <td className="mono">{cur2(Number(r[1]))}</td>
                        <td className="mono">{cur2(Number(r[2]))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="note-box" style={{ marginTop: 12 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                  </svg>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                    <b>Monthly cost to company: {cur2(ind.monthlyCtc)}</b> ({cur2(ind.monthlyCtc * 12)} a year) = gross + employer contributions + gratuity provision.
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      <li>
                        <b>Wages</b> for PF, ESI and gratuity are the Basic, and never less than half of gross pay (Code on Wages): {cur2(ind.wages)} here.
                      </li>
                      <li>
                        <b>EPF</b> 12% of wages up to the {'₹'}{PF_WAGE_CEILING.toLocaleString('en-IN')} ceiling. The employer&apos;s 12% is split 8.33% to the pension scheme (EPS, at most {'₹'}1,250) and the rest to the provident fund. EDLI is 0.5%, and the EPFO admin charge 0.5%, of PF wages.
                      </li>
                      <li>
                        <b>ESI</b> applies only when gross is {'₹'}{ESI_WAGE_LIMIT.toLocaleString('en-IN')} a month or less: employee 0.75%, employer 3.25%. {ind.esiApplies ? 'It applies here.' : 'It does not apply here.'}
                      </li>
                      <li>
                        <b>Professional tax</b> follows the Kerala half-yearly slab (revised 1 October 2024), spread over six months. The local body (corporation, municipality or panchayat) sets the final amount.
                      </li>
                      <li>
                        <b>Income tax (TDS)</b> is not included: it depends on the employee&apos;s tax regime and declarations, so Payroll works it out each month.
                      </li>
                      <li>
                        <b>Gratuity</b> is 15/26 of a month&apos;s wages for each year of service, set aside here and payable after five years.
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              uae && (
                <>
                  <div className="subhd">Earnings ({country})</div>
                  <div className="form-grid">
                    {UAE_EARN.map((l, i) => (
                      <Fg key={l} label={l} required={i === 0} error={shownErr(`sal.${l}`)}>
                        <Input type="number" placeholder={def.currency} value={sal[l] ?? ''} onChange={(x) => setSal((p) => ({ ...p, [l]: x }))} />
                      </Fg>
                    ))}
                    <Fg label="Total Salary">
                      <Input readOnly value={cur2(totalEarn)} />
                    </Fg>
                  </div>
                  <div className="subhd" style={{ marginTop: 16 }}>
                    Statutory items and benefits (monthly)
                  </div>
                  <table style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Employee</th>
                        <th>Employer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Income tax</td>
                        <td className="mono">Nil</td>
                        <td className="mono">—</td>
                      </tr>
                      <tr>
                        <td>Pension (GPSSA){uae.pensionApplies ? '' : ': UAE nationals only'}</td>
                        <td className="mono">{uae.pensionApplies ? cur2(uae.pensionEmployee) : 'Not applicable'}</td>
                        <td className="mono">{uae.pensionApplies ? cur2(uae.pensionEmployer) : 'Not applicable'}</td>
                      </tr>
                      <tr>
                        <td>Unemployment insurance (ILOE)</td>
                        <td className="mono">{cur2(uae.iloe)}</td>
                        <td className="mono">—</td>
                      </tr>
                      <tr>
                        <td>End-of-service gratuity provision (years 1 to 5)</td>
                        <td className="mono">—</td>
                        <td className="mono">{cur2(uae.gratuityFirstFive)}</td>
                      </tr>
                      <tr>
                        <td>End-of-service gratuity provision (from year 6)</td>
                        <td className="mono">—</td>
                        <td className="mono">{cur2(uae.gratuityAfterFive)}</td>
                      </tr>
                      <tr style={{ fontWeight: 700, background: 'var(--bg)' }}>
                        <td>Net monthly pay (WPS)</td>
                        <td className="mono" colSpan={2}>
                          {cur2(uae.netPay)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="note-box" style={{ marginTop: 12 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                    </svg>
                    <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                      The net pay flows into the WPS payroll file.
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        <li>
                          <b>Income tax:</b> the UAE has no personal income tax, and expatriates have no social-security deduction.
                        </li>
                        <li>
                          <b>Pension (GPSSA)</b> is for UAE nationals only: the employee pays 11% of the contribution salary (up to AED 70,000) and the employer 15%, of which the government covers 2.5% when the salary is under AED 20,000. Rates for Emiratis who joined before 31 October 2023, and for Abu Dhabi (ADPF) members, differ.
                        </li>
                        <li>
                          <b>Unemployment insurance (ILOE)</b> is AED 5 a month if Basic is AED 16,000 or less, otherwise AED 10. It is paid by the employee (monthly, quarterly, half-yearly or yearly), so it is not taken off the net pay here.
                        </li>
                        <li>
                          <b>End-of-service gratuity</b> (Federal Decree-Law 33 of 2021) is 21 days&apos; Basic for each of the first five years and 30 days for each year after, after at least one year of service. It is the employer&apos;s liability, set aside here and paid on exit.
                        </li>
                      </ul>
                    </div>
                  </div>
                </>
              )
            )}
          </div>

          <div style={step === 8 ? undefined : { display: 'none' }}>
            <h3>Documents</h3>
            <p className="desc">Upload the required documents for the selected location. Documents that expire need an expiry date so reminders can be sent.</p>
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
            <div className="ds-sum">
              <div>
                <b>{reqUploaded}</b> of {requiredList.length} required documents uploaded
                <small>{isIndia ? 'Passport is optional for India. Aadhaar needs both sides.' : 'Passport needs both pages.'}</small>
              </div>
              <div className="ds-bar" role="progressbar" aria-valuenow={Math.round((reqUploaded / Math.max(1, requiredList.length)) * 100)} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${Math.round((reqUploaded / Math.max(1, requiredList.length)) * 100)}%` }} />
              </div>
            </div>
            <div className="subhd">Uploaded documents ({uploaded.length})</div>
            {uploaded.length ? (
              <ul className="ds-list">
                {uploaded.map((u) => (
                  <li key={u.key}>
                    <span className="ds-ok">✓</span>
                    <span className="ds-ln">
                      <b>{u.label}</b>
                      <small>
                        {u.file}
                        {u.from ? ` · added in ${u.from}` : ''}
                      </small>
                    </span>
                    <button type="button" className="rep-del" onClick={u.remove} aria-label={`Remove ${u.label}`}>
                      <XIcon /> Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ds-none">Nothing is uploaded yet. Documents added in the earlier steps (identity, experience, education) appear here too.</div>
            )}
            {earlier.length > 0 && (
              <>
                <div className="subhd" style={{ marginTop: 16 }}>
                  Still to add (these have their own step)
                </div>
                <ul className="ds-list ds-earlier">
                  {earlier.map((d) => {
                    const up = isUp(d);
                    const optional = !requiredList.includes(d);
                    return (
                      <li key={d} className={up ? '' : 'pend'}>
                        <span className={up ? 'ds-ok' : 'ds-wait'}>{up ? '✓' : '–'}</span>
                        <span className="ds-ln">
                          <b>{d}</b>
                          <small>{up ? `Uploaded in step ${dedicated[d].step + 1}, ${dedicated[d].where}` : `${optional ? 'Optional. ' : ''}Add it in step ${dedicated[d].step + 1}, ${dedicated[d].where}`}</small>
                        </span>
                        {!up && (
                          <button type="button" className="rep-del ds-go" onClick={() => setStep(dedicated[d].step)}>
                            Go to step {dedicated[d].step + 1}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <div className="subhd" style={{ marginTop: 16 }}>
              Upload documents
            </div>
            <div className="ds-grid">
              {docList.filter((d) => !dedicated[d]).flatMap((d) => [
                <UploadBox
                  key={d}
                  label={d === 'Aadhaar Card' ? 'Aadhaar Card: Front side' : d === 'Passport Copy' ? 'Passport Copy: Front page' : d}
                  tag={requiredList.includes(d) ? 'Required' : 'Optional'}
                  file={f(`docFile.${d}`)}
                  onFile={(n) => setF(`docFile.${d}`, n)}
                  expiry={EXPIRING_DOCS.includes(d) ? { value: expiries[d] ?? '', onChange: (v) => setExpiry(d, v) } : undefined}
                  details={DOC_TEXT[d] ? { value: f(`docText.${d}`), onChange: (v) => setF(`docText.${d}`, v), label: DOC_TEXT[d].label, placeholder: DOC_TEXT[d].placeholder } : undefined}
                />,
                ...(d === 'Aadhaar Card' ? [<UploadBox key="Aadhaar Card (Back)" tag="Required" label="Aadhaar Card: Back side" file={f('docFile.Aadhaar Card (Back)')} onFile={(n) => setF('docFile.Aadhaar Card (Back)', n)} />] : []),
                ...(d === 'Passport Copy' ? [<UploadBox key="Passport Copy (Back)" tag={requiredList.includes('Passport Copy') ? 'Required' : 'Optional'} label="Passport Copy: Back page" file={f('docFile.Passport Copy (Back)')} onFile={(n) => setF('docFile.Passport Copy (Back)', n)} />] : []),
              ])}
            </div>
            {!isIndia && (
              <>
                <div className="subhd" style={{ marginTop: 14 }}>
                  UAE Sales Team only
                </div>
                <div className="form-grid">
                  {['Self Approval Document Signed', 'Target Incentive Agreement'].map((d) => (
                    <UploadBox key={d} tag="Optional" label={d} file={f(`docFile.${d}`)} onFile={(n) => setF(`docFile.${d}`, n)} />
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
              {prefill && (
                <p style={{ marginTop: 8, color: 'var(--muted)', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                  The candidate record is now linked to this employee and {prefill.jobCode} ({prefill.jobTitle}) was updated.{' '}
                  <Link href={`/hiring/candidates/${prefill.candidateId}`} className="lnk">
                    Open candidate
                  </Link>
                </p>
              )}
              <Button variant="primary" style={{ marginTop: 18 }} onClick={onClose}>
                Back to onboarding list
              </Button>
            </div>
          )}
        </div>

        {!done && (
          <div className="wizfoot">
            <div className="autosave">
              <span className="dot" /> {savedAt ? `Draft saved at ${clockTime(savedAt)}` : 'Saved automatically as you type'}
              {roleError && <span style={{ marginLeft: 14, color: '#B91C1C', fontWeight: 600 }}>{roleError}</span>}
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {savedAt && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearDraft(dKey);
                    onClose();
                  }}
                >
                  Discard draft
                </Button>
              )}
              {step === 0 && (
                <Button variant="ghost" onClick={onClose}>
                  {savedAt ? 'Save and close' : 'Cancel'}
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
