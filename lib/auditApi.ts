import { api, apiText } from '@/lib/api';

/* The backend audit log (GET /api/admin/audit, needs Audit Logs → View). Every change the server makes is recorded
   there in the same transaction; this is the read side. Local development only — see API_ENABLED. */

export interface AuditActor {
  /** null for system jobs and failed sign-ins */
  id: string | null;
  label: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: AuditActor;
  module: string;
  /** e.g. company.updated, auth.sign_in */
  action: string;
  entityType: string;
  entityId: string | null;
  /** Changed fields only, never decrypted sensitive values. */
  before: unknown;
  after: unknown;
  ip: string | null;
}

export interface AuditFilter {
  q?: string;
  module?: string;
  action?: string;
  actorId?: string;
  /** Day pickers (YYYY-MM-DD), read in the viewer's timezone. */
  fromDay?: string;
  toDay?: string;
}

/** The day pickers become instants at the start and end of the day where the viewer is. */
const query = (f: AuditFilter) => ({
  q: f.q?.trim() || undefined,
  module: f.module,
  action: f.action,
  actorId: f.actorId,
  from: f.fromDay ? new Date(`${f.fromDay}T00:00:00`).toISOString() : undefined,
  to: f.toDay ? new Date(`${f.toDay}T23:59:59.999`).toISOString() : undefined,
});

export const auditApi = {
  list: (f: AuditFilter, page: number, pageSize = 50) =>
    api<{ items: AuditEvent[]; total: number; page: number; pageSize: number }>('GET', '/admin/audit', undefined, { ...query(f), page, pageSize }),
  filters: () => api<{ modules: string[]; actions: string[]; actors: AuditActor[] }>('GET', '/admin/audit/filters'),
  /** At most 10,000 rows (400 audit.export_too_large). The server records the export itself. */
  exportCsv: (f: AuditFilter) => apiText('/admin/audit/export', query(f)),
};

/** "company.updated" → "Company updated", "auth.sign_in_failed" → "Sign in failed". */
export function actionLabel(action: string): string {
  const [area, verb] = action.includes('.') ? [action.slice(0, action.indexOf('.')), action.slice(action.indexOf('.') + 1)] : ['', action];
  const words = (area === 'auth' ? verb : `${area} ${verb}`).replace(/[_.]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A before/after value as one line: "status: ACTIVE · name: GS IT". */
export function changeText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'object') return String(v);
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}: ${x === null || x === undefined ? '—' : typeof x === 'object' ? JSON.stringify(x) : String(x)}`)
    .join(' · ');
}
