import { ADMIN, HOME_TABS, OPS, PERS, RailModule, Scope } from '@/lib/nav';
import { Role } from '@/lib/types';
import { AccessAction, can } from '@/lib/access';

/* What the menus show and which pages open. Connected to the backend, it follows the signed-in person's granted
   permission keys (GET /api/auth/me, lib/access.ts format), so custom roles and changed grants change the UI. The
   demo build (no backend) keeps the built-in role table (PERS). The backend enforces the grants on every request. */

const SCOPES: Scope[] = ['my', 'team', 'org'];
const REPORTS = 'employee:reports:reports-analytics';

/** The catalogue features a page belongs to (a page can be in more than one). Empty = not in the catalogue. */
export function featuresFor(path: string): string[] {
  const out: string[] = [];
  for (const s of SCOPES) for (const t of HOME_TABS[s]) if (t.href === path) out.push(`employee:${s}:${t.key}`);
  for (const sec of OPS) for (const i of sec.items) if (i.href === path) out.push(`employee:ops:${i.key}`);
  for (const sec of ADMIN) for (const i of sec.items) if (i.href === path) out.push(`administration:${i.key}`);
  if (path === '/reports' || path.startsWith('/reports/')) out.push(REPORTS);
  return out;
}

export interface NavAccess {
  /** Granted permission keys, or null in the demo build (role table). */
  perms: string[] | null;
  modules: RailModule[];
  scopes: Scope[];
  /** Whether a tab or hub link may be shown: any of its features is granted (pages outside the catalogue: yes). */
  shows: (href: string) => boolean;
  /** Whether an action on a catalogue feature is granted (always, in the demo build). */
  allows: (featureId: string, action?: AccessAction) => boolean;
}

export function navAccess(role: Role, perms: string[] | null): NavAccess {
  if (!perms) return { perms, ...PERS[role], shows: () => true, allows: () => true };
  const has = (id: string) => perms.includes(id);
  const shows = (href: string) => {
    const f = featuresFor(href);
    return f.length === 0 || f.some(has);
  };
  const scopes = SCOPES.filter((s) => HOME_TABS[s].some((t) => has(`employee:${s}:${t.key}`)));
  const modules: RailModule[] = ['home'];
  if (OPS.some((s) => s.items.some((i) => has(`employee:ops:${i.key}`)))) modules.push('operations');
  if (has(REPORTS)) modules.push('reports');
  if (perms.some((p) => p.startsWith('administration:'))) modules.push('administration');
  // The dashboard is everyone's landing page, so My Space stays even with no My Space grant.
  return { perms, modules, scopes: scopes.length ? scopes : ['my'], shows, allows: (id, a = 'view') => can(perms, id, a) };
}
