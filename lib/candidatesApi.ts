import { api } from '@/lib/api';
import type { Exit, Source, Stage } from '@/lib/hiringTypes';
import type { PersonRef, Ref } from '@/lib/requisitionsApi';

/* Candidates and their applications from the backend (/api/hiring/jobs/:id/applications, /api/hiring/applications,
   /api/hiring/candidates). Everyone with Candidates → View reaches them; without full hiring access only the candidates
   on their own jobs (BR-HIR-022). Stages, exits and sources are codes on the wire; the maps below turn them into the
   labels the screens already use. Local development only — see API_ENABLED. */

export type ServerStage = 'APPLIED' | 'SCREENING' | 'TECHNICAL_INTERVIEW' | 'HR_INTERVIEW' | 'OFFER' | 'HIRED';
export type ServerExit = 'REJECTED' | 'WITHDRAWN' | 'ON_HOLD';
export type ServerSource = 'LINKEDIN' | 'NAUKRI' | 'BAYT' | 'INDEED' | 'EMPLOYEE_REFERRAL' | 'AGENCY' | 'CAREERS_PAGE' | 'DIRECT';
export type ServerRound = 'SCREENING_CALL' | 'TECHNICAL' | 'HR' | 'FINAL';

export const STAGE_OF: Record<ServerStage, Stage> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  HR_INTERVIEW: 'HR Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
};
export const STAGE_CODE = Object.fromEntries(Object.entries(STAGE_OF).map(([k, v]) => [v, k])) as Record<Stage, ServerStage>;

export const EXIT_OF: Record<ServerExit, Exit> = { REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn', ON_HOLD: 'On Hold' };
export const EXIT_CODE = Object.fromEntries(Object.entries(EXIT_OF).map(([k, v]) => [v, k])) as Record<Exit, ServerExit>;

export const SOURCE_OF: Record<ServerSource, Source> = {
  LINKEDIN: 'LinkedIn',
  NAUKRI: 'Naukri',
  BAYT: 'Bayt',
  INDEED: 'Indeed',
  EMPLOYEE_REFERRAL: 'Employee Referral',
  AGENCY: 'Agency',
  CAREERS_PAGE: 'Careers Page',
  DIRECT: 'Direct',
};
export const SOURCE_CODE = Object.fromEntries(Object.entries(SOURCE_OF).map(([k, v]) => [v, k])) as Record<Source, ServerSource>;

export const ROUND_OF: Record<ServerRound, string> = { SCREENING_CALL: 'Screening call', TECHNICAL: 'Technical Interview', HR: 'HR Interview', FINAL: 'Final round' };

/** A stage or exit code from a history line, as a label. */
export const stepLabel = (code: string | null) => (code ? (STAGE_OF[code as ServerStage] ?? EXIT_OF[code as ServerExit] ?? code) : '—');

/** An application without the candidate (on a candidate profile). */
export interface ServerApplicationSummary {
  id: string;
  job: { id: string; code: string; title: string };
  stage: ServerStage;
  exit: ServerExit | null;
  /** The stage they left from: Reopen returns there. */
  exitFrom: ServerStage | null;
  exitReason: string | null;
  exitNote: string | null;
  appliedAt: string;
  /** Last stage change ("days in stage"). */
  stageChangedAt: string;
}

/** The next scheduled interview, in the job location's local time. Null without Interviews → View. */
export interface ServerNextInterview {
  id: string;
  round: ServerRound;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  timezone: string;
  startsAt: string;
}

/** A pipeline row: the application with the candidate behind it. No salary. */
export interface ServerApplication extends ServerApplicationSummary {
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string;
    currentTitle: string;
    currentCompany: string;
    experienceYears: number;
    source: ServerSource;
    /** Days; 0 = immediate. */
    noticeDays: number;
    currentCity: string;
    tags: string[];
  };
  nextInterview: ServerNextInterview | null;
  /** Move, close out and reopen (Candidates → Edit). */
  viewer: { canEdit: boolean };
}

export interface StageChange {
  id: string;
  at: string;
  /** Name at the time, or "system". */
  by: string;
  /** Stage or exit code; null on the first line. */
  from: string | null;
  to: string;
  note: string | null;
}

export interface ServerApplicationDetail extends ServerApplication {
  /** Oldest first. */
  history: StageChange[];
}

export interface Money {
  amount: string;
  currency: string;
}

export interface ServerCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** `id` is the location id, e.g. Dubai. */
  location: Ref;
  currentCompany: string;
  currentTitle: string;
  experienceYears: number;
  source: ServerSource;
  agency: string | null;
  tags: string[];
  /** Newest first. */
  applications: ServerApplicationSummary[];
  createdAt: string;
}

export interface ServerCandidateDetail extends Omit<ServerCandidate, 'applications'> {
  currentCity: string;
  noticeDays: number;
  /** Only with salary access. */
  currentSalary?: Money | null;
  expectedSalary?: Money | null;
  visaStatus: string;
  referrer: PersonRef | null;
  /** File name only: no file is stored yet. */
  cvName: string | null;
  links: string;
  consentGivenAt: string;
  /** Newest first. */
  notes: { id: string; text: string; by: PersonRef; at: string }[];
  /** Newest first. */
  applications: (ServerApplicationSummary & { history: StageChange[] })[];
  createdBy: PersonRef;
  updatedAt: string;
  viewer: { canEdit: boolean; canAddApplication: boolean; canSeeSalary: boolean };
}

/** Someone already on file with the same email or phone, among the candidates the caller may see. */
export interface DuplicateCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
}

/** The counts on the Candidates page. */
export interface CandidateSummary {
  total: number;
  /** Candidates with an application still in the pipeline. */
  inPipeline: number;
  /** Candidates hired. */
  hired: number;
  /** Rejected applications, across all jobs. */
  rejected: number;
}

export type CandidateListQuery = {
  /** Name, email, phone, company, title, city or an exact tag. */
  q?: string;
  jobId?: string;
  /** Alone: an application still in the pipeline at this stage. */
  stage?: ServerStage;
  /** An application closed out this way. */
  exit?: ServerExit;
  source?: ServerSource;
  locationId?: string;
  page: number;
  /** At most 200. */
  pageSize: number;
};

/** An application as the candidate profile holds it, from a pipeline action's answer. */
export const asCandidateApplication = (d: ServerApplicationDetail): ServerApplicationSummary & { history: StageChange[] } => ({
  id: d.id,
  job: d.job,
  stage: d.stage,
  exit: d.exit,
  exitFrom: d.exitFrom,
  exitReason: d.exitReason,
  exitNote: d.exitNote,
  appliedAt: d.appliedAt,
  stageChangedAt: d.stageChangedAt,
  history: d.history,
});

export interface CreateCandidateBody {
  name: string;
  email: string;
  phone: string;
  /** An OPEN job: the candidate also applies to it and takes its location. */
  jobId?: string;
  /** Required without jobId. */
  locationId?: string;
  currentCity?: string;
  currentCompany?: string;
  currentTitle?: string;
  experienceYears: number;
  noticeDays?: number;
  /** Amounts like "9000"; only for callers who may see salary on that job. */
  currentSalary?: string;
  expectedSalary?: string;
  visaStatus?: string;
  source: ServerSource;
  /** An active employee; required for EMPLOYEE_REFERRAL. */
  referrerId?: string;
  /** Required for AGENCY. */
  agency?: string;
  cvName?: string;
  links?: string;
  tags?: string[];
  note?: string;
  consent: boolean;
}

const PAGE = 200; // the server's maximum

export const pipelineApi = {
  /** Every application on a job, closed out ones included. 404 when the job is not yours to see. */
  async all(jobId: string): Promise<ServerApplication[]> {
    const items: ServerApplication[] = [];
    for (let page = 1; ; page++) {
      const r = await api<{ items: ServerApplication[]; total: number }>('GET', `/hiring/jobs/${jobId}/applications`, undefined, { page, pageSize: PAGE });
      items.push(...r.items);
      if (items.length >= r.total || !r.items.length) return items;
    }
  },
  get: (id: string) => api<ServerApplicationDetail>('GET', `/hiring/applications/${id}`),
  /** Any stage but Hired (set by an accepted offer). Also brings a closed-out application back. */
  move: (id: string, stage: Exclude<ServerStage, 'HIRED'>, note?: string) => api<ServerApplicationDetail>('POST', `/hiring/applications/${id}/move`, { stage, note }),
  /** Rejecting needs one of REJECTION_REASONS. */
  exit: (id: string, exit: ServerExit, reason?: string, note?: string) => api<ServerApplicationDetail>('POST', `/hiring/applications/${id}/exit`, { exit, reason, note: note || undefined }),
  /** Back to the stage it left from. */
  reopen: (id: string) => api<ServerApplicationDetail>('POST', `/hiring/applications/${id}/reopen`),
};

export const candidatesApi = {
  /** Newest first, one page. Without full hiring access only candidates on your own jobs, with only those applications. */
  list: (query: CandidateListQuery) => api<{ items: ServerCandidate[]; total: number }>('GET', '/hiring/candidates', undefined, query),
  /** The Candidates page counts for a location, over the same candidates as the list. */
  summary: (locationId: string) => api<CandidateSummary>('GET', '/hiring/candidates/summary', undefined, { locationId }),
  /** 404 when it does not exist or is not yours to see. A view with salary is audited. */
  get: (id: string) => api<ServerCandidateDetail>('GET', `/hiring/candidates/${id}`),
  /** Notes cannot be changed or deleted afterwards. */
  addNote: (id: string, text: string) => api<ServerCandidateDetail>('POST', `/hiring/candidates/${id}/notes`, { text }),
  /** Same email, or the same last nine phone digits. */
  duplicates: (email: string, phone: string) => api<DuplicateCandidate[]>('GET', '/hiring/candidates/duplicates', undefined, { email: email || undefined, phone: phone || undefined }),
  /** 409 `candidate.duplicate` (with `details.candidateId` when the caller may see them) if already on file. */
  create: (body: CreateCandidateBody) => api<ServerCandidateDetail>('POST', '/hiring/candidates', body),
  /** Add someone already on file to an OPEN job. */
  apply: (candidateId: string, jobId: string) => api<ServerApplicationDetail>('POST', `/hiring/candidates/${candidateId}/applications`, { jobId }),
  /** Replaces the whole list (at most 20). */
  setTags: (id: string, tags: string[]) => api<ServerCandidateDetail>('PUT', `/hiring/candidates/${id}/tags`, { tags }),
};
