import { Role } from '@/lib/types';

/* Who works with Hiring Management. Kept apart from the data store so the route guard and the module switcher can
   ask without loading the hiring data. A backend must enforce the same rules on every request. */

/** HR, Office Admin and Super Admin run the module; a Team Lead is a hiring manager; everyone else has no module
    access (they can still see interviews they are on the panel for, under My Space). */
export type HiringLevel = 'full' | 'manager' | 'none';

export const hiringLevel = (role: Role): HiringLevel => (role === 'Super Admin' || role === 'HR' || role === 'Office Admin' ? 'full' : role === 'Team Lead' ? 'manager' : 'none');

/** Current, expected and offered pay is visible to HR/Admin and to the hiring manager of that job only. */
export const canSeeSalary = (level: HiringLevel, meId: string, hiringManagerId: string) => level === 'full' || hiringManagerId === meId;
