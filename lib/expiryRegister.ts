import { useSyncExternalStore } from 'react';
import { EMPLOYEES, REFERENCE_TODAY } from '@/lib/data';
import { daysBetween } from '@/lib/dates';
import { Employee, ExpiryState } from '@/lib/types';

/* The one expiry register. Every dated item an employee holds (passport, residence visa, Emirates ID, labour
   card, medical insurance and any other dated document) is read from the employee record, so the Expiry page,
   Visa Management, the Documents page and the profile all show the same date and the same state. Renewals write
   back to the record (in place, like lib/employeeStore) and bump a version that the contexts subscribe to. */

export interface DocRow {
  key: string;
  employee: Employee;
  docId: string;
  type: string;
  expiry: string;
  custom: boolean;
}

export const PASSPORT = 'Passport';
export const VISA = 'Residence Visa';
export const EID = 'Emirates ID';
export const LABOUR = 'Labour Card';

/** Every document type that can carry an expiry date, for filters and the add-document form. */
export const DATED_TYPES = [PASSPORT, VISA, EID, LABOUR, 'Medical Insurance', 'UAE Driving Licence', 'Professional Licence', 'Insurance Document'];

const IDENTITY = [PASSPORT, VISA, EID, LABOUR];
/** Documents whose expiry makes an employee non-compliant, with the short name used in badges. */
const MANDATORY: { type: string; short: string }[] = [
  { type: VISA, short: 'visa' },
  { type: EID, short: 'Emirates ID' },
  { type: LABOUR, short: 'labour card' },
  { type: PASSPORT, short: 'passport' },
];

export const daysUntil = (date: string) => daysBetween(REFERENCE_TODAY, date);
export const stateOfDate = (date?: string): ExpiryState => {
  if (!date) return 'na';
  const n = daysUntil(date);
  return n < 0 ? 'expired' : n <= 90 ? 'soon' : 'ok';
};

/* ---------- change notification ---------- */
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((l) => l());
};

/** Re-render when a renewal or added document changes the register. Use the number in memo dependencies. */
export function useExpiryVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => version,
    () => 0,
  );
}

/* ---------- reading ---------- */
interface Item {
  docId: string;
  type: string;
  expiry: string;
  custom: boolean;
}

function itemsOf(e: Employee): Item[] {
  const out: Item[] = [];
  const seen = new Set<string>();
  const p = e.profile;
  const docOf = (t: string) => e.documents.find((d) => d.type === t);
  const add = (type: string, fallbackId: string, expiry: string | undefined) => {
    if (!expiry) return;
    out.push({ docId: docOf(type)?.id ?? fallbackId, type, expiry, custom: false });
    seen.add(type);
  };
  // The identity fields on the record win; the dated document row is the fallback.
  add(PASSPORT, 'id-passport', p.passportExpiry || docOf(PASSPORT)?.expiryDate);
  add(VISA, 'id-visa', e.visaExpiry || docOf(VISA)?.expiryDate);
  add(EID, 'id-eid', p.emiratesIdExpiry || docOf(EID)?.expiryDate);
  add(LABOUR, 'id-lc', p.labourCardExpiry || docOf(LABOUR)?.expiryDate);
  e.documents.forEach((d) => {
    if (!d.expiryDate || seen.has(d.type)) return;
    out.push({ docId: d.id, type: d.type, expiry: d.expiryDate, custom: d.id.startsWith('xd-') });
    seen.add(d.type);
  });
  return out;
}

/** All dated items for these employees. */
export function registerFor(employees: Employee[]): DocRow[] {
  return employees.flatMap((e) => itemsOf(e).map((i) => ({ key: `${e.id}:${i.docId}`, employee: e, docId: i.docId, type: i.type, expiry: i.expiry, custom: i.custom })));
}

/* ---------- writing ---------- */

/** Set a new expiry on the employee record, in every place that holds it. */
export function setExpiry(e: Employee, type: string, expiry: string, docId?: string) {
  const p = e.profile;
  if (type === PASSPORT) p.passportExpiry = expiry;
  else if (type === VISA) {
    e.visaExpiry = expiry;
    e.visaState = stateOfDate(expiry);
  } else if (type === EID) p.emiratesIdExpiry = expiry;
  else if (type === LABOUR) p.labourCardExpiry = expiry;
  const doc = IDENTITY.includes(type) ? e.documents.find((d) => d.type === type) : e.documents.find((d) => d.id === docId);
  if (doc) {
    doc.expiryDate = expiry;
    doc.state = stateOfDate(expiry);
  }
  bump();
}

/** Start tracking another dated document for an employee. */
export function addDatedDocument(e: Employee, type: string, expiry: string) {
  e.documents.push({ id: `xd-${Date.now()}`, type, expiryDate: expiry, state: stateOfDate(expiry) });
  if (IDENTITY.includes(type)) setExpiry(e, type, expiry);
  else bump();
}

/** The seed stores each document's state as written; recompute it from the date and today's real date. */
function syncStates() {
  EMPLOYEES.forEach((e) => {
    e.documents.forEach((d) => {
      d.state = stateOfDate(d.expiryDate);
    });
    if (e.visaExpiry) e.visaState = stateOfDate(e.visaExpiry);
  });
}
syncStates();

/* ---------- compliance ---------- */
export interface ComplianceIssue {
  type: string;
  /** Short name for badges: "visa", "Emirates ID", "labour card", "passport". */
  short: string;
  expiry: string;
  daysOverdue: number;
}

/** Mandatory documents (passport, and the UAE visa, Emirates ID and labour card) that have expired. */
export function complianceIssues(e: Employee): ComplianceIssue[] {
  const rows = registerFor([e]);
  return MANDATORY.flatMap((m) => {
    const r = rows.find((x) => x.type === m.type);
    return r && daysUntil(r.expiry) < 0 ? [{ type: m.type, short: m.short, expiry: r.expiry, daysOverdue: -daysUntil(r.expiry) }] : [];
  });
}

const joinList = (l: string[]) => (l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} & ${l[l.length - 1]}`);

/** "Non-compliant · visa & Emirates ID expired" — empty when the employee is compliant. */
export function complianceLabel(issues: ComplianceIssue[]) {
  return issues.length ? `Non-compliant · ${joinList(issues.map((i) => i.short))} expired` : '';
}

/** The compact version for list rows and cards. */
export function complianceShort(issues: ComplianceIssue[]) {
  if (!issues.length) return '';
  return issues.length === 1 ? `Non-compliant · ${issues[0].short} expired` : `Non-compliant · ${issues.length} expired`;
}

/* ---------- vault (documents page, my files, profile) ---------- */
export type VaultStatus = 'ok' | 'soon' | 'expired' | 'onfile' | 'pending';

export interface VaultDoc {
  key: string;
  type: string;
  expiry?: string;
  status: VaultStatus;
  uploaded: boolean;
}

/** Checklist names a document type is filed under. */
const FILED_AS: Record<string, string[]> = {
  [PASSPORT]: ['Passport Copy'],
  Aadhaar: ['Aadhaar Card'],
  'Medical Insurance': ['Medical Insurance E-Card', 'Insurance Document'],
};

/** Whether a file or checklist tick backs this document. */
export function isUploaded(e: Employee, type: string, hasFile: (name: string) => boolean) {
  const names = [type, ...(FILED_AS[type] ?? [])];
  return names.some((n) => e.profile.uploadedDocs.includes(n) || hasFile(n)) || !!e.documents.find((d) => d.type === type)?.fileName;
}

/** A dated document is Valid only when it is on file; an expired or expiring one always shows its warning. */
export function vaultStatus(expiry: string | undefined, uploaded: boolean): VaultStatus {
  if (expiry) {
    const s = stateOfDate(expiry);
    if (s === 'expired' || s === 'soon') return s;
    return uploaded ? 'ok' : 'pending';
  }
  return uploaded ? 'onfile' : 'pending';
}

/** Everything held for an employee: dated items from the register, then the undated documents. */
export function vaultDocsFor(e: Employee, hasFile: (name: string) => boolean): VaultDoc[] {
  const dated = registerFor([e]).map((r) => {
    const uploaded = isUploaded(e, r.type, hasFile);
    return { key: r.key, type: r.type, expiry: r.expiry, uploaded, status: vaultStatus(r.expiry, uploaded) };
  });
  const undated = e.documents
    .filter((d) => !d.expiryDate)
    .map((d) => {
      const uploaded = isUploaded(e, d.type, hasFile);
      return { key: `${e.id}:${d.id}`, type: d.type, expiry: undefined, uploaded, status: vaultStatus(undefined, uploaded) };
    });
  return [...dated, ...undated];
}
