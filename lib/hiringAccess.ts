import { Company, Department, Employee, Role } from '@/lib/types';

/* Who works with Hiring Management. Kept apart from the data store so the route guard and the module switcher can
   ask without loading the hiring data. A backend must enforce the same rules on every request. */

/** HR, Office Admin, Super Admin and the Talent Acquisition Manager run the module. A Team Lead (hiring manager) and a
    Recruiter work with their own jobs. Everyone else has no module access (they can still see interviews they are on the
    panel for, under My Space). */
export type HiringLevel = 'full' | 'manager' | 'none';

export const hiringLevel = (role: Role): HiringLevel =>
  role === 'Super Admin' || role === 'HR' || role === 'Office Admin' || role === 'Talent Acquisition Manager' ? 'full' : role === 'Team Lead' || role === 'Recruiter' ? 'manager' : 'none';

/** A Team Lead asks for headcount only for their own team: the departments they head, plus the one they sit in, each
    with its own company. This finds them in the organisation set-up; the first one is their own department when it is set up. */
export function teamLeadScope(me: Pick<Employee, 'name' | 'company' | 'department'>, companies: Company[], departments: Department[]) {
  const ownCompany = companies.find((c) => c.name === me.company);
  const own = ownCompany ? departments.find((d) => d.companyId === ownCompany.id && d.name === me.department) : undefined;
  const headed = departments.filter((d) => d.head === me.name && d.id !== own?.id);
  return { departments: own ? [own, ...headed] : headed };
}

/* The Talent Acquisition team. A new job goes to the Talent Acquisition Manager, who chooses the recruiter from the team. */

export const TA_MANAGER_TITLE = 'Talent Acquisition Manager';
export const RECRUITER_TITLE = 'Recruiter';

export const isTalentManager = (e: Pick<Employee, 'designation'> | undefined) => e?.designation === TA_MANAGER_TITLE;

/** The active Talent Acquisition Manager, if the company has one. */
export const talentManager = (employees: Employee[]) => employees.find((e) => e.employmentStatus === 'Active' && isTalentManager(e));

/** Who can be chosen as a job's recruiter: the Talent Acquisition recruiters, and the manager. */
export const recruiterPool = (employees: Employee[]) => employees.filter((e) => e.employmentStatus === 'Active' && (e.designation === RECRUITER_TITLE || isTalentManager(e)));

/** Choosing or changing a job's recruiter is the Talent Acquisition Manager's call (and a Super Admin's). A job made before
    the team existed has no manager on it, so HR and Office Admin can still change its recruiter. */
export function canChooseRecruiter(actor: { id: string; role: Role }, job: { taManagerId?: string }, employees: Employee[]) {
  if (actor.role === 'Super Admin' || actor.role === 'Talent Acquisition Manager') return true;
  if (isTalentManager(employees.find((e) => e.id === actor.id)) || job.taManagerId === actor.id) return true;
  return !job.taManagerId && (actor.role === 'HR' || actor.role === 'Office Admin');
}

/** Current, expected and offered pay is visible to HR/Admin and to the hiring manager and recruiter of that job only. */
export const canSeeSalary = (level: HiringLevel, meId: string, hiringManagerId: string, recruiterId?: string) => level === 'full' || hiringManagerId === meId || recruiterId === meId;
