/* Leave & Attendance — ACTIVE LAYER · core
   Runs after la.js in the same global scope. Gives the prototype real behaviour on top of the app's own
   organisation: the app's locations (working week + hours come from Administration → Settings), companies,
   employees and "today". Holds an in-memory database persisted per browser session, a form engine,
   file/CSV helpers, location + filter helpers and an audit trail. Exposed as window.LA. */
(function () {
  const LA = (window.LA = window.LA || {});
  const KEY = 'la.db.v5';
  const LKEY = 'la.ledger.v1';

  /* ---------- organisation (published by the host page) ---------- */
  const ORG = () => window.__laOrg || { today: '2026-07-06', meId: 'GS-120', locations: [], companies: [], employees: [] };
  LA.org = ORG;

  /* ---------- shared ledger: leave requests + today's attendance, one copy for this module AND the app's own screens
     (dashboard, team leave/attendance, My Space read and write the same sessionStorage record via lib/leaveBridge.ts) ---------- */
  const readLedgerStr = () => { try { return sessionStorage.getItem(LKEY); } catch { return null; } };
  let LEDGER = null;
  let ledgerSig = '';
  function loadLedger() {
    const day = ORG().today;
    try {
      const raw = readLedgerStr();
      if (raw) { const l = JSON.parse(raw); if (l && l.v === 1 && l.day === day && Array.isArray(l.leaves)) { LEDGER = l; ledgerSig = raw; return; } }
    } catch { /* unreadable — reseed */ }
    const seedL = (ORG().leave || {}).ledger;
    LEDGER = seedL ? JSON.parse(JSON.stringify(seedL)) : { v: 1, day, seq: 100, leaves: [], att: {} };
    LEDGER.day = day;
    ledgerSig = '';
  }
  LA.ledger = () => LEDGER;
  /* app employee code → approver {code, name, via}: manager, else manager's manager, else HR, else Super Admin */
  LA.approverOf = (code) => ((ORG().leave || {}).approvers || {})[code] || null;
  /* the app's entitlement + days already taken for one employee and leave type (Annual | Sick | Casual) */
  LA.baseBal = (code, app) => ((ORG().leave || {}).balances || []).find((b) => b.employeeId === code && b.type === app);

  /* ---------- date + format helpers ---------- */
  const TODAY = ORG().today;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOWL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addD = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const fmt = (s) => (s ? `${pad(parse(s).getDate())}-${MON[parse(s).getMonth()]}-${parse(s).getFullYear()}` : '—');
  const fmtS = (s) => (s ? `${parse(s).getDate()} ${MON[parse(s).getMonth()]}` : '—');
  const fmtL = (s) => `${DOWL[parse(s).getDay()]}, ${fmt(s)}`;
  const dow = (s) => parse(s).getDay();
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const range = (a, b) => { const out = []; for (let d = a; d <= b; d = addD(d, 1)) out.push(d); return out; };
  const hm = (min) => (min == null || isNaN(min) ? '-' : `${pad(Math.floor(min / 60))}:${pad(Math.round(min % 60))}`);
  const clock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const clock12 = (ms) => { const d = new Date(ms); const h = d.getHours(); return `${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  Object.assign(LA, { TODAY, MON, DOWL, pad, iso, parse, addD, fmt, fmtS, fmtL, dow, daysBetween, range, hm, clock, clock12, esc, hash, toMin });

  /* ---------- locations: working week + hours come from the app's location settings ---------- */
  const LOCS = () => ORG().locations;
  const locDef = (id) => LOCS().find((l) => l.id === id);
  const DAYIDX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  function parseWork(str) {
    const t = (str || '').match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    const d = (str || '').match(/([A-Za-z]{3})[a-z]*\s*[–-]\s*([A-Za-z]{3})/);
    let days = [1, 2, 3, 4, 5];
    if (d && DAYIDX[d[1].toLowerCase()] != null && DAYIDX[d[2].toLowerCase()] != null) {
      days = [];
      for (let i = DAYIDX[d[1].toLowerCase()]; ; i = (i + 1) % 7) { days.push(i); if (i === DAYIDX[d[2].toLowerCase()]) break; }
    }
    return { from: t ? t[1].padStart(5, '0') : '09:00', to: t ? t[2].padStart(5, '0') : '18:00', days };
  }
  const empRec = (name) => EMP.find((e) => e.n === name);
  const myCode = () => ORG().meId;
  const myLoc = () => { const e = ORG().employees.find((x) => x.code === myCode()); return e ? e.location : (LOCS()[0] || { id: 'Dubai' }).id; };
  const tplOf = (id) => (locDef(id) || { template: 'uae' }).template;
  const locName = (id) => (locDef(id) || { name: id || '—' }).name;
  const locCity = (id) => (locDef(id) || { city: id || '—' }).city;
  Object.assign(LA, {
    locs: LOCS, locDef, myLoc, tplOf, locName, locCity,
    work: (id) => parseWork((locDef(id || myLoc()) || {}).workingHours),
    workLabel: (id) => { const w = parseWork((locDef(id) || {}).workingHours); return `${w.days.length ? DOWL[w.days[0]] + '–' + DOWL[w.days[w.days.length - 1]] : '—'} · ${w.from}–${w.to}`; },
    isOff: (d, loc) => !parseWork((locDef(loc || myLoc()) || {}).workingHours).days.includes(dow(d)),
    locOf: (name) => { const e = empRec(name); return e ? e.loc : myLoc(); },
    nameOfCode: (code) => { const e = EMP.find((x) => x.id === code); return e ? e.n : code; },
  });
  LA.isWeekend = LA.isOff; // default = the signed-in user's location
  LA.weekStartOf = (d) => addD(d, -dow(d));
  LA.annualKey = () => (tplOf(myLoc()) === 'india' ? 'Earned Leave' : 'Annual Leave');

  /* ---------- roster: the prototype's EMP list is replaced by the app's real employees ---------- */
  function syncRoster() {
    const o = ORG();
    EMP.length = 0;
    o.employees.filter((e) => e.status === 'Active' || e.status === 'Offboarding').forEach((e) => {
      const w = parseWork((locDef(e.location) || {}).workingHours);
      EMP.push({ n: e.name, id: e.code, dept: e.department, desig: e.designation, loc: e.location, mgr: e.managerId, company: e.company, email: e.email, phone: e.phone, doj: e.doj || '', in: '—', out: '—', st: 'Present', late: 0, early: 0, shiftFrom: w.from });
    });
    // today's punches for everyone except the signed-in user (whose punches are live) come from the shared ledger,
    // i.e. the app's own attendance record for today, so both sides show the same status and check-in times
    const att = (LEDGER && LEDGER.att) || {};
    EMP.filter((e) => e.n !== ME_NAME()).forEach((e) => {
      const w = parseWork((locDef(e.loc) || {}).workingHours);
      if (LA.isOff(TODAY, e.loc)) { e.st = 'Weekly Off'; return; }
      const a = att[e.id];
      if (!a) { e.st = 'Absent'; return; }
      const base = toMin(w.from);
      if (a.status === 'Absent') e.st = 'Absent';
      else if (a.status === 'Leave') e.st = 'Annual Leave';
      else {
        e.st = a.status === 'WFH' ? 'Work from Home' : 'Present';
        e.in = a.checkIn || '—';
        e.out = a.checkOut || '—';
        e.late = a.checkIn && a.status !== 'WFH' && toMin(a.checkIn) > base ? toMin(a.checkIn) - base : 0;
      }
    });
  }
  const ME_NAME = () => { const e = ORG().employees.find((x) => x.code === myCode()); return e ? e.name : 'Muneer'; };
  LA.syncRoster = syncRoster;
  LA.depts = () => [...new Set(EMP.map((e) => e.dept))].sort();
  ['Casual Leave', 'Earned Leave', 'Paternity Leave', 'Marriage Leave', 'Bereavement Leave', 'Loss of Pay'].forEach((n) => { if (!ST[n]) ST[n] = ['s-b', n]; });

  /* ---------- database ---------- */
  /* today's punches for the signed-in user come from the app's attendance record (the shared ledger) */
  const atMs = (hhmm) => { const d = new Date(); const [h, m] = String(hhmm).split(':').map(Number); d.setHours(h, m || 0, 0, 0); return d.getTime(); };
  const seedSessions = () => {
    const a = ((LEDGER && LEDGER.att) || {})[myCode()];
    if (!a || !a.checkIn || (a.status !== 'Present' && a.status !== 'WFH')) return [];
    return [{ in: atMs(a.checkIn), out: a.checkOut ? atMs(a.checkOut) : null, channel: a.status === 'WFH' ? 'Web (remote)' : 'Biometric', ip: '10.20.4.18' }];
  };

  const UAE_TYPES = [
    { t: 'Annual Leave', code: 'AL', pay: 'Full', ent: '30 cal days/yr', accrual: '2.5/mo', probation: 'After probation', doc: '—' },
    { t: 'Sick Leave', code: 'SL', pay: 'Tiered', ent: '90/yr (15F/30H/45U)', accrual: 'Calendar year', probation: 'Not paid', doc: 'Cert (conditional)' },
    { t: 'Compassionate', code: 'CP', pay: 'Full', ent: '3–5 days', accrual: 'Per event', probation: 'Eligible', doc: 'Mandatory' },
    { t: 'Maternity', code: 'MT', pay: '45F + 15H', ent: '60 days', accrual: 'Per event', probation: 'Eligible', doc: 'Mandatory' },
    { t: 'Parental', code: 'PT', pay: 'Full', ent: '5 working days', accrual: 'Per birth', probation: 'Eligible', doc: 'Mandatory' },
    { t: 'Hajj', code: 'HJ', pay: 'Unpaid', ent: 'Max 30 days', accrual: 'Once in employment', probation: 'Eligible', doc: 'Evidence' },
    { t: 'Umrah', code: 'UM', pay: 'From AL/Unpaid', ent: 'HR selection', accrual: '—', probation: 'Eligible', doc: 'Evidence' },
    { t: 'Study', code: 'ST', pay: 'Full', ent: '5 days/yr', accrual: 'Calendar year', probation: 'Min 2 yrs service', doc: 'Exam evidence' },
    { t: 'Restricted Festive', code: 'RF', pay: 'Full', ent: '1 day/yr', accrual: 'Calendar year', probation: 'Eligible', doc: '—' },
    { t: 'Unpaid Leave', code: 'UP', pay: 'Unpaid', ent: 'As approved', accrual: '—', probation: 'Eligible', doc: 'Reason' },
    { t: 'Casual Leave', code: 'CS', pay: 'Full', ent: '7 days/yr', accrual: 'Calendar year', probation: 'After probation', doc: '—' },
  ].map((t, i) => ({ ...t, id: 'LU' + i, tpl: 'uae', active: true }));
  const INDIA_TYPES = [
    { t: 'Casual Leave', code: 'CL', pay: 'Full', ent: '12 days/yr', accrual: '1/mo', probation: 'After probation', doc: '—' },
    { t: 'Earned Leave', code: 'EL', pay: 'Full', ent: '15 days/yr', accrual: '1.25/mo', probation: 'After probation', doc: '—' },
    { t: 'Sick Leave', code: 'SK', pay: 'Full', ent: '12 days/yr', accrual: 'Calendar year', probation: 'Eligible', doc: 'Cert (> 2 days)' },
    { t: 'Maternity Leave', code: 'ML', pay: 'Full', ent: '26 weeks', accrual: 'Per event', probation: 'Eligible', doc: 'Mandatory' },
    { t: 'Paternity Leave', code: 'PL', pay: 'Full', ent: '5 days', accrual: 'Per birth', probation: 'Eligible', doc: 'Birth certificate' },
    { t: 'Marriage Leave', code: 'MR', pay: 'Full', ent: '5 days', accrual: 'Once in employment', probation: 'Eligible', doc: 'Invitation' },
    { t: 'Bereavement Leave', code: 'BL', pay: 'Full', ent: '3 days', accrual: 'Per event', probation: 'Eligible', doc: 'Evidence' },
    { t: 'Loss of Pay', code: 'LP', pay: 'Unpaid', ent: 'As approved', accrual: '—', probation: 'Eligible', doc: 'Reason' },
  ].map((t, i) => ({ ...t, id: 'LI' + i, tpl: 'india', active: true }));
  LA.defaultTypes = (tpl) => (tpl === 'india' ? INDIA_TYPES : UAE_TYPES).map((t) => ({ ...t, id: t.id + '-' + Math.floor(Math.random() * 1e6) }));

  const BALANCES = {
    uae: () => ({
      'Annual Leave': { avail: 14, booked: 3.5, pending: 0, cap: 30, note: 'Accrues 2.5 days / eligible month', card: 'Earned Leave', ic: 'sun', bg: '#e7f6ee', fg: '#1f9d63' },
      'Sick Leave': { avail: 6.5, booked: 3.5, pending: 0, cap: 90, note: '90/yr · 15 full · 30 half · 45 unpaid', card: 'Sick Leave', ic: 'baby', bg: '#f0eafc', fg: '#7a4bd0' },
      'Compensatory Off': { avail: 0, booked: 3, pending: 0, cap: null, note: 'Credited from approved weekend/holiday work', card: 'Compensatory Off', ic: 'gift', bg: '#e7f6ee', fg: '#1f9d63' },
      'Unpaid Leave': { avail: null, booked: 0, pending: 0, cap: null, note: 'As approved · loss of pay', card: 'Leave Without Pay', ic: 'flame', bg: '#fce9e7', fg: '#d5493f' },
      'Work From Home': { avail: null, booked: 0, pending: 0, cap: null, note: 'Approval based', card: 'Work From Home', ic: 'home', bg: '#e7f0fc', fg: '#2f6fd6' },
      'Compassionate Leave': { avail: 5, booked: 0, pending: 0, cap: 5, note: 'Per bereavement event', card: 'Compassionate', ic: 'shield', bg: '#f0eafc', fg: '#7a4bd0' },
      'Study Leave': { avail: 5, booked: 0, pending: 0, cap: 5, note: 'Min 2 yrs service', card: 'Study Leave', ic: 'book', bg: '#e7f0fc', fg: '#2f6fd6' },
      'Restricted Festive': { avail: 1, booked: 0, pending: 0, cap: 1, note: '1 paid day / year', card: 'Restricted Festive', ic: 'gift', bg: '#fdf3df', fg: '#c6851b' },
      'Casual Leave': { avail: 7, booked: 0, pending: 0, cap: 7, note: '7 days / year', card: 'Casual Leave', ic: 'sun', bg: '#e7f6ee', fg: '#1f9d63' },
    }),
    india: () => ({
      'Casual Leave': { avail: 8, booked: 4, pending: 0, cap: 12, note: '12 days / year · accrues 1 per month', card: 'Casual Leave', ic: 'sun', bg: '#e7f6ee', fg: '#1f9d63' },
      'Earned Leave': { avail: 11, booked: 4, pending: 0, cap: 15, note: '15 days / year · accrues 1.25 per month', card: 'Earned Leave', ic: 'plan', bg: '#e7f0fc', fg: '#2f6fd6' },
      'Sick Leave': { avail: 9, booked: 3, pending: 0, cap: 12, note: '12 days / year · certificate above 2 days', card: 'Sick Leave', ic: 'baby', bg: '#f0eafc', fg: '#7a4bd0' },
      'Compensatory Off': { avail: 0, booked: 1, pending: 0, cap: null, note: 'Credited from approved weekend/holiday work', card: 'Compensatory Off', ic: 'gift', bg: '#e7f6ee', fg: '#1f9d63' },
      'Unpaid Leave': { avail: null, booked: 0, pending: 0, cap: null, note: 'As approved · loss of pay', card: 'Loss of Pay', ic: 'flame', bg: '#fce9e7', fg: '#d5493f' },
      'Work From Home': { avail: null, booked: 0, pending: 0, cap: null, note: 'Approval based', card: 'Work From Home', ic: 'home', bg: '#e7f0fc', fg: '#2f6fd6' },
      'Bereavement Leave': { avail: 3, booked: 0, pending: 0, cap: 3, note: 'Per event', card: 'Bereavement', ic: 'shield', bg: '#f0eafc', fg: '#7a4bd0' },
      'Marriage Leave': { avail: 5, booked: 0, pending: 0, cap: 5, note: 'Once in employment', card: 'Marriage', ic: 'gift', bg: '#fdf3df', fg: '#c6851b' },
    }),
  };

  const POLICY = {
    uae: (w) => ({ name: 'GSIT Leave and Attendance Policy', year: '2024', country: 'United Arab Emirates', applicable: 'All regular employees', week: w.week, off: w.off, hours: '41.5 (excl. breaks)', probation: '6 months', monitor: 'Rolling 12 months', cycles: '12 monthly', approval: 'Reporting Manager and/or HR', override: 'Authorized HR Administrator' }),
    india: (w) => ({ name: 'GSIT India Leave and Attendance Policy', year: '2024', country: 'India', applicable: 'All regular employees', week: w.week, off: w.off, hours: '45 (excl. breaks)', probation: '6 months', monitor: 'Financial year (Apr–Mar)', cycles: '12 monthly', approval: 'Reporting Manager and/or HR', override: 'Authorized HR Administrator' }),
  };
  const weekText = (id) => { const w = parseWork((locDef(id) || {}).workingHours); const off = [0, 1, 2, 3, 4, 5, 6].filter((d) => !w.days.includes(d)); const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; return { week: `${names[w.days[0]]} to ${names[w.days[w.days.length - 1]]}`, off: off.map((d) => names[d]).join(' and ') }; };

  function seed() {
    const o = ORG();
    const T = TODAY;
    const d = (n) => addD(T, n);
    const meN = ME_NAME();
    const mine = myLoc();
    const otherLoc = (LOCS().find((l) => l.template !== tplOf(mine)) || LOCS().find((l) => l.id !== mine) || { id: mine }).id;
    const pool = (loc) => EMP.filter((e) => e.n !== meN && e.loc === loc);
    const any = EMP.filter((e) => e.n !== meN);
    const pick = (list, i) => (list.length ? list[i % list.length].n : (any.length ? any[i % any.length].n : meN));
    const dn = (i) => pick(pool(mine), i);
    const kn = (i) => pick(pool(otherLoc), i);
    const code = (n) => { const e = EMP.find((x) => x.n === n); return e ? e.id : ''; };
    const lastWork = (loc, from) => { let x = from; for (let i = 0; i < 10 && LA.isOff(x, loc); i++) x = addD(x, -1); return x; };
    const missDay = lastWork(mine, d(-1));
    const tplMine = tplOf(mine);
    const anLeave = tplMine === 'india' ? 'Earned Leave' : 'Annual Leave';
    const tm = (day, n) => lastWork(mine, d(day - n));
    const sickK = tplOf(otherLoc) === 'india' ? 'Sick Leave' : 'Sick Leave';
    const casualK = tplOf(otherLoc) === 'india' ? 'Casual Leave' : 'Annual Leave';
    const earnedK = tplOf(otherLoc) === 'india' ? 'Earned Leave' : 'Annual Leave';
    const co = (loc) => ({ loc });
    const dev = (id, loc, place, mapped, sync, online) => ({ id, loc, place, mapped, sync, online });
    const mkHol = (id, dd, to, n, type, locs) => ({ id, d: dd, to, n, type, locs });
    const dub = LOCS().filter((l) => l.template === 'uae').map((l) => l.id);
    const ind = LOCS().filter((l) => l.template === 'india').map((l) => l.id);
    const allIds = LOCS().map((l) => l.id);
    const y = T.slice(0, 4);
    const shifts = [];
    LOCS().forEach((l) => {
      const w = parseWork(l.workingHours);
      shifts.push({ id: 'S-' + l.id + '-1', loc: l.id, name: 'General', type: 'Fixed', timing: `${w.from}–${w.to}`, brk: '60 min', assigned: 'All (' + l.city + ')' });
      shifts.push({ id: 'S-' + l.id + '-2', loc: l.id, name: l.template === 'india' ? 'Night Support' : 'Night Ops', type: 'Night', timing: l.template === 'india' ? '21:00–06:00' : '22:00–06:00', brk: '60 min', assigned: l.template === 'india' ? 'Managed Services' : 'DevOps' });
      shifts.push({ id: 'S-' + l.id + '-3', loc: l.id, name: 'Client Site', type: 'Flexible', timing: 'Variable', brk: 'As logged', assigned: 'Field team' });
      if (l.template === 'uae') shifts.push({ id: 'S-' + l.id + '-4', loc: l.id, name: 'Ramadan', type: 'Fixed', timing: '09:00–15:00', brk: '30 min', assigned: 'All (temporary)' });
    });
    const devices = [];
    LOCS().forEach((l, i) => {
      const code = l.template === 'india' ? 'COK' : 'DXB';
      const n = EMP.filter((e) => e.loc === l.id).length;
      devices.push(dev(`BIO-${code}-01`, l.id, `${l.city} · Main entrance`, n, `${fmtS(d(-1))} 06:00`, true));
      devices.push(dev(`BIO-${code}-02`, l.id, `${l.city} · ${l.template === 'india' ? 'Floor 2' : '3rd floor'}`, n, `${fmtS(d(-1))} 06:00`, true));
      if (i === 0) devices.push(dev(`BIO-${code}-03`, l.id, `${l.city} · Server room`, 2, `${fmtS(d(-2))} 22:10`, false));
    });
    const periods = {};
    const periodsFor = (loc) => {
      const m = T.slice(0, 7);
      const prev = addD(`${m}-01`, -1).slice(0, 7);
      const next = addD(`${m}-28`, 6).slice(0, 7);
      const nm = (k) => `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`;
      return [{ name: nm(prev), key: prev, status: 'Locked', records: EMP.filter((e) => e.loc === loc).length }, { name: nm(m), key: m, status: 'Open', records: EMP.filter((e) => e.loc === loc).length }, { name: nm(next), key: next, status: 'Not started', records: 0 }];
    };
    LOCS().forEach((l) => { periods[l.id] = periodsFor(l.id); });
    const policyBy = {}; const confirmBy = {};
    LOCS().forEach((l) => { policyBy[l.id] = POLICY[l.template](weekText(l.id)); confirmBy[l.id] = {}; });
    const ramadan = {};
    LOCS().filter((l) => l.template === 'uae').forEach((l) => { ramadan[l.id] = { start: `${y}-02-18`, end: `${y}-03-19`, reduction: '2 hours', scope: 'Company', from: '09:00', to: '15:00', brk: '30 min', revert: 'Enabled — restore standard schedule', saved: false }; });
    const lastRun = {};
    LOCS().forEach((l) => { lastRun[l.id] = { at: `${d(-1)} 06:00`, processed: EMP.filter((e) => e.loc === l.id).length, exceptions: 0, failed: 0, clean: 0 }; });
    const holidaysFallback = [
      mkHol('H1', `${y}-01-01`, '', 'New Year’s Day', 'Public', allIds),
      mkHol('H2', `${y}-03-20`, `${y}-03-22`, 'Eid Al Fitr', 'Public', dub),
      mkHol('H3', `${y}-05-26`, `${y}-05-29`, 'Arafat Day & Eid Al Adha', 'Public', dub),
      mkHol('H4', `${y}-06-16`, '', 'Islamic New Year', 'Public', dub),
      mkHol('H5', `${y}-08-25`, '', 'Prophet’s Birthday', 'Public', dub),
      mkHol('H6', `${y}-12-01`, '', 'Commemoration Day', 'Public', dub),
      mkHol('H7', `${y}-12-02`, `${y}-12-03`, 'UAE National Day', 'Public', dub),
      mkHol('H8', `${y}-01-26`, '', 'Republic Day', 'Public', ind),
      mkHol('H9', `${y}-04-14`, '', 'Vishu', 'Public', ind),
      mkHol('H10', `${y}-05-01`, '', 'May Day', 'Public', ind),
      mkHol('H11', `${y}-08-15`, '', 'Independence Day', 'Public', ind),
      mkHol('H12', `${y}-08-26`, '', 'Thiruvonam', 'Public', ind),
      mkHol('H13', `${y}-10-02`, '', 'Gandhi Jayanti', 'Public', ind),
      mkHol('H14', `${y}-10-20`, '', 'Vijayadasami', 'Public', ind),
      mkHol('H15', `${y}-11-08`, '', 'Diwali', 'Public', ind),
      mkHol('H16', `${y}-12-25`, '', 'Christmas', 'Public', ind),
    ];
    // the app publishes the holiday list so the app and the module count working days the same way
    const holidays = o.leave && o.leave.holidays && o.leave.holidays.length ? o.leave.holidays.map((h) => mkHol(h.id, h.d, h.to, h.n, h.type, h.tpl === 'all' ? allIds : h.tpl === 'uae' ? dub : ind)) : holidaysFallback;
    const companies = (o.companies || []).map((c) => ({ id: c.id, name: c.name, code: c.code, loc: c.location === 'Both' ? 'all' : c.location, status: c.status === 'Inactive' ? 'Suspended' : 'Active', branches: c.location === 'Both' ? Math.max(2, LOCS().length) : 1, policy: c.location === 'Both' ? '2024 · v3' : '2024 · v2' }));
    const memName = (loc) => EMP.filter((e) => e.loc === loc);
    void co; void memName; void sickK; void casualK; void earnedK;

    return {
      v: 5,
      seq: { LV: 2050, RG: 990, OT: 120, PL: 10, EX: 10, DC: 43, AN: 3, TS: 1, CO: 4, ADJ: 4, ENC: 4, DEV: 4, RUN: 2, SCH: 1, FILE: 1, STA: 1, SHF: 1, MAT: 3 },
      me: { name: meN, id: myCode(), desig: (o.employees.find((x) => x.code === myCode()) || {}).designation || 'General Manager', dept: (o.employees.find((x) => x.code === myCode()) || {}).department || 'Management', mgr: '—' },
      today: { date: T, sessions: seedSessions() },
      bal: BALANCES[tplMine](),
      leaves: LEDGER.leaves,
      plans: [
        { id: 'PL-1', emp: meN, seg: 1, from: `${y}-02-02`, to: `${y}-02-06`, st: 'Approved' },
        { id: 'PL-2', emp: meN, seg: 2, from: d(19), to: d(27), st: 'Pending' },
        { id: 'PL-3', emp: dn(2), seg: 1, from: d(98), to: d(105), st: 'Pending' },
        { id: 'PL-4', emp: dn(3), seg: 1, from: d(18), to: d(23), st: 'Approved' },
        { id: 'PL-5', emp: kn(1), seg: 1, from: d(60), to: d(67), st: 'Pending' },
      ],
      ots: [
        { id: 'OT-116', emp: meN, date: lastWork(mine, d(-9)), hours: 5, cat: 'Normal (+25%)', comp: 'Compensatory off', reason: 'Release support', st: 'Approved', by: 'Manager' },
        { id: 'OT-117', emp: meN, date: lastWork(mine, d(-6)), hours: 2, cat: 'Normal (+25%)', comp: 'Special allowance', reason: 'Client deadline', st: 'Pending', by: '' },
        { id: 'OT-115', emp: meN, date: lastWork(mine, d(-20)), hours: 1.5, cat: 'Normal (+25%)', comp: 'Overtime payment', reason: 'Month-end close', st: 'Approved', by: 'Manager' },
        { id: 'OT-118', emp: dn(3), date: d(-1), hours: 5, cat: 'Weekend / holiday', comp: 'Compensatory off', reason: 'Weekend release', st: 'Pending', by: '' },
        { id: 'OT-114', emp: dn(2), date: lastWork(mine, d(-12)), hours: 2, cat: 'Night 10PM–4AM (+50%)', comp: 'Overtime payment', reason: 'Night deployment', st: 'Approved', by: 'Manager' },
        { id: 'OT-119', emp: kn(3), date: d(-1), hours: 4, cat: 'Weekend / holiday', comp: 'Compensatory off', reason: 'Production support', st: 'Pending', by: '' },
        { id: 'OT-113', emp: kn(2), date: lastWork(otherLoc, d(-8)), hours: 3, cat: 'Normal (+25%)', comp: 'Overtime payment', reason: 'Quarter close', st: 'Approved', by: 'Manager' },
      ],
      regs: [
        { id: 'RG-981', emp: meN, kind: 'Regularization', date: missDay, detail: 'Missing check-out — biometric failure', reason: 'Missing punch', from: '09:00', to: '18:00', st: 'Pending', stage: 'Reporting Manager', applied: d(0) },
        { id: 'RG-960', emp: meN, kind: 'Regularization', date: lastWork(mine, d(-20)), detail: 'Client site — no punch', reason: 'Client site', from: '09:00', to: '18:00', st: 'Approved', stage: 'Completed', applied: d(-19) },
        { id: 'RG-977', emp: meN, kind: 'Scheduled Late Login', date: lastWork(mine, d(-10)), detail: 'Prior notice — clinic appointment', reason: 'Late login', from: '', to: '', st: 'Approved', stage: 'Completed', applied: d(-12) },
        { id: 'RG-970', emp: meN, kind: 'Shift Change', date: lastWork(mine, d(-16)), detail: 'Swap to client-site shift', reason: 'Shift', from: '', to: '', st: 'Approved', stage: 'Completed', applied: d(-18) },
        { id: 'RG-965', emp: meN, kind: 'Early Departure', date: lastWork(mine, d(-19)), detail: 'Left 45 min early — no prior request', reason: 'Early', from: '', to: '', st: 'Rejected', stage: 'HR', applied: d(-19) },
        { id: 'RG-985', emp: dn(0), kind: 'Scheduled Late Login', date: T, detail: 'Clinic appointment', reason: 'Late login', from: '', to: '', st: 'Pending', stage: 'Reporting Manager', applied: d(-1) },
        { id: 'RG-986', emp: kn(0), kind: 'Regularization', date: lastWork(otherLoc, d(-3)), detail: 'Client site — no punch', reason: 'Client site', from: '09:30', to: '18:30', st: 'Pending', stage: 'Reporting Manager', applied: d(-2) },
      ],
      fixes: {},
      manual: {},
      exceptions: [
        { id: 'EX-1', emp: meN, date: missDay, kind: 'Missing Check-Out', detail: 'Biometric failure', st: 'Open', group: 'miss' },
        { id: 'EX-2', emp: dn(1), date: lastWork(mine, d(-4)), kind: 'Missing Check-In', detail: 'Biometric failure', st: 'Open', group: 'miss' },
        { id: 'EX-3', emp: dn(2), date: T, kind: 'Unauthorized Absence', detail: 'No punch, no approval', st: 'Open', group: 'unauth' },
        { id: 'EX-4', emp: kn(1), date: lastWork(otherLoc, d(-3)), kind: 'Duplicate punch', detail: '2 check-ins within 30s', st: 'Open', group: 'dup' },
        { id: 'EX-5', emp: kn(2), date: lastWork(otherLoc, d(-3)), kind: 'Invalid record', detail: 'Punch before shift start', st: 'Open', group: 'dup' },
        { id: 'EX-6', emp: kn(0), date: lastWork(otherLoc, d(-3)), kind: 'Missing Check-Out', detail: 'Client site', st: 'Open', group: 'miss' },
      ],
      occ: [
        { emp: dn(0), id: code(dn(0)), type: 'Unscheduled Late Login', count: 5, thr: 6, waived: 0, action: 'Approaching occurrence' },
        { emp: dn(2), id: code(dn(2)), type: 'Unauthorized Absence', count: 1, thr: 1, waived: 0, action: 'First Written Warning (recommended)' },
        { emp: meN, id: code(meN), type: 'Pattern Absence', count: 2, thr: 5, waived: 0, action: 'Under watch' },
        { emp: kn(0), id: code(kn(0)), type: 'Unscheduled Early Departure', count: 1, thr: 3, waived: 0, action: 'OK' },
        { emp: dn(3), id: code(dn(3)), type: 'Recurring Scheduled Late Login', count: 4, thr: 7, waived: 0, action: 'OK' },
        { emp: kn(2), id: code(kn(2)), type: 'Unscheduled Late Login', count: 3, thr: 6, waived: 0, action: 'Under watch' },
      ],
      cases: [
        { id: 'DC-042', emp: dn(2), trigger: '1 unauthorized absence', rec: 'First Written Warning', note: 'Confirmed absence', st: 'Pending', decision: '', ref: '' },
        { id: 'DC-039', emp: dn(0), trigger: '5 unscheduled late logins', rec: 'Verbal Warning', note: 'Traffic pattern', st: 'Pending', decision: '', ref: '' },
        { id: 'DC-031', emp: dn(3), trigger: 'Pattern absence (probation)', rec: 'Verbal Warning', note: 'Under probation', st: 'Done', decision: 'Issue recommended warning', ref: 'WRN-2026-009' },
      ],
      med: [
        { id: 'MD-1', emp: kn(0), inst: '1st', period: `${fmtS(d(0))}–${fmtS(d(1))}`, days: 2, req: 'Cert (≥2 days)', doc: 'Uploaded', st: 'Pending', leave: '' },
        { id: 'MD-2', emp: dn(1), inst: '2nd', period: fmtS(d(-12)), days: 1, req: 'Prescription', doc: 'Uploaded', st: 'Pending', leave: '' },
        { id: 'MD-3', emp: kn(2), inst: '7th', period: fmtS(d(-15)), days: 1, req: 'Cert (>6 instances)', doc: 'Missing', st: 'Pending', leave: '' },
      ],
      adj: [
        { id: 'ADJ-1', emp: dn(3), type: anLeave, change: 2, reason: 'Recall reimbursement', by: meN, date: d(-22) },
        { id: 'ADJ-2', emp: meN, type: 'Compensatory Off', change: 1, reason: 'Weekend work credit', by: meN, date: d(-24) },
        { id: 'ADJ-3', emp: kn(1), type: 'Casual Leave', change: -1.5, reason: 'Correction of accrual', by: meN, date: d(-34) },
      ],
      cf: [
        { id: 'CF-1', emp: meN, days: 2, year: `${Number(y) - 1}–${y.slice(2)}`, expires: `${Number(y) + 1}-03-31`, st: 'Pending' },
        { id: 'CF-2', emp: kn(0), days: 3.5, year: `FY ${Number(y) - 1}–${y.slice(2)}`, expires: `${Number(y) + 1}-03-31`, st: 'Approved' },
        { id: 'CF-3', emp: dn(3), days: 1, year: `${Number(y) - 1}–${y.slice(2)}`, expires: `${Number(y) + 1}-02-28`, st: 'Pending' },
      ],
      enc: [
        { id: 'ENC-1', emp: dn(3), days: 5, reason: 'Operational — no leave possible', mgr: 'Approved', hr: 'Pending', payroll: '—' },
        { id: 'ENC-2', emp: dn(2), days: 3, reason: 'Operational', mgr: 'Approved', hr: 'Approved', payroll: 'Queued' },
        { id: 'ENC-3', emp: kn(3), days: 4, reason: 'Operational', mgr: 'Pending', hr: '—', payroll: '—' },
      ],
      mat: [
        { id: 'MAT-1', emp: dn(2), type: 'Standard maternity', full: 45, half: 15, unpaid: 0, st: 'On leave' },
        { id: 'MAT-2', emp: kn(3), type: 'Statutory maternity (26 weeks)', full: 182, half: 0, unpaid: 0, st: 'Approved' },
      ],
      par: [{ id: 'PAR-1', emp: dn(1), ent: '5 working days', window: 'Birth → 6 months', doc: 'Uploaded', st: 'Approved' }],
      hol: holidays,
      ltypes: UAE_TYPES.concat(INDIA_TYPES).map((t) => ({ ...t })),
      statusExtra: [],
      statusFlags: {},
      shifts,
      ramadan,
      policyBy,
      confirmBy,
      workflows: [
        ['Annual / Earned Leave', 'Employee → Reporting Manager → HR notification/approval as configured', 'all'],
        ['Annual Leave Encashment', 'Employee/HR → Reporting Manager → HR → Payroll', 'uae'],
        ['Sick Leave', 'Employee → Reporting Manager → HR document verification where required', 'all'],
        ['Compassionate / Bereavement Leave', 'Employee → Reporting Manager → HR verification', 'all'],
        ['Maternity Leave', 'Employee → Reporting Manager → HR final approval', 'all'],
        ['Parental / Paternity Leave', 'Employee → Department Manager → HR final approval', 'all'],
        ['Hajj / Umrah / Study Leave', 'Employee → Reporting Manager → HR final approval', 'uae'],
        ['Casual Leave', 'Employee → Reporting Manager', 'india'],
        ['Unpaid Leave / Loss of Pay', 'Employee → Reporting Manager → HR → Payroll notification', 'all'],
      ],
      periods,
      lastRun,
      companies,
      devices,
      rawPunches: [
        { ts: `${fmtS(d(-1))} 08:04:11`, emp: myCode(), dev: devices[0] ? devices[0].id : 'BIO-DXB-01', type: 'IN', st: 'Processed', loc: mine },
        { ts: `${fmtS(d(-1))} 08:00:02`, emp: (pool(mine)[0] || {}).id || '—', dev: devices[0] ? devices[0].id : 'BIO-DXB-01', type: 'IN', st: 'Processed', loc: mine },
        { ts: `${fmtS(d(-1))} 09:35:47`, emp: (pool(otherLoc)[0] || {}).id || '—', dev: (devices.find((x) => x.loc === otherLoc) || devices[0] || { id: 'BIO-COK-01' }).id, type: 'IN', st: 'Processed', loc: otherLoc },
        { ts: `${fmtS(d(-6))} 09:10:00`, emp: (pool(otherLoc)[1] || pool(mine)[1] || {}).id || '—', dev: (devices.find((x) => x.loc === otherLoc) || devices[0] || { id: 'BIO-COK-01' }).id, type: 'IN', st: 'Failed → reprocess', loc: otherLoc },
      ],
      apiKey: { masked: 'gsit_live_••••••••a91f', rotated: d(-35) },
      sync: [['Employee sync', 'Hourly'], ['Shift sync', 'Hourly'], ['Biometric import', '06:00 daily'], ['Payroll export', 'Monthly · manual']],
      roles: [
        ['Check-in / out & own requests', 'y', 'y', 'y', 'y'], ['View team attendance', 'n', 'y', 'y', 'y'], ['Approve leave / regularization', 'n', 'y', 'y', 'y'],
        ['Configure policies & shifts', 'n', 'n', 'y', 'y'], ['Verify medical documents', 'n', 'n', 'y', 'y'], ['Override attendance', 'n', 'n', 'y', 'y'],
        ['Create / waive occurrences', 'n', 'n', 'y', 'y'], ['Lock / reopen payroll period', 'n', 'n', 'y', 'y'], ['Manage companies & branches', 'n', 'n', 'n', 'y'],
        ['Manage integrations & devices', 'n', 'n', 'n', 'y'], ['View system audit & security', 'n', 'n', 'partial', 'y'],
      ],
      sched: [],
      reportRuns: [],
      audit: [
        { at: d(-1), ts: `${fmtS(d(-1))} 06:02`, user: 'system', action: 'Attendance processed', entity: `${EMP.length} records`, change: '—', reason: 'Scheduled run', ip: '—', loc: mine },
        { at: d(-2), ts: `${fmtS(d(-2))} 17:40`, user: meN, action: 'Balance adjustment', entity: `${dn(3)} · ${anLeave}`, change: '10.0 → 12.0', reason: 'Recall reimbursement', ip: '10.20.4.9', loc: mine },
        { at: d(-3), ts: `${fmtS(d(-3))} 11:15`, user: meN, action: 'Medical verified', entity: `${kn(0)} · Sick Leave`, change: 'Pending → Verified', reason: 'Cert valid', ip: '10.20.4.9', loc: otherLoc },
        { at: d(-5), ts: `${fmtS(d(-5))} 18:00`, user: meN, action: 'Period locked', entity: periods[mine][0].name, change: 'Open → Locked', reason: 'Payroll cut-off', ip: '10.20.4.9', loc: mine },
        { at: d(-6), ts: `${fmtS(d(-6))} 09:30`, user: meN, action: 'Leave approved', entity: 'LV-2049', change: 'Pending → Approved', reason: '—', ip: '10.20.4.31', loc: otherLoc },
      ],
      announce: [
        { id: 'AN-1', t: 'Ramadan schedule published', s: 'Reduced hours 09:00–15:00 for all UAE staff', by: 'HR', on: `${y}-02-10`, locs: dub },
        { id: 'AN-2', t: 'Onam holiday list published', s: 'Kochi — Thiruvonam on 26 Aug; restricted days apply', by: 'HR', on: d(-10), locs: ind },
        { id: 'AN-3', t: 'Attendance regularization reminder', s: 'Raise missing-punch requests within 3 working days', by: 'HR', on: d(-3), locs: allIds },
      ],
      policies: [
        { n: 'Leave & Attendance Policy', v: '2024 · v3', eff: `${y}-01-01`, st: 'Active', ack: false, body: 'Governs attendance capture, leave entitlement, approvals, overtime and disciplinary thresholds.', tpl: 'all' },
        { n: 'Overtime & Comp-Off', v: '2024 · v1', eff: `${y}-01-01`, st: 'Active', ack: false, body: 'Overtime requires prior manager approval. Weekend work is compensated by an alternative day off or a premium wage.', tpl: 'all' },
        { n: 'Disciplinary Framework', v: '2024 · v2', eff: `${y}-01-01`, st: 'Active', ack: true, body: 'Occurrence thresholds produce recommendations only. HR confirmation is mandatory; no automated termination.', tpl: 'all' },
        { n: 'UAE Labour Law — Leave Addendum', v: '2024 · v1', eff: `${y}-01-01`, st: 'Active', ack: false, body: 'Annual leave 30 calendar days, tiered sick leave, Hajj/Umrah and study leave per UAE Labour Law.', tpl: 'uae' },
        { n: 'India Leave Addendum (Kerala)', v: '2024 · v1', eff: `${y}-01-01`, st: 'Active', ack: false, body: 'Casual, earned and sick leave per the Kerala Shops & Establishments Act; Onam and Vishu observed.', tpl: 'india' },
      ],
      newhires: [],
      orgFiles: [
        { id: 'F0', name: 'Leave & Attendance Policy 2024.pdf', size: 482000, by: 'HR', on: `${y}-01-02`, url: '' },
        { id: 'F00', name: `Holiday Calendar ${y}.pdf`, size: 126000, by: 'HR', on: `${Number(y) - 1}-12-20`, url: '' },
      ],
      timesheet: [{ id: 'TS-0', date: d(-1), project: 'Internal', hours: 4, note: 'Planning' }],
      ui: {},
      notifSeen: '',
    };
  }

  /* ---------- state + persistence ---------- */
  loadLedger();
  syncRoster();
  let DB = seed();
  LA.db = () => DB;
  // the per-user blob never carries leave requests: those live in the shared ledger
  const persist = (d) => JSON.stringify(d, function (k, v) { return k === 'url' || (k === 'leaves' && this === d) ? undefined : v; });
  function load() {
    loadLedger();
    syncRoster();
    try {
      const raw = sessionStorage.getItem(`${KEY}.${myCode()}`);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.v === 5) {
          DB = s; DB.leaves = LEDGER.leaves;
          if (!DB.today || DB.today.date !== TODAY) DB.today = { date: TODAY, sessions: seedSessions() };
          fillMissing(); syncBal(); return;
        }
      }
    } catch { /* storage unavailable — start from the seed */ }
    DB = seed(); syncBal();
  }

  /* balances for Annual / Sick / Casual are derived from the app's entitlement + the ledger, so approving or
     rejecting a request anywhere moves them; direct adjustments made elsewhere (HR adjustments, carry-forward) are kept */
  const R1x = (n) => Math.round(n * 10) / 10;
  function syncBal() {
    if (!LEDGER || !DB || !DB.bal) return;
    const code = DB.me.id;
    const keys = { Annual: LA.annualKey(), Sick: 'Sick Leave', Casual: 'Casual Leave' };
    Object.keys(keys).forEach((app) => {
      const b = DB.bal[keys[app]]; const base = LA.baseBal(code, app);
      if (!b || !base) return;
      let taken = base.taken; let pending = 0;
      LEDGER.leaves.forEach((l) => {
        if (l.code !== code || l.app !== app) return;
        if (l.st === 'Approved' && !l.inBase) taken += l.days; else if (l.st === 'Cancelled' && l.inBase) taken -= l.days; else if (l.st === 'Pending') pending += l.days;
      });
      const d = R1x(base.entitled - taken);
      const adj = b._d == null ? 0 : b.avail - b._d;
      b.avail = R1x(d + adj); b._d = d; b.cap = base.entitled; b.booked = R1x(taken); b.pending = R1x(pending);
    });
  }
  LA.syncBal = syncBal;
  syncBal();
  /* publish the ledger (leave requests + the signed-in user's live attendance) for the app's screens */
  function writeLedger() {
    if (!LEDGER) return;
    const ss = DB.today && DB.today.sessions;
    if (ss && ss.length) {
      const prev = LEDGER.att[myCode()] || {}; const last = ss[ss.length - 1];
      LEDGER.att[myCode()] = { status: prev.status === 'WFH' ? 'WFH' : 'Present', checkIn: clock(ss[0].in), checkOut: last.out == null ? undefined : clock(last.out) };
    }
    const str = JSON.stringify(LEDGER);
    if (str === ledgerSig) return;
    ledgerSig = str;
    try { sessionStorage.setItem(LKEY, str); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('la:ledger', { detail: { src: 'la' } }));
  }
  LA.writeLedger = writeLedger;
  // a decision or request made in the app's own screens
  window.addEventListener('la:ledger', (e) => {
    if (e.detail && e.detail.src === 'la') return;
    const raw = readLedgerStr();
    if (!raw || raw === ledgerSig) return;
    try {
      const l = JSON.parse(raw);
      if (!l || l.v !== 1) return;
      LEDGER = l; ledgerSig = raw; DB.leaves = LEDGER.leaves;
      syncRoster(); syncBal();
      if (window.__laRoot) rr();
    } catch { /* ignore */ }
  });
  // organisation changes (e.g. a location added in Settings) after the DB was created
  function fillMissing() {
    const t = seed();
    LOCS().forEach((l) => {
      if (!DB.periods[l.id]) DB.periods[l.id] = t.periods[l.id];
      if (!DB.policyBy[l.id]) DB.policyBy[l.id] = t.policyBy[l.id];
      if (!DB.confirmBy[l.id]) DB.confirmBy[l.id] = {};
      if (!DB.lastRun[l.id]) DB.lastRun[l.id] = t.lastRun[l.id];
      if (!DB.shifts.some((s) => s.loc === l.id)) DB.shifts.push(...t.shifts.filter((s) => s.loc === l.id));
      if (!DB.devices.some((s) => s.loc === l.id)) DB.devices.push(...t.devices.filter((s) => s.loc === l.id));
    });
    (ORG().companies || []).forEach((c) => { if (!DB.companies.some((x) => x.id === c.id)) DB.companies.push(t.companies.find((x) => x.id === c.id)); });
    DB.companies = DB.companies.filter(Boolean);
  }
  LA.opsFilter = (v) => opsFilter(v);
  LA.statStrip = (items) => statStrip(items);
  LA.orgChanged = () => {
    if (!window.__laRoot) return;
    // A different person signed in: flush the previous user's data, then load (or seed) the new user's.
    if (DB.me.id !== myCode()) { clearTimeout(saveT); writeLedger(); try { sessionStorage.setItem(`${KEY}.${DB.me.id}`, persist(DB)); } catch { /* ignore */ } load(); }
    syncRoster(); fillMissing(); syncBal();
    const p = ORG().persona;
    if (p && p !== PERSONA) setPersona(p); else renderAll();
  };
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    writeLedger();
    saveT = setTimeout(() => { try { sessionStorage.setItem(`${KEY}.${DB.me.id}`, persist(DB)); } catch { /* ignore */ } }, 50);
  }
  LA.save = save;
  LA.load = load;
  LA.reset = () => { try { sessionStorage.removeItem(`${KEY}.${DB.me.id}`); } catch { /* ignore */ } DB = seed(); syncBal(); renderAll(); };
  const nextId = (p) => { DB.seq[p] = (DB.seq[p] || 0) + 1; return `${p}-${DB.seq[p]}`; };
  LA.nextId = nextId;
  const meN = () => DB.me.name;
  LA.me = meN;

  /* per-location lookups */
  LA.periodsOf = (loc) => (DB.periods[loc] ||= seed().periods[loc] || []);
  LA.policyOf = (loc) => (DB.policyBy[loc] ||= POLICY[tplOf(loc)](weekText(loc)));
  LA.confOf = (loc) => (DB.confirmBy[loc] ||= {});
  LA.lastRunOf = (loc) => (DB.lastRun[loc] ||= { at: `${TODAY} 06:00`, processed: EMP.filter((e) => e.loc === loc).length, exceptions: 0, failed: 0, clean: 0 });
  LA.codeOf = (name) => { const e = empRec(name); return e ? e.id : ''; };

  /* ---------- audit ---------- */
  function audit(action, entity, change, reason, loc) {
    const n = new Date();
    DB.audit.unshift({ ts: `${pad(parse(TODAY).getDate())} ${MON[parse(TODAY).getMonth()]} ${pad(n.getHours())}:${pad(n.getMinutes())}`, user: meN(), action, entity, change: change || '—', reason: reason || '—', ip: '10.20.4.18', at: TODAY, loc: loc || (LA.loc() !== 'all' ? LA.loc() : myLoc()) });
    save();
  }
  LA.audit = audit;

  /* ---------- re-render without losing scroll or input focus ---------- */
  function rr() {
    const root = window.__laRoot;
    if (!root) return;
    const sy = window.scrollY;
    const ae = root.activeElement;
    const id = ae && ae.id;
    const sel = ae && typeof ae.selectionStart === 'number' ? [ae.selectionStart, ae.selectionEnd] : null;
    renderAll();
    window.scrollTo(0, sy);
    if (id) { const el = root.getElementById(id); if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch { /* not a text input */ } } }
    save();
  }
  LA.rr = rr;

  /* ---------- UI state (filters etc.) ---------- */
  LA.ui = (k, d) => (DB.ui[k] === undefined ? d : DB.ui[k]);
  LA.setUi = (k, v) => { DB.ui[k] = v; rr(); };
  LA.setUiRaw = (k, v) => { DB.ui[k] = v; };
  /* search box that keeps focus while the list re-renders; read the value with LA.ui(key, '') */
  let searchT = 0;
  LA.searchBox = (key, placeholder) => `<label class="lbar-s">${ic('search')}<input id="sb-${key}" value="${esc(LA.ui(key, ''))}" placeholder="${esc(placeholder || 'Search…')}" oninput="LA.searchInput('${key}',this)"></label>`;
  LA.searchInput = (key, el) => {
    const pos = el.selectionStart;
    LA.setUiRaw(key, el.value);
    clearTimeout(searchT);
    searchT = setTimeout(() => {
      rr();
      const n = window.__laRoot && window.__laRoot.getElementById('sb-' + key);
      if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* ignore */ } }
    }, 180);
  };
  /* filter chips: options [{v, l, n}] (n = optional count); the chosen value is LA.ui(key, def) */
  LA.chips = (key, options, def) => {
    const cur = LA.ui(key, def === undefined ? options[0].v : def);
    return `<span class="chips">${options.map((o) => `<span class="chip ${String(o.v) === String(cur) ? 'on' : ''}" onclick="LA.setUi('${key}','${esc(o.v)}')">${esc(o.l)}${o.n !== undefined ? ` <b>${o.n}</b>` : ''}</span>`).join('')}</span>`;
  };
  LA.resetUi = (keys) => { keys.forEach((k) => { delete DB.ui[k]; }); rr(); };

  /* ---------- location scope ---------- */
  LA.loc = () => { const v = LA.ui('loc', 'all'); return v === 'all' || locDef(v) ? v : 'all'; };
  LA.locIds = () => (LA.loc() === 'all' ? LOCS().map((l) => l.id) : [LA.loc()]);
  LA.inLoc = (name) => LA.loc() === 'all' || LA.locOf(name) === LA.loc();
  LA.hasLoc = (locs) => LA.loc() === 'all' || !locs || locs.includes('all') || locs.includes(LA.loc());
  LA.empIn = () => EMP.filter((e) => LA.loc() === 'all' || e.loc === LA.loc());
  LA.locLabel = () => (LA.loc() === 'all' ? 'All locations' : locName(LA.loc()));
  LA.locOptions = (all) => (all === false ? [] : [{ v: 'all', l: 'All locations' }]).concat(LOCS().map((l) => ({ v: l.id, l: `${l.name} (${l.city})` })));
  /* scoped location for pages that act on a single location (policy, ramadan …) */
  LA.oneLoc = (key) => { const sel = LA.ui(key, ''); if (sel && locDef(sel)) return sel; return LA.loc() !== 'all' ? LA.loc() : myLoc(); };

  /* ---------- filter widgets ---------- */
  const optHtml = (options, cur) => options.map((o) => { const v = typeof o === 'object' ? o.v : o; const l = typeof o === 'object' ? o.l : o; return `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
  LA.fSel = (key, label, options, def) => `<div class="fld"><label>${esc(label)}</label><select onchange="LA.setUi('${key}',this.value)">${optHtml(options, LA.ui(key, def === undefined ? (typeof options[0] === 'object' ? options[0].v : options[0]) : def))}</select></div>`;
  LA.fLoc = () => `<div class="fld"><label>Location</label><select onchange="LA.setUi('loc',this.value)">${optHtml(LA.locOptions(), LA.loc())}</select></div>`;
  LA.fDept = (key) => LA.fSel(key || 'dept', 'Department', ['All departments'].concat(LA.depts()), 'All departments');
  LA.fDate = (key, label, def, extra) => `<div class="fld"><label>${esc(label)}</label><input type="date" value="${esc(LA.ui(key, def || ''))}" ${extra || ''} onchange="LA.setUi('${key}',this.value)"></div>`;
  LA.fReset = (keys) => `<div class="fld"><label>&nbsp;</label><button class="btn" onclick="LA.resetUi(${JSON.stringify(keys).replace(/"/g, '&quot;')})">${ic('refresh')} Reset</button></div>`;
  LA.deptOk = (name, key) => { const v = LA.ui(key || 'dept', 'All departments'); if (v === 'All departments') return true; const e = empRec(name); return !!e && e.dept === v; };
  LA.dateOk = (d, fromKey, toKey) => { const f = LA.ui(fromKey, ''); const t = LA.ui(toKey, ''); return (!f || d >= f) && (!t || d <= t); };

  /* ---------- location bar (shown on organisation-wide screens) ---------- */
  const PERSONAL = ['home/my/overview', 'home/my/dashboard', 'home/my/calendar', 'leave/my/summary', 'leave/my/requests', 'leave/my/comp', 'attendance/my/summary', 'attendance/my/regularization'];
  LA.locBar = () => {
    const key = `${MODULE}/${SCOPE}/${TAB}`;
    if (MODULE === 'operations' && OPS === null) return '';
    if (MODULE === 'operations' && (OPS === 'roles' || OPS === 'integrations')) return '';
    if (PERSONAL.includes(key)) {
      const l = myLoc();
      return `<div class="locbar"><span class="lb-l">${ic('location')} Your location</span><b>${esc(locName(l))}</b><span class="chip">${esc(locCity(l))}</span><span class="chip on">${esc(LA.workLabel(l))}</span></div>`;
    }
    const cur = LA.loc();
    const info = cur === 'all' ? `${LOCS().length} location${LOCS().length === 1 ? '' : 's'} · ${EMP.length} employees` : `${esc(locCity(cur))} · ${esc(LA.workLabel(cur))} · ${EMP.filter((e) => e.loc === cur).length} employees`;
    return `<div class="locbar"><span class="lb-l">${ic('location')} Location</span><select onchange="LA.setUi('loc',this.value)">${optHtml(LA.locOptions(), cur)}</select><span class="chip ${cur === 'all' ? '' : 'on'}">${info}</span><a class="lb-link" onclick="LA.openApp('/admin/settings')">Manage locations ↗</a></div>`;
  };
  const baseRender = window.renderContent;
  window.renderContent = function () {
    syncBal();
    baseRender();
    const v = __$('view');
    if (v) v.insertAdjacentHTML('afterbegin', LA.locBar());
  };
  LA.openApp = (path) => window.dispatchEvent(new CustomEvent('la:navigate', { detail: path }));

  /* ---------- files + CSV ---------- */
  LA.pickFile = (accept, cb) => {
    const i = document.createElement('input');
    i.type = 'file';
    if (accept) i.accept = accept;
    i.onchange = () => { const f = i.files && i.files[0]; if (f) cb({ name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) }); };
    i.click();
  };
  const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  LA.csv = (name, head, rows) => {
    const body = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(`${name} downloaded (${rows.length} rows)`);
  };
  LA.kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  /* ---------- form engine ---------- */
  let FORM = null;
  const fieldHtml = (f, v) => {
    const val = v === undefined ? (f.value === undefined ? '' : f.value) : v;
    const id = 'f_' + f.k;
    const req = f.req ? ' <span class="req">*</span>' : '';
    let input;
    if (f.type === 'select') input = `<select id="${id}" onchange="LA.live()">${(f.options || []).map((o) => { const ov = typeof o === 'object' ? o.v : o; const ol = typeof o === 'object' ? o.l : o; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea id="${id}" placeholder="${esc(f.ph || '')}" oninput="LA.live()">${esc(val)}</textarea>`;
    else if (f.type === 'file') input = `<div class="upload" id="up_${f.k}" onclick="LA.formPick('${f.k}')">${ic('file')} <span id="upl_${f.k}">${esc(f.ph || 'Click to attach a PDF or image')}</span></div>`;
    else input = `<input id="${id}" type="${f.type || 'text'}" value="${esc(val)}" ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.readonly ? 'readonly' : ''} placeholder="${esc(f.ph || '')}" oninput="LA.live()" onchange="LA.live()">`;
    return `<div class="field" style="${f.full ? 'grid-column:1/-1' : ''}"><label>${esc(f.label)}${req}${f.sub ? ` <span class="muted">${esc(f.sub)}</span>` : ''}</label>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
  };
  LA.form = (o) => {
    FORM = { ...o, files: {} };
    const body = `${o.pre || ''}<div class="form-row two">${o.fields.map((f) => fieldHtml(f)).join('')}</div><div id="formLive">${o.live ? o.live(readForm()) : ''}</div><div id="formErr"></div>${o.post || ''}`;
    openModal(modalShell(o.title, body, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn ${o.danger ? 'danger' : 'pri'}" id="formSubmit" onclick="LA.submit()">${esc(o.submit || 'Submit')}</button>`, o.size || ''));
    if (o.live) LA.live();
  };
  function readForm() {
    const v = {};
    if (!FORM) return v;
    FORM.fields.forEach((f) => {
      if (f.type === 'file') { v[f.k] = FORM.files[f.k] || null; return; }
      const el = __$('f_' + f.k);
      v[f.k] = el ? (f.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim ? el.value.trim() : el.value) : '';
    });
    return v;
  }
  LA.live = () => { if (!FORM || !FORM.live) return; const el = __$('formLive'); if (el) el.innerHTML = FORM.live(readForm()); if (FORM.onChange) FORM.onChange(readForm()); };
  LA.formPick = (k) => {
    const f = FORM.fields.find((x) => x.k === k);
    LA.pickFile(f.accept || 'application/pdf,image/*', (file) => {
      if (file.size > 10 * 1048576) { showErr(['File is larger than 10 MB.']); return; }
      FORM.files[k] = file;
      const l = __$('upl_' + k);
      if (l) l.textContent = `${file.name} · ${LA.kb(file.size)}`;
      LA.live();
    });
  };
  function showErr(list) {
    const el = __$('formErr');
    if (el) el.innerHTML = list.length ? `<div class="note warn" style="margin-top:12px">${ic('alert')}<div>${list.map(esc).join('<br>')}</div></div>` : '';
    const body = el && el.closest('.modal-b');
    if (body && list.length) body.scrollTop = body.scrollHeight;
  }
  LA.submit = () => {
    if (!FORM) return;
    const v = readForm();
    const errs = [];
    FORM.fields.forEach((f) => { if (f.req && f.type !== 'file' && (v[f.k] === '' || v[f.k] == null)) errs.push(`${f.label} is required.`); if (f.req && f.type === 'file' && !v[f.k]) errs.push(`${f.label} is required.`); });
    if (!errs.length && FORM.validate) errs.push(...(FORM.validate(v) || []));
    if (errs.length) { showErr(errs); return; }
    const keep = FORM.onSubmit(v);
    if (keep === false) return;
    closeModal();
    FORM = null;
  };

  /* ---------- confirm + detail helpers ---------- */
  let CF = null;
  LA.confirm = (title, msg, label, fn, danger) => {
    CF = fn;
    openModal(modalShell(title, `<p style="font-size:13.5px;line-height:1.55">${msg}</p>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn ${danger ? 'danger' : 'pri'}" onclick="LA.doConfirm()">${esc(label)}</button>`, 'sm'));
  };
  LA.doConfirm = () => { const f = CF; CF = null; closeModal(); if (f) f(); };
  LA.detail = (title, rows, footer, size) => {
    openModal(modalShell(title, `<div class="dl">${rows.map((r) => `<dt>${esc(r[0])}</dt><dd>${r[2] ? r[1] : esc(r[1])}</dd>`).join('')}</div>`, footer === undefined ? `<button class="btn" onclick="closeModal()">Close</button>` : footer, size || 'sm'));
  };

  /* ---------- shared UI snippets ---------- */
  LA.empty = (msg) => `<div class="empty"><div class="ei">${ic('inbox')}</div>${esc(msg || 'Nothing to show')}</div>`;
  LA.matches = (q, ...vals) => !q || vals.some((v) => String(v == null ? '' : v).toLowerCase().includes(q.toLowerCase()));
  LA.statusPill = (st) => ({ Approved: bdg('s-g', 'Approved'), Pending: bdg('s-a', 'Pending'), Rejected: bdg('s-r', 'Rejected'), Withdrawn: bdg('s-gray', 'Withdrawn'), Cancelled: bdg('s-gray', 'Cancelled') }[st] || bdg('s-gray', esc(st)));
  LA.locChip = (id) => `<span class="chip" style="font-size:11px" title="Show only ${esc(locName(id))}" onclick="event.stopPropagation();LA.setUi('loc','${id}')">${esc(locCity(id))}</span>`;
  LA.empCell = (name, sub) => personCell(name, sub === undefined ? `${LA.codeOf(name)} · ${locCity(LA.locOf(name))}` : sub);

  /* ---------- derived counters (respect the location filter) ---------- */
  const inScope = (n) => LA.inLoc(n);
  /* What the signed-in persona may see: HR and Super Admin see everyone in scope, anyone who manages people sees
     themselves and their direct reports, everyone else sees only themselves. The bell, the Approvals badge and the
     Approvals inbox all use the same rule. */
  const scopeSet = () => { const set = new Set(EMP.filter((e) => e.mgr === DB.me.id).map((e) => e.n)); set.add(meN()); return set; };
  const seesAll = () => PERSONA === 'hr' || PERSONA === 'admin';
  const vis = (n) => inScope(n) && (seesAll() || scopeSet().has(n));
  LA.pendingApprovals = () => (LA.inbox ? LA.inbox() : []).filter((it) => inScope(it.emp)).length;
  LA.notifications = () => {
    const l = [];
    const me = meN();
    const opsGo = (k) => (PERSONAS[PERSONA].modules.includes('operations') ? ['operations', k] : ['attendance', 'my', 'summary']);
    const ap = LA.pendingApprovals();
    const un = DB.exceptions.filter((e) => e.st === 'Open' && e.group === 'unauth' && vis(e.emp)).length;
    const ex = DB.exceptions.filter((e) => e.st === 'Open' && vis(e.emp)).length;
    const med = seesAll() ? DB.med.filter((m) => m.st === 'Pending' && inScope(m.emp)).length : 0;
    const cf = seesAll() ? DB.cf.filter((c) => c.st === 'Pending' && inScope(c.emp)).length : 0;
    const cs = seesAll() ? DB.cases.filter((c) => c.st === 'Pending' && inScope(c.emp)).length : 0;
    const own = DB.leaves.filter((x) => x.emp === me && x.st === 'Pending').length + DB.regs.filter((x) => x.emp === me && x.st === 'Pending').length + DB.ots.filter((x) => x.emp === me && x.st === 'Pending').length;
    const decided = DB.leaves.filter((x) => x.emp === me && (x.st === 'Approved' || x.st === 'Rejected') && x.decidedOn && daysBetween(x.decidedOn, TODAY) <= 7);
    if (un) l.push({ ic: 'alert', t: `${un} unauthorized absence${un > 1 ? 's' : ''}`, s: 'Create LOP + disciplinary case', c: 'r', go: opsGo('exceptions') });
    if (ap) l.push({ ic: 'inbox', t: `${ap} approval${ap > 1 ? 's' : ''} pending`, s: 'Leave, regularization & overtime', c: 'a', go: ['home', 'team', 'approvals'] });
    if (own) l.push({ ic: 'clock', t: `${own} of your request${own > 1 ? 's' : ''} awaiting a decision`, s: 'Leave, regularization & overtime', c: 'b', go: ['leave', 'my', 'requests'] });
    decided.forEach((x) => l.push({ ic: x.st === 'Approved' ? 'check' : 'x', t: `Your ${x.type} (${x.id}) was ${x.st.toLowerCase()}`, s: `${fmt(x.from)} → ${fmt(x.to)}`, c: x.st === 'Approved' ? 'g' : 'r', go: ['leave', 'my', 'requests'] }));
    if (ex) l.push({ ic: 'clock', t: `${ex} open attendance exception${ex > 1 ? 's' : ''}`, s: 'Missing punches & invalid records', c: 'a', go: opsGo('exceptions') });
    if (med) l.push({ ic: 'doc', t: `${med} medical certificate${med > 1 ? 's' : ''} awaiting verification`, s: 'Sick leave', c: 'b', go: ['operations', 'docverify'] });
    if (cf) l.push({ ic: 'wallet', t: `${cf} carry-forward request${cf > 1 ? 's' : ''} pending`, s: 'Expires within 90 days', c: 'a', go: ['operations', 'carryforward'] });
    if (cs) l.push({ ic: 'shield', t: `${cs} disciplinary case${cs > 1 ? 's' : ''} awaiting HR decision`, s: 'Recommendations only', c: 'r', go: ['operations', 'discipline'] });
    return l;
  };
  const notifSig = () => LA.loc() + '|' + LA.notifications().map((n) => n.t).join('|');
  LA.alertCount = () => (DB.notifSeen === notifSig() ? 0 : LA.notifications().length);

  /* ---------- chrome state: live approvals badge + alerts ---------- */
  const baseChrome = window.__chromeState;
  window.__chromeState = function () {
    const s = baseChrome();
    s.tabs = s.tabs.map((t) => (t.k === 'approvals' ? { ...t, badge: String(LA.pendingApprovals() || '') } : t));
    s.alerts = LA.alertCount();
    return s;
  };

  /* ---------- notifications drawer ---------- */
  window.openNotifications = function () {
    const items = LA.notifications();
    openModal(modalShell('Notifications', (LA.loc() !== 'all' ? `<div class="hint" style="margin-bottom:8px">Showing ${esc(LA.locLabel())}</div>` : '') + (items.length
      ? items.map((n, i) => `<div class="lrow" style="cursor:pointer" onclick="LA.notifGo(${i})"><div class="li-ic" style="background:var(--${n.c}-bg);color:var(--${n.c})">${ic(n.ic)}</div><div><div class="li-t">${esc(n.t)}</div><div class="li-s">${esc(n.s)}</div></div><div class="li-r" style="color:var(--faint)">${ic('chevR')}</div></div>`).join('')
      : LA.empty('You’re all caught up')),
    `<button class="btn ghost" onclick="LA.markRead()">Mark all read</button><button class="btn" onclick="closeModal()">Close</button>`, 'sm'));
  };
  LA.notifGo = (i) => { const n = LA.notifications()[i]; if (!n) return; closeModal(); if (n.go[0] === 'operations') { MODULE = 'operations'; SCOPE = null; TAB = null; OPS = n.go[1]; renderAll(); } else navModule(n.go[0], n.go[1], n.go[2]); };
  LA.markRead = () => { DB.notifSeen = notifSig(); closeModal(); toast('All notifications marked as read'); rr(); };

  /* ---------- boot ---------- */
  const baseInit = window.laInit;
  window.laInit = function (root, path) {
    window.__laRoot = root;
    load();
    calState.y = parse(TODAY).getFullYear();
    calState.m = parse(TODAY).getMonth();
    baseInit(root, path);
    writeLedger();
  };
})();
