import { Company, Department, Employee, Role } from '@/lib/types';

/* Who works with Hiring Management. Kept apart from the data store so the route guard and the module switcher can
   ask without loading the hiring data. A backend must enforce the same rules on every request. */

/** HR, Office Admin and Super Admin run the module; a Team Lead is a hiring manager; everyone else has no module
    access (they can still see interviews they are on the panel for, under My Space). */
export type HiringLevel = 'full' | 'manager' | 'none';

export const hiringLevel = (role: Role): HiringLevel => (role === 'Super Admin' || role === 'HR' || role === 'Office Admin' ? 'full' : role === 'Team Lead' ? 'manager' : 'none');

/** A Team Lead asks for headcount only for their own team: the departments they head, plus the one they sit in, each
    with its own company. This finds them in the organisation set-up; the first one is their own department when it is set up. */
export function teamLeadScope(me: Pick<Employee, 'name' | 'company' | 'department'>, companies: Company[], departments: Department[]) {
  const ownCompany = companies.find((c) => c.name === me.company);
  const own = ownCompany ? departments.find((d) => d.companyId === ownCompany.id && d.name === me.department) : undefined;
  const headed = departments.filter((d) => d.head === me.name && d.id !== own?.id);
  return { departments: own ? [own, ...headed] : headed };
}

/** Current, expected and offered pay is visible to HR/Admin and to the hiring manager of that job only. */
export const canSeeSalary = (level: HiringLevel, meId: string, hiringManagerId: string) => level === 'full' || hiringManagerId === meId;
