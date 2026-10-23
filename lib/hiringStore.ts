import { useSyncExternalStore } from 'react';
import { addDays, daysBetween, todayISO } from '@/lib/dates';
import { Role } from '@/lib/types';
import { logAudit } from '@/lib/employeeStore';
import { EMPLOYEES } from '@/lib/data';
import { chainSteps } from '@/lib/workflow';
import { seedHiring } from '@/lib/hiringSeed';
import { pushNotice } from '@/lib/notifications';
import { HiringLevel } from '@/lib/hiringAccess';
import {
  Application,
  ApprovalStep,
  Candidate,
  EMPLOYMENT_KINDS,
  EXITS,
  Exit,
  HiringState,
  Interview,
  InterviewMode,
  Job,
  JobStatus,
  Offer,
  OfferStatus,
  Requisition,
  RequisitionReason,
  RequisitionStatus,
  Source,
  Stage,
  STAGES,
  EmploymentKind,
} from '@/lib/hiringTypes';

/* Hiring data lives in one module-level store (like the employee store): it is saved in this browser so work
   survives a reload, and every screen re-renders from the same snapshot. A backend replaces the persistence later;
   the action signatures are what the screens depend on. */

const KEY = 'gsit.hiring.v1';
const SERVER: HiringState = seedHiring();
let state: HiringState = SERVER;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      state = withHires(state);
      return;
    }
    const parsed = JSON.parse(raw) as Partial<HiringState>;
    if (parsed.requisitions && parsed.jobs && parsed.candidates && parsed.applications && parsed.interviews && parsed.offers) {
      state = withHires(parsed as HiringState);
    }
  } catch {
    /* unreadable saved data: keep the sample data */
  }
}

function commit(next: HiringState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable: the change still applies for this session */
  }
  listeners.forEach((l) => l());
}

/** The current data, for reading right after an action (before React re-renders). */
export function getHiring(): HiringState {
  load();
  return state;
}

export function useHiring(): HiringState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      load();
      return state;
    },
    () => SERVER,
  );
}

/** Forget saved changes and go back to the sample data. */
export function resetHiring() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  commit(seedHiring());
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const nowIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${todayISO()}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};
/** An accepted offer is a hire: the candidate moves to Hired and the position counts as filled (the job becomes Filled
    when every approved position is). Returns the data unchanged when the candidate is already Hired. */
function applyHire(st: HiringState, offerId: string, by: string): HiringState {
  const o = st.offers.find((x) => x.id === offerId);
  const a = o && st.applications.find((x) => x.id === o.applicationId);
  const j = a && st.jobs.find((x) => x.id === a.jobId);
  if (!o || !a || !j || a.stage === 'Hired') return st;
  const stamp = nowIso();
  const filled = j.filled + 1;
  const jobStatus: JobStatus = filled >= j.positions ? 'Filled' : j.status;
  const cand = st.candidates.find((c) => c.id === a.candidateId);
  return {
    ...st,
    applications: st.applications.map((x) =>
      x.id === a.id ? { ...x, stage: 'Hired', exit: undefined, exitFrom: undefined, exitReason: undefined, exitNote: undefined, history: [...x.history, { id: uid('sc'), at: stamp, by, from: x.stage, to: 'Hired', note: `Offer ${o.code} accepted` }] } : x,
    ),
    jobs: st.jobs.map((x) =>
      x.id === j.id
        ? {
            ...x,
            filled,
            status: jobStatus,
            updatedAt: stamp,
            history: [
              ...(x.history ?? []),
              { id: uid('jh'), at: stamp, by, text: `${cand?.name ?? 'Candidate'} accepted ${o.code}: ${filled} of ${j.positions} positions filled` },
              ...(jobStatus !== j.status ? [{ id: uid('jh'), at: stamp, by: 'System', text: `Status changed from ${j.status} to ${jobStatus}` }] : []),
            ],
          }
        : x,
    ),
  };
}

/** Offers accepted before an acceptance counted as a hire (older saved data, and the sample data): bring them in line. */
function withHires(st: HiringState): HiringState {
  let next = st;
  st.offers.filter((o) => o.status === 'Accepted' && !o.employeeId).forEach((o) => (next = applyHire(next, o.id, 'System')));
  return next;
}

const nextCode = (prefix: string, existing: string[]) => `${prefix}-${String(existing.reduce((m, c) => Math.max(m, parseInt(c.replace(/\D/g, ''), 10) || 0), 0) + 1).padStart(4, '0')}`;

const HR_ROLES: Role[] = ['HR', 'Office Admin', 'Super Admin'];

/** Tell whoever must act on the requisition's current approval step. */
function notifyStep(r: Requisition, by: string) {
  const step = r.approvals.find((a) => a.status === 'Pending');
  if (!step) return;
  pushNotice({
    id: `req-act-${r.id}`,
    kind: 'hiring',
    tone: 'pending',
    title: `${r.code} needs your approval`,
    sub: `${r.title} · ${r.positions} position${r.positions === 1 ? '' : 's'} · ${step.label} step`,
    href: `/hiring/requisitions/${r.id}`,
    toIds: step.label === 'Hiring Manager' ? [r.hiringManagerId] : [],
    toRoles: step.label === 'Hiring Manager' ? [] : step.label === 'HR' ? HR_ROLES : ['Super Admin'],
    by,
  });
}

const audit = (id: string, field: string, from: string | undefined, to: string, by: string) => logAudit({ employeeId: `hiring:${id}`, field, from, to, changedBy: by, module: 'Hiring' });

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/* ---------------------------------------------------------------------- access */

/** Who may act on the approval step that is waiting. Management is the Super Admin. */
export function canDecideStep(label: string, role: Role, meId: string, req: Requisition): boolean {
  if (role === 'Super Admin') return true;
  if (label === 'Hiring Manager') return req.hiringManagerId === meId;
  if (label === 'HR') return role === 'HR' || role === 'Office Admin';
  return false;
}

export function visibleRequisitions(s: HiringState, level: HiringLevel, meId: string) {
  return level === 'full' ? s.requisitions : level === 'manager' ? s.requisitions.filter((r) => r.hiringManagerId === meId || r.createdById === meId) : [];
}
export function visibleJobs(s: HiringState, level: HiringLevel, meId: string) {
  return level === 'full' ? s.jobs : level === 'manager' ? s.jobs.filter((j) => j.hiringManagerId === meId) : [];
}

/* ---------------------------------------------------------------------- lookups */

export const reqById = (s: HiringState, id: string) => s.requisitions.find((r) => r.id === id);
export const jobById = (s: HiringState, id: string) => s.jobs.find((j) => j.id === id);
export const candById = (s: HiringState, id: string) => s.candidates.find((c) => c.id === id);
export const appById = (s: HiringState, id: string) => s.applications.find((a) => a.id === id);
export const offerById = (s: HiringState, id: string) => s.offers.find((o) => o.id === id);
export const jobForRequisition = (s: HiringState, reqId: string) => s.jobs.find((j) => j.requisitionId === reqId);
export const appsForJob = (s: HiringState, jobId: string) => s.applications.filter((a) => a.jobId === jobId);
export const appsForCandidate = (s: HiringState, candId: string) => s.applications.filter((a) => a.candidateId === candId);
export const interviewsForApp = (s: HiringState, appId: string) => s.interviews.filter((i) => i.applicationId === appId);
export const offerForApp = (s: HiringState, appId: string) => s.offers.find((o) => o.applicationId === appId && o.status !== 'Revoked');
export const isActiveApp = (a: Application) => !a.exit && a.stage !== 'Hired';

/** Interview moment as a Date in the viewer's clock. */
export const interviewAt = (i: Pick<Interview, 'date' | 'time'>) => new Date(`${i.date}T${i.time}:00`);

/** Whether this person is on the interview panel for any of a candidate's applications. */
export const isPanelistFor = (s: HiringState, candId: string, meId: string) => appsForCandidate(s, candId).some((a) => interviewsForApp(s, a.id).some((i) => i.panelIds.includes(meId)));

export function canViewCandidate(s: HiringState, level: HiringLevel, meId: string, candId: string): boolean {
  if (level === 'full') return true;
  const apps = appsForCandidate(s, candId);
  if (level === 'manager' && apps.some((a) => jobById(s, a.jobId)?.hiringManagerId === meId)) return true;
  return isPanelistFor(s, candId, meId);
}

/* ---------------------------------------------------------------------- requisitions */

export interface RequisitionInput {
  title: string;
  companyId: string;
  departmentId: string;
  department: string;
  designationTitle?: string;
  location: string;
  positions: number;
  employmentType: EmploymentKind;
  reason: RequisitionReason;
  replacesId?: string;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  targetStart: string;
  hiringManagerId: string;
  justification: string;
}

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

const freshApprovals = (): ApprovalStep[] => chainSteps('requisition').map((label) => ({ label, status: 'Waiting' }));

export function createRequisition(input: RequisitionInput, actor: Actor, submit: boolean): Requisition {
  const stamp = nowIso();
  const r: Requisition = {
    id: uid('req'),
    code: nextCode('REQ', state.requisitions.map((x) => x.code)),
    ...input,
    status: 'Draft',
    approvals: freshApprovals(),
    createdBy: actor.name,
    createdById: actor.id,
    createdAt: stamp,
    updatedAt: stamp,
  };
  commit({ ...state, requisitions: [r, ...state.requisitions] });
  audit(r.id, 'Requisition created', '—', `${r.code} · ${r.title} (${r.positions})`, actor.name);
  return submit ? (submitRequisition(r.id, actor) as { ok: true; requisition: Requisition }).requisition : r;
}

export function updateRequisition(id: string, input: RequisitionInput, actor: Actor): Result {
  const r = reqById(state, id);
  if (!r) return fail('Requisition not found.');
  if (r.status !== 'Draft' && r.status !== 'Rejected') return fail('Only a draft or rejected requisition can be edited.');
  commit({ ...state, requisitions: state.requisitions.map((x) => (x.id === id ? { ...x, ...input, updatedAt: nowIso() } : x)) });
  audit(id, 'Requisition edited', undefined, r.code, actor.name);
  return { ok: true };
}

/** Send a draft (or a rejected requisition, after edits) into the approval chain. The hiring manager's own step is
    approved automatically when they raised it. */
export function submitRequisition(id: string, actor: Actor): Result<{ requisition: Requisition }> {
  const r = reqById(state, id);
  if (!r) return fail('Requisition not found.');
  if (r.status !== 'Draft' && r.status !== 'Rejected') return fail('This requisition has already been submitted.');
  const stamp = nowIso();
  const steps = freshApprovals();
  steps[0] = actor.id === r.hiringManagerId ? { ...steps[0], status: 'Approved', by: actor.name, at: stamp } : { ...steps[0], status: 'Pending' };
  if (steps[0].status === 'Approved' && steps[1]) steps[1] = { ...steps[1], status: 'Pending' };
  const next: Requisition = { ...r, status: 'Pending Approval', approvals: steps, updatedAt: stamp };
  commit({ ...state, requisitions: state.requisitions.map((x) => (x.id === id ? next : x)) });
  audit(id, 'Requisition submitted', r.status, 'Pending Approval', actor.name);
  notifyStep(next, actor.id);
  return { ok: true, requisition: next };
}

export function decideRequisition(id: string, decision: 'Approved' | 'Rejected', actor: Actor, note: string): Result {
  const r = reqById(state, id);
  if (!r || r.status !== 'Pending Approval') return fail('This requisition is not waiting for a decision.');
  const idx = r.approvals.findIndex((a) => a.status === 'Pending');
  if (idx < 0) return fail('No approval step is pending.');
  const step = r.approvals[idx];
  if (!canDecideStep(step.label, actor.role, actor.id, r)) return fail(`The ${step.label} step is not yours to decide.`);
  if (decision === 'Rejected' && !note.trim()) return fail('Add a short note explaining the rejection.');
  const stamp = nowIso();
  const approvals = r.approvals.map((a, i) => {
    if (i === idx) return { ...a, status: decision, by: actor.name, at: stamp, note: note.trim() || undefined };
    if (decision === 'Approved' && i === idx + 1) return { ...a, status: 'Pending' as const };
    return a;
  });
  const status: RequisitionStatus = decision === 'Rejected' ? 'Rejected' : idx === r.approvals.length - 1 ? 'Approved' : 'Pending Approval';
  commit({ ...state, requisitions: state.requisitions.map((x) => (x.id === id ? { ...x, approvals, status, updatedAt: stamp } : x)) });
  audit(id, `Requisition ${step.label} step ${decision.toLowerCase()}`, r.status, status, actor.name);
  const decided = { ...r, approvals, status };
  if (status === 'Pending Approval') notifyStep(decided, actor.id);
  else {
    const ok = status === 'Approved';
    pushNotice({ kind: 'hiring', tone: ok ? 'active' : 'expired', title: `${r.code} was ${ok ? 'approved' : 'rejected'}`, sub: `${r.title}${ok ? '. A job can now be created from it.' : `. ${note.trim()}`}`, href: `/hiring/requisitions/${id}`, toIds: [r.createdById, r.hiringManagerId], by: actor.id });
    if (ok) pushNotice({ kind: 'hiring', tone: 'info', title: `${r.code} is approved: create the job`, sub: `${r.title} · ${r.positions} position${r.positions === 1 ? '' : 's'}`, href: `/hiring/requisitions/${id}`, toRoles: HR_ROLES, by: actor.id });
  }
  return { ok: true };
}

export function setRequisitionStatus(id: string, status: 'On Hold' | 'Closed' | 'Approved', actor: Actor): Result {
  const r = reqById(state, id);
  if (!r) return fail('Requisition not found.');
  commit({ ...state, requisitions: state.requisitions.map((x) => (x.id === id ? { ...x, status, updatedAt: nowIso() } : x)) });
  audit(id, 'Requisition status', r.status, status, actor.name);
  return { ok: true };
}

/* ---------------------------------------------------------------------- jobs */

export interface JobInput {
  description: string;
  skills: string[];
  expMin: number;
  expMax: number;
  qualifications: string;
  panelIds: string[];
  referralEligible: boolean;
  closingDate: string;
  designationTitle: string;
  recruiterId: string;
  publish: boolean;
}

/** A job can only be created from an approved requisition that has no job yet. */
export function createJob(requisitionId: string, input: JobInput, actor: Actor): Result<{ job: Job }> {
  const r = reqById(state, requisitionId);
  if (!r) return fail('Requisition not found.');
  if (r.status !== 'Approved') return fail('A job can only be created from an approved requisition.');
  if (jobForRequisition(state, requisitionId)) return fail('This requisition already has a job.');
  const stamp = nowIso();
  const { publish, ...rest } = input;
  const job: Job = {
    id: uid('job'),
    code: nextCode('JOB', state.jobs.map((x) => x.code)),
    requisitionId: r.id,
    title: r.title,
    companyId: r.companyId,
    departmentId: r.departmentId,
    department: r.department,
    location: r.location,
    positions: r.positions,
    filled: 0,
    employmentType: r.employmentType,
    ...rest,
    status: publish ? 'Open' : 'Draft',
    hiringManagerId: r.hiringManagerId,
    budgetMin: r.budgetMin,
    budgetMax: r.budgetMax,
    currency: r.currency,
    createdBy: actor.name,
    createdAt: stamp,
    updatedAt: stamp,
    history: [{ id: uid('jh'), at: stamp, by: actor.name, text: `Job created from ${r.code} as ${publish ? 'Open' : 'Draft'}` }],
  };
  commit({ ...state, jobs: [job, ...state.jobs] });
  audit(job.id, 'Job created', '—', `${job.code} · ${job.title} (${job.status})`, actor.name);
  return { ok: true, job };
}

/** The recruiter of a job; for jobs saved before recruiters existed, the person who created it. */
export const recruiterIdOf = (j: Job): string | undefined => j.recruiterId ?? EMPLOYEES.find((e) => e.name === j.createdBy)?.id;

export function setJobRecruiter(id: string, recruiterId: string, actor: Actor): Result {
  const j = jobById(state, id);
  if (!j) return fail('Job not found.');
  const next = EMPLOYEES.find((e) => e.id === recruiterId);
  if (!next) return fail('Choose a recruiter.');
  const prev = EMPLOYEES.find((e) => e.id === recruiterIdOf(j));
  if (prev?.id === next.id) return { ok: true };
  const stamp = nowIso();
  commit({ ...state, jobs: state.jobs.map((x) => (x.id === id ? { ...x, recruiterId, updatedAt: stamp, history: [...(x.history ?? []), { id: uid('jh'), at: stamp, by: actor.name, text: `Recruiter changed from ${prev?.name ?? 'none'} to ${next.name}` }] } : x)) });
  audit(id, 'Job recruiter', prev?.name ?? '—', next.name, actor.name);
  if (next.id !== actor.id) pushNotice({ kind: 'hiring', tone: 'info', title: `You are now the recruiter for ${j.code}`, sub: j.title, href: `/hiring/jobs/${j.id}`, toIds: [next.id], by: actor.id });
  return { ok: true };
}

export function setJobStatus(id: string, status: JobStatus, actor: Actor): Result {
  const j = jobById(state, id);
  if (!j) return fail('Job not found.');
  const stamp = nowIso();
  commit({ ...state, jobs: state.jobs.map((x) => (x.id === id ? { ...x, status, updatedAt: stamp, history: [...(x.history ?? []), { id: uid('jh'), at: stamp, by: actor.name, text: `Status changed from ${j.status} to ${status}` }] } : x)) });
  audit(id, 'Job status', j.status, status, actor.name);
  return { ok: true };
}

/* ---------------------------------------------------------------------- candidates */

export interface CandidateInput {
  name: string;
  email: string;
  phone: string;
  location: string;
  currentCity: string;
  currentCompany: string;
  currentTitle: string;
  experienceYears: number;
  noticeDays: number;
  currentSalary?: number;
  expectedSalary?: number;
  currency: string;
  visaStatus: string;
  source: Source;
  referrerId?: string;
  agency?: string;
  cvName?: string;
  links: string;
  tags: string[];
  note: string;
  consent: boolean;
}

const digits = (s: string) => s.replace(/\D/g, '');
/** The last nine digits identify a phone number whatever country code or spacing was typed. */
const phoneKey = (s: string) => digits(s).slice(-9);

/** Existing candidates with the same email or phone number. */
export function findDuplicates(s: HiringState, email: string, phone: string): Candidate[] {
  const e = email.trim().toLowerCase();
  const p = phoneKey(phone);
  return s.candidates.filter((c) => (!!e && c.email.toLowerCase() === e) || (p.length >= 7 && phoneKey(c.phone) === p));
}

function newApplication(c: Candidate, j: Job, actor: string): Application {
  const stamp = nowIso();
  return { id: uid('app'), candidateId: c.id, jobId: j.id, location: j.location, stage: 'Applied', history: [{ id: uid('sc'), at: stamp, by: actor, from: '—', to: 'Applied' }], appliedAt: stamp };
}

export function addCandidate(input: CandidateInput, jobId: string | null, actor: Actor): Result<{ candidate: Candidate; application?: Application }> {
  if (!input.name.trim()) return fail('Name is required.');
  const dup = findDuplicates(state, input.email, input.phone);
  if (dup.length) return fail(`${dup[0].name} is already in the system with the same email or phone number.`);
  const j = jobId ? jobById(state, jobId) : undefined;
  if (jobId && !j) return fail('Job not found.');
  const stamp = nowIso();
  const { note, consent, ...rest } = input;
  const candidate: Candidate = {
    id: uid('cand'),
    ...rest,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    notes: note.trim() ? [{ id: uid('n'), at: stamp, by: actor.name, text: note.trim() }] : [],
    consent: { given: consent, at: stamp },
    createdBy: actor.name,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const application = j ? newApplication(candidate, j, actor.name) : undefined;
  commit({ ...state, candidates: [candidate, ...state.candidates], applications: application ? [application, ...state.applications] : state.applications });
  audit(candidate.id, 'Candidate added', '—', `${candidate.name}${j ? ` → ${j.code} ${j.title}` : ''}`, actor.name);
  if (j && actor.id === 'careers-page') pushNotice({ kind: 'hiring', tone: 'info', title: `New application for ${j.title}`, sub: `${candidate.name} applied through ${candidate.source}`, href: `/hiring/candidates/${candidate.id}`, toRoles: HR_ROLES, toIds: [j.hiringManagerId] });
  return { ok: true, candidate, application };
}

export function applyToJob(candidateId: string, jobId: string, actor: Actor): Result<{ application: Application }> {
  const c = candById(state, candidateId);
  const j = jobById(state, jobId);
  if (!c || !j) return fail('Candidate or job not found.');
  if (state.applications.some((a) => a.candidateId === candidateId && a.jobId === jobId)) return fail(`${c.name} has already applied to this job.`);
  const application = newApplication(c, j, actor.name);
  commit({ ...state, applications: [application, ...state.applications] });
  audit(candidateId, 'Applied to job', '—', `${j.code} ${j.title}`, actor.name);
  if (actor.id === 'careers-page') pushNotice({ kind: 'hiring', tone: 'info', title: `New application for ${j.title}`, sub: `${c.name} applied again through the careers page`, href: `/hiring/candidates/${c.id}`, toRoles: HR_ROLES, toIds: [j.hiringManagerId] });
  return { ok: true, application };
}

export function updateCandidateTags(candidateId: string, tags: string[]) {
  commit({ ...state, candidates: state.candidates.map((c) => (c.id === candidateId ? { ...c, tags, updatedAt: nowIso() } : c)) });
}

export function addCandidateNote(candidateId: string, text: string, actor: Actor) {
  if (!text.trim()) return;
  commit({ ...state, candidates: state.candidates.map((c) => (c.id === candidateId ? { ...c, notes: [{ id: uid('n'), at: nowIso(), by: actor.name, text: text.trim() }, ...c.notes], updatedAt: nowIso() } : c)) });
}

/* ---------------------------------------------------------------------- pipeline */

function patchApp(id: string, fn: (a: Application) => Application) {
  commit({ ...state, applications: state.applications.map((a) => (a.id === id ? fn(a) : a)) });
}

/** Move a candidate to another stage. Hired is set only by Start onboarding. */
export function moveStage(appId: string, to: Stage, actor: Actor, note?: string): Result {
  const a = appById(state, appId);
  if (!a) return fail('Application not found.');
  if (to === 'Hired') return fail('Hired is set when onboarding is started from an accepted offer.');
  if (a.stage === 'Hired') return fail('This candidate has already been hired.');
  if (a.stage === to && !a.exit) return { ok: true };
  const j = jobById(state, a.jobId);
  if (j && (j.status === 'Closed' || j.status === 'Filled')) return fail(`This job is ${j.status.toLowerCase()}; reopen it to move candidates.`);
  patchApp(appId, (x) => ({
    ...x,
    stage: to,
    exit: undefined,
    exitFrom: undefined,
    exitReason: undefined,
    exitNote: undefined,
    history: [...x.history, { id: uid('sc'), at: nowIso(), by: actor.name, from: x.exit ?? x.stage, to, note }],
  }));
  audit(appId, 'Pipeline stage', a.exit ?? a.stage, to, actor.name);
  return { ok: true };
}

/** Take a candidate out of the pipeline. Rejecting needs a reason. */
export function exitApplication(appId: string, exit: Exit, actor: Actor, reason: string, note?: string): Result {
  const a = appById(state, appId);
  if (!a) return fail('Application not found.');
  if (a.stage === 'Hired') return fail('This candidate has already been hired.');
  if (exit === 'Rejected' && !reason.trim()) return fail('Choose a rejection reason.');
  patchApp(appId, (x) => ({
    ...x,
    exit,
    exitFrom: x.exit ? x.exitFrom : x.stage,
    exitReason: reason || undefined,
    exitNote: note?.trim() || undefined,
    history: [...x.history, { id: uid('sc'), at: nowIso(), by: actor.name, from: x.exit ?? x.stage, to: exit, note: [reason, note?.trim()].filter(Boolean).join(' — ') || undefined }],
  }));
  audit(appId, 'Pipeline exit', a.exit ?? a.stage, `${exit}${reason ? ` (${reason})` : ''}`, actor.name);
  return { ok: true };
}

export function reopenApplication(appId: string, actor: Actor): Result {
  const a = appById(state, appId);
  if (!a || !a.exit) return fail('This application is not closed out.');
  return moveStage(appId, a.exitFrom ?? 'Applied', actor, 'Reopened');
}

/* ---------------------------------------------------------------------- interviews */

export interface InterviewInput {
  applicationId: string;
  round: string;
  date: string;
  time: string;
  durationMin: number;
  mode: InterviewMode;
  panelIds: string[];
  link: string;
  notes: string;
}

/** Panelists who already have an interview at the same date and time. */
export function panelClashes(s: HiringState, input: Pick<InterviewInput, 'date' | 'time' | 'panelIds'>, ignoreId?: string): string[] {
  const hit = new Set<string>();
  s.interviews.forEach((i) => {
    if (i.id === ignoreId || i.status !== 'Scheduled' || i.date !== input.date || i.time !== input.time) return;
    i.panelIds.forEach((p) => input.panelIds.includes(p) && hit.add(p));
  });
  return [...hit];
}

const ROUND_STAGE: Record<string, Stage | undefined> = { 'Screening call': 'Screening', 'Technical Interview': 'Technical Interview', 'HR Interview': 'HR Interview' };

export function scheduleInterview(input: InterviewInput, actor: Actor): Result<{ interview: Interview }> {
  const a = appById(state, input.applicationId);
  if (!a) return fail('Application not found.');
  if (a.exit || a.stage === 'Hired') return fail('This candidate is no longer in the pipeline.');
  if (!input.date || !input.time) return fail('Choose a date and time.');
  if (!input.panelIds.length) return fail('Add at least one panel member.');
  const interview: Interview = { id: uid('int'), location: a.location, status: 'Scheduled', scheduledBy: actor.name, createdAt: nowIso(), ...input };
  commit({ ...state, interviews: [interview, ...state.interviews] });
  audit(interview.id, 'Interview scheduled', '—', `${input.round} · ${input.date} ${input.time}`, actor.name);
  const cand = candById(state, a.candidateId);
  pushNotice({ kind: 'hiring', tone: 'pending', title: 'You were added to an interview', sub: `${cand?.name ?? 'Candidate'} · ${input.round} · ${input.date} at ${input.time} (${input.mode})`, href: cand ? `/hiring/candidates/${cand.id}` : '/my/interviews', toIds: input.panelIds, by: actor.id });
  // Scheduling a round moves the candidate forward to it when they are still behind.
  const target = ROUND_STAGE[input.round];
  if (target && STAGES.indexOf(target) > STAGES.indexOf(a.stage)) moveStage(a.id, target, actor, `Interview scheduled: ${input.round}`);
  return { ok: true, interview };
}

export function rescheduleInterview(id: string, patch: Pick<InterviewInput, 'date' | 'time' | 'durationMin' | 'mode' | 'panelIds' | 'link'>, actor: Actor): Result {
  const i = state.interviews.find((x) => x.id === id);
  if (!i) return fail('Interview not found.');
  if (!patch.panelIds.length) return fail('Add at least one panel member.');
  commit({ ...state, interviews: state.interviews.map((x) => (x.id === id ? { ...x, ...patch, rescheduled: (x.rescheduled ?? 0) + 1 } : x)) });
  audit(id, 'Interview rescheduled', `${i.date} ${i.time}`, `${patch.date} ${patch.time}`, actor.name);
  pushNotice({ kind: 'hiring', tone: 'soon', title: 'An interview was moved', sub: `${i.round} is now ${patch.date} at ${patch.time}`, href: '/my/interviews', toIds: patch.panelIds, by: actor.id });
  return { ok: true };
}

export function setInterviewStatus(id: string, status: 'Completed' | 'Cancelled', actor: Actor) {
  const i = state.interviews.find((x) => x.id === id);
  if (!i) return;
  commit({ ...state, interviews: state.interviews.map((x) => (x.id === id ? { ...x, status } : x)) });
  audit(id, 'Interview status', i.status, status, actor.name);
  if (status === 'Cancelled') pushNotice({ kind: 'hiring', tone: 'info', title: 'An interview was cancelled', sub: `${i.round} on ${i.date} at ${i.time}`, href: '/my/interviews', toIds: i.panelIds, by: actor.id });
}

/* ---------------------------------------------------------------------- offers */

export interface OfferInput {
  lines: { label: string; amount: number }[];
  joiningDate: string;
  probationMonths: number;
  expiryDate: string;
}

export function createOffer(appId: string, input: OfferInput, actor: Actor): Result<{ offer: Offer }> {
  const a = appById(state, appId);
  const j = a && jobById(state, a.jobId);
  if (!a || !j) return fail('Application not found.');
  if (a.stage !== 'Offer' || a.exit) return fail('Move the candidate to the Offer stage first.');
  if (offerForApp(state, appId)) return fail('This candidate already has an offer.');
  const total = input.lines.reduce((n, l) => n + (Number.isFinite(l.amount) ? l.amount : 0), 0);
  if (total <= 0) return fail('Enter the salary breakdown.');
  const stamp = nowIso();
  const offer: Offer = {
    id: uid('off'),
    code: nextCode('OFF', state.offers.map((x) => x.code)),
    applicationId: appId,
    location: a.location,
    companyId: j.companyId,
    status: 'Draft',
    currency: j.currency,
    ...input,
    total,
    overBudget: total > j.budgetMax,
    createdBy: actor.name,
    createdAt: stamp,
    updatedAt: stamp,
  };
  commit({ ...state, offers: [offer, ...state.offers] });
  audit(offer.id, 'Offer created', '—', `${offer.code} · ${j.currency} ${total.toLocaleString('en-US')}`, actor.name);
  return { ok: true, offer };
}

/** Phase 1 offer lifecycle: Draft → Sent → Accepted or Declined. Approval and the offer letter come in Phase 2. */
export function setOfferStatus(id: string, status: OfferStatus, actor: Actor): Result {
  const o = offerById(state, id);
  if (!o) return fail('Offer not found.');
  const stamp = nowIso();
  const answered = status === 'Accepted' || status === 'Declined';
  const responded = answered ? stamp : o.respondedAt;
  const via = answered && !o.respondedVia ? (actor.id === 'candidate' ? 'link' : 'hr') : o.respondedVia;
  commit({
    ...state,
    offers: state.offers.map((x) =>
      x.id === id ? { ...x, status, updatedAt: stamp, respondedAt: responded, respondedVia: via, events: answered && actor.id !== 'candidate' ? addEvent(x, `${status} recorded by ${actor.name}`) : x.events } : x,
    ),
  });
  audit(id, 'Offer status', o.status, status, actor.name);
  if (status === 'Accepted' || status === 'Declined') {
    const oa = appById(state, o.applicationId);
    const oc = oa && candById(state, oa.candidateId);
    const oj = oa && jobById(state, oa.jobId);
    pushNotice({ kind: 'hiring', tone: status === 'Accepted' ? 'active' : 'expired', title: `${o.code} was ${status.toLowerCase()}`, sub: `${oc?.name ?? 'Candidate'} · ${oj?.title ?? ''}`, href: '/hiring/offers', toRoles: HR_ROLES, toIds: oj ? [oj.hiringManagerId] : [], by: actor.id });
  }
  if (status === 'Accepted') {
    const before = state;
    const next = applyHire(state, id, actor.name);
    if (next !== before) {
      commit(next);
      const ha = appById(next, o.applicationId);
      if (ha) audit(ha.id, 'Hired', 'Offer', `Offer ${o.code} accepted`, actor.name);
    }
  }
  if (status === 'Declined') exitApplication(o.applicationId, 'Withdrawn', actor, 'Offer declined');
  return { ok: true };
}

/* ---------------------------------------------------------------------- offer letter: send, read, download, respond */

export const offerByToken = (s: HiringState, token: string) => (token ? s.offers.find((o) => o.token === token) : undefined);
const newToken = () => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const addEvent = (o: Offer, text: string) => [...(o.events ?? []), { at: nowIso(), text }];

/** Keeps the prepared letter on the offer (while it is still a draft or has been sent but not answered). */
export function saveOfferLetter(id: string, html: string, actor: Actor, companyId?: string): Result {
  const o = offerById(state, id);
  if (!o) return fail('Offer not found.');
  if (o.status === 'Accepted' || o.status === 'Declined') return fail('This offer has been answered; its letter can no longer change.');
  commit({ ...state, offers: state.offers.map((x) => (x.id === id ? { ...x, letterHtml: html, letterAt: nowIso(), updatedAt: nowIso(), companyId: companyId ?? x.companyId, events: addEvent(x, `Letter prepared by ${actor.name}`) } : x)) });
  audit(id, 'Offer letter prepared', undefined, o.code, actor.name);
  return { ok: true };
}

const squash = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.'’-]/g, ' ').replace(/\s+/g, ' ').trim();

/** What is wrong with the name a candidate typed to accept an offer, in words for them; '' when it is fine. It must be a
    real full name (letters only, a first and a last name) and the name on the offer, spelling differences in case,
    accents and spacing aside. */
export function nameProblem(entered: string, expected: string): string {
  const typed = entered.replace(/\s+/g, ' ').trim();
  if (!typed) return 'Type your full name to accept.';
  if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(typed)) return 'Use letters only in your name (no numbers or symbols).';
  if (expected.trim().split(/\s+/).length > 1 && typed.split(/\s+/).length < 2) return 'Enter your full name: first and last name.';
  if (squash(typed) !== squash(expected)) return `Enter your name exactly as it appears on the offer: ${expected}.`;
  return '';
}

/** Sends the offer: it needs a letter, gets a link token and moves to Sent. Sending again keeps the same link. */
export function sendOffer(id: string, actor: Actor): Result<{ token: string }> {
  const o = offerById(state, id);
  if (!o) return fail('Offer not found.');
  if (!o.letterHtml) return fail('Prepare the offer letter first.');
  if (o.status === 'Accepted' || o.status === 'Declined') return fail('This offer has already been answered.');
  const token = o.token ?? newToken();
  const resend = o.status === 'Sent';
  const stamp = nowIso();
  commit({
    ...state,
    offers: state.offers.map((x) => (x.id === id ? { ...x, token, status: 'Sent', sentAt: stamp, sentBy: actor.name, updatedAt: stamp, events: addEvent(x, `${resend ? 'Sent again' : 'Sent'} by ${actor.name}`) } : x)),
  });
  audit(id, resend ? 'Offer sent again' : 'Offer sent', o.status, 'Sent', actor.name);
  return { ok: true, token };
}

/** Withdraws a sent offer: the link stops working and the offer goes back to Draft so it can be corrected and sent again. */
export function revokeOfferLink(id: string, actor: Actor): Result {
  const o = offerById(state, id);
  if (!o) return fail('Offer not found.');
  if (o.status !== 'Sent') return fail('Only a sent offer can be withdrawn.');
  const stamp = nowIso();
  commit({
    ...state,
    offers: state.offers.map((x) => (x.id === id ? { ...x, status: 'Draft', token: undefined, viewedAt: undefined, downloadedAt: undefined, updatedAt: stamp, events: addEvent(x, `Link withdrawn by ${actor.name}`) } : x)),
  });
  audit(id, 'Offer link withdrawn', 'Sent', 'Draft', actor.name);
  return { ok: true };
}

/** The candidate opened or downloaded the letter. Recorded once each; the first open is shown to HR. */
export function recordOfferEvent(token: string, kind: 'viewed' | 'downloaded'): void {
  const o = offerByToken(state, token);
  if (!o || o.status !== 'Sent') return;
  const field = kind === 'viewed' ? 'viewedAt' : 'downloadedAt';
  if (o[field]) return;
  const stamp = nowIso();
  commit({ ...state, offers: state.offers.map((x) => (x.id === o.id ? { ...x, [field]: stamp, events: addEvent(x, kind === 'viewed' ? 'Candidate opened the letter' : 'Candidate downloaded the letter') } : x)) });
  audit(o.id, kind === 'viewed' ? 'Offer letter opened' : 'Offer letter downloaded', undefined, 'By the candidate', 'Candidate');
  if (kind === 'viewed') {
    const oa = appById(state, o.applicationId);
    const oc = oa && candById(state, oa.candidateId);
    const oj = oa && jobById(state, oa.jobId);
    pushNotice({ kind: 'hiring', tone: 'info', title: `${oc?.name ?? 'The candidate'} opened ${o.code}`, sub: oj?.title ?? '', href: '/hiring/offers', toRoles: HR_ROLES, toIds: oj ? [oj.hiringManagerId] : [], by: 'candidate' });
  }
}

/** The candidate's answer from the public page. Accepting requires the letter to have been downloaded and a typed name. */
export function respondToOffer(token: string, decision: 'Accepted' | 'Declined', input: { name?: string; reason?: string; signature?: string }): Result {
  const o = offerByToken(state, token);
  if (!o) return fail('This link is not valid any more.');
  if (o.status === 'Accepted' || o.status === 'Declined') return fail(`This offer was already ${o.status.toLowerCase()}.`);
  if (o.status !== 'Sent') return fail('This offer is not open for a response.');
  if (o.expiryDate < todayISO()) return fail(`This offer expired on ${o.expiryDate}. Please contact HR.`);
  if (!o.downloadedAt) return fail('Download the letter first, then respond.');
  if (decision === 'Accepted' && !(input.name ?? '').trim()) return fail('Type your full name to accept.');
  if (decision === 'Accepted') {
    const who = candById(state, appById(state, o.applicationId)?.candidateId ?? '');
    const bad = who ? nameProblem(input.name ?? '', who.name) : '';
    if (bad) return fail(bad);
  }
  if (decision === 'Accepted' && !input.signature) return fail('Add your signature to accept.');
  if (decision === 'Declined' && !(input.reason ?? '').trim()) return fail('Tell us briefly why you are declining.');
  commit({
    ...state,
    offers: state.offers.map((x) =>
      x.id === o.id
        ? { ...x, signedName: decision === 'Accepted' ? (candById(state, appById(state, o.applicationId)?.candidateId ?? '')?.name ?? (input.name ?? '').replace(/\s+/g, ' ').trim()) : x.signedName, signature: decision === 'Accepted' ? input.signature : x.signature, signedAt: decision === 'Accepted' ? nowIso() : x.signedAt, declineReason: decision === 'Declined' ? (input.reason ?? '').trim() : undefined, respondedVia: 'link', events: addEvent(x, decision === 'Accepted' ? `Accepted and e-signed by ${(input.name ?? '').trim()}` : 'Declined by the candidate') }
        : x,
    ),
  });
  return setOfferStatus(o.id, decision, { id: 'candidate', name: 'Candidate (offer link)', role: 'Employee' });
}

/** The candidate backed out after accepting, before an employee was created. The offer is closed as declined, the
    candidate leaves the Hired column (withdrawn from the Offer stage) and the position is open again. */
export function withdrawAcceptedOffer(offerId: string, reason: string, actor: Actor): Result {
  const o = offerById(state, offerId);
  const a = o && appById(state, o.applicationId);
  const j = a && jobById(state, a.jobId);
  if (!o || !a || !j) return fail('Offer not found.');
  if (o.status !== 'Accepted') return fail('Only an accepted offer can be withdrawn this way.');
  if (o.employeeId) return fail(`${o.employeeId} was already created from this offer. Close it from Offboarding instead.`);
  if (!reason.trim()) return fail('Say why the candidate backed out.');
  const stamp = nowIso();
  const counted = a.stage === 'Hired';
  const filled = counted ? Math.max(0, j.filled - 1) : j.filled;
  const jobStatus: JobStatus = j.status === 'Filled' && filled < j.positions ? 'Open' : j.status;
  const cand = candById(state, a.candidateId);
  commit({
    ...state,
    offers: state.offers.map((x) => (x.id === offerId ? { ...x, status: 'Declined', declineReason: reason.trim(), updatedAt: stamp, events: addEvent(x, `Withdrawn after acceptance by ${actor.name}: ${reason.trim()}`) } : x)),
    applications: state.applications.map((x) =>
      x.id === a.id
        ? { ...x, stage: 'Offer', exit: 'Withdrawn', exitFrom: 'Offer', exitReason: 'Backed out after accepting', exitNote: reason.trim(), history: [...x.history, { id: uid('sc'), at: stamp, by: actor.name, from: x.stage, to: 'Withdrawn', note: `Backed out after accepting ${o.code}: ${reason.trim()}` }] }
        : x,
    ),
    jobs: state.jobs.map((x) =>
      x.id === j.id
        ? {
            ...x,
            filled,
            status: jobStatus,
            updatedAt: stamp,
            history: [
              ...(x.history ?? []),
              { id: uid('jh'), at: stamp, by: actor.name, text: `${cand?.name ?? 'Candidate'} backed out after accepting ${o.code}: ${filled} of ${j.positions} positions filled` },
              ...(jobStatus !== j.status ? [{ id: uid('jh'), at: stamp, by: 'System', text: `Status changed from ${j.status} to ${jobStatus}` }] : []),
            ],
          }
        : x,
    ),
  });
  audit(offerId, 'Accepted offer withdrawn', 'Accepted', `Declined: ${reason.trim()}`, actor.name);
  pushNotice({ kind: 'hiring', tone: 'expired', title: `${o.code} was withdrawn after acceptance`, sub: `${cand?.name ?? 'Candidate'} · ${j.title}`, href: `/hiring/jobs/${j.id}`, toRoles: HR_ROLES, toIds: [j.hiringManagerId], by: actor.id });
  return { ok: true };
}

/** Onboarding was started from an accepted offer: link candidate and employee both ways, mark the candidate hired and
    count the position as filled (the job becomes Filled when every approved position is). */
export function completeHire(offerId: string, employee: { id: string; code: string; name: string }, actor: Actor): Result {
  const o = offerById(state, offerId);
  const a = o && appById(state, o.applicationId);
  const j = a && jobById(state, a.jobId);
  if (!o || !a || !j) return fail('Offer not found.');
  if (o.employeeId) return fail(`This offer was already used to onboard ${o.employeeId}.`);
  const stamp = nowIso();
  // Accepting the offer already moved the candidate to Hired and counted the position; older data may not have.
  const counted = a.stage === 'Hired';
  const filled = counted ? j.filled : j.filled + 1;
  const jobStatus: JobStatus = filled >= j.positions ? 'Filled' : j.status;
  commit({
    ...state,
    offers: state.offers.map((x) => (x.id === offerId ? { ...x, employeeId: employee.id, updatedAt: stamp } : x)),
    candidates: state.candidates.map((c) => (c.id === a.candidateId ? { ...c, employeeId: employee.id, updatedAt: stamp } : c)),
    applications: state.applications.map((x) =>
      x.id === a.id ? { ...x, stage: 'Hired', history: [...x.history, { id: uid('sc'), at: stamp, by: actor.name, from: x.stage, to: 'Hired', note: `Onboarding started as ${employee.code}` }] } : x,
    ),
    jobs: state.jobs.map((x) =>
      x.id === j.id
        ? {
            ...x,
            filled,
            status: jobStatus,
            updatedAt: stamp,
            history: [
              ...(x.history ?? []),
              { id: uid('jh'), at: stamp, by: actor.name, text: counted ? `Onboarding started for ${employee.name} (${employee.code})` : `${employee.name} hired (${employee.code}): ${filled} of ${j.positions} positions filled` },
              ...(jobStatus !== j.status ? [{ id: uid('jh'), at: stamp, by: 'System', text: `Status changed from ${j.status} to ${jobStatus}` }] : []),
            ],
          }
        : x,
    ),
  });
  audit(a.id, 'Hired', a.stage, `Onboarding started: ${employee.name} (${employee.code}); ${j.code} filled ${filled}/${j.positions}`, actor.name);
  return { ok: true };
}

/* ---------------------------------------------------------------------- reporting helpers */

export const daysSince = (iso: string) => daysBetween(iso.slice(0, 10), todayISO());
export const inDays = (n: number) => addDays(todayISO(), n);

export const isEmploymentKind = (v: string): v is EmploymentKind => (EMPLOYMENT_KINDS as readonly string[]).includes(v);
export const isExit = (v: string): v is Exit => (EXITS as readonly string[]).includes(v);
