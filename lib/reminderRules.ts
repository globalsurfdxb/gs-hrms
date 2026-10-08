import { useSyncExternalStore } from 'react';

/* The reminder schedules configured in Administration → Reminders. One module-level store, so the admin screen
   (which edits it) and the expiry registers (which read it) always agree on how many days before expiry each
   document type is reminded. */

export interface ReminderSchedule {
  key: string;
  title: string;
  /** Days before expiry at which a notice is sent. */
  rungs: number[];
  on: boolean;
  /** Document types this schedule governs. The schedule with no types is the fallback for everything else. */
  types: string[];
}

export const DEFAULT_SCHEDULES: ReminderSchedule[] = [
  { key: 'visa', title: 'Residence Visa / Emirates ID', rungs: [90, 60, 30, 7], on: true, types: ['Residence Visa', 'Emirates ID', 'Work Permit'] },
  { key: 'passport', title: 'Passport', rungs: [90, 30], on: true, types: ['Passport'] },
  { key: 'labour', title: 'Labour Card', rungs: [60, 30, 7], on: true, types: ['Labour Card'] },
  { key: 'licence', title: 'Trade Licence', rungs: [90, 60, 30], on: true, types: ['Trade Licence', 'Professional Licence'] },
  { key: 'contract', title: 'Employment Contract Renewal', rungs: [60, 30], on: false, types: ['Employment Contract'] },
  { key: 'general', title: 'Other dated documents', rungs: [60, 30, 7], on: true, types: [] },
];

let schedules: ReminderSchedule[] = DEFAULT_SCHEDULES.map((s) => ({ ...s, rungs: [...s.rungs], types: [...s.types] }));
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const snapshot = () => schedules;
const serverSnapshot = () => DEFAULT_SCHEDULES;

export function setScheduleOn(key: string, on: boolean) {
  schedules = schedules.map((s) => (s.key === key ? { ...s, on } : s));
  listeners.forEach((l) => l());
}

/** The live schedules; re-renders the caller when one is switched on or off. */
export function useReminderSchedules() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** The schedule that governs a document type (its own, else the "other documents" fallback). */
export function scheduleFor(list: ReminderSchedule[], type: string): ReminderSchedule | undefined {
  const t = type.trim().toLowerCase();
  return list.find((s) => s.types.some((x) => x.toLowerCase() === t)) ?? list.find((s) => s.types.length === 0);
}

/** Notice windows for a document type, smallest first. Empty when its schedule is switched off. */
export function ladderFor(list: ReminderSchedule[], type: string): number[] {
  const s = scheduleFor(list, type);
  return s && s.on ? [...s.rungs].sort((a, b) => a - b) : [];
}
