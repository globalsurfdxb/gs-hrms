'use client';

import { createContext, useContext, useMemo } from 'react';
import { REFERENCE_TODAY } from '@/lib/data';
import { daysBetween } from '@/lib/dates';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { useExpiryVersion } from '@/lib/expiryRegister';
import { Employee, ExpiryState } from '@/lib/types';

/* Visa and Emirates ID dates are read straight from the employee record, the same place the shared expiry
   register (lib/expiryRegister) reads them, so a renewal recorded on any page shows everywhere. Reminders and
   renewal history live in ExpiryContext, which applies each document type's configured reminder schedule. */

interface VisaContextValue {
  visaExpiryOf: (e: Employee) => string | undefined;
  eidExpiryOf: (e: Employee) => string | undefined;
  daysLeft: (e: Employee) => number | null;
  stateOf: (e: Employee) => ExpiryState;
}

const VisaContext = createContext<VisaContextValue | null>(null);

export function VisaProvider({ children }: { children: React.ReactNode }) {
  const registerVersion = useExpiryVersion();
  const employeeVersion = useEmployeeVersion();

  const value = useMemo<VisaContextValue>(() => {
    void registerVersion;
    void employeeVersion;
    const visaExpiryOf = (e: Employee) => e.visaExpiry || undefined;
    const eidExpiryOf = (e: Employee) => e.profile.emiratesIdExpiry || undefined;
    const daysLeft = (e: Employee) => {
      const d = visaExpiryOf(e);
      return d ? daysBetween(REFERENCE_TODAY, d) : null;
    };
    const stateOf = (e: Employee): ExpiryState => {
      const n = daysLeft(e);
      if (n === null) return 'na';
      if (n < 0) return 'expired';
      return n <= 90 ? 'soon' : 'ok';
    };
    return { visaExpiryOf, eidExpiryOf, daysLeft, stateOf };
  }, [registerVersion, employeeVersion]);

  return <VisaContext.Provider value={value}>{children}</VisaContext.Provider>;
}

export function useVisa() {
  const ctx = useContext(VisaContext);
  if (!ctx) throw new Error('useVisa must be used within VisaProvider');
  return ctx;
}
