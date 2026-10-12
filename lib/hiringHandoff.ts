import { HiringState, EmploymentKind } from '@/lib/hiringTypes';
import { appById, candById, jobById, offerById } from '@/lib/hiringStore';

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
  return {
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
