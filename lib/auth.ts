import { useSyncExternalStore } from 'react';
import { EMPLOYEES, PERSONAS } from '@/lib/data';
import { Employee, Role } from '@/lib/types';
import { chosenRole, logAudit } from '@/lib/employeeStore';
import { SYSTEM_ROLES, buildCatalog, defaultGrants } from '@/lib/access';
import { API_ENABLED, api, ApiError, onUnauthorized } from '@/lib/api';

/* The signed-in person comes from the backend session (httpOnly cookie): GET /api/auth/me on load, POST
   /api/auth/dev/password-login to sign in (development: the seeded demo accounts only), POST /api/auth/logout to sign
   out. The browser never stores the session itself. Sign-in, sign-out and failed attempts are audited by the server.
   Microsoft sign-in (/api/auth/login) replaces the password form once the Entra app registration exists.

   A build with no backend (API_ENABLED false, e.g. a hosted preview) keeps the old demo session instead: the signed-in
   work email in localStorage, any password accepted, the person and role taken from the demo data. */

const DEMO_KEY = 'gsit.auth';

const readDemo = (): string | null => {
  try {
    return localStorage.getItem(DEMO_KEY);
  } catch {
    return null;
  }
};

/** The demo-data session for an email, shaped like GET /api/auth/me. */
function demoUser(email: string | null): SessionUser | null {
  const acc = accountFor(email);
  if (!acc) return null;
  const e = acc.employee;
  return { employeeId: e.id, employeeCode: e.employeeCode, fullName: e.name, email: e.email, role: acc.role, locationId: e.location, companyId: e.company, permissions: defaultGrants(acc.role, buildCatalog()) };
}

const demoState = (): AuthState => {
  const user = demoUser(readDemo());
  return user ? { status: 'in', email: user.email, user } : OUT;
};

/** GET /api/auth/me */
export interface SessionUser {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  role: string;
  locationId: string;
  companyId: string;
  /** Granted permission keys (lib/access.ts format), enforced by the server on every call. */
  permissions: string[];
}

export interface AuthState {
  status: 'loading' | 'in' | 'out';
  email: string | null;
  user: SessionUser | null;
}

const SERVER: AuthState = { status: 'loading', email: null, user: null };
const OUT: AuthState = { status: 'out', email: null, user: null };

let state: AuthState = SERVER;
const listeners = new Set<() => void>();
const set = (next: AuthState) => {
  state = next;
  listeners.forEach((l) => l());
};

let loading: Promise<void> | null = null;

/** Re-read the session from the server. Anything but a valid session counts as signed out. */
export function refreshSession(): Promise<void> {
  if (!API_ENABLED) {
    set(demoState());
    return Promise.resolve();
  }
  loading ??=api<SessionUser>('GET', '/auth/me')
    .then((user) => set({ status: 'in', email: user.email, user }))
    .catch(() => set(OUT))
    .finally(() => {
      loading = null;
    });
  return loading;
}

// The session ended while the app was open (idle timeout, role changed, signed out elsewhere): back to sign-in.
onUnauthorized(() => {
  if (state.status === 'in') set(OUT);
});

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  if (state.status === 'loading') void refreshSession();
  return () => listeners.delete(cb);
};

export const useAuth = (): AuthState => useSyncExternalStore(subscribe, () => state, () => SERVER);

/** Signs in with the email + password form. Rejects with an ApiError: 401 auth.invalid_credentials, 403 no access,
    404 when the backend's dev sign-in is off. */
export async function signIn(email: string, password: string): Promise<void> {
  if (!API_ENABLED) return demoSignIn(email.trim().toLowerCase());
  await api('POST', '/auth/dev/password-login', { email: await backendEmail(email.trim()), password });
  await refreshSession();
}

/* The form takes the demo accounts as the screens show them (lib/data.ts, e.g. muneer@gs-it.ae). The backend seeds the
   same people under fictional names and …@hrms.local emails, so the email is swapped for the backend account with
   the same employee code. Any other email is sent as typed (and is refused unless it is a backend demo account). */
async function backendEmail(email: string): Promise<string> {
  const person = EMPLOYEES.find((e) => e.email.toLowerCase() === email.toLowerCase());
  if (!person) return email;
  const demo = (await demoAccounts()).find((a) => a.employeeCode === person.employeeCode);
  return demo?.email ?? email;
}

/** No backend: any demo-data employee gets in with any password; unknown or deactivated accounts are refused. */
function demoSignIn(email: string) {
  const acc = accountFor(email);
  const fail = (status: number, reason: string, message: string) => {
    logAudit({ employeeId: `security:${email}`, field: 'Sign-in failed', to: reason, changedBy: email || 'Unknown', module: 'Security' });
    throw new ApiError(status, 'auth.demo_refused', message);
  };
  if (!acc) return fail(401, 'No account with this email', 'Email or password is incorrect');
  if (acc.employee.employmentStatus === 'Inactive') return fail(403, 'Deactivated account', 'This account has been deactivated');
  try {
    localStorage.setItem(DEMO_KEY, email);
  } catch {
    /* storage unavailable — the session just won't persist */
  }
  logAudit({ employeeId: acc.employee.id, field: 'Signed in', to: 'Demo session', changedBy: acc.employee.name, module: 'Security' });
  set(demoState());
}

export async function signOut(): Promise<void> {
  if (!API_ENABLED) {
    const acc = accountOf(state.user);
    if (acc) logAudit({ employeeId: acc.employee.id, field: 'Signed out', to: 'Session ended', changedBy: acc.employee.name, module: 'Security' });
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
    return set(OUT);
  }
  try {
    await api('POST', '/auth/logout');
  } catch (e) {
    // Already signed out on the server (401) is fine; anything else is still a local sign-out.
    if (!(e instanceof ApiError)) console.warn('[auth] sign-out request failed:', e);
  }
  set(OUT);
}

/** Demo accounts for the sign-in page (development only; 404 → none). */
export async function demoAccounts(): Promise<{ employeeCode: string; fullName: string; email: string; role: string }[]> {
  if (!API_ENABLED) return [];
  try {
    return await api('GET', '/auth/dev/personas');
  } catch {
    return [];
  }
}

export interface Account {
  employee: Employee;
  role: Role;
}

/** The signed-in person as the screens know them: the employee record (screens not yet on the API read the mock
    data, whose ids are employee codes) and the role from the server. A role the screens do not know yet (a custom
    role) is treated as Employee — least access; the server still enforces the real grants. */
export function accountOf(user: SessionUser | null): Account | null {
  if (!user) return null;
  const employee = EMPLOYEES.find((e) => e.employeeCode === user.employeeCode || e.id === user.employeeCode);
  if (!employee) return null;
  const role = (SYSTEM_ROLES as string[]).includes(user.role) ? (user.role as Role) : 'Employee';
  return { employee, role };
}

export const useAccount = (): Account | null => accountOf(useAuth().user);

/** Who is signed in right now, for anything that has to record the person behind an action. */
export function currentActor(): { name: string; role: Role | null } {
  const acc = accountOf(state.user);
  return { name: acc?.employee.name ?? state.user?.fullName ?? 'System', role: acc?.role ?? null };
}

/** The role an employee's account carries in the mock data (directory pages). Not the signed-in person — that is
    `useAccount()`. */
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
