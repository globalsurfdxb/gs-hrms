import { directReports } from '@/lib/data';
import { PERS, resolveLocation } from '@/lib/nav';
import { Role } from '@/lib/types';

/* Which pages a signed-in role may open. The shell asks this while rendering, so a page the role may not see is
   never drawn (and never flashes) before the redirect. A backend must still enforce the same rules on every
   request; this is the front-end half of that. */

const MANAGEMENT: Role[] = ['Super Admin', 'HR', 'Office Admin'];

export function routeAllowed(role: Role, pathname: string, me: { id: string; employeeCode: string }): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';

  // Self-service pages every signed-in person can open.
  if (['/dashboard', '/profile', '/expense/new', '/expense/claims'].includes(path) || path.startsWith('/my/') || path.startsWith('/modules/')) return true;

  // Expense administration.
  if (path === '/expense/approvals') return role !== 'Employee';
  if (path === '/expense/dashboard' || path === '/expense/categories') return MANAGEMENT.includes(role);

  // Employee records: management sees everyone (and edits), a person sees their own, a team lead sees direct reports.
  const m = path.match(/^\/directory\/([^/]+)(\/edit)?$/);
  if (m) {
    const code = decodeURIComponent(m[1]);
    const editing = !!m[2];
    if (MANAGEMENT.includes(role)) return true;
    if (editing) return false;
    if (code === me.employeeCode) return true;
    return role === 'Team Lead' && directReports(me.id).some((e) => e.employeeCode === code);
  }

  // Everything else follows the role's modules and spaces.
  const loc = resolveLocation(path);
  const persona = PERS[role];
  if (loc.module === 'modules') return true;
  return persona.modules.includes(loc.module) && !(loc.scope && !persona.scopes.includes(loc.scope));
}
