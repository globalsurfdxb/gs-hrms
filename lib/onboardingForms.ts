import { useSyncExternalStore } from 'react';
import { logTask } from '@/lib/activity';
import { pushNotice } from '@/lib/notifications';
import type { EducationRow, EmergencyRow, ExperienceRow } from '@/lib/employeeStore';

/* The joining form. Once an offer is accepted, HR sends the new joiner a link by email. They open it without signing
   in, fill in their own details (personal, identity, bank, emergency contacts, education, experience, documents) and
   submit. When HR starts onboarding, the wizard opens already filled in from what they entered.
   With no server yet, the link only opens in the browser that holds this data, and uploaded files are recorded by
   name only. */

export interface JoiningForm {
  dob: string;
  /** Other fields, keyed like the employee record (gender, nationality, currentAddress, bankName, aadhaar…). */
  fv: Record<string, string>;
  emA: EmergencyRow[];
  emB: EmergencyRow[];
  edu: EducationRow[];
  exp: ExperienceRow[];
  passportExpiry: string;
  /** Document name → file name chosen. */
  docs: Record<string, string>;
  declared: boolean;
}

export const blankJoiningForm = (): JoiningForm => ({
  dob: '',
  fv: { maritalStatus: 'Single' },
  emA: [{ group: '', name: '', relationship: '', mobile: '' }],
  emB: [{ group: '', name: '', relationship: '', mobile: '' }],
  edu: [{ qualification: '', institution: '', course: '', field: '', startYear: '', endYear: '' }],
  exp: [],
  passportExpiry: '',
  docs: {},
  declared: false,
});

export interface OnboardingInvite {
  id: string;
  token: string;
  offerId: string;
  candidateId: string;
  name: string;
  /** Work location id ('Dubai' or 'Kochi'): it decides which identity and bank fields are asked. */
  location: string;
  /** The company mailbox the form was sent to, and the personal address it was copied to. */
  toWork: string;
  toPersonal: string;
  joiningDate: string;
  dueDate: string;
  status: 'Sent' | 'Opened' | 'Submitted';
  sentAt: string;
  sentBy: string;
  openedAt?: string;
  submittedAt?: string;
  /** What the joiner has entered so far (a saved draft until they submit). */
  data?: JoiningForm;
  /** HR copied the details into the onboarding wizard. */
  importedAt?: string;
}

const KEY = 'gsit.onboardingForms.v1';
let state: OnboardingInvite[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: OnboardingInvite[] = [];

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as OnboardingInvite[];
  } catch {
    state = [];
  }
}

function commit(next: OnboardingInvite[]) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable: the change still applies for this visit */
  }
  listeners.forEach((l) => l());
}

export function useInvites(): OnboardingInvite[] {
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

export const getInvites = (): OnboardingInvite[] => {
  load();
  return state;
};
export const inviteForOffer = (list: OnboardingInvite[], offerId: string) => list.find((i) => i.offerId === offerId);
export const inviteByToken = (list: OnboardingInvite[], token: string) => (token ? list.find((i) => i.token === token) : undefined);
export const formLink = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/onboarding/form/${token}`;

const stamp = () => new Date().toISOString().slice(0, 19);
export const newToken = () => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface InviteInput {
  offerId: string;
  candidateId: string;
  name: string;
  location: string;
  toWork: string;
  toPersonal: string;
  joiningDate: string;
  dueDate: string;
  /** The link's token, when it was already shown in the email preview. */
  token?: string;
}

/** Creates the joining form for an accepted offer, or sends it again (same link, same saved answers). */
export function sendInvite(input: InviteInput, by: string): OnboardingInvite {
  load();
  const existing = state.find((i) => i.offerId === input.offerId);
  const at = stamp();
  const invite: OnboardingInvite = existing
    ? { ...existing, ...input, token: existing.token, sentAt: at, sentBy: by }
    : { id: `obf-${Date.now().toString(36)}`, ...input, token: input.token ?? newToken(), status: 'Sent', sentAt: at, sentBy: by };
  commit(existing ? state.map((i) => (i.id === existing.id ? invite : i)) : [invite, ...state]);
  logTask('Onboarding', existing ? 'Joining form sent again' : 'Joining form sent', input.name, `To ${input.toWork}${input.toPersonal ? ` (copy to ${input.toPersonal})` : ''}`, { by });
  return invite;
}

/** The joiner opened the link. Recorded once; HR is told. */
export function markOpened(token: string): void {
  load();
  const i = state.find((x) => x.token === token);
  if (!i || i.status !== 'Sent') return;
  commit(state.map((x) => (x.id === i.id ? { ...x, status: 'Opened', openedAt: stamp() } : x)));
  logTask('Onboarding', 'Joining form opened', i.name, 'The joiner opened their link', { by: i.name });
}

/** Keeps what the joiner has typed, so they can close the page and come back. */
export function saveFormDraft(token: string, data: JoiningForm): void {
  load();
  const i = state.find((x) => x.token === token);
  if (!i || i.status === 'Submitted') return;
  commit(state.map((x) => (x.id === i.id ? { ...x, data } : x)));
}

export type FormResult = { ok: true } | { ok: false; error: string };

export function submitForm(token: string, data: JoiningForm): FormResult {
  load();
  const i = state.find((x) => x.token === token);
  if (!i) return { ok: false, error: 'This link is not valid any more.' };
  if (i.status === 'Submitted') return { ok: false, error: 'This form was already submitted.' };
  commit(state.map((x) => (x.id === i.id ? { ...x, data, status: 'Submitted', submittedAt: stamp() } : x)));
  logTask('Onboarding', 'Joining form submitted', i.name, 'The joiner submitted their details', { by: i.name });
  pushNotice({ kind: 'hiring', tone: 'active', title: `${i.name} submitted their joining form`, sub: 'Review the details and start onboarding', href: `/onboarding?hire=${i.offerId}`, toRoles: ['HR', 'Office Admin', 'Super Admin'], by: 'joiner' });
  return { ok: true };
}

/** HR used the details to fill in the onboarding wizard. */
export function markImported(offerId: string): void {
  load();
  const i = state.find((x) => x.offerId === offerId);
  if (!i || i.importedAt) return;
  commit(state.map((x) => (x.id === i.id ? { ...x, importedAt: stamp() } : x)));
}
