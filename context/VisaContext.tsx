'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { REFERENCE_TODAY } from '@/lib/data';
import { daysBetween } from '@/lib/dates';
import { Employee, ExpiryState } from '@/lib/types';

export const RUNGS = [90, 60, 30, 7];

export interface ReminderLog {
  id: string;
  employeeId: string;
  rung: number | null;
  sentOn: string;
  to: string[];
  expiry: string;
}

export interface RenewalLog {
  id: string;
  employeeId: string;
  previousExpiry: string;
  newExpiry: string;
  renewedOn: string;
  reference: string;
}

interface Override {
  visaExpiry?: string;
  eidExpiry?: string;
}

interface VisaContextValue {
  reminders: ReminderLog[];
  renewals: RenewalLog[];
  visaExpiryOf: (e: Employee) => string | undefined;
  eidExpiryOf: (e: Employee) => string | undefined;
  daysLeft: (e: Employee) => number | null;
  stateOf: (e: Employee) => ExpiryState;
  dueRung: (e: Employee) => number | null;
  isReminded: (e: Employee, rung: number) => boolean;
  lastReminder: (e: Employee) => ReminderLog | undefined;
  sendReminder: (e: Employee, rung: number | null) => void;
  sendDue: (list: Employee[]) => number;
  renew: (e: Employee, input: { newExpiry: string; eidExpiry?: string; reference: string }) => void;
  renewEid: (e: Employee, newExpiry: string) => void;
}

const VisaContext = createContext<VisaContextValue | null>(null);

const recipientsFor = (rung: number | null) => (rung === null || rung <= 30 ? ['Employee', 'HR', 'Reporting manager'] : ['Employee', 'HR']);

export function VisaProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [renewals, setRenewals] = useState<RenewalLog[]>([]);

  const value = useMemo<VisaContextValue>(() => {
    const visaExpiryOf = (e: Employee) => overrides[e.id]?.visaExpiry ?? e.visaExpiry;
    const eidExpiryOf = (e: Employee) => overrides[e.id]?.eidExpiry ?? e.profile.emiratesIdExpiry;
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
    const dueRung = (e: Employee) => {
      const n = daysLeft(e);
      if (n === null || n > 90) return null;
      if (n < 0) return 7;
      return [...RUNGS].sort((a, b) => a - b).find((r) => r >= n) ?? null;
    };
    const isReminded = (e: Employee, rung: number) => reminders.some((r) => r.employeeId === e.id && r.rung === rung && r.expiry === visaExpiryOf(e));
    const log = (e: Employee, rung: number | null): ReminderLog => ({
      id: `rem-${Date.now()}-${e.id}-${rung ?? 'm'}`,
      employeeId: e.id,
      rung,
      sentOn: REFERENCE_TODAY,
      to: recipientsFor(rung),
      expiry: visaExpiryOf(e) ?? '',
    });
    return {
      reminders,
      renewals,
      visaExpiryOf,
      eidExpiryOf,
      daysLeft,
      stateOf,
      dueRung,
      isReminded,
      lastReminder: (e) => [...reminders].reverse().find((r) => r.employeeId === e.id),
      sendReminder: (e, rung) => setReminders((prev) => [...prev, log(e, rung)]),
      sendDue: (list) => {
        const fresh = list.filter((e) => {
          const r = dueRung(e);
          return r !== null && !isReminded(e, r);
        });
        setReminders((prev) => [...prev, ...fresh.map((e) => log(e, dueRung(e)))]);
        return fresh.length;
      },
      renewEid: (e, newExpiry) => setOverrides((prev) => ({ ...prev, [e.id]: { ...prev[e.id], eidExpiry: newExpiry } })),
      renew: (e, { newExpiry, eidExpiry, reference }) => {
        setOverrides((prev) => ({ ...prev, [e.id]: { ...prev[e.id], visaExpiry: newExpiry, ...(eidExpiry ? { eidExpiry } : {}) } }));
        setRenewals((prev) => [
          ...prev,
          { id: `ren-${Date.now()}-${e.id}`, employeeId: e.id, previousExpiry: visaExpiryOf(e) ?? '—', newExpiry, renewedOn: REFERENCE_TODAY, reference: reference.trim() },
        ]);
      },
    };
  }, [overrides, reminders, renewals]);

  return <VisaContext.Provider value={value}>{children}</VisaContext.Provider>;
}

export function useVisa() {
  const ctx = useContext(VisaContext);
  if (!ctx) throw new Error('useVisa must be used within VisaProvider');
  return ctx;
}
