/* Leave & Attendance — ACTIVE LAYER · attendance engine + screens
   Live check-in/out, per-day records derived from punches / leave / holidays / regularization,
   week navigation, filters, day drawer, regularization + late/early/shift requests, team attendance. */
(function () {
  const L = window.LA;
  const { TODAY, fmt, fmtL, fmtS, addD, parse, dow, pad, hm, clock, clock12, esc, hash, isWeekend, range, DOWL, MON } = L;
  const db = () => L.db();
  const me = () => L.me();
  const SHIFT_MIN = 480;

  /* ---------- live punches (signed-in user, today) ---------- */
  const sessions = () => db().today.sessions;
  L.isIn = () => { const s = sessions(); return s.length > 0 && s[s.length - 1].out === null; };
  L.todayMinutes = () => sessions().reduce((m, s) => m + Math.max(0, ((s.out == null ? Date.now() : s.out) - s.in) / 60000), 0);
  const firstIn = () => (sessions()[0] ? sessions()[0].in : null);
  const minOfDay = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
  const t12 = (m) => (m == null ? '-' : `${pad(Math.floor(m / 60) % 12 || 12)}:${pad(m % 60)} ${m < 720 ? 'AM' : 'PM'}`);
  L.t12 = t12;
  const hhmmss = (sec) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(Math.floor(sec % 60))}`;
  L.hhmmss = hhmmss;

  L.punch = () => {
    const s = sessions();
    const now = Date.now();
    if (L.isIn()) {
      s[s.length - 1].out = now;
      toast('Checked out at ' + clock(now));
    } else {
      s.push({ in: now, out: null, channel: 'Web', ip: '10.20.4.18' });
      toast('Checked in at ' + clock(now));
    }
    L.audit('Attendance punch', me() + ' · ' + fmt(TODAY), '—', L.isIn() ? 'Check-in (web)' : 'Check-out (web)');
    L.rr();
  };

  /* ---------- per-day record for the signed-in user ---------- */
  const holidayOn = (d, loc) => db().hol.find((h) => d >= h.d && d <= (h.to || h.d) && (!h.locs || h.locs.includes('all') || h.locs.includes(loc || L.myLoc())));
  const shiftTimes = (loc) => { const w = L.work(loc); return { from: L.toMin(w.from), to: L.toMin(w.to), label: `${w.from}–${w.to}` }; };
  const shiftLabel = (loc) => { const t = shiftTimes(loc); return `General [ ${t12(t.from)} – ${t12(t.to)} ]`; };
  const leaveOn = (d, who) => db().leaves.find((l) => l.emp === (who || me()) && l.st === 'Approved' && d >= l.from && d <= l.to);
  const LEAVE_ST = { 'Restricted Festive': 'Restricted Festive Holiday' };
  const stKey = (t) => LEAVE_ST[t] || t;
  L.stKey = stKey;

  L.regFor = (d) => db().regs.find((r) => r.emp === me() && r.kind === 'Regularization' && r.date === d && r.st !== 'Withdrawn' && r.st !== 'Rejected') || db().regs.find((r) => r.emp === me() && r.kind === 'Regularization' && r.date === d && r.st !== 'Withdrawn');

  L.dayRec = (d) => {
    const base = { date: d, in: null, out: null, total: null, pay: null, dev: null, st: '', stc: '', shift: 'General', kind: '' };
    if (d > TODAY) return base;
    if (isWeekend(d)) return { ...base, st: 'Weekend', stc: 'a', kind: 'weekend' };
    const h = holidayOn(d);
    if (h) return { ...base, st: 'Public Holiday', stc: 'p', kind: 'holiday', note: h.n };
    const lv = leaveOn(d);
    if (lv) return { ...base, st: lv.type, stc: 'b', kind: 'leave', note: lv.id };
    let inM; let outM; let live = false;
    if (d === TODAY) {
      if (!sessions().length) return { ...base, st: 'Absent', stc: 'r', kind: 'absent' };
      inM = minOfDay(firstIn());
      const last = sessions()[sessions().length - 1];
      outM = last.out == null ? null : minOfDay(last.out);
      live = last.out == null;
    } else if (db().fixes[d]) { inM = db().fixes[d].in; outM = db().fixes[d].out; } else { const x = hash(d); const sh = shiftTimes(); inM = sh.from + (x % 30) - 4; outM = sh.to + ((x >> 3) % 40) - 8; if (db().exceptions.some((e) => e.emp === me() && e.date === d && e.kind === 'Missing Check-Out')) outM = null; }
    const total = d === TODAY ? Math.round(L.todayMinutes()) : outM == null ? null : outM - inM;
    const missing = outM == null && !live;
    return { ...base, in: inM, out: outM, total, pay: total != null && !live ? Math.min(total, SHIFT_MIN) : null, dev: total == null ? (missing ? -SHIFT_MIN : null) : total - SHIFT_MIN, st: 'Present', stc: 'g', kind: missing ? 'missing' : 'present', live, fixed: !!db().fixes[d] };
  };
  const devHtml = (r) => (r.dev == null ? '-' : `${r.dev < 0 ? '−' : '+'}${hm(Math.abs(r.dev))}`);
  const devCls = (r) => (r.dev == null ? 'inherit' : r.dev < 0 ? 'var(--r)' : 'var(--g)');

  /* ---------- week helpers ---------- */
  const weekStart = () => L.ui('attWeek', L.weekStartOf(TODAY));
  const weekDays = () => range(weekStart(), addD(weekStart(), 6));
  L.attWeekMove = (n) => L.setUi('attWeek', addD(weekStart(), 7 * n));
  const weekLabel = () => `${fmt(weekStart())} – ${fmt(addD(weekStart(), 6))}`;
  /* Week or whole month. The month is the same one the calendar view shows (calState). */
  const inMonthMode = () => L.ui('attRange', 'week') === 'month';
  const monthDays = () => { const { y, m } = calState; return range(`${y}-${pad(m + 1)}-01`, `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`); };
  const viewDays = () => (inMonthMode() ? monthDays() : weekDays());
  const monthValue = () => `${calState.y}-${pad(calState.m + 1)}`;
  L.attRange = (mode) => { if (mode === 'month') { const d = parse(weekStart()); d.setDate(d.getDate() + 3); calState.y = d.getFullYear(); calState.m = d.getMonth(); } else { const first = `${calState.y}-${pad(calState.m + 1)}-01`; const inCur = parse(TODAY).getFullYear() === calState.y && parse(TODAY).getMonth() === calState.m; const d = parse(inCur ? TODAY : first); d.setDate(d.getDate() - d.getDay()); L.setUiRaw('attWeek', L.iso(d)); } L.setUi('attRange', mode); };
  L.attMonthPick = (v) => { const m = /^(\d{4})-(\d{2})$/.exec(v || ''); if (!m) return; calState.y = Number(m[1]); calState.m = Number(m[2]) - 1; if (L.ui('attView', 'list') !== 'calendar') L.setUiRaw('attRange', 'month'); L.rr(); };
  L.attMove = (n) => { if (L.ui('attView', 'list') === 'calendar' || inMonthMode()) window.calMove(n); else L.attWeekMove(n); };
  const FILTERS = ['All', 'Present', 'Weekend', 'Holiday', 'Leave', 'Missing punch'];
  const passFilter = (r) => { const f = L.ui('attFilter', 'All'); return f === 'All' || (f === 'Present' && r.kind === 'present') || (f === 'Weekend' && r.kind === 'weekend') || (f === 'Holiday' && r.kind === 'holiday') || (f === 'Leave' && r.kind === 'leave') || (f === 'Missing punch' && r.kind === 'missing'); };

  L.attFilterDlg = () => L.form({
    title: 'Filter attendance', size: 'sm', submit: 'Apply',
    fields: [{ k: 'f', label: 'Show', type: 'select', options: FILTERS, value: L.ui('attFilter', 'All'), full: true }],
    onSubmit: (v) => { L.setUi('attFilter', v.f); },
  });

  /* ---------- attendance summary ---------- */
  function toolbar() {
    const v = L.ui('attView', 'list');
    const cm = typeof calState !== 'undefined' ? calState : { y: 2026, m: 6 };
    const monthly = v === 'calendar' || inMonthMode();
    const lbl = monthly ? `${MONTHS[cm.m]} ${cm.y}` : weekLabel();
    const rng = L.ui('attRange', 'week');
    const recs = viewDays().map((d) => L.dayRec(d));
    const n = (k) => recs.filter((r) => r.kind === k).length;
    const opts = [{ v: 'All', l: 'All days', n: recs.length }, { v: 'Present', l: 'Present', n: n('present') }, { v: 'Missing punch', l: 'Missing punch', n: n('missing') }, { v: 'Leave', l: 'Leave', n: n('leave') }, { v: 'Holiday', l: 'Holiday', n: n('holiday') }, { v: 'Weekend', l: 'Weekend', n: n('weekend') }];
    return `<div class="lt-bar">
      <div class="lt-bar-r">
        <div class="daterange"><button class="dr-nav" onclick="LA.attMove(-1)" aria-label="Previous">${ic('chevL')}</button><span class="dr-lbl">${lbl}</span><button class="dr-nav" onclick="LA.attMove(1)" aria-label="Next">${ic('chevR')}</button></div>
        ${v === 'calendar' ? '' : `<div class="vtoggle" title="Show a week or the whole month"><button class="${rng === 'week' ? 'on' : ''}" onclick="LA.attRange('week')">Week</button><button class="${rng === 'month' ? 'on' : ''}" onclick="LA.attRange('month')">Month</button></div>`}
        <label class="lt-month" title="Pick a month">${ic('calendar')}<input type="month" value="${monthValue()}" onchange="LA.attMonthPick(this.value)" aria-label="Month"></label>
        <button class="btn sm ghost" onclick="LA.attToday()">${monthly ? 'This month' : 'Today'}</button>
        <div class="hb" style="margin-left:auto">
          <div class="vtoggle">
            <button class="${v === 'list' ? 'on' : ''}" title="List" onclick="LA.setUi('attView','list')">${ic('grid')}<span>List</span></button>
            <button class="${v === 'timeline' ? 'on' : ''}" title="Timeline" onclick="LA.setUi('attView','timeline')">${ic('chart')}<span>Timeline</span></button>
            <button class="${v === 'calendar' ? 'on' : ''}" title="Calendar" onclick="LA.setUi('attView','calendar')">${ic('calendar')}<span>Calendar</span></button>
          </div>
          <button class="btn sm" title="Export this ${monthly ? 'month' : 'week'} (CSV)" onclick="LA.attExport()">${ic('download')} Export</button>
        </div>
      </div>
      ${v === 'calendar' ? '' : `<div class="lt-bar-c">${L.chips('attFilter', opts, 'All')}</div>`}
    </div>`;
  }
  /* four tiles for whatever range is on screen */
  function tiles() {
    const recs = viewDays().map((d) => L.dayRec(d));
    const cnt = (f) => recs.filter(f).length;
    const present = cnt((r) => r.kind === 'present' || r.kind === 'missing');
    const leave = cnt((r) => r.kind === 'leave');
    const payable = recs.filter((r) => r.kind === 'present' || r.kind === 'missing' || r.kind === 'holiday' || r.kind === 'weekend' || (r.kind === 'leave' && r.st !== 'Unpaid Leave')).length;
    const worked = recs.reduce((a, r) => a + (r.total || 0), 0);
    const days = Math.max(1, cnt((r) => r.total != null));
    const over = recs.reduce((a, r) => a + (r.dev > 0 ? r.dev : 0), 0);
    const short = recs.reduce((a, r) => a + (r.dev < 0 && r.kind !== 'missing' ? -r.dev : 0), 0);
    const missing = cnt((r) => r.kind === 'missing');
    const scope = L.ui('attView', 'list') === 'calendar' || inMonthMode() ? 'this month' : 'this week';
    return statStrip([
      { lbl: 'Payable days', val: payable, icon: 'check', tone: 'g', hint: `${present} present · ${leave} on leave · ${cnt((r) => r.kind === 'holiday')} holiday` },
      { lbl: 'Hours worked', val: hm(worked), icon: 'clock', tone: 'b', hint: `Average ${hm(Math.round(worked / days))} a day ${scope}` },
      { lbl: 'Overtime', val: hm(over), icon: 'refresh', tone: over ? 'p' : 'x', hint: over ? 'Above the shift length' : 'None' },
      { lbl: missing ? 'Missing punches' : 'Shortfall', val: missing ? missing : hm(short), icon: missing ? 'alert' : 'scale', tone: missing ? 'r' : short ? 'a' : 'x', hint: missing ? 'Regularize them below' : short ? 'Under the shift length' : 'None' },
    ]);
  }
  L.attToday = () => { DB_set_today(); };
  function DB_set_today() { const d = parse(TODAY); calState.y = d.getFullYear(); calState.m = d.getMonth(); d.setDate(d.getDate() - d.getDay()); L.setUiRaw('attWeek', L.iso(d)); L.rr(); }
  L.attExport = () => {
    const rows = viewDays().map((d) => { const r = L.dayRec(d); return [fmtL(d), t12(r.in), t12(r.out), hm(r.total), hm(r.pay), devHtml(r), r.st, r.shift]; });
    L.csv(`attendance_${inMonthMode() || L.ui('attView', 'list') === 'calendar' ? monthValue() : weekStart()}.csv`, ['Date', 'First In', 'Last Out', 'Total Hours', 'Payable Hours', 'Deviation', 'Status', 'Shift'], rows);
  };

  function regCell(d) {
    const r = L.regFor(d);
    if (r) return `<a style="color:var(--brand);cursor:pointer;font-weight:600" onclick="event.stopPropagation();LA.regDetail('${r.id}')">${r.id}</a> ${L.statusPill(r.st)}`;
    const rec = L.dayRec(d);
    return rec.kind === 'missing' || (rec.kind === 'present' && !rec.live) ? `<button class="btn sm ghost" onclick="event.stopPropagation();LA.regNew('${d}')">Regularize</button>` : '<span class="muted">—</span>';
  }
  function list() {
    const days = viewDays().map((d) => ({ d, r: L.dayRec(d) })).filter((x) => passFilter(x.r));
    const rows = days.map(({ d, r }) => `<tr class="${d === TODAY ? 'lt-today' : r.kind === 'weekend' || r.kind === 'holiday' ? 'lt-off' : ''}" style="cursor:pointer" onclick="LA.dayDetail('${d}')"><td class="fw6">${fmtL(d)}${d === TODAY ? ' <span class="bdg s-b">Today</span>' : ''}</td><td class="mono">${t12(r.in)}</td><td class="mono">${r.live ? '<span class="muted">in progress</span>' : t12(r.out)}</td><td class="mono">${hm(r.total)}</td><td class="mono">${hm(r.pay)}</td>
      <td class="mono" style="color:${devCls(r)}">${devHtml(r)}</td><td>${r.st ? `<span class="bdg s-${r.stc}"><span class="d"></span>${esc(r.st)}</span>` : ''}</td><td>${r.shift}</td><td>${regCell(d)}</td></tr>`).join('');
    return tableCard('', ['Date', 'First In', 'Last Out', 'Total Hours', 'Payable Hours', 'Overtime/Deviation', 'Status', 'Shift(s)', 'Regularization'], rows || `<tr><td colspan="9">${L.empty('No days match this filter')}</td></tr>`);
  }
  function timeline() {
    const axis = ['08AM', '09AM', '10AM', '11AM', '12PM', '01PM', '02PM', '03PM', '04PM', '05PM', '06PM', '07PM', '08PM'];
    const span = 12 * 60;
    const rows = viewDays().map((d) => ({ d, r: L.dayRec(d) })).filter((x) => passFilter(x.r)).map(({ d, r }) => {
      let barH = '';
      if (r.in != null) {
        const s = Math.max(0, (r.in - 480) / span);
        const e = r.out != null ? Math.min(1, (r.out - 480) / span) : r.live ? Math.min(1, (minOfDay(Date.now()) - 480) / span) : null;
        if (e != null) barH = `<div class="fill" style="left:${s * 100}%;right:${(1 - e) * 100}%;background:${r.kind === 'missing' ? '#e0b96a' : '#7fce9f'}"></div><div class="cap" style="left:${s * 100}%;background:#1f9d63"></div>${r.out != null ? `<div class="cap" style="right:${(1 - e) * 100}%;background:#d5493f"></div>` : ''}`;
        else barH = `<div class="cap" style="left:${s * 100}%;background:#1f9d63"></div>`;
      } else if (r.kind === 'weekend') barH = '<div class="fill" style="left:2%;right:2%;background:#f0d9a0"></div>';
      else if (r.kind === 'holiday') barH = '<div class="fill" style="left:2%;right:2%;background:#d9cdf5"></div>';
      else if (r.kind === 'leave') barH = '<div class="fill" style="left:2%;right:2%;background:#bcd3f5"></div>';
      return `<div class="tl-row" style="cursor:pointer" onclick="LA.dayDetail('${d}')"><div class="tl-day"><div class="d">${DOWL[dow(d)]}</div><div class="n">${parse(d).getDate()}</div></div><div class="tl-time">${r.in != null ? t12(r.in) : ''}</div><div class="tl-track"><div class="base"></div>${barH}</div><div class="tl-time" style="text-align:right">${r.out != null ? t12(r.out) : ''}</div><div class="tl-hrs"><div class="h">${r.total != null ? hm(r.total) : '00:00'}</div><div class="s">Hrs worked</div></div></div>`;
    }).join('');
    return card('', rows ? `${rows}<div class="tl-axis">${axis.map((a) => `<span>${a}</span>`).join('')}</div>` : L.empty('No days match this filter'), { pad: true });
  }
  function calendar() {
    const { y, m } = calState;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const prev = new Date(y, m, 0).getDate();
    let cells = '';
    for (let i = 0; i < first; i++) cells += `<div class="cal-cell out att"><div class="dnum">${prev - first + i + 1}</div></div>`;
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
      const r = L.dayRec(ds);
      const cls = { present: 'pres', missing: 'leave', leave: 'leave', holiday: 'comp', absent: 'leave' }[r.kind];
      let inner = '';
      if (r.kind === 'present' || r.kind === 'missing') inner = `<span class="att-pill ${r.kind === 'missing' ? 'leave' : 'pres'}">${r.kind === 'missing' ? 'Missing check-out' : 'Present'}<div class="ph">${r.total != null ? hm(r.total) + ' Hrs' : ''}</div></span>`;
      else if (r.kind === 'leave') inner = `<span class="att-pill leave">${esc(r.st)}</span>`;
      else if (r.kind === 'holiday') inner = `<span class="att-pill comp">${esc(r.note || 'Holiday')}</span>`;
      else if (r.kind === 'absent') inner = '<span class="att-pill leave">Absent</span>';
      cells += `<div class="cal-cell att ${isWeekend(ds) ? 'wo' : ''} ${ds === TODAY ? 'today' : ''}" style="cursor:pointer" onclick="LA.dayDetail('${ds}')"><div class="dnum">${d}</div>${inner}</div>`;
      void cls;
    }
    const total = first + days;
    const tail = (7 - (total % 7)) % 7;
    for (let i = 1; i <= tail; i++) cells += `<div class="cal-cell out att"><div class="dnum">${i}</div></div>`;
    return `<div class="cal"><div class="cal-grid">${DOWL.map((d) => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div></div>`;
  }
  function strip() {
    const recs = viewDays().map((d) => L.dayRec(d));
    const mode = L.ui('ssMode', 'days');
    const cnt = (f) => recs.filter(f).length;
    const payable = recs.filter((r) => r.kind === 'present' || r.kind === 'missing' || r.kind === 'holiday' || r.kind === 'weekend' || (r.kind === 'leave' && r.st !== 'Unpaid Leave')).length;
    const items = mode === 'days'
      ? [['Payable Days', payable], ['Present', cnt((r) => r.kind === 'present' || r.kind === 'missing')], ['On Duty', 0], ['Paid leave', cnt((r) => r.kind === 'leave')], ['Holidays', cnt((r) => r.kind === 'holiday')], ['Weekend', cnt((r) => r.kind === 'weekend')]]
      : [['Total hours', hm(recs.reduce((a, r) => a + (r.total || 0), 0))], ['Payable hours', hm(recs.reduce((a, r) => a + (r.pay || 0), 0))], ['Overtime', hm(recs.reduce((a, r) => a + (r.dev > 0 ? r.dev : 0), 0))], ['Shortfall', hm(recs.reduce((a, r) => a + (r.dev < 0 && r.kind !== 'missing' ? -r.dev : 0), 0))], ['Avg / day', hm(Math.round(recs.reduce((a, r) => a + (r.total || 0), 0) / Math.max(1, cnt((r) => r.total != null))))]];
    return `<div class="summary-strip"><div class="ss-toggle"><button class="${mode === 'days' ? 'on' : ''}" onclick="LA.setUi('ssMode','days')">Days</button><button class="${mode === 'hours' ? 'on' : ''}" onclick="LA.setUi('ssMode','hours')">Hours</button></div>
      ${items.map((i) => `<div class="ss-item"><div class="l">${i[0]}</div><div class="v">${i[1]}</div></div>`).join('')}<div class="ss-shift">${shiftLabel(L.myLoc())}</div></div>`;
  }
  const attSummary = () => { const v = L.ui('attView', 'list'); return pageHead('My Attendance', `Your daily punches, hours and deviations · ${shiftLabel(L.myLoc())}`, '', 'My data') + tiles() + toolbar() + `<div class="lt-att">${v === 'list' ? list() : v === 'timeline' ? timeline() : calendar()}</div>`; };

  window.calMove = (n) => { calState.m += n; if (calState.m < 0) { calState.m = 11; calState.y--; } if (calState.m > 11) { calState.m = 0; calState.y++; } L.rr(); };

  /* ---------- day drawer ---------- */
  L.dayDetail = (d) => {
    const r = L.dayRec(d);
    const reg = L.regFor(d);
    const punches = d === TODAY ? sessions().flatMap((s) => [[clock(s.in) + ':00', 'Check-In', s.channel, s.ip], ...(s.out ? [[clock(s.out) + ':00', 'Check-Out', s.channel, s.ip]] : [])]) : r.in != null ? [[hm(r.in) + ':00', 'Check-In', d === '2026-07-28' ? 'Biometric' : 'Web', '10.20.4.18'], ...(r.out != null ? [[hm(r.out) + ':00', 'Check-Out', 'Biometric', '10.20.4.9']] : [])] : [];
    const canReg = d <= TODAY && !isWeekend(d) && r.kind !== 'holiday' && r.kind !== 'leave' && !(reg && reg.st === 'Pending');
    openModal(modalShell(fmtL(d),
      `<div class="dl" style="margin-bottom:14px"><dt>Status</dt><dd>${r.st ? `<span class="bdg s-${r.stc}"><span class="d"></span>${esc(r.st)}</span>` : '—'}${r.note ? ` <span class="muted">· ${esc(r.note)}</span>` : ''}</dd><dt>Shift</dt><dd>General · ${shiftTimes().label}</dd><dt>First in</dt><dd class="mono">${t12(r.in)}</dd><dt>Last out</dt><dd class="mono">${r.live ? 'in progress' : t12(r.out)}</dd><dt>Total hours</dt><dd class="mono">${hm(r.total)}</dd><dt>Deviation</dt><dd class="mono" style="color:${devCls(r)}">${devHtml(r)}</dd><dt>Regularization</dt><dd>${reg ? `${reg.id} ${L.statusPill(reg.st)}` : '—'}</dd></div>
       ${punches.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Type</th><th>Channel</th><th>Device / IP</th></tr></thead><tbody>${punches.map((p) => `<tr><td class="mono">${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td><td class="mono">${p[3]}</td></tr>`).join('')}</tbody></table></div>` : L.empty('No punches recorded for this day')}
       <div class="hint" style="margin-top:10px">Raw records are preserved and never overwritten.</div>`,
      `<button class="btn" onclick="closeModal()">Close</button>${canReg ? `<button class="btn pri" onclick="closeModal();LA.regNew('${d}')">${ic('edit')} Regularize</button>` : ''}`));
  };

  /* ---------- regularization + late/early/shift requests ---------- */
  const REG_REASONS = ['Missing punch', 'Biometric failure', 'Incorrect shift', 'Client site', 'Work from home', 'Official meeting', 'Business travel', 'System error'];
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  L.regNew = (date) => L.form({
    title: 'New regularization request', submit: 'Submit request',
    fields: [
      { k: 'reason', label: 'Reason type', req: true, type: 'select', options: REG_REASONS },
      { k: 'date', label: 'Date', req: true, type: 'date', value: date || '', max: TODAY },
      { k: 'from', label: 'From time', req: true, type: 'time', value: L.work().from },
      { k: 'to', label: 'To time', req: true, type: 'time', value: L.work().to },
      { k: 'cls', label: 'Classification', type: 'select', options: ['Official', 'Personal'] },
      { k: 'status', label: 'Requested status', type: 'select', options: ['Present', 'On Duty', 'Work from Home', 'Client Site'] },
      { k: 'note', label: 'Reason', req: true, type: 'textarea', full: true, ph: 'Explain what happened' },
      { k: 'file', label: 'Attachment', type: 'file', full: true, ph: 'Attach evidence (optional)' },
    ],
    validate: (v) => {
      const e = [];
      if (v.date > TODAY) e.push('Date cannot be in the future.');
      if (v.date && isWeekend(v.date)) e.push('That date is a weekly off.');
      if (v.from && v.to && toMin(v.to) <= toMin(v.from)) e.push('To time must be after From time.');
      if (db().regs.some((r) => r.emp === me() && r.kind === 'Regularization' && r.date === v.date && r.st === 'Pending')) e.push('A regularization request for this date is already pending.');
      if (db().regs.some((r) => r.emp === me() && r.kind === 'Regularization' && r.date === v.date && r.st === 'Approved')) e.push('This date has already been regularized.');
      return e;
    },
    onSubmit: (v) => {
      const id = L.nextId('RG');
      db().regs.unshift({ id: 'RG-' + id.split('-')[1], emp: me(), kind: 'Regularization', date: v.date, detail: `${v.reason} — ${v.note}`, reason: v.reason, from: v.from, to: v.to, st: 'Pending', stage: 'Reporting Manager', applied: TODAY, file: v.file ? v.file.name : '', cls: v.cls, status: v.status });
      L.audit('Regularization requested', 'RG-' + id.split('-')[1], '— → Pending', v.reason);
      toast('Regularization request submitted for approval');
      L.rr();
    },
  });
  window.openRegModal = () => L.regNew('');
  L.reqNew = () => L.form({
    title: 'New late / early / shift request', submit: 'Submit request',
    fields: [
      { k: 'kind', label: 'Request type', req: true, type: 'select', options: ['Scheduled Late Login', 'Early Departure', 'Shift Change'] },
      { k: 'date', label: 'Date', req: true, type: 'date', value: TODAY, min: TODAY },
      { k: 'from', label: 'From time', type: 'time' }, { k: 'to', label: 'To time', type: 'time' },
      { k: 'note', label: 'Reason', req: true, type: 'textarea', full: true },
    ],
    post: '<div class="hint" style="margin-top:8px">Prior approval reclassifies this as scheduled and excludes it from occurrence counting.</div>',
    validate: (v) => (v.date < TODAY ? ['Requests must be raised in advance — choose today or a later date.'] : []),
    onSubmit: (v) => {
      const id = 'RG-' + L.nextId('RG').split('-')[1];
      db().regs.unshift({ id, emp: me(), kind: v.kind, date: v.date, detail: v.note, reason: v.kind, from: v.from, to: v.to, st: 'Pending', stage: 'Reporting Manager', applied: TODAY });
      L.audit('Request raised', id, '— → Pending', v.kind);
      toast(v.kind + ' request submitted');
      L.rr();
    },
  });
  window.openReqModal = () => L.reqNew();
  const FLOW = (r) => [['Employee', 'Submitted', 'done'], ['Reporting Manager', r.st === 'Pending' ? 'Awaiting decision' : r.stage === 'Reporting Manager' && r.st === 'Rejected' ? 'Rejected' : 'Approved', r.st === 'Pending' ? 'active' : r.st === 'Rejected' && r.stage === 'Reporting Manager' ? 'bad' : 'done'], ['HR', r.st === 'Approved' ? 'Confirmed' : r.st === 'Rejected' && r.stage === 'HR' ? 'Rejected' : '—', r.st === 'Approved' ? 'done' : r.st === 'Rejected' && r.stage === 'HR' ? 'bad' : '']];
  L.regDetail = (id) => {
    const r = db().regs.find((x) => x.id === id);
    if (!r) return;
    openModal(modalShell(`${r.kind} · ${r.id}`,
      `<div class="dl" style="margin-bottom:14px"><dt>Employee</dt><dd>${esc(r.emp)}</dd><dt>Date</dt><dd>${fmtL(r.date)}</dd>${r.from ? `<dt>Requested time</dt><dd class="mono">${r.from} – ${r.to}</dd>` : ''}<dt>Detail</dt><dd>${esc(r.detail)}</dd><dt>Raised</dt><dd>${fmt(r.applied)}</dd><dt>Status</dt><dd>${L.statusPill(r.st)}</dd>${r.file ? `<dt>Attachment</dt><dd>${esc(r.file)}</dd>` : ''}</div>
       <div class="steps">${FLOW(r).map((s, i) => `<div class="step ${s[2] === 'bad' ? '' : s[2]}"><div class="sc" style="${s[2] === 'bad' ? 'background:var(--r);color:#fff' : ''}">${s[2] === 'done' ? ic('check') : s[2] === 'bad' ? ic('x') : i + 1}</div><div class="st">${s[0]}</div><div class="ss">${s[1]}</div></div>`).join('')}</div>`,
      `<button class="btn" onclick="closeModal()">Close</button>${r.st === 'Pending' && r.emp === me() ? `<button class="btn danger" onclick="LA.regWithdraw('${r.id}')">Withdraw request</button>` : ''}`, 'sm'));
  };
  L.regWithdraw = (id) => { const r = db().regs.find((x) => x.id === id); if (!r) return; r.st = 'Withdrawn'; r.stage = 'Employee'; L.audit('Request withdrawn', id, 'Pending → Withdrawn', ''); closeModal(); toast(id + ' withdrawn'); L.rr(); };

  function regView() {
    const mine = db().regs.filter((r) => r.emp === me());
    const q = L.ui('regQ', '');
    const stF = L.ui('regSt', 'All statuses');
    const kF = L.ui('regKind', 'All types');
    const ok = (r) => (stF === 'All statuses' || r.st === stF) && L.dateOk(r.date, 'regFrom', 'regTo');
    const regs = mine.filter((r) => r.kind === 'Regularization' && (kF === 'All types' || kF === 'Regularization') && ok(r) && L.matches(q, r.id, r.detail, r.date, r.st));
    const reqs = mine.filter((r) => r.kind !== 'Regularization' && (kF === 'All types' || kF === r.kind) && ok(r) && L.matches(q, r.id, r.kind, r.detail, r.st));
    const pill = (r) => statusBadge(r.st === 'Approved' ? 'Approved Late Login' : r.st === 'Rejected' || r.st === 'Withdrawn' ? 'Absent' : 'Regularization Pending').replace(/>([^<]*)<\/span>$/, `>${esc(r.st)}</span>`);
    return pageHead('Attendance Regularization', 'Correct missing punches, wrong shift or off-site work',
      `<button class="btn" onclick="LA.reqNew()">${ic('plus')} Late / early / shift request</button><button class="btn pri" onclick="LA.regNew('')">${ic('plus')} New regularization</button>`, 'Attendance')
      + note('info', 'Regularization reasons: <b>missing punch, biometric failure, incorrect shift, client site, work from home, official meeting, business travel, system error</b>. Approval flow: Employee → Reporting Manager → HR (where configured). Approved requests recalculate attendance while preserving the original record.')
      + `<div class="filters" style="margin-top:16px">${L.fSel('regSt', 'Status', ['All statuses', 'Pending', 'Approved', 'Rejected', 'Withdrawn'], 'All statuses')}${L.fSel('regKind', 'Type', ['All types', 'Regularization', 'Scheduled Late Login', 'Early Departure', 'Shift Change'], 'All types')}${L.fDate('regFrom', 'From')}${L.fDate('regTo', 'To')}${L.searchBox('regQ', 'Search by id, date, detail')}${L.fReset(['regSt', 'regKind', 'regFrom', 'regTo', 'regQ'])}</div>`
      + tableCard('My regularization requests', ['Request', 'Date', 'Detail', 'Stage', 'Status', 'Action'],
        regs.map((r) => `<tr><td class="fw6 mono">${r.id}</td><td>${fmt(r.date)}</td><td>${esc(r.detail)}</td><td class="muted">${esc(r.stage)}</td><td>${pill(r)}</td><td><div class="hb"><button class="btn sm ghost" onclick="LA.regDetail('${r.id}')">View</button>${r.st === 'Pending' ? `<button class="btn sm ghost" onclick="LA.regWithdraw('${r.id}')">Withdraw</button>` : ''}</div></td></tr>`).join('') || `<tr><td colspan="6">${L.empty('No regularization requests')}</td></tr>`)
      + '<div style="height:16px"></div>'
      + tableCard('Late / early / shift requests', ['Request', 'Type', 'Date', 'Detail', 'Status', 'Action'],
        reqs.map((r) => `<tr><td class="fw6 mono">${r.id}</td><td>${esc(r.kind)}</td><td>${fmt(r.date)}</td><td>${esc(r.detail)}</td><td>${pill(r)}</td><td><div class="hb"><button class="btn sm ghost" onclick="LA.regDetail('${r.id}')">View</button>${r.st === 'Pending' ? `<button class="btn sm ghost" onclick="LA.regWithdraw('${r.id}')">Withdraw</button>` : ''}</div></td></tr>`).join('') || `<tr><td colspan="6">${L.empty('No late / early / shift requests')}</td></tr>`);
  }

  /* ---------- team attendance (by date) ---------- */
  const STAT_GROUP = { Present: ['Present', 'Late Login', 'Approved Late Login', 'Unscheduled Late Login', 'Work from Home'], 'On leave': ['Annual Leave', 'Sick Leave', 'Restricted Festive Holiday', 'Compassionate Leave', 'Maternity Leave'], Late: ['Late Login', 'Unscheduled Late Login'], Absent: ['Absent', 'Unauthorized Absence'], 'Not yet joined': ['Not Yet Joined'] };
  L.teamDay = (date) => EMP.map((e) => {
    const base = { n: e.n, id: e.id, desig: e.desig, dept: e.dept, loc: e.loc, late: 0, early: 0 };
    const isMe = e.n === me();
    if (isMe) { const r = L.dayRec(date); return { ...base, in: r.in != null ? hm(r.in) : '—', out: r.live ? '—' : r.out != null ? hm(r.out) : '—', st: r.kind === 'present' || r.kind === 'missing' ? 'Present' : r.kind === 'weekend' ? 'Weekly Off' : r.kind === 'holiday' ? 'Public Holiday' : r.kind === 'leave' ? stKey(r.st) : r.kind === 'absent' ? 'Absent' : '—' }; }
    if (e.doj && date < e.doj) return { ...base, in: '—', out: '—', st: 'Not Yet Joined' }; // joining date is still ahead
    const mc = db().manual[e.n + '|' + date];
    const lv = leaveOn(date, e.n);
    if (L.isOff(date, e.loc)) return { ...base, in: '—', out: '—', st: 'Weekly Off' };
    if (holidayOn(date, e.loc)) return { ...base, in: '—', out: '—', st: 'Public Holiday' };
    if (mc) return { ...base, in: mc.in || '—', out: mc.out || '—', st: 'Present', corrected: true };
    if (lv) return { ...base, in: '—', out: '—', st: stKey(lv.type) };
    if (date > TODAY) return { ...base, in: '—', out: '—', st: '—' };
    if (date === TODAY) return { ...base, in: e.in, out: e.out, st: e.st, late: e.late, early: e.early };
    const x = hash(e.n + date) % 12;
    const sh = shiftTimes(e.loc);
    return { ...base, in: hm(sh.from + (x === 3 ? 25 : x % 6) - 3), out: hm(sh.to - 18 + (x % 25)), st: x === 3 ? 'Unscheduled Late Login' : x === 7 ? 'Work from Home' : 'Present', late: x === 3 ? 25 : 0 };
  });
  L.teamDateMove = (n) => L.setUi('teamDate', addD(L.ui('teamDate', TODAY), n));
  function teamAtt() {
    const date = L.ui('teamDate', TODAY);
    const stat = L.ui('teamStat', 'All statuses');
    const q = L.ui('teamQ', '');
    const dept = L.ui('tDept', 'All departments');
    // people who have accepted an offer but whose joining date is after the selected day are listed as "Not yet joined"
    const hires = L.org().employees.filter((o) => o.status === 'Onboarding' && o.doj && o.doj > date && !EMP.some((e) => e.id === o.code))
      .map((o) => ({ n: o.name, id: o.code, desig: o.designation, dept: o.department, loc: o.location, in: '—', out: '—', st: 'Not Yet Joined', late: 0, early: 0, extra: true }));
    const scoped = L.teamDay(date).concat(hires).filter((r) => (L.loc() === 'all' || r.loc === L.loc()) && (dept === 'All departments' || r.dept === dept));
    const inGroup = (r, g) => (g === 'All statuses' ? true : g === 'Weekly Off / holiday' ? ['Weekly Off', 'Public Holiday'].includes(r.st) : (STAT_GROUP[g] || []).includes(r.st));
    const rows = scoped.filter((r) => inGroup(r, stat) && L.matches(q, r.n, r.id, r.dept));
    // counts never include people who have not joined yet, and "everyone accounted for" is only said when it is true
    const cnt = (g) => scoped.filter((r) => STAT_GROUP[g].includes(r.st)).length;
    const nj = cnt('Not yet joined');
    const absent = cnt('Absent');
    const unknown = scoped.filter((r) => r.st === '—').length;
    const present = cnt('Present');
    const leave = cnt('On leave');
    const off = scoped.filter((r) => ['Weekly Off', 'Public Holiday'].includes(r.st)).length;
    const joined = Math.max(1, scoped.length - nj);
    const summary = L.statStrip([
      { lbl: 'Present', val: present, icon: 'check', tone: 'g', hint: date > TODAY ? 'Future date' : `${Math.round((present / joined) * 100)}% of ${joined} joined · in office or remote` },
      { lbl: 'On leave', val: leave, icon: 'calendar', tone: 'b', hint: 'Approved leave' },
      { lbl: 'Absent', val: absent, icon: 'alert', tone: absent ? 'r' : 'g', hint: absent ? 'No check-in recorded' : unknown ? `${unknown} with no record yet` : 'Everyone accounted for' },
      { lbl: 'Not yet joined', val: nj, icon: 'users', tone: 'a', hint: nj ? 'Joining date is after this day — not counted as absent' : 'No upcoming joiners' },
    ]);
    const chips = [
      { v: 'All statuses', l: 'All', n: scoped.length }, { v: 'Present', l: 'Present', n: present }, { v: 'On leave', l: 'On leave', n: leave },
      { v: 'Late', l: 'Late', n: cnt('Late') }, { v: 'Absent', l: 'Absent', n: absent }, { v: 'Weekly Off / holiday', l: 'Off / holiday', n: off }, { v: 'Not yet joined', l: 'Not yet joined', n: nj },
    ];
    const seg = [['Present', present, '#1f9d63'], ['On leave', leave, '#2f6fd6'], ['Weekly off / holiday', off, '#c6851b'], ['Absent', absent, '#d5493f'], ['Not yet joined', nj, '#aab4c8']].filter((x) => x[1] > 0);
    const total = seg.reduce((n, x) => n + x[1], 0) || 1;
    const bar = `<div class="lt-split" title="How the team splits on this day"><div class="lt-split-bar">${seg.map((x) => `<i style="width:${(x[1] / total) * 100}%;background:${x[2]}" title="${x[0]}: ${x[1]}"></i>`).join('')}</div><div class="lt-split-key">${seg.map((x) => `<span><i style="background:${x[2]}"></i>${x[0]} <b>${x[1]}</b></span>`).join('')}</div></div>`;
    const toolbarHtml = `<div class="lt-bar">
      <div class="lt-bar-r">
        <div class="daterange"><button class="dr-nav" onclick="LA.teamDateMove(-1)" aria-label="Previous day">${ic('chevL')}</button><span class="dr-lbl">${fmt(date)}${date === TODAY ? ' · Today' : ''}</span><button class="dr-nav" onclick="LA.teamDateMove(1)" aria-label="Next day">${ic('chevR')}</button></div>
        <label class="lt-month" title="Pick a date">${ic('calendar')}<input id="tdate" type="date" value="${date}" onchange="LA.setUi('teamDate',this.value||'${TODAY}')" aria-label="Date"></label>
        <button class="btn sm ghost" onclick="LA.setUi('teamDate','${TODAY}')">Today</button>
        <label class="lt-dept">${ic('users')}<select onchange="LA.setUi('tDept',this.value)" aria-label="Department">${['All departments'].concat(L.depts()).map((d) => `<option ${d === dept ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
        <div class="hb" style="margin-left:auto">${L.searchBox('teamQ', 'Search name, ID or department')}<button class="btn sm ghost" onclick="LA.resetUi(['teamStat','teamQ','teamDate','tDept'])">${ic('refresh')} Reset</button></div>
      </div>
      <div class="lt-bar-c">${L.chips('teamStat', chips, 'All statuses')}</div>
    </div>`;
    return pageHead('Team Attendance', 'Real-time attendance and availability for your team', `<button class="btn" onclick="LA.teamExport()">${ic('download')} Export</button>`, 'Team')
      + summary
      + toolbarHtml
      + `<div class="lt-att">${card(`Team · ${fmt(date)}`, bar + `<div class="tbl-wrap"><table class="tbl"><thead><tr>${['Member', 'Location', 'Check-in', 'Check-out', 'Status', 'Late', 'Early', 'Action'].map((h) => `<th class="${h === 'Late' || h === 'Early' ? 'num' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${
        rows.map((e) => `<tr ${e.extra ? '' : `style="cursor:pointer" onclick="LA.teamDetail('${esc(e.n)}')"`}><td>${personCell(e.n, e.id + ' · ' + esc(e.dept))}</td><td>${L.locChip(e.loc)}</td><td class="mono">${e.in}</td><td class="mono">${e.out}</td><td>${e.st === '—' ? '—' : statusBadge(e.st)}${e.corrected ? ' <span class="muted" title="Manually corrected">✎</span>' : ''}</td><td class="num">${e.late ? e.late + ' min' : '—'}</td><td class="num">${e.early ? e.early + ' min' : '—'}</td><td>${e.extra ? '<span class="muted">—</span>' : `<button class="btn sm ghost" onclick="event.stopPropagation();LA.teamDetail('${esc(e.n)}')">Detail</button>`}</td></tr>`).join('') || `<tr><td colspan="8">${L.empty('No team members match')}</td></tr>`
      }</tbody></table></div>`, { sub: `${rows.length} of ${scoped.length}`, pad: false })}</div>`;
  }
  L.teamExport = () => { const date = L.ui('teamDate', TODAY); L.csv(`team_attendance_${date}.csv`, ['Member', 'ID', 'Location', 'Department', 'Check-in', 'Check-out', 'Status', 'Late (min)', 'Early (min)'], L.teamDay(date).filter((r) => L.inLoc(r.n) && L.deptOk(r.n, 'tDept')).map((r) => [r.n, r.id, L.locName(r.loc), r.dept, r.in, r.out, r.st, r.late, r.early])); };
  L.teamDetail = (name) => {
    const date = L.ui('teamDate', TODAY);
    const e = EMP.find((x) => x.n === name);
    if (!e) return;
    const r = L.teamDay(date).find((x) => x.n === name);
    const openEx = db().exceptions.filter((x) => x.emp === name && x.st === 'Open');
    const lv = db().leaves.filter((l) => l.emp === name).slice(0, 4);
    openModal(modalShell(`${name} · ${e.id}`,
      `<div class="dl" style="margin-bottom:14px"><dt>Designation</dt><dd>${esc(e.desig)}</dd><dt>Date</dt><dd>${fmt(date)}</dd><dt>Check-in / out</dt><dd class="mono">${r.in} / ${r.out}</dd><dt>Status</dt><dd>${r.st === '—' ? '—' : statusBadge(r.st)}</dd></div>
       <div class="pc-lbl" style="margin:12px 0 6px">Open exceptions</div>${openEx.length ? openEx.map((x) => `<div class="lrow"><div class="li-t">${esc(x.kind)}</div><div class="li-s">${fmt(x.date)} · ${esc(x.detail)}</div></div>`).join('') : '<div class="muted" style="font-size:13px">None</div>'}
       <div class="pc-lbl" style="margin:14px 0 6px">Recent leave</div>${lv.length ? lv.map((l) => `<div class="lrow"><div class="li-t">${esc(l.type)} · ${l.days}d</div><div class="li-s">${fmt(l.from)} → ${fmt(l.to)}</div><div class="li-r">${L.statusPill(l.st)}</div></div>`).join('') : '<div class="muted" style="font-size:13px">No leave on record</div>'}`,
      `<button class="btn" onclick="closeModal()">Close</button><button class="btn pri" onclick="closeModal();LA.manualNew('${esc(name)}','${date}')">${ic('edit')} Manual correction</button>`, 'sm'));
  };
  L.manualNew = (name, date) => L.form({
    title: 'Manual attendance correction — ' + name, submit: 'Save correction', size: 'sm',
    pre: note('warn', 'Reason and attachment are mandatory. Raw record preserved and audited.'),
    fields: [
      { k: 'date', label: 'Date', req: true, type: 'date', value: date || TODAY, max: TODAY },
      { k: 'in', label: 'Corrected check-in', req: true, type: 'time', value: L.work(L.locOf(name)).from }, { k: 'out', label: 'Corrected check-out', req: true, type: 'time', value: L.work(L.locOf(name)).to },
      { k: 'reason', label: 'Reason', req: true, type: 'textarea', full: true },
      { k: 'file', label: 'Attachment', req: true, type: 'file', full: true },
    ],
    validate: (v) => (toMin(v.out) <= toMin(v.in) ? ['Check-out must be after check-in.'] : []),
    onSubmit: (v) => {
      db().manual[name + '|' + v.date] = { in: v.in, out: v.out, reason: v.reason };
      if (name === me()) db().fixes[v.date] = { in: toMin(v.in), out: toMin(v.out) };
      db().exceptions.forEach((x) => { if (x.emp === name && x.date === v.date && x.st === 'Open' && x.group !== 'unauth') x.st = 'Resolved'; });
      L.audit('Manual attendance correction', `${name} · ${fmt(v.date)}`, `— → ${v.in}–${v.out}`, v.reason);
      toast(`Correction saved for ${name}`);
      L.rr();
    },
  });
  window.openManualModal = (name) => L.manualNew(name, TODAY);

  L.attCalendar = calendar;

  /* ---------- wire up screens ---------- */
  DISPATCH['attendance/my/summary'] = attSummary;
  DISPATCH['attendance/my/regularization'] = regView;
  DISPATCH['attendance/team/summary'] = teamAtt;
  VIEWS.regularization = regView;
  VIEWS['team-attendance'] = teamAtt;
  VIEWS['my-attendance'] = () => attSummary();
  window.setAttView = (v) => L.setUi('attView', v);
  window.togglePunch = L.punch;
  void MON;
})();
