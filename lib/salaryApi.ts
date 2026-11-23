import { api } from '@/lib/api';

/* Salary structure from the backend (GET/PUT /api/employees/:code/salary, signed in). Amounts are strings with two
   decimals ("9000.00") in the location's currency; totals and net pay are calculated by the server. Access is by
   permission (Employee Management → Identity, bank & salary → Salary): View reads, Edit changes. Anyone reads their
   own; nobody changes their own. Views of someone else's salary are audited. Local development only — see API_ENABLED. */

export interface SalaryLine {
  label: string;
  amount: string;
}

export interface ServerSalary {
  employeeCode: string;
  template: 'UAE' | 'INDIA';
  currency: 'AED' | 'INR';
  earnings: SalaryLine[];
  deductions: SalaryLine[];
  totalEarnings: string;
  totalDeductions: string;
  netPay: string;
  canEdit: boolean;
}

/** PUT body: the whole structure; it replaces what is saved. */
export interface SalaryUpdate {
  earnings: SalaryLine[];
  deductions: SalaryLine[];
}

const path = (code: string) => `/employees/${encodeURIComponent(code)}/salary`;

export const salaryApi = {
  /** 404 when the person is outside what you may see (or not yours, without Salary → View). */
  get: (code: string) => api<ServerSalary>('GET', path(code)),
  replace: (code: string, body: SalaryUpdate) => api<ServerSalary>('PUT', path(code), body),
};

/** Same limits as the server (BR-EMP-011). */
export const SALARY_MAX_LINES = 20;
export const SALARY_LABEL_MAX = 60;
export const SALARY_AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
