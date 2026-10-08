import { ATTENDANCE_TODAY, LEAVE_BALANCES, LEAVE_REQUESTS, LOCATIONS } from '@/lib/data';
import { addDays, daysBetween } from '@/lib/dates';
import { countHeadcount, departmentRows, StatusFn } from '@/lib/headcount';
import { Employee, LearningRecord, PerformanceReview } from '@/lib/types';

/* Report engine: every report id maps to a real table computed from the data the app already holds.
   Where the app has no direct source for a report (for example skills, goals history, nine-box potential),
   the table is the best honest derivation and `note` says exactly how it was built. */

export type CatKey = 'employee' | 'leave' | 'attendance' | 'performance';
export type Cell = string | number;

export interface ReportDef {
  id: string;
  cat: CatKey;
  title: string;
  desc: string;
}

export interface ReportTable {
  columns: string[];
  rows: Cell[][];
  /** How the numbers were derived; shown in the drawer when the source is partial. */
  note?: string;
  /** "live" = computed straight from records; "derived" = best available proxy. */
  basis: 'live' | 'derived';
}

export interface ReportInput {
  /** Employees in the selected location, any status. */
  employees: Employee[];
  scopeLabel: string;
  today: string;
  statusOf: StatusFn;
  reviews: PerformanceReview[];
  records: LearningRecord[];
}

export const CAT_LABEL: Record<CatKey, string> = { employee: 'Employee Information', leave: 'Leave Tracker', attendance: 'Attendance', performance: 'Performance' };

const def = (cat: CatKey, id: string, title: string, desc: string): ReportDef => ({ id, cat, title, desc });

export const REPORTS: ReportDef[] = [
  def('employee', 'emp-dashboard', 'Dashboard', 'Live headcount, joiners & leavers at a glance'),
  def('employee', 'emp-headcount', 'Headcount', 'Headcount by department, location & type'),
  def('employee', 'emp-additions', 'Employee addition trend', 'New joiners over time'),
  def('employee', 'emp-attrition', 'Employee attrition trend', 'Exits & attrition rate over time'),
  def('employee', 'emp-distribution', 'Distribution', 'Split by department, employment type, gender, nationality'),
  def('employee', 'emp-diversity', 'Diversity', 'Gender & nationality diversity metrics'),
  def('employee', 'emp-exit-tenure', 'Experience wise exit', 'Attrition analysed by tenure band'),
  def('leave', 'lv-daily', 'Daily leave status', 'Who is on leave today'),
  def('leave', 'lv-availability', 'Resource availability', 'Available vs on-leave headcount'),
  def('leave', 'lv-balance', 'Employee leave balance', 'Remaining balance per employee'),
  def('leave', 'lv-booked', 'Leave booked and balance', 'Booked vs remaining by type'),
  def('leave', 'lv-type', 'Leave type wise summary', 'Totals by leave type'),
  def('leave', 'lv-encash', 'Leave encashment details', 'Encashable balances & payouts'),
  def('leave', 'lv-lop', 'Loss of pay details', 'Unpaid leave (LOP) records'),
  def('leave', 'lv-payroll', 'Leave data for payroll', 'Export for the payroll run'),
  def('attendance', 'at-daily', 'Daily attendance status', 'Present / absent for the day'),
  def('attendance', 'at-punch', 'Early / late check-in & check-out', 'Punch-time exceptions'),
  def('attendance', 'at-status', 'Employee present / absent status', 'Period-wise presence'),
  def('attendance', 'at-hours', 'Presence hours break-up', 'Worked-hours breakdown'),
  def('attendance', 'at-payroll', 'Attendance data for payroll', 'Export for the payroll run'),
  def('attendance', 'at-muster', 'Muster roll', 'Statutory muster register'),
  def('attendance', 'at-consecutive', 'Consecutive absences', 'Flag employees absent in a row'),
  def('performance', 'pf-goals', 'Goals', 'Goal / KPI progress'),
  def('performance', 'pf-skills', 'Skill Set', 'Skill matrix & gaps'),
  def('performance', 'pf-feedback', 'Feedback on employee', '360° feedback received'),
  def('performance', 'pf-status', 'Appraisal status', 'Where each appraisal stands'),
  def('performance', 'pf-rating', 'Appraisal Rating', 'Ratings this cycle'),
  def('performance', 'pf-score', 'Appraisal score', 'Scores this cycle'),
  def('performance', 'pf-ninebox', 'Nine-box matrix', 'Performance vs potential grid'),
  def('performance', 'pf-appraisal-feedback', 'Feedback on appraisal', 'Feedback given during appraisal'),
  def('performance', 'pf-history', 'Appraisal Rating history', 'Ratings across cycles'),
  def('performance', 'pf-summary', 'Appraisal score and rating summary', 'Combined score & rating view'),
  def('performance', 'pf-extension', 'Review extension report', 'Reviews extended past due date'),
];

export const CATEGORIES: CatKey[] = ['employee', 'leave', 'attendance', 'performance'];
export const reportsIn = (cat: CatKey) => REPORTS.filter((r) => r.cat === cat);

/* ---------- helpers ---------- */

const dash = '—';
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '0%');
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);

const hoursOf = (locationId: string) => {
  const hours = LOCATIONS.find((l) => l.id === locationId)?.workingHours ?? '';
  const m = hours.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/);
  const pad = (t: string) => (t.length === 4 ? `0${t}` : t);
  return { start: pad(m?.[1] ?? '09:00'), end: pad(m?.[2] ?? '18:00') };
};
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmtHours = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

const monthStart = (today: string) => `${today.slice(0, 7)}-01`;
/** Calendar days of [from, to] that fall inside [lo, hi]. */
const overlapDays = (from: string, to: string, lo: string, hi: string) => {
  const a = from > lo ? from : lo;
  const b = to < hi ? to : hi;
  return b < a ? 0 : daysBetween(a, b) + 1;
};
/** Monday-to-Friday days from `from` to `to`, both included. */
const weekdays = (from: string, to: string) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
};
const tenureYears = (from: string, to: string) => daysBetween(from, to) / 365.25;

const who = (e: Employee) => [e.name, e.employeeCode, e.department] as Cell[];
const WHO = ['Employee', 'Code', 'Department'];

/* ---------- the builder ---------- */

export function buildReport(id: string, input: ReportInput): ReportTable {
  const { employees, today, statusOf, reviews, records } = input;
  const working = employees.filter((e) => statusOf(e) !== 'Inactive');
  const ids = new Set(employees.map((e) => e.id));
  const byId = new Map(employees.map((e) => [e.id, e]));
  const att = ATTENDANCE_TODAY.filter((a) => ids.has(a.employeeId) && statusOf(byId.get(a.employeeId)!) !== 'Inactive');
  const leaves = LEAVE_REQUESTS.filter((r) => ids.has(r.employeeId));
  const myReviews = reviews.filter((r) => ids.has(r.employeeId));
  const nameOf = (empId: string) => byId.get(empId)?.name ?? empId;
  const codeOf = (empId: string) => byId.get(empId)?.employeeCode ?? '';
  const deptOf = (empId: string) => byId.get(empId)?.department ?? '';
  const live = (columns: string[], rows: Cell[][], note?: string): ReportTable => ({ columns, rows, note, basis: 'live' });
  const derived = (columns: string[], rows: Cell[][], note: string): ReportTable => ({ columns, rows, note, basis: 'derived' });

  switch (id) {
    /* ---- Employee information ---- */
    case 'emp-dashboard': {
      const h = countHeadcount(employees, statusOf);
      const joined90 = employees.filter((e) => statusOf(e) !== 'Inactive' && daysBetween(e.dateOfJoining, today) >= 0 && daysBetween(e.dateOfJoining, today) <= 90).length;
      const left90 = employees.filter((e) => e.exitDate && daysBetween(e.exitDate, today) >= 0 && daysBetween(e.exitDate, today) <= 90).length;
      return live(
        ['Metric', 'Value'],
        [
          ['Active employees', h.active],
          ['Joining (onboarding)', h.joining],
          ['Exiting (serving notice)', h.exiting],
          ['Total incl. joining', h.total],
          ['Inactive (left, not counted)', h.inactive],
          ['Joined in the last 90 days', joined90],
          ['Left in the last 90 days', left90],
        ],
        'Active = working today, Joining = onboarding, Exiting = serving notice. Inactive people are never part of the total.'
      );
    }
    case 'emp-headcount':
      return live(
        ['Company', 'Department', 'Active', 'Joining', 'Exiting', 'Total'],
        departmentRows(employees, statusOf)
          .filter((r) => r.total > 0)
          .map((r) => [r.company, r.department, r.active, r.joining, r.exiting, r.total])
      );
    case 'emp-additions': {
      const m = new Map<string, string[]>();
      employees.forEach((e) => m.set(e.dateOfJoining.slice(0, 7), [...(m.get(e.dateOfJoining.slice(0, 7)) ?? []), e.name]));
      const rows = [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([month, names]) => [month, names.length, names.join(', ')] as Cell[]);
      return live(['Month', 'Joiners', 'Who'], rows, 'Counted by joining date for everyone in scope, including people who have since left.');
    }
    case 'emp-attrition': {
      const exits = employees.filter((e) => e.exitDate);
      const m = new Map<string, string[]>();
      exits.forEach((e) => m.set(e.exitDate!.slice(0, 7), [...(m.get(e.exitDate!.slice(0, 7)) ?? []), e.name]));
      const base = employees.length;
      const rows = [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([month, names]) => [month, names.length, pct(names.length, base), names.join(', ')] as Cell[]);
      const leaving = employees.filter((e) => statusOf(e) === 'Offboarding');
      if (leaving.length) rows.unshift(['Serving notice', leaving.length, pct(leaving.length, base), leaving.map((e) => e.name).join(', ')]);
      return live(['Month', 'Exits', 'Attrition rate', 'Who'], rows, `Rate = exits ÷ everyone on record in scope (${base}).`);
    }
    case 'emp-distribution': {
      const total = working.length;
      const rows: Cell[][] = [];
      const add = (dim: string, f: (e: Employee) => string) => {
        const m = new Map<string, number>();
        working.forEach((e) => m.set(f(e) || dash, (m.get(f(e) || dash) ?? 0) + 1));
        [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => rows.push([dim, k, n, pct(n, total)]));
      };
      add('Department', (e) => e.department);
      add('Company', (e) => e.company);
      add('Employment type', (e) => e.employmentType);
      add('Gender', (e) => e.profile.gender);
      add('Nationality', (e) => e.nationality);
      return derived(['Dimension', 'Value', 'People', 'Share'], rows, 'The app does not store grades, so the split uses department, company, employment type, gender and nationality. People counted: everyone except Inactive.');
    }
    case 'emp-diversity': {
      const total = working.length;
      const rows: Cell[][] = [];
      const add = (dim: string, f: (e: Employee) => string) => {
        const m = new Map<string, number>();
        working.forEach((e) => m.set(f(e) || dash, (m.get(f(e) || dash) ?? 0) + 1));
        [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => rows.push([dim, k, n, pct(n, total)]));
      };
      add('Gender', (e) => e.profile.gender);
      add('Nationality', (e) => e.nationality);
      rows.push(['Nationalities represented', String(new Set(working.map((e) => e.nationality)).size), '', '']);
      return live(['Dimension', 'Value', 'People', 'Share'], rows);
    }
    case 'emp-exit-tenure': {
      const exits = employees.filter((e) => e.exitDate);
      const bands: [string, (y: number) => boolean][] = [
        ['Under 1 year', (y) => y < 1],
        ['1 to 3 years', (y) => y >= 1 && y < 3],
        ['3 to 5 years', (y) => y >= 3 && y < 5],
        ['5 years and over', (y) => y >= 5],
      ];
      const rows = bands.map(([label, test]) => {
        const hit = exits.filter((e) => test(tenureYears(e.dateOfJoining, e.exitDate!)));
        return [label, hit.length, pct(hit.length, exits.length), hit.map((e) => e.name).join(', ') || dash] as Cell[];
      });
      return live(['Tenure at exit', 'Exits', 'Share', 'Who'], rows, exits.length ? undefined : 'Nobody in this location has left yet, so every band is zero.');
    }

    /* ---- Leave ---- */
    case 'lv-daily': {
      const rows = leaves
        .filter((r) => r.status === 'Approved' && today >= r.fromDate && today <= r.toDate)
        .map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), deptOf(r.employeeId), r.type, r.fromDate, r.toDate, r.days] as Cell[]);
      return live(['Employee', 'Code', 'Department', 'Leave type', 'From', 'To', 'Days'], rows, rows.length ? undefined : `Nobody is on approved leave on ${today}.`);
    }
    case 'lv-availability': {
      const m = new Map<string, { total: number; leave: number; absent: number; wfh: number }>();
      att.forEach((a) => {
        const d = deptOf(a.employeeId);
        const r = m.get(d) ?? { total: 0, leave: 0, absent: 0, wfh: 0 };
        r.total++;
        if (a.status === 'Leave') r.leave++;
        if (a.status === 'Absent') r.absent++;
        if (a.status === 'WFH') r.wfh++;
        m.set(d, r);
      });
      const rows = [...m.entries()].map(([d, r]) => [d, r.total, r.leave, r.absent, r.wfh, r.total - r.leave - r.absent] as Cell[]);
      return live(['Department', 'Active people', 'On leave', 'Absent', 'Working from home', 'Available'], rows, `Today (${today}). Available = active people minus those on leave or absent.`);
    }
    case 'lv-balance': {
      const rows = working
        .map((e) => {
          const b = (t: string) => LEAVE_BALANCES.find((x) => x.employeeId === e.id && x.type === t);
          const rem = (t: string) => (b(t) ? b(t)!.entitled - b(t)!.taken : dash);
          return [...who(e), rem('Annual'), rem('Sick'), rem('Casual')] as Cell[];
        });
      return live([...WHO, 'Annual left', 'Sick left', 'Casual left'], rows, 'Balances exist for active employees; people still joining show a dash.');
    }
    case 'lv-booked': {
      const types = ['Annual', 'Sick', 'Casual'] as const;
      const rows = types.map((t) => {
        const bals = LEAVE_BALANCES.filter((b) => ids.has(b.employeeId) && b.type === t);
        const entitled = bals.reduce((n, b) => n + b.entitled, 0);
        const taken = bals.reduce((n, b) => n + b.taken, 0);
        const pending = leaves.filter((r) => r.type === t && r.status === 'Pending').reduce((n, r) => n + r.days, 0);
        return [t, entitled, taken, pending, entitled - taken] as Cell[];
      });
      return live(['Leave type', 'Entitled days', 'Taken', 'Pending approval', 'Remaining'], rows);
    }
    case 'lv-type': {
      const types = ['Annual', 'Sick', 'Casual', 'Unpaid'] as const;
      const rows = types.map((t) => {
        const own = leaves.filter((r) => r.type === t);
        const days = (s: string) => own.filter((r) => r.status === s).reduce((n, r) => n + r.days, 0);
        return [t, own.length, days('Approved'), days('Pending'), days('Rejected')] as Cell[];
      });
      return live(['Leave type', 'Requests', 'Approved days', 'Pending days', 'Rejected days'], rows);
    }
    case 'lv-encash': {
      const rows = working
        .map((e) => {
          const b = LEAVE_BALANCES.find((x) => x.employeeId === e.id && x.type === 'Annual');
          return b ? ([...who(e), b.entitled - b.taken] as Cell[]) : null;
        })
        .filter((r): r is Cell[] => !!r);
      return derived([...WHO, 'Annual days that could be encashed'], rows, 'No encashment policy or daily rate is configured yet, so the table shows the unused annual balance only and no payout amount.');
    }
    case 'lv-lop': {
      const unpaid = leaves.filter((r) => r.type === 'Unpaid').map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), 'Unpaid leave', r.fromDate, r.toDate, r.days, r.status] as Cell[]);
      const absent = att.filter((a) => a.status === 'Absent').map((a) => [nameOf(a.employeeId), codeOf(a.employeeId), 'Absent, no leave booked', a.date, a.date, 1, 'Needs review'] as Cell[]);
      return derived(['Employee', 'Code', 'Reason', 'From', 'To', 'Days', 'Status'], [...unpaid, ...absent], 'Built from Unpaid leave requests plus anyone marked absent today with no approved leave. Confirm each absence before payroll.');
    }
    case 'lv-payroll': {
      const lo = monthStart(today);
      const hi = addDays(`${addDays(lo, 31).slice(0, 7)}-01`, -1);
      const rows = working.map((e) => {
        const mine = leaves.filter((r) => r.employeeId === e.id && r.status === 'Approved');
        const paid = mine.filter((r) => r.type !== 'Unpaid').reduce((n, r) => n + overlapDays(r.fromDate, r.toDate, lo, hi), 0);
        const unpaid = mine.filter((r) => r.type === 'Unpaid').reduce((n, r) => n + overlapDays(r.fromDate, r.toDate, lo, hi), 0);
        return [...who(e), e.location, paid, unpaid] as Cell[];
      });
      return live([...WHO, 'Location', 'Paid leave days', 'Unpaid leave days'], rows, `Approved leave falling in ${today.slice(0, 7)}.`);
    }

    /* ---- Attendance ---- */
    case 'at-daily':
      return live(
        [...WHO, 'Status', 'Check-in', 'Check-out'],
        att.map((a) => [nameOf(a.employeeId), codeOf(a.employeeId), deptOf(a.employeeId), a.status, a.checkIn ?? dash, a.checkOut ?? dash] as Cell[]),
        `Attendance for ${today}.`
      );
    case 'at-punch': {
      const rows: Cell[][] = [];
      att.forEach((a) => {
        if (!a.checkIn || !a.checkOut) return;
        const e = byId.get(a.employeeId)!;
        const h = hoursOf(e.location);
        const late = minutes(a.checkIn) - minutes(h.start);
        const early = minutes(h.end) - minutes(a.checkOut);
        if (late > 0) rows.push([e.name, e.employeeCode, 'Late check-in', `${a.checkIn} (shift starts ${h.start})`, `${late} min`]);
        if (early > 0) rows.push([e.name, e.employeeCode, 'Early check-out', `${a.checkOut} (shift ends ${h.end})`, `${early} min`]);
      });
      return live(['Employee', 'Code', 'Exception', 'Punch', 'Difference'], rows, rows.length ? 'Shift times follow each location’s working hours.' : 'Nobody checked in late or left early today.');
    }
    case 'at-status': {
      const rows = att.map((a) => [nameOf(a.employeeId), codeOf(a.employeeId), deptOf(a.employeeId), a.status === 'Present' || a.status === 'WFH' ? 1 : 0, a.status === 'Leave' ? 1 : 0, a.status === 'Absent' ? 1 : 0] as Cell[]);
      return derived([...WHO, 'Days present', 'Days on leave', 'Days absent'], rows, `The app holds one day of attendance (${today}), so the period is that day.`);
    }
    case 'at-hours': {
      const rows: Cell[][] = [];
      att.forEach((a) => {
        if (!a.checkIn || !a.checkOut) return;
        const span = minutes(a.checkOut) - minutes(a.checkIn);
        rows.push([nameOf(a.employeeId), codeOf(a.employeeId), a.status, a.checkIn, a.checkOut, fmtHours(span)]);
      });
      return live(['Employee', 'Code', 'Status', 'Check-in', 'Check-out', 'Time at work'], rows, 'Time at work is check-out minus check-in; break time is not recorded.');
    }
    case 'at-payroll': {
      const lo = monthStart(today);
      const rows = working.map((e) => {
        const wd = weekdays(lo, today);
        const approved = leaves.filter((r) => r.employeeId === e.id && r.status === 'Approved');
        const paidLeave = approved.filter((r) => r.type !== 'Unpaid').reduce((n, r) => n + overlapDays(r.fromDate, r.toDate, lo, today), 0);
        const unpaid = approved.filter((r) => r.type === 'Unpaid').reduce((n, r) => n + overlapDays(r.fromDate, r.toDate, lo, today), 0);
        const absent = att.some((a) => a.employeeId === e.id && a.status === 'Absent') ? 1 : 0;
        return [...who(e), wd, paidLeave, unpaid + absent, Math.max(0, wd - unpaid - absent)] as Cell[];
      });
      return derived([...WHO, 'Working days so far', 'Paid leave days', 'Unpaid / absent days', 'Payable days'], rows, `Month to date (${today.slice(0, 7)}). Only today’s punches are stored, so earlier weekdays count as worked unless on approved leave.`);
    }
    case 'at-muster': {
      const mark: Record<string, string> = { Present: 'P', WFH: 'WFH', Leave: 'L', Absent: 'A' };
      const rows = att.map((a) => [codeOf(a.employeeId), nameOf(a.employeeId), deptOf(a.employeeId), mark[a.status] ?? a.status, a.checkIn ?? dash, a.checkOut ?? dash, ''] as Cell[]);
      return live(['Code', 'Employee', 'Department', 'Mark', 'In', 'Out', 'Signature'], rows, `Muster for ${today}. P present, WFH work from home, L leave, A absent.`);
    }
    case 'at-consecutive': {
      const rows = att.filter((a) => a.status === 'Absent').map((a) => [nameOf(a.employeeId), codeOf(a.employeeId), deptOf(a.employeeId), 1, a.date] as Cell[]);
      return derived(['Employee', 'Code', 'Department', 'Days absent in a row', 'Since'], rows, 'Only today’s attendance is stored, so the streak is 1 for anyone absent today. A longer history will extend it.');
    }

    /* ---- Performance ---- */
    case 'pf-goals': {
      const rows = myReviews.map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), r.cycle, r.goals || 'Not set', r.status] as Cell[]);
      return live(['Employee', 'Code', 'Cycle', 'Goals', 'Review status'], rows, 'Goals are written by the manager when a review is completed. Open reviews show "Not set".');
    }
    case 'pf-skills': {
      const rows = working.map((e) => {
        const done = records.filter((r) => r.employeeId === e.id && r.status === 'Completed');
        const open = records.filter((r) => r.employeeId === e.id && r.status !== 'Completed');
        return [...who(e), done.length, [...new Set(done.map((r) => r.category))].join(', ') || dash, open.map((r) => r.course).join(', ') || dash] as Cell[];
      });
      return derived([...WHO, 'Courses completed', 'Skill areas', 'Still to complete (gaps)'], rows, 'The app has no skills register. Completed training is used as the evidence of skills, and open courses as the gaps.');
    }
    case 'pf-feedback': {
      const rows = myReviews.filter((r) => r.managerComments).map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), r.cycle, 'Manager', r.managerComments!] as Cell[]);
      return derived(['Employee', 'Code', 'Cycle', 'From', 'Feedback'], rows, 'Only manager feedback recorded at review completion is available; there is no 360° feedback capture yet.');
    }
    case 'pf-status': {
      const rows = myReviews.map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), r.cycle, r.status, r.dueDate, r.status !== 'Completed' && r.dueDate < today ? `${daysBetween(r.dueDate, today)} days overdue` : dash] as Cell[]);
      return live(['Employee', 'Code', 'Cycle', 'Status', 'Due', 'Overdue'], rows);
    }
    case 'pf-rating': {
      const rows = myReviews.map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), r.cycle, r.selfRating ?? dash, r.rating ?? dash, r.status] as Cell[]);
      return live(['Employee', 'Code', 'Cycle', 'Self rating (of 5)', 'Manager rating (of 5)', 'Status'], rows);
    }
    case 'pf-score': {
      const rows = myReviews.filter((r) => r.rating !== null).map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), r.cycle, r.rating as number, `${(r.rating as number) * 20}%`] as Cell[]);
      return derived(['Employee', 'Code', 'Cycle', 'Rating (of 5)', 'Score'], rows, 'Score = manager rating × 20. Completed reviews only.');
    }
    case 'pf-ninebox': {
      const band = (n: number | null | undefined) => (n === null || n === undefined ? null : n >= 4 ? 'High' : n === 3 ? 'Medium' : 'Low');
      const rows = myReviews
        .filter((r) => band(r.rating) && band(r.selfRating))
        .map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), band(r.rating)!, band(r.selfRating)!] as Cell[]);
      const open = myReviews.filter((r) => !(band(r.rating) && band(r.selfRating))).length;
      return derived(['Employee', 'Code', 'Performance (manager rating)', 'Potential (self-rating proxy)'], rows, `No potential rating is captured. The employee’s self-rating stands in for potential, and only reviews with both ratings appear (${open} others are still open).`);
    }
    case 'pf-appraisal-feedback': {
      const rows = myReviews.filter((r) => r.selfComments || r.managerComments).map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), r.cycle, r.selfComments || dash, r.managerComments || dash] as Cell[]);
      return live(['Employee', 'Code', 'Cycle', 'Employee comments', 'Manager comments'], rows);
    }
    case 'pf-history': {
      const rows = [...myReviews].sort((a, b) => (a.cycle < b.cycle ? 1 : -1)).map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), r.cycle, r.rating ?? dash, r.completedOn ?? dash] as Cell[]);
      return live(['Employee', 'Code', 'Cycle', 'Rating (of 5)', 'Completed on'], rows, 'Lists every cycle held in the app; at present that is the current cycle only.');
    }
    case 'pf-summary': {
      const cycles = [...new Set(myReviews.map((r) => r.cycle))];
      const rows = cycles.map((c) => {
        const own = myReviews.filter((r) => r.cycle === c);
        const rated = own.filter((r) => r.rating !== null).map((r) => r.rating as number);
        return [c, own.length, rated.length, avg(rated), `${Math.round(avg(rated) * 20)}%`] as Cell[];
      });
      return live(['Cycle', 'Reviews', 'Completed', 'Average rating', 'Average score'], rows);
    }
    case 'pf-extension': {
      const rows = myReviews
        .filter((r) => r.status !== 'Completed' && r.dueDate < today)
        .map((r) => [nameOf(r.employeeId), codeOf(r.employeeId), r.cycle, r.status, r.dueDate, daysBetween(r.dueDate, today)] as Cell[]);
      return derived(['Employee', 'Code', 'Cycle', 'Status', 'Original due date', 'Days past due'], rows, 'Review extensions are not recorded, so the table lists open reviews that are past their due date and so need one.');
    }
    default:
      return { columns: ['Report'], rows: [], note: 'This report is not available.', basis: 'derived' };
  }
}
