import { api } from '@/lib/api';
import type { JobStatus } from '@/lib/hiringTypes';
import type { PersonRef, Ref } from '@/lib/requisitionsApi';

/* Jobs from the backend (/api/hiring/jobs, /api/hiring/requisitions/:id/job, /api/hiring/recruiters, /api/hiring/people).
   Everyone with Jobs → View reaches them; without full hiring access only their own jobs (BR-HIR-022). Title, department,
   positions, budget and hiring manager come from the requisition. What the caller may do comes back in `viewer`.
   Local development only — see API_ENABLED. */

export type ServerJobStatus = 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED' | 'FILLED';
export type JobAction = 'open' | 'hold' | 'resume' | 'close' | 'reopen';

export interface ServerJob {
  id: string;
  code: string;
  requisition: { id: string; code: string };
  title: string;
  company: Ref;
  department: Ref;
  /** `name` is the designation title. */
  designation: Ref | null;
  location: Ref;
  positions: number;
  filled: number;
  employmentType: 'FULL_TIME' | 'CONTRACT' | 'INTERN';
  budgetMin: { amount: string; currency: string };
  budgetMax: { amount: string; currency: string };
  hiringManager: PersonRef;
  /** Null while the Talent Acquisition Manager has yet to choose (BR-HIR-021). */
  recruiter: PersonRef | null;
  taManager: PersonRef | null;
  description: string;
  skills: string[];
  expMin: number;
  expMax: number;
  qualifications: string;
  panel: PersonRef[];
  /** Everyone who applied, and those still in the pipeline (not exited, not hired). */
  candidates: { active: number; total: number };
  referralEligible: boolean;
  /** YYYY-MM-DD */
  closingDate: string;
  status: ServerJobStatus;
  createdBy: PersonRef;
  createdAt: string;
  updatedAt: string;
  viewer: { actions: JobAction[]; canChangeRecruiter: boolean };
}

export interface ServerJobDetail extends ServerJob {
  /** Oldest first. */
  history: { id: string; at: string; by: string; text: string }[];
}

/** Someone to pick: name, code and designation only. */
export interface PickPerson extends PersonRef {
  designation: string | null;
}

/** BR-HIR-021: who a new job goes to, and the Talent Acquisition team to choose from. */
export interface RecruiterPool {
  taManager: PersonRef | null;
  /** A job you create now goes to the TA Manager: leave the recruiter out. */
  handsOver: boolean;
  /** Empty when there is no TA Manager: then any active employee may be chosen. */
  pool: PickPerson[];
}

export interface CreateJobBody {
  designationId?: string;
  description: string;
  skills: string[];
  expMin: number;
  expMax: number;
  qualifications?: string;
  panelIds: string[];
  /** Leave out when the job is handed to the TA Manager. */
  recruiterId?: string;
  referralEligible: boolean;
  /** YYYY-MM-DD */
  closingDate: string;
  /** true = OPEN now; false = DRAFT. */
  publish: boolean;
}

export const JOB_STATUS: Record<ServerJobStatus, JobStatus> = { DRAFT: 'Draft', OPEN: 'Open', ON_HOLD: 'On Hold', CLOSED: 'Closed', FILLED: 'Filled' };

export const JOB_ACTION_LABEL: Record<JobAction, string> = {
  open: 'Open for applications',
  hold: 'Put on hold',
  resume: 'Resume',
  close: 'Close job',
  reopen: 'Reopen',
};

const PAGE = 100; // the server's maximum

export const jobsApi = {
  /** Every job the caller may see in a location. */
  async all(locationId: string): Promise<ServerJob[]> {
    const items: ServerJob[] = [];
    for (let page = 1; ; page++) {
      const r = await api<{ items: ServerJob[]; total: number }>('GET', '/hiring/jobs', undefined, { locationId, page, pageSize: PAGE });
      items.push(...r.items);
      if (items.length >= r.total || !r.items.length) return items;
    }
  },
  /** Every OPEN job the caller may see, in one location or all of them (to add a candidate to). */
  async open(locationId?: string): Promise<ServerJob[]> {
    const items: ServerJob[] = [];
    for (let page = 1; ; page++) {
      const r = await api<{ items: ServerJob[]; total: number }>('GET', '/hiring/jobs', undefined, { status: 'OPEN', locationId, page, pageSize: PAGE });
      items.push(...r.items);
      if (items.length >= r.total || !r.items.length) return items;
    }
  },
  /** 404 when it does not exist or is not yours to see. */
  get: (id: string) => api<ServerJobDetail>('GET', `/hiring/jobs/${id}`),
  create: (requisitionId: string, body: CreateJobBody) => api<ServerJobDetail>('POST', `/hiring/requisitions/${requisitionId}/job`, body),
  act: (id: string, action: JobAction) => api<ServerJobDetail>('POST', `/hiring/jobs/${id}/${action}`),
  setRecruiter: (id: string, recruiterId: string) => api<ServerJobDetail>('PUT', `/hiring/jobs/${id}/recruiter`, { recruiterId }),
  recruiters: () => api<RecruiterPool>('GET', '/hiring/recruiters'),
  people: () => api<PickPerson[]>('GET', '/hiring/people'),
};
