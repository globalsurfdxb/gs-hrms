/* Leave & Attendance — ACTIVE LAYER · home (my space, team, organization)
   Live check-in card, dashboard from real data, unified approvals inbox with real decisions,
   reportees / ex-employees / new hires from the app's roster, organization services, announcements, policies —
   all filterable by location, department and status. */
(function () {
  const L = window.LA;
  const { TODAY, fmt, fmtS, fmtL, addD, parse, pad, esc, daysBetween, hm, DOWL, range } = L;
  const db = () => L.db();
  const me = () => L.me();
  const R1 = (n) => Math.round(n * 10) / 10;
  const myRec = () => L.org().employees.find((e) => e.code === L.org().meId) || {};

  /* ---------- profile card + live timer ---------- */
  let pt = 0;
  function startTimer() {
    clearInterval(pt);
    const tick = () => {
      const el = __$('pcTimer');
      if (!el) { clearInterval(pt); return; }
      const [h, m, s] = L.hhmmss(Math.floor(L.todayMinutes() * 60)).split(':');
      el.innerHTML = `<span class="seg">${h}</span><span class="cln">:</span><span class="seg">${m}</span><span class="cln">:</span><span class="seg">${s}</span>`;
    };
    tick();
    pt = setInterval(tick, 1000);
  }
  window.startPcTimer = startTimer;
  const initials2 = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  /* ---------- roster-derived people lists ---------- */
  const toRep = (e, today) => { const t = today.find((x) => x.n === e.n); return { id: e.id, n: e.n, d: e.desig, dept: e.dept, loc: e.loc, phone: e.phone, email: e.email, st: t && t.in && t.in !== '—' ? 'In' : 'Out', stat: t ? t.st : '—' }; };
  const directs = () => { const t = L.teamDay(TODAY); return EMP.filter((e) => e.mgr === db().me.id).map((e) => toRep(e, t)); };
  const everyone = () => { const t = L.teamDay(TODAY); return EMP.filter((e) => e.n !== me()).map((e) => toRep(e, t)); };

  function profileCard() {
    const inn = L.isIn();
    const first = db().today.sessions[0];
    const reps = directs();
    return `<div class="pcard"><div class="pc-top">
      <div class="pc-av">${initials2(me())}</div>
      <div class="pc-name">${esc(me())} | GS IT</div>
      <div class="pc-desig">${esc(db().me.desig)}</div>
      <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.locName(L.myLoc()))} · ${esc(L.workLabel(L.myLoc()))}</div>
      <div class="pc-in" style="color:${inn ? 'var(--g)' : 'var(--muted)'}">${inn ? 'In' : 'Out'}</div>
      <div class="pc-timer" id="pcTimer"><span class="seg">00</span><span class="cln">:</span><span class="seg">00</span><span class="cln">:</span><span class="seg">00</span></div>
      <div class="muted" style="font-size:12px;margin-bottom:10px">${first ? 'First in ' + L.clock12(first.in) : 'Not checked in today'}</div>
      <button class="btn ${inn ? 'danger' : 'ok'}" style="width:100%;justify-content:center" onclick="LA.punch()">${inn ? 'Check-out' : 'Check-in'}</button>
    </div>
    <div class="pc-block"><div class="pc-lbl">Reportees · ${reps.length}</div>
      ${reps.map((r) => `<div class="lrow" style="padding:8px 0;cursor:pointer" onclick="LA.contact('${r.id}')"><div class="avatar" style="width:30px;height:30px;font-size:11px">${initials2(r.n)}</div><div><div class="li-t" style="font-size:12.5px">${esc(r.n)} <span class="muted" style="font-weight:400">· ${esc(L.locCity(r.loc))}</span></div><div class="li-s" style="color:${r.st === 'In' ? 'var(--g)' : 'var(--muted)'}">${r.st}</div></div></div>`).join('') || '<div class="muted" style="font-size:12.5px">No direct reports</div>'}
    </div></div>`;
  }

  /* ---------- Overview ---------- */
  const weekOf = (d) => { const x = parse(d); x.setDate(x.getDate() - x.getDay()); return range(L.iso(x), addD(L.iso(x), 6)); };
  function activities() {
    const items = inbox().slice(0, 3).map((it) => `<div class="lrow"><div class="avatar" style="width:36px;height:36px">${initials2(it.emp)}</div><div><div class="li-t">${esc(it.emp)} made a request for <b>${esc(it.kind)}</b></div><div class="li-s">${esc(L.locCity(L.locOf(it.emp)))} · ${esc(it.detail)}</div></div><div class="li-r"><button class="btn sm" onclick="navModule('home','team','approvals')">Review</button></div></div>`);
    const recent = db().audit.slice(0, 3).map((a) => `<div class="lrow"><div class="li-ic" style="background:var(--brand-050);color:var(--brand)">${ic('history')}</div><div><div class="li-t">${esc(a.action)} <span class="muted">· ${esc(a.entity)}</span></div><div class="li-s">${esc(a.user)}</div></div><div class="li-r muted" style="font-size:12px">${esc(a.ts)}</div></div>`);
    return items.concat(recent).join('') || L.empty('No activity yet');
  }
  function myOverview() {
    const wk = weekOf(TODAY);
    const hol = db().hol.filter((h) => (h.to || h.d) >= TODAY && (!h.locs || h.locs.includes('all') || h.locs.includes(L.myLoc()))).sort((a, b) => (a.d < b.d ? -1 : 1)).slice(0, 3);
    const html = `<div class="psplit"><div>${profileCard()}</div><div class="stack">
      ${card('', `<div class="tabs" style="margin:0 0 4px"><div class="tab active">Activities</div><div class="tab" onclick="navTab('dashboard')">Dashboard</div><div class="tab" onclick="LA.profile()">Profile</div><div class="tab" onclick="navModule('leave','my','summary')">Leave</div><div class="tab" onclick="navModule('attendance','my','summary')">Attendance</div></div>${activities()}`)}
      ${card('Work Schedule', `<div class="muted" style="font-size:12.5px;margin-bottom:4px">${fmt(wk[0])} → ${fmt(wk[6])} · General [ ${esc(L.work().from)} – ${esc(L.work().to)} ] · ${esc(L.workLabel(L.myLoc()).split(' · ')[0])}</div><div class="wk-strip">${wk.map((d) => { const r = L.dayRec(d); const col = r.kind === 'present' ? 'var(--g)' : r.kind === 'missing' || r.kind === 'absent' ? 'var(--r)' : r.kind === 'leave' ? 'var(--b)' : 'var(--muted)'; return `<div class="wk-day ${d === TODAY ? 'today' : ''}" style="cursor:pointer" onclick="LA.dayDetail('${d}')"><div class="wk-dot"></div><div class="wk-dnum">${DOWL[parse(d).getDay()]} ${d === TODAY ? '<b>' + parse(d).getDate() + '</b>' : parse(d).getDate()}</div>${r.st ? `<div class="wk-st" style="color:${col}">${esc(r.kind === 'present' || r.kind === 'missing' ? 'Present' : r.st === 'Public Holiday' ? 'Holiday' : r.st)}</div>` : ''}${r.total != null ? `<div class="wk-hrs">${hm(r.total)} Hrs</div>` : ''}</div>`; }).join('')}</div>`)}
      ${card('Upcoming Holidays', hol.length ? `<div class="row">${hol.map((h) => `<div class="card" style="flex:1"><div class="card-b" style="padding:14px"><div class="fw6" style="font-size:13px">${esc(h.n)}</div><div class="muted" style="font-size:12px;margin-top:3px">${ic('calendar')} ${fmtL(h.d)}</div></div></div>`).join('')}</div>` : L.empty('No upcoming holidays'), { actions: `<button class="btn sm ghost" onclick="navModule('leave','holidays','list')">View all</button>` })}
    </div></div>`;
    return { html, mount: startTimer };
  }
  L.profile = () => L.detail('My profile', [['Name', me()], ['Employee ID', db().me.id], ['Designation', db().me.desig], ['Department', db().me.dept], ['Company', myRec().company || 'GS IT'], ['Location', `${L.locName(L.myLoc())} (${L.locCity(L.myLoc())})`], ['Work week', L.workLabel(L.myLoc())], ['Email', myRec().email || '—'], ['Role', PERSONAS[PERSONA].role]], `<button class="btn" onclick="closeModal()">Close</button>`);

  /* ---------- Dashboard ---------- */
  function myDashboard() {
    const wk = weekOf(TODAY).map((d) => L.dayRec(d));
    const month = range(`${TODAY.slice(0, 7)}-01`, TODAY).map((d) => L.dayRec(d));
    const present = month.filter((r) => r.kind === 'present' || r.kind === 'missing').length;
    const lateAfter = L.toMin(L.work().from) + 60;
    const late = month.filter((r) => r.in != null && r.in > lateAfter).length;
    const leaveDays = month.filter((r) => r.kind === 'leave').length;
    const net = month.reduce((a, r) => a + (r.total || 0), 0);
    const occ = db().occ.filter((o) => o.emp === me()).reduce((a, o) => a + o.count - o.waived, 0);
    const ak = L.annualKey();
    const named = [ak, 'Sick Leave', 'Compensatory Off'];
    const extra = Object.keys(db().bal).find((k) => !named.concat(['Unpaid Leave', 'Work From Home', 'Weekly Off', 'Annual Leave', 'Earned Leave']).includes(k));
    const cards = named.concat(extra ? [extra] : []).filter((k) => db().bal[k]);
    return `<div class="grid g-4" style="margin-bottom:16px">
      ${kpi({ icon: 'clock', acc: 'g', val: hm(Math.round(L.todayMinutes())), lbl: 'Worked today' })}
      ${kpi({ icon: 'check', acc: 'g', val: wk.filter((r) => r.kind === 'present' || r.kind === 'missing').length, lbl: 'Present this week' })}
      ${kpi({ icon: 'wallet', acc: 'b', val: L.availOf(db().bal[ak]), lbl: db().bal[ak].card + ' balance' })}
      ${kpi({ icon: 'alert', acc: 'a', val: occ, lbl: 'Occurrences (12 mo)' })}</div>
    <div class="row"><div style="flex:1.4">${card('My leave balances', cards.map((k) => { const b = db().bal[k]; const a = L.availOf(b); return `<div style="margin-bottom:13px"><div class="mini-stat"><span>${esc(b.card)}</span><b style="color:${a > 0 ? 'var(--g)' : 'inherit'}">${a == null ? '—' : a} available</b></div>${bar(a == null || !b.cap ? 0 : Math.max(0, Math.min(100, (a / b.cap) * 100)))}</div>`; }).join(''), { actions: `<button class="btn sm ghost" onclick="navModule('leave','my','summary')">Leave tracker</button>` })}</div>
    <div style="flex:1">${card('This month', `<div class="grid g-2" style="gap:12px"><div><div class="k-val" style="font-size:22px">${present}</div><div class="muted">Present</div></div><div><div class="k-val" style="font-size:22px;color:var(--a)">${late}</div><div class="muted">Late (1 h after shift)</div></div><div><div class="k-val" style="font-size:22px;color:var(--b)">${leaveDays}</div><div class="muted">Leave days</div></div><div><div class="k-val" style="font-size:22px">${hm(Math.round(net))}</div><div class="muted">Net hours</div></div></div>`)}</div></div>`;
  }
  function myCalendar() { return `<div class="toolbar"><div class="daterange"><button class="dr-nav" onclick="calMove(-1)">${ic('chevL')}</button><span class="dr-lbl">${MONTHS[calState.m]} ${calState.y}</span><button class="dr-nav" onclick="calMove(1)">${ic('chevR')}</button></div><button class="btn sm ghost" style="margin-left:auto" onclick="calState.y=${parse(TODAY).getFullYear()};calState.m=${parse(TODAY).getMonth()};LA.rr()">Today</button></div>${L.attCalendar()}${calLegend([{ c: 'var(--g)', l: 'Present' }, { c: 'var(--a)', l: 'Missing check-out / absent' }, { c: 'var(--b)', l: 'Leave' }, { c: 'var(--p)', l: 'Holiday' }, { c: 'var(--gray)', l: esc(L.offText(L.myLoc())) }])}`; }

  /* ---------- team: reportees ---------- */
  L.contact = (id) => {
    const r = everyone().concat(directs()).find((x) => x.id === id);
    if (!r) return;
    L.form({
      title: r.n, size: 'sm', submit: 'Send message',
      pre: `<div class="dl" style="margin-bottom:14px"><dt>ID</dt><dd>${esc(r.id)}</dd><dt>Role</dt><dd>${esc(r.d)} · ${esc(r.dept)}</dd><dt>Location</dt><dd>${esc(L.locName(r.loc))} (${esc(L.locCity(r.loc))})</dd><dt>Email</dt><dd><a href="mailto:${esc(r.email)}" style="color:var(--brand)">${esc(r.email)}</a></dd><dt>Phone</dt><dd><a href="tel:${esc(r.phone)}" style="color:var(--brand)">${esc(r.phone)}</a></dd><dt>Today</dt><dd>${r.stat && r.stat !== '—' ? statusBadge(r.stat) : '—'}</dd></div>`,
      fields: [{ k: 'msg', label: 'Quick message', req: true, type: 'textarea', full: true, ph: `Write a message to ${r.n.split(' ')[0]}` }],
      onSubmit: (v) => { (db().messages ||= []).push({ to: r.n, msg: v.msg, on: Date.now() }); L.audit('Message sent', r.n, '—', v.msg.slice(0, 60)); toast(`Message sent to ${r.n}`); L.rr(); },
    });
  };
  function teamReportees() {
    const mode = L.ui('rpMode', 'direct');
    const stF = L.ui('rpStatus', 'All');
    const q = L.ui('rpQ', '');
    const direct = directs();
    const all = everyone();
    const list = (mode === 'all' ? all : direct).filter((r) => L.inLoc(r.n) && L.deptOk(r.n, 'rpDept') && (stF === 'All' || r.st === stF) && L.matches(q, r.n, r.id, r.d, r.dept));
    return `<div class="toolbar"><div class="fw6" style="font-size:15px">${esc(me())} | GS IT</div>
      <div style="margin-left:auto" class="hb"><div class="vtoggle"><button class="${mode === 'direct' ? 'on' : ''}" title="Direct" onclick="LA.setUi('rpMode','direct')">Direct ${direct.length}</button><button class="${mode === 'all' ? 'on' : ''}" title="All" onclick="LA.setUi('rpMode','all')">All ${all.length}</button></div>
      <button class="iconbtn" title="Export" onclick="LA.rpExport()">${ic('download')}</button></div></div>
      <div class="filters">${L.fDept('rpDept')}${L.fSel('rpStatus', 'Status today', ['All', 'In', 'Out'], 'All')}${L.searchBox('rpQ', 'Name, id, role')}${L.fReset(['rpDept', 'rpStatus', 'rpQ'])}</div>
      ${list.length ? `<div class="rp-grid">${list.map((r) => `<div class="rp-card"><div class="avatar">${initials2(r.n)}</div><div style="flex:1"><div class="rp-n">${esc(r.id)} · ${esc(r.n)}</div><div class="rp-d">${esc(r.d)} · ${esc(L.locCity(r.loc))}</div><div style="color:${r.st === 'In' ? 'var(--g)' : 'var(--muted)'};font-weight:600;font-size:12.5px">${r.st}</div></div><button class="iconbtn" style="width:30px;height:30px" title="Contact" onclick="LA.contact('${r.id}')">${ic('bell')}</button></div>`).join('')}</div>` : L.empty('No team members match')}`;
  }
  L.rpExport = () => { const mode = L.ui('rpMode', 'direct'); L.csv('team.csv', ['ID', 'Name', 'Role', 'Department', 'Location', 'Status today'], (mode === 'all' ? everyone() : directs()).filter((r) => L.inLoc(r.n) && L.deptOk(r.n, 'rpDept')).map((r) => [r.id, r.n, r.d, r.dept, L.locName(r.loc), r.st])); };

  /* ---------- approvals inbox ---------- */
  const mine = (n) => n === me();
  const MIN_SEG = 7;
  /* a request or plan segment that breaks the annual-leave segment rule (>= 7 calendar days) can only be approved as an explicit exception */
  const segIssue = (kind, rec) => {
    if (kind === 'PL' || (kind === 'LV' && rec.app === 'Annual' && L.tplOf(L.locOf(rec.emp)) === 'uae' && !rec.extOf && !rec.linked)) {
      const cal = daysBetween(rec.from, rec.to) + 1;
      if (cal < MIN_SEG) return `The period is ${cal} calendar day${cal === 1 ? '' : 's'} — below the ${MIN_SEG}-day minimum for an annual-leave segment.`;
    }
    return '';
  };
  function inbox() {
    const out = [];
    // requests routed to an external approver (e.g. the Managing Director) are not actionable by anyone inside the system
    db().leaves.filter((l) => l.st === 'Pending' && !L.isExternal(l.approver)).forEach((l) => {
      const clash = db().leaves.find((o) => o.id !== l.id && o.emp !== l.emp && L.locOf(o.emp) === L.locOf(l.emp) && (o.st === 'Approved' || o.st === 'Pending') && !(l.to < o.from || l.from > o.to));
      const med = l.type === 'Sick Leave' && l.days >= 2 && !l.doc;
      const exc = segIssue('LV', l);
      out.push({ key: 'LV:' + l.id, id: l.id, emp: l.emp, kind: L.typeName(l.type, L.locOf(l.emp), l.app), kindKey: L.kindKey(l.type, l.app), detail: `${L.fmtRange(l.from, l.to, true)} · ${l.days} day${l.days > 1 ? 's' : ''}`, flag: exc ? `Below ${MIN_SEG}-day minimum` : clash ? `Conflict w/ ${clash.emp.split(' ')[0]}` : med ? 'Medical cert required' : '', exception: exc, group: 'leave', appr: l.approver });
    });
    db().plans.filter((p) => p.st === 'Pending' && !db().leaves.some((l) => l.st === 'Pending' && l.emp === p.emp && l.from === p.from)).forEach((p) => {
      const ap = L.approverOfName(p.emp);
      if (ap && L.isExternal(ap.code)) return;
      const exc = segIssue('PL', p);
      out.push({ key: 'PL:' + p.id, id: p.id, emp: p.emp, kind: `${L.typeName('Annual Leave', L.locOf(p.emp))} Plan`, kindKey: 'plan', detail: `Segment ${p.seg} · ${L.fmtRange(p.from, p.to, true)} · ${daysBetween(p.from, p.to) + 1} days`, flag: exc ? `Below ${MIN_SEG}-day minimum` : '', exception: exc, group: 'leave', appr: ap ? ap.code : '' });
    });
    db().regs.filter((r) => r.st === 'Pending').forEach((r) => out.push({ key: 'RG:' + r.id, id: r.id, emp: r.emp, kind: r.kind, detail: r.kind === 'Regularization' ? `${r.reason} ${L.fmtRange(r.date, '', true)}` : `${L.fmtRange(r.date, '', true)} · ${r.detail}`, flag: '', group: 'att' }));
    db().ots.filter((o) => o.st === 'Pending').forEach((o) => { const mm = L.otMismatch(o); out.push({ key: 'OT:' + o.id, id: o.id, emp: o.emp, kind: 'Overtime', detail: `${o.cat} · ${o.hours.toFixed(1)} h · ${L.fmtRange(o.date, '', true)}`, flag: mm ? 'Category does not match the date' : '', mismatch: mm, group: 'ot' }); });
    // Nobody decides their own request. HR and Super Admin see everyone else's; anyone else sees only their direct
    // reports' requests and requests routed to them (an employee with no reports has an empty inbox).
    const others = out.filter((o) => o.emp !== me());
    if (PERSONA === 'hr' || PERSONA === 'admin') return others;
    const reps = new Set(directs().map((r) => r.n));
    return others.filter((o) => reps.has(o.emp) || (o.appr && o.appr === db().me.id));
  }
  L.inbox = inbox;
  const sel = () => L.ui('apprSel', []);
  const refuseOwn = (emp) => { if (emp === me()) { toast('You cannot approve or reject your own request'); return true; } return false; };
  /* returns false when the decision was refused (own request, external approver, non-compliant without an exception, category mismatch) */
  function settle(key, outcome, note, alt, opt = {}) {
    const [t, id] = key.split(':');
    const nt = alt ? `${note ? note + ' · ' : ''}Alternative dates proposed: ${alt}` : note;
    if (t === 'LV') {
      const l = db().leaves.find((x) => x.id === id);
      if (!l || l.st !== 'Pending') return false;
      if (outcome === 'Approved' && segIssue('LV', l) && !opt.exception) { toast('Below the 7-day minimum — approve it as an exception with a reason'); return false; }
      return L.leaveSettle(l, outcome, nt, { exception: !!(outcome === 'Approved' && opt.exception && segIssue('LV', l)) });
    } else if (t === 'PL') {
      const p = db().plans.find((x) => x.id === id);
      if (!p || p.st !== 'Pending' || refuseOwn(p.emp)) return false;
      const ap = L.approverOfName(p.emp);
      if (ap && L.isExternal(ap.code)) { toast(`Waiting for ${ap.name} — nobody in the system can decide this segment`); return false; }
      const issue = segIssue('PL', p);
      if (outcome === 'Approved' && issue && !opt.exception) { toast('Below the 7-day minimum — approve it as an exception with a reason'); return false; }
      p.st = outcome;
      if (outcome === 'Approved' && issue && opt.exception) p.exception = { reason: nt || '', by: db().me.id, on: TODAY };
      L.syncBal();
      L.audit(`Segment ${outcome.toLowerCase()}${outcome === 'Approved' && issue ? ' as exception' : ''}`, id, `Pending → ${outcome}`, nt || '—', L.locOf(p.emp));
      return true;
    } else if (t === 'RG') {
      const r = db().regs.find((x) => x.id === id);
      if (!r || r.st !== 'Pending' || refuseOwn(r.emp)) return false;
      r.st = outcome; r.stage = outcome === 'Approved' ? 'Completed' : 'Reporting Manager'; r.decision = nt || '';
      if (outcome === 'Approved' && r.kind === 'Regularization') {
        if (mine(r.emp)) db().fixes[r.date] = { in: L.toMin(r.from), out: L.toMin(r.to) };
        else db().manual[r.emp + '|' + r.date] = { in: r.from, out: r.to, reason: 'Regularization ' + r.id };
        db().exceptions.forEach((x) => { if (x.emp === r.emp && x.date === r.date && x.st === 'Open' && x.group !== 'unauth') x.st = 'Resolved'; });
      }
      L.audit(`${r.kind} ${outcome.toLowerCase()}`, id, `Pending → ${outcome}`, nt || '—', L.locOf(r.emp));
      return true;
    } else if (t === 'OT') { const o = db().ots.find((x) => x.id === id); if (o && o.st === 'Pending') return L.otSettle(o, outcome, nt); return false; }
    return false;
  }
  L.decide = (key, action) => {
    const it = inbox().find((x) => x.key === key);
    if (!it || refuseOwn(it.emp)) return;
    const rej = action === 'reject';
    const exc = !rej && !!it.exception;
    L.form({
      title: `${rej ? 'Reject' : exc ? 'Approve as exception' : 'Approve'} — ${it.id}`, size: 'sm', submit: rej ? 'Reject request' : exc ? 'Approve as exception' : 'Approve request', danger: rej,
      pre: `<div class="dl" style="margin-bottom:14px"><dt>Employee</dt><dd>${esc(it.emp)} · ${esc(L.locCity(L.locOf(it.emp)))}</dd><dt>Request</dt><dd>${esc(it.kind)}</dd><dt>Detail</dt><dd>${esc(it.detail)}</dd><dt>Reference</dt><dd class="mono">${it.id}</dd></div>${exc ? note('warn', `<b>Does not meet the rule.</b> ${esc(it.exception)} It can only be approved as an exception, and the reason is recorded against the request.`) : it.mismatch && !rej ? note('warn', `<b>Category does not match the date.</b> ${esc(it.mismatch)} Approving will offer to re-categorise it.`) : it.flag ? note('warn', esc(it.flag)) : ''}`,
      fields: [{ k: 'note', label: rej ? 'Rejection reason' : exc ? 'Exception reason' : 'Comment', req: rej || exc, type: 'textarea', full: true, ph: rej ? 'Explain why' : exc ? 'Why is this exception acceptable?' : 'Optional note' }]
        .concat(/Annual|Earned/.test(it.kind) && rej ? [{ k: 'a1', label: 'Alternative from', type: 'date' }, { k: 'a2', label: 'Alternative to', type: 'date' }] : []),
      validate: (v) => (v.a1 && v.a2 && v.a2 < v.a1 ? [{ k: 'a2', msg: 'Alternative end date is before the start date.' }] : []),
      onSubmit: (v) => {
        if (settle(key, rej ? 'Rejected' : 'Approved', v.note, v.a1 && v.a2 ? `${fmt(v.a1)} → ${fmt(v.a2)}` : '', { exception: exc }) === false) return false;
        LA.setUiRaw('apprSel', sel().filter((k) => k !== key)); toast(`${it.id} ${rej ? 'rejected' : exc ? 'approved as an exception' : 'approved'}`); L.rr();
      },
    });
  };
  window.openApprove = (id, emp, kind, action) => { const it = inbox().find((x) => x.id === id); if (it) L.decide(it.key, action); };
  L.apprToggle = (key) => { const s = sel(); L.setUi('apprSel', s.includes(key) ? s.filter((k) => k !== key) : s.concat(key)); };
  L.apprAll = (keys, on) => L.setUi('apprSel', on ? keys : []);
  L.apprBulk = () => {
    const all = inbox();
    const keys = sel().filter((k) => all.some((x) => x.key === k));
    if (!keys.length) { toast('Select at least one request'); return; }
    // anything that needs a conscious decision (rule exception, category mismatch) is left for individual review
    const ok = keys.filter((k) => { const it = all.find((x) => x.key === k); return !it.exception && !it.mismatch; });
    const left = keys.length - ok.length;
    if (!ok.length) { toast(`${left} selected request${left > 1 ? 's' : ''} need${left > 1 ? '' : 's'} individual review (rule exception or category mismatch)`); return; }
    L.confirm('Approve selected', `Approve <b>${ok.length}</b> request${ok.length > 1 ? 's' : ''}? Balances and attendance update immediately.${left ? `<br><br>${left} selected request${left > 1 ? 's' : ''} with a rule exception or category mismatch will be skipped — review ${left > 1 ? 'them' : 'it'} individually.` : ''}`, 'Approve all', () => { let n = 0; ok.forEach((k) => { if (settle(k, 'Approved', 'Bulk approved') !== false) n++; }); L.setUiRaw('apprSel', []); toast(`${n} request${n > 1 ? 's' : ''} approved${left ? `, ${left} left for review` : ''}`); L.rr(); });
  };
  function approvals() {
    const scoped = inbox().filter((x) => L.inLoc(x.emp) && L.deptOk(x.emp, 'apDept'));
    const tab = L.ui('apprTab', 'all');
    const q = L.ui('apprQ', '');
    const kindF = L.ui('apKind', 'All requests');
    const cnt = (g) => scoped.filter((x) => x.group === g).length;
    // one entry per kind; when the people in scope are on different location templates the neutral name is listed (e.g. Annual / Earned leave)
    const kmap = new Map();
    inbox().filter((x) => L.inLoc(x.emp)).forEach((x) => { const k = x.kindKey || x.kind; if (!kmap.has(k)) kmap.set(k, new Set()); kmap.get(k).add(x.kind); });
    const kinds = [{ v: 'All requests', l: 'All requests' }].concat([...kmap].map(([k, names]) => ({ v: k, l: names.size === 1 ? [...names][0] : k === 'plan' ? 'Annual / Earned leave plan' : L.kindNeutral(k) })));
    const items = scoped.filter((x) => (tab === 'all' || x.group === tab) && (kindF === 'All requests' || (x.kindKey || x.kind) === kindF) && L.matches(q, x.emp, x.id, x.kind, x.detail));
    const keys = items.map((x) => x.key);
    const picked = sel().filter((k) => keys.includes(k));
    const waiting = (PERSONA === 'hr' || PERSONA === 'admin') ? L.waitingExternal().filter((x) => L.inLoc(x.emp) && L.deptOk(x.emp, 'apDept')) : [];
    return pageHead('Approvals', 'Unified inbox: leave, regularization, late/early, overtime and schedule changes',
      `<button class="btn ok sm" onclick="LA.apprBulk()" ${picked.length ? '' : 'style="opacity:.6"'}>${ic('check')} Approve selected${picked.length ? ' (' + picked.length + ')' : ''}</button>`, 'Actions')
      + `<div class="tabs">${[['all', `All (${scoped.length})`], ['leave', `Leave (${cnt('leave')})`], ['att', `Attendance (${cnt('att')})`], ['ot', `Overtime (${cnt('ot')})`]].map((t) => `<div class="tab ${t[0] === tab ? 'active' : ''}" onclick="LA.setUi('apprTab','${t[0]}')">${t[1]}</div>`).join('')}</div>`
      + `<div class="filters" style="margin-bottom:12px">${L.fDept('apDept')}${L.fSel('apKind', 'Request type', kinds, 'All requests')}${L.searchBox('apprQ', 'Employee, id, request…')}${L.fReset(['apDept', 'apKind', 'apprQ'])}<div class="fld"><label>&nbsp;</label><label style="display:flex;gap:8px;align-items:center;height:36px;font-weight:500"><input type="checkbox" ${items.length && picked.length === items.length ? 'checked' : ''} onchange="LA.apprAll(${JSON.stringify(keys).replace(/"/g, '&quot;')},this.checked)"> Select all (${items.length})</label></div></div>`
      + (items.length ? `<div class="stack">${items.map((it) => `<div class="card"><div class="card-b" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <input type="checkbox" ${picked.includes(it.key) ? 'checked' : ''} onchange="LA.apprToggle('${it.key}')">${personCell(it.emp, `${it.id} · ${L.locCity(L.locOf(it.emp))}`)}
        <div style="flex:1;min-width:140px"><div class="fw6">${esc(it.kind)}</div><div class="muted" style="font-size:12.5px">${esc(it.detail)}</div></div>
        ${it.flag ? bdg('s-a', esc(it.flag)) : ''}
        <div class="hb"><button class="btn sm ok" onclick="LA.decide('${it.key}','approve')">${ic('check')} ${it.exception ? 'Approve as exception' : 'Approve'}</button><button class="btn sm danger" onclick="LA.decide('${it.key}','reject')">${ic('x')} Reject</button></div></div></div>`).join('')}</div>` : card('', L.empty(scoped.length ? 'No requests match this filter' : 'All caught up — nothing is waiting for approval')))
      + (waiting.length ? `<div style="height:16px"></div>${card('Waiting for an external approver', waiting.map((w) => `<div class="lrow">${personCell(w.emp, `${w.id} · ${L.locCity(L.locOf(w.emp))}`)}<div style="flex:1"><div class="li-t">${esc(w.kind === 'plan' ? `${L.typeName('Annual Leave', L.locOf(w.emp))} plan · segment ${w.rec.seg}` : L.typeName(w.rec.type, L.locOf(w.emp), w.rec.app))}</div><div class="li-s">${esc(L.fmtRange(w.rec.from, w.rec.to, true))}</div></div><div class="li-r">${bdg('s-a', `Waiting for ${esc(w.approverName)}`)}</div></div>`).join(''), { sub: 'Outside the system — HR is informed; nobody here can decide these' })}` : '');
  }
  window.filterApprovals = (k) => L.setUi('apprTab', k);

  /* ---------- ex-employees (employees who have left, from the app) ---------- */
  const exList = () => L.org().employees.filter((e) => e.status === 'Inactive').map((e) => ({ id: e.code, n: e.name, d: e.designation, dept: e.department, loc: e.location, on: e.exitDate || '', why: e.exitReason || 'Left the organisation' }));
  function teamEx() {
    const q = L.ui('exQ', '');
    const rows = exList().filter((e) => (L.loc() === 'all' || e.loc === L.loc()) && L.deptOk2(e.dept) && L.matches(q, e.n, e.id, e.d, e.why));
    return `<div class="filters">${L.fDept('exDept')}${L.searchBox('exQ', 'Name, id, designation')}${L.fReset(['exDept', 'exQ'])}<div class="fld"><label>&nbsp;</label><button class="btn" onclick="LA.exExport()">${ic('download')} Export</button></div></div>`
      + tableCard('Ex-Employees', ['Employee', 'Designation', 'Location', 'Relieved on', 'Reason'], rows.map((e) => `<tr><td>${personCell(e.n, e.id + ' · ' + esc(e.dept))}</td><td>${esc(e.d)}</td><td>${L.locChip(e.loc)}</td><td>${fmt(e.on)}</td><td>${bdg('s-gray', esc(e.why))}</td></tr>`).join('') || `<tr><td colspan="5">${L.empty('No ex-employees match')}</td></tr>`);
  }
  L.deptOk2 = (dept) => { const v = L.ui('exDept', 'All departments'); return v === 'All departments' || v === dept; };
  L.exExport = () => L.csv('ex_employees.csv', ['ID', 'Name', 'Designation', 'Department', 'Location', 'Relieved on', 'Reason'], exList().filter((e) => L.loc() === 'all' || e.loc === L.loc()).map((e) => [e.id, e.n, e.d, e.dept, L.locName(e.loc), e.on, e.why]));

  /* ---------- organization ---------- */
  L.timesheet = () => {
    const rows = db().timesheet.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const week = rows.filter((r) => r.date >= addD(TODAY, -6)).reduce((a, r) => a + r.hours, 0);
    openModal(modalShell('Time Tracker', `<div class="grid g-2" style="gap:12px;margin-bottom:12px"><div class="card"><div class="card-b"><div class="k-val" style="font-size:22px">${R1(week)}</div><div class="muted">Hours (last 7 days)</div></div></div><div class="card"><div class="card-b"><div class="k-val" style="font-size:22px">${rows.length}</div><div class="muted">Entries</div></div></div></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Project</th><th class="num">Hours</th><th>Note</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td>${fmt(r.date)}</td><td>${esc(r.project)}</td><td class="num">${r.hours}</td><td class="muted">${esc(r.note)}</td><td><button class="btn sm ghost" onclick="LA.tsDel('${r.id}')">${ic('x')}</button></td></tr>`).join('')}</tbody></table></div>` : L.empty('No time logged yet')}`,
      `<button class="btn" onclick="closeModal()">Close</button><button class="btn pri" onclick="LA.tsNew()">${ic('plus')} Log time</button>`));
  };
  L.tsNew = () => L.form({
    title: 'Log time', size: 'sm', submit: 'Save entry',
    fields: [{ k: 'date', label: 'Date', req: true, type: 'date', value: TODAY, max: TODAY }, { k: 'project', label: 'Project', req: true, type: 'select', options: ['Internal', 'Client — Retail', 'Client — Banking', 'Support'] }, { k: 'hours', label: 'Hours', req: true, type: 'number', value: 1, step: '0.5', min: 0.5, max: 24 }, { k: 'note', label: 'Note', type: 'text' }],
    validate: (v) => { const e = []; if (!(v.hours >= 0.5 && v.hours <= 24)) e.push('Hours must be between 0.5 and 24.'); const day = db().timesheet.filter((t) => t.date === v.date).reduce((a, t) => a + t.hours, 0); if (day + Number(v.hours) > 24) e.push(`That would exceed 24 h on ${fmt(v.date)} (${day} h already logged).`); return e; },
    onSubmit: (v) => { db().timesheet.push({ id: 'TS-' + L.nextId('TS').split('-')[1], date: v.date, project: v.project, hours: Number(v.hours), note: v.note }); toast('Time logged'); L.timesheet(); L.save(); return false; },
  });
  L.tsDel = (id) => { db().timesheet = db().timesheet.filter((t) => t.id !== id); L.timesheet(); L.save(); };
  L.orgFiles = () => {
    const rows = db().orgFiles;
    openModal(modalShell('Files', rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Size</th><th>Added</th><th></th></tr></thead><tbody>${rows.map((f) => `<tr><td class="fw6">${esc(f.name)}</td><td>${L.kb(f.size)}</td><td>${fmt(f.on)} · ${esc(f.by)}</td><td><div class="hb">${f.url ? `<a class="btn sm ghost" href="${f.url}" target="_blank" rel="noopener">Open</a><a class="btn sm ghost" href="${f.url}" download="${esc(f.name)}">${ic('download')}</a>` : '<span class="muted" style="font-size:12px">Stored by HR</span>'}<button class="btn sm ghost" onclick="LA.fileDel('${f.id}')">${ic('x')}</button></div></td></tr>`).join('')}</tbody></table></div>` : L.empty('No files yet'),
      `<button class="btn" onclick="closeModal()">Close</button><button class="btn pri" onclick="LA.fileUp()">${ic('plus')} Upload file</button>`));
  };
  L.fileUp = () => L.pickFile('', (f) => { if (f.size > 20 * 1048576) { toast('File is larger than 20 MB'); return; } db().orgFiles.unshift({ id: 'FILE-' + L.nextId('FILE').split('-')[1], name: f.name, size: f.size, by: me(), on: TODAY, url: f.url }); L.audit('File uploaded', f.name, '—', ''); toast(`${f.name} uploaded`); L.orgFiles(); });
  L.fileDel = (id) => L.confirm('Delete file', 'Remove this file from the organization library?', 'Delete', () => { db().orgFiles = db().orgFiles.filter((f) => f.id !== id); L.audit('File deleted', id, '—', ''); L.orgFiles(); L.save(); }, true);
  function orgOverview() {
    const tab = L.ui('orgTab', 'services');
    const cities = L.locs().map((l) => l.city).join(' · ');
    const svc = [['umbrella', 'Leave Tracker', '#2f6fd6', "navModule('leave')"], ['clock2', 'Time Tracker', '#c6851b', 'LA.timesheet()'], ['attendance', 'Attendance', '#d5493f', "navModule('attendance')"], ['file', 'Files', '#2f6fd6', 'LA.orgFiles()']];
    const body = tab === 'services'
      ? `<div class="grid g-2">${svc.map((s) => `<div class="card" style="cursor:pointer" onclick="${s[3]}"><div class="card-b" style="display:flex;align-items:center;gap:14px;padding:16px"><div style="width:40px;height:40px;border-radius:11px;background:${s[2]}18;color:${s[2]};display:grid;place-items:center">${ic(s[0])}</div><div class="fw6">${s[1]}</div></div></div>`).join('')}</div>`
      : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Location</th><th>City</th><th>Work week &amp; hours</th><th class="num">Employees</th><th class="num">In today</th><th class="num">Holidays</th></tr></thead><tbody>${L.locs().map((l) => { const t = L.teamDay(TODAY).filter((x) => x.loc === l.id); return `<tr style="cursor:pointer" onclick="LA.setUi('loc','${l.id}');navModule('home','team','reportees')"><td class="fw6">${esc(l.name)}</td><td>${esc(l.city)}</td><td>${esc(L.workLabel(l.id))}</td><td class="num">${EMP.filter((e) => e.loc === l.id).length}</td><td class="num">${t.filter((x) => x.in && x.in !== '—').length}</td><td class="num">${db().hol.filter((h) => !h.locs || h.locs.includes('all') || h.locs.includes(l.id)).length}</td></tr>`; }).join('')}</tbody></table></div><div style="margin-top:12px" class="hb"><button class="btn" onclick="LA.openApp('/admin/settings')">${ic('gear')} Manage locations</button><span class="muted" style="font-size:12.5px">Work week and hours are set per location in Administration → Settings.</span></div>`;
    return `<div class="card" style="overflow:hidden;margin-bottom:18px"><div style="height:120px;${banner()}"></div>
      <div class="card-b" style="display:flex;gap:20px;flex-wrap:wrap;margin-top:-46px">
        <div class="pcard" style="width:290px;flex:none"><div class="pc-top"><div class="pc-av" style="background:#fff;color:var(--brand);border:1px solid var(--line)">GS</div><div class="pc-name">GLOBAL SURF IT</div><div class="pc-desig">${esc(cities)}</div><div style="margin-top:10px" class="muted">${ic('users')} ${EMP.length} active employees</div></div>
          <div class="pc-block"><div class="pc-lbl">Quick Links</div><div class="hb muted" style="cursor:pointer" onclick="navModule('home','team','reportees')">${ic('users')} Employees Contact Information</div></div></div>
        <div style="flex:1;min-width:260px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px">
          <div class="tabs" style="margin-bottom:16px"><div class="tab ${tab === 'services' ? 'active' : ''}" onclick="LA.setUi('orgTab','services')">Services</div><div class="tab ${tab === 'location' ? 'active' : ''}" onclick="LA.setUi('orgTab','location')">Location</div></div>${body}</div></div></div>`;
  }
  L.annNew = () => L.form({
    title: 'Post announcement', submit: 'Post',
    fields: [{ k: 't', label: 'Title', req: true, type: 'text', full: true }, { k: 's', label: 'Message', req: true, type: 'textarea', full: true }, { k: 'loc', label: 'Audience', req: true, type: 'select', options: L.locOptions(), value: L.loc(), full: true }],
    onSubmit: (v) => { db().announce.unshift({ id: 'AN-' + L.nextId('AN').split('-')[1], t: v.t, s: v.s, by: me(), on: TODAY, locs: v.loc === 'all' ? ['all'] : [v.loc] }); L.audit('Announcement posted', v.t, '—', L.locName(v.loc), v.loc === 'all' ? undefined : v.loc); toast('Announcement posted'); L.rr(); },
  });
  L.annDel = (id) => L.confirm('Delete announcement', 'Remove this announcement for everyone?', 'Delete', () => { db().announce = db().announce.filter((a) => a.id !== id); L.audit('Announcement deleted', id, '—', ''); L.rr(); }, true);
  const orgAnnouncements = () => {
    const q = L.ui('anQ', '');
    const rows = db().announce.filter((a) => L.hasLoc(a.locs) && L.matches(q, a.t, a.s, a.by));
    return `<div class="filters">${L.searchBox('anQ', 'Title or message')}${L.fReset(['anQ'])}</div>`
      + card('Announcements', rows.length ? rows.map((a) => `<div class="lrow"><div class="li-ic" style="background:var(--brand-050);color:var(--brand)">${ic('bell')}</div><div style="flex:1"><div class="li-t">${esc(a.t)}</div><div class="li-s">${esc(a.s)} · ${esc(a.by)}, ${fmt(a.on)} · ${!a.locs || a.locs.includes('all') ? 'All locations' : a.locs.map((i) => esc(L.locCity(i))).join(', ')}</div></div><button class="btn sm ghost" onclick="LA.annDel('${a.id}')">${ic('x')}</button></div>`).join('') : L.empty('No announcements for this selection'), { actions: `<button class="btn sm pri" onclick="LA.annNew()">${ic('plus')} Post</button>` });
  };
  const polTpls = () => (L.loc() === 'all' ? L.locs().map((l) => l.template) : [L.tplOf(L.loc())]);
  L.polView = (i) => {
    const p = db().policies[i];
    openModal(modalShell(p.n, `<div class="dl" style="margin-bottom:14px"><dt>Version</dt><dd>${esc(p.v)}</dd><dt>Effective</dt><dd>${fmt(p.eff)}</dd><dt>Applies to</dt><dd>${p.tpl === 'all' ? 'All locations' : p.tpl === 'uae' ? 'UAE locations' : 'India locations'}</dd><dt>Status</dt><dd>${bdg('s-g', esc(p.st))}</dd><dt>Acknowledged</dt><dd>${p.ack ? bdg('s-g', 'Yes') : bdg('s-a', 'Not yet')}</dd></div><p style="font-size:13.5px;line-height:1.6">${esc(p.body)}</p>`,
      `<button class="btn" onclick="closeModal()">Close</button>${p.ack ? '' : `<button class="btn pri" onclick="LA.polAck(${i})">${ic('check')} Acknowledge</button>`}`, 'sm'));
  };
  L.polAck = (i) => { db().policies[i].ack = true; L.audit('Policy acknowledged', db().policies[i].n, '—', ''); closeModal(); toast('Policy acknowledged'); L.rr(); };
  const orgPolicies = () => {
    const q = L.ui('plQ', '');
    const aF = L.ui('plAck', 'All');
    const tpls = polTpls();
    const rows = db().policies.map((p, i) => ({ p, i })).filter(({ p }) => (p.tpl === 'all' || tpls.includes(p.tpl)) && (aF === 'All' || (aF === 'Acknowledged') === p.ack) && L.matches(q, p.n, p.v));
    return `<div class="filters">${L.fSel('plAck', 'Acknowledgement', ['All', 'Acknowledged', 'Pending'], 'All')}${L.searchBox('plQ', 'Policy name')}${L.fReset(['plAck', 'plQ'])}</div>`
      + tableCard('Policies', ['Policy', 'Applies to', 'Version', 'Effective', 'Status', 'Acknowledged'], rows.map(({ p, i }) => `<tr style="cursor:pointer" onclick="LA.polView(${i})"><td class="fw6">${esc(p.n)}</td><td>${p.tpl === 'all' ? 'All locations' : p.tpl === 'uae' ? 'UAE' : 'India'}</td><td>${bdg('s-b', esc(p.v))}</td><td>${fmt(p.eff)}</td><td>${bdg('s-g', esc(p.st))}</td><td>${p.ack ? bdg('s-g', '✓') : bdg('s-a', 'Pending')}</td></tr>`).join('') || `<tr><td colspan="6">${L.empty('No policies match')}</td></tr>`);
  };
  L.hireNew = () => L.form({
    title: 'Add new hire', size: 'sm', submit: 'Add',
    fields: [{ k: 'n', label: 'Name', req: true, type: 'text', full: true }, { k: 'd', label: 'Department', req: true, type: 'select', options: L.depts() }, { k: 'loc', label: 'Location', type: 'select', options: L.locOptions(false), value: L.loc() === 'all' ? L.myLoc() : L.loc() }, { k: 'on', label: 'Joined', req: true, type: 'date', value: TODAY }],
    onSubmit: (v) => { db().newhires.unshift({ n: v.n, d: v.d, loc: v.loc, on: v.on, custom: true }); L.audit('New hire added', v.n, '—', L.locName(v.loc), v.loc); toast('New hire added'); L.rr(); },
  });
  const hires = () => {
    const cutoff = addD(TODAY, -730);
    const fromOrg = L.org().employees.filter((e) => (e.status === 'Onboarding' || (e.status === 'Active' && e.doj >= cutoff)) && e.doj).map((e) => ({ n: e.name, d: e.department, loc: e.location, on: e.doj, st: e.status === 'Onboarding' ? 'Onboarding' : 'Joined' }));
    return db().newhires.map((h) => ({ ...h, st: 'Joined' })).concat(fromOrg).sort((a, b) => (a.on < b.on ? 1 : -1));
  };
  function orgNewHires() {
    const q = L.ui('nhQ', '');
    const sF = L.ui('nhSt', 'All');
    const rows = hires().filter((h) => (L.loc() === 'all' || h.loc === L.loc()) && (L.ui('nhDept', 'All departments') === 'All departments' || h.d === L.ui('nhDept', 'All departments')) && (sF === 'All' || h.st === sF) && L.matches(q, h.n, h.d));
    return `<div class="filters">${L.fSel('nhDept', 'Department', ['All departments'].concat(L.depts()), 'All departments')}${L.fSel('nhSt', 'Status', ['All', 'Onboarding', 'Joined'], 'All')}${L.searchBox('nhQ', 'Name or department')}${L.fReset(['nhDept', 'nhSt', 'nhQ'])}<div class="fld"><label>&nbsp;</label><button class="btn pri" onclick="LA.hireNew()">${ic('plus')} Add new hire</button></div></div>`
      + tableCard('New Hires', ['Employee', 'Department', 'Location', 'Joined', 'Status'], rows.map((r) => `<tr><td>${personCell(r.n)}</td><td>${esc(r.d)}</td><td>${L.locChip(r.loc)}</td><td>${fmt(r.on)}</td><td>${r.st === 'Onboarding' ? bdg('s-a', 'Onboarding') : bdg('s-g', 'Joined')}</td></tr>`).join('') || `<tr><td colspan="5">${L.empty('No new hires match')}</td></tr>`);
  }

  /* ---------- wire up ---------- */
  DISPATCH['home/my/overview'] = myOverview;
  DISPATCH['home/my/dashboard'] = myDashboard;
  DISPATCH['home/my/calendar'] = myCalendar;
  DISPATCH['home/team/reportees'] = teamReportees;
  DISPATCH['home/team/approvals'] = approvals;
  DISPATCH['home/team/exemp'] = teamEx;
  DISPATCH['home/org/overview'] = orgOverview;
  DISPATCH['home/org/announcements'] = orgAnnouncements;
  DISPATCH['home/org/policies'] = orgPolicies;
  DISPATCH['home/org/newhires'] = orgNewHires;
  DISPATCH['leave/team/approvals'] = approvals;
  VIEWS.approvals = approvals;
  window.togglePunch2 = () => L.punch();
})();
