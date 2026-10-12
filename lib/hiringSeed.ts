import { addDays, todayISO } from '@/lib/dates';
import {
  Application,
  ApprovalStep,
  Candidate,
  HiringState,
  Interview,
  Job,
  Offer,
  Requisition,
  RequisitionStatus,
  Source,
  Stage,
  STAGES,
  StageChange,
} from '@/lib/hiringTypes';

/* Sample hiring data, written around today so ages, deadlines and "this week" read naturally. */

const day = (n: number) => addDays(todayISO(), n);
const at = (n: number, time = '10:00') => `${day(n)}T${time}:00`;

const CHAIN = ['Hiring Manager', 'HR', 'Management'];
const NAMES: Record<string, string> = { 'GS-058': 'Harsha', 'GS-119': 'Aslima', 'GS-120': 'Muneer', 'GS-101': 'Navami', 'GS-076': 'Daniel Costa' };

function approvals(status: RequisitionStatus, createdN: number, hm: string): ApprovalStep[] {
  const who = [NAMES[hm] ?? hm, 'Aslima', 'Muneer'];
  if (status === 'Draft') return CHAIN.map((label) => ({ label, status: 'Waiting' }));
  if (status === 'Pending Approval')
    return CHAIN.map((label, i) => (i === 0 ? { label, status: 'Approved', by: who[0], at: at(createdN + 1) } : i === 1 ? { label, status: 'Pending' } : { label, status: 'Waiting' }));
  if (status === 'Rejected')
    return CHAIN.map((label, i) => (i === 0 ? { label, status: 'Approved', by: who[0], at: at(createdN + 1) } : i === 1 ? { label, status: 'Approved', by: who[1], at: at(createdN + 2) } : { label, status: 'Rejected', by: who[2], at: at(createdN + 4), note: 'Hold off until the next budget review.' }));
  return CHAIN.map((label, i) => ({ label, status: 'Approved' as const, by: who[i], at: at(createdN + 1 + i) }));
}

function req(n: number, p: Omit<Requisition, 'id' | 'code' | 'approvals' | 'createdAt' | 'updatedAt' | 'createdById'> & { createdN: number }): Requisition {
  const { createdN, ...rest } = p;
  return { id: `req-${n}`, code: `REQ-${String(n).padStart(4, '0')}`, createdById: p.hiringManagerId, ...rest, approvals: approvals(p.status, createdN, p.hiringManagerId), createdAt: at(createdN), updatedAt: at(createdN + 3) };
}

const REQUISITIONS: Requisition[] = [
  req(1, { createdN: -42, title: 'Network Engineer', companyId: 'co-1', departmentId: 'dep-4', department: 'Network Engineering', location: 'Dubai', positions: 2, employmentType: 'Full-time', reason: 'New role', budgetMin: 9000, budgetMax: 14000, currency: 'AED', targetStart: day(40), hiringManagerId: 'GS-058', justification: 'Two new managed-network contracts go live next quarter and the current team is at capacity.', status: 'Approved', createdBy: 'Harsha' }),
  req(2, { createdN: -38, title: 'Cloud Engineer', companyId: 'co-1', departmentId: 'dep-3', department: 'Cloud & Infra', location: 'Dubai', positions: 1, employmentType: 'Full-time', reason: 'New role', budgetMin: 12000, budgetMax: 18000, currency: 'AED', targetStart: day(45), hiringManagerId: 'GS-058', justification: 'Azure and AWS migration workload needs a dedicated engineer.', status: 'Approved', createdBy: 'Harsha' }),
  req(3, { createdN: -35, title: 'Sales Executive', companyId: 'co-1', departmentId: 'dep-2', department: 'Sales', location: 'Dubai', positions: 2, employmentType: 'Full-time', reason: 'Replacement', replacesId: 'GS-063', budgetMin: 7000, budgetMax: 10000, currency: 'AED', targetStart: day(30), hiringManagerId: 'GS-058', justification: 'Replaces a departed account manager and adds one seat for the new enterprise segment.', status: 'Approved', createdBy: 'Harsha' }),
  req(4, { createdN: -30, title: 'Accounts Executive', companyId: 'co-1', departmentId: 'dep-7', department: 'Finance', location: 'Kochi', positions: 1, employmentType: 'Full-time', reason: 'New role', budgetMin: 400000, budgetMax: 600000, currency: 'INR', targetStart: day(35), hiringManagerId: 'GS-120', justification: 'Month-end close and GST filing are now handled by one person; a second accountant removes the risk.', status: 'Approved', createdBy: 'Muneer' }),
  req(5, { createdN: -3, title: 'Support Engineer', companyId: 'co-1', departmentId: 'dep-6', department: 'Managed Services', location: 'Kochi', positions: 2, employmentType: 'Full-time', reason: 'New role', budgetMin: 300000, budgetMax: 450000, currency: 'INR', targetStart: day(60), hiringManagerId: 'GS-076', justification: 'The Kochi service desk has a rising ticket backlog on night shifts.', status: 'Pending Approval', createdBy: 'Daniel Costa' }),
  req(6, { createdN: -1, title: 'Procurement Officer', companyId: 'co-1', departmentId: 'dep-5', department: 'Procurement', location: 'Dubai', positions: 1, employmentType: 'Contract', reason: 'New role', budgetMin: 8000, budgetMax: 11000, currency: 'AED', targetStart: day(50), hiringManagerId: 'GS-101', justification: 'Six-month contract to cover vendor consolidation.', status: 'Draft', createdBy: 'Navami' }),
  req(7, { createdN: -20, title: 'Admin Executive', companyId: 'co-1', departmentId: 'dep-11', department: 'Management & Administration', location: 'Dubai', positions: 1, employmentType: 'Full-time', reason: 'New role', budgetMin: 6000, budgetMax: 8000, currency: 'AED', targetStart: day(70), hiringManagerId: 'GS-120', justification: 'Front-office coverage for the second floor.', status: 'Rejected', createdBy: 'Muneer' }),
];

function job(n: number, r: Requisition, p: Pick<Job, 'designationTitle' | 'description' | 'skills' | 'expMin' | 'expMax' | 'qualifications' | 'panelIds' | 'referralEligible' | 'closingDate'> & { createdN: number }): Job {
  const { createdN, ...rest } = p;
  return {
    id: `job-${n}`,
    code: `JOB-${String(n).padStart(4, '0')}`,
    requisitionId: r.id,
    title: r.title,
    companyId: r.companyId,
    departmentId: r.departmentId,
    department: r.department,
    location: r.location,
    positions: r.positions,
    filled: 0,
    employmentType: r.employmentType,
    ...rest,
    status: 'Open',
    hiringManagerId: r.hiringManagerId,
    budgetMin: r.budgetMin,
    budgetMax: r.budgetMax,
    currency: r.currency,
    createdBy: 'Aslima',
    createdAt: at(createdN),
    updatedAt: at(createdN),
  };
}

const JOBS: Job[] = [
  job(1, REQUISITIONS[0], { createdN: -34, designationTitle: 'Network Engineer', description: 'Design, deploy and support client LAN/WAN, wireless and firewall estates.\nOwn incident response for managed-network customers.\nDocument changes and hand over to the service desk.', skills: ['Cisco', 'Fortinet', 'Routing & switching', 'SD-WAN'], expMin: 3, expMax: 7, qualifications: 'CCNA or higher; degree in IT or a related field.', panelIds: ['GS-058', 'GS-114'], referralEligible: true, closingDate: day(21) }),
  job(2, REQUISITIONS[1], { createdN: -30, designationTitle: 'Solutions Architect', description: 'Plan and run cloud migrations on Azure and AWS.\nBuild landing zones, identity and backup patterns.\nAdvise customers on cost and security.', skills: ['Azure', 'AWS', 'Terraform', 'Microsoft 365'], expMin: 4, expMax: 9, qualifications: 'AZ-104 / AWS Associate or equivalent.', panelIds: ['GS-058'], referralEligible: true, closingDate: day(25) }),
  job(3, REQUISITIONS[2], { createdN: -28, designationTitle: 'Senior Sales Executive', description: 'Sell managed IT services and cloud subscriptions to mid-market customers in the UAE.\nBuild pipeline, run demos and close contracts.', skills: ['B2B sales', 'CRM', 'Negotiation', 'Arabic (preferred)'], expMin: 2, expMax: 6, qualifications: 'Degree in business or IT; UAE driving licence preferred.', panelIds: ['GS-058', 'GS-042'], referralEligible: true, closingDate: day(18) }),
  job(4, REQUISITIONS[3], { createdN: -24, designationTitle: 'Accounts Executive', description: 'Maintain the ledgers, run month-end close and file GST returns for the Kochi entity.\nSupport audits and vendor payments.', skills: ['Tally', 'GST', 'Excel', 'Reconciliations'], expMin: 2, expMax: 5, qualifications: 'B.Com / M.Com; Tally and GST experience.', panelIds: ['GS-120', 'GS-142'], referralEligible: false, closingDate: day(28) }),
];

interface CandSeed {
  n: number;
  name: string;
  job: number;
  stage: Stage;
  source: Source;
  years: number;
  company: string;
  title: string;
  city: string;
  notice: number;
  cur?: number;
  exp?: number;
  visa?: string;
  tags?: string[];
  appliedN: number;
  referrer?: string;
  agency?: string;
  exit?: Application['exit'];
  exitReason?: string;
  exitNote?: string;
}

const SEEDS: CandSeed[] = [
  { n: 1, name: 'Imran Qureshi', job: 1, stage: 'Applied', source: 'LinkedIn', years: 4, company: 'Etisalat Business', title: 'Network Analyst', city: 'Dubai', notice: 30, cur: 9500, exp: 12000, visa: 'Employment visa', appliedN: -2 },
  { n: 2, name: 'Priya Nair', job: 1, stage: 'Screening', source: 'Bayt', years: 5, company: 'Redington Gulf', title: 'Network Engineer', city: 'Sharjah', notice: 60, cur: 11000, exp: 13500, visa: 'Employment visa', tags: ['Fortinet NSE4'], appliedN: -7 },
  { n: 3, name: 'Ahmed Karim', job: 1, stage: 'Technical Interview', source: 'Employee Referral', referrer: 'GS-087', years: 6, company: 'Du Enterprise', title: 'Senior Network Engineer', city: 'Dubai', notice: 30, cur: 13000, exp: 14000, visa: 'Employment visa', tags: ['Referral', 'Shortlisted'], appliedN: -12 },
  { n: 4, name: 'Sana Malik', job: 1, stage: 'HR Interview', source: 'Agency', agency: 'Talent Bridge Gulf', years: 5, company: 'Logicom', title: 'Network Engineer', city: 'Dubai', notice: 45, cur: 12000, exp: 14000, visa: 'Employment visa', tags: ['CCNP'], appliedN: -18 },
  { n: 5, name: 'Tomas Reyes', job: 1, stage: 'Technical Interview', source: 'Indeed', years: 3, company: 'Gulf Datacom', title: 'Network Support', city: 'Abu Dhabi', notice: 15, cur: 8000, exp: 11000, visa: 'Visit visa', appliedN: -16, exit: 'Rejected', exitReason: 'Failed technical interview', exitNote: 'Could not troubleshoot the routing scenario.' },
  { n: 6, name: 'Vikram Shah', job: 2, stage: 'Screening', source: 'LinkedIn', years: 6, company: 'Accenture Middle East', title: 'Cloud Consultant', city: 'Dubai', notice: 60, cur: 17000, exp: 19000, visa: 'Employment visa', tags: ['Azure'], appliedN: -6 },
  { n: 7, name: 'Layla Hassan', job: 2, stage: 'Technical Interview', source: 'Direct', years: 5, company: 'Emirates NBD', title: 'Cloud Engineer', city: 'Dubai', notice: 30, cur: 15000, exp: 17500, visa: 'Employment visa', tags: ['AWS', 'Shortlisted'], appliedN: -10 },
  { n: 8, name: 'Rohan Mehta', job: 2, stage: 'Offer', source: 'LinkedIn', years: 7, company: 'Microsoft Partner Network', title: 'Cloud Architect', city: 'Dubai', notice: 45, cur: 17500, exp: 18000, visa: 'Employment visa', tags: ['Azure', 'Terraform'], appliedN: -26 },
  { n: 9, name: 'Elena Petrova', job: 2, stage: 'Applied', source: 'Careers Page', years: 4, company: 'Dubai Holding', title: 'DevOps Engineer', city: 'Dubai', notice: 30, cur: 14000, exp: 16000, visa: 'Employment visa', appliedN: -1 },
  { n: 10, name: 'Khaled Mansour', job: 3, stage: 'Applied', source: 'Bayt', years: 3, company: 'Jumbo Electronics', title: 'Sales Executive', city: 'Dubai', notice: 30, cur: 7000, exp: 9000, visa: 'Employment visa', appliedN: -3 },
  { n: 11, name: 'Nadia Siddiqui', job: 3, stage: 'Screening', source: 'Bayt', years: 4, company: 'Dell Technologies', title: 'Inside Sales', city: 'Dubai', notice: 30, cur: 8500, exp: 10000, visa: 'Employment visa', appliedN: -8 },
  { n: 12, name: 'Joseph Thomas', job: 3, stage: 'Offer', source: 'Employee Referral', referrer: 'GS-042', years: 5, company: 'Redington Gulf', title: 'Account Manager', city: 'Dubai', notice: 30, cur: 9000, exp: 10000, visa: 'Employment visa', tags: ['Referral', 'Priority'], appliedN: -24 },
  { n: 13, name: 'Arun Krishnan', job: 4, stage: 'Technical Interview', source: 'Naukri', years: 3, company: 'Muthoot Finance', title: 'Accounts Officer', city: 'Kochi', notice: 30, cur: 380000, exp: 480000, appliedN: -9 },
  { n: 14, name: 'Meera Joseph', job: 4, stage: 'HR Interview', source: 'Naukri', years: 4, company: 'Federal Bank', title: 'Senior Accountant', city: 'Kochi', notice: 60, cur: 450000, exp: 560000, tags: ['GST'], appliedN: -15 },
  { n: 15, name: 'Fathima Beevi', job: 4, stage: 'Applied', source: 'Naukri', years: 2, company: 'Kerala Ayurveda Ltd', title: 'Accounts Assistant', city: 'Kochi', notice: 15, cur: 300000, exp: 420000, appliedN: -2 },
  { n: 16, name: 'Deepak Varma', job: 4, stage: 'Screening', source: 'Naukri', years: 3, company: 'KSEB', title: 'Accountant', city: 'Thrissur', notice: 90, cur: 410000, exp: 520000, appliedN: -11, exit: 'Withdrawn', exitReason: 'Accepted another offer', exitNote: 'Joined another firm last week.' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '');

function history(stage: Stage, appliedN: number, by: string, exit?: CandSeed['exit'], exitReason?: string): StageChange[] {
  const idx = STAGES.indexOf(stage);
  const out: StageChange[] = [{ id: '', at: at(appliedN), by: 'System', from: '—', to: 'Applied' }];
  const span = Math.max(1, Math.round(-appliedN / (idx + 1)));
  for (let i = 1; i <= idx; i++) out.push({ id: '', at: at(appliedN + span * i, '11:30'), by, from: STAGES[i - 1], to: STAGES[i] });
  if (exit) out.push({ id: '', at: at(-1, '16:00'), by, from: stage, to: exit, note: exitReason });
  return out;
}

const candidates: Candidate[] = [];
const applications: Application[] = [];

SEEDS.forEach((s) => {
  const j = JOBS[s.job - 1];
  const recruiter = 'Aslima';
  candidates.push({
    id: `cand-${s.n}`,
    name: s.name,
    email: `${slug(s.name)}@mail.com`,
    phone: j.location === 'Kochi' ? `+91 9${(40000000 + s.n * 1234567).toString().slice(0, 9)}` : `+971 5${(10000000 + s.n * 2345678).toString().slice(0, 8)}`,
    location: j.location,
    currentCity: s.city,
    currentCompany: s.company,
    currentTitle: s.title,
    experienceYears: s.years,
    noticeDays: s.notice,
    currentSalary: s.cur,
    expectedSalary: s.exp,
    currency: j.currency,
    visaStatus: s.visa ?? '',
    source: s.source,
    referrerId: s.referrer,
    agency: s.agency,
    cvName: `${s.name.replace(/\s+/g, '_')}_CV.pdf`,
    links: `linkedin.com/in/${slug(s.name)}`,
    tags: s.tags ?? [],
    notes: s.n === 3 ? [{ id: 'n-3', at: at(-11), by: 'Harsha', text: 'Strong on SD-WAN. Referred by Nived; worked with him at a previous company.' }] : s.n === 12 ? [{ id: 'n-12', at: at(-20), by: 'Omar Haddad', text: 'Closed two enterprise deals last year. Very keen on the role.' }] : [],
    consent: { given: true, at: at(s.appliedN) },
    createdBy: recruiter,
    createdAt: at(s.appliedN),
    updatedAt: at(s.appliedN),
  });
  const h = history(s.stage, s.appliedN, recruiter, s.exit, s.exitReason).map((c, i) => ({ ...c, id: `sc-${s.n}-${i + 1}` }));
  applications.push({
    id: `app-${s.n}`,
    candidateId: `cand-${s.n}`,
    jobId: j.id,
    location: j.location,
    stage: s.stage,
    exit: s.exit,
    exitFrom: s.exit ? s.stage : undefined,
    exitReason: s.exitReason,
    exitNote: s.exitNote,
    history: h,
    appliedAt: at(s.appliedN),
  });
});

// One candidate applying to two jobs.
applications.push({
  id: 'app-17',
  candidateId: 'cand-7',
  jobId: 'job-1',
  location: 'Dubai',
  stage: 'Applied',
  history: [{ id: 'sc-17-1', at: at(-4), by: 'System', from: '—', to: 'Applied' }],
  appliedAt: at(-4),
});

function iv(n: number, p: Omit<Interview, 'id' | 'createdAt' | 'status' | 'scheduledBy' | 'notes'> & { status?: Interview['status'] }): Interview {
  return { id: `int-${n}`, status: 'Scheduled', scheduledBy: 'Aslima', notes: '', createdAt: at(-5), ...p };
}

const INTERVIEWS: Interview[] = [
  iv(1, { applicationId: 'app-3', location: 'Dubai', round: 'Technical Interview', date: day(1), time: '10:00', durationMin: 60, mode: 'Teams', panelIds: ['GS-058', 'GS-114'], link: 'https://teams.microsoft.com/l/meetup-join/ahmed-karim' }),
  iv(2, { applicationId: 'app-7', location: 'Dubai', round: 'Technical Interview', date: day(0), time: '15:00', durationMin: 60, mode: 'Teams', panelIds: ['GS-058'], link: 'https://teams.microsoft.com/l/meetup-join/layla-hassan' }),
  iv(3, { applicationId: 'app-4', location: 'Dubai', round: 'Technical Interview', date: day(-8), time: '11:00', durationMin: 60, mode: 'In-person', panelIds: ['GS-058', 'GS-114'], link: '', status: 'Completed' }),
  iv(4, { applicationId: 'app-4', location: 'Dubai', round: 'HR Interview', date: day(2), time: '14:00', durationMin: 45, mode: 'In-person', panelIds: ['GS-119'], link: '' }),
  iv(5, { applicationId: 'app-8', location: 'Dubai', round: 'Technical Interview', date: day(-18), time: '12:00', durationMin: 90, mode: 'Teams', panelIds: ['GS-058'], link: 'https://teams.microsoft.com/l/meetup-join/rohan-mehta', status: 'Completed' }),
  iv(6, { applicationId: 'app-8', location: 'Dubai', round: 'HR Interview', date: day(-12), time: '16:00', durationMin: 45, mode: 'Phone', panelIds: ['GS-119'], link: '', status: 'Completed' }),
  iv(7, { applicationId: 'app-12', location: 'Dubai', round: 'HR Interview', date: day(-14), time: '10:30', durationMin: 45, mode: 'In-person', panelIds: ['GS-119', 'GS-042'], link: '', status: 'Completed' }),
  iv(8, { applicationId: 'app-13', location: 'Kochi', round: 'Technical Interview', date: day(3), time: '11:00', durationMin: 60, mode: 'Teams', panelIds: ['GS-120', 'GS-142'], link: 'https://teams.microsoft.com/l/meetup-join/arun-krishnan' }),
  iv(9, { applicationId: 'app-14', location: 'Kochi', round: 'Technical Interview', date: day(-6), time: '10:00', durationMin: 60, mode: 'Teams', panelIds: ['GS-120', 'GS-142'], link: 'https://teams.microsoft.com/l/meetup-join/meera-joseph', status: 'Completed' }),
  iv(10, { applicationId: 'app-14', location: 'Kochi', round: 'HR Interview', date: day(4), time: '15:30', durationMin: 45, mode: 'Phone', panelIds: ['GS-119'], link: '' }),
];

const OFFERS: Offer[] = [
  {
    id: 'off-1',
    code: 'OFF-0001',
    applicationId: 'app-8',
    location: 'Dubai',
    status: 'Sent',
    currency: 'AED',
    lines: [
      { label: 'Basic', amount: 11000 },
      { label: 'Housing', amount: 4000 },
      { label: 'Transport', amount: 1500 },
      { label: 'Other allowances', amount: 1000 },
    ],
    total: 17500,
    joiningDate: day(40),
    probationMonths: 6,
    expiryDate: day(2),
    overBudget: false,
    createdBy: 'Aslima',
    createdAt: at(-6),
    updatedAt: at(-5),
  },
  {
    id: 'off-2',
    code: 'OFF-0002',
    applicationId: 'app-12',
    location: 'Dubai',
    status: 'Accepted',
    currency: 'AED',
    lines: [
      { label: 'Basic', amount: 6000 },
      { label: 'Housing', amount: 2500 },
      { label: 'Transport', amount: 800 },
      { label: 'Other allowances', amount: 500 },
    ],
    total: 9800,
    joiningDate: day(30),
    probationMonths: 6,
    expiryDate: day(-1),
    overBudget: false,
    createdBy: 'Aslima',
    createdAt: at(-9),
    updatedAt: at(-2),
    respondedAt: at(-2, '17:20'),
  },
];

export function seedHiring(): HiringState {
  return {
    requisitions: structuredClone(REQUISITIONS),
    jobs: structuredClone(JOBS),
    candidates: structuredClone(candidates),
    applications: structuredClone(applications),
    interviews: structuredClone(INTERVIEWS),
    offers: structuredClone(OFFERS),
  };
}
