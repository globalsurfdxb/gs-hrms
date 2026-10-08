'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { EMPLOYEE_REQUESTS, REFERENCE_TODAY, employeeById } from '@/lib/data';
import { EmployeeRequest, Role } from '@/lib/types';
import { FIELDS, logAudit, saveEmployee, toForm } from '@/lib/employeeStore';
import { useApp } from '@/context/AppContext';

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
}

const RequestsContext = createContext<RequestsContextValue | null>(null);

const KEY = 'gsit.requestDecisions.v1';
type Decision = Pick<EmployeeRequest, 'status' | 'decidedBy' | 'decidedOn'>;

/** Decisions are kept so an approved change (saved on the employee record) never comes back as "pending" after a reload. */
function loadInitial(): EmployeeRequest[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Decision>;
    return EMPLOYEE_REQUESTS.map((r) => (saved[r.id] && r.status === 'Pending' ? { ...r, ...saved[r.id] } : r));
  } catch {
    return EMPLOYEE_REQUESTS;
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
