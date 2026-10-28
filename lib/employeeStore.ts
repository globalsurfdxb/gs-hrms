import { useSyncExternalStore } from 'react';
import { pushNotice } from '@/lib/notifications';
import { AUDIT_LOG, EMPLOYEES, ONBOARDING_REQUESTS, REFERENCE_TODAY, employeeById, nextEmployeeCode } from '@/lib/data';
import { AuditEntry, BankDetails, Employee, EmployeeDocument, ExpiryState, OnboardingRequest, Role } from '@/lib/types';

/* Editable employee records. The directory data is a module-level array, so an edit changes the record in
   place, writes audit entries, saves to localStorage so it survives a reload, and bumps a version that pages
   subscribe to (useEmployeeVersion). A backend will replace the storage; the form shape stays the same. */

type Where = 'e' | 'profile' | 'bank';
interface FieldDef {
  key: string;
  label: string;
  where: Where;
  /** Blank means "not on file" (the property is removed) rather than an empty string. */
  optional?: boolean;
}
const fd = (key: string, label: string, where: Where = 'e', optional = false): FieldDef => ({ key, label, where, optional });

export const FIELDS: FieldDef[] = [
  fd('name', 'Full name'),
  fd('firstName', 'First name', 'profile', true),
  fd('middleName', 'Middle name', 'profile', true),
  fd('lastName', 'Last name', 'profile', true),
  fd('dob', 'Date of birth'),
  fd('nationality', 'Nationality'),
  fd('gender', 'Gender', 'profile'),
  fd('maritalStatus', 'Marital status', 'profile'),
  fd('bloodGroup', 'Blood group', 'profile'),
  fd('personalMobile', 'Personal mobile', 'profile'),
  fd('personalEmail', 'Personal email', 'profile'),
  fd('currentAddress', 'Current address', 'profile'),
  fd('permanentAddress', 'Permanent address', 'profile'),
  fd('company', 'Organization'),
  fd('department', 'Department'),
  fd('designation', 'Designation'),
  fd('reportingManagerId', 'Reporting manager'),
  fd('employmentType', 'Employment type'),
  fd('dateOfJoining', 'Joining date'),
  fd('probationEnd', 'Probation completion', 'profile'),
  fd('location', 'Work location'),
  fd('seatingLocation', 'Seating location'),
  fd('phone', 'Work phone'),
  fd('extension', 'Extension', 'profile'),
  fd('passportNumber', 'Passport number', 'profile'),
  fd('passportExpiry', 'Passport expiry', 'profile'),
  fd('emiratesId', 'Emirates ID number', 'e', true),
  fd('visaExpiry', 'Visa expiry', 'e', true),
  fd('emiratesIdExpiry', 'Emirates ID expiry', 'profile', true),
  fd('labourCardIssue', 'Labour card issue date', 'profile', true),
  fd('labourCardExpiry', 'Labour card expiry date', 'profile', true),
  fd('passportName', 'Name as per passport', 'profile', true),
  fd('aadhaarName', 'Name as per Aadhaar', 'profile', true),
  fd('aadhaar', 'Aadhaar number', 'profile', true),
  fd('panName', 'Name as per PAN', 'profile', true),
  fd('pan', 'PAN number', 'profile', true),
  fd('uan', 'UAN', 'profile', true),
  fd('pfEnrolled', 'Already enrolled in PF', 'profile', true),
  fd('uanMobile', 'Mobile number linked to UAN', 'profile', true),
  fd('pfMemberId', 'Previous PF member ID', 'profile', true),
  fd('epsEligibility', 'EPS eligibility', 'profile', true),
  fd('paymentMode', 'Payment mode', 'profile'),
  fd('bankName', 'Bank name', 'bank'),
  fd('accountName', 'Account holder name', 'bank'),
  fd('accountNumber', 'Account / IBAN number', 'bank'),
  fd('branchCode', 'IFSC / routing code', 'bank'),
  fd('branchName', 'Branch name', 'bank', true),
  fd('currency', 'Currency', 'bank'),
  fd('totalExperience', 'Total experience', 'profile'),
];

export interface EmergencyRow { group: string; name: string; relationship: string; mobile: string }
export interface ExperienceRow { company: string; location: string; from: string; to: string; title: string; mode: string; document?: string }
export interface EducationRow { qualification: string; institution: string; course: string; field: string; startYear: string; endYear: string; document?: string }
export interface FamilyRow { name: string; relationship: string; occupation: string; dob?: string }
export interface MoneyRow { label: string; amount: string }
export interface DocRow { id: string; type: string; expiryDate: string }

/** Everything the edit page can change, as plain strings so it can sit in form inputs. */
export interface EmployeeForm {
  v: Record<string, string>;
  emergency: EmergencyRow[];
  experience: ExperienceRow[];
  education: EducationRow[];
  family: FamilyRow[];
  earnings: MoneyRow[];
  deductions: MoneyRow[];
  documents: DocRow[];
  uploadedDocs: string[];
}

const def = (k: string) => FIELDS.find((f) => f.key === k)!;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export const expiryState = (date?: string): ExpiryState => {
  if (!date) return 'na';
  const [y, m, d] = date.split('-').map(Number);
  const [ty, tm, td] = REFERENCE_TODAY.split('-').map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  return n < 0 ? 'expired' : n <= 90 ? 'soon' : 'ok';
};

const holder = (e: Employee, w: Where) => (w === 'e' ? e : w === 'profile' ? e.profile : e.bankDetails) as unknown as Record<string, unknown>;
const read = (e: Employee, k: string): string => String(holder(e, def(k).where)[k] ?? '');

const write = (e: Employee, k: string, v: string) => {
  const f = def(k);
  const src = holder(e, f.where);
  if (k === 'reportingManagerId') e.reportingManagerId = v || null;
  else if (f.optional && v === '') delete src[k];
  else src[k] = v;
  if (k === 'name') {
    const w = v.trim().split(/\s+/);
    e.avatarInitials = (w.length === 1 ? w[0].slice(0, 2) : w.map((x) => x[0]).slice(0, 2).join('')).toUpperCase();
  }
};

/** The employee as an editable form. */
export function toForm(e: Employee): EmployeeForm {
  const p = e.profile;
  const v: Record<string, string> = {};
  FIELDS.forEach((f) => (v[f.key] = read(e, f.key)));
  return {
    v,
    emergency: clone(p.emergency),
    experience: clone(p.experience),
    education: clone(p.education),
    family: clone(p.family),
    earnings: p.salary.earnings.map((x) => ({ label: x.label, amount: String(x.amount) })),
    deductions: p.salary.deductions.map((x) => ({ label: x.label, amount: String(x.amount) })),
    documents: e.documents.map((d) => ({ id: d.id, type: d.type, expiryDate: d.expiryDate ?? '' })),
    uploadedDocs: [...p.uploadedDocs],
  };
}

const num = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);
/** Rows the user added but left completely empty don't count. */
export const filled = <T extends object>(rows: T[], ignore: string[] = []) => rows.filter((r) => Object.entries(r).some(([k, x]) => !ignore.includes(k) && String(x).trim() !== ''));
/** An emergency contact whose only content is the pre-filled group is still an empty row. */
export const filledContacts = (rows: EmergencyRow[]) => filled(rows, ['group']);

/** Write a form back onto the employee record. */
function applyForm(e: Employee, f: EmployeeForm) {
  FIELDS.forEach((d) => {
    if (f.v[d.key] !== undefined) write(e, d.key, f.v[d.key].trim());
  });
  const p = e.profile;
  p.emergency = filledContacts(f.emergency).map((x) => ({ ...x }));
  p.experience = filled(f.experience).map((x) => ({ ...x }));
  p.education = filled(f.education).map((x) => ({ ...x }));
  p.family = filled(f.family).map((x) => ({ ...x }));
  const earn = filled(f.earnings).map((x) => ({ label: x.label.trim(), amount: num(x.amount) }));
  const ded = filled(f.deductions).map((x) => ({ label: x.label.trim(), amount: num(x.amount) }));
  const total = earn.reduce((n, x) => n + x.amount, 0);
  p.salary = { ...p.salary, currency: f.v.currency || p.salary.currency, earnings: earn, deductions: ded, total, net: total - ded.reduce((n, x) => n + x.amount, 0) };
  p.uploadedDocs = [...f.uploadedDocs];

  // Dated documents; the passport, residence visa and Emirates ID dates come from the identity fields.
  const link: Record<string, string | undefined> = { Passport: p.passportExpiry, 'Residence Visa': e.visaExpiry, 'Emirates ID': p.emiratesIdExpiry };
  e.documents = filled(f.documents).map((d) => {
    const old = e.documents.find((x) => x.id === d.id);
    const expiryDate = link[d.type] || d.expiryDate || undefined;
    const doc: EmployeeDocument = { id: d.id, type: d.type.trim(), expiryDate, state: expiryState(expiryDate), ...(old?.fileName ? { fileName: old.fileName } : {}) };
    return doc;
  });
  e.visaState = e.visaExpiry ? expiryState(e.visaExpiry) : undefined;
}

/** Only these roles may edit employee records. Everyone else can raise a change request instead. */
export const canEditEmployees = (role: Role) => role === 'Super Admin' || role === 'HR' || role === 'Office Admin';
/** Bank and salary are restricted to HR and Super Admin. */
export const canEditSensitive = (role: Role) => role === 'Super Admin' || role === 'HR';

export interface EmployeeChange {
  key: string;
  label: string;
  from: string;
  to: string;
}

const shown = (k: string, v: string) => (k === 'reportingManagerId' ? (v ? (employeeById(v)?.name ?? v) : '—') : v || '—');
const money = (rows: MoneyRow[]) => filled(rows).reduce((n, x) => n + num(x.amount), 0).toLocaleString('en-US');
const names = (rows: { name: string }[]) => {
  const l = filled(rows, ['group']).map((r) => r.name).filter(Boolean);
  return l.length ? `${l.length}: ${l.join(', ')}` : 'none';
};

/** What differs between the saved record and a form, ready for the review list and the audit log. */
export function diffForm(e: Employee, f: EmployeeForm): EmployeeChange[] {
  const cur = toForm(e);
  const out: EmployeeChange[] = [];
  FIELDS.forEach((d) => {
    const a = (cur.v[d.key] ?? '').trim();
    const b = (f.v[d.key] ?? '').trim();
    if (a !== b) out.push({ key: d.key, label: d.label, from: shown(d.key, a), to: shown(d.key, b) });
  });
  const same = (a: object[], b: object[]) => JSON.stringify(filled(a, ['group'])) === JSON.stringify(filled(b, ['group']));
  const count = (rows: object[]) => filled(rows).length;
  if (!same(cur.emergency, f.emergency)) out.push({ key: 'emergency', label: 'Emergency contacts', from: names(cur.emergency), to: names(f.emergency) });
  if (!same(cur.experience, f.experience)) out.push({ key: 'experience', label: 'Work experience', from: `${count(cur.experience)} entries`, to: `${count(f.experience)} entries` });
  if (!same(cur.education, f.education)) out.push({ key: 'education', label: 'Education', from: `${count(cur.education)} entries`, to: `${count(f.education)} entries` });
  if (!same(cur.family, f.family)) out.push({ key: 'family', label: 'Family members', from: names(cur.family), to: names(f.family) });
  if (!same(cur.earnings, f.earnings)) out.push({ key: 'earnings', label: 'Salary earnings', from: `${count(cur.earnings)} items · total ${money(cur.earnings)}`, to: `${count(f.earnings)} items · total ${money(f.earnings)}` });
  if (!same(cur.deductions, f.deductions)) out.push({ key: 'deductions', label: 'Salary deductions', from: `${count(cur.deductions)} items · total ${money(cur.deductions)}`, to: `${count(f.deductions)} items · total ${money(f.deductions)}` });
  if (!same(cur.documents, f.documents)) out.push({ key: 'documents', label: 'Dated documents', from: `${count(cur.documents)} documents`, to: `${count(f.documents)} documents` });
  if (JSON.stringify([...cur.uploadedDocs].sort()) !== JSON.stringify([...f.uploadedDocs].sort())) out.push({ key: 'uploadedDocs', label: 'Required documents uploaded', from: `${cur.uploadedDocs.length}`, to: `${f.uploadedDocs.length}` });
  return out;
}

/* ---------- persistence + subscription ---------- */
const KEY = 'gsit.employeeEdits.v2';
interface Saved {
  edits: Record<string, EmployeeForm>;
  audit: AuditEntry[];
}
let saved: Saved = { edits: {}, audit: [] };
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};

/* People created through the onboarding wizard. They are kept whole (record, onboarding request and the system role
   chosen for their account) so they come back after a reload. */
interface Hire {
  employee: Employee;
  request: OnboardingRequest;
  role: Role;
}
const HIRES_KEY = 'gsit.newHires.v1';
let hires: Hire[] = [];
const hireRoles: Record<string, Role> = {};

/** The system role chosen for a person created through onboarding, if any. */
export const chosenRole = (employeeId: string): Role | undefined => hireRoles[employeeId];

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
    localStorage.setItem(HIRES_KEY, JSON.stringify(hires));
  } catch {
    /* storage unavailable — the edit still applies for this visit */
  }
}

function hydrateHires() {
  try {
    const raw = localStorage.getItem(HIRES_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as Hire[];
    list.forEach((h) => {
      if (!EMPLOYEES.some((x) => x.id === h.employee.id)) EMPLOYEES.push(h.employee);
      if (!ONBOARDING_REQUESTS.some((x) => x.id === h.request.id)) ONBOARDING_REQUESTS.push(h.request);
      hireRoles[h.employee.id] = h.role;
    });
    hires = list;
    version += 1;
  } catch {
    /* ignore a corrupt save */
  }
}

/* HR's decision on each onboarding request that was waiting for approval, kept so it survives a reload. */
const DECISIONS_KEY = 'gsit.onboardingDecisions.v1';
let decisions: Record<string, OnboardingRequest['status']> = {};

function hydrateDecisions() {
  try {
    const raw = localStorage.getItem(DECISIONS_KEY);
    if (!raw) return;
    decisions = JSON.parse(raw) as typeof decisions;
    ONBOARDING_REQUESTS.forEach((r) => {
      if (decisions[r.id]) r.status = decisions[r.id];
    });
  } catch {
    /* ignore a corrupt save */
  }
}

function hydrate() {
  hydrateHires();
  hydrateDecisions();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as Saved;
    Object.entries(s.edits ?? {}).forEach(([id, form]) => {
      const e = employeeById(id);
      if (e) applyForm(e, form);
    });
    (s.audit ?? []).slice().reverse().forEach((a) => {
      if (!AUDIT_LOG.some((x) => x.id === a.id)) AUDIT_LOG.unshift(a);
    });
    saved = { edits: s.edits ?? {}, audit: s.audit ?? [] };
    version += 1;
  } catch {
    /* ignore a corrupt save */
  }
}
if (typeof window !== 'undefined') hydrate();

const BANK_KEYS = ['bankName', 'accountName', 'accountNumber', 'branchCode', 'currency'];
const SALARY_KEYS = ['earnings', 'deductions', 'paymentMode'];
const DOC_KEYS = ['documents', 'uploadedDocs', 'passportNumber', 'passportExpiry', 'emiratesId', 'emiratesIdExpiry', 'visaExpiry', 'labourCardIssue', 'labourCardExpiry'];
/** Which module an employee-field edit belongs to, for the audit filter. */
const auditModuleFor = (key: string) => (BANK_KEYS.includes(key) ? 'Bank' : SALARY_KEYS.includes(key) ? 'Salary' : DOC_KEYS.includes(key) ? 'Documents' : 'Employee');

/** The module an audit entry belongs to; entries written before modules existed are derived from the field name. */
export function auditModuleOf(a: AuditEntry): string {
  if (a.module) return a.module;
  const f = a.field.toLowerCase();
  if (/bank|account|iban|ifsc|routing/.test(f)) return 'Bank';
  if (/salary|earning|deduction|payment mode/.test(f)) return 'Salary';
  if (/visa|passport|emirates|labour|document/.test(f)) return 'Documents';
  return 'Employee';
}

/** Apply a form to an employee: update the record, log each change and save. Returns what changed. */
export function saveEmployee(id: string, form: EmployeeForm, by: string): EmployeeChange[] {
  const e = EMPLOYEES.find((x) => x.id === id);
  if (!e) return [];
  const changes = diffForm(e, form);
  if (!changes.length) return [];
  applyForm(e, form);
  const stamp = Date.now();
  changes.forEach((c, i) => {
    const entry: AuditEntry = { id: `ed-${stamp}-${i}`, employeeId: id, field: c.label, from: c.from, to: c.to, changedBy: by, changedOn: REFERENCE_TODAY, at: new Date().toISOString(), module: auditModuleFor(c.key) };
    AUDIT_LOG.unshift(entry);
    saved.audit.unshift(entry);
  });
  saved.edits[id] = clone(toForm(e));
  e.updatedAt = REFERENCE_TODAY;
  persist();
  notify();
  return changes;
}

export interface AuditInput {
  /** Employee the event concerns, or a pseudo id such as 'role:HR', 'request:lv-1', 'expense:exp-3'. */
  employeeId: string;
  /** What happened, e.g. 'Permission granted', 'Leave request', 'Expense claim'. */
  field: string;
  from?: string;
  to: string;
  changedBy: string;
  /** Area of the app: 'Access', 'Approvals', 'Leave', 'Expense', 'Employee', ... */
  module: string;
}

/** Record an event that is not an employee-field edit (access changes, approvals). Saved and shown in the audit log. */
export function logAudit(entry: AuditInput): AuditEntry {
  const stamp = Date.now();
  const full: AuditEntry = {
    id: `ev-${stamp}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: entry.employeeId,
    field: entry.field,
    from: entry.from ?? '—',
    to: entry.to,
    changedBy: entry.changedBy,
    changedOn: REFERENCE_TODAY, at: new Date().toISOString(),
    module: entry.module,
  };
  AUDIT_LOG.unshift(full);
  saved.audit.unshift(full);
  persist();
  notify();
  return full;
}

/** What the onboarding wizard hands over to create a person. `v` is keyed like FIELDS; the lists are optional. */
export interface NewEmployeeInput {
  v: Record<string, string>;
  emergency?: EmergencyRow[];
  experience?: ExperienceRow[];
  education?: EducationRow[];
  family?: FamilyRow[];
  earnings?: MoneyRow[];
  deductions?: MoneyRow[];
  documents?: DocRow[];
  uploadedDocs?: string[];
  /** Text entered next to a document (passport, Aadhaar, education certificate). */
  documentDetails?: { name: string; details: string }[];
  /** Work email the person signs in with. */
  email: string;
  /** System role the account carries. */
  role: Role;
  /** Who raised the onboarding. */
  by: string;
  /** Wizard step the request reached (1 to 10). */
  step: number;
  /** Set when the person comes from Hiring Management (see lib/hiringStore). */
  hiredFrom?: { candidateId: string; jobId: string; offerId: string };
}

/** Create an employee from the onboarding wizard. The person starts as "Onboarding" with an onboarding request
    waiting for approval, an audit entry is written, and everything is saved so it survives a reload.
    Returns null when the work email already belongs to someone or the name is empty. */
export function addEmployee(input: NewEmployeeInput): Employee | null {
  const email = input.email.trim().toLowerCase();
  const name = (input.v.name ?? '').trim();
  if (!name || !email || EMPLOYEES.some((x) => x.email.toLowerCase() === email)) return null;

  const code = nextEmployeeCode();
  const currency = (input.v.currency || 'AED') as BankDetails['currency'];
  const e: Employee = {
    id: code,
    employeeCode: code,
    name: '',
    avatarInitials: '',
    email,
    phone: '',
    company: '',
    department: '',
    designation: '',
    location: input.v.location ?? '',
    seatingLocation: '',
    reportingManagerId: null,
    dateOfJoining: '',
    employmentStatus: 'Onboarding',
    employmentType: 'Permanent',
    nationality: '',
    dob: '',
    flags: [],
    documents: [],
    bankDetails: { accountName: '', accountNumber: '', bankName: '', branchCode: '', currency },
    profile: {
      gender: '',
      maritalStatus: '',
      bloodGroup: '',
      personalEmail: '',
      personalMobile: '',
      currentAddress: '',
      permanentAddress: '',
      extension: '',
      probationEnd: '',
      passportNumber: '',
      passportExpiry: '',
      paymentMode: '',
      emergency: [],
      totalExperience: '',
      experience: [],
      education: [],
      family: [],
      salary: { currency, earnings: [], deductions: [], total: 0, net: 0 },
      uploadedDocs: [],
    },
    createdAt: REFERENCE_TODAY,
    updatedAt: REFERENCE_TODAY,
  };

  const blank = toForm(e);
  const form: EmployeeForm = {
    ...blank,
    v: { ...blank.v, ...input.v },
    emergency: input.emergency ?? [],
    experience: input.experience ?? [],
    education: input.education ?? [],
    family: input.family ?? [],
    earnings: input.earnings ?? [],
    deductions: input.deductions ?? [],
    documents: input.documents ?? [],
    uploadedDocs: input.uploadedDocs ?? [],
  };
  applyForm(e, form);
  if (input.documentDetails?.length) e.profile.documentDetails = input.documentDetails.map((d) => ({ ...d }));
  e.employmentStatus = 'Onboarding';
  if (input.hiredFrom) e.hiredFrom = input.hiredFrom;
  if (e.profile.uan) e.pfUan = e.profile.uan;

  const reqNo = ONBOARDING_REQUESTS.reduce((m, r) => Math.max(m, parseInt(r.id.replace(/\D/g, ''), 10) || 0), 0) + 1;
  const request: OnboardingRequest = {
    id: `onb-${reqNo}`,
    candidateName: e.name,
    location: e.location,
    department: e.department,
    designation: e.designation,
    step: Math.min(Math.max(input.step, 1), 10),
    status: 'Pending Approval',
    startDate: e.dateOfJoining,
    role: input.role,
  };

  EMPLOYEES.push(e);
  ONBOARDING_REQUESTS.push(request);
  hireRoles[e.id] = input.role;
  hires.push({ employee: clone(e), request: clone(request), role: input.role });

  const entry: AuditEntry = {
    id: `ad-${Date.now()}`,
    employeeId: e.id,
    field: 'Employee record',
    from: '—',
    to: `Created through onboarding (${e.employmentStatus}, approval pending) with the ${input.role} role`,
    changedBy: input.by,
    changedOn: REFERENCE_TODAY, at: new Date().toISOString(),
    module: 'Employee',
  };
  AUDIT_LOG.unshift(entry);
  saved.audit.unshift(entry);
  persist();
  notify();
  return e;
}

/** The person an onboarding request is about: a joiner created in the wizard, or a seeded one found by name. */
export function employeeOfRequest(requestId: string): Employee | undefined {
  const h = hires.find((x) => x.request.id === requestId);
  if (h) return EMPLOYEES.find((e) => e.id === h.employee.id);
  const r = ONBOARDING_REQUESTS.find((x) => x.id === requestId);
  return r ? EMPLOYEES.find((e) => e.name === r.candidateName && e.employmentStatus === 'Onboarding') : undefined;
}

/** HR's decision on an onboarding that is waiting for approval: approve it (payroll and the manager are told), or
    send it back to the person who started it with a note on what to fix. */
export function decideOnboarding(requestId: string, decision: 'approve' | 'send-back', by: string, note = ''): boolean {
  const req = ONBOARDING_REQUESTS.find((r) => r.id === requestId);
  if (!req || req.status !== 'Pending Approval') return false;
  const next: OnboardingRequest['status'] = decision === 'approve' ? 'Approved' : 'In Progress';
  req.status = next;
  const h = hires.find((x) => x.request.id === requestId);
  if (h) h.request.status = next;
  decisions[requestId] = next;
  try {
    localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
  } catch {
    /* storage unavailable: the decision still applies for this visit */
  }
  const emp = employeeOfRequest(requestId);
  logAudit({
    employeeId: emp?.id ?? `onboarding:${requestId}`,
    field: 'Onboarding approval',
    from: 'Pending Approval',
    to: decision === 'approve' ? `Approved${note.trim() ? `: ${note.trim()}` : ''}` : `Sent back for changes: ${note.trim()}`,
    changedBy: by,
    module: 'Onboarding',
  });
  pushNotice({
    kind: 'request',
    tone: decision === 'approve' ? 'active' : 'pending',
    title: decision === 'approve' ? `Onboarding approved: ${req.candidateName}` : `Onboarding sent back: ${req.candidateName}`,
    sub: decision === 'approve' ? `Starts ${req.startDate}. Payroll can now set up their salary.` : note.trim(),
    href: '/onboarding',
    toRoles: ['HR', 'Office Admin', 'Super Admin'],
    by,
  });
  persist();
  notify();
  return true;
}


/** Whether HR sent this request back for changes (so it can be put forward again). */
export const wasSentBack = (requestId: string) => decisions[requestId] === 'In Progress';

/** A request HR sent back is fixed and put in front of approvers again. */
export function resubmitOnboarding(requestId: string, by: string): boolean {
  const req = ONBOARDING_REQUESTS.find((r) => r.id === requestId);
  if (!req || req.status !== 'In Progress' || decisions[requestId] !== 'In Progress') return false;
  req.status = 'Pending Approval';
  const h = hires.find((x) => x.request.id === requestId);
  if (h) h.request.status = 'Pending Approval';
  delete decisions[requestId];
  try {
    localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
  } catch {
    /* storage unavailable */
  }
  logAudit({ employeeId: employeeOfRequest(requestId)?.id ?? 'onboarding:' + requestId, field: 'Onboarding approval', from: 'Sent back for changes', to: 'Sent for approval again', changedBy: by, module: 'Onboarding' });
  persist();
  notify();
  return true;
}

/** Re-render when any employee record is edited. Returns a counter to use in memo dependencies. */
export function useEmployeeVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
}
