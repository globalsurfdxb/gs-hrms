import { directReports } from '@/lib/data';
import { PERS, resolveLocation } from '@/lib/nav';
import { Role } from '@/lib/types';
import { hiringLevel } from '@/lib/hiringAccess';
import { can } from '@/lib/access';
import { featuresFor, navAccess } from '@/lib/navAccess';

/* Which pages a signed-in role may open. The shell asks this while rendering, so a page the role may not see is
   never drawn (and never flashes) before the redirect. A backend must still enforce the same rules on every
   request; this is the front-end half of that. Connected to the backend, `perms` (the granted permission keys) decide
   instead of the role table — see lib/navAccess.ts. Hiring Management still follows the role for now. */

const MANAGEMENT: Role[] = ['Super Admin', 'HR', 'Office Admin'];

export function routeAllowed(role: Role, pathname: string, me: { id: string; employeeCode: string }, perms: string[] | null = null): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  const nav = navAccess(role, perms);

  // Self-service pages every signed-in person can open.
  if (['/dashboard', '/profile', '/expense/new', '/expense/claims'].includes(path) || path.startsWith('/modules/')) return true;
  if (path.startsWith('/my/')) return nav.shows(path);

  // Hiring Management: HR and administrators run it; a Team Lead works with their own requisitions and jobs.
  if (path === '/hiring' || path.startsWith('/hiring/')) {
    const level = hiringLevel(role);
    // An interviewer of any role may open the profile of a candidate they are assigned to (the page checks the assignment).
    if (/^\/hiring\/candidates\/[^/]+$/.test(path)) return true;
    // Reports and Operations (email templates, stage emails, connections) are for HR and administrators.
    const adminOnly = path === '/hiring/reports' || path === '/hiring/operations' || path.startsWith('/hiring/operations/');
    return adminOnly ? level === 'full' : level !== 'none';
  }

  // Expense administration.
  if (perms && path.startsWith('/expense/')) return nav.shows(path);
  if (path === '/expense/approvals') return role !== 'Employee';
  if (path === '/expense/dashboard' || path === '/expense/categories') return MANAGEMENT.includes(role);

  // Employee records: management sees everyone (and edits), a person sees their own, a team lead sees direct reports.
  const m = path.match(/^\/directory\/([^/]+)(\/edit)?$/);
  if (m) {
    const code = decodeURIComponent(m[1]);
    const editing = !!m[2];
    const everyone = perms ? ['employee:org:directory', 'employee:ops:directory'].some((id) => can(perms, id, editing ? 'edit' : 'view')) : MANAGEMENT.includes(role);
    if (everyone) return true;
    if (editing) return false;
    if (code === me.employeeCode) return true;
    const team = perms ? can(perms, 'employee:team:directory') : role === 'Team Lead';
    // Connected, the server knows the real reporting lines and answers 404 for anyone outside the team.
    if (perms) return team;
    return team && directReports(me.id).some((e) => e.employeeCode === code);
  }

  // Everything else follows the granted features (connected), or the role's modules and spaces.
  const loc = resolveLocation(path);
  if (loc.module === 'modules' || loc.module === 'hiring') return true;
  if (perms && featuresFor(path).length) return nav.shows(path);
  const persona = perms ? nav : PERS[role];
  return persona.modules.includes(loc.module) && !(loc.scope && !persona.scopes.includes(loc.scope));
}
