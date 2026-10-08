import { EMPLOYEES } from '@/lib/data';
import { Company, Department, Employee, EmploymentStatus } from '@/lib/types';

/* One definition of "headcount" for the whole app, so the same person is counted the same way everywhere.

     Active    employmentStatus "Active"       — working today
     Joining   employmentStatus "Onboarding"   — offered / onboarding, not yet started
     Exiting   employmentStatus "Offboarding"  — serving notice or in clearance
     Inactive  employmentStatus "Inactive"     — has left; never counted in any total

   Total = Active + Joining + Exiting. Pages show the parts next to the total so nobody has to guess. */

export interface Headcount {
  active: number;
  joining: number;
  exiting: number;
  inactive: number;
  /** Active + Joining + Exiting (Inactive excluded). */
  total: number;
}

export type StatusFn = (e: Employee) => EmploymentStatus;
const own: StatusFn = (e) => e.employmentStatus;

export const HEADCOUNT_TERMS = {
  active: 'Active employees',
  joining: 'Joining',
  exiting: 'Exiting',
  total: 'Total incl. joining',
} as const;

export const HEADCOUNT_NOTE = 'Active = working today · Joining = onboarding · Exiting = serving notice · Inactive (left) is never counted.';

export const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether an employee's location is inside a scope. "All" (or nothing) means every location. */
export const inScope = (scope: string | undefined | null, employeeLocation: string) => !scope || scope === 'All' || scope === 'all' || scope === employeeLocation;

export const emptyHeadcount = (): Headcount => ({ active: 0, joining: 0, exiting: 0, inactive: 0, total: 0 });

export function countHeadcount(list: Employee[] = EMPLOYEES, statusOf: StatusFn = own): Headcount {
  const h = emptyHeadcount();
  for (const e of list) {
    const s = statusOf(e);
    if (s === 'Active') h.active++;
    else if (s === 'Onboarding') h.joining++;
    else if (s === 'Offboarding') h.exiting++;
    else h.inactive++;
  }
  h.total = h.active + h.joining + h.exiting;
  return h;
}

/** Everyone in a location scope, whatever their status. */
export const employeesInScope = (scope: string | undefined | null, list: Employee[] = EMPLOYEES) => list.filter((e) => inScope(scope, e.location));

/** People who count towards totals (everyone except Inactive). */
export const workforce = (list: Employee[] = EMPLOYEES, statusOf: StatusFn = own) => list.filter((e) => statusOf(e) !== 'Inactive');

/** Headcount for a location scope. */
export const headcountInScope = (scope: string | undefined | null, list: Employee[] = EMPLOYEES, statusOf: StatusFn = own) => countHeadcount(employeesInScope(scope, list), statusOf);

/** Headcount for one location id. */
export const headcountByLocation = (locationId: string, list: Employee[] = EMPLOYEES, statusOf: StatusFn = own) => countHeadcount(list.filter((e) => e.location === locationId), statusOf);

/** Headcount for one company (matched on name, ignoring case). */
export const headcountByCompany = (companyName: string, list: Employee[] = EMPLOYEES, statusOf: StatusFn = own) => countHeadcount(list.filter((e) => sameText(e.company, companyName)), statusOf);

/** Headcount for one department of one company. */
export const headcountByDepartment = (companyName: string, departmentName: string, list: Employee[] = EMPLOYEES, statusOf: StatusFn = own) =>
  countHeadcount(list.filter((e) => sameText(e.company, companyName) && sameText(e.department, departmentName)), statusOf);

/** Headcount for one designation inside one department of one company. */
export const headcountByDesignation = (companyName: string, departmentName: string, title: string, list: Employee[] = EMPLOYEES, statusOf: StatusFn = own) =>
  countHeadcount(list.filter((e) => sameText(e.company, companyName) && sameText(e.department, departmentName) && sameText(e.designation, title)), statusOf);

/** Department name -> people counted in totals, across companies, biggest first (for bar charts). */
export function departmentTotals(list: Employee[] = EMPLOYEES, statusOf: StatusFn = own): [string, number][] {
  const acc = new Map<string, { label: string; n: number }>();
  for (const e of workforce(list, statusOf)) {
    const k = e.department.trim().toLowerCase();
    const row = acc.get(k) ?? { label: e.department, n: 0 };
    row.n++;
    acc.set(k, row);
  }
  return [...acc.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map((r) => [r.label, r.n]);
}

/** One row per company + department that has people (or exists in the master list), with the full status split. */
export interface DepartmentRow extends Headcount {
  company: string;
  department: string;
}
export function departmentRows(list: Employee[] = EMPLOYEES, statusOf: StatusFn = own): DepartmentRow[] {
  const acc = new Map<string, Employee[]>();
  for (const e of list) {
    const k = `${e.company.trim().toLowerCase()}|${e.department.trim().toLowerCase()}`;
    acc.set(k, [...(acc.get(k) ?? []), e]);
  }
  return [...acc.values()]
    .map((g) => ({ company: g[0].company, department: g[0].department, ...countHeadcount(g, statusOf) }))
    .sort((a, b) => b.total - a.total || a.company.localeCompare(b.company) || a.department.localeCompare(b.department));
}

/* ---------- Organisation structure (companies, departments, designations) ---------- */

/** Departments (company + name records) that operate in a location. */
export const departmentsInLocation = (locationId: string, departments: Department[]) => departments.filter((d) => d.locations.includes(locationId));

/** Distinct department names in a location. A "Sales" unit in three companies is one department name. */
export const departmentNamesInLocation = (locationId: string, departments: Department[]) => new Set(departmentsInLocation(locationId, departments).map((d) => d.name.trim().toLowerCase())).size;

/** Companies that have people or departments in a location (a company marked for one office but staffed in another still counts). */
export function companiesInLocation(locationId: string, companies: Company[], departments: Department[], list: Employee[] = EMPLOYEES): Company[] {
  const deptCompanies = new Set(departmentsInLocation(locationId, departments).map((d) => d.companyId));
  return companies.filter(
    (c) =>
      deptCompanies.has(c.id) ||
      list.some((e) => e.location === locationId && sameText(e.company, c.name) && e.employmentStatus !== 'Inactive') ||
      c.location === locationId
  );
}

/** Department names employees sit in for a company that are missing from that company's department list. */
export function departmentsMissingFromMaster(companyName: string, companyDepartments: Department[], list: Employee[] = EMPLOYEES, statusOf: StatusFn = own): { name: string; headcount: Headcount }[] {
  const known = new Set(companyDepartments.map((d) => d.name.trim().toLowerCase()));
  const names = new Map<string, string>();
  for (const e of list) if (sameText(e.company, companyName) && statusOf(e) !== 'Inactive' && !known.has(e.department.trim().toLowerCase())) names.set(e.department.trim().toLowerCase(), e.department);
  return [...names.values()].map((name) => ({ name, headcount: headcountByDepartment(companyName, name, list, statusOf) }));
}

/** Designation titles employees hold in a department that the master list does not have. */
export function designationsMissingFromMaster(companyName: string, departmentName: string, masterTitles: string[], list: Employee[] = EMPLOYEES, statusOf: StatusFn = own): { title: string; headcount: Headcount }[] {
  const known = new Set(masterTitles.map((t) => t.trim().toLowerCase()));
  const titles = new Map<string, string>();
  for (const e of list) {
    if (sameText(e.company, companyName) && sameText(e.department, departmentName) && statusOf(e) !== 'Inactive' && !known.has(e.designation.trim().toLowerCase())) titles.set(e.designation.trim().toLowerCase(), e.designation);
  }
  return [...titles.values()].map((title) => ({ title, headcount: headcountByDesignation(companyName, departmentName, title, list, statusOf) }));
}
