'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { EMPLOYEE_REQUESTS, REFERENCE_TODAY, employeeById } from '@/lib/data';
import { EmployeeRequest, Role } from '@/lib/types';
import { FIELDS, logAudit, saveEmployee, toForm } from '@/lib/employeeStore';
import { useApp } from '@/context/AppContext';
import { logTask } from '@/lib/activity';
import { pushNotice } from '@/lib/notifications';

/** Who may decide a request. Nobody decides their own; management decides any; a manager decides a request routed to them. */
export function canDecideRequest(role: Role, meId: string, r: EmployeeRequest): boolean {
  if (r.employeeId === meId) return false;
  const e = employeeById(r.employeeId);
  if (!e) return false;
  if (role === 'Super Admin' || role === 'HR') return true;
  if (role === 'Office Admin') return r.type !== 'Bank Detail Update';
  return r.routedTo === 'Manager' && e.reportingManagerId === meId;
}

export interface ProposedChange {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** The record changes a request would make: the employee's current value next to the proposed one. */
export function proposedChanges(r: EmployeeRequest): ProposedChange[] {
  const e = employeeById(r.employeeId);
  if (!e || !r.changes) return [];
  const cur = toForm(e).v;
  return Object.entries(r.changes).map(([key, to]) => ({ key, label: FIELDS.find((f) => f.key === key)?.label ?? key, from: cur[key] || '—', to }));
}

interface RequestsContextValue {
  requests: EmployeeRequest[];
  /** Approve or reject a pending request. Ignored when the signed-in user may not decide it (see canAct). */
  act: (id: string, status: EmployeeRequest['status']) => void;
  /** Whether the signed-in user may decide this request (never their own). */
  canAct: (r: EmployeeRequest) => boolean;
  /** Raise a new request for the signed-in person. Returns its id. */
  raise: (input: NewRequest) => string;
}

export interface NewRequest {
  type: EmployeeRequest['type'];
  details: string;
  changes?: Record<string, string>;
}

/** Where each kind of request goes: personal-data changes with money or identity behind them, and letters, go to HR; a
    simple update to your own details goes to your manager. */
export const routeFor = (type: EmployeeRequest['type']): EmployeeRequest['routedTo'] => (type === 'Information Update' ? 'Manager' : 'HR');

const RequestsContext = createContext<RequestsContextValue | null>(null);

const KEY = 'gsit.requestDecisions.v1';
const RAISED_KEY = 'gsit.requests.raised.v1';
type Decision = Pick<EmployeeRequest, 'status' | 'decidedBy' | 'decidedOn'>;

/** Decisions are kept so an approved change (saved on the employee record) never comes back as "pending" after a reload. */
function loadInitial(): EmployeeRequest[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Decision>;
    const raised = JSON.parse(localStorage.getItem(RAISED_KEY) ?? '[]') as EmployeeRequest[];
    return [...raised, ...EMPLOYEE_REQUESTS].map((r) => (saved[r.id] && r.status === 'Pending' ? { ...r, ...saved[r.id] } : r));
  } catch {
    return EMPLOYEE_REQUESTS;
  }
}

/** Requests raised in the app are kept so they survive a reload (the seed requests come from the sample data). */
function rememberRaised(r: EmployeeRequest) {
  try {
    const raised = JSON.parse(localStorage.getItem(RAISED_KEY) ?? '[]') as EmployeeRequest[];
    localStorage.setItem(RAISED_KEY, JSON.stringify([r, ...raised]));
  } catch {
    /* storage unavailable: the request still exists for this visit */
  }
}

function remember(id: string, d: Decision) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Decision>;
    saved[id] = d;
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable — the decision still applies for this visit */
  }
}

export function RequestsProvider({ children }: { children: React.ReactNode }) {
  const { role, currentEmployeeId } = useApp();
  const [requests, setRequests] = useState<EmployeeRequest[]>(loadInitial);

  const value = useMemo<RequestsContextValue>(
    () => ({
      requests,
      canAct: (r) => canDecideRequest(role, currentEmployeeId, r),
      raise: (input) => {
        const r: EmployeeRequest = { id: `req-${Date.now()}`, employeeId: currentEmployeeId, type: input.type, details: input.details, status: 'Pending', raisedOn: REFERENCE_TODAY, raisedAt: new Date().toISOString(), routedTo: routeFor(input.type), changes: input.changes };
        rememberRaised(r);
        logTask('Requests', 'Request raised', r.id, `${r.type}: ${r.details}`, { employeeId: currentEmployeeId, by: employeeById(currentEmployeeId)?.name ?? role });
        const emp = employeeById(currentEmployeeId);
        const base = { id: `rq-act-${r.id}`, kind: 'request' as const, tone: 'pending' as const, title: `${emp?.name ?? 'Someone'} · ${r.type} needs your decision`, sub: r.details, by: currentEmployeeId };
        // HR and the Super Admin decide anything; a manager decides requests routed to them.
        pushNotice({ ...base, href: '/requests', toRoles: r.routedTo === 'HR' ? ['HR', 'Super Admin'] : ['Super Admin'] });
        if (r.routedTo === 'Manager' && emp?.reportingManagerId) pushNotice({ ...base, id: `${base.id}~mgr`, href: '/team/requests', toIds: [emp.reportingManagerId] });
        setRequests((prev) => [r, ...prev]);
        return r.id;
      },
      act: (id, status) => {
        const r = requests.find((x) => x.id === id);
        if (!r || r.status !== 'Pending' || !canDecideRequest(role, currentEmployeeId, r)) return;
        const by = employeeById(currentEmployeeId)?.name ?? role;
        // A sensitive request changes the employee record only now, on approval; a rejection leaves the record untouched.
        const emp = employeeById(r.employeeId);
        if (status === 'Approved' && r.changes && emp) {
          const form = toForm(emp);
          Object.entries(r.changes).forEach(([k, v]) => {
            form.v[k] = v;
          });
          saveEmployee(emp.id, form, by);
        }
        const d: Decision = { status, decidedBy: by, decidedOn: REFERENCE_TODAY };
        remember(id, d);
        pushNotice({ kind: 'request', tone: status === 'Approved' ? 'active' : 'expired', title: `Your ${r.type.toLowerCase()} was ${status === 'Approved' ? 'approved' : 'rejected'}`, sub: `Decided by ${by}${r.details ? `: ${r.details}` : ''}`, href: '/my/requests', toIds: [r.employeeId], by: currentEmployeeId });
        logAudit({ employeeId: `request:${id}`, field: `Request ${status === 'Approved' ? 'approved' : 'rejected'}`, from: 'Pending', to: status, changedBy: by, module: 'Approvals' });
        setRequests((prev) => prev.map((x) => (x.id === id ? { ...x, ...d } : x)));
      },
    }),
    [requests, role, currentEmployeeId]
  );

  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

export function useRequests() {
  const ctx = useContext(RequestsContext);
  if (!ctx) throw new Error('useRequests must be used within RequestsProvider');
  return ctx;
}
