import { api } from '@/lib/api';
import type { EmploymentStatus } from '@/lib/types';

/* The backend employee directory (GET /api/employees, signed in). The server applies the caller's data scope:
   Directory → View sees everyone, Team → Directory sees self + direct reports, anyone else only themselves.
   Local development only — see API_ENABLED. */

export type DataScope = 'ALL' | 'TEAM' | 'SELF';

interface Ref {
  id: string;
  name: string;
}

export interface ServerEmployee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  status: 'ONBOARDING' | 'ACTIVE' | 'OFFBOARDING' | 'INACTIVE';
  employmentType: 'PERMANENT' | 'CONTRACT' | 'PROBATION';
  /** YYYY-MM-DD */
  dateOfJoining: string;
  company: Ref;
  department: Ref | null;
  /** `name` is the designation title. */
  designation: Ref | null;
  location: Ref;
  reportingManager: { id: string; employeeCode: string; name: string } | null;
}

const PAGE = 100; // the server's maximum

export const employeesApi = {
  /** Everyone in the caller's scope (the company is ~200 people, so the directory filters and counts them here). */
  async all(): Promise<{ scope: DataScope; items: ServerEmployee[] }> {
    const items: ServerEmployee[] = [];
    for (let page = 1; ; page++) {
      const r = await api<{ scope: DataScope; items: ServerEmployee[]; total: number }>('GET', '/employees', undefined, { page, pageSize: PAGE });
      items.push(...r.items);
      if (items.length >= r.total || !r.items.length) return { scope: r.scope, items };
    }
  },
  /** 404 employee.not_found when the person does not exist or is outside the caller's scope. */
  get: (code: string) => api<ServerEmployee>('GET', `/employees/${encodeURIComponent(code)}`),
};

/** "ACTIVE" → "Active", as the rest of the app spells statuses and types. */
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
export const statusOfServer = (e: ServerEmployee) => title(e.status) as EmploymentStatus;
export const typeOfServer = (e: ServerEmployee) => title(e.employmentType) as 'Permanent' | 'Contract' | 'Probation';

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
