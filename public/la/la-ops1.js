/* Leave & Attendance — ACTIVE LAYER · operations (part 1)
   Processing, exceptions, occurrences, discipline, finalize & lock, payroll export, reports, audit logs.
   Every list is scoped by the Location filter and filterable by department / status / date. */
(function () {
  const L = window.LA;
  const { TODAY, fmt, fmtS, addD, parse, pad, esc, daysBetween, hm, range } = L;
  const db = () => L.db();
  const me = () => L.me();
  const R1 = (n) => Math.round(n * 10) / 10;
  const emptyRow = (n, m) => `<tr><td colspan="${n}">${L.empty(m)}</td></tr>`;
  const sc = (arr, key) => arr.filter((x) => L.inLoc(x[key || 'emp']));
  const locsOfScope = () => L.locIds();

  /* ---------- shared list-page helpers (toolbar, search, tables) ---------- */
  const sb = (k, ph) => `<label class="lbar-s">${ic('search')}<input id="sb-${k}" value="${esc(L.ui(k, ''))}" placeholder="${esc(ph)}" oninput="LA.searchInput('${k}',this)"></label>`;
  const rst = (keys) => `<button class="btn sm ghost" onclick="LA.resetUi(${JSON.stringify(keys).replace(/"/g, '&quot;')})">${ic('refresh')} Reset</button>`;
  const bars = (main, sub, count) => listBar(main, count) + (sub ? `<div class="lbar op1-sub">${sub}</div>` : '');
  const tb = (head, rows, msg) => (rows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map((h) => (h[0] === '>' ? `<th class="num">${h.slice(1)}</th>` : `<th>${h}</th>`)).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : L.empty(msg));
  const showing = (x, y, w) => `Showing ${x} of ${y} ${w}`;

  /* ---------- attendance processing ---------- */
  const STEPS = ['Identify employee, company, location & policy', 'Identify shift & time zone', 'Check weekly off & public holiday', 'Retrieve biometric/web/mobile/manual punches', 'Detect duplicates & invalid punches', 'Determine first check-in / last check-out', 'Calculate gross presence hours', 'Deduct breaks → net working hours', 'Apply grace → late & early minutes', 'Check approved leave / on-duty / WFH / permission', 'Determine status & unauthorized absence', 'Calculate approved overtime & comp-off', 'Evaluate deviations & occurrence counters', 'Calculate payroll impact', 'Store breakdown & audit history'];
  const failedPunches = () => db().rawPunches.filter((p) => p.st.startsWith('Failed') && L.hasLoc([p.loc])).length;
  const openEx = () => db().exceptions.filter((e) => e.st === 'Open' && L.inLoc(e.emp)).length;
  const scopeEmps = () => EMP.filter((e) => locsOfScope().includes(e.loc)).length;
  L.runProcessing = (dry) => {
    let i = 0;
    const n = scopeEmps();
    const show = () => openModal(modalShell(dry ? 'Dry run' : `Processing ${n} employees…`,
      `<div class="muted" style="margin-bottom:8px;font-size:12.5px">${esc(L.locLabel())}</div><div class="bar" style="margin-bottom:14px"><i style="width:${Math.round((i / STEPS.length) * 100)}%"></i></div><ol style="list-style:none">${STEPS.map((s, k) => `<li style="display:flex;gap:10px;padding:5px 0;font-size:13px;color:${k < i ? 'var(--ink)' : 'var(--faint)'}"><span style="width:20px;color:${k < i ? 'var(--g)' : 'inherit'}">${k < i ? '✓' : k === i ? '…' : ''}</span>${s}</li>`).join('')}</ol>`,
      `<button class="btn" disabled>${i < STEPS.length ? 'Working…' : 'Done'}</button>`, 'sm'));
    show();
    const t = setInterval(() => {
      i++;
      if (!__$('modalHost')) { clearInterval(t); return; }
      if (i <= STEPS.length) show();
      if (i >= STEPS.length) {
        clearInterval(t);
        const res = { processed: n, exceptions: openEx(), failed: failedPunches(), clean: Math.max(0, n - openEx() - failedPunches()) };
        setTimeout(() => {
          if (!dry) {
            const now = new Date();
            locsOfScope().forEach((loc) => { Object.assign(L.lastRunOf(loc), { at: `${TODAY} ${pad(now.getHours())}:${pad(now.getMinutes())}`, processed: EMP.filter((e) => e.loc === loc).length }); });
            L.audit('Attendance processed', `${n} records`, '—', 'Manual run · ' + L.locLabel());
          }
          openModal(modalShell(dry ? 'Dry run complete' : 'Processing complete',
            `<div class="grid g-2" style="gap:12px"><div><div class="k-val" style="font-size:22px">${res.processed}</div><div class="muted">Processed</div></div><div><div class="k-val" style="font-size:22px;color:var(--a)">${res.exceptions}</div><div class="muted">Open exceptions</div></div><div><div class="k-val" style="font-size:22px;color:var(--r)">${res.failed}</div><div class="muted">Failed records</div></div><div><div class="k-val" style="font-size:22px;color:var(--g)">${res.clean}</div><div class="muted">Clean</div></div></div>${dry ? '<div class="hint" style="margin-top:12px">Dry run — nothing was saved.</div>' : ''}`,
            `<button class="btn" onclick="closeModal()">Close</button>${res.exceptions ? `<button class="btn pri" onclick="closeModal();LA.goOps('exceptions')">Review exceptions</button>` : ''}`, 'sm'));
          if (!dry) L.rr();
        }, 250);
      }
    }, 140);
  };
  L.goOps = (k) => { MODULE = 'operations'; SCOPE = null; TAB = null; OPS = k; renderAll(); };
  function attProcessing() {
    const ids = locsOfScope();
    const lastAt = ids.map((l) => L.lastRunOf(l).at).sort().pop() || '';
    const n = scopeEmps();
    const ex = openEx();
    const fl = failedPunches();
    const q = L.ui('pcQ', '');
    const cals = ids.filter((l) => L.matches(q, L.locName(l), L.locCity(l), L.workLabel(l)));
    return pageHead('Attendance Processing Engine', '15-step calculation pipeline · preserves raw records', `<button class="btn" onclick="LA.runProcessing(true)">Dry run</button><button class="btn pri" onclick="LA.runProcessing(false)">${ic('refresh')} Run for today · ${esc(L.loc() === 'all' ? 'all locations' : L.locCity(L.loc()))}</button>`, 'Attendance')
      + statStrip([
        { lbl: 'Employees in scope', val: n, icon: 'users', tone: 'b', hint: lastAt ? 'Last run ' + esc(lastAt) : 'No run recorded yet' },
        { lbl: 'Clean records', val: Math.max(0, n - ex - fl), icon: 'check', tone: 'g', hint: 'Ready for finalization' },
        { lbl: 'Open exceptions', val: ex, icon: 'alert', tone: ex ? 'a' : 'g', hint: ex ? 'Review before locking' : 'Nothing to review' },
        { lbl: 'Failed punches', val: fl, icon: 'device', tone: fl ? 'r' : 'g', hint: fl ? 'Can be reprocessed' : 'All punches processed' },
      ])
      + `<div class="row"><div style="flex:1.1">${card('Pipeline (FRS §7)', `<ol class="op1-steps">${STEPS.map((s, i) => `<li><span class="op1-sn">${i + 1}</span><span>${s}</span></li>`).join('')}</ol>`, { sub: STEPS.length + ' steps' })}</div>
      <div style="flex:1">${card('Last run', `<div class="op1-kv"><span>Last processed</span><b>${esc(lastAt || '—')}</b></div><div class="op1-kv"><span>Scope</span><b>${esc(L.locLabel())}</b></div><div class="op1-kv"><span>Employees processed</span><b>${n}</b></div><div class="op1-kv"><span>Raw records</span><b>${bdg('s-g', 'Preserved')}</b></div><div class="divider"></div><button class="btn" onclick="LA.goOps('exceptions')">${ic('alert')} Review ${ex} exception${ex === 1 ? '' : 's'}</button>`, { sub: ids.length + ' location' + (ids.length === 1 ? '' : 's') })}
      <div style="height:16px"></div>${card('Work calendars used', listBar(sb('pcQ', 'Search location or work week'), showing(cals.length, ids.length, 'locations')) + tb(['Location', 'Work week & hours', '>Employees', 'Last run'], cals.map((l) => `<tr><td class="fw6">${esc(L.locName(l))}</td><td>${esc(L.workLabel(l))}</td><td class="num">${EMP.filter((e) => e.loc === l).length}</td><td class="muted">${esc(L.lastRunOf(l).at || '—')}</td></tr>`).join(''), 'No locations match'), { pad: false })}
      <div style="height:16px"></div>${note('info', 'Failed biometric records support <b>reprocessing</b>. Every modification preserves the original transaction and writes to the audit log.')}</div></div>`;
  }

  /* ---------- exceptions ---------- */
  function exceptions() {
    const tab = L.ui('exTab', 'all');
    const q = L.ui('exQ2', '');
    const stF = L.ui('exSt', 'Open');
    const base = sc(db().exceptions).filter((e) => L.deptOk(e.emp, 'exDept2') && L.dateOk(e.date, 'exFrom', 'exTo'));
    const open = (g) => base.filter((e) => e.st === 'Open' && (g === 'all' || e.group === g)).length;
    const inSt = (e) => stF === 'All' || e.st === stF;
    const nIn = (g) => base.filter((e) => inSt(e) && (g === 'all' || e.group === g)).length;
    const rows = base.filter((e) => (tab === 'all' || e.group === tab) && inSt(e) && L.matches(q, e.emp, e.kind, e.detail));
    const stPill = (e) => (e.st === 'Open' ? bdg('s-a', 'Open') : e.st === 'Resolved' ? bdg('s-g', 'Resolved') : bdg('s-b', 'Case ' + esc(e.caseId || '')));
    const resolved = base.filter((e) => e.st !== 'Open').length;
    return pageHead('Attendance Exceptions', 'Missing punches, duplicates, invalid records and unauthorized absences', `<button class="btn" onclick="LA.reprocess()">${ic('refresh')} Reprocess failed</button>`, 'Attendance')
      + statStrip([
        { lbl: 'Open exceptions', val: open('all'), icon: 'alert', tone: open('all') ? 'a' : 'g', hint: open('all') ? 'Awaiting HR action' : 'Nothing outstanding' },
        { lbl: 'Missing punches', val: open('miss'), icon: 'clock', tone: open('miss') ? 'a' : 'g', hint: 'Open · manual correction' },
        { lbl: 'Unauthorized absences', val: open('unauth'), icon: 'shield', tone: open('unauth') ? 'r' : 'g', hint: 'Open · may need a case' },
        { lbl: 'Resolved / escalated', val: resolved, icon: 'check', tone: 'g', hint: `of ${base.length} in view` },
      ])
      + card('Exception queue', bars(
        sb('exQ2', 'Search member or exception') + L.chips('exTab', [{ v: 'all', l: 'All', n: nIn('all') }, { v: 'miss', l: 'Missing punch', n: nIn('miss') }, { v: 'unauth', l: 'Unauthorized', n: nIn('unauth') }, { v: 'dup', l: 'Duplicate / invalid', n: nIn('dup') }], 'all'),
        `${L.fSel('exSt', 'Status', ['Open', 'Resolved', 'Case', 'All'], 'Open')}${L.fDept('exDept2')}${L.fDate('exFrom', 'From')}${L.fDate('exTo', 'To')}${rst(['exDept2', 'exSt', 'exFrom', 'exTo', 'exQ2', 'exTab'])}`,
        showing(rows.length, base.length, 'exceptions'))
        + tb(['Member', 'Date', 'Exception', 'Detail', 'Status', 'Action'], rows.map((e) => `<tr><td>${L.empCell(e.emp)}</td><td>${fmt(e.date)}</td><td>${statusBadge(e.kind === 'Duplicate punch' || e.kind === 'Invalid record' ? 'Attendance Pending' : e.kind)}</td><td class="muted">${esc(e.detail)}</td><td>${stPill(e)}</td>
        <td>${e.st !== 'Open' ? '<span class="muted">—</span>' : e.group === 'unauth' ? `<button class="btn sm danger" onclick="LA.caseFromEx('${e.id}')">Create case</button>` : `<button class="btn sm" onclick="LA.manualNew('${esc(e.emp)}','${e.date}')">Manual correct</button>`}</td></tr>`).join(''), 'No exceptions match these filters'), { pad: false })
      + '<div style="height:16px"></div>' + note('warn', 'Manual HR attendance requires a <b>mandatory reason and supporting attachment</b>, and never overwrites the raw record (FRS §5).');
  }
  L.reprocess = () => {
    const f = db().rawPunches.filter((p) => p.st.startsWith('Failed') && L.hasLoc([p.loc]));
    const dup = db().exceptions.filter((e) => e.st === 'Open' && e.group === 'dup' && L.inLoc(e.emp));
    if (!f.length && !dup.length) { toast('Nothing to reprocess'); return; }
    f.forEach((p) => { p.st = 'Processed'; });
    dup.forEach((e) => { e.st = 'Resolved'; });
    L.audit('Reprocess failed records', `${f.length + dup.length} record(s)`, 'Failed → Processed', 'HR reprocess · ' + L.locLabel());
    toast(`Reprocessed ${f.length} failed punch(es) and resolved ${dup.length} duplicate/invalid record(s)`); L.rr();
  };
  L.caseFromEx = (id) => {
    const e = db().exceptions.find((x) => x.id === id);
    if (!e) return;
    const caseId = 'DC-' + L.nextId('DC').split('-')[1];
    db().cases.unshift({ id: caseId, emp: e.emp, trigger: `${e.kind} · ${fmt(e.date)}`, rec: 'First Written Warning', note: e.detail, st: 'Pending', decision: '', ref: '' });
    e.st = 'Case'; e.caseId = caseId;
    const o = db().occ.find((x) => x.emp === e.emp && x.type === 'Unauthorized Absence');
    if (o) { o.count += 1; o.action = recommend(o); }
    L.audit('Disciplinary case created', caseId, '—', `${e.emp} · ${e.kind}`, L.locOf(e.emp));
    toast(`${caseId} created for ${e.emp}`); L.rr();
  };
  window.filterExceptions = (k) => L.setUi('exTab', k);

  /* ---------- occurrences ---------- */
  const GEN = [[10, 'Termination Review'], [8, 'Final Written Warning'], [6, 'Second Written Warning'], [3, 'First Written Warning'], [2, 'Verbal Warning']];
  const UNAUTH = [[4, 'Termination Review'], [3, 'Final Written Warning'], [2, 'Second Written Warning'], [1, 'First Written Warning']];
  const recommend = (o) => { const n = o.count - o.waived; const t = (o.type === 'Unauthorized Absence' ? UNAUTH : GEN).find((x) => n >= x[0]); return t ? t[1] + ' (recommended)' : n / o.thr >= 0.7 ? 'Approaching occurrence' : n > 0 ? 'Under watch' : 'OK'; };
  const occCls = (o) => { const n = o.count - o.waived; return n >= o.thr ? 's-r' : n / o.thr >= 0.7 ? 's-a' : 's-gray'; };
  const OCC_TYPES = ['Unscheduled Late Login', 'Unscheduled Early Departure', 'Unauthorized Absence', 'Pattern Absence', 'Recurring Scheduled Late Login'];
  function occurrenceMgmt() {
    const q = L.ui('ocQ', '');
    const tF = L.ui('ocType', 'All types');
    const lv = L.ui('ocLvl', 'all');
    const base = sc(db().occ).filter((o) => L.deptOk(o.emp, 'ocDept'));
    const lvl = (o) => (o.count - o.waived >= o.thr ? 'over' : occCls(o) === 's-a' ? 'near' : 'watch');
    const typed = base.filter((o) => tF === 'All types' || o.type === tF);
    const nL = (v) => typed.filter((o) => v === 'all' || lvl(o) === v).length;
    const rows = typed.filter((o) => (lv === 'all' || lvl(o) === lv) && L.matches(q, o.emp, o.type, o.id));
    const members = new Set(base.map((o) => o.emp)).size;
    return pageHead('Occurrence Management', 'Create, waive and monitor occurrences against thresholds', `<button class="btn pri" onclick="LA.occNew()">${ic('plus')} Record occurrence</button>`, 'Compliance')
      + statStrip([
        { lbl: 'Tracked counters', val: base.length, icon: 'chart', tone: 'b', hint: `${members} member${members === 1 ? '' : 's'}` },
        { lbl: 'At / over threshold', val: base.filter((o) => lvl(o) === 'over').length, icon: 'shield', tone: base.some((o) => lvl(o) === 'over') ? 'r' : 'g', hint: 'Action recommended' },
        { lbl: 'Near threshold', val: base.filter((o) => lvl(o) === 'near').length, icon: 'alert', tone: 'a', hint: '70% or more of the limit' },
        { lbl: 'Waived', val: base.reduce((a, o) => a + (o.waived || 0), 0), icon: 'check', tone: 'g', hint: 'Occurrences waived by HR' },
      ])
      + card('Occurrences (rolling 12 months)', bars(
        sb('ocQ', 'Search member or type') + L.chips('ocLvl', [{ v: 'all', l: 'All', n: nL('all') }, { v: 'over', l: 'At / over', n: nL('over') }, { v: 'near', l: 'Near', n: nL('near') }, { v: 'watch', l: 'Under watch', n: nL('watch') }], 'all'),
        `${L.fSel('ocType', 'Deviation type', ['All types'].concat(OCC_TYPES), 'All types')}${L.fDept('ocDept')}${rst(['ocDept', 'ocType', 'ocLvl', 'ocQ'])}`,
        showing(rows.length, base.length, 'counters'))
        + tb(['Member', 'Type', '>Count', '>Threshold', 'Recommended action', 'Manage'], rows.map((o) => { const n = o.count - o.waived; const pct = Math.min(100, Math.round((n / (o.thr || 1)) * 100)); return `<tr><td>${L.empCell(o.emp)}</td><td>${esc(o.type)}</td><td class="num"><span class="fw6">${n}</span>${o.waived ? ` <span class="muted" style="font-weight:400">(−${o.waived} waived)</span>` : ''}<div class="op1-meter"><i class="${occCls(o)}" style="width:${pct}%"></i></div></td><td class="num">${o.thr}</td><td>${bdg(occCls(o), esc(recommend(o)))}</td>
        <td><div class="hb"><button class="btn sm" onclick="LA.occAdd('${esc(o.emp)}','${esc(o.type)}')">Create</button><button class="btn sm ghost" onclick="LA.occWaive('${esc(o.emp)}','${esc(o.type)}')" ${n <= 0 ? 'disabled' : ''}>Waive</button></div></td></tr>`; }).join(''), 'No occurrences match these filters'), { pad: false })
      + '<div style="height:16px"></div><div class="row"><div style="flex:1">'
      + tableCard('General deviation thresholds', ['Occurrences (12 mo)', 'Recommended action'], [['2', 'Verbal Warning'], ['3', 'First Written Warning'], ['6', 'Second Written Warning'], ['8', 'Final Written Warning'], ['10', 'Termination Review']].map((r) => `<tr><td class="num">${r[0]}</td><td>${r[1]}</td></tr>`).join(''))
      + '</div><div style="flex:1">' + tableCard('Unauthorized absence thresholds', ['Occurrences', 'Recommended action'], [['1', 'First Written Warning'], ['2', 'Second Written Warning'], ['3', 'Final Written Warning'], ['4', 'Termination Review']].map((r) => `<tr><td class="num">${r[0]}</td><td>${r[1]}</td></tr>`).join('')) + '</div></div>'
      + '<div style="height:16px"></div>' + note('warn', `Occurrence counter reset rule and warning validity window are ${phFlag(L.confOf(L.oneLoc('polLoc')).reset ? 'Set: ' + esc(L.confOf(L.oneLoc('polLoc')).reset) : 'HR confirmation pending')} (FRS §28).`);
  }
  L.occAdd = (emp, type) => { const o = db().occ.find((x) => x.emp === emp && x.type === type); if (!o) return; o.count += 1; o.action = recommend(o); L.audit('Occurrence created', `${emp} · ${type}`, `${o.count - 1 - o.waived} → ${o.count - o.waived}`, 'HR', L.locOf(emp)); toast(`Occurrence recorded for ${emp}`); L.rr(); };
  L.occNew = () => L.form({
    title: 'Record occurrence', size: 'sm', submit: 'Record',
    fields: [{ k: 'emp', label: 'Employee', req: true, type: 'select', options: L.empIn().map((e) => ({ v: e.n, l: `${e.n} · ${e.id} · ${L.locCity(e.loc)}` })), full: true }, { k: 'type', label: 'Deviation type', req: true, type: 'select', options: OCC_TYPES, full: true }, { k: 'reason', label: 'Reason', req: true, type: 'textarea', full: true }],
    onSubmit: (v) => {
      let o = db().occ.find((x) => x.emp === v.emp && x.type === v.type);
      if (!o) { o = { emp: v.emp, id: L.codeOf(v.emp), type: v.type, count: 0, thr: { 'Unscheduled Late Login': 6, 'Unscheduled Early Departure': 3, 'Unauthorized Absence': 1, 'Pattern Absence': 5, 'Recurring Scheduled Late Login': 7 }[v.type], waived: 0, action: '' }; db().occ.push(o); }
      o.count += 1; o.action = recommend(o);
      L.audit('Occurrence created', `${v.emp} · ${v.type}`, `→ ${o.count - o.waived}`, v.reason, L.locOf(v.emp)); toast('Occurrence recorded'); L.rr();
    },
  });
  L.occWaive = (emp, type) => L.form({
    title: 'Waive occurrence — ' + emp, size: 'sm', submit: 'Waive', pre: note('warn', 'Waiving requires a reason and is audited.'),
    fields: [{ k: 'reason', label: 'Waiver reason', req: true, type: 'textarea', full: true }],
    onSubmit: (v) => { const o = db().occ.find((x) => x.emp === emp && x.type === type); if (!o || o.count - o.waived <= 0) return; o.waived += 1; o.action = recommend(o); L.audit('Occurrence waived', `${emp} · ${type}`, `${o.count - o.waived + 1} → ${o.count - o.waived}`, v.reason, L.locOf(emp)); toast('Occurrence waived'); L.rr(); },
  });
  window.openWaiveModal = (e) => L.occWaive(e, (db().occ.find((o) => o.emp === e) || {}).type);

  /* ---------- discipline ---------- */
  function discipline() {
    const q = L.ui('dcQ', '');
    const sF = L.ui('dcSt', 'All');
    const base = sc(db().cases).filter((c) => L.deptOk(c.emp, 'dcDept'));
    const pend = (c) => c.st === 'Pending';
    const waived = (c) => c.st === 'Done' && String(c.decision || '').startsWith('Waive');
    const nS = (v) => base.filter((c) => v === 'All' || (v === 'Pending') === pend(c)).length;
    const rows = base.filter((c) => (sF === 'All' || (sF === 'Pending') === pend(c)) && L.matches(q, c.id, c.emp, c.trigger, c.rec));
    return pageHead('Disciplinary Review Cases', 'Recommendations only — HR confirmation is mandatory, no automated termination', '', 'Compliance')
      + statStrip([
        { lbl: 'Total cases', val: base.length, icon: 'scale', tone: 'b', hint: 'In the selected scope' },
        { lbl: 'Pending HR decision', val: nS('Pending'), icon: 'clock', tone: nS('Pending') ? 'a' : 'g', hint: nS('Pending') ? 'Awaiting confirmation' : 'Queue is clear' },
        { lbl: 'Warnings issued', val: base.filter((c) => c.st === 'Done' && !waived(c)).length, icon: 'alert', tone: 'r', hint: 'Decided by HR' },
        { lbl: 'Waived', val: base.filter(waived).length, icon: 'check', tone: 'g', hint: 'No action taken' },
      ])
      + note('warn', 'The system <b>never automatically terminates</b> an employee. Each case captures manager comments, HR decision, warning reference, waiver option and full audit history (FRS §10).')
      + '<div style="height:16px"></div>'
      + card('Review cases', bars(
        sb('dcQ', 'Search case, member or trigger') + L.chips('dcSt', [{ v: 'All', l: 'All', n: nS('All') }, { v: 'Pending', l: 'Pending', n: nS('Pending') }, { v: 'Decided', l: 'Decided', n: nS('Decided') }], 'All'),
        `${L.fDept('dcDept')}${rst(['dcDept', 'dcSt', 'dcQ'])}`,
        showing(rows.length, base.length, 'cases'))
        + tb(['Case', 'Member', 'Trigger', 'Recommended', 'Manager note', 'HR decision'], rows.map((r) => `<tr><td class="fw6 mono">${esc(r.id)}</td><td>${L.empCell(r.emp)}</td><td>${esc(r.trigger)}</td><td>${bdg('s-a', esc(r.rec))}</td><td class="muted">${esc(r.note)}</td>
        <td>${r.st === 'Done' ? `<span title="${esc(r.decision)}">${bdg('s-g', waived(r) ? 'Waived' : 'Warning issued')}</span>${r.ref ? ` <span class="mono muted" style="font-size:11.5px">${esc(r.ref)}</span>` : ''}` : `<div class="hb"><button class="btn sm ok" onclick="LA.caseDecide('${r.id}','confirm')">Confirm</button><button class="btn sm ghost" onclick="LA.caseDecide('${r.id}','waive')">Waive</button></div>`}</td></tr>`).join(''), 'No cases match these filters'), { pad: false });
  }
  L.caseDecide = (id, kind) => {
    const c = db().cases.find((x) => x.id === id);
    if (!c) return;
    L.form({
      title: 'HR decision — ' + id, size: 'sm', submit: 'Record decision', pre: note('warn', 'No termination is automated. Records HR decision, warning reference and audit.'),
      fields: [{ k: 'dec', label: 'Decision', req: true, type: 'select', options: ['Issue recommended warning', 'Downgrade action', 'Waive — no action'], value: kind === 'waive' ? 'Waive — no action' : 'Issue recommended warning', full: true }, { k: 'ref', label: 'Warning reference', type: 'text', ph: 'WRN-2026-014', full: true }, { k: 'notes', label: 'HR notes', req: true, type: 'textarea', full: true }],
      validate: (v) => (v.dec !== 'Waive — no action' && !v.ref ? ['A warning reference is required when a warning is issued.'] : []),
      onSubmit: (v) => { c.st = 'Done'; c.decision = v.dec; c.ref = v.ref; c.hrNote = v.notes; L.audit('HR decision recorded', id, 'Pending → ' + v.dec, v.notes, L.locOf(c.emp)); toast(`Decision recorded for ${id}`); L.rr(); },
    });
  };
  window.openDecisionModal = (id, k) => L.caseDecide(id, k);

  /* ---------- finalize & lock (payroll periods are per location) ---------- */
  const periodRow = (loc, key) => L.periodsOf(loc).find((p) => p.key === key);
  const exOf = (loc) => db().exceptions.filter((e) => e.st === 'Open' && L.locOf(e.emp) === loc).length;
  const allRows = () => locsOfScope().flatMap((loc) => L.periodsOf(loc).map((p) => ({ loc, p })));
  const medPending = () => db().med.filter((m) => m.st === 'Pending' && L.inLoc(m.emp)).length;
  function finalization() {
    const all = allRows();
    const open = all.filter((r) => r.p.status === 'Open');
    const eom = parse(`${TODAY.slice(0, 7)}-01`); eom.setMonth(eom.getMonth() + 1); eom.setDate(0);
    const cutoff = daysBetween(TODAY, L.iso(eom)) + 1;
    const sF = L.ui('fnSt', 'All');
    const q = L.ui('fnQ', '');
    const nS = (v) => all.filter((r) => v === 'All' || r.p.status === v).length;
    const rows = all.filter((r) => (sF === 'All' || r.p.status === sF) && L.matches(q, L.locCity(r.loc), L.locName(r.loc), r.p.name));
    const ex = openEx();
    return pageHead('Finalize & Lock Attendance', 'Lock the monthly period before payroll export — each location has its own payroll cycle', `<button class="btn danger" onclick="LA.reopenDlg()">${ic('lockOpen')} Reopen period</button><button class="btn pri" onclick="LA.lockDlg()" ${open.length ? '' : 'disabled'}>${ic('lock')} ${open.length === 1 ? 'Lock ' + esc(open[0].p.name) + ' · ' + esc(L.locCity(open[0].loc)) : open.length ? 'Lock a period…' : 'No open period'}</button>`, 'Payroll & Output')
      + statStrip([
        { lbl: 'Finalized records', val: Math.max(0, scopeEmps() - ex), icon: 'check', tone: 'g', hint: 'Clean and ready for lock' },
        { lbl: 'Open exceptions', val: ex, icon: 'alert', tone: ex ? 'a' : 'g', hint: ex ? 'Resolve or override at lock' : 'Nothing blocking the lock' },
        { lbl: 'Pending verification', val: medPending(), icon: 'doc', tone: medPending() ? 'b' : 'g', hint: 'Medical documents' },
        { lbl: 'Days to cut-off', val: cutoff, icon: 'lock', tone: 'p', hint: 'Month end ' + fmt(L.iso(eom)) },
      ])
      + note('warn', 'Monthly attendance must be locked before payroll export. Any post-lock change requires <b>HR authorization, a reopening reason, audit history</b> and current/next-cycle adjustment (FRS §20).')
      + '<div style="height:16px"></div>'
      + card('Period readiness', bars(
        sb('fnQ', 'Search location or period') + L.chips('fnSt', [{ v: 'All', l: 'All', n: nS('All') }, { v: 'Open', l: 'Open', n: nS('Open') }, { v: 'Locked', l: 'Locked', n: nS('Locked') }, { v: 'Not started', l: 'Not started', n: nS('Not started') }], 'All'),
        '', showing(rows.length, all.length, 'periods'))
        + tb(['Location', 'Period', '>Records', '>Exceptions', 'Status', 'Action'], rows.map(({ loc, p }) => { const xo = p.status === 'Open' ? exOf(loc) : p.status === 'Locked' ? 0 : null; return `<tr><td class="fw6">${esc(L.locCity(loc))}</td><td>${esc(p.name)}</td><td class="num">${p.status === 'Not started' ? '<span class="muted">—</span>' : EMP.filter((e) => e.loc === loc).length}</td><td class="num">${xo === null ? '<span class="muted">—</span>' : `<span style="${xo ? 'color:var(--a);font-weight:600' : ''}">${xo}</span>`}</td><td>${p.status === 'Locked' ? bdg('s-g', 'Locked') : p.status === 'Open' ? bdg('s-a', 'Open') : bdg('s-gray', 'Not started')}</td>
        <td>${p.status === 'Open' ? `<button class="btn sm pri" onclick="LA.lockDlg('${loc}','${p.key}')">Lock</button>` : p.status === 'Locked' ? `<button class="btn sm ghost" onclick="LA.setUiRaw('payLoc','${loc}');LA.setUiRaw('payPeriod','${p.key}');LA.goOps('payroll')">Export</button>` : `<button class="btn sm ghost" onclick="LA.openPeriodDlg('${loc}','${p.key}')" ${L.periodsOf(loc).some((x) => x.status === 'Open') ? 'disabled' : ''}>Open period</button>`}</td></tr>`; }).join(''), 'No periods match these filters'), { pad: false });
  }
  L.openPeriodDlg = (loc, key) => L.confirm('Open period', `Start attendance collection for <b>${periodRow(loc, key).name}</b> (${esc(L.locName(loc))})?`, 'Open period', () => { const p = periodRow(loc, key); p.status = 'Open'; L.audit('Period opened', p.name, 'Not started → Open', L.locCity(loc), loc); toast(p.name + ' opened'); L.rr(); });
  const pick = (kind, rows, run) => {
    if (rows.length === 1) return run(rows[0]);
    return L.form({ title: kind + ' period', size: 'sm', submit: 'Continue', fields: [{ k: 'r', label: 'Location · period', req: true, type: 'select', options: rows.map((r, i) => ({ v: i, l: `${L.locCity(r.loc)} · ${r.p.name}` })), full: true }], onSubmit: (v) => { closeModal(); setTimeout(() => run(rows[Number(v.r)]), 280); return false; } });
  };
  L.lockDlg = (loc, key) => {
    const rows = loc ? [{ loc, p: periodRow(loc, key) }] : allRows().filter((r) => r.p.status === 'Open');
    if (!rows.length || !rows[0].p || rows[0].p.status !== 'Open') { toast('No open period to lock'); return; }
    pick('Lock', rows, ({ loc: lc, p }) => {
      const ex = exOf(lc);
      L.form({
        title: `Lock ${p.name} · ${L.locCity(lc)}`, size: 'sm', submit: 'Lock period',
        pre: note('warn', 'Locking finalizes attendance for payroll. Post-lock changes require reopening with a reason.') + (ex ? note('warn', `<b>${ex} open exception${ex > 1 ? 's' : ''}</b> remain unresolved in ${esc(L.locCity(lc))}.`) : ''),
        fields: [...(ex ? [{ k: 'ack', label: `Lock with ${ex} open exception(s)?`, type: 'select', options: ['No — go back and resolve', 'Yes — HR override'], full: true }] : []), { k: 'confirm', label: 'Confirmation', req: true, type: 'text', ph: 'Type LOCK to confirm', full: true }],
        validate: (v) => { const e = []; if (v.confirm !== 'LOCK') e.push('Type LOCK (capitals) to confirm.'); if (ex && !String(v.ack).startsWith('Yes')) e.push('Resolve the open exceptions, or choose the HR override.'); return e; },
        onSubmit: (v) => { p.status = 'Locked'; L.audit('Period locked', p.name, 'Open → Locked', ex ? `HR override · ${ex} open exceptions` : 'Payroll cut-off', lc); toast(`${p.name} locked · ${L.locCity(lc)}`); L.rr(); },
      });
    });
  };
  L.reopenDlg = () => {
    const rows = allRows().filter((r) => r.p.status === 'Locked');
    if (!rows.length) { toast('No locked period to reopen'); return; }
    L.form({
      title: 'Reopen locked period', size: 'sm', submit: 'Reopen', danger: true, pre: note('warn', 'Requires HR authorization, a reason and a payroll adjustment. Fully audited.'),
      fields: [{ k: 'p', label: 'Location · period', req: true, type: 'select', options: rows.map((r, i) => ({ v: i, l: `${L.locCity(r.loc)} · ${r.p.name}` })), full: true }, { k: 'reason', label: 'Reopening reason', req: true, type: 'textarea', full: true }],
      onSubmit: (v) => { const r = rows[Number(v.p)]; r.p.status = 'Open'; L.audit('Period reopened', r.p.name, 'Locked → Open', v.reason, r.loc); toast(`${r.p.name} reopened & audited`); L.rr(); },
    });
  };
  window.openLockModal = () => L.lockDlg();
  window.openReopenModal = () => L.reopenDlg();

  /* ---------- payroll export (per location: its own employees, period and currency) ---------- */
  const monthDays = (key) => { const [y, m] = key.split('-').map(Number); return range(`${key}-01`, `${key}-${pad(new Date(y, m, 0).getDate())}`); };
  const holIn = (d, loc) => db().hol.some((h) => d >= h.d && d <= (h.to || h.d) && (!h.locs || h.locs.includes('all') || h.locs.includes(loc)));
  function payrollRows(key, loc) {
    const days = monthDays(key);
    const ws = days.filter((d) => !L.isOff(d, loc) && !holIn(d, loc));
    const sched = ws.length;
    return EMP.filter((e) => e.loc === loc && L.deptOk(e.n, 'payDept')).map((e) => {
      const n = e.n;
      let present = 0; let leave = 0; let lop = 0;
      ws.forEach((d) => {
        if (d > TODAY) return;
        if (n === me()) { const r = L.dayRec(d); if (r.kind === 'present' || r.kind === 'missing') present++; else if (r.kind === 'leave') { if (/Unpaid|Loss/.test(r.st)) lop++; else leave++; } else if (r.kind === 'absent') lop++; return; }
        const t = L.teamDay(d).find((x) => x.n === n);
        if (!t) return;
        if (['Present', 'Late Login', 'Approved Late Login', 'Unscheduled Late Login', 'Work from Home'].includes(t.st)) present++;
        else if (/Leave|Festive/.test(t.st)) leave++;
        else if (/Absent|Unauthorized/.test(t.st)) lop++;
      });
      const remaining = ws.filter((d) => d > TODAY).length;
      const ot = db().ots.filter((o) => o.emp === n && o.st === 'Approved' && o.date.startsWith(key)).reduce((a, o) => a + o.hours, 0);
      const comp = db().ots.filter((o) => o.emp === n && o.st === 'Approved' && o.comp === 'Compensatory off' && o.date.startsWith(key)).reduce((a, o) => a + L.otCredit(o), 0);
      const enc = db().enc.filter((x) => x.emp === n && x.hr === 'Approved').reduce((a, x) => a + x.days, 0);
      return [n, sched, present, present + leave + remaining, lop, R1(ot), R1(comp), enc, Math.max(0, sched - lop)];
    });
  }
  const payCtx = () => {
    const loc = L.oneLoc('payLoc');
    const periods = L.periodsOf(loc).filter((p) => p.status !== 'Not started');
    const key = periods.some((p) => p.key === L.ui('payPeriod', '')) ? L.ui('payPeriod', '') : (periods.find((p) => p.status === 'Open') || periods[periods.length - 1] || { key: TODAY.slice(0, 7) }).key;
    return { loc, periods, key, per: periodRow(loc, key) || { name: key, status: 'Open' } };
  };
  function payrollExport() {
    const { loc, periods, key, per } = payCtx();
    const rows = payrollRows(key, loc);
    const locked = per.status === 'Locked';
    const cur = (L.locDef(loc) || {}).currency || '';
    const q = L.ui('payQ', '');
    const shown = rows.filter((r) => L.matches(q, r[0], L.codeOf(r[0])));
    const sum = (i) => R1(rows.reduce((a, r) => a + (Number(r[i]) || 0), 0));
    return pageHead('Payroll Export', 'Payroll-ready attendance, leave, LOP, overtime and encashment output', `<button class="btn" onclick="LA.payCsv()">${ic('download')} CSV</button><button class="btn pri" onclick="LA.payExport()">${ic('lock')} ${locked ? 'Export to payroll' : 'Lock & export'}</button>`, 'Payroll & Output')
      + statStrip([
        { lbl: 'Employees', val: rows.length, icon: 'users', tone: 'b', hint: `${esc(per.name)} · ${esc(per.status)}` },
        { lbl: 'Payable days', val: sum(8), icon: 'calendar', tone: 'g', hint: 'Scheduled less loss of pay' },
        { lbl: 'Loss-of-pay days', val: sum(4), icon: 'alert', tone: sum(4) ? 'r' : 'g', hint: sum(4) ? 'Deducted at payroll' : 'No deductions' },
        { lbl: 'Overtime hours', val: sum(5), icon: 'clock', tone: 'a', hint: `${sum(6)} comp-off day(s)` },
      ])
      + note('info', `${esc(per.name)} (${esc(L.locName(loc))}) must be locked before export. Payroll currency <b>${esc(cur)}</b>. Status: ${locked ? bdg('s-g', 'Locked') : bdg('s-a', esc(per.status))}`)
      + '<div style="height:16px"></div>'
      + card(`Payroll output preview — ${esc(per.name)} · ${esc(L.locCity(loc))}`, bars(
        sb('payQ', 'Search member or code'),
        `${L.fSel('payLoc', 'Payroll location', L.locOptions(false), loc)}${L.fSel('payPeriod', 'Period', periods.map((p) => ({ v: p.key, l: `${p.name} (${p.status})` })), key)}${L.fDept('payDept')}${rst(['payDept', 'payQ'])}`,
        showing(shown.length, rows.length, 'employees') + ` · ${(db().exports || []).filter((x) => x.loc === loc).length} previous export(s)`)
        + tb(['Member', '>Sched.', '>Present', '>Paid', '>LOP', '>OT h', '>Comp-off', '>Encash', '>Payable'], shown.map((r) => `<tr><td>${L.empCell(r[0], L.codeOf(r[0]))}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td class="num" style="color:${r[4] ? 'var(--r)' : ''}">${r[4]}</td><td class="num">${r[5]}</td><td class="num">${r[6]}</td><td class="num">${r[7]}</td><td class="num fw6">${r[8]}</td></tr>`).join(''), rows.length ? 'No employees match this search' : 'No employees in this location / department'), { pad: false })
      + '<div style="height:16px"></div>' + note('info', 'This is a link-out boundary to the <b>Payroll Management</b> module — computed values are handed off, not re-implemented here.');
  }
  L.payCsv = () => { const { loc, key } = payCtx(); L.csv(`payroll_attendance_${loc}_${key}.csv`, ['Member', 'Scheduled', 'Present', 'Paid', 'LOP', 'OT hours', 'Comp-off', 'Encash', 'Payable'], payrollRows(key, loc)); };
  L.payExport = () => {
    const { loc, key, per } = payCtx();
    if (per.status !== 'Locked') { L.confirm('Lock required', `${per.name} (${esc(L.locCity(loc))}) is <b>${per.status}</b>. Lock it now and export?`, 'Lock period', () => L.lockDlg(loc, key)); return; }
    (db().exports ||= []).push({ key, loc, on: TODAY });
    L.audit('Payroll exported', per.name, '—', 'Handed to Payroll Management', loc);
    L.payCsv(); L.rr();
  };

  /* ---------- reports ---------- */
  const period = () => { const f = L.ui('rpFrom', `${TODAY.slice(0, 7)}-01`); const t = L.ui('rpTo', TODAY); return [f, t < f ? f : t]; };
  const dayRange = () => range(period()[0], period()[1] > TODAY ? TODAY : period()[1]);
  const wd = (d, loc) => !L.isOff(d, loc);
  const td = (d) => L.teamDay(d).filter((t) => L.inLoc(t.n) && L.deptOk(t.n, 'rpDept'));
  const S = (arr) => arr.filter((x) => L.inLoc(x.emp) && L.deptOk(x.emp, 'rpDept'));
  const staff = () => EMP.filter((e) => L.inLoc(e.n) && L.deptOk(e.n, 'rpDept'));
  const GENS = {
    'Daily & monthly attendance': () => ({ head: ['Employee', 'Location', 'Present', 'Leave', 'Absent', 'Late'], rows: staff().map((e) => { let p = 0; let l = 0; let a = 0; let lt = 0; dayRange().filter((d) => wd(d, e.loc)).forEach((d) => { const t = L.teamDay(d).find((x) => x.n === e.n); if (!t) return; if (['Present', 'Work from Home', 'Late Login', 'Unscheduled Late Login'].includes(t.st)) p++; else if (/Leave|Festive/.test(t.st)) l++; else if (/Absent|Unauth/.test(t.st)) a++; if (/Late/.test(t.st)) lt++; }); return [e.n, L.locCity(e.loc), p, l, a, lt]; }) }),
    'Scheduled / unscheduled late login': () => ({ head: ['Date', 'Employee', 'Location', 'Type', 'Minutes late'], rows: dayRange().flatMap((d) => td(d).filter((t) => /Late/.test(t.st)).map((t) => [d, t.n, L.locCity(t.loc), t.st.includes('Unsch') ? 'Unscheduled' : 'Scheduled', t.late])).concat(S(db().regs).filter((r) => r.kind === 'Scheduled Late Login').map((r) => [r.date, r.emp, L.locCity(L.locOf(r.emp)), 'Scheduled (' + r.st + ')', '—'])) }),
    'Scheduled / unscheduled early departure': () => ({ head: ['Date', 'Employee', 'Type', 'Status'], rows: S(db().regs).filter((r) => r.kind === 'Early Departure').map((r) => [r.date, r.emp, 'Early departure', r.st]).concat(S(db().occ).filter((o) => /Early/.test(o.type)).map((o) => [TODAY, o.emp, o.type, o.count + ' occurrence(s)'])) }),
    'Unauthorized & pattern absence': () => ({ head: ['Employee', 'Type', 'Date / count', 'Status'], rows: S(db().exceptions).filter((e) => e.group === 'unauth').map((e) => [e.emp, e.kind, e.date, e.st]).concat(S(db().occ).filter((o) => /Pattern|Unauth/.test(o.type)).map((o) => [o.emp, o.type, o.count - o.waived + ' of ' + o.thr, recommend(o)])) }),
    'Recurring scheduled absence': () => ({ head: ['Employee', 'Type', 'Count', 'Threshold'], rows: S(db().occ).filter((o) => /Recurring/.test(o.type)).map((o) => [o.emp, o.type, o.count - o.waived, o.thr]) }),
    'Missing punches & regularization': () => ({ head: ['Ref', 'Employee', 'Date', 'Detail', 'Status'], rows: S(db().exceptions).filter((e) => e.group === 'miss').map((e) => [e.id, e.emp, e.date, e.kind + ' — ' + e.detail, e.st]).concat(S(db().regs).filter((r) => r.kind === 'Regularization').map((r) => [r.id, r.emp, r.date, r.detail, r.st])) }),
    'Working hours, breaks & overtime': () => ({ head: ['Date', 'Employee', 'Hours', 'Overtime (h)'], rows: L.inLoc(me()) ? dayRange().filter((d) => wd(d)).map((d) => { const r = L.dayRec(d); return [d, me(), hm(r.total), r.dev > 0 ? hm(r.dev) : '00:00']; }) : [] }),
    'Weekend & public-holiday work': () => ({ head: ['Date', 'Employee', 'Hours', 'Compensation', 'Status'], rows: S(db().ots).filter((o) => /Weekend/.test(o.cat)).map((o) => [o.date, o.emp, o.hours, o.comp, o.st]) }),
    'Occurrence & disciplinary threshold': () => ({ head: ['Employee', 'Type', 'Count', 'Threshold', 'Recommendation', 'Case'], rows: S(db().occ).map((o) => [o.emp, o.type, o.count - o.waived, o.thr, recommend(o), (db().cases.find((c) => c.emp === o.emp) || {}).id || '—']) }),
    'Probation attendance': () => ({ head: ['Employee', 'Location', 'Joined', 'Department', 'Days present (period)'], rows: L.org().employees.filter((e) => (e.status === 'Onboarding' || e.doj >= addD(TODAY, -180)) && L.inLoc(e.name) && L.deptOk(e.name, 'rpDept')).map((e) => [e.name, L.locCity(e.location), e.doj, e.department, dayRange().filter((d) => d >= e.doj && wd(d, e.location)).length]) }),
    'Attendance KPI report': () => { const all = dayRange().flatMap((d) => td(d)); const pres = all.filter((t) => ['Present', 'Work from Home', 'Late Login', 'Unscheduled Late Login'].includes(t.st)).length; const sch = all.filter((t) => !['Weekly Off', 'Public Holiday', 'Not Yet Joined', '—'].includes(t.st)).length; return { head: ['KPI', 'Value'], rows: [['Attendance rate', sch ? R1((pres / sch) * 100) + '%' : '—'], ['Open exceptions', openEx()], ['Pending approvals', L.pendingApprovals()], ['Late logins', all.filter((t) => /Late/.test(t.st)).length], ['Unauthorized absences', all.filter((t) => /Unauth|Absent/.test(t.st)).length]] }; },
    'Annual leave balance / accrual / plan': () => ({ head: ['Item', 'Value'], rows: L.inLoc(me()) ? [['Available', L.availOf(db().bal[L.annualKey()])], ['Booked', db().bal[L.annualKey()].booked], ['Pending', db().bal[L.annualKey()].pending], ...S(db().plans).filter((p) => p.emp === me()).map((p) => [`Segment ${p.seg} (${p.st})`, `${p.from} → ${p.to}`])] : [] }),
    'Segments, carry forward, expiry & encashment': () => ({ head: ['Employee', 'Item', 'Detail', 'Status'], rows: S(db().plans).map((p) => [p.emp, 'Segment ' + p.seg, `${p.from} → ${p.to}`, p.st]).concat(S(db().cf).map((c) => [c.emp, 'Carry forward', `${c.days} d · expires ${c.expires}`, c.st])).concat(S(db().enc).map((e) => [e.emp, 'Encashment', `${e.days} d`, `Mgr ${e.mgr} / HR ${e.hr}`])) }),
    'Sick-leave instances & pay tiers': () => ({ head: ['Employee', 'Ref', 'Period', 'Days', 'Instance', 'Pay tier'], rows: S(db().leaves).filter((l) => l.type === 'Sick Leave').map((l, i) => [l.emp, l.id, `${l.from} → ${l.to}`, l.days, i + 1, L.tplOf(L.locOf(l.emp)) === 'india' ? 'Full pay' : i < 2 ? 'Full pay' : i < 4 ? 'Half pay' : 'Unpaid']) }),
    'Missing certificates': () => ({ head: ['Employee', 'Ref', 'Requirement', 'Status'], rows: S(db().med).filter((m) => m.doc === 'Missing' || m.st === 'Pending').map((m) => [m.emp, m.leave || m.id, m.req, m.doc === 'Missing' ? 'Missing' : 'Awaiting verification']) }),
    'Maternity / parental / compassionate': () => ({ head: ['Employee', 'Type', 'Detail', 'Status'], rows: S(db().mat).map((m) => [m.emp, m.type, `${m.full}F + ${m.half}H + ${m.unpaid}U`, m.st]).concat(S(db().par).map((p) => [p.emp, 'Parental', p.ent, p.st])).concat(S(db().leaves).filter((l) => /Compassionate|Bereavement/.test(l.type)).map((l) => [l.emp, l.type, `${l.from} (${l.days}d)`, l.st])) }),
    'Hajj history & study eligibility': () => ({ head: ['Employee', 'Type', 'Period', 'Status'], rows: S(db().leaves).filter((l) => /Hajj|Study/.test(l.type)).map((l) => [l.emp, l.type, `${l.from} → ${l.to}`, l.st]).concat(L.inLoc(me()) ? [[me(), 'Study eligibility', '≥ 2 years service', 'Eligible']] : []) }),
    'Restricted holiday': () => ({ head: ['Employee', 'Ref', 'Date', 'Status'], rows: S(db().leaves).filter((l) => /Restricted|Casual/.test(l.type)).map((l) => [l.emp, l.id, l.from, l.st]) }),
    'Unpaid leave & loss of pay': () => ({ head: ['Employee', 'Source', 'Date', 'Days'], rows: S(db().leaves).filter((l) => /Unpaid|Loss/.test(l.type) && l.st === 'Approved').map((l) => [l.emp, l.id, l.from, l.days]).concat(S(db().exceptions).filter((e) => e.group === 'unauth').map((e) => [e.emp, 'Unauthorized absence', e.date, 1])) }),
    'Cancellation, extension & recall': () => ({ head: ['Ref', 'Employee', 'Event', 'Detail'], rows: S(db().leaves).filter((l) => l.st === 'Cancelled' || l.extOf).map((l) => [l.id, l.emp, l.st === 'Cancelled' ? 'Cancelled' : 'Extension of ' + l.extOf, `${l.from} → ${l.to}`]).concat(S(db().adj).filter((a) => /Recall/i.test(a.reason)).map((a) => [a.id, a.emp, 'Recall', a.reason])) }),
    'Leave liability & team availability': () => ({ head: ['Leave type', 'Available (days)', 'Booked', 'Pending'], rows: Object.entries(db().bal).map(([k, b]) => [k, b.avail == null ? '—' : b.avail, b.booked, b.pending || 0]) }),
  };
  L.runReport = (name) => {
    const g = GENS[name];
    const res = g ? g() : { head: ['Note'], rows: [['No data generator for this report']] };
    const run = { id: 'RUN-' + L.nextId('RUN').split('-')[1], name, at: TODAY, rows: res.rows.length, p: period().join(' → '), loc: L.loc() };
    (db().reportRuns ||= []).unshift(run); db().reportRuns = db().reportRuns.slice(0, 8);
    L.audit('Report generated', name, '—', `${res.rows.length} rows · ${L.locLabel()}`);
    window.__rep = { name, res };
    openModal(modalShell(name, `<div class="muted" style="margin-bottom:10px;font-size:12.5px">${period().map(fmt).join(' → ')} · ${esc(L.locLabel())} · ${L.ui('rpDept', 'All departments') === 'All departments' ? 'All departments' : esc(L.ui('rpDept'))} · ${res.rows.length} row(s)</div>${res.rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${res.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${res.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : L.empty('No data for this selection')}`,
      `<button class="btn" onclick="closeModal()">Close</button><button class="btn pri" onclick="LA.repCsv()" ${res.rows.length ? '' : 'disabled'}>${ic('download')} Download CSV</button>`, 'lg'));
    L.save();
  };
  L.repCsv = () => { const { name, res } = window.__rep; L.csv(name.replace(/[^\w]+/g, '_').toLowerCase() + '.csv', res.head, res.rows); };
  const ATT_REPORTS = ['Daily & monthly attendance', 'Scheduled / unscheduled late login', 'Scheduled / unscheduled early departure', 'Unauthorized & pattern absence', 'Recurring scheduled absence', 'Missing punches & regularization', 'Working hours, breaks & overtime', 'Weekend & public-holiday work', 'Occurrence & disciplinary threshold', 'Probation attendance', 'Attendance KPI report'];
  const LV_REPORTS = ['Annual leave balance / accrual / plan', 'Segments, carry forward, expiry & encashment', 'Sick-leave instances & pay tiers', 'Missing certificates', 'Maternity / parental / compassionate', 'Hajj history & study eligibility', 'Restricted holiday', 'Unpaid leave & loss of pay', 'Cancellation, extension & recall', 'Leave liability & team availability'];
  L.schedNew = () => L.form({
    title: 'Schedule report delivery', size: 'sm', submit: 'Schedule',
    fields: [{ k: 'r', label: 'Report', req: true, type: 'select', options: ATT_REPORTS.concat(LV_REPORTS), full: true }, { k: 'loc', label: 'Location', type: 'select', options: L.locOptions(), value: L.loc() }, { k: 'f', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly'] }, { k: 'fmt', label: 'Format', type: 'select', options: ['Excel', 'CSV', 'PDF'] }, { k: 'to', label: 'Recipients', req: true, type: 'text', ph: 'hr@gs-it.ae, ops@gs-it.ae', full: true, hint: 'Comma-separated email addresses' }],
    validate: (v) => { const bad = v.to.split(',').map((s) => s.trim()).filter((s) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)); return bad.length ? ['Invalid email address: ' + bad.join(', ')] : []; },
    onSubmit: (v) => { db().sched.push({ id: 'SCH-' + L.nextId('SCH').split('-')[1], r: v.r, f: v.f, fmt: v.fmt, to: v.to, loc: v.loc, on: TODAY }); L.audit('Report scheduled', v.r, '—', `${v.f} → ${v.to}`); toast('Delivery scheduled'); L.rr(); },
  });
  window.openScheduleModal = () => L.schedNew();
  L.schedDel = (id) => { db().sched = db().sched.filter((s) => s.id !== id); L.audit('Schedule removed', id, '—', ''); toast('Schedule removed'); L.rr(); };
  function reports() {
    const q = L.ui('repQ', '');
    const hit = (arr) => arr.filter((r) => L.matches(q, r));
    const list = (arr, ic2, bgc, fg) => arr.map((r) => `<div class="lrow op1-rep" style="padding:10px 0"><div class="li-ic" style="width:30px;height:30px;background:${bgc};color:${fg}">${ic(ic2)}</div><div class="li-t" style="font-size:13px">${r}</div><div class="li-r"><button class="btn sm ghost" onclick="LA.runReport('${r.replace(/'/g, "\\'")}')">${ic('chevR')} Run</button></div></div>`).join('') || L.empty('No reports match your search');
    const runs = db().reportRuns || [];
    const scheds = (db().sched || []).filter((s) => L.hasLoc(s.loc === 'all' || !s.loc ? ['all'] : [s.loc]));
    const aRows = hit(ATT_REPORTS);
    const lRows = hit(LV_REPORTS);
    const total = ATT_REPORTS.length + LV_REPORTS.length;
    return pageHead('Reports & Analytics', 'Filter by location, department and period · export CSV', `<button class="btn" onclick="LA.schedNew()">${ic('clock')} Schedule delivery</button>`, 'Payroll & Output')
      + statStrip([
        { lbl: 'Attendance reports', val: ATT_REPORTS.length, icon: 'chart', tone: 'b', hint: 'FRS §22.1' },
        { lbl: 'Leave reports', val: LV_REPORTS.length, icon: 'doc', tone: 'p', hint: 'FRS §22.2' },
        { lbl: 'Reports generated', val: runs.length, icon: 'download', tone: 'g', hint: runs.length ? 'Last: ' + esc(runs[0].name) : 'Nothing generated yet' },
        { lbl: 'Scheduled deliveries', val: scheds.length, icon: 'clock', tone: scheds.length ? 'a' : 'x', hint: scheds.length ? 'Recurring email delivery' : 'None scheduled' },
      ])
      + `<div class="op1-solo">${card('', bars(sb('repQ', 'Search reports'), `${L.fDept('rpDept')}${L.fDate('rpFrom', 'Period from', `${TODAY.slice(0, 7)}-01`, `max="${TODAY}"`)}${L.fDate('rpTo', 'to', TODAY)}${rst(['rpDept', 'rpFrom', 'rpTo', 'repQ'])}`, showing(aRows.length + lRows.length, total, 'reports')), { pad: false })}</div>`
      + '<div style="height:16px"></div>'
      + `<div class="row"><div style="flex:1">${card('Attendance reports', list(aRows, 'chart', 'var(--brand-050)', 'var(--brand)'), { sub: `${aRows.length} of ${ATT_REPORTS.length}` })}</div><div style="flex:1">${card('Leave reports', list(lRows, 'pie', 'var(--p-bg)', 'var(--p)'), { sub: `${lRows.length} of ${LV_REPORTS.length}` })}</div></div>`
      + '<div style="height:16px"></div>'
      + `<div class="row"><div style="flex:1">${card('Scheduled deliveries', tb(['Report', 'Location', 'Frequency', 'Format', 'Recipients', ''], scheds.map((s) => `<tr><td class="fw6">${esc(s.r)}</td><td>${s.loc && s.loc !== 'all' ? esc(L.locCity(s.loc)) : 'All'}</td><td>${esc(s.f)}</td><td>${bdg('s-gray', esc(s.fmt))}</td><td class="muted">${esc(s.to)}</td><td><button class="btn sm ghost" title="Remove schedule" onclick="LA.schedDel('${s.id}')">${ic('x')}</button></td></tr>`).join(''), 'No scheduled deliveries'), { pad: false, sub: `${scheds.length} active` })}</div>
        <div style="flex:1">${card('Recent runs', tb(['Report', '>Rows', 'When', ''], runs.map((r) => `<tr><td class="fw6">${esc(r.name)}</td><td class="num">${r.rows}</td><td>${fmt(r.at)}</td><td><button class="btn sm ghost" onclick="LA.runReport('${r.name.replace(/'/g, "\\'")}')">Re-run</button></td></tr>`).join(''), 'Nothing generated yet'), { pad: false, sub: `${runs.length} of last 8` })}</div></div>`;
  }

  /* ---------- audit logs ---------- */
  function auditView(system) {
    const a = db().audit || [];
    const k = system ? 'sa' : 'au';
    const act = L.ui(k + 'Act', 'All actions');
    const usr = L.ui(k + 'Usr', 'All users');
    const q = L.ui(k + 'Q', '');
    const scoped = a.filter((r) => L.hasLoc([r.loc]));
    const rows = scoped.filter((r) => (act === 'All actions' || r.action === act) && (usr === 'All users' || r.user === usr) && L.dateOk(r.at || TODAY, k + 'From', k + 'To') && L.matches(q, r.entity, r.action, r.reason, r.change, r.user));
    const acts = ['All actions', ...new Set(a.map((r) => r.action))];
    const users = ['All users', ...new Set(a.map((r) => r.user))];
    const filters = `<div class="filters">${L.fSel(k + 'Act', 'Action', acts, 'All actions')}${L.fSel(k + 'Usr', 'User', users, 'All users')}${L.fDate(k + 'From', 'From')}${L.fDate(k + 'To', 'To')}${L.searchBox(k + 'Q', 'Entity, reason…')}${L.fReset([k + 'Act', k + 'Usr', k + 'From', k + 'To', k + 'Q'])}<div class="fld"><label>&nbsp;</label><button class="btn" onclick="LA.auditCsv(${system ? 1 : 0})">${ic('download')} Export</button></div></div>`;
    return { rows, filters, scoped, acts, users, k };
  }
  L.auditCsv = (system) => { const { rows } = auditView(!!system); L.csv('audit_log.csv', ['Timestamp', 'Location', 'User', 'Action', 'Entity', 'Change', 'Reason', 'IP'], rows.map((r) => [r.ts, L.locName(r.loc), r.user, r.action, r.entity, r.change, r.reason, r.ip])); };
  function audit() {
    const { rows, scoped, acts, users, k } = auditView(false);
    const total = (db().audit || []).length;
    const people = new Set(scoped.map((r) => r.user)).size;
    const locks = scoped.filter((r) => /lock|reopen|override|waiv/i.test(String(r.action))).length;
    return pageHead('Audit Logs', 'Immutable trail of edits, verifications, locks and policy changes', `<button class="btn" onclick="LA.auditCsv(0)">${ic('download')} Export CSV</button>`, 'Payroll & Output')
      + statStrip([
        { lbl: 'Entries in scope', val: scoped.length, icon: 'doc', tone: 'b', hint: `${total} in the full log` },
        { lbl: 'Logged today', val: scoped.filter((r) => r.at === TODAY).length, icon: 'clock', tone: 'g', hint: 'Append-only · cannot be edited' },
        { lbl: 'Active users', val: people, icon: 'users', tone: 'p', hint: 'Including system jobs' },
        { lbl: 'Lock & override events', val: locks, icon: 'lock', tone: locks ? 'a' : 'x', hint: 'Locks, reopens, waivers' },
      ])
      + card('Audit trail', bars(
        sb(k + 'Q', 'Search entity, reason or user'),
        `${L.fSel(k + 'Act', 'Action', acts, 'All actions')}${L.fSel(k + 'Usr', 'User', users, 'All users')}${L.fDate(k + 'From', 'From')}${L.fDate(k + 'To', 'To')}${rst([k + 'Act', k + 'Usr', k + 'From', k + 'To', k + 'Q'])}`,
        showing(rows.length, scoped.length, 'entries'))
        + tb(['Timestamp', 'Location', 'User', 'Action', 'Entity', 'Original → Modified', 'Reason'], rows.map((r) => `<tr><td class="mono" style="font-size:12px;white-space:nowrap">${esc(r.ts)}</td><td>${L.locChip(r.loc)}</td><td>${personCell(esc(r.user), `<span class="mono">${esc(r.ip)}</span>`)}</td><td>${bdg('s-b', esc(r.action))}</td><td>${esc(r.entity)}</td><td class="mono" style="font-size:12px">${esc(r.change)}</td><td class="muted">${esc(r.reason)}</td></tr>`).join(''), 'No audit entries match these filters'), { pad: false });
  }
  function sysAudit() {
    const { rows, scoped, acts, users, k } = auditView(true);
    const devs = db().devices.filter((d) => L.hasLoc([d.loc]));
    const online = devs.filter((d) => d.online).length;
    return pageHead('System Audit & Security', 'Cross-company audit trail and security configuration', `<button class="btn" onclick="LA.auditCsv(1)">${ic('download')} Export CSV</button>`, 'Administration')
      + statStrip([
        { lbl: 'Audit logging', val: 'On', icon: 'shield', tone: 'g', hint: 'Append-only · every change recorded' },
        { lbl: 'Encryption at rest', val: 'AES-256', icon: 'lock', tone: 'g', hint: 'Applies to all company data' },
        { lbl: 'Session timeout', val: '30 min', icon: 'clock', tone: 'b', hint: 'Idle sessions are signed out' },
        { lbl: 'Devices online', val: `${online}/${devs.length}`, icon: 'device', tone: online === devs.length ? 'g' : 'a', hint: devs.length - online ? `${devs.length - online} offline` : 'All devices reporting' },
      ])
      + card('System-wide audit', bars(
        sb(k + 'Q', 'Search entity, reason or user'),
        `${L.fSel(k + 'Act', 'Action', acts, 'All actions')}${L.fSel(k + 'Usr', 'User', users, 'All users')}${L.fDate(k + 'From', 'From')}${L.fDate(k + 'To', 'To')}${rst([k + 'Act', k + 'Usr', k + 'From', k + 'To', k + 'Q'])}`,
        showing(rows.length, scoped.length, 'entries'))
        + tb(['Timestamp', 'Location', 'User', 'Action', 'Detail'], rows.map((r) => `<tr><td class="mono" style="font-size:12px;white-space:nowrap">${esc(r.ts)}</td><td>${L.locChip(r.loc)}</td><td>${personCell(esc(r.user), `<span class="mono">${esc(r.ip || '')}</span>`)}</td><td>${bdg('s-b', esc(r.action))}</td><td class="muted">${esc(r.entity)}${r.change !== '—' ? ' · ' + esc(r.change) : ''}</td></tr>`).join(''), 'No audit entries match these filters'), { pad: false });
  }

  /* ---------- wire up ---------- */
  Object.assign(VIEWS, { 'att-processing': attProcessing, exceptions, 'occurrence-mgmt': occurrenceMgmt, discipline, finalization, 'payroll-export': payrollExport, reports, audit, 'sys-audit': sysAudit });
  void fmtS; void emptyRow;
})();
