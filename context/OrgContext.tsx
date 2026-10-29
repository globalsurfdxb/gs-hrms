'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { COMPANIES, DEPARTMENTS, DESIGNATIONS, EMPLOYEES, LOCATIONS } from '@/lib/data';
import { Company, Department, Designation, LocationDef } from '@/lib/types';
import { logTask } from '@/lib/activity';
import { useAuth } from '@/lib/auth';
import { fetchOrg, orgApi } from '@/lib/orgApi';
import { API_ENABLED } from '@/lib/api';
import { useHiring } from '@/lib/hiringStore';

/* Organization master data. Read from the backend (/api/org/*) once someone is signed in; before that (the sign-in and
   public careers pages) — and if the backend cannot be read — the mock data from lib/data.ts is used. Changes go to
   the API when connected (it validates, audits and may refuse them: the promise rejects with an ApiError). */

interface OrgContextValue {
  /** true when the data below comes from the backend. */
  connected: boolean;
  locations: LocationDef[];
  locationName: (id: string) => string;
  locationsLabel: (ids: string[]) => string;
  locationDef: (id: string) => LocationDef | undefined;
  addLocation: (l: Omit<LocationDef, 'id' | 'system'>) => Promise<void>;
  updateLocation: (l: LocationDef) => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
  locationUsage: (id: string) => { companies: number; departments: number; employees: number };
  companies: Company[];
  departments: Department[];
  designations: Designation[];
  addCompany: (c: Omit<Company, 'id'>) => Promise<void>;
  updateCompany: (c: Company) => Promise<void>;
  removeCompany: (id: string) => Promise<void>;
  addDepartment: (d: Omit<Department, 'id'>) => Promise<void>;
  updateDepartment: (d: Department) => Promise<void>;
  removeDepartment: (id: string) => Promise<void>;
  addDesignation: (d: Omit<Designation, 'id'>) => Promise<void>;
  updateDesignation: (d: Designation) => Promise<void>;
  removeDesignation: (id: string) => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<LocationDef[]>(LOCATIONS);
  const [companies, setCompanies] = useState<Company[]>(COMPANIES);
  const [departments, setDepartments] = useState<Department[]>(DEPARTMENTS);
  const [designations, setDesignations] = useState<Designation[]>(DESIGNATIONS);
  const [connected, setConnected] = useState(false);

  // Re-read whenever a different person signs in.
  const { status, user } = useAuth();
  const signedIn = status === 'in' ? (user?.employeeCode ?? null) : null;

  const apply = useCallback((org: Awaited<ReturnType<typeof fetchOrg>>) => {
    setLocations(org.locations);
    setCompanies(org.companies);
    setDepartments(org.departments);
    setDesignations(org.designations);
    setConnected(true);
  }, []);
  const reload = useCallback(async () => apply(await fetchOrg()), [apply]);

  useEffect(() => {
    if (!signedIn || !API_ENABLED) return;
    let cancelled = false;
    fetchOrg()
      .then((org) => !cancelled && apply(org))
      .catch((e) => console.warn('[OrgContext] using mock data — the backend could not be read:', e));
    return () => {
      cancelled = true;
    };
  }, [signedIn, apply]);

  // When connected, write through the API and re-read; otherwise change the local mock state as before.
  const write = useCallback(
    async (call: () => Promise<unknown>, local: () => void) => {
      if (!connected) return local();
      await call();
      await reload();
    },
    [connected, reload],
  );

  // A designation asked for on a requisition joins its department once the requisition has been fully approved.
  const { requisitions } = useHiring();
  const [seenRequisitions, setSeenRequisitions] = useState<typeof requisitions | null>(null);
  if (seenRequisitions !== requisitions) {
    setSeenRequisitions(requisitions);
    const approved = requisitions.filter((r) => r.newDesignation && r.designationTitle && r.departmentId && r.approvals.length > 0 && r.approvals.every((x) => x.status === 'Approved'));
    const have = (list: Designation[], r: (typeof approved)[number]) => list.some((d) => d.departmentId === r.departmentId && d.title.toLowerCase() === r.designationTitle!.toLowerCase());
    const add = approved.filter((r, i) => !have(designations, r) && approved.findIndex((x) => x.departmentId === r.departmentId && x.designationTitle!.toLowerCase() === r.designationTitle!.toLowerCase()) === i);
    if (add.length) setDesignations([...designations, ...add.map((r) => ({ id: `des-${r.id}`, departmentId: r.departmentId, title: r.designationTitle! }))]);
  }

  const value = useMemo<OrgContextValue>(
    () => ({
      connected,
      locations,
      locationName: (id) => (id === 'Both' ? 'All locations' : locations.find((l) => l.id === id)?.name ?? id),
      locationsLabel: (ids) => (ids.length > 1 && locations.every((l) => ids.includes(l.id)) ? 'All locations' : ids.map((id) => locations.find((l) => l.id === id)?.name ?? id).join(', ') || 'No location'),
      locationDef: (id) => locations.find((l) => l.id === id),
      addLocation: async (l) => {
        await write(() => orgApi.addLocation(l), () => setLocations((p) => [...p, { ...l, id: `loc-${Date.now()}`, system: false }]));
        logTask('Organization', 'Location added', l.name, `${l.name} (${l.currency})`);
      },
      updateLocation: async (l) => {
        await write(() => orgApi.updateLocation(l), () => setLocations((p) => p.map((x) => (x.id === l.id ? l : x))));
        logTask('Organization', 'Location changed', l.name, 'Details updated');
      },
      removeLocation: async (id) => {
        const l = locations.find((x) => x.id === id);
        await write(() => orgApi.removeLocation(id), () => setLocations((p) => p.filter((x) => x.id !== id || x.system)));
        if (l && !l.system) logTask('Organization', 'Location removed', l.name, 'Removed');
      },
      locationUsage: (id) => ({
        companies: companies.filter((c) => c.location === id).length,
        departments: departments.filter((d) => d.locations.includes(id)).length,
        employees: EMPLOYEES.filter((e) => e.location === id).length,
      }),
      companies,
      departments,
      designations,
      addCompany: async (c) => {
        await write(() => orgApi.addCompany(c), () => setCompanies((p) => [...p, { ...c, id: `co-${Date.now()}` }]));
        logTask('Organization', 'Company added', c.name, c.name);
      },
      updateCompany: async (c) => {
        await write(() => orgApi.updateCompany(c), () => setCompanies((p) => p.map((x) => (x.id === c.id ? c : x))));
        logTask('Organization', 'Company changed', c.name, 'Details updated');
      },
      removeCompany: async (id) => {
        const co = companies.find((x) => x.id === id);
        await write(
          () => orgApi.removeCompany(id),
          () => {
            const deptIds = new Set(departments.filter((d) => d.companyId === id).map((d) => d.id));
            setCompanies((p) => p.filter((x) => x.id !== id));
            setDepartments((p) => p.filter((d) => d.companyId !== id));
            setDesignations((p) => p.filter((d) => !deptIds.has(d.departmentId)));
          },
        );
        if (co) logTask('Organization', 'Company removed', co.name, 'Company, its departments and designations removed');
      },
      addDepartment: async (d) => {
        await write(() => orgApi.addDepartment(d), () => setDepartments((p) => [...p, { ...d, id: `dep-${Date.now()}` }]));
        logTask('Organization', 'Department added', d.name, `${d.name} in ${companies.find((c) => c.id === d.companyId)?.name ?? ''}`);
      },
      updateDepartment: async (d) => {
        await write(() => orgApi.updateDepartment(d), () => setDepartments((p) => p.map((x) => (x.id === d.id ? d : x))));
        logTask('Organization', 'Department changed', d.name, 'Details updated');
      },
      removeDepartment: async (id) => {
        const dep = departments.find((x) => x.id === id);
        await write(
          () => orgApi.removeDepartment(id),
          () => {
            setDepartments((p) => p.filter((d) => d.id !== id));
            setDesignations((p) => p.filter((d) => d.departmentId !== id));
          },
        );
        if (dep) logTask('Organization', 'Department removed', dep.name, 'Department and its designations removed');
      },
      addDesignation: async (d) => {
        await write(() => orgApi.addDesignation(d), () => setDesignations((p) => [...p, { ...d, id: `des-${Date.now()}` }]));
        logTask('Organization', 'Designation added', d.title, d.title);
      },
      updateDesignation: async (d) => {
        await write(() => orgApi.updateDesignation(d), () => setDesignations((p) => p.map((x) => (x.id === d.id ? d : x))));
        logTask('Organization', 'Designation changed', d.title, 'Title updated');
      },
      removeDesignation: async (id) => {
        const des = designations.find((x) => x.id === id);
        await write(() => orgApi.removeDesignation(id), () => setDesignations((p) => p.filter((d) => d.id !== id)));
        if (des) logTask('Organization', 'Designation removed', des.title, 'Removed');
      },
    }),
    [connected, write, locations, companies, departments, designations]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
