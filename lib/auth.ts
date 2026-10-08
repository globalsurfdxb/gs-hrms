import { useSyncExternalStore } from 'react';
import { EMPLOYEES, PERSONAS } from '@/lib/data';
import { Employee, Role } from '@/lib/types';
import { chosenRole } from '@/lib/employeeStore';

/* Front-end session for the sign-in page. There is no sign-in backend yet, so a session is just the signed-in work
   email, kept in localStorage ("Keep me signed in") or sessionStorage. The employee and role are derived from it. */

const KEY = 'gsit.auth';

export interface AuthState {
  status: 'loading' | 'in' | 'out';
  email: string | null;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

let cache: { raw: string | null; snap: AuthState } | null = null;
const getSnapshot = (): AuthState => {
  const stored = read();
  // A session for an email that no longer maps to an employee is not a session.
  const raw = stored && EMPLOYEES.some((e) => e.email.toLowerCase() === stored.toLowerCase()) ? stored : null;
  if (!cache || cache.raw !== raw) cache = { raw, snap: { status: raw ? 'in' : 'out', email: raw } };
  return cache.snap;
};
const SERVER: AuthState = { status: 'loading', email: null };

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
};

export const useAuth = (): AuthState => useSyncExternalStore(subscribe, getSnapshot, () => SERVER);

export function signIn(email: string, remember: boolean) {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, email.trim().toLowerCase());
  } catch {
    /* storage unavailable — the session just won't persist */
  }
  notify();
}

export function signOut() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export interface Account {
  employee: Employee;
  role: Role;
}

/** The employee behind a work email, and the role their account carries. */
export function accountFor(email: string | null): Account | null {
  if (!email) return null;
  const employee = EMPLOYEES.find((e) => e.email.toLowerCase() === email.trim().toLowerCase());
  if (!employee) return null;
  const persona = (Object.entries(PERSONAS) as [Role, { employeeId: string }][]).find(([, p]) => p.employeeId === employee.id);
  // People created through onboarding carry the role chosen in the wizard.
  return { employee, role: persona ? persona[0] : (chosenRole(employee.id) ?? 'Employee') };
}

/** Only allow same-site relative redirects after sign-in. */
export const safeNext = (next: string | null | undefined) => (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard');
