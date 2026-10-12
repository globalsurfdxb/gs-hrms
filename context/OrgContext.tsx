'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { COMPANIES, DEPARTMENTS, DESIGNATIONS, EMPLOYEES, LOCATIONS } from '@/lib/data';
import { Company, Department, Designation, LocationDef } from '@/lib/types';
import { logTask } from '@/lib/activity';

interface OrgContextValue {
  locations: LocationDef[];
  locationName: (id: string) => string;
  locationsLabel: (ids: string[]) => string;
  locationDef: (id: string) => LocationDef | undefined;
  addLocation: (l: Omit<LocationDef, 'id' | 'system'>) => void;
  updateLocation: (l: LocationDef) => void;
  removeLocation: (id: string) => void;
  locationUsage: (id: string) => { companies: number; departments: number; employees: number };
  companies: Company[];
  departments: Department[];
  designations: Designation[];
  addCompany: (c: Omit<Company, 'id'>) => void;
  updateCompany: (c: Company) => void;
  removeCompany: (id: string) => void;
  addDepartment: (d: Omit<Department, 'id'>) => void;
  updateDepartment: (d: Department) => void;
  removeDepartment: (id: string) => void;
  addDesignation: (d: Omit<Designation, 'id'>) => void;
  updateDesignation: (d: Designation) => void;
  removeDesignation: (id: string) => void;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<LocationDef[]>(LOCATIONS);
  const [companies, setCompanies] = useState<Company[]>(COMPANIES);
  const [departments, setDepartments] = useState<Department[]>(DEPARTMENTS);
  const [designations, setDesignations] = useState<Designation[]>(DESIGNATIONS);

  const value = useMemo<OrgContextValue>(
    () => ({
      locations,
      locationName: (id) => (id === 'Both' ? 'All locations' : locations.find((l) => l.id === id)?.name ?? id),
      locationsLabel: (ids) => (ids.length > 1 && locations.every((l) => ids.includes(l.id)) ? 'All locations' : ids.map((id) => locations.find((l) => l.id === id)?.name ?? id).join(', ') || 'No location'),
      locationDef: (id) => locations.find((l) => l.id === id),
      addLocation: (l) => {
        logTask('Organization', 'Location added', l.name, `${l.name} (${l.currency})`);
        setLocations((p) => [...p, { ...l, id: `loc-${Date.now()}`, system: false }]);
      },
      updateLocation: (l) => {
        logTask('Organization', 'Location changed', l.name, 'Details updated');
        setLocations((p) => p.map((x) => (x.id === l.id ? l : x)));
      },
      removeLocation: (id) => {
        const l = locations.find((x) => x.id === id);
        if (l && !l.system) logTask('Organization', 'Location removed', l.name, 'Removed');
        setLocations((p) => p.filter((x) => x.id !== id || x.system));
      },
      locationUsage: (id) => ({
        companies: companies.filter((c) => c.location === id).length,
        departments: departments.filter((d) => d.locations.includes(id)).length,
        employees: EMPLOYEES.filter((e) => e.location === id).length,
      }),
      companies,
      departments,
      designations,
      addCompany: (c) => {
        logTask('Organization', 'Company added', c.name, c.name);
        setCompanies((p) => [...p, { ...c, id: `co-${Date.now()}` }]);
      },
      updateCompany: (c) => {
        logTask('Organization', 'Company changed', c.name, 'Details updated');
        setCompanies((p) => p.map((x) => (x.id === c.id ? c : x)));
      },
      removeCompany: (id) => {
        const co = companies.find((x) => x.id === id);
        if (co) logTask('Organization', 'Company removed', co.name, 'Company, its departments and designations removed');
        const deptIds = new Set(departments.filter((d) => d.companyId === id).map((d) => d.id));
        setCompanies((p) => p.filter((x) => x.id !== id));
        setDepartments((p) => p.filter((d) => d.companyId !== id));
        setDesignations((p) => p.filter((d) => !deptIds.has(d.departmentId)));
      },
      addDepartment: (d) => {
        logTask('Organization', 'Department added', d.name, `${d.name} in ${companies.find((c) => c.id === d.companyId)?.name ?? ''}`);
        setDepartments((p) => [...p, { ...d, id: `dep-${Date.now()}` }]);
      },
      updateDepartment: (d) => {
        logTask('Organization', 'Department changed', d.name, 'Details updated');
        setDepartments((p) => p.map((x) => (x.id === d.id ? d : x)));
      },
      removeDepartment: (id) => {
        const dep = departments.find((x) => x.id === id);
        if (dep) logTask('Organization', 'Department removed', dep.name, 'Department and its designations removed');
        setDepartments((p) => p.filter((d) => d.id !== id));
        setDesignations((p) => p.filter((d) => d.departmentId !== id));
      },
      addDesignation: (d) => {
        logTask('Organization', 'Designation added', d.title, d.title);
        setDesignations((p) => [...p, { ...d, id: `des-${Date.now()}` }]);
      },
      updateDesignation: (d) => {
        logTask('Organization', 'Designation changed', d.title, 'Title updated');
        setDesignations((p) => p.map((x) => (x.id === d.id ? d : x)));
      },
      removeDesignation: (id) => {
        const des = designations.find((x) => x.id === id);
        if (des) logTask('Organization', 'Designation removed', des.title, 'Removed');
        setDesignations((p) => p.filter((d) => d.id !== id));
      },
    }),
    [locations, companies, departments, designations]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
