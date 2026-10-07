'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { REFERENCE_TODAY } from '@/lib/data';
import { daysBetween } from '@/lib/dates';
import { RUNGS, useVisa } from '@/context/VisaContext';
import { Employee, ExpiryState } from '@/lib/types';

export interface DocRow {
  key: string;
  employee: Employee;
  docId: string;
  type: string;
  expiry: string;
  custom: boolean;
}

interface ExtraDoc {
  id: string;
  employeeId: string;
  type: string;
  expiryDate: string;
}

export interface DocReminder {
  id: string;
  key: string;
  employeeId: string;
  type: string;
  rung: number | null;
  sentOn: string;
  to: string[];
  expiry: string;
}

export interface DocRenewal {
  id: string;
  employeeId: string;
  type: string;
  previousExpiry: string;
  newExpiry: string;
  renewedOn: string;
  reference: string;
}

interface ExpiryContextValue {
  reminders: DocReminder[];
  renewals: DocRenewal[];
  rowsFor: (employees: Employee[]) => DocRow[];
  daysOf: (r: DocRow) => number;
  stateOf: (r: DocRow) => ExpiryState;
  dueRung: (r: DocRow) => number | null;
  isReminded: (r: DocRow, rung: number) => boolean;
  lastReminder: (r: DocRow) => DocReminder | undefined;
  sendReminder: (r: DocRow, rung: number | null) => void;
  sendDue: (rows: DocRow[]) => number;
  renew: (r: DocRow, input: { newExpiry: string; reference: string }) => void;
  addDoc: (input: { employeeId: string; type: string; expiryDate: string }) => void;
}

const ExpiryContext = createContext<ExpiryContextValue | null>(null);

const recipientsFor = (rung: number | null) => (rung === null || rung <= 30 ? ['Employee', 'HR', 'Reporting manager'] : ['Employee', 'HR']);

export function ExpiryProvider({ children }: { children: React.ReactNode }) {
  const visa = useVisa();
  const [extra, setExtra] = useState<ExtraDoc[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [reminders, setReminders] = useState<DocReminder[]>([]);
  const [renewals, setRenewals] = useState<DocRenewal[]>([]);

  const value = useMemo<ExpiryContextValue>(() => {
    const keyOf = (employeeId: string, docId: string) => `${employeeId}:${docId}`;
    const rowsFor = (employees: Employee[]): DocRow[] =>
      employees.flatMap((e) => {
        const base = e.documents
          .filter((d) => d.expiryDate)
          .map((d) => {
            const key = keyOf(e.id, d.id);
            const expiry = d.type === 'Residence Visa' ? visa.visaExpiryOf(e) : d.type === 'Emirates ID' ? visa.eidExpiryOf(e) : undefined;
            return { key, employee: e, docId: d.id, type: d.type, expiry: expiry ?? overrides[key] ?? d.expiryDate!, custom: false };
          });
        const added = extra
          .filter((x) => x.employeeId === e.id)
          .map((x) => {
            const key = keyOf(e.id, x.id);
            return { key, employee: e, docId: x.id, type: x.type, expiry: overrides[key] ?? x.expiryDate, custom: true };
          });
        return [...base, ...added];
      });

    const daysOf = (r: DocRow) => daysBetween(REFERENCE_TODAY, r.expiry);
    const stateOf = (r: DocRow): ExpiryState => {
      const n = daysOf(r);
      return n < 0 ? 'expired' : n <= 90 ? 'soon' : 'ok';
    };
    const dueRung = (r: DocRow) => {
      const n = daysOf(r);
      if (n > 90) return null;
      if (n < 0) return 7;
      return [...RUNGS].sort((a, b) => a - b).find((x) => x >= n) ?? null;
    };
    const isVisa = (r: DocRow) => !r.custom && r.type === 'Residence Visa';
    const isReminded = (r: DocRow, rung: number) => (isVisa(r) ? visa.isReminded(r.employee, rung) : reminders.some((x) => x.key === r.key && x.rung === rung && x.expiry === r.expiry));
    const entry = (r: DocRow, rung: number | null): DocReminder => ({
      id: `drem-${Date.now()}-${r.key}-${rung ?? 'm'}`,
      key: r.key,
      employeeId: r.employee.id,
      type: r.type,
      rung,
      sentOn: REFERENCE_TODAY,
      to: recipientsFor(rung),
      expiry: r.expiry,
    });
    const send = (r: DocRow, rung: number | null) => {
      if (isVisa(r)) visa.sendReminder(r.employee, rung);
      return entry(r, rung);
    };

    return {
      reminders,
      renewals,
      rowsFor,
      daysOf,
      stateOf,
      dueRung,
      isReminded,
      lastReminder: (r) =>
        [...reminders].reverse().find((x) => x.key === r.key && x.expiry === r.expiry) ??
        (isVisa(r) ? (() => {
          const v = visa.lastReminder(r.employee);
          return v && v.expiry === r.expiry ? ({ id: v.id, key: r.key, employeeId: v.employeeId, type: r.type, rung: v.rung, sentOn: v.sentOn, to: v.to, expiry: v.expiry } as DocReminder) : undefined;
        })() : undefined),
      sendReminder: (r, rung) => {
        const sent = send(r, rung);
        setReminders((prev) => [...prev, sent]);
      },
      sendDue: (rows) => {
        const fresh = rows.filter((r) => {
          const rung = dueRung(r);
          return rung !== null && !isReminded(r, rung);
        });
        const sent = fresh.map((r) => send(r, dueRung(r)));
        setReminders((prev) => [...prev, ...sent]);
        return fresh.length;
      },
      renew: (r, { newExpiry, reference }) => {
        if (!r.custom && r.type === 'Residence Visa') visa.renew(r.employee, { newExpiry, reference });
        else if (!r.custom && r.type === 'Emirates ID') visa.renewEid(r.employee, newExpiry);
        else setOverrides((prev) => ({ ...prev, [r.key]: newExpiry }));
        setRenewals((prev) => [
          ...prev,
          { id: `dren-${Date.now()}-${r.key}`, employeeId: r.employee.id, type: r.type, previousExpiry: r.expiry, newExpiry, renewedOn: REFERENCE_TODAY, reference: reference.trim() },
        ]);
      },
      addDoc: ({ employeeId, type, expiryDate }) => setExtra((prev) => [...prev, { id: `xd-${Date.now()}`, employeeId, type, expiryDate }]),
    };
  }, [visa, extra, overrides, reminders, renewals]);

  return <ExpiryContext.Provider value={value}>{children}</ExpiryContext.Provider>;
}

export function useExpiry() {
  const ctx = useContext(ExpiryContext);
  if (!ctx) throw new Error('useExpiry must be used within ExpiryProvider');
  return ctx;
}
