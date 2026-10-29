import { api } from '@/lib/api';
import { Company, Department, Designation, LocationDef } from '@/lib/types';

/* Organization master data from the backend (/api/org/*) mapped to the frontend's own types, so the screens that read
   OrgContext do not change. Response shapes: docs/api/openapi.json in gs-hrms-backend. */

interface ApiLocation {
  id: string;
  name: string;
  city: string;
  currency: string;
  timezone: string;
  phoneCode: string;
  phoneDigits: number;
  phoneExample: string | null;
  workingHours: string;
  seating: string[];
  template: 'UAE' | 'INDIA';
  system: boolean;
}

interface ApiCompany {
  id: string;
  name: string;
  shortCode: string;
  description: string;
  website: string;
  location: string;
  established: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

interface ApiDepartment {
  id: string;
  companyId: string;
  name: string;
  locationIds: string[];
  head: { id: string; employeeCode: string; fullName: string } | null;
}

interface ApiDesignation {
  id: string;
  departmentId: string;
  title: string;
}

const toLocation = (l: ApiLocation): LocationDef => ({
  id: l.id,
  name: l.name,
  city: l.city,
  currency: l.currency,
  timezone: l.timezone,
  phoneCode: l.phoneCode,
  phoneDigits: l.phoneDigits,
  phoneExample: l.phoneExample ?? undefined,
  workingHours: l.workingHours,
  seating: l.seating,
  template: l.template === 'INDIA' ? 'india' : 'uae',
  system: l.system,
});

const toCompany = (c: ApiCompany): Company => ({
  id: c.id,
  name: c.name,
  shortCode: c.shortCode,
  description: c.description,
  website: c.website,
  location: c.location,
  established: c.established ?? '',
  status: c.status === 'ACTIVE' ? 'Active' : 'Inactive',
});

// The head is a person; until the employees module exists only its name is shown (frontend `head` is a name).
const toDepartment = (d: ApiDepartment): Department => ({
  id: d.id,
  companyId: d.companyId,
  name: d.name,
  locations: d.locationIds,
  head: d.head?.fullName ?? 'Unassigned',
});

const toDesignation = (d: ApiDesignation): Designation => ({ id: d.id, departmentId: d.departmentId, title: d.title });

export interface OrgData {
  locations: LocationDef[];
  companies: Company[];
  departments: Department[];
  designations: Designation[];
}

export async function fetchOrg(): Promise<OrgData> {
  const [locations, companies, departments, designations] = await Promise.all([
    api<ApiLocation[]>('GET', '/org/locations'),
    api<ApiCompany[]>('GET', '/org/companies'),
    api<ApiDepartment[]>('GET', '/org/departments'),
    api<ApiDesignation[]>('GET', '/org/designations'),
  ]);
  return {
    locations: locations.map(toLocation),
    companies: companies.map(toCompany),
    departments: departments.map(toDepartment),
    designations: designations.map(toDesignation),
  };
}

const locationBody = (l: Omit<LocationDef, 'id' | 'system'>) => ({
  name: l.name,
  city: l.city,
  currency: l.currency,
  timezone: l.timezone,
  phoneCode: l.phoneCode,
  phoneDigits: l.phoneDigits,
  phoneExample: l.phoneExample || undefined,
  workingHours: l.workingHours,
  seating: l.seating,
  template: l.template === 'india' ? 'INDIA' : 'UAE',
});

// An empty "established" is left out: the API takes a four-digit year or nothing.
const companyBody = (c: Omit<Company, 'id'>) => ({
  name: c.name,
  shortCode: c.shortCode,
  description: c.description,
  website: c.website,
  location: c.location,
  established: c.established || undefined,
});

export const orgApi = {
  addLocation: (l: Omit<LocationDef, 'id' | 'system'>) => api('POST', '/org/locations', locationBody(l)),
  updateLocation: (l: LocationDef) => api('PATCH', `/org/locations/${encodeURIComponent(l.id)}`, locationBody(l)),
  removeLocation: (id: string) => api('DELETE', `/org/locations/${encodeURIComponent(id)}`),

  addCompany: (c: Omit<Company, 'id'>) => api('POST', '/org/companies', companyBody(c)),
  updateCompany: (c: Company) =>
    api('PATCH', `/org/companies/${c.id}`, { ...companyBody(c), status: c.status === 'Active' ? 'ACTIVE' : 'INACTIVE' }),
  removeCompany: (id: string) => api('DELETE', `/org/companies/${id}`),

  // The head is not sent: the API needs an employee id, which the frontend does not have until employees are connected.
  addDepartment: (d: Omit<Department, 'id'>) => api('POST', '/org/departments', { companyId: d.companyId, name: d.name, locationIds: d.locations }),
  updateDepartment: (d: Department) => api('PATCH', `/org/departments/${d.id}`, { name: d.name, locationIds: d.locations }),
  removeDepartment: (id: string) => api('DELETE', `/org/departments/${id}`),

  addDesignation: (d: Omit<Designation, 'id'>) => api('POST', '/org/designations', { departmentId: d.departmentId, title: d.title }),
  updateDesignation: (d: Designation) => api('PATCH', `/org/designations/${d.id}`, { title: d.title }),
  removeDesignation: (id: string) => api('DELETE', `/org/designations/${id}`),
};
