/* Leave & Attendance — ACTIVE LAYER · leave
   Apply (live validation) → pending → approve/reject/withdraw/cancel/extend with balances that really move,
   overtime & comp-off, annual-leave plan, team leave calendar and holidays. */
(function () {
  const L = window.LA;
  const { TODAY, fmt, fmtS, addD, parse, dow, pad, esc, daysBetween, isWeekend, range, DOWL, hm } = L;
  const db = () => L.db();
  const me = () => L.me();
  const R1 = (n) => Math.round(n * 10) / 10;

  /* ---------- types + balances ---------- */
  const BAL_KEY = { Compassionate: 'Compassionate Leave', Study: 'Study Leave' };
  const balKey = (t) => BAL_KEY[t] || t;
  const EXTRA_TYPES = ['Compensatory Off', 'Work From Home'];
  const CAPS = { Maternity: 60, Parental: 5, Hajj: 30, Compassionate: 5, 'Compassionate Leave': 5, 'Restricted Festive': 1, 'Maternity Leave': 182, 'Paternity Leave': 5, 'Marriage Leave': 5, 'Bereavement Leave': 3 };
  const DOCS = { Maternity: 'Medical certificate', Parental: 'Birth certificate', Compassionate: 'Bereavement evidence', 'Compassionate Leave': 'Bereavement evidence', Hajj: 'Hajj approval & evidence', Study: 'Exam evidence', 'Study Leave': 'Exam evidence', 'Maternity Leave': 'Medical certificate', 'Paternity Leave': 'Birth certificate', 'Marriage Leave': 'Wedding invitation', 'Bereavement Leave': 'Bereavement evidence' };
  const myTpl = () => L.tplOf(L.myLoc());
  const typeNames = () => db().ltypes.filter((t) => t.active && (t.tpl === 'all' || t.tpl === myTpl())).map((t) => t.t).concat(EXTRA_TYPES);
  const holOn = (d, loc) => db().hol.find((h) => d >= h.d && d <= (h.to || h.d) && (!h.locs || h.locs.includes('all') || h.locs.includes(loc || L.myLoc())));
  const bal = (t) => db().bal[balKey(t)];
  const ensureBal = () => {
    const b = db().bal;
    b['Weekly Off'] ??= { avail: 0, booked: 0, pending: 0, cap: null, note: 'Weekly off days', card: 'Weekly Off', ic: 'sun', bg: '#fce9e7', fg: '#d5493f' };
  };
  const availOf = (b) => (b.avail == null ? null : R1(b.avail - (b.pending || 0)));
  L.availOf = availOf;
  L.balOf = bal;
  const BALANCE_MANAGED = (t) => { const b = bal(t); return !!b && b.avail != null && t !== 'Unpaid Leave'; };

  /* ---------- calendar rules: count working days of the employee's location (weekly off + holidays are not leave days) ---------- */
  const holFor = (d, loc) => db().hol.find((h) => d >= h.d && d <= (h.to || h.d) && (!h.locs || h.locs.includes('all') || h.locs.includes(loc)));
  const isWorkDay = (d, loc) => !L.isOff(d, loc) && !holFor(d, loc);
  L.workDays = (from, to, loc) => {
    const out = { days: 0, cal: 0, off: 0, hol: 0 };
    if (!from || !to || to < from) return out;
    const l = loc || L.myLoc();
    for (let d = from; d <= to; d = addD(d, 1)) { out.cal++; if (L.isOff(d, l)) out.off++; else if (holFor(d, l)) out.hol++; else out.days++; }
    return out;
  };
  /* the app's four leave types, whatever the location template calls them */
  const APP = { 'Annual Leave': 'Annual', 'Earned Leave': 'Annual', 'Sick Leave': 'Sick', 'Casual Leave': 'Casual', 'Unpaid Leave': 'Unpaid', 'Loss of Pay': 'Unpaid' };
  const appOf = (t) => APP[t] || '';
  L.appOf = appOf;
  const unpaidName = () => (myTpl() === 'india' ? 'Loss of Pay' : 'Unpaid Leave');
  const routeText = () => { const a = L.approverOf(db().me.id); return a ? `${a.name} (${a.via.toLowerCase()})` : ''; };

  /* ---------- validation engine ---------- */
  const ownActive = (excludeId) => db().leaves.filter((l) => l.emp === me() && (l.st === 'Pending' || l.st === 'Approved') && l.id !== excludeId);
  L.leaveCheck = (v, opts = {}) => {
    const checks = [];
    const errors = [];
    const type = v.type;
    const wd = v.from && v.to && v.to >= v.from ? L.workDays(v.from, v.to) : { days: 0, cal: 0, off: 0, hol: 0 };
    const days = wd.days; // working days of the employee's location
    const cal = wd.cal;
    if (!type) return { checks, errors, days };
    checks.push(['Eligibility & probation', 'ok', 'Probation completed']);
    if (v.from && v.to) {
      if (v.to < v.from) { checks.push(['Dates', 'bad', 'To date is before From date']); errors.push('To date cannot be before From date.'); } else if (!days) { checks.push(['Working-day calculation', 'bad', `${cal} calendar day${cal > 1 ? 's' : ''}, none is a working day (${wd.off} weekly off, ${wd.hol} holiday)`]); errors.push('The selected dates contain no working days (weekly off or public holiday).'); } else checks.push(['Working-day calculation', 'ok', `${days} working day${days > 1 ? 's' : ''} of ${cal} calendar · ${wd.off} weekly off · ${wd.hol} holiday · ${L.workLabel(L.myLoc()).split(' · ')[0]}`]);
      if (v.from < addD(TODAY, -30)) { checks.push(['Back-dating', 'bad', 'Older than 30 days']); errors.push('Leave cannot be applied more than 30 days after the fact.'); } else if (v.from < TODAY && type !== 'Sick Leave') checks.push(['Back-dating', 'warn', 'Start date is in the past — manager discretion']);
      const clash = ownActive(opts.exclude).find((l) => !(v.to < l.from || v.from > l.to));
      if (clash) { checks.push(['Overlap', 'bad', `Overlaps ${clash.id} (${fmt(clash.from)} → ${fmt(clash.to)})`]); errors.push(`These dates overlap ${clash.id}.`); } else checks.push(['Overlap check', 'ok', 'No clash with your other leave']);
    }
    const b = bal(type);
    if (days && b && BALANCE_MANAGED(type)) {
      const a = availOf(b);
      if (days > a && v.ex === 'unpaid') checks.push(['Available balance', 'warn', `${a} available — ${R1(days - Math.max(0, a))} day(s) will be recorded as ${unpaidName()}`]);
      else if (days > a) { checks.push(['Available balance', 'bad', `${a} available — ${days} working day(s) requested`]); errors.push(`Insufficient balance: ${a} day(s) available, ${days} working day(s) requested. Choose "Convert the excess to unpaid leave" to continue.`); } else checks.push(['Available balance', 'ok', `${a} → ${R1(a - days)} after this request`]);
    } else if (b && b.avail === null && type !== 'Work From Home') checks.push(['Balance', 'ok', 'Unpaid — no balance deducted']);
    if (days && CAPS[type] && days > CAPS[type]) { checks.push(['Maximum entitlement', 'bad', `Max ${CAPS[type]} day(s) per event`]); errors.push(`${type} allows a maximum of ${CAPS[type]} day(s).`); }
    if (days && type === 'Restricted Festive' && days !== 1) errors.push('Restricted festive holiday is exactly 1 day.');
    if (type === 'Earned Leave' && v.from && !opts.extension) {
      const notice = daysBetween(TODAY, v.from);
      checks.push(['Application notice', notice >= 7 ? 'ok' : 'warn', notice >= 7 ? `${notice} days notice` : `${Math.max(0, notice)} days notice — 7 days expected`]);
    }
    if (type === 'Annual Leave' && v.from && !opts.extension) {
      const notice = daysBetween(TODAY, v.from);
      checks.push(['Application notice', notice >= 30 ? 'ok' : 'warn', notice >= 30 ? `${notice} days notice` : `${Math.max(0, notice)} days notice — 30–45 days expected`]);
      const yr = v.from.slice(0, 4);
      const segs = ownActive(opts.exclude).filter((l) => l.type === 'Annual Leave' && l.from.slice(0, 4) === yr).length + 1;
      checks.push(['Segment count (max 3)', segs > 3 ? 'bad' : 'ok', `Segment ${segs} of 3`]);
      if (segs > 3) errors.push('Annual leave allows a maximum of 3 segments per year.');
      if (cal && cal < 7) checks.push(['Segment length', 'warn', 'Segments are normally ≥ 7 calendar days']);
    }
    if (type === 'Sick Leave' && days) {
      const india = myTpl() === 'india';
      const need = india ? days > 2 : days >= 2 || (v.from && dow(v.from) === 1);
      checks.push(['Medical certificate', need ? (v.file ? 'ok' : 'bad') : 'ok', need ? (v.file ? 'Attached' : india ? 'Required (more than 2 days)' : 'Required (≥ 2 days or Monday)') : india ? 'Not required for up to 2 days' : 'Not required for a single day']);
      if (need && !v.file) errors.push(india ? 'A medical certificate is required for sick leave above 2 days.' : 'A medical certificate is required for 2 or more days, or a Monday absence.');
    } else if (DOCS[type] && days) {
      checks.push([DOCS[type], v.file ? 'ok' : 'bad', v.file ? 'Attached' : 'Mandatory']);
      if (!v.file) errors.push(`${DOCS[type]} is required for ${type}.`);
    }
    if (days && !opts.extension) { const r = routeText(); checks.push(['Approval routing', 'ok', r ? 'Sent to ' + r : 'No reporting manager — sent to the HR queue']); }
    return { checks, errors, days };
  };
  const checklist = (c) => c.checks.map((r) => `<div class="lrow" style="padding:9px 0"><div class="li-ic" style="width:26px;height:26px;background:var(--${r[1] === 'ok' ? 'g' : r[1] === 'warn' ? 'a' : 'r'}-bg);color:var(--${r[1] === 'ok' ? 'g' : r[1] === 'warn' ? 'a' : 'r'})">${ic(r[1] === 'ok' ? 'check' : r[1] === 'warn' ? 'alert' : 'x')}</div><div><div class="li-t" style="font-size:12.5px">${esc(r[0])}</div><div class="li-s">${esc(r[2])}</div></div></div>`).join('');

  /* ---------- apply / create ---------- */
  function mkRec(v, type, from, to, days, extra) {
    const a = L.approverOf(db().me.id);
    const id = 'LV-' + (++L.ledger().seq);
    return { id, emp: me(), code: db().me.id, type, app: appOf(type), from, to, days, st: 'Pending', stage: 'Reporting Manager', applied: TODAY, reason: v.reason, doc: v.file ? v.file.name : '', cls: v.cls || 'Personal', approver: a ? a.code : '', approverName: a ? a.name : 'HR queue', approverVia: a ? a.via : 'HR', ...extra };
  }
  /* returns the records created: one, or two when the excess over the balance is converted to unpaid leave */
  function createLeave(v, extra = {}) {
    const wd = L.workDays(v.from, v.to);
    const b = bal(v.type);
    const out = [];
    if (v.ex === 'unpaid' && b && BALANCE_MANAGED(v.type) && wd.days > availOf(b)) {
      const paid = Math.max(0, Math.floor(availOf(b)));
      if (paid <= 0) out.push(mkRec(v, unpaidName(), v.from, v.to, wd.days, extra));
      else {
        let n = 0; let cut = v.from;
        for (let d = v.from; d <= v.to; d = addD(d, 1)) { if (isWorkDay(d, L.myLoc())) n++; cut = d; if (n >= paid) break; }
        const first = mkRec(v, v.type, v.from, cut, paid, extra);
        out.push(first, mkRec(v, unpaidName(), addD(cut, 1), v.to, wd.days - paid, { ...extra, linked: first.id }));
      }
    } else out.push(mkRec(v, v.type, v.from, v.to, wd.days, extra));
    out.forEach((lv) => {
      db().leaves.unshift(lv);
      const lb = !lv.app ? bal(lv.type) : null; // mapped types are derived from the shared ledger; the rest keep their own counters
      if (lb && BALANCE_MANAGED(lv.type)) lb.pending = R1((lb.pending || 0) + lv.days);
      L.audit('Leave applied', lv.id, '— → Pending', `${lv.type} · ${lv.days}d · to ${lv.approverName}`);
    });
    L.syncBal();
    return out;
  }
  const sentTo = (out) => `${out.map((x) => x.id).join(' + ')} submitted — sent to ${out[0].approverName} (${String(out[0].approverVia).toLowerCase()})`;
  L.applyLeave = (preset = {}) => L.form({
    title: 'Apply for leave', size: 'lg', submit: 'Submit application',
    fields: [
      { k: 'type', label: 'Leave type', req: true, type: 'select', options: typeNames(), value: preset.type || L.annualKey() },
      { k: 'cls', label: 'Classification', type: 'select', options: ['Personal', 'Official'] },
      { k: 'from', label: 'From date', req: true, type: 'date', value: preset.from || '' },
      { k: 'to', label: 'To date', req: true, type: 'date', value: preset.to || '', hint: 'To Date = day before reporting back to work' },
      { k: 'ex', label: 'If the balance is not enough', type: 'select', options: [{ v: 'block', l: 'Do not submit' }, { v: 'unpaid', l: 'Convert the excess to unpaid leave' }], full: true },
      { k: 'reason', label: 'Reason', req: true, type: 'textarea', full: true, ph: 'Provide a reason for the leave request' },
      { k: 'file', label: 'Supporting document', type: 'file', full: true, ph: 'Attach certificate / evidence (PDF or image)' },
    ],
    live: (v) => `<div style="border-top:1px solid var(--line-2);margin-top:14px;padding-top:6px"><div class="pc-lbl" style="margin:8px 0 2px">Live validation · FRS §17</div>${checklist(L.leaveCheck(v))}</div>`,
    validate: (v) => L.leaveCheck(v).errors,
    onSubmit: (v) => { const out = createLeave(v); toast(sentTo(out)); L.rr(); },
  });
  window.openApplyLeave = () => L.applyLeave();
  window.openLeaveQuick = (type) => L.applyLeave({ type: type === 'Restricted Festive Holiday' ? 'Restricted Festive' : type });

  /* ---------- decisions (used by approvals + my requests) ---------- */
  L.leaveSettle = (lv, outcome, reason) => {
    if ((outcome === 'Approved' || outcome === 'Rejected') && lv.emp === me()) { toast('You cannot approve or reject your own request'); return false; }
    const b = !lv.app && lv.emp === me() ? bal(lv.type) : null; // mapped types are derived from the ledger; others keep a counter for the signed-in user
    const managed = b && BALANCE_MANAGED(lv.type);
    if (managed) b.pending = R1(Math.max(0, (b.pending || 0) - lv.days));
    if (outcome === 'Approved') {
      if (managed) { b.avail = R1(b.avail - lv.days); b.booked = R1((b.booked || 0) + lv.days); } else if (b) b.booked = R1((b.booked || 0) + lv.days);
      lv.stage = 'Completed';
    } else lv.stage = outcome === 'Rejected' ? 'Reporting Manager' : 'Employee';
    lv.st = outcome;
    lv.decision = reason || '';
    if (outcome === 'Approved' || outcome === 'Rejected') { lv.decidedBy = db().me.id; lv.decidedOn = TODAY; }
    L.syncBal();
    L.audit(`Leave ${outcome.toLowerCase()}`, lv.id, `Pending → ${outcome}`, reason || '—');
    return true;
  };
  L.leaveWithdraw = (id) => L.confirm('Withdraw application', `Withdraw <b>${id}</b>? Any reserved balance is released.`, 'Withdraw', () => {
    const lv = db().leaves.find((x) => x.id === id);
    if (!lv || lv.st !== 'Pending') return;
    L.leaveSettle(lv, 'Withdrawn', 'Withdrawn by employee');
    toast(`${id} withdrawn`); L.rr();
  }, true);
  L.leaveCancel = (id) => {
    const lv = db().leaves.find((x) => x.id === id);
    if (!lv) return;
    if (lv.from <= TODAY) { toast('Leave already started — ask HR for a recall via Balance Adjustment'); return; }
    L.confirm('Cancel approved leave', `Cancel <b>${id}</b> (${fmt(lv.from)} → ${fmt(lv.to)})? ${lv.days} day(s) return to your balance.`, 'Cancel leave', () => {
      const b = !lv.app ? bal(lv.type) : null;
      if (b && BALANCE_MANAGED(lv.type)) { b.avail = R1(b.avail + lv.days); b.booked = R1(Math.max(0, (b.booked || 0) - lv.days)); } else if (b) b.booked = R1(Math.max(0, (b.booked || 0) - lv.days));
      lv.st = 'Cancelled'; lv.stage = 'Employee'; L.syncBal();
      L.audit('Leave cancelled', id, 'Approved → Cancelled', `${lv.days}d restored`);
      toast(`${id} cancelled — ${lv.days} day(s) restored`); L.rr();
    }, true);
  };
  L.leaveExtend = (id) => {
    const lv = db().leaves.find((x) => x.id === id);
    if (!lv) return;
    L.form({
      title: `Extend ${id}`, size: 'sm', submit: 'Request extension',
      pre: `<p class="muted" style="margin-bottom:12px">${esc(lv.type)} currently ${fmt(lv.from)} → ${fmt(lv.to)}. Failure to notify the manager immediately becomes unauthorized absence.</p>`,
      fields: [{ k: 'to', label: 'New end date', req: true, type: 'date', value: addD(lv.to, 1), min: addD(lv.to, 1), full: true }, { k: 'reason', label: 'Reason', req: true, type: 'textarea', full: true }],
      live: (v) => { const c = L.leaveCheck({ type: lv.type, from: addD(lv.to, 1), to: v.to }, { extension: true }); return `<div style="margin-top:10px">${checklist(c)}</div>`; },
      validate: (v) => (v.to <= lv.to ? ['New end date must be after the current end date.'] : L.leaveCheck({ type: lv.type, from: addD(lv.to, 1), to: v.to }, { extension: true }).errors.filter((e) => !/medical certificate|Evidence|certificate|required for/i.test(e))),
      onSubmit: (v) => { const n = createLeave({ type: lv.type, from: addD(lv.to, 1), to: v.to, reason: `Extension of ${id} — ${v.reason}` }, { extOf: id }); toast(`${n[0].id} (extension) submitted — sent to ${n[0].approverName}`); L.rr(); },
    });
  };
  L.leaveDetail = (id) => {
    const lv = db().leaves.find((x) => x.id === id);
    if (!lv) return;
    const flow = [['Employee', 'Submitted ' + fmt(lv.applied), 'done'], ['Reporting Manager', lv.st === 'Pending' ? 'Awaiting decision' : lv.st === 'Rejected' ? 'Rejected' : lv.st === 'Approved' ? 'Approved' : lv.st, lv.st === 'Pending' ? 'active' : lv.st === 'Rejected' ? 'bad' : 'done'], ['HR', lv.st === 'Approved' ? 'Confirmed' : '—', lv.st === 'Approved' ? 'done' : '']];
    openModal(modalShell(`${lv.type} · ${lv.id}`,
      `<div class="dl" style="margin-bottom:14px"><dt>Employee</dt><dd>${esc(lv.emp)}</dd><dt>Period</dt><dd>${fmt(lv.from)} → ${fmt(lv.to)} (${lv.days} day${lv.days > 1 ? 's' : ''})</dd><dt>Applied</dt><dd>${fmt(lv.applied)}</dd>${lv.approverName ? `<dt>Sent to</dt><dd>${esc(lv.approverName)} (${esc(String(lv.approverVia || '').toLowerCase())})</dd>` : ''}<dt>Reason</dt><dd>${esc(lv.reason)}</dd>${lv.doc ? `<dt>Document</dt><dd>${esc(lv.doc)}</dd>` : ''}${lv.decision ? `<dt>Decision note</dt><dd>${esc(lv.decision)}</dd>` : ''}<dt>Status</dt><dd>${L.statusPill(lv.st)}</dd></div>
       <div class="steps">${flow.map((s, i) => `<div class="step ${s[2] === 'bad' ? '' : s[2]}"><div class="sc" style="${s[2] === 'bad' ? 'background:var(--r);color:#fff' : ''}">${s[2] === 'done' ? ic('check') : s[2] === 'bad' ? ic('x') : i + 1}</div><div class="st">${s[0]}</div><div class="ss">${esc(s[1])}</div></div>`).join('')}</div>`,
      `<button class="btn" onclick="closeModal()">Close</button>`, 'sm'));
  };

  /* ---------- Leave summary ---------- */
  const cardKeys = () => Object.keys(db().bal);
  const CARD_ORDER = () => cardKeys().slice(0, 6);
  const OTHER = () => cardKeys().slice(6);
  const cardHtml = (k) => {
    const b = db().bal[k];
    const a = availOf(b);
    return `<div class="lv-card" style="cursor:pointer" onclick="LA.balDetail('${k}')"><div class="lv-t">${esc(b.card)}</div><div class="lv-ic" style="background:${b.bg};color:${b.fg}">${ic(b.ic)}</div><div class="lv-row"><span class="lk">Available</span><span class="lval" style="color:${a != null && a < 0 ? 'var(--r)' : a > 0 ? 'var(--g)' : 'inherit'}">${a == null ? '—' : a}</span></div><div class="lv-divider"></div><div class="lv-row"><span class="lk">Booked</span><span class="lval">${b.booked}</span></div>${b.pending ? `<div class="lv-row"><span class="lk">Pending</span><span class="lval" style="color:var(--a)">${b.pending}</span></div>` : ''}</div>`;
  };
  L.balDetail = (k) => {
    const b = db().bal[k];
    const hist = db().leaves.filter((l) => l.emp === me() && balKey(l.type) === k).slice(0, 6);
    const typeName = k === 'Compassionate Leave' ? 'Compassionate' : k === 'Study Leave' ? 'Study' : k;
    openModal(modalShell(b.card, `<div class="dl" style="margin-bottom:14px"><dt>Available</dt><dd><b>${availOf(b) == null ? '—' : availOf(b)}</b></dd><dt>Booked</dt><dd>${b.booked}</dd><dt>Pending</dt><dd>${b.pending || 0}</dd>${b.cap ? `<dt>Annual cap</dt><dd>${b.cap}</dd>` : ''}<dt>Rule</dt><dd>${esc(b.note)}</dd></div>
      <div class="pc-lbl" style="margin:8px 0 6px">Recent activity</div>${hist.length ? hist.map((l) => `<div class="lrow"><div class="li-t">${fmt(l.from)} → ${fmt(l.to)} · ${l.days}d</div><div class="li-s">${l.id}</div><div class="li-r">${L.statusPill(l.st)}</div></div>`).join('') : '<div class="muted" style="font-size:13px">No activity yet</div>'}`,
      `<button class="btn" onclick="closeModal()">Close</button><button class="btn pri" onclick="closeModal();LA.applyLeave({type:'${typeName.replace(/'/g, "\\'")}'})">${ic('plus')} Apply</button>`, 'sm'));
  };
  const lvYear = () => L.ui('lvYear', Number(TODAY.slice(0, 4)));
  function lvSummary() {
    ensureBal();
    const y = lvYear();
    const mine = db().leaves.filter((l) => l.emp === me());
    const booked = mine.filter((l) => l.st === 'Approved' && l.from.slice(0, 4) === String(y)).reduce((a, l) => a + l.days, 0);
    const upcoming = mine.filter((l) => (l.st === 'Approved' || l.st === 'Pending') && l.from.slice(0, 4) === String(y) && l.to >= (y === Number(TODAY.slice(0, 4)) ? TODAY : `${y}-01-01`)).map((l) => ({ d: l.from, end: l.to, n: `${l.type} · ${l.days}d`, t: l.st, kind: 'leave', id: l.id }));
    const hol = db().hol.filter((h) => h.d.slice(0, 4) === String(y) && (!h.locs || h.locs.includes('all') || h.locs.includes(L.myLoc())) && (y !== Number(TODAY.slice(0, 4)) || (h.to || h.d) >= TODAY)).map((h) => ({ d: h.d, end: h.to, n: h.n, t: h.type, kind: 'hol' }));
    const items = upcoming.concat(hol).sort((a, b) => (a.d < b.d ? -1 : 1));
    const plans = db().plans.filter((p) => p.emp === me());
    return `<div class="toolbar">
      <div><div class="fw6" style="font-size:14px">Leave booked this year: ${booked} day(s) <span class="muted">| Absent: ${L.todayAbsent ? L.todayAbsent() : 0}</span></div></div>
      <div class="daterange"><button class="dr-nav" onclick="LA.setUi('lvYear',${y - 1})">${ic('chevL')}</button><span class="dr-lbl">01-Jan-${y} – 31-Dec-${y}</span><button class="dr-nav" onclick="LA.setUi('lvYear',${y + 1})">${ic('chevR')}</button></div>
      <button class="btn pri" onclick="LA.applyLeave()">${ic('plus')} Apply Leave</button></div>
    <div class="lv-grid" style="margin-bottom:18px">${CARD_ORDER().map(cardHtml).join('')}</div>
    ${OTHER().length ? `<div class="pc-lbl" style="margin:0 0 8px">Other leave types</div><div class="lv-grid" style="margin-bottom:18px">${OTHER().map(cardHtml).join('')}</div>` : ''}
    ${card('Upcoming Leaves & Holidays', items.length ? items.map((h) => `<div class="lrow" ${h.id ? `style="cursor:pointer" onclick="LA.leaveDetail('${h.id}')"` : ''}><div class="li-ic" style="background:var(--${h.kind === 'leave' ? 'b' : 'brand'}-bg, var(--brand-050));color:var(--${h.kind === 'leave' ? 'b' : 'brand'})">${ic('calendar')}</div><div><div class="li-t">${esc(h.n)}</div><div class="li-s">${fmt(h.d)}${h.end ? ' → ' + fmt(h.end) : ''}</div></div><div class="li-r">${h.kind === 'leave' ? L.statusPill(h.t) : bdg('s-p', h.t)}</div></div>`).join('') : L.empty('Nothing scheduled in ' + y))}
    <div style="height:16px"></div>
    ${card('Annual leave plan', tableOf(plans), { sub: 'Max 3 segments · ≥ 7 days · ≥ 3-month gap', actions: `<button class="btn sm pri" onclick="LA.planNew()">${ic('plus')} Propose segment</button>` })}
    <div style="height:16px"></div>
    ${note('warn', `Comp-off ratio/expiry and encashment formula are ${phFlag('HR confirmation pending')} (FRS §28) — set them in Operations → Policy Settings.`)}`;
  }
  const tableOf = (plans) => (plans.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Segment</th><th>Period</th><th class="num">Days</th><th>Status</th><th></th></tr></thead><tbody>${plans.map((p) => `<tr><td class="fw6">Segment ${p.seg}</td><td>${fmt(p.from)} → ${fmt(p.to)}</td><td class="num">${daysBetween(p.from, p.to) + 1}</td><td>${L.statusPill(p.st)}</td><td>${p.st === 'Pending' ? `<button class="btn sm ghost" onclick="LA.planWithdraw('${p.id}')">Withdraw</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : L.empty('No segments planned yet'));

  /* ---------- annual leave plan ---------- */
  L.planCheck = (v) => {
    const e = [];
    if (!v.from || !v.to) return e;
    if (v.to < v.from) return ['To date cannot be before From date.'];
    const days = daysBetween(v.from, v.to) + 1;
    if (days < 7) e.push('Each segment must be at least 7 calendar days.');
    const mine = db().plans.filter((p) => p.emp === me() && p.st !== 'Withdrawn' && p.st !== 'Rejected' && p.from.slice(0, 4) === v.from.slice(0, 4));
    if (mine.length >= 3) e.push('Maximum 3 segments per year already planned.');
    mine.forEach((p) => {
      if (!(v.to < p.from || v.from > p.to)) e.push(`Overlaps segment ${p.seg} (${fmt(p.from)} → ${fmt(p.to)}).`);
      else { const gap = v.from > p.to ? daysBetween(p.to, v.from) : daysBetween(v.to, p.from); if (gap < 90) e.push(`Needs a ≥ 3-month gap from segment ${p.seg} (only ${gap} days).`); }
    });
    return e;
  };
  L.planNew = () => L.form({
    title: 'Propose annual-leave segment', size: 'sm', submit: 'Propose segment',
    pre: note('info', 'Segment must be ≥ 7 calendar days with a ≥ 3-month gap. Submit 30–45 days ahead.'),
    fields: [{ k: 'from', label: 'From date', req: true, type: 'date', min: TODAY }, { k: 'to', label: 'To date', req: true, type: 'date', min: TODAY }, { k: 'note', label: 'Notes to manager', type: 'textarea', full: true }],
    validate: (v) => L.planCheck(v),
    onSubmit: (v) => {
      const seg = db().plans.filter((p) => p.emp === me() && p.from.slice(0, 4) === v.from.slice(0, 4) && p.st !== 'Withdrawn' && p.st !== 'Rejected').length + 1;
      const id = 'PL-' + L.nextId('PL').split('-')[1];
      db().plans.push({ id, emp: me(), seg, from: v.from, to: v.to, st: 'Pending', note: v.note });
      L.audit('Annual-leave segment proposed', id, '— → Pending', `${fmt(v.from)} → ${fmt(v.to)}`);
      toast(`Segment ${seg} proposed`); L.rr();
    },
  });
  window.openPlanModal = () => L.planNew();
  L.planWithdraw = (id) => { const p = db().plans.find((x) => x.id === id); if (!p) return; p.st = 'Withdrawn'; L.audit('Segment withdrawn', id, 'Pending → Withdrawn', ''); toast('Segment withdrawn'); L.rr(); };

  /* ---------- Leave requests (history) ---------- */
  function lvRequests() {
    const type = L.ui('lvType', 'All types');
    const st = L.ui('lvStatus', 'All statuses');
    const q = L.ui('lvQ', '');
    const rows = db().leaves.filter((l) => l.emp === me() && (type === 'All types' || l.type === type) && (st === 'All statuses' || l.st === st) && L.dateOk(l.from, 'lvFrom', 'lvTo') && L.matches(q, l.id, l.type, l.reason, l.from)).sort((a, b) => (a.from < b.from ? 1 : -1));
    const act = (l) => (l.st === 'Approved' && l.to >= TODAY ? `<button class="btn sm ghost" onclick="event.stopPropagation();LA.leaveExtend('${l.id}')">Extend</button><button class="btn sm ghost" onclick="event.stopPropagation();LA.leaveCancel('${l.id}')">Cancel</button>` : l.st === 'Pending' ? `<button class="btn sm ghost" onclick="event.stopPropagation();LA.leaveWithdraw('${l.id}')">Withdraw</button>` : '—');
    return pageHead('Leave History', 'All applications with extension, cancellation and withdrawal actions', `<button class="btn" onclick="LA.lvExport()">${ic('download')} Export</button><button class="btn pri" onclick="LA.applyLeave()">${ic('plus')} Apply Leave</button>`, 'Leave')
      + `<div class="filters"><div class="fld"><label>Type</label><select onchange="LA.setUi('lvType',this.value)"><option>All types</option>${typeNames().map((t) => `<option ${t === type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div class="fld"><label>Status</label><select onchange="LA.setUi('lvStatus',this.value)">${['All statuses', 'Pending', 'Approved', 'Rejected', 'Withdrawn', 'Cancelled'].map((s) => `<option ${s === st ? 'selected' : ''}>${s}</option>`).join('')}</select></div>${L.fDate('lvFrom', 'From')}${L.fDate('lvTo', 'To')}${L.searchBox('lvQ', 'Id, reason, date')}${L.fReset(['lvType', 'lvStatus', 'lvFrom', 'lvTo', 'lvQ'])}</div>`
      + tableCard('My leave applications', ['Ref', 'Type', 'Period', 'Days', 'Stage', 'Status', 'Actions'],
        rows.map((l) => `<tr style="cursor:pointer" onclick="LA.leaveDetail('${l.id}')"><td class="fw6 mono">${l.id}</td><td>${esc(l.type)}</td><td>${fmt(l.from)}${l.to !== l.from ? ' → ' + fmt(l.to) : ''}</td><td class="num">${l.days || '—'}</td><td class="muted">${esc(l.stage)}</td><td>${L.statusPill(l.st)}</td><td><div class="hb">${act(l)}</div></td></tr>`).join('') || `<tr><td colspan="7">${L.empty('No applications match')}</td></tr>`, { sub: `${rows.length} record(s)` })
      + '<div style="height:16px"></div>'
      + note('info', '<b>Recall</b> restores full or partial leave days and may create an approved reimbursement claim (HR → Balance Adjustment). <b>Extension</b> requires immediate notification and a revised application — failure to notify becomes unauthorized absence.');
  }
  L.lvExport = () => L.csv('my_leave_applications.csv', ['Ref', 'Type', 'From', 'To', 'Days', 'Stage', 'Status', 'Reason'], db().leaves.filter((l) => l.emp === me()).map((l) => [l.id, l.type, l.from, l.to, l.days, l.stage, l.st, l.reason]));

  /* ---------- overtime + comp-off ---------- */
  const compRatio = () => Number(L.confOf(L.myLoc()).compRatio) || 8;
  L.otCredit = (o) => R1(o.hours / compRatio());
  function lvComp() {
    const all = db().ots.filter((o) => o.emp === me());
    const stF = L.ui('otSt', 'All statuses');
    const catF = L.ui('otCat', 'All categories');
    const mine = all.filter((o) => (stF === 'All statuses' || o.st === stF) && (catF === 'All categories' || o.cat === catF) && L.dateOk(o.date, 'otFrom', 'otTo') && L.matches(L.ui('otQ0', ''), o.reason, o.comp, o.cat));
    const month = TODAY.slice(0, 7);
    const approvedHrs = all.filter((o) => o.st === 'Approved' && o.date.startsWith(month)).reduce((a, o) => a + o.hours, 0);
    const cb = db().bal['Compensatory Off'];
    return pageHead('Overtime & Comp-Off', 'Additional work requests and compensatory-off balance', `<button class="btn pri" onclick="LA.otNew()">${ic('plus')} Request overtime</button>`, 'More')
      + note('warn', `Overtime rounding increment, special-allowance amount and comp-off ratio/expiry are ${phFlag(L.confOf(L.myLoc()).compRatio ? 'Ratio set: ' + compRatio() + ' h = 1 day' : 'HR confirmation pending')} (FRS §28). Using ${compRatio()} h = 1 day until confirmed.`)
      + `<div style="height:16px"></div><div class="grid g-3" style="margin-bottom:16px">
        ${kpi({ icon: 'clock2', acc: 'g', val: R1(approvedHrs).toFixed(1), lbl: 'Approved OT hours (month)' })}
        ${kpi({ icon: 'gift', acc: 'p', val: availOf(cb), lbl: 'Comp-off available (days)' })}
        ${kpi({ icon: 'wallet', acc: 'b', val: all.filter((o) => o.st === 'Pending').length, lbl: 'Requests awaiting approval' })}</div>`
      + `<div class="filters">${L.fSel('otSt', 'Status', ['All statuses', 'Pending', 'Approved', 'Rejected', 'Withdrawn'], 'All statuses')}${L.fSel('otCat', 'Category', ['All categories', 'Normal (+25%)', 'Night 10PM–4AM (+50%)', 'Weekend / holiday'], 'All categories')}${L.fDate('otFrom', 'From')}${L.fDate('otTo', 'To')}${L.searchBox('otQ0', 'Reason, compensation')}${L.fReset(['otSt', 'otCat', 'otFrom', 'otTo', 'otQ0'])}</div>`
      + tableCard('Overtime & comp-off requests', ['Date', 'Type', 'Hours', 'Category', 'Compensation', 'Status', ''],
        mine.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((o) => `<tr><td>${fmt(o.date)}</td><td>${isWeekend(o.date) ? 'Weekend work' : 'Overtime'}</td><td class="num">${o.hours.toFixed(1)}</td><td>${esc(o.cat)}</td><td>${esc(o.comp)}</td><td>${L.statusPill(o.st)}</td><td>${o.st === 'Pending' ? `<button class="btn sm ghost" onclick="LA.otWithdraw('${o.id}')">Withdraw</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7">${L.empty('No overtime requests')}</td></tr>`);
  }
  L.otNew = () => L.form({
    title: 'Request overtime', size: 'sm', submit: 'Submit request',
    fields: [
      { k: 'date', label: 'Date', req: true, type: 'date', value: TODAY, max: TODAY, min: addD(TODAY, -14) },
      { k: 'hours', label: 'Hours', req: true, type: 'number', value: 2, step: '0.5', min: 0.5, max: 12 },
      { k: 'cat', label: 'Category', type: 'select', options: ['Normal (+25%)', 'Night 10PM–4AM (+50%)', 'Weekend / holiday'] },
      { k: 'comp', label: 'Preferred compensation', type: 'select', options: ['Overtime payment', 'Special allowance', 'Compensatory off', 'Alternative day off'] },
      { k: 'reason', label: 'Reason', req: true, type: 'textarea', full: true },
    ],
    post: note('warn', 'Overtime requires manager approval. Unapproved time is not payable.'),
    validate: (v) => {
      const e = [];
      if (!(v.hours >= 0.5 && v.hours <= 12)) e.push('Hours must be between 0.5 and 12.');
      if (v.date > TODAY) e.push('Overtime cannot be requested for a future date.');
      if (v.date < addD(TODAY, -14)) e.push('Overtime must be requested within 14 days.');
      if ((isWeekend(v.date) || holOn(v.date)) && v.cat !== 'Weekend / holiday') e.push('That date is a weekend/holiday — choose the "Weekend / holiday" category.');
      if (db().ots.some((o) => o.emp === me() && o.date === v.date && o.st !== 'Rejected' && o.st !== 'Withdrawn')) e.push('An overtime request already exists for this date.');
      return e;
    },
    onSubmit: (v) => {
      const id = 'OT-' + L.nextId('OT').split('-')[1];
      db().ots.push({ id, emp: me(), date: v.date, hours: Number(v.hours), cat: v.cat, comp: v.comp, reason: v.reason, st: 'Pending', by: '' });
      L.audit('Overtime requested', id, '— → Pending', `${v.hours} h · ${v.cat}`);
      toast(`${id} submitted for approval`); L.rr();
    },
  });
  window.openOtModal = () => L.otNew();
  L.otWithdraw = (id) => { const o = db().ots.find((x) => x.id === id); if (!o) return; o.st = 'Withdrawn'; L.audit('Overtime withdrawn', id, 'Pending → Withdrawn', ''); toast(id + ' withdrawn'); L.rr(); };
  L.otSettle = (o, outcome, reason) => {
    if ((outcome === 'Approved' || outcome === 'Rejected') && o.emp === me()) { toast('You cannot approve or reject your own request'); return false; }
    o.st = outcome; o.by = me(); o.decision = reason || '';
    if (outcome === 'Approved' && o.comp === 'Compensatory off' && o.emp === me()) {
      const b = db().bal['Compensatory Off']; const c = L.otCredit(o);
      b.avail = R1(b.avail + c);
    }
    L.audit(`Overtime ${outcome.toLowerCase()}`, o.id, `Pending → ${outcome}`, reason || '—');
  };

  /* ---------- team leave calendar ---------- */
  const SHORT = { 'Annual Leave': 'AL', 'Sick Leave': 'SL', 'Restricted Festive': 'RF', 'Unpaid Leave': 'UL', Compassionate: 'CL', 'Compassionate Leave': 'CL', 'Casual Leave': 'CL', 'Earned Leave': 'EL', 'Paternity Leave': 'PL', 'Marriage Leave': 'ML', 'Bereavement Leave': 'BL', 'Loss of Pay': 'LP' };
  const calOk = (l) => { const st = L.ui('tlSt', 'All'); return L.inLoc(l.emp) && L.deptOk(l.emp, 'tlDept') && (st === 'All' || l.st === st) && L.matches(L.ui('tlQ', ''), l.emp, l.type, l.id); };
  function leaveMap(y, m) {
    const map = {};
    db().leaves.filter((l) => (l.st === 'Approved' || l.st === 'Pending') && calOk(l)).forEach((l) => {
      const loc = L.locOf(l.emp);
      range(l.from, l.to).forEach((d) => { if (d.startsWith(`${y}-${pad(m + 1)}`) && !L.isOff(d, loc)) (map[d] ||= []).push(l); });
    });
    return map;
  }
  function lvTeam() {
    const { y, m } = calState;
    const map = leaveMap(y, m);
    const scopeLoc = L.loc() === 'all' ? L.myLoc() : L.loc();
    const conflicts = Object.entries(map).filter(([, ls]) => new Set(ls.map((l) => l.emp)).size >= 2).map(([d]) => d);
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const prev = new Date(y, m, 0).getDate();
    let cells = '';
    for (let i = 0; i < first; i++) cells += `<div class="cal-cell out"><div class="dnum">${prev - first + i + 1}</div></div>`;
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
      const ls = map[ds] || [];
      const hols = db().hol.filter((h) => ds >= h.d && ds <= (h.to || h.d) && L.hasLoc(h.locs));
      cells += `<div class="cal-cell ${L.isOff(ds, scopeLoc) ? 'wo' : ''} ${ds === TODAY ? 'today' : ''}" style="cursor:pointer" onclick="LA.leaveDay('${ds}')"><div class="dnum">${d}</div>${hols.map((h) => `<span class="cal-tag s-p">${esc(h.n)}${L.loc() === 'all' && h.locs && !h.locs.includes('all') && h.locs.length === 1 ? ' · ' + esc(L.locCity(h.locs[0])) : ''}</span>`).join('')}${ls.map((l) => `<span class="cal-tag ${l.st === 'Pending' ? 's-a' : 's-b'}">${esc(l.emp.split(' ')[0])} — ${SHORT[l.type] || l.type.slice(0, 2).toUpperCase()}</span>`).join('')}</div>`;
    }
    const total = first + days;
    for (let i = 1; i <= (7 - (total % 7)) % 7; i++) cells += `<div class="cal-cell out"><div class="dnum">${i}</div></div>`;
    return pageHead('Team Leave Calendar', 'Approved and pending leave with conflict detection', `<button class="btn" onclick="LA.teamLeaveExport()">${ic('download')} Export month</button>`, 'Leave')
      + `<div class="filters">${L.fLoc()}${L.fDept('tlDept')}${L.fSel('tlSt', 'Status', ['All', 'Approved', 'Pending'], 'All')}${L.searchBox('tlQ', 'Employee or leave type')}${L.fReset(['tlDept', 'tlSt', 'tlQ', 'loc'])}</div>`
      + (conflicts.length ? note('warn', `Overlap on <b>${conflicts.map((d) => fmtS(d)).join(', ')}</b>: 2 or more members on leave simultaneously. Verify coverage before approving.`) : note('info', 'No overlapping leave this month in this view.'))
      + '<div style="height:16px"></div>'
      + `<div class="cal"><div class="cal-h"><b>${MONTHS[m]} ${y}</b><div class="cal-nav"><button onclick="calMove(-1)">${ic('chevL')}</button><button onclick="calMove(1)">${ic('chevR')}</button></div></div><div class="cal-grid">${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>`
      + calLegend([{ c: 'var(--b)', l: 'Approved leave' }, { c: 'var(--a)', l: 'Pending' }, { c: 'var(--p)', l: 'Holiday' }, { c: 'var(--gray)', l: 'Weekly Off (' + L.locCity(scopeLoc) + ')' }]);
  }
  L.leaveDay = (ds) => {
    const ls = db().leaves.filter((l) => (l.st === 'Approved' || l.st === 'Pending') && ds >= l.from && ds <= l.to && calOk(l));
    openModal(modalShell(fmt(ds) + ' · ' + DOWL[dow(ds)], ls.length ? ls.map((l) => `<div class="lrow" style="cursor:pointer" onclick="LA.leaveDetail('${l.id}')">${personCell(l.emp, l.id)}<div class="li-r">${L.statusPill(l.st)}</div></div><div class="li-s" style="margin:-4px 0 8px 44px">${esc(l.type)} · ${fmt(l.from)} → ${fmt(l.to)}</div>`).join('') : L.empty('Nobody is on leave'), `<button class="btn" onclick="closeModal()">Close</button>`, 'sm'));
  };
  L.teamLeaveExport = () => { const { y, m } = calState; const map = leaveMap(y, m); L.csv(`team_leave_${y}-${pad(m + 1)}.csv`, ['Date', 'Employee', 'Type', 'Status', 'Ref'], Object.entries(map).sort().flatMap(([d, ls]) => ls.map((l) => [d, l.emp, l.type, l.st, l.id]))); };

  /* ---------- holidays ---------- */
  function lvHolidays() {
    const y = L.ui('holYear', Number(TODAY.slice(0, 4)));
    const tF = L.ui('holType', 'All types');
    const q = L.ui('holQ', '');
    const rows = db().hol.filter((h) => h.d.slice(0, 4) === String(y) && L.hasLoc(h.locs) && (tF === 'All types' || h.type === tF) && L.matches(q, h.n, h.type)).sort((a, b) => (a.d < b.d ? -1 : 1));
    const fb = db().bal['Restricted Festive'];
    const locNames = (h) => (!h.locs || h.locs.includes('all') ? 'All locations' : h.locs.map((i) => L.locCity(i)).join(', '));
    return pageHead('Holiday Calendar', 'Public holidays by location — each location observes its own calendar', `<div class="daterange"><button class="dr-nav" onclick="LA.setUi('holYear',${y - 1})">${ic('chevL')}</button><span class="dr-lbl">${y}</span><button class="dr-nav" onclick="LA.setUi('holYear',${y + 1})">${ic('chevR')}</button></div><button class="btn" onclick="LA.holExport()">${ic('download')} Export</button>`, 'More')
      + `<div class="filters">${L.fLoc()}${L.fSel('holType', 'Type', ['All types', 'Public', 'Optional', 'Company'], 'All types')}${L.searchBox('holQ', 'Holiday name')}${L.fReset(['holType', 'holQ', 'loc'])}</div>`
      + note('info', 'If unpaid leave is taken <b>immediately before and after</b> a public holiday, the holiday is converted to unpaid leave / loss of pay (FRS §16.1).')
      + '<div style="height:16px"></div><div class="row"><div style="flex:1.3">'
      + tableCard(`${y} holidays · ${esc(L.locLabel())}`, ['Date', 'Holiday', 'Type', 'Applies to', 'Days'], rows.map((h) => `<tr><td class="fw6">${fmt(h.d)}${h.to ? ' → ' + fmt(h.to) : ''}</td><td>${esc(h.n)}</td><td>${bdg('s-p', esc(h.type))}</td><td class="muted">${esc(locNames(h))}</td><td class="num">${h.to ? daysBetween(h.d, h.to) + 1 : 1}</td></tr>`).join('') || `<tr><td colspan="5">${L.empty('No holidays for this selection')}</td></tr>`)
      + '</div><div style="flex:1">'
      + (fb ? card('Restricted festive holiday', `<p class="muted" style="margin-bottom:12px">1 paid day per calendar year for your own national/religious holiday not covered by public holidays. Prior approval required.</p><div class="mini-stat"><span>Available</span><b>${availOf(fb)} of ${fb.cap}</b></div><div style="height:12px"></div><button class="btn" onclick="LA.applyLeave({type:'Restricted Festive'})" ${availOf(fb) < 1 ? 'disabled' : ''}>${ic('plus')} Request festive day</button>${availOf(fb) < 1 ? '<div class="hint" style="margin-top:8px">Already used or pending this year.</div>' : ''}`) : card('Your calendar', `<p class="muted">Holidays for <b>${esc(L.locName(L.myLoc()))}</b> apply to your attendance and leave. Work week: ${esc(L.workLabel(L.myLoc()))}.</p>`))
      + '</div></div>';
  }
  L.holExport = () => { const y = L.ui('holYear', Number(TODAY.slice(0, 4))); L.csv(`holidays_${y}.csv`, ['Date', 'To', 'Holiday', 'Type', 'Applies to'], db().hol.filter((h) => h.d.slice(0, 4) === String(y) && L.hasLoc(h.locs)).sort((a, b) => (a.d < b.d ? -1 : 1)).map((h) => [h.d, h.to, h.n, h.type, !h.locs || h.locs.includes('all') ? 'All locations' : h.locs.map((i) => L.locCity(i)).join('; ')])); };

  /* ---------- wire up ---------- */
  DISPATCH['leave/my/summary'] = lvSummary;
  DISPATCH['leave/my/requests'] = lvRequests;
  DISPATCH['leave/my/comp'] = lvComp;
  DISPATCH['leave/team/calendar'] = lvTeam;
  DISPATCH['leave/holidays/list'] = lvHolidays;
  VIEWS['leave-history'] = lvRequests;
  VIEWS['ot-compoff'] = lvComp;
  VIEWS['team-leave-cal'] = lvTeam;
  VIEWS.holidays = lvHolidays;
})();
