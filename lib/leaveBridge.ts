import { useMemo, useSyncExternalStore } from 'react';
import { ATTENDANCE_TODAY, EMPLOYEES, LEAVE_BALANCES, LEAVE_REQUESTS, PERSONAS, REFERENCE_TODAY, employeeById } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { useOrg } from '@/context/OrgContext';
import type { AttendanceDay, AttendanceStatus, Employee, LeaveRequest, LeaveType, LocationDef } from '@/lib/types';

/* One source for leave and attendance.
   The Leave & Attendance runtime (public/la) keeps every leave request and today's attendance in a shared
   ledger in sessionStorage ("la.ledger.v1"). The runtime reads and writes it directly; the app's own screens
   (dashboard, team leave, team attendance, My Space) read and write the same ledger through this file, so a
   request approved in one place is approved in the other. Until the ledger exists it is seeded from
   lib/data.ts (LEAVE_REQUESTS, LEAVE_BALANCES, ATTENDANCE_TODAY) using exactly the rules the runtime uses. */

const KEY = 'la.ledger.v1';
const EVENT = 'la:ledger';
const SEQ_START = 100;

export interface LedgerLeave {
  id: string;
  emp: string;
  code: string;
  type: string;
  app: LeaveType | '';
  from: string;
  to: string;
  days: number;
  st: string;
  stage: string;
  applied: string;
  reason: string;
  doc: string;
  approver?: string;
  approverName?: string;
  approverVia?: string;
  inBase?: boolean;
  decision?: string;
  decidedBy?: string;
  decidedOn?: string;
  extOf?: string;
  linked?: string;
}

export interface LedgerAttendance {
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
}

export interface Ledger {
  v: 1;
  day: string;
  seq: number;
  leaves: LedgerLeave[];
  att: Record<string, LedgerAttendance>;
}

export interface Approver {
  code: string;
  name: string;
  via: string;
}

export interface HolidayDef {
  id: string;
  d: string;
  to: string;
  n: string;
  type: string;
  tpl: 'all' | 'uae' | 'india';
  /** Moon-sighting / panchang dates: shown as approximate. */
  approx?: boolean;
}

/* ---------- leave types: the app's four types per location template ---------- */
const TYPE_NAMES: Record<'uae' | 'india', Record<LeaveType, string>> = {
  uae: { Annual: 'Annual Leave', Sick: 'Sick Leave', Casual: 'Casual Leave', Unpaid: 'Unpaid Leave' },
  india: { Annual: 'Earned Leave', Sick: 'Sick Leave', Casual: 'Casual Leave', Unpaid: 'Loss of Pay' },
};
export const leaveTypeName = (app: LeaveType, template: 'uae' | 'india') => TYPE_NAMES[template][app];
const BALANCE_TYPES: LeaveType[] = ['Annual', 'Sick', 'Casual'];

const templateOf = (locationId: string, locations: LocationDef[]): 'uae' | 'india' => locations.find((l) => l.id === locationId)?.template ?? 'uae';

/* ---------- calendar rules: the location's working week and holidays ---------- */
const DAYIDX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** Working weekdays (0 = Sunday) from a location's "09:00 – 18:00, Mon–Fri" text. */
export function workWeek(text: string | undefined): number[] {
  const m = (text || '').match(/([A-Za-z]{3})[a-z]*\s*[–-]\s*([A-Za-z]{3})/);
  if (!m || DAYIDX[m[1].toLowerCase()] == null || DAYIDX[m[2].toLowerCase()] == null) return [1, 2, 3, 4, 5];
  const out: number[] = [];
  for (let i = DAYIDX[m[1].toLowerCase()]; ; i = (i + 1) % 7) {
    out.push(i);
    if (i === DAYIDX[m[2].toLowerCase()]) break;
  }
  return out;
}

type HolidayRow = Omit<HolidayDef, 'id' | 'type'>;
const row = (d: string, to: string, n: string, tpl: HolidayDef['tpl'], approx = false): HolidayRow => (approx ? { d, to, n, tpl, approx: true } : { d, to, n, tpl });

/** The public holidays of one year. 2027 is listed explicitly (Islamic and festival dates follow the moon / panchang, so they are
    marked approximate); any other year repeats the usual calendar dates. */
function holidayRows(year: string): HolidayRow[] {
  if (year === '2027') {
    return [
      row('2027-01-01', '', 'New Year’s Day', 'all'),
      row('2027-03-09', '2027-03-11', 'Eid Al Fitr', 'uae', true),
      row('2027-05-15', '2027-05-18', 'Arafat Day & Eid Al Adha', 'uae', true),
      row('2027-06-06', '', 'Islamic New Year', 'uae', true),
      row('2027-08-14', '', 'Prophet’s Birthday', 'uae', true),
      row('2027-12-01', '', 'Commemoration Day', 'uae'),
      row('2027-12-02', '2027-12-03', 'UAE National Day', 'uae'),
      row('2027-01-26', '', 'Republic Day', 'india'),
      row('2027-03-10', '', 'Eid ul-Fitr (Ramzan)', 'india', true),
      row('2027-03-26', '', 'Good Friday', 'india'),
      row('2027-04-14', '', 'Vishu', 'india'),
      row('2027-05-01', '', 'May Day (Labour Day)', 'india'),
      row('2027-05-17', '', 'Bakrid (Eid ul-Adha)', 'india', true),
      row('2027-08-15', '', 'Independence Day', 'india'),
      row('2027-09-11', '', 'First Onam (Uthradom)', 'india', true),
      row('2027-09-12', '', 'Thiruvonam', 'india', true),
      row('2027-09-13', '', 'Third Onam (Avittam)', 'india', true),
      row('2027-10-02', '', 'Gandhi Jayanti', 'india'),
      row('2027-10-09', '', 'Vijayadasami', 'india', true),
      row('2027-10-29', '', 'Diwali', 'india', true),
      row('2027-12-25', '', 'Christmas', 'india'),
    ];
  }
  return [
    row(`${year}-01-01`, '', 'New Year’s Day', 'all'),
    row(`${year}-03-20`, `${year}-03-22`, 'Eid Al Fitr', 'uae'),
    row(`${year}-05-26`, `${year}-05-29`, 'Arafat Day & Eid Al Adha', 'uae'),
    row(`${year}-06-16`, '', 'Islamic New Year', 'uae'),
    row(`${year}-08-25`, '', 'Prophet’s Birthday', 'uae'),
    row(`${year}-12-01`, '', 'Commemoration Day', 'uae'),
    row(`${year}-12-02`, `${year}-12-03`, 'UAE National Day', 'uae'),
    row(`${year}-01-26`, '', 'Republic Day', 'india'),
    row(`${year}-04-14`, '', 'Vishu', 'india'),
    row(`${year}-05-01`, '', 'May Day', 'india'),
    row(`${year}-08-15`, '', 'Independence Day', 'india'),
    row(`${year}-08-26`, '', 'Thiruvonam', 'india'),
    row(`${year}-10-02`, '', 'Gandhi Jayanti', 'india'),
    row(`${year}-10-20`, '', 'Vijayadasami', 'india'),
    row(`${year}-11-08`, '', 'Diwali', 'india'),
    row(`${year}-12-25`, '', 'Christmas', 'india'),
  ];
}

/** The holiday lists for the given year and the one after it, so a leave that crosses New Year counts the next year's holidays too. */
export function defaultHolidays(year: string): HolidayDef[] {
  const next = String(Number(year) + 1);
  const build = (y: string, suffix: string): HolidayDef[] => holidayRows(y).map((r, i) => ({ id: `H${i + 1}${suffix}`, type: 'Public', ...r }));
  return [...build(year, ''), ...build(next, `-${next}`)];
}

/** Holidays in force: the runtime's own list when it has been opened (HR may have edited it), else the defaults. */
function holidaySource(): HolidayDef[] {
  const w = typeof window === 'undefined' ? undefined : (window as unknown as { LA?: { db?: () => { hol?: { id: string; d: string; to: string; n: string; type: string; locs?: string[] }[] } }; __laOrg?: { locations?: { id: string; template: string }[] } });
  const hol = w?.LA?.db?.().hol;
  const locs = w?.__laOrg?.locations;
  if (hol && locs) {
    return hol.map((x) => {
      const ids = !x.locs || x.locs.includes('all') ? null : x.locs;
      const tpls = ids ? new Set(ids.map((i) => locs.find((l) => l.id === i)?.template)) : null;
      const tpl: HolidayDef['tpl'] = !tpls ? 'all' : tpls.size === 1 && tpls.has('india') ? 'india' : 'uae';
      return { id: x.id, d: x.d, to: x.to || '', n: x.n, type: x.type, tpl };
    });
  }
  return defaultHolidays(REFERENCE_TODAY.slice(0, 4));
}

const dowOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

export interface DayCount {
  days: number;
  calendar: number;
  off: number;
  holidays: number;
}

/** Working days between two dates (inclusive) for a location: weekly offs and the location's holidays are not counted. */
export function workingDays(from: string, to: string, location: LocationDef | undefined, holidays: HolidayDef[] = holidaySource()): DayCount {
  const week = workWeek(location?.workingHours);
  const tpl = location?.template ?? 'uae';
  const out: DayCount = { days: 0, calendar: 0, off: 0, holidays: 0 };
  if (!from || !to || to < from) return out;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.calendar++;
    if (!week.includes(dowOf(d))) out.off++;
    else if (holidays.some((h) => d >= h.d && d <= (h.to || h.d) && (h.tpl === 'all' || h.tpl === tpl))) out.holidays++;
    else out.days++;
  }
  return out;
}

/* ---------- approver routing ---------- */
const isActive = (e: Employee | undefined): e is Employee => !!e && (e.employmentStatus === 'Active' || e.employmentStatus === 'Offboarding');

/** Approver code used when nobody inside the system can approve (e.g. the General Manager's own leave). */
export const EXTERNAL_APPROVER: Approver = { code: 'EXT-MD', name: 'Managing Director', via: 'External approver' };
export const isExternalApprover = (code: string | undefined | null) => !!code && code.startsWith('EXT-');

/** True when `candidate` reports to `ancestorId`, directly or through anyone else in the chain. */
function reportsTo(candidate: Employee, ancestorId: string): boolean {
  const seen = new Set<string>();
  let cur: Employee | undefined = candidate;
  while (cur?.reportingManagerId && !seen.has(cur.id)) {
    if (cur.reportingManagerId === ancestorId) return true;
    seen.add(cur.id);
    cur = employeeById(cur.reportingManagerId);
  }
  return false;
}

/** Reporting manager; with no manager, the manager's manager, then HR, then the Super Admin. Never the requester and never
    anyone who reports (directly or indirectly) to the requester. When nobody is left, the external Managing Director. */
export function approverFor(e: Employee): Approver | null {
  const chain: { emp: Employee | undefined; via: string }[] = [];
  const mgr = e.reportingManagerId ? employeeById(e.reportingManagerId) : undefined;
  chain.push({ emp: mgr, via: 'Reporting manager' });
  chain.push({ emp: mgr?.reportingManagerId ? employeeById(mgr.reportingManagerId) : undefined, via: 'Manager’s manager' });
  const hrIds = [PERSONAS.HR.employeeId, ...EMPLOYEES.filter((x) => x.flags.includes('HR')).map((x) => x.id)];
  [...new Set(hrIds)].forEach((id) => chain.push({ emp: employeeById(id), via: 'HR' }));
  chain.push({ emp: employeeById(PERSONAS['Super Admin'].employeeId), via: 'Super Admin' });
  const hit = chain.find((c) => isActive(c.emp) && c.emp.id !== e.id && !reportsTo(c.emp, e.id));
  return hit && hit.emp ? { code: hit.emp.id, name: hit.emp.name, via: hit.via } : EXTERNAL_APPROVER;
}

export function approverMap(): Record<string, Approver> {
  const out: Record<string, Approver> = {};
  EMPLOYEES.forEach((e) => {
    const a = approverFor(e);
    if (a) out[e.id] = a;
  });
  return out;
}

/** Pending and approved annual-leave plan segments of one person, from the runtime when it has been opened. */
function plannedSegments(name: string): { seg: number; from: string; to: string; st: string }[] {
  const w = typeof window === 'undefined' ? undefined : (window as unknown as { LA?: { db?: () => { plans?: { emp: string; seg: number; from: string; to: string; st: string }[] } } });
  return (w?.LA?.db?.().plans ?? []).filter((p) => p.emp === name && (p.st === 'Pending' || p.st === 'Approved'));
}

/* ---------- balances: the app's entitlement and leave already taken, plus what the ledger has changed ---------- */
export interface BalanceRow {
  employeeId: string;
  type: LeaveType;
  entitled: number;
  taken: number;
  pending: number;
  left: number;
}

export function balanceOf(employeeId: string, type: LeaveType, leaves: LedgerLeave[]): BalanceRow {
  const base = LEAVE_BALANCES.find((b) => b.employeeId === employeeId && b.type === type);
  const entitled = base?.entitled ?? 0;
  let taken = base?.taken ?? 0;
  let pending = 0;
  leaves.forEach((l) => {
    if (l.code !== employeeId || l.app !== type) return;
    if (l.st === 'Approved' && !l.inBase) taken += l.days;
    else if (l.st === 'Cancelled' && l.inBase) taken -= l.days;
    else if (l.st === 'Pending') pending += l.days;
  });
  if (type === 'Annual') {
    // approved and pending annual-leave plan segments are booked leave too (the runtime keeps them)
    const emp = employeeById(employeeId);
    const w = typeof window === 'undefined' ? undefined : (window as unknown as { LA?: { workDays?: (from: string, to: string, loc: string) => { days: number } } });
    const wd = w?.LA?.workDays;
    if (emp && wd) {
      plannedSegments(emp.name).forEach((p) => {
        const d = wd(p.from, p.to, emp.location).days;
        if (p.st === 'Approved') taken += d;
        else pending += d;
      });
    }
  }
  return { employeeId, type, entitled, taken, pending, left: Math.round((entitled - taken - pending) * 10) / 10 };
}

/* ---------- the ledger ---------- */
export function seedLedger(locations: LocationDef[]): Ledger {
  const holidays = defaultHolidays(REFERENCE_TODAY.slice(0, 4));
  const approvers = approverMap();
  const leaves: LedgerLeave[] = LEAVE_REQUESTS.map((r, i) => {
    const e = employeeById(r.employeeId);
    const loc = locations.find((l) => l.id === e?.location);
    const tpl = loc?.template ?? 'uae';
    const wd = workingDays(r.fromDate, r.toDate, loc, holidays).days;
    const a = approvers[r.employeeId];
    return {
      id: `LV-${i + 1}`,
      emp: e?.name ?? r.employeeId,
      code: r.employeeId,
      type: leaveTypeName(r.type, tpl),
      app: r.type,
      from: r.fromDate,
      to: r.toDate,
      days: wd || r.days,
      st: r.status,
      stage: r.status === 'Approved' ? 'Completed' : 'Reporting Manager',
      applied: [addDays(r.fromDate, -5), REFERENCE_TODAY].sort()[0],
      reason: r.reason,
      doc: '',
      approver: a?.code,
      approverName: a?.name,
      approverVia: a?.via,
      inBase: r.status === 'Approved',
    };
  });
  const att: Record<string, LedgerAttendance> = {};
  // a check-out later than the current time has not happened yet
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const past = (t: string | undefined) => (t && Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) <= nowMin ? t : undefined);
  ATTENDANCE_TODAY.forEach((a: AttendanceDay) => {
    att[a.employeeId] = { status: a.status, checkIn: a.checkIn, checkOut: past(a.checkOut) };
  });
  return { v: 1, day: REFERENCE_TODAY, seq: SEQ_START, leaves, att };
}

const canStore = () => typeof window !== 'undefined';
function rawLedger(): string | null {
  if (!canStore()) return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function readLedger(): Ledger | null {
  const raw = rawLedger();
  if (!raw) return null;
  try {
    const l = JSON.parse(raw) as Ledger;
    return l && l.v === 1 && l.day === REFERENCE_TODAY && Array.isArray(l.leaves) ? l : null;
  } catch {
    return null;
  }
}
function writeLedger(l: Ledger) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* storage unavailable — the change lives only for this render */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { src: 'app' } }));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

function useLedger(): Ledger {
  const { locations } = useOrg();
  const raw = useSyncExternalStore(subscribe, rawLedger, () => null);
  return useMemo(() => {
    if (raw) {
      try {
        const l = JSON.parse(raw) as Ledger;
        if (l && l.v === 1 && l.day === REFERENCE_TODAY && Array.isArray(l.leaves)) return l;
      } catch {
        /* fall through to the seed */
      }
    }
    return seedLedger(locations);
  }, [raw, locations]);
}

/* ---------- hooks ---------- */
export interface BridgeLeave extends Omit<LeaveRequest, 'status'> {
  status: LeaveRequest['status'] | 'Withdrawn' | 'Cancelled';
  typeLabel: string;
  approverId?: string;
  approverName?: string;
  approverVia?: string;
  decidedBy?: string;
}

const toBridge = (l: LedgerLeave): BridgeLeave => ({
  id: l.id,
  employeeId: l.code,
  type: l.app || 'Annual',
  typeLabel: l.type,
  fromDate: l.from,
  toDate: l.to,
  days: l.days,
  reason: l.reason,
  status: l.st as BridgeLeave['status'],
  approverId: l.approver || undefined,
  approverName: l.approverName,
  approverVia: l.approverVia,
  decidedBy: l.decidedBy,
});

/** Every leave request in the organisation, live from the Leave & Attendance module. */
export function useLeaveRequests(): BridgeLeave[] {
  const ledger = useLedger();
  return useMemo(() => ledger.leaves.map(toBridge), [ledger]);
}

/** Leave requests waiting for a decision. */
export function usePendingLeave(): BridgeLeave[] {
  const all = useLeaveRequests();
  return useMemo(() => all.filter((r) => r.status === 'Pending'), [all]);
}

/** Leave balances (entitled, taken, pending, left) for every active employee. */
export function useLeaveBalances(): BalanceRow[] {
  const ledger = useLedger();
  return useMemo(
    () => EMPLOYEES.filter((e) => e.employmentStatus === 'Active').flatMap((e) => BALANCE_TYPES.map((t) => balanceOf(e.id, t, ledger.leaves))),
    [ledger],
  );
}

/** Today's attendance: the module's check-ins, with approved leave taking precedence. */
export function useAttendanceToday(): AttendanceDay[] {
  const ledger = useLedger();
  return useMemo(
    () =>
      EMPLOYEES.filter((e) => e.employmentStatus === 'Active').map((e) => {
        const a = ledger.att[e.id];
        const onLeave = ledger.leaves.some((l) => l.code === e.id && l.st === 'Approved' && REFERENCE_TODAY >= l.from && REFERENCE_TODAY <= l.to);
        if (onLeave) return { employeeId: e.id, date: REFERENCE_TODAY, status: 'Leave' as const };
        if (!a) return { employeeId: e.id, date: REFERENCE_TODAY, status: 'Absent' as const };
        return { employeeId: e.id, date: REFERENCE_TODAY, status: a.status === 'Leave' ? ('Absent' as const) : a.status, checkIn: a.checkIn, checkOut: a.checkOut };
      }),
    [ledger],
  );
}

/** True when the person's joining date is still ahead of today. */
export const notYetJoined = (e: Employee) => e.dateOfJoining > REFERENCE_TODAY;

/* ---------- requests ---------- */
export interface LeavePreview {
  days: number;
  calendar: number;
  off: number;
  holidays: number;
  available: number | null;
  shortfall: number;
  errors: string[];
  approver: Approver | null;
}

/** Calendar and balance rules for a new request, counted in working days of the employee's location. */
export function previewLeave(employee: Employee, type: LeaveType, from: string, to: string, leaves: LedgerLeave[], locations: LocationDef[]): LeavePreview {
  const loc = locations.find((l) => l.id === employee.location);
  const c = workingDays(from, to, loc);
  const errors: string[] = [];
  const approver = approverFor(employee);
  let available: number | null = null;
  let shortfall = 0;
  if (from && to) {
    if (to < from) errors.push('End date is before the start date.');
    else {
      if (from < addDays(REFERENCE_TODAY, -30)) errors.push('Leave cannot be applied more than 30 days after the fact.');
      if (!c.days) errors.push('The selected dates have no working days (weekly off or public holiday).');
      const clash = leaves.find((l) => l.code === employee.id && (l.st === 'Pending' || l.st === 'Approved') && !(to < l.from || from > l.to));
      if (clash) errors.push(`These dates overlap ${clash.id} (${clash.from} → ${clash.to}).`);
      else {
        // the person's pending / approved annual-leave plan segments (kept by the Leave & Attendance runtime) count as leave too
        const seg = plannedSegments(employee.name).find((p) => !(to < p.from || from > p.to));
        if (seg) errors.push(`These dates overlap your annual-leave plan segment ${seg.seg} (${seg.from} → ${seg.to}, ${seg.st.toLowerCase()}).`);
      }
    }
  }
  if (type !== 'Unpaid' && c.days) {
    available = balanceOf(employee.id, type, leaves).left;
    shortfall = Math.max(0, c.days - Math.max(0, available));
  }
  return { ...c, available, shortfall, errors, approver };
}

export interface SubmitInput {
  employee: Employee;
  type: LeaveType;
  from: string;
  to: string;
  reason: string;
  convertExcess: boolean;
  locations: LocationDef[];
}
export type SubmitResult = { ok: true; ids: string[]; days: number; unpaidDays: number; approver: Approver | null } | { ok: false; errors: string[] };

export function submitLeave(input: SubmitInput): SubmitResult {
  const { employee, type, from, to, reason, convertExcess, locations } = input;
  const ledger = readLedger() ?? seedLedger(locations);
  const p = previewLeave(employee, type, from, to, ledger.leaves, locations);
  const errors = [...p.errors];
  if (p.shortfall > 0 && !convertExcess) errors.push(`Insufficient balance: ${Math.max(0, p.available ?? 0)} day(s) available, ${p.days} working day(s) requested. Convert the excess to unpaid leave to continue.`);
  if (errors.length) return { ok: false, errors };

  const loc = locations.find((l) => l.id === employee.location);
  const tpl = loc?.template ?? 'uae';
  const paidDays = p.shortfall > 0 ? Math.max(0, Math.floor(p.available ?? 0)) : p.days;
  const mk = (t: LeaveType, f: string, e: string, days: number, linked?: string): LedgerLeave => ({
    id: `LV-${++ledger.seq}`,
    emp: employee.name,
    code: employee.id,
    type: leaveTypeName(t, tpl),
    app: t,
    from: f,
    to: e,
    days,
    st: 'Pending',
    stage: 'Reporting Manager',
    applied: REFERENCE_TODAY,
    reason: reason.trim() || '—',
    doc: '',
    approver: p.approver?.code,
    approverName: p.approver?.name,
    approverVia: p.approver?.via,
    linked,
  });
  const created: LedgerLeave[] = [];
  if (p.shortfall > 0 && paidDays > 0) {
    // the first `paidDays` working days use the balance; the rest become unpaid leave
    let counted = 0;
    let cut = from;
    const week = workWeek(loc?.workingHours);
    const hol = holidaySource();
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const worked = week.includes(dowOf(d)) && !hol.some((h) => d >= h.d && d <= (h.to || h.d) && (h.tpl === 'all' || h.tpl === tpl));
      if (worked) counted++;
      cut = d;
      if (counted >= paidDays) break;
    }
    const first = mk(type, from, cut, paidDays);
    const second = mk('Unpaid', addDays(cut, 1), to, p.days - paidDays, first.id);
    created.push(first, second);
  } else if (p.shortfall > 0) {
    created.push(mk('Unpaid', from, to, p.days));
  } else {
    created.push(mk(type, from, to, p.days));
  }
  ledger.leaves.unshift(...created);
  writeLedger(ledger);
  return { ok: true, ids: created.map((l) => l.id), days: p.days, unpaidDays: p.shortfall > 0 ? p.days - paidDays : 0, approver: p.approver };
}

/** Approve or reject a pending request. Nobody can decide their own request. */
export function decideLeave(id: string, status: 'Approved' | 'Rejected', byEmployeeId: string, locations: LocationDef[]): { ok: boolean; message?: string } {
  const ledger = readLedger() ?? seedLedger(locations);
  const l = ledger.leaves.find((x) => x.id === id);
  if (!l) return { ok: false, message: 'Request not found.' };
  if (l.code === byEmployeeId) return { ok: false, message: 'You cannot approve or reject your own request.' };
  if (isExternalApprover(l.approver)) return { ok: false, message: `Waiting for ${l.approverName ?? 'the external approver'} — nobody in the system can decide this request.` };
  if (l.st !== 'Pending') return { ok: false, message: `Request is already ${l.st.toLowerCase()}.` };
  l.st = status;
  l.stage = status === 'Approved' ? 'Completed' : 'Reporting Manager';
  l.decidedBy = byEmployeeId;
  l.decidedOn = REFERENCE_TODAY;
  writeLedger(ledger);
  return { ok: true };
}

/** What the runtime needs to start from the app's data (published in window.__laOrg.leave). */
export function leaveOrgPayload(locations: LocationDef[]) {
  return {
    ledger: seedLedger(locations),
    balances: LEAVE_BALANCES,
    holidays: defaultHolidays(REFERENCE_TODAY.slice(0, 4)),
    approvers: approverMap(),
  };
}

/** Calendar, balance and routing checks for a request being typed, against the live ledger. */
export function useLeavePreview(employee: Employee, type: LeaveType, from: string, to: string): LeavePreview {
  const ledger = useLedger();
  const { locations } = useOrg();
  return useMemo(() => previewLeave(employee, type, from, to, ledger.leaves, locations), [employee, type, from, to, ledger, locations]);
}

export { templateOf as leaveTemplateOf };
