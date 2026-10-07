'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { EMPLOYEE_REQUESTS } from '@/lib/data';
import { EmployeeRequest } from '@/lib/types';

interface RequestsContextValue {
  requests: EmployeeRequest[];
  act: (id: string, status: EmployeeRequest['status']) => void;
}

const RequestsContext = createContext<RequestsContextValue | null>(null);

export function RequestsProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<EmployeeRequest[]>(EMPLOYEE_REQUESTS);

  const value = useMemo<RequestsContextValue>(
    () => ({
      requests,
      act: (id, status) => setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r))),
    }),
    [requests]
  );

  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

export function useRequests() {
  const ctx = useContext(RequestsContext);
  if (!ctx) throw new Error('useRequests must be used within RequestsProvider');
  return ctx;
}
