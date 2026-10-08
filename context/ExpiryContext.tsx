'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { REFERENCE_TODAY, employeeById } from '@/lib/data';
import { addDays, daysBetween } from '@/lib/dates';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { DocRow, EID, VISA, addDatedDocument, registerFor, setExpiry, useExpiryVersion } from '@/lib/expiryRegister';
import { ladderFor, useReminderSchedules } from '@/lib/reminderRules';
import { Employee, ExpiryState } from '@/lib/types';

export type { DocRow };
export { complianceIssues, complianceLabel, complianceShort } from '@/lib/expiryRegister';

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

/** What the "Reminder" column says about a document. */
export interface ReminderInfo {
  tone: 'due' | 'sent' | 'next' | 'escalated' | 'off' | 'none';
  text: string;
  sub?: string;
}

interface ExpiryContextValue {
  reminders: DocReminder[];
  renewals: DocRenewal[];
  rowsFor: (employees: Employee[]) => DocRow[];
  daysOf: (r: DocRow) => number;
  stateOf: (r: DocRow) => ExpiryState;
  /** This document type's notice windows from Administration → Reminders, smallest first (empty when switched off). */
  ladderOf: (r: DocRow) => number[];
  /** The notice window the document is in now, or null when it is outside its ladder or already expired. */
  dueRung: (r: DocRow) => number | null;
  /** Window used for grouping: the notice window, or 0 once expired (escalated). */
  windowOf: (r: DocRow) => number | null;
  isReminded: (r: DocRow, rung: number) => boolean;
  lastReminder: (r: DocRow) => DocReminder | undefined;
  reminderInfo: (r: DocRow) => ReminderInfo;
  sendReminder: (r: DocRow, rung: number | null) => void;
  sendDue: (rows: DocRow[]) => number;
  renew: (r: DocRow, input: { newExpiry: string; reference: string; eidExpiry?: string }) => void;
  addDoc: (input: { employeeId: string; type: string; expiryDate: string }) => void;
}

const ExpiryContext = createContext<ExpiryContextValue | null>(null);

const recipientsFor = (rung: number | null) => (rung === null || rung <= 30 ? ['Employee', 'HR', 'Reporting manager'] : ['Employee', 'HR']);

export function ExpiryProvider({ children }: { children: React.ReactNode }) {
  const schedules = useReminderSchedules();
  const registerVersion = useExpiryVersion();
  const employeeVersion = useEmployeeVersion();
  const [reminders, setReminders] = useState<DocReminder[]>([]);
  const [renewals, setRenewals] = useState<DocRenewal[]>([]);

  const value = useMemo<ExpiryContextValue>(() => {
    void registerVersion;
    void employeeVersion;
    const daysOf = (r: DocRow) => daysBetween(REFERENCE_TODAY, r.expiry);
    const stateOf = (r: DocRow): ExpiryState => {
      const n = daysOf(r);
      return n < 0 ? 'expired' : n <= 90 ? 'soon' : 'ok';
    };
    const ladderOf = (r: DocRow) => ladderFor(schedules, r.type);
    const dueRung = (r: DocRow) => {
      const n = daysOf(r);
      if (n < 0) return null;
      return ladderOf(r).find((x) => x >= n) ?? null;
    };
    const windowOf = (r: DocRow) => (daysOf(r) < 0 ? 0 : dueRung(r));
    const isReminded = (r: DocRow, rung: number) => reminders.some((x) => x.key === r.key && x.rung === rung && x.expiry === r.expiry);
    const lastReminder = (r: DocRow) => [...reminders].reverse().find((x) => x.key === r.key && x.expiry === r.expiry);
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

    const reminderInfo = (r: DocRow): ReminderInfo => {
      const n = daysOf(r);
      const last = lastReminder(r);
      const lastText = last ? `Last notice ${last.sentOn}${last.rung ? ` · ${last.rung}-day` : ' · manual'}` : undefined;
      if (n < 0) return { tone: 'escalated', text: 'Expired — escalated to HR / manager', sub: `${-n} day${n === -1 ? '' : 's'} overdue${lastText ? ` · ${lastText.toLowerCase()}` : ''}` };
      const ladder = ladderOf(r);
      if (!ladder.length) return { tone: 'off', text: 'Reminders off', sub: 'Switched off in Administration → Reminders' };
      const due = dueRung(r);
      if (due !== null && !isReminded(r, due)) return { tone: 'due', text: `Due: ${due}-day notice` };
      if (last) return { tone: 'sent', text: `Sent ${last.sentOn}${last.rung ? ` · ${last.rung}-day` : ' · manual'}` };
      const first = ladder[ladder.length - 1];
      if (n > first) return { tone: 'next', text: `Next: ${first}-day on ${addDays(r.expiry, -first)}` };
      return { tone: 'none', text: '—' };
    };

    return {
      reminders,
      renewals,
      rowsFor: registerFor,
      daysOf,
      stateOf,
      ladderOf,
      dueRung,
      windowOf,
      isReminded,
      lastReminder,
      reminderInfo,
      sendReminder: (r, rung) => setReminders((prev) => [...prev, entry(r, rung)]),
      sendDue: (rows) => {
        const fresh = rows.filter((r) => {
          const rung = dueRung(r);
          return rung !== null && !isReminded(r, rung);
        });
        setReminders((prev) => [...prev, ...fresh.map((r) => entry(r, dueRung(r)))]);
        return fresh.length;
      },
      renew: (r, { newExpiry, reference, eidExpiry }) => {
        const log = (row: { key: string; type: string }, previousExpiry: string, expiry: string): DocRenewal => ({
          id: `dren-${Date.now()}-${row.key}`,
          employeeId: r.employee.id,
          type: row.type,
          previousExpiry,
          newExpiry: expiry,
          renewedOn: REFERENCE_TODAY,
          reference: reference.trim(),
        });
        const logs = [log(r, r.expiry, newExpiry)];
        if (r.type === VISA && eidExpiry) {
          const eid = registerFor([r.employee]).find((x) => x.type === EID);
          logs.push(log({ key: eid?.key ?? `${r.employee.id}:id-eid`, type: EID }, eid?.expiry ?? '—', eidExpiry));
          setExpiry(r.employee, EID, eidExpiry);
        }
        setExpiry(r.employee, r.type, newExpiry, r.docId);
        setRenewals((prev) => [...prev, ...logs]);
      },
      addDoc: ({ employeeId, type, expiryDate }) => {
        const e = employeeById(employeeId);
        if (e) addDatedDocument(e, type, expiryDate);
      },
    };
  }, [schedules, registerVersion, employeeVersion, reminders, renewals]);

  return <ExpiryContext.Provider value={value}>{children}</ExpiryContext.Provider>;
}

export function useExpiry() {
  const ctx = useContext(ExpiryContext);
  if (!ctx) throw new Error('useExpiry must be used within ExpiryProvider');
  return ctx;
}
