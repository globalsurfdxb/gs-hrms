/* Statutory payroll calculations used when a salary is set up (the onboarding wizard's Salary step).
   Every figure is monthly. The rates are written down once here so they can be reviewed and updated in one place.
   These are indicative: payroll should confirm them against the current notifications before the first pay run. */

/* ---------------------------------------------------------------------- India */

/** Provident fund wage ceiling: contributions are mandatory on wages up to this amount (INR per month). */
export const PF_WAGE_CEILING = 15000;
/** Employees State Insurance applies when gross wages are at or below this (INR per month). */
export const ESI_WAGE_LIMIT = 21000;

/** Kerala professional tax for half a year of gross salary, by half-yearly slab (revised with effect from 1 Oct 2024).
    The amount is set by the local body, so a corporation or panchayat may differ. */
export function keralaPtHalfYear(halfYearGross: number): number {
  const slabs: [number, number][] = [
    [125000, 1250],
    [100000, 1000],
    [45000, 750],
    [30000, 600],
    [18000, 450],
    [12000, 320],
  ];
  return slabs.find(([from]) => halfYearGross >= from)?.[1] ?? 0;
}
/** Monthly professional tax: the half-yearly tax spread over six months. */
export const keralaPtMonthly = (monthlyGross: number): number => keralaPtHalfYear(monthlyGross * 6) / 6;

export interface IndiaPayrollInput {
  basic: number;
  hra: number;
  fixed: number;
  other: number;
  /** Contribute to PF on the full wage even above the INR 15,000 ceiling (a voluntary higher contribution). */
  pfOnFullWage?: boolean;
}

export interface IndiaPayroll {
  gross: number;
  /** Wages for PF, ESI and gratuity: the Basic, and never less than half of gross pay (Code on Wages). */
  wages: number;
  /** The wage PF is paid on: the wage up to the ceiling, or the full wage when contributing on it. */
  pfWage: number;
  epfEmployee: number;
  /** Employer share of 12% that goes to the provident fund (the rest, 8.33%, goes to the pension scheme). */
  epfEmployer: number;
  eps: number;
  edli: number;
  /** EPFO administration charge, 0.5% of PF wages (a minimum applies per establishment, not per employee). */
  admin: number;
  esiApplies: boolean;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  /** Deducted from the employee by law each month: EPF, ESI and professional tax. */
  employeeStatutory: number;
  /** Employer's cost on top of gross: PF, pension, EDLI, admin and ESI. */
  employerContributions: number;
  /** Gratuity set aside each month: 15/26 of a month's wages, spread over the year (payable after five years). */
  gratuity: number;
  monthlyCtc: number;
}

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function indiaPayroll(i: IndiaPayrollInput): IndiaPayroll {
  const basic = Math.max(0, i.basic);
  const gross = basic + Math.max(0, i.hra) + Math.max(0, i.fixed) + Math.max(0, i.other);
  const wages = Math.max(basic, gross * 0.5);
  const pfWage = i.pfOnFullWage ? wages : Math.min(wages, PF_WAGE_CEILING);
  const epsWage = Math.min(pfWage, PF_WAGE_CEILING);
  const epfEmployee = r0(pfWage * 0.12);
  const eps = r0(epsWage * 0.0833);
  const epfEmployer = r0(pfWage * 0.12) - eps;
  const edli = r0(epsWage * 0.005);
  const admin = r0(pfWage * 0.005);
  const esiApplies = gross > 0 && gross <= ESI_WAGE_LIMIT;
  const esiEmployee = esiApplies ? Math.ceil(gross * 0.0075) : 0;
  const esiEmployer = esiApplies ? Math.ceil(gross * 0.0325) : 0;
  const professionalTax = r2(keralaPtMonthly(gross));
  const employeeStatutory = epfEmployee + esiEmployee + professionalTax;
  const employerContributions = epfEmployer + eps + edli + admin + esiEmployer;
  const gratuity = r2((wages * 15) / 26 / 12);
  return { gross, wages, pfWage, epfEmployee, epfEmployer, eps, edli, admin, esiApplies, esiEmployee, esiEmployer, professionalTax, employeeStatutory, employerContributions, gratuity, monthlyCtc: r2(gross + employerContributions + gratuity) };
}

/* ---------------------------------------------------------------------- UAE */

/** Unemployment insurance (ILOE): monthly subscription by basic salary. Paid by the employee. */
export const iloeMonthly = (basic: number): number => (basic <= 0 ? 0 : basic <= 16000 ? 5 : 10);

export interface UaePayrollInput {
  basic: number;
  total: number;
  /** A UAE national, who is covered by the pension fund. Expatriates are not. */
  national: boolean;
}

export interface UaePayroll {
  total: number;
  /** Unemployment insurance, AED per month, borne by the employee. */
  iloe: number;
  pensionApplies: boolean;
  pensionEmployee: number;
  pensionEmployer: number;
  /** The government pays 2.5% of the employer's 15% when the contribution salary is under AED 20,000. */
  pensionGovernment: number;
  /** End-of-service gratuity set aside each month: 21 days' basic per year for the first five years. */
  gratuityFirstFive: number;
  /** From the sixth year it is 30 days' basic per year. */
  gratuityAfterFive: number;
  netPay: number;
}

export function uaePayroll(i: UaePayrollInput): UaePayroll {
  const basic = Math.max(0, i.basic);
  const total = Math.max(0, i.total);
  const base = Math.min(total, 70000);
  const pensionEmployee = i.national ? r2(base * 0.11) : 0;
  const pensionGovernment = i.national && base > 0 && base < 20000 ? r2(base * 0.025) : 0;
  const pensionEmployer = i.national ? r2(base * 0.15 - pensionGovernment) : 0;
  return {
    total,
    iloe: iloeMonthly(basic),
    pensionApplies: i.national,
    pensionEmployee,
    pensionEmployer,
    pensionGovernment,
    gratuityFirstFive: r2((basic * 21) / 30 / 12),
    gratuityAfterFive: r2(basic / 12),
    netPay: r2(total - pensionEmployee),
  };
}
