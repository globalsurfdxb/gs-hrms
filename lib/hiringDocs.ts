import { useSyncExternalStore } from 'react';
import { logTask } from '@/lib/activity';
import { pushNotice } from '@/lib/notifications';

/* Pre-offer documents. Before an offer letter is issued, HR asks the candidate to confirm they want to proceed and to
   share a set of documents plus a background-verification referral. The candidate does this on a private page (no sign
   in). HR then verifies each item; when everything is verified HR tells the candidate, and only then can the offer
   letter be created. What was collected is carried into the joining form, so it is not asked for twice.
   With no server yet, the link only opens in the browser that holds this data, and files are recorded by name. */

export interface DocSlot {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  /** The document name the joining form uses for the same paper, so it is not asked for again. */
  joining?: string;
}

const INDIA_SLOTS: DocSlot[] = [
  { key: 'education', label: 'Education certificates', hint: '10th & 12th grade, bachelor’s degree', required: true, joining: 'Highest Educational Certificate' },
  { key: 'aadhaar', label: 'Aadhaar card', hint: 'Both sides', required: true, joining: 'Aadhaar Card' },
  { key: 'pan', label: 'PAN card', hint: 'A clear copy', required: true, joining: 'PAN Card' },
  { key: 'experience', label: 'Experience letters', hint: 'From your previous employers', required: true, joining: 'Experience / Relieving Letters' },
  { key: 'payslips', label: 'Last 3 months’ payslips', hint: 'From your existing company', required: true },
  { key: 'resignation', label: 'Resignation email / acceptance', hint: 'If available', required: false },
];

const UAE_SLOTS: DocSlot[] = [
  { key: 'passport', label: 'Passport copy', hint: 'The photo page and the last page', required: true, joining: 'Passport Copy' },
  { key: 'education', label: 'Education certificates', hint: 'Highest qualification; attested if you have it', required: true, joining: 'Attested Educational Certificate' },
  { key: 'experience', label: 'Experience letters', hint: 'From your previous employers', required: true, joining: 'Experience Letters' },
  { key: 'payslips', label: 'Last 3 months’ payslips', hint: 'From your existing company', required: true },
  { key: 'visa', label: 'Residence visa / Emirates ID', hint: 'If you already have them', required: false },
  { key: 'resignation', label: 'Resignation email / acceptance', hint: 'If available', required: false },
];

export const slotsFor = (location: string): DocSlot[] => (location === 'Kochi' ? INDIA_SLOTS : UAE_SLOTS);

export type ItemStatus = 'Pending' | 'Received' | 'Verified' | 'Rejected';
export type RequestStatus = 'Requested' | 'Opened' | 'Submitted' | 'Needs changes' | 'Verified' | 'Declined' | 'Waived';

export interface DocFile {
  name: string;
  size: number;
  at: string;
}

export interface DocItem {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  files: DocFile[];
  status: ItemStatus;
  /** Why HR asked for it again. */
  note?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

/** The Employee Background Verification referral: someone who can vouch for the candidate. */
export interface Referral {
  name: string;
  designation: string;
  phone: string;
}

export interface DocRequest {
  id: string;
  token: string;
  applicationId: string;
  candidateId: string;
  name: string;
  email: string;
  location: string;
  jobTitle: string;
  company?: string;
  status: RequestStatus;
  /** Does the candidate want to proceed with the opportunity. */
  willing?: 'yes' | 'no';
  willingAt?: string;
  declineReason?: string;
  items: DocItem[];
  bgv: Referral;
  bgvStatus: ItemStatus;
  bgvNote?: string;
  dueDate: string;
  sentAt: string;
  sentBy: string;
  openedAt?: string;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  /** HR told the candidate their documents are verified / that something must be sent again. */
  verifiedMailAt?: string;
  fixMailAt?: string;
  waived?: { reason: string; by: string; at: string };
}

const KEY = 'gsit.hiring.docs.v1';
let state: DocRequest[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: DocRequest[] = [];

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as DocRequest[];
  } catch {
    state = [];
  }
}

function commit(next: DocRequest[]) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable: the change still applies for this visit */
  }
  listeners.forEach((l) => l());
}

export function useDocRequests(): DocRequest[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      load();
      return state;
    },
    () => EMPTY,
  );
}

export const getDocRequests = (): DocRequest[] => {
  load();
  return state;
};
export const docRequestFor = (list: DocRequest[], applicationId: string) => list.find((r) => r.applicationId === applicationId);
export const docRequestByToken = (list: DocRequest[], token: string) => (token ? list.find((r) => r.token === token) : undefined);
export const docsLink = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/offer/documents/${token}`;

const stamp = () => new Date().toISOString().slice(0, 19);
const newToken = () => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const HR_ROLES: ('HR' | 'Office Admin' | 'Super Admin')[] = ['HR', 'Office Admin', 'Super Admin'];

/* ---------------------------------------------------------------------- what is still missing */

const needed = (r: DocRequest) => r.items.filter((i) => i.required);
/** Items the candidate still has to send (nothing attached, or HR asked again). */
export const itemsToSend = (r: DocRequest) => needed(r).filter((i) => i.status === 'Pending' || i.status === 'Rejected');
export const referralComplete = (b: Referral) => !!(b.name.trim() && b.designation.trim() && b.phone.replace(/\D/g, '').length >= 7);
export const referralProblem = (b: Referral): string => {
  if (!b.name.trim() || !b.designation.trim() || !b.phone.trim()) return 'Add the contact person’s name, designation and number.';
  const digits = b.phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || !/^[+\d\s()-]+$/.test(b.phone.trim())) return 'Enter a valid contact number (7 to 15 digits).';
  return '';
};

/** Verified means every required document and the referral have been checked by HR. */
const allChecked = (r: DocRequest) => needed(r).every((i) => i.status === 'Verified') && r.bgvStatus === 'Verified';

/** Is the candidate cleared for an offer letter: documents verified, or HR waived the check. */
export const docsCleared = (list: DocRequest[], applicationId: string): boolean => {
  const r = docRequestFor(list, applicationId);
  return !!r && (r.status === 'Verified' || r.status === 'Waived');
};

/** A short line for lists: where this candidate's documents stand. */
export function docsLabel(r: DocRequest | undefined): { text: string; tone: 'none' | 'wait' | 'review' | 'ok' | 'bad' } {
  if (!r) return { text: 'Documents not requested', tone: 'none' };
  switch (r.status) {
    case 'Verified':
      return { text: 'Documents verified', tone: 'ok' };
    case 'Waived':
      return { text: 'Document check waived', tone: 'ok' };
    case 'Declined':
      return { text: 'Not interested', tone: 'bad' };
    case 'Submitted':
      return { text: 'Documents to verify', tone: 'review' };
    case 'Needs changes':
      return { text: 'Waiting for corrected documents', tone: 'wait' };
    default:
      return { text: 'Waiting for documents', tone: 'wait' };
  }
}

export const verifiedCount = (r: DocRequest) => needed(r).filter((i) => i.status === 'Verified').length;

/** What HR asked the candidate to send again, as a list for the email. */
export const issuesText = (r: DocRequest): string => {
  const lines = r.items.filter((i) => i.status === 'Rejected').map((i) => `- ${i.label}: ${i.note || 'please send a clearer or correct copy'}`);
  if (r.bgvStatus === 'Rejected') lines.push(`- Background verification referral: ${r.bgvNote || 'please check the contact details'}`);
  return lines.join('\n');
};

/** The checklist for the request email. */
export const slotList = (location: string): string =>
  slotsFor(location)
    .map((s) => `- ${s.label}${s.hint ? ` (${s.hint.charAt(0).toLowerCase()}${s.hint.slice(1)})` : ''}${s.required ? '' : ' [optional]'}`)
    .join('\n');

/** Verified papers by the document name the joining form uses, with the files that were received. */
export function receivedForJoining(r: DocRequest | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!r) return out;
  r.items.forEach((i) => {
    const slot = slotsFor(r.location).find((s) => s.key === i.key);
    if (slot?.joining && i.status === 'Verified' && i.files.length) out[slot.joining] = i.files.map((f) => f.name);
  });
  return out;
}

/* ---------------------------------------------------------------------- HR actions */

export interface RequestInput {
  applicationId: string;
  candidateId: string;
  name: string;
  email: string;
  location: string;
  jobTitle: string;
  company?: string;
  dueDate: string;
  token?: string;
}

/** Asks the candidate for their documents, or asks again (same link, same answers). */
export function requestDocs(input: RequestInput, by: string): DocRequest {
  load();
  const existing = state.find((r) => r.applicationId === input.applicationId);
  const at = stamp();
  if (existing) {
    const next: DocRequest = { ...existing, ...input, token: existing.token, sentAt: at, sentBy: by };
    commit(state.map((r) => (r.id === existing.id ? next : r)));
    logTask('Hiring', 'Documents requested again', input.name, `To ${input.email}`, { by });
    return next;
  }
  const req: DocRequest = {
    id: `dr-${Date.now().toString(36)}`,
    token: input.token ?? newToken(),
    applicationId: input.applicationId,
    candidateId: input.candidateId,
    name: input.name,
    email: input.email,
    location: input.location,
    jobTitle: input.jobTitle,
    company: input.company,
    status: 'Requested',
    items: slotsFor(input.location).map((s) => ({ key: s.key, label: s.label, hint: s.hint, required: s.required, files: [], status: 'Pending' as ItemStatus })),
    bgv: { name: '', designation: '', phone: '' },
    bgvStatus: 'Pending',
    dueDate: input.dueDate,
    sentAt: at,
    sentBy: by,
  };
  commit([req, ...state]);
  logTask('Hiring', 'Documents requested', input.name, `${input.jobTitle} · to ${input.email}`, { by });
  return req;
}

const sameFiles = (a: DocFile[], b: DocFile[]) => a.length === b.length && a.every((f, n) => f.name === b[n].name && f.size === b[n].size);
const update = (id: string, fn: (r: DocRequest) => DocRequest) => commit(state.map((r) => (r.id === id ? fn(r) : r)));

/** Once every required item is checked, the request is Verified; if anything was asked again it needs changes. */
function settle(r: DocRequest): DocRequest {
  if (r.status === 'Waived' || r.status === 'Declined') return r;
  if (allChecked(r)) return { ...r, status: 'Verified', verifiedAt: r.verifiedAt ?? stamp() };
  if (r.items.some((i) => i.status === 'Rejected') || r.bgvStatus === 'Rejected') return { ...r, status: 'Needs changes', verifiedAt: undefined };
  const sent = itemsToSend(r).length === 0 && referralComplete(r.bgv);
  return { ...r, status: sent ? 'Submitted' : r.status === 'Verified' ? 'Submitted' : r.status, verifiedAt: undefined };
}

export type Outcome = { ok: true } | { ok: false; error: string };

export function verifyItem(id: string, key: string, by: string): Outcome {
  load();
  const r = state.find((x) => x.id === id);
  const it = r?.items.find((i) => i.key === key);
  if (!r || !it) return { ok: false, error: 'That document is not on this request.' };
  if (!it.files.length) return { ok: false, error: 'Nothing has been attached for this document yet.' };
  update(id, (x) => settle({ ...x, items: x.items.map((i) => (i.key === key ? { ...i, status: 'Verified', note: undefined, verifiedBy: by, verifiedAt: stamp() } : i)) }));
  logTask('Hiring', 'Document verified', r.name, it.label, { by });
  return { ok: true };
}

export function rejectItem(id: string, key: string, note: string, by: string): Outcome {
  load();
  const r = state.find((x) => x.id === id);
  const it = r?.items.find((i) => i.key === key);
  if (!r || !it) return { ok: false, error: 'That document is not on this request.' };
  if (!note.trim()) return { ok: false, error: 'Tell the candidate what is wrong, so they can send the right copy.' };
  update(id, (x) => settle({ ...x, fixMailAt: undefined, items: x.items.map((i) => (i.key === key ? { ...i, status: 'Rejected', note: note.trim(), verifiedBy: undefined, verifiedAt: undefined } : i)) }));
  logTask('Hiring', 'Document sent back', r.name, `${it.label}: ${note.trim()}`, { by });
  return { ok: true };
}

export function verifyReferral(id: string, by: string): Outcome {
  load();
  const r = state.find((x) => x.id === id);
  if (!r) return { ok: false, error: 'Request not found.' };
  if (!referralComplete(r.bgv)) return { ok: false, error: 'The referral details have not been given yet.' };
  update(id, (x) => settle({ ...x, bgvStatus: 'Verified', bgvNote: undefined }));
  logTask('Hiring', 'Referral verified', r.name, `${r.bgv.name} · ${r.bgv.designation}`, { by });
  return { ok: true };
}

export function rejectReferral(id: string, note: string, by: string): Outcome {
  load();
  const r = state.find((x) => x.id === id);
  if (!r) return { ok: false, error: 'Request not found.' };
  if (!note.trim()) return { ok: false, error: 'Tell the candidate what to correct.' };
  update(id, (x) => settle({ ...x, fixMailAt: undefined, bgvStatus: 'Rejected', bgvNote: note.trim() }));
  logTask('Hiring', 'Referral sent back', r.name, note.trim(), { by });
  return { ok: true };
}

export function markDocsMailed(id: string, kind: 'verified' | 'fix'): void {
  load();
  update(id, (x) => (kind === 'verified' ? { ...x, verifiedMailAt: stamp() } : { ...x, fixMailAt: stamp() }));
}

/** HR skips the check (for example for an internal move), with a reason that is recorded. */
export function waiveDocs(applicationId: string, base: RequestInput, reason: string, by: string): Outcome {
  load();
  if (!reason.trim()) return { ok: false, error: 'Give a reason for skipping the document check.' };
  const r = state.find((x) => x.applicationId === applicationId) ?? requestDocs(base, by);
  update(r.id, (x) => ({ ...x, status: 'Waived', waived: { reason: reason.trim(), by, at: stamp() } }));
  logTask('Hiring', 'Document check waived', r.name, reason.trim(), { by });
  return { ok: true };
}

/** Undo a waiver or a decline so the documents can be collected after all. */
export function reopenDocs(id: string, by: string): void {
  load();
  const r = state.find((x) => x.id === id);
  if (!r) return;
  update(id, (x) => settle({ ...x, waived: undefined, status: 'Requested', willing: x.willing === 'no' ? undefined : x.willing, declineReason: undefined }));
  logTask('Hiring', 'Document request reopened', r.name, 'Documents will be collected again', { by });
}

/* ---------------------------------------------------------------------- candidate actions */

export interface DocsDraft {
  willing?: 'yes' | 'no';
  files: Record<string, DocFile[]>;
  bgv: Referral;
  declineReason?: string;
}

export function markDocsOpened(token: string): void {
  load();
  const r = state.find((x) => x.token === token);
  if (!r || r.status !== 'Requested' || r.openedAt) return;
  update(r.id, (x) => ({ ...x, status: 'Opened', openedAt: stamp() }));
  logTask('Hiring', 'Documents link opened', r.name, 'The candidate opened their link', { by: r.name });
}

/** Keeps what the candidate has chosen so far, so they can close the page and come back. */
export function saveDocsDraft(token: string, d: DocsDraft): void {
  load();
  const r = state.find((x) => x.token === token);
  if (!r || ['Verified', 'Declined', 'Waived'].includes(r.status)) return;
  update(r.id, (x) => ({
    ...x,
    willing: d.willing ?? x.willing,
    bgv: d.bgv,
    items: x.items.map((i) => {
      if (i.status === 'Verified') return i;
      const files = d.files[i.key] ?? i.files;
      if (sameFiles(files, i.files)) return i;
      // A new copy replaces what HR asked about; clearing everything leaves a sent-back item sent back.
      return { ...i, files, status: files.length ? 'Received' : i.status === 'Rejected' ? 'Rejected' : 'Pending' };
    }),
  }));
}

/** The candidate says they do not want to proceed. HR is told. */
export function declineDocs(token: string, reason: string): Outcome {
  load();
  const r = state.find((x) => x.token === token);
  if (!r) return { ok: false, error: 'This link is not valid any more.' };
  if (r.status === 'Verified') return { ok: false, error: 'Your documents were already verified.' };
  update(r.id, (x) => ({ ...x, status: 'Declined', willing: 'no', willingAt: stamp(), declineReason: reason.trim() }));
  logTask('Hiring', 'Candidate not proceeding', r.name, reason.trim() || 'No reason given', { by: r.name });
  pushNotice({ kind: 'hiring', tone: 'expired', title: `${r.name} does not want to proceed`, sub: `${r.jobTitle}${reason.trim() ? ` · ${reason.trim()}` : ''}`, href: `/hiring/candidates/${r.candidateId}`, toRoles: HR_ROLES, by: 'candidate' });
  return { ok: true };
}

export function submitDocs(token: string, d: DocsDraft): Outcome {
  load();
  const r = state.find((x) => x.token === token);
  if (!r) return { ok: false, error: 'This link is not valid any more.' };
  if (r.status === 'Verified' || r.status === 'Waived') return { ok: false, error: 'Nothing more is needed from you.' };
  if (r.status === 'Declined') return { ok: false, error: 'You chose not to proceed. Contact HR if you changed your mind.' };
  if (d.willing !== 'yes') return { ok: false, error: 'Please confirm that you want to proceed.' };
  const again = r.items.filter((i) => i.status === 'Rejected' && sameFiles(d.files[i.key] ?? i.files, i.files));
  if (again.length) return { ok: false, error: `Please replace: ${again.map((i) => i.label).join(', ')}.` };
  const merged = r.items.map((i) => {
    if (i.status === 'Verified') return i;
    const files = d.files[i.key] ?? i.files;
    return { ...i, files, status: (files.length ? 'Received' : 'Pending') as ItemStatus, note: files.length ? undefined : i.note };
  });
  const missing = merged.filter((i) => i.required && !i.files.length);
  if (missing.length) return { ok: false, error: `Please attach: ${missing.map((i) => i.label).join(', ')}.` };
  const bad = referralProblem(d.bgv);
  if (bad) return { ok: false, error: bad };
  const referralChanged = JSON.stringify(d.bgv) !== JSON.stringify(r.bgv);
  update(r.id, (x) => ({
    ...x,
    items: merged,
    bgv: d.bgv,
    bgvStatus: x.bgvStatus === 'Verified' && !referralChanged ? 'Verified' : 'Received',
    bgvNote: undefined,
    willing: 'yes',
    willingAt: x.willingAt ?? stamp(),
    status: 'Submitted',
    submittedAt: stamp(),
    fixMailAt: undefined,
  }));
  logTask('Hiring', 'Documents submitted', r.name, `${merged.filter((i) => i.files.length).length} document${merged.filter((i) => i.files.length).length === 1 ? '' : 's'} and the referral`, { by: r.name });
  pushNotice({ kind: 'hiring', tone: 'active', title: `${r.name} sent their documents`, sub: `${r.jobTitle} · ready to verify`, href: `/hiring/candidates/${r.candidateId}`, toRoles: HR_ROLES, by: 'candidate' });
  return { ok: true };
}
