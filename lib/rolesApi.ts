import { api } from '@/lib/api';
import { AccessModule, buildCatalog, ExtraAction } from '@/lib/access';

/* Roles & Permissions from the backend (/api/iam/*). The server enforces the grants on every API call, audits every
   change (module Access) and signs out the members of a changed role so the change applies at once. It also refuses
   changes to your own role, grants you do not hold yourself, and changes to the Super Admin role. */

export interface ApiRole {
  id: string;
  name: string;
  description: string;
  system: boolean;
  permissions: string[];
  memberCount: number;
}

interface ApiCatalogModule {
  id: string;
  name: string;
  categories: { id: string; label: string; rank: number; features: { id: string; label: string; actions: ExtraAction[] }[] }[];
}

/** The server catalogue in the frontend's shape. Descriptions come from the local catalogue (same module ids). */
export async function fetchCatalog(): Promise<AccessModule[]> {
  const local = new Map(buildCatalog().map((m) => [m.id, m]));
  const modules = await api<ApiCatalogModule[]>('GET', '/iam/catalog');
  return modules.map((m) => ({
    id: m.id,
    name: m.name,
    desc: local.get(m.id)?.desc ?? '',
    common: local.get(m.id)?.common,
    categories: m.categories.map((c) => ({ id: c.id, label: c.label, rank: c.rank, features: c.features.map((f) => ({ id: f.id, label: f.label, actions: f.actions })) })),
  }));
}

export const rolesApi = {
  list: () => api<ApiRole[]>('GET', '/iam/roles'),
  create: (r: { name: string; description: string; permissions: string[] }) => api<ApiRole>('POST', '/iam/roles', r),
  update: (id: string, r: { name?: string; description?: string }) => api<ApiRole>('PATCH', `/iam/roles/${id}`, r),
  setPermissions: (id: string, permissions: string[]) =>
    api<{ role: ApiRole; granted: string[]; revoked: string[]; sessionsRevoked: number }>('PUT', `/iam/roles/${id}/permissions`, { permissions }),
  remove: (id: string) => api('DELETE', `/iam/roles/${id}`),
};
