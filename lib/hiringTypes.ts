/* Types and fixed vocabularies for the Hiring Management module. Every record carries the location it belongs to
   (the id of a LocationDef) so each list and KPI can follow the UAE / India toggle. */

export const STAGES = ['Applied', 'Screening', 'Technical Interview', 'HR Interview', 'Offer', 'Hired'] as const;
export type Stage = (typeof STAGES)[number];

/** Where a candidate leaves the pipeline without being hired. */
export const EXITS = ['Rejected', 'Withdrawn', 'On Hold'] as const;
export type Exit = (typeof EXITS)[number];

export const REJECTION_REASONS = [
  'Skills mismatch',
  'Insufficient experience',
  'Salary expectations too high',
  'Failed technical interview',
  'Cultural fit',
  'Notice period too long',
  'Visa / work-permit constraint',
  'Better candidate selected',
  'Position closed or on hold',
  'No response from candidate',
  'Other',
];

export const SOURCES = ['LinkedIn', 'Naukri', 'Bayt', 'Indeed', 'Employee Referral', 'Agency', 'Careers Page', 'Direct'] as const;
export type Source = (typeof SOURCES)[number];

export const EMPLOYMENT_KINDS = ['Full-time', 'Contract', 'Intern'] as const;
export type EmploymentKind = (typeof EMPLOYMENT_KINDS)[number];

export const REQUISITION_REASONS = ['New role', 'Replacement'] as const;
export type RequisitionReason = (typeof REQUISITION_REASONS)[number];

export type RequisitionStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'On Hold' | 'Closed';
export type JobStatus = 'Draft' | 'Open' | 'On Hold' | 'Closed' | 'Filled';
export type InterviewMode = 'In-person' | 'Teams' | 'Phone';
export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled';
export type OfferStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Sent' | 'Accepted' | 'Declined' | 'Expired' | 'Revoked';

export const INTERVIEW_ROUNDS = ['Screening call', 'Technical Interview', 'HR Interview', 'Final round'];
export const INTERVIEW_MODES: InterviewMode[] = ['In-person', 'Teams', 'Phone'];

export interface ApprovalStep {
  label: string;
  status: 'Waiting' | 'Pending' | 'Approved' | 'Rejected';
  by?: string;
  at?: string;
  note?: string;
}

export interface Requisition {
  id: string;
  code: string;
  title: string;
  companyId: string;
  departmentId: string;
  department: string;
  location: string;
  positions: number;
  employmentType: EmploymentKind;
  reason: RequisitionReason;
  /** Employee being replaced (when reason is Replacement). */
  replacesId?: string;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  targetStart: string;
  hiringManagerId: string;
  justification: string;
  status: RequisitionStatus;
  approvals: ApprovalStep[];
  createdBy: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  code: string;
  requisitionId: string;
  title: string;
  companyId: string;
  departmentId: string;
  department: string;
  designationTitle: string;
  location: string;
  positions: number;
  filled: number;
  employmentType: EmploymentKind;
  description: string;
  skills: string[];
  expMin: number;
  expMax: number;
  qualifications: string;
  panelIds: string[];
  referralEligible: boolean;
  closingDate: string;
  status: JobStatus;
  hiringManagerId: string;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateNote {
  id: string;
  at: string;
  by: string;
  text: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Hiring location the candidate is being considered for. */
  location: string;
  currentCity: string;
  currentCompany: string;
  currentTitle: string;
  experienceYears: number;
  noticeDays: number;
  currentSalary?: number;
  expectedSalary?: number;
  currency: string;
  /** Visa / work-permit status (UAE roles). */
  visaStatus: string;
  source: Source;
  referrerId?: string;
  agency?: string;
  cvName?: string;
  links: string;
  tags: string[];
  notes: CandidateNote[];
  consent: { given: boolean; at: string };
  /** The employee record this candidate became. */
  employeeId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StageChange {
  id: string;
  at: string;
  by: string;
  from: string;
  to: string;
  note?: string;
}

/** A candidate applying to one job. A candidate may have several. */
export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  location: string;
  stage: Stage;
  exit?: Exit;
  /** The stage the candidate was in when they left the pipeline, so Reopen can put them back. */
  exitFrom?: Stage;
  exitReason?: string;
  exitNote?: string;
  history: StageChange[];
  appliedAt: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  location: string;
  round: string;
  date: string;
  time: string;
  durationMin: number;
  mode: InterviewMode;
  panelIds: string[];
  link: string;
  status: InterviewStatus;
  notes: string;
  scheduledBy: string;
  createdAt: string;
  rescheduled?: number;
}

export interface Offer {
  id: string;
  code: string;
  applicationId: string;
  location: string;
  status: OfferStatus;
  currency: string;
  /** Salary lines: UAE per month, India per year. */
  lines: { label: string; amount: number }[];
  total: number;
  joiningDate: string;
  probationMonths: number;
  expiryDate: string;
  overBudget: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
  /** Employee created by Start onboarding. */
  employeeId?: string;
}

export interface HiringState {
  requisitions: Requisition[];
  jobs: Job[];
  candidates: Candidate[];
  applications: Application[];
  interviews: Interview[];
  offers: Offer[];
}

export const UAE_OFFER_LINES = ['Basic', 'Housing', 'Transport', 'Other allowances'];
export const INDIA_OFFER_LINES = ['Basic', 'House Rent Allowance', 'Special Allowance', 'Other Allowance'];
