import { api } from '@/lib/api';
import type { EmploymentKind, RequisitionReason, RequisitionStatus } from '@/lib/hiringTypes';

/* Requisitions from the backend (/api/hiring/requisitions/*). The server decides who sees what (BR-HIR-022) and what
   the caller may do now (`viewer`), so the screens show buttons from `viewer` instead of repeating the rules. Enums come
   back UPPER_SNAKE and are mapped to the labels the rest of the app uses. Money is a decimal string ("9000.00").
   Local development only — see API_ENABLED. */

export interface Ref {
  id: string;
  name: string;
}

export interface PersonRef {
  id: string;
  employeeCode: string;
  name: string;
}

export type ServerReqStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ON_HOLD' | 'CLOSED';
type ServerEmploymentType = 'FULL_TIME' | 'CONTRACT' | 'INTERN';
type ServerReason = 'NEW_ROLE' | 'REPLACEMENT';
export type StepLabel = 'HIRING_MANAGER' | 'HR' | 'MANAGEMENT';

export interface ServerStep {
  position: number;
  label: StepLabel;
  /** PENDING = waiting for a decision now. */
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy: PersonRef | null;
  decidedAt: string | null;
  note: string | null;
}

export interface ServerRequisition {
  id: string;
  code: string;
  title: string;
  company: Ref;
  department: Ref;
  /** `name` is the designation title. */
  designation: Ref | null;
  /** A new title asked for (BR-HIR-020). Once approved `designation` is set too, and this shows it was new. */
  proposedDesignation: string | null;
  location: Ref;
  positions: number;
  employmentType: ServerEmploymentType;
  reason: ServerReason;
  replaces: PersonRef | null;
  budgetMin: { amount: string; currency: string };
  budgetMax: { amount: string; currency: string };
  /** YYYY-MM-DD */
  targetStart: string;
  hiringManager: PersonRef;
  justification: string;
  status: ServerReqStatus;
  /** Empty until first submitted. */
  steps: ServerStep[];
  job: { id: string; code: string; status: string } | null;
  createdBy: PersonRef;
  createdAt: string;
  updatedAt: string;
  viewer: { canEdit: boolean; canDecide: boolean; canManage: boolean; canCreateJob: boolean };
}

/** What the form may offer (BR-HIR-019). */
export interface RequisitionScope {
  /** true = own departments only, and the caller is the hiring manager. */
  restricted: boolean;
  hiringManager: PersonRef | null;
  /** Who may be chosen as hiring manager when not restricted. */
  hiringManagers: PersonRef[];
  departments: { id: string; name: string; company: Ref; locations: Ref[] }[];
  defaultLocationId: string | null;
}

export interface ReplaceablePerson extends PersonRef {
  designation: string | null;
  status: 'ONBOARDING' | 'ACTIVE' | 'OFFBOARDING' | 'INACTIVE';
}

/** POST body; PATCH takes any part of it. */
export interface RequisitionBody {
  title: string;
  companyId: string;
  departmentId: string;
  designationId?: string | null;
  proposedDesignation?: string | null;
  locationId: string;
  positions: number;
  employmentType: ServerEmploymentType;
  reason: ServerReason;
  replacesEmployeeId?: string;
  budgetMin: string;
  budgetMax: string;
  /** YYYY-MM-DD */
  targetStart: string;
  /** Leave out when restricted: you are the hiring manager. */
  hiringManagerId?: string;
  justification: string;
}

/* ------------------------------------------------------------------ labels */

export const REQ_STATUS: Record<ServerReqStatus, RequisitionStatus> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ON_HOLD: 'On Hold',
  CLOSED: 'Closed',
};
export const STATUS_OF: Record<RequisitionStatus, ServerReqStatus> = {
  Draft: 'DRAFT',
  'Pending Approval': 'PENDING_APPROVAL',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  'On Hold': 'ON_HOLD',
  Closed: 'CLOSED',
};
export const EMPLOYMENT: Record<ServerEmploymentType, EmploymentKind> = { FULL_TIME: 'Full-time', CONTRACT: 'Contract', INTERN: 'Intern' };
export const EMPLOYMENT_OF: Record<EmploymentKind, ServerEmploymentType> = { 'Full-time': 'FULL_TIME', Contract: 'CONTRACT', Intern: 'INTERN' };
export const REASON: Record<ServerReason, RequisitionReason> = { NEW_ROLE: 'New role', REPLACEMENT: 'Replacement' };
export const REASON_OF: Record<RequisitionReason, ServerReason> = { 'New role': 'NEW_ROLE', Replacement: 'REPLACEMENT' };
export const STEP_LABEL: Record<StepLabel, string> = { HIRING_MANAGER: 'Hiring Manager', HR: 'HR', MANAGEMENT: 'Management' };

/** The designation as the screens show it: the title and whether it is (or was) a new one. */
export const designationOf = (r: ServerRequisition) =>
  r.designation ? { title: r.designation.name, isNew: !!r.proposedDesignation } : r.proposedDesignation ? { title: r.proposedDesignation, isNew: true } : null;

/** "9000.00" → "AED 9,000"; keeps fils / paise when there are any. */
export const amount = (m: { amount: string; currency: string }) => {
  const n = Number(m.amount);
  return `${m.currency} ${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

/** Same limits as the server. */
export const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;

/* ------------------------------------------------------------------ calls */

const BASE = '/hiring/requisitions';
const PAGE = 100; // the server's maximum

export const requisitionsApi = {
  /** Every requisition the caller may see in a location (a few hundred at most). */
  async all(locationId: string): Promise<ServerRequisition[]> {
    const items: ServerRequisition[] = [];
    for (let page = 1; ; page++) {
      const r = await api<{ items: ServerRequisition[]; total: number }>('GET', BASE, undefined, { locationId, page, pageSize: PAGE });
      items.push(...r.items);
      if (items.length >= r.total || !r.items.length) return items;
    }
  },
  /** 404 when it does not exist or is not yours to see. */
  get: (id: string) => api<ServerRequisition>('GET', `${BASE}/${id}`),
  scope: () => api<RequisitionScope>('GET', `${BASE}/scope`),
  departmentPeople: (departmentId: string) => api<ReplaceablePerson[]>('GET', `${BASE}/departments/${departmentId}/people`),

  create: (body: RequisitionBody & { submit: boolean }) => api<ServerRequisition>('POST', BASE, body),
  update: (id: string, body: Partial<RequisitionBody>) => api<ServerRequisition>('PATCH', `${BASE}/${id}`, body),
  submit: (id: string) => api<ServerRequisition>('POST', `${BASE}/${id}/submit`),
  decide: (id: string, decision: 'APPROVED' | 'REJECTED', note?: string) => api<ServerRequisition>('POST', `${BASE}/${id}/decision`, { decision, note: note || undefined }),
  hold: (id: string) => api<ServerRequisition>('POST', `${BASE}/${id}/hold`),
  resume: (id: string) => api<ServerRequisition>('POST', `${BASE}/${id}/resume`),
  close: (id: string) => api<ServerRequisition>('POST', `${BASE}/${id}/close`),
};
