import { HiringState, EmploymentKind } from '@/lib/hiringTypes';
import { appById, candById, jobById, offerById } from '@/lib/hiringStore';
import { JoiningForm, getInvites } from '@/lib/onboardingForms';
import { Referral, docRequestFor, getDocRequests } from '@/lib/hiringDocs';

/* The handoff from an accepted offer to the onboarding wizard. */

/** What the onboarding wizard is given to start from when a candidate's accepted offer becomes an employee. */
export interface OnboardingPrefill {
  offerId: string;
  offerCode: string;
  candidateId: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  name: string;
  personalEmail: string;
  /** As typed on the candidate (any format); the wizard keeps the digits that fit the location. */
  phone: string;
  location: string;
  companyId: string;
  departmentId: string;
  designationTitle: string;
  managerId: string;
  joiningDate: string;
  employmentType: 'Permanent' | 'Contract' | 'Probation';
  totalExperience: string;
  cvName?: string;
  /** Salary keyed by the wizard's own line labels. */
  salary: Record<string, string>;
  /** Offer lines the wizard has no matching line for. */
  unmapped: { label: string; amount: number }[];
  currency: string;
  /** What the joiner entered on their joining form, when they have submitted it. */
  form?: JoiningForm;
  formSubmittedAt?: string;
  /** What HR collected and verified before the offer letter, and the background-verification referral. */
  preDocs?: { label: string; files: string[]; verified: boolean }[];
  referral?: Referral;
}

const UAE_MAP: Record<string, string> = { Basic: 'Basic Salary', Housing: 'Accommodation Allowance', Transport: 'Transportation Allowance' };
const INDIA_MAP: Record<string, string> = { Basic: 'Basic', 'House Rent Allowance': 'House Rent Allowance', 'Special Allowance': 'Fixed Allowance', 'Other Allowance': 'Other Allowance' };
const KIND_MAP: Record<EmploymentKind, OnboardingPrefill['employmentType']> = { 'Full-time': 'Permanent', Contract: 'Contract', Intern: 'Probation' };

/** The prefill for an accepted offer that has not been used yet; null otherwise. */
export function onboardingPrefill(s: HiringState, offerId: string): OnboardingPrefill | null {
  const o = offerById(s, offerId);
  const a = o && appById(s, o.applicationId);
  const c = a && candById(s, a.candidateId);
  const j = a && jobById(s, a.jobId);
  if (!o || !a || !c || !j || o.status !== 'Accepted' || o.employeeId) return null;
  const india = o.currency === 'INR';
  const map = india ? INDIA_MAP : UAE_MAP;
  const salary: Record<string, string> = {};
  const unmapped: { label: string; amount: number }[] = [];
  o.lines.forEach((l) => {
    const target = map[l.label];
    // India's offer is a yearly CTC; the wizard's salary lines are monthly.
    const amount = india ? Math.round(l.amount / 12) : l.amount;
    if (target && l.amount > 0) salary[target] = String(amount);
    else if (l.amount > 0) unmapped.push({ label: l.label, amount: l.amount });
  });
  const invite = getInvites().find((i) => i.offerId === o.id && i.status === 'Submitted');
  const dreq = docRequestFor(getDocRequests(), o.applicationId);
  const preDocs = dreq?.items.filter((i) => i.files.length).map((i) => ({ label: i.label, files: i.files.map((f) => f.name), verified: i.status === 'Verified' }));
  return {
    preDocs: preDocs?.length ? preDocs : undefined,
    referral: dreq && dreq.bgv.name ? dreq.bgv : undefined,
    form: invite?.data,
    formSubmittedAt: invite?.submittedAt,
    offerId: o.id,
    offerCode: o.code,
    candidateId: c.id,
    jobId: j.id,
    jobCode: j.code,
    jobTitle: j.title,
    name: c.name,
    personalEmail: c.email,
    phone: c.phone,
    location: j.location,
    companyId: j.companyId,
    departmentId: j.departmentId,
    designationTitle: j.designationTitle,
    managerId: j.hiringManagerId,
    joiningDate: o.joiningDate,
    employmentType: KIND_MAP[j.employmentType],
    totalExperience: String(c.experienceYears),
    cvName: c.cvName,
    salary,
    unmapped,
    currency: o.currency,
  };
}

/** Why an offer cannot start onboarding, in words for the person looking at the screen; null when it can. */
export function prefillProblem(s: HiringState, offerId: string): string | null {
  const o = offerById(s, offerId);
  if (!o) return 'That offer is not in the hiring data of this browser. Hiring data is kept per browser, so open the offer from Hiring → Offers in the browser where it was created.';
  if (o.employeeId) return `${o.code} was already used to onboard ${o.employeeId}. Open that employee's record instead.`;
  if (o.status !== 'Accepted') return `${o.code} is ${o.status.toLowerCase()}, not accepted yet. Mark it Accepted on Hiring → Offers first, then start onboarding.`;
  const a = appById(s, o.applicationId);
  if (!a || !candById(s, a.candidateId) || !jobById(s, a.jobId)) return `${o.code} has lost its candidate or job record, so there is nothing to carry over.`;
  return null;
}
