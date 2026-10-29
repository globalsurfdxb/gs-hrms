'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Location, Role } from '@/lib/types';
import { PERSONAS, employeeById } from '@/lib/data';
import { useAccount } from '@/lib/auth';
import { useOrg } from '@/context/OrgContext';
import { useEmployeeVersion } from '@/lib/employeeStore';

// The signed-in account (backend session, see lib/auth.ts) decides the user and role. Without a session the Super
// Admin account is used only as a harmless placeholder while the sign-in redirect happens — the shell draws nothing
// until signed in, and the server enforces the real grants on every call.
const FALLBACK_ROLE: Role = 'Super Admin';

interface AppContextValue {
  location: Location;
  setLocation: (l: Location) => void;
  role: Role;
  currentEmployeeId: string;
}

const AppContext = createContext<AppContextValue | null>(null);

const LOCATION_KEY = 'gsit.location';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { locations } = useOrg();
  const [location, setLocationState] = useState<Location>('Dubai');
  const account = useAccount();
  const role: Role = account?.role ?? FALLBACK_ROLE;
  const employeeId = account?.employee.id ?? PERSONAS[FALLBACK_ROLE].employeeId;

  // One-time sync from an external store (localStorage) on mount; SSR has no localStorage,
  // so this can't be a lazy useState initializer without a hydration mismatch.
  useEffect(() => {
    try {
      const l = localStorage.getItem(LOCATION_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (l && locations.some((x) => x.id === l)) setLocationState(l);
    } catch {
      // localStorage unavailable — fall back to defaults
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocation = (l: Location) => {
    setLocationState(l);
    try {
      localStorage.setItem(LOCATION_KEY, l);
    } catch {
      // ignore
    }
  };

  const value = useMemo<AppContextValue>(
    () => ({
      location,
      setLocation,
      role,
      currentEmployeeId: employeeId,
    }),
    [location, role, employeeId]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useCurrentEmployee() {
  const { currentEmployeeId } = useApp();
  useEmployeeVersion();
  return employeeById(currentEmployeeId)!;
}
