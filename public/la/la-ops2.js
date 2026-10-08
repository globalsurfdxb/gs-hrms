/* Leave & Attendance — ACTIVE LAYER · operations (part 2)
   Configuration + leave operations + administration, all location-aware: statuses, shifts, Ramadan, leave types,
   medical verification, balance adjustment, carry-forward, encashment, maternity/parental, holidays, workflows,
   HR overtime, policy, companies, roles, biometric devices, integrations. */
(function () {
  const L = window.LA;
  const { TODAY, fmt, addD, pad, esc, daysBetween } = L;
  const DOWL = L.DOWL;
  const db = () => L.db();
  const me = () => L.me();
  const R1 = (n) => Math.round(n * 10) / 10;
  const emptyRow = (n, m) => `<tr><td colspan="${n}">${L.empty(m)}</td></tr>`;
  const sc = (arr, key) => arr.filter((x) => L.inLoc(x[key || 'emp']));
  const tplLabel = (t) => (t === 'all' ? 'All locations' : t === 'uae' ? 'UAE' : 'India');
  const scopeTpls = () => (L.loc() === 'all' ? [...new Set(L.locs().map((l) => l.template))] : [L.tplOf(L.loc())]);
  const empOpts = () => L.empIn().map((e) => ({ v: e.n, l: `${e.n} · ${e.id} · ${L.locCity(e.loc)}` }));
  /* ---------- shared list-page pieces (op2) ---------- */
  const SP = '<div style="height:16px"></div>';
  const lb = (inner, count) => listBar(inner, count).replace('class="lbar"', 'class="lbar op2-lb"');
  const rst = (keys) => `<button class="btn sm ghost" onclick="LA.resetUi(${JSON.stringify(keys).replace(/"/g, '&quot;')})">${ic('refresh')} Reset</button>`;
  const nOf = (arr, f) => arr.filter(f).length;
  const lcard = (title, bar, head, rows, opts) => card(title, `${bar || ''}<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map((h) => (h.charAt(0) === '>' ? `<th class="num">${h.slice(1)}</th>` : `<th>${h}</th>`)).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`, { ...opts, pad: false });
  const noRows = (n, have, what) => emptyRow(n, have ? `No ${what} match the current filters` : `No ${what} to show yet`);
  const chipSet = (key, vals, def, f) => L.chips(key, vals.map((v) => ({ v, l: v, n: f(v) })), def);

  /* ---------- attendance statuses ---------- */
  const guess = (s) => ({
    pres: /Present|Half|First|Second|Late|Early|Duty|WFH|Work from|Travel|Client|Overtime|Comp/.test(s),
    paid: /Annual|Sick|Maternity|Parental|Compassionate|Study|Present|Half|First|Second|Approved|Public|Comp|Overtime|Duty|WFH|Work from|Travel|Client|Casual|Earned|Paternity|Marriage|Bereavement/.test(s),
    appr: /Approved|Overtime|Comp|Duty|WFH|Work from|Late Login|Early Departure/.test(s) && !/Unscheduled/.test(s),
  });
  const flags = (s) => ({ ...guess(s), ...(db().statusFlags[s] || {}) });
  const allStatuses = () => Object.keys(ST).concat(db().statusExtra.map((x) => x.name).filter((n) => !(n in ST)));
  L.togStatus = (s, k) => { const f = flags(s); db().statusFlags[s] = { ...(db().statusFlags[s] || {}), [k]: !f[k] }; L.audit('Status rule changed', s, `${k}: ${f[k]} → ${!f[k]}`, ''); L.rr(); };
  L.statusNew = () => L.form({
    title: 'Add attendance status', size: 'sm', submit: 'Add status',
    fields: [{ k: 'name', label: 'Status name', req: true, type: 'text', full: true }, { k: 'cls', label: 'Badge colour', type: 'select', options: [{ v: 's-g', l: 'Green' }, { v: 's-b', l: 'Blue' }, { v: 's-a', l: 'Amber' }, { v: 's-r', l: 'Red' }, { v: 's-p', l: 'Purple' }, { v: 's-gray', l: 'Grey' }] }, { k: 'pres', label: 'Counts as present', type: 'select', options: ['No', 'Yes'] }, { k: 'paid', label: 'Paid', type: 'select', options: ['Yes', 'No'] }, { k: 'appr', label: 'Approval required', type: 'select', options: ['No', 'Yes'] }],
    validate: (v) => (allStatuses().some((s) => s.toLowerCase() === v.name.toLowerCase()) ? ['That status already exists.'] : []),
    onSubmit: (v) => { db().statusExtra.push({ name: v.name, cls: v.cls }); ST[v.name] = [v.cls, v.name]; db().statusFlags[v.name] = { pres: v.pres === 'Yes', paid: v.paid === 'Yes', appr: v.appr === 'Yes' }; L.audit('Status added', v.name, '—', ''); toast(`Status “${v.name}” added`); L.rr(); },
  });
  L.statusDel = (n) => L.confirm('Remove status', `Remove <b>${esc(n)}</b>?`, 'Remove', () => { db().statusExtra = db().statusExtra.filter((x) => x.name !== n); delete ST[n]; L.audit('Status removed', n, '—', ''); L.rr(); }, true);
  function setStatus() {
    const q = L.ui('stQ', '');
    const yn = (lbl, key) => L.fSel(key, lbl, ['All', 'Yes', 'No'], 'All');
    const ok = (s, k, key) => { const v = L.ui(key, 'All'); return v === 'All' || (v === 'Yes') === !!flags(s)[k]; };
    const all = allStatuses();
    const list = all.filter((s) => L.matches(q, s) && ok(s, 'pres', 'stPres') && ok(s, 'paid', 'stPaid') && ok(s, 'appr', 'stAppr'));
    const cnt = (k) => nOf(all, (s) => !!flags(s)[k]);
    const isX = (s) => db().statusExtra.some((x) => x.name === s);
    const tog = (s, k, y, n) => `<span style="cursor:pointer" title="Click to change" onclick="LA.togStatus('${esc(s).replace(/'/g, "\\'")}','${k}')">${flags(s)[k] ? y : n}</span>`;
    return pageHead('Attendance Status Master', 'Define statuses and their payroll / approval behaviour (applies to every location)', `<button class="btn pri" onclick="LA.statusNew()">${ic('plus')} Add status</button>`, 'Attendance')
      + statStrip([
        { lbl: 'Statuses', val: all.length, icon: 'grid', tone: 'b', hint: `${nOf(all, isX)} custom` },
        { lbl: 'Count as present', val: cnt('pres'), icon: 'check', tone: 'g', hint: `${all.length - cnt('pres')} do not` },
        { lbl: 'Paid', val: cnt('paid'), icon: 'wallet', tone: 'p', hint: `${all.length - cnt('paid')} unpaid` },
        { lbl: 'Approval required', val: cnt('appr'), icon: 'shield', tone: 'a', hint: 'Need a manager / HR decision' },
      ])
      + note('info', 'HR can add statuses and define whether each counts as <b>present, paid, unpaid, payroll-impacting or approval-required</b> (FRS §6). Click a badge to change a rule.')
      + SP
      + lcard('Statuses', lb(L.searchBox('stQ', 'Search statuses') + yn('Present', 'stPres') + yn('Paid', 'stPaid') + yn('Approval', 'stAppr') + rst(['stPres', 'stPaid', 'stAppr', 'stQ']), `Showing ${list.length} of ${all.length}`),
        ['Status', 'Present', 'Paid', 'Payroll impact', 'Approval req.', ''],
        list.map((s) => `<tr><td>${statusBadge(s)}${isX(s) ? ' <span class="op2-tag">Custom</span>' : ''}</td><td>${tog(s, 'pres', bdg('s-g', 'Yes'), bdg('s-gray', 'No'))}</td><td>${tog(s, 'paid', bdg('s-g', 'Paid'), bdg('s-r', 'Unpaid'))}</td><td>${bdg('s-b', 'Yes')}</td><td>${tog(s, 'appr', bdg('s-a', 'Yes'), bdg('s-gray', 'No'))}</td><td class="tr">${isX(s) ? `<button class="btn sm ghost" title="Remove status" onclick="LA.statusDel('${esc(s).replace(/'/g, "\\'")}')">${ic('x')}</button>` : ''}</td></tr>`).join('') || noRows(6, all.length, 'statuses'), { sub: 'Click a badge to change a rule' });
  }
  const regStatuses = () => db().statusExtra.forEach((x) => { ST[x.name] = [x.cls, x.name]; });
  regStatuses();
  const baseInit2 = window.laInit;
  window.laInit = function (root, path) { baseInit2(root, path); regStatuses(); };

  /* ---------- shifts (per location) ---------- */
  const shiftForm = (s) => L.form({
    title: s ? 'Edit shift' : 'New shift', size: 'sm', submit: s ? 'Save shift' : 'Create shift',
    fields: [{ k: 'loc', label: 'Location', req: true, type: 'select', options: L.locOptions(false), value: s ? s.loc : (L.loc() === 'all' ? L.myLoc() : L.loc()), full: true }, { k: 'name', label: 'Shift name', req: true, type: 'text', value: s ? s.name : '', full: true }, { k: 'type', label: 'Type', type: 'select', options: ['Fixed', 'Flexible', 'Rotational', 'Split', 'Night', 'Remote', 'Client-site', 'On-call'], value: s ? s.type : 'Fixed' }, { k: 'brk', label: 'Break', req: true, type: 'text', value: s ? s.brk : '60 min' }, { k: 'from', label: 'Start', type: 'time', value: s && /^\d/.test(s.timing) ? s.timing.slice(0, 5) : L.work(L.loc() === 'all' ? L.myLoc() : L.loc()).from }, { k: 'to', label: 'End', type: 'time', value: s && /^\d/.test(s.timing) ? s.timing.slice(6, 11) : L.work(L.loc() === 'all' ? L.myLoc() : L.loc()).to }, { k: 'assigned', label: 'Assigned to', req: true, type: 'text', value: s ? s.assigned : '', full: true }],
    validate: (v) => (db().shifts.some((x) => x.loc === v.loc && x.name.toLowerCase() === v.name.toLowerCase() && (!s || x.id !== s.id)) ? ['A shift with that name exists in this location.'] : v.type !== 'Flexible' && v.type !== 'Remote' && v.from === v.to ? ['Start and end cannot be the same.'] : []),
    onSubmit: (v) => {
      const timing = v.type === 'Flexible' && !v.from ? 'Variable' : `${v.from}–${v.to}`;
      if (s) { Object.assign(s, { loc: v.loc, name: v.name, type: v.type, timing, brk: v.brk, assigned: v.assigned }); L.audit('Shift updated', v.name, '—', L.locCity(v.loc), v.loc); } else { db().shifts.push({ id: 'S' + Date.now(), loc: v.loc, name: v.name, type: v.type, timing, brk: v.brk, assigned: v.assigned }); L.audit('Shift created', v.name, '—', L.locCity(v.loc), v.loc); }
      toast(`Shift “${v.name}” saved`); L.rr();
    },
  });
  L.shiftNew = () => shiftForm(null);
  L.shiftEdit = (id) => shiftForm(db().shifts.find((x) => x.id === id));
  L.shiftDel = (id) => { const s = db().shifts.find((x) => x.id === id); L.confirm('Delete shift', `Delete <b>${esc(s.name)}</b> (${esc(L.locCity(s.loc))})?`, 'Delete', () => { db().shifts = db().shifts.filter((x) => x.id !== id); L.audit('Shift deleted', s.name, '—', L.locCity(s.loc), s.loc); L.rr(); }, true); };
  function setShift() {
    const q = L.ui('shQ', '');
    const tF = L.ui('shType', 'All types');
    const TYPES = ['Fixed', 'Flexible', 'Rotational', 'Split', 'Night', 'Remote', 'Client-site', 'On-call'];
    const base = db().shifts.filter((s) => L.hasLoc([s.loc]));
    const rows = base.filter((s) => (tF === 'All types' || s.type === tF) && L.matches(q, s.name, s.assigned));
    const used = [...new Set(base.map((s) => s.type))];
    const shown = TYPES.filter((t) => used.includes(t) || t === tF);
    const locsN = new Set(base.map((s) => s.loc)).size;
    const flex = nOf(base, (s) => s.type === 'Flexible' || s.type === 'Remote');
    return pageHead('Shift Master', 'Define working schedules, breaks and variable patterns per location', `<button class="btn pri" onclick="LA.shiftNew()">${ic('plus')} New shift</button>`, 'Attendance')
      + statStrip([
        { lbl: 'Configured shifts', val: base.length, icon: 'briefcase', tone: 'b', hint: L.locLabel() },
        { lbl: 'Shift types in use', val: used.length, icon: 'grid', tone: 'p', hint: `of ${TYPES.length} supported patterns` },
        { lbl: 'Locations covered', val: locsN, icon: 'location', tone: 'g', hint: `${L.locIds().length} in view` },
        { lbl: 'Flexible / remote', val: flex, icon: 'clock', tone: 'a', hint: 'Variable or location-free' },
      ])
      + lcard('Configured shifts', lb(L.searchBox('shQ', 'Search shift or assignment') + L.chips('shType', [{ v: 'All types', l: 'All', n: base.length }].concat(shown.map((t) => ({ v: t, l: t, n: nOf(base, (s) => s.type === t) }))), 'All types') + rst(['shType', 'shQ']), `Showing ${rows.length} of ${base.length}`),
        ['Location', 'Shift', 'Type', 'Timing', 'Break', 'Assigned to', ''],
        rows.map((r) => `<tr><td>${L.locChip(r.loc)}</td><td class="fw6">${esc(r.name)}</td><td>${bdg('s-b', esc(r.type))}</td><td class="mono">${esc(r.timing)}</td><td>${esc(r.brk)}</td><td class="muted">${esc(r.assigned)}</td><td class="tr"><div class="hb" style="justify-content:flex-end"><button class="btn sm ghost" title="Edit" onclick="LA.shiftEdit('${r.id}')">${ic('edit')}</button><button class="btn sm ghost" title="Delete" onclick="LA.shiftDel('${r.id}')">${ic('x')}</button></div></td></tr>`).join('') || noRows(7, base.length, 'shifts'))
      + SP
      + tableCard('Default office schedule (from each location’s settings)', ['Location', 'Working days', 'Office hours', 'Weekly off'], L.locIds().map((id) => { const w = L.work(id); const off = [0, 1, 2, 3, 4, 5, 6].filter((d) => !w.days.includes(d)).map((d) => DOWL[d]).join(', '); return `<tr><td class="fw6">${esc(L.locName(id))}</td><td>${w.days.map((d) => DOWL[d]).join(', ')}</td><td class="mono">${w.from}–${w.to}</td><td class="muted">${off}</td></tr>`; }).join('') || emptyRow(4, 'No locations in view'), { actions: `<button class="btn sm ghost" onclick="LA.openApp('/admin/settings')">Edit in Settings ↗</button>` })
      + SP
      + card('Supported shift patterns (FRS §4.3)', `<div class="tag-list">${TYPES.map((t) => `<span class="chip ${used.includes(t) ? 'on' : ''}">${t}</span>`).join('')}</div><div class="divider"></div><p class="muted">Highlighted patterns are in use. Schedules can vary by department, job role, client assignment, location, employee category and operational requirement.</p>`);
  }

  /* ---------- Ramadan / special schedule (per location) ---------- */
  L.ramCreate = (loc) => { db().ramadan[loc] = { start: `${TODAY.slice(0, 4)}-02-18`, end: `${TODAY.slice(0, 4)}-03-19`, reduction: '2 hours', scope: 'Company', from: '09:00', to: '15:00', brk: '30 min', revert: 'Enabled — restore standard schedule', saved: false }; L.rr(); };
  function setRamadan() {
    const loc = L.oneLoc('rmLoc');
    const r = db().ramadan[loc];
    const stOf = (x) => (!x ? 'Not set' : TODAY < x.start ? 'Upcoming' : TODAY > x.end ? 'Ended' : 'Active');
    const stTone = { Active: 'g', Upcoming: 'b', Ended: 'x', 'Not set': 'a' };
    const s0 = stOf(r);
    const head = pageHead('Ramadan Schedule', 'Temporary reduced-hours schedule with automatic revert — configured per location', '', 'Attendance')
      + statStrip([
        { lbl: 'Schedule status', val: s0, icon: 'sun', tone: stTone[s0], hint: r ? `${fmt(r.start)} → ${fmt(r.end)}` : 'Not configured' },
        { lbl: 'Period length', val: r ? `${daysBetween(r.start, r.end) + 1} days` : '—', icon: 'calendar', tone: 'b', hint: 'Maximum 40 days' },
        { lbl: 'Hours reduction', val: r ? esc(r.reduction) : '—', icon: 'clock', tone: 'p', hint: r ? `Scope: ${esc(r.scope)}` : 'Set when configured' },
        { lbl: 'Special hours', val: r ? `${esc(r.from)}–${esc(r.to)}` : '—', icon: 'briefcase', tone: 'x', hint: `Standard ${esc(L.workLabel(loc))}` },
      ])
      + `<div class="card op2-solo">${lb(L.fSel('rmLoc', 'Location', L.locOptions(false), loc), `${esc(L.locCity(loc))} · ${esc(L.workLabel(loc))}`)}</div>`;
    const ov = L.locOptions(false).filter((o) => L.hasLoc([o.v]));
    const overview = SP + lcard('Schedules by location', '', ['Location', 'Status', 'Period', 'Special hours', 'Reduction'],
      ov.map((o) => { const x = db().ramadan[o.v]; const s = stOf(x); return `<tr class="op2-clk ${o.v === loc ? 'sel' : ''}" title="Open this location" onclick="LA.setUi('rmLoc','${o.v}')"><td class="fw6">${esc(o.l)}</td><td>${bdg(s === 'Active' ? 's-g' : s === 'Upcoming' ? 's-b' : s === 'Ended' ? 's-gray' : 's-a', s)}</td><td>${x ? `${fmt(x.start)} → ${fmt(x.end)}` : '<span class="muted">—</span>'}</td><td class="mono">${x ? `${esc(x.from)}–${esc(x.to)}` : '<span class="muted">—</span>'}</td><td>${x ? esc(x.reduction) : '<span class="muted">—</span>'}</td></tr>`; }).join('') || emptyRow(5, 'No locations in view'), { sub: 'Click a row to edit that location' });
    if (!r) return head + card('', `<div style="text-align:center;padding:24px"><div class="fw6" style="margin-bottom:6px">No Ramadan / special schedule for ${esc(L.locName(loc))}</div><div class="muted" style="margin-bottom:14px">${L.tplOf(loc) === 'india' ? 'Ramadan reduced hours normally apply to UAE locations. You can still define a temporary schedule (festival season, summer hours) here.' : 'Create one to apply reduced hours for a fixed period.'}</div><button class="btn pri" onclick="LA.ramCreate('${loc}')">${ic('plus')} Configure schedule</button></div>`) + overview;
    const state = TODAY < r.start ? `Upcoming — starts in ${daysBetween(TODAY, r.start)} day(s)` : TODAY > r.end ? 'Ended — standard schedule restored' : 'Active now';
    return head
      + `<div class="row"><div style="flex:1;max-width:520px">${card('Schedule configuration — ' + esc(L.locCity(loc)), `<div class="form-row two">
        <div class="field"><label>Start date</label><input id="rm_start" type="date" value="${r.start}"></div><div class="field"><label>End date</label><input id="rm_end" type="date" value="${r.end}"></div>
        <div class="field"><label>Hours reduction</label><input id="rm_red" type="text" value="${esc(r.reduction)}"><div class="hint">Or HR-configured value</div></div>
        <div class="field"><label>Assignment scope</label><select id="rm_scope">${['Company', 'Employee group', 'Department', 'Role'].map((o) => `<option ${o === r.scope ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div class="field"><label>Shift start</label><input id="rm_from" type="time" value="${r.from}"></div><div class="field"><label>Shift end</label><input id="rm_to" type="time" value="${r.to}"></div>
        <div class="field"><label>Break duration</label><input id="rm_brk" type="text" value="${esc(r.brk)}"></div>
        <div class="field"><label>Auto-revert</label><select id="rm_rev">${['Enabled — restore standard schedule', 'Manual'].map((o) => `<option ${o === r.revert ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>
        <div id="rmErr"></div><div class="hb"><button class="btn pri" onclick="LA.ramSave('${loc}')">${ic('sun')} Save schedule</button><button class="btn ghost" onclick="LA.ramDel('${loc}')">Remove</button></div>`)}</div>
        <div style="flex:1">${note(TODAY >= r.start && TODAY <= r.end ? 'warn' : 'info', `<b>${state}</b> · ${fmt(r.start)} → ${fmt(r.end)} · ${esc(r.from)}–${esc(r.to)}${r.saved ? '' : ' (default — not yet saved)'}`)}<div style="height:12px"></div>${note('info', `Standard hours for ${esc(L.locCity(loc))}: ${esc(L.workLabel(loc))}. The standard schedule is retained and automatically reactivated after the end date.`)}</div></div>`
      + overview;
  }
  L.ramSave = (loc) => {
    const g = (i) => __$(i).value.trim();
    const e = [];
    if (!g('rm_start') || !g('rm_end')) e.push('Start and end dates are required.'); else if (g('rm_end') < g('rm_start')) e.push('End date must be on or after the start date.'); else if (daysBetween(g('rm_start'), g('rm_end')) > 40) e.push('The period cannot exceed 40 days.');
    if (g('rm_to') <= g('rm_from')) e.push('Shift end must be after shift start.');
    if (!g('rm_red')) e.push('Hours reduction is required.');
    if (e.length) { __$('rmErr').innerHTML = `<div class="note warn" style="margin-bottom:12px">${ic('alert')}<div>${e.map(esc).join('<br>')}</div></div>`; return; }
    Object.assign(db().ramadan[loc], { start: g('rm_start'), end: g('rm_end'), reduction: g('rm_red'), scope: g('rm_scope'), from: g('rm_from'), to: g('rm_to'), brk: g('rm_brk'), revert: g('rm_rev'), saved: true });
    const sh = db().shifts.find((s) => s.loc === loc && s.name === 'Ramadan'); if (sh) sh.timing = `${g('rm_from')}–${g('rm_to')}`;
    L.audit('Ramadan schedule saved', `${fmt(g('rm_start'))} → ${fmt(g('rm_end'))}`, '—', L.locCity(loc), loc); toast('Schedule saved'); L.rr();
  };
  L.ramDel = (loc) => L.confirm('Remove schedule', `Remove the Ramadan / special schedule for ${esc(L.locName(loc))}?`, 'Remove', () => { delete db().ramadan[loc]; L.audit('Ramadan schedule removed', L.locCity(loc), '—', '', loc); L.rr(); }, true);

  /* ---------- leave types (by location template) ---------- */
  const ltForm = (t) => L.form({
    title: t ? 'Edit leave type' : 'Add leave type', submit: t ? 'Save' : 'Add leave type',
    fields: [{ k: 'tpl', label: 'Applies to', req: true, type: 'select', options: [{ v: 'uae', l: 'UAE locations' }, { v: 'india', l: 'India locations' }, { v: 'all', l: 'All locations' }], value: t ? t.tpl : scopeTpls()[0] || 'uae', full: true }, { k: 't', label: 'Type name', req: true, type: 'text', value: t ? t.t : '' }, { k: 'code', label: 'Code', req: true, type: 'text', value: t ? t.code : '', hint: '2–3 letters' }, { k: 'pay', label: 'Pay', req: true, type: 'text', value: t ? t.pay : 'Full' }, { k: 'ent', label: 'Entitlement', req: true, type: 'text', value: t ? t.ent : '' }, { k: 'accrual', label: 'Accrual', type: 'text', value: t ? t.accrual : '—' }, { k: 'probation', label: 'Probation', type: 'text', value: t ? t.probation : 'Eligible' }, { k: 'doc', label: 'Document', type: 'text', value: t ? t.doc : '—' }],
    validate: (v) => { const e = []; if (!/^[A-Za-z]{2,3}$/.test(v.code)) e.push('Code must be 2–3 letters.'); if (db().ltypes.some((x) => (x.tpl === v.tpl || x.tpl === 'all' || v.tpl === 'all') && (x.t.toLowerCase() === v.t.toLowerCase() || x.code.toUpperCase() === v.code.toUpperCase()) && (!t || x.id !== t.id))) e.push('A leave type with that name or code already exists for this location group.'); return e; },
    onSubmit: (v) => { if (t) { Object.assign(t, { tpl: v.tpl, t: v.t, code: v.code.toUpperCase(), pay: v.pay, ent: v.ent, accrual: v.accrual, probation: v.probation, doc: v.doc }); L.audit('Leave type updated', v.t, '—', tplLabel(v.tpl)); } else { db().ltypes.push({ id: 'LT' + Date.now(), tpl: v.tpl, t: v.t, code: v.code.toUpperCase(), pay: v.pay, ent: v.ent, accrual: v.accrual, probation: v.probation, doc: v.doc, active: true }); L.audit('Leave type added', v.t, '—', tplLabel(v.tpl)); } toast(`Leave type “${v.t}” saved`); L.rr(); },
  });
  L.ltNew = () => ltForm(null);
  L.ltEdit = (id) => ltForm(db().ltypes.find((x) => x.id === id));
  L.ltToggle = (id) => { const t = db().ltypes.find((x) => x.id === id); t.active = !t.active; L.audit(t.active ? 'Leave type enabled' : 'Leave type disabled', t.t, '—', tplLabel(t.tpl)); toast(`${t.t} ${t.active ? 'enabled' : 'disabled'} — ${t.active ? 'now' : 'no longer'} available in Apply Leave`); L.rr(); };
  function setLeaveTypes() {
    const tpls = scopeTpls();
    const q = L.ui('ltQ', '');
    const aF = L.ui('ltAct', 'All');
    const base = db().ltypes.filter((t) => t.tpl === 'all' || tpls.includes(t.tpl));
    const rows = base.filter((t) => (aF === 'All' || (aF === 'Active') === t.active) && L.matches(q, t.t, t.code));
    const dash = (v) => !v || v === '—';
    return pageHead('Leave Types', 'Configure entitlement, accrual, pay tiers and documents — each location group has its own leave types', `<button class="btn pri" onclick="LA.ltNew()">${ic('plus')} Add leave type</button>`, 'Leave')
      + statStrip([
        { lbl: 'Leave types', val: base.length, icon: 'wallet', tone: 'b', hint: L.locLabel() },
        { lbl: 'Active', val: nOf(base, (t) => t.active), icon: 'check', tone: 'g', hint: 'Available in Apply Leave' },
        { lbl: 'Disabled', val: nOf(base, (t) => !t.active), icon: 'lock', tone: 'x', hint: 'Hidden from employees' },
        { lbl: 'Need a document', val: nOf(base, (t) => !dash(t.doc)), icon: 'doc', tone: 'a', hint: 'Certificate or proof required' },
      ])
      + lcard('Leave type master', lb(L.searchBox('ltQ', 'Search type or code') + L.chips('ltAct', [{ v: 'All', l: 'All', n: base.length }, { v: 'Active', l: 'Active', n: nOf(base, (t) => t.active) }, { v: 'Disabled', l: 'Disabled', n: nOf(base, (t) => !t.active) }], 'All') + rst(['ltAct', 'ltQ']), `Showing ${rows.length} of ${base.length}`),
        ['Type', 'Applies to', 'Pay', 'Entitlement', 'Accrual', 'Probation', 'Document', 'Active', ''],
        rows.map((t) => `<tr class="${t.active ? '' : 'op2-off'}"><td><div class="fw6">${esc(t.t)}</div><div class="op2-sec">${bdg('s-b', esc(t.code))}</div></td><td>${bdg(t.tpl === 'india' ? 's-p' : t.tpl === 'uae' ? 's-b' : 's-gray', tplLabel(t.tpl))}</td><td>${esc(t.pay)}</td><td>${esc(t.ent)}</td><td class="muted">${esc(t.accrual)}</td><td class="muted">${esc(t.probation)}</td><td class="muted">${esc(t.doc)}</td><td><span style="cursor:pointer" title="Click to enable / disable" onclick="LA.ltToggle('${t.id}')">${t.active ? bdg('s-g', 'On') : bdg('s-gray', 'Off')}</span></td><td class="tr"><button class="btn sm ghost" title="Edit" onclick="LA.ltEdit('${t.id}')">${ic('edit')}</button></td></tr>`).join('') || noRows(9, base.length, 'leave types'))
      + SP + note('warn', `Sick tiers and annual/earned accrual are configured per location group; partial-month accrual and encashment formulas remain ${phFlag('HR confirmation pending')}.`);
  }

  /* ---------- medical verification ---------- */
  L.medDo = (id, act) => {
    const m = db().med.find((x) => x.id === id);
    const lv = m.leave ? db().leaves.find((l) => l.id === m.leave) : null;
    const done = (st, why) => { m.st = st; L.audit(`Medical ${st.toLowerCase()}`, `${m.emp} · SL`, `Pending → ${st}`, why, L.locOf(m.emp)); toast(`${m.emp}: ${st}`); L.rr(); };
    if (act === 'verify') return L.confirm('Verify certificate', `Mark ${esc(m.emp)}'s ${esc(m.req)} as valid?`, 'Verify', () => { if (lv) lv.doc = lv.doc || 'Verified certificate'; done('Verified', 'Cert valid'); });
    if (act === 'reject') return L.form({ title: 'Reject document — ' + m.emp, size: 'sm', submit: 'Reject', danger: true, fields: [{ k: 'r', label: 'Reason', req: true, type: 'textarea', full: true }], onSubmit: (v) => done('Rejected', v.r) });
    return L.confirm('Convert to unpaid', `Convert ${esc(m.emp)}'s sick leave to <b>unpaid leave / loss of pay</b> because the certificate is missing/invalid? This is audited.`, 'Convert to unpaid', () => { if (lv) { lv.type = L.tplOf(L.locOf(lv.emp)) === 'india' ? 'Loss of Pay' : 'Unpaid Leave'; lv.app = 'Unpaid'; L.syncBal(); } done('Converted', 'Missing certificate — converted to unpaid'); }, true);
  };
  function docVerify() {
    const st = L.ui('mdSt', 'Pending');
    const q = L.ui('mdQ', '');
    const base = sc(db().med);
    const rows = base.filter((m) => (st === 'All' || m.st === st) && L.deptOk(m.emp, 'mdDept') && L.matches(q, m.emp, m.req, m.period));
    const c = (s) => nOf(base, (m) => m.st === s);
    const missing = nOf(base, (m) => m.st === 'Pending' && m.doc === 'Missing');
    return pageHead('Medical Document Verification', 'Verify sick-leave certificates and convert unsupported leave', '', 'Leave')
      + statStrip([
        { lbl: 'Awaiting review', val: c('Pending'), icon: 'doc', tone: c('Pending') ? 'a' : 'g', hint: c('Pending') ? 'Verify or convert' : 'Queue is clear' },
        { lbl: 'Missing certificates', val: missing, icon: 'alert', tone: missing ? 'r' : 'g', hint: missing ? 'Convert to unpaid leave' : 'None outstanding' },
        { lbl: 'Verified', val: c('Verified'), icon: 'check', tone: 'g', hint: 'Certificates accepted' },
        { lbl: 'Rejected / converted', val: c('Rejected') + c('Converted'), icon: 'x', tone: 'x', hint: 'Closed with action' },
      ])
      + note('info', 'A valid medical certificate is mandatory for ≥2 consecutive days (UAE) / more than 2 days (India), instances after the first six, and sick leave adjacent to a public holiday. Missing/invalid documents are converted to unpaid leave (FRS §14).')
      + SP
      + lcard('Verification queue', lb(L.searchBox('mdQ', 'Search member or requirement') + chipSet('mdSt', ['Pending', 'Verified', 'Rejected', 'Converted', 'All'], 'Pending', (s) => (s === 'All' ? base.length : c(s))) + L.fDept('mdDept') + rst(['mdDept', 'mdSt', 'mdQ']), `Showing ${rows.length} of ${base.length}`),
        ['Member', 'Location', 'Instance', 'Period', '>Days', 'Requirement', 'Document', 'Action'],
        rows.map((r) => `<tr><td>${L.empCell(r.emp)}</td><td>${L.locChip(L.locOf(r.emp))}</td><td>${r.inst}</td><td>${esc(r.period)}</td><td class="num">${r.days}</td><td class="muted">${esc(r.req)}</td><td>${r.doc === 'Missing' ? bdg('s-r', 'Missing') : bdg('s-g', 'Uploaded')}</td>
        <td>${r.st !== 'Pending' ? (r.st === 'Verified' ? bdg('s-g', 'Verified') : r.st === 'Rejected' ? bdg('s-r', 'Rejected') : bdg('s-gray', 'Converted')) : r.doc === 'Missing' ? `<button class="btn sm danger" onclick="LA.medDo('${r.id}','convert')">Convert to unpaid</button>` : `<div class="hb"><button class="btn sm ok" onclick="LA.medDo('${r.id}','verify')">Verify</button><button class="btn sm ghost" onclick="LA.medDo('${r.id}','reject')">Reject</button></div>`}</td></tr>`).join('') || noRows(8, base.length, 'certificates'), { sub: st === 'Pending' ? 'Pending items first' : st })
      + SP + note('warn', 'Access to medical information is restricted and audited (FRS §25).');
  }

  /* ---------- balance adjustment ---------- */
  const BAL_NAMES = () => Object.keys(db().bal).filter((k) => k !== 'Weekly Off');
  L.adjNew = () => L.form({
    title: 'New balance adjustment', submit: 'Save adjustment',
    fields: [{ k: 'emp', label: 'Employee', req: true, type: 'select', options: empOpts() }, { k: 'type', label: 'Leave type', req: true, type: 'select', options: BAL_NAMES().concat([...new Set(db().ltypes.filter((t) => t.active).map((t) => t.t))].filter((t) => !BAL_NAMES().includes(t))) }, { k: 'change', label: 'Change (± days)', req: true, type: 'number', value: 0, step: '0.5' }, { k: 'date', label: 'Effective date', req: true, type: 'date', value: TODAY }, { k: 'reason', label: 'Reason', req: true, type: 'textarea', full: true }],
    validate: (v) => { const e = []; if (!v.change) e.push('Change cannot be zero.'); if (Math.abs(v.change) > 30) e.push('Adjustments above 30 days need a Super Admin override.'); if (v.emp === me() && db().bal[v.type] && db().bal[v.type].avail != null && db().bal[v.type].avail + v.change < 0) e.push('This would take the balance below zero.'); return e; },
    onSubmit: (v) => {
      let before = '—'; let after = '—';
      const b = db().bal[v.type];
      if (v.emp === me() && b && b.avail != null) { before = b.avail; b.avail = R1(b.avail + v.change); after = b.avail; }
      db().adj.unshift({ id: 'ADJ-' + L.nextId('ADJ').split('-')[1], emp: v.emp, type: v.type, change: v.change, reason: v.reason, by: me(), date: v.date });
      L.audit('Balance adjustment', `${v.emp} · ${v.type}`, `${before} → ${after}`, v.reason, L.locOf(v.emp));
      toast(`Adjustment saved${v.emp === me() ? ` — balance now ${after}` : ''}`); L.rr();
    },
  });
  window.openAdjModal = () => L.adjNew();
  function balanceAdj() {
    const q = L.ui('adQ', '');
    const tF = L.ui('adType', 'All types');
    const dF = L.ui('adDir', 'All');
    const base = sc(db().adj);
    const rows = base.filter((a) => L.deptOk(a.emp, 'adDept') && (tF === 'All types' || a.type === tF) && (dF === 'All' || (dF === 'Credits') === a.change > 0) && L.dateOk(a.date, 'adFrom', 'adTo') && L.matches(q, a.emp, a.type, a.reason));
    const cred = R1(base.filter((a) => a.change > 0).reduce((s, a) => s + a.change, 0));
    const deb = R1(Math.abs(base.filter((a) => a.change < 0).reduce((s, a) => s + a.change, 0)));
    return pageHead('Leave Balance Adjustment', 'Manual adjustments with mandatory reason and audit trail', `<button class="btn pri" onclick="LA.adjNew()">${ic('edit')} New adjustment</button>`, 'Leave')
      + statStrip([
        { lbl: 'Adjustments', val: base.length, icon: 'scale', tone: 'b', hint: L.locLabel() },
        { lbl: 'Days credited', val: '+' + cred, icon: 'plus', tone: 'g', hint: `${nOf(base, (a) => a.change > 0)} credit entr${nOf(base, (a) => a.change > 0) === 1 ? 'y' : 'ies'}` },
        { lbl: 'Days debited', val: '−' + deb, icon: 'history', tone: 'r', hint: `${nOf(base, (a) => a.change < 0)} debit entr${nOf(base, (a) => a.change < 0) === 1 ? 'y' : 'ies'}` },
        { lbl: 'Employees affected', val: new Set(base.map((a) => a.emp)).size, icon: 'users', tone: 'p', hint: 'With at least one adjustment' },
      ])
      + note('warn', 'Every manual override requires a reason and audit record (FRS §27, rule 16).')
      + SP
      + lcard('Recent adjustments', lb(L.searchBox('adQ', 'Search member, type or reason') + L.chips('adDir', [{ v: 'All', l: 'All', n: base.length }, { v: 'Credits', l: 'Credits', n: nOf(base, (a) => a.change > 0) }, { v: 'Debits', l: 'Debits', n: nOf(base, (a) => a.change < 0) }], 'All') + L.fSel('adType', 'Type', ['All types'].concat([...new Set(db().adj.map((a) => a.type))]), 'All types') + L.fDept('adDept') + L.fDate('adFrom', 'From') + L.fDate('adTo', 'To') + rst(['adDept', 'adType', 'adDir', 'adFrom', 'adTo', 'adQ']), `Showing ${rows.length} of ${base.length}`),
        ['Member', 'Location', 'Leave type', '>Change', 'Reason', 'By', 'Date'],
        rows.map((r) => `<tr><td>${L.empCell(r.emp)}</td><td>${L.locChip(L.locOf(r.emp))}</td><td>${bdg('s-b', esc(r.type))}</td><td class="num fw6" style="color:${r.change > 0 ? 'var(--g)' : 'var(--r)'}">${r.change > 0 ? '+' : '−'}${Math.abs(r.change).toFixed(1)}</td><td class="muted">${esc(r.reason)}</td><td>${esc(r.by)}</td><td>${fmt(r.date)}</td></tr>`).join('') || noRows(7, base.length, 'adjustments'));
  }

  /* ---------- carry forward ---------- */
  L.cfDo = (id, act) => {
    const c = db().cf.find((x) => x.id === id);
    if (c && c.emp === me()) { toast('You cannot approve or reject your own request'); return; }
    const ok = act === 'approve';
    L.confirm(ok ? 'Approve carry-forward' : 'Reject carry-forward', `${ok ? 'Approve' : 'Reject'} <b>${c.days}</b> day(s) for ${esc(c.emp)} (expires ${fmt(c.expires)})?`, ok ? 'Approve' : 'Reject', () => {
      c.st = ok ? 'Approved' : 'Rejected';
      if (ok && c.emp === me() && db().bal[L.annualKey()]) db().bal[L.annualKey()].avail = R1(db().bal[L.annualKey()].avail + c.days);
      L.audit(`Carry-forward ${c.st.toLowerCase()}`, `${c.emp} · ${c.days}d`, `Pending → ${c.st}`, '', L.locOf(c.emp)); toast(`Carry-forward ${c.st.toLowerCase()}`); L.rr();
    }, !ok);
  };
  L.cfNew = () => L.form({
    title: 'Carry-forward request', size: 'sm', submit: 'Submit',
    fields: [{ k: 'emp', label: 'Employee', req: true, type: 'select', options: empOpts(), full: true }, { k: 'days', label: 'Days', req: true, type: 'number', value: 1, step: '0.5', min: 0.5, max: 5 }, { k: 'year', label: 'Entitlement year', type: 'text', value: `${Number(TODAY.slice(0, 4)) - 1}–${TODAY.slice(2, 4)}` }],
    validate: (v) => (v.days > 5 ? ['Carry-forward is capped at 5 days.'] : db().cf.some((c) => c.emp === v.emp && c.st === 'Pending') ? ['This employee already has a pending request.'] : []),
    onSubmit: (v) => { db().cf.push({ id: 'CF-' + Date.now(), emp: v.emp, days: Number(v.days), year: v.year, expires: `${Number(TODAY.slice(0, 4)) + 1}-03-31`, st: 'Pending' }); L.audit('Carry-forward requested', `${v.emp} · ${v.days}d`, '— → Pending', '', L.locOf(v.emp)); toast('Request submitted'); L.rr(); },
  });
  function carryForward() {
    const q = L.ui('cfQ', '');
    const sF = L.ui('cfSt', 'All');
    const base = sc(db().cf);
    const rows = base.filter((c) => L.deptOk(c.emp, 'cfDept') && (sF === 'All' || c.st === sF) && L.matches(q, c.emp, c.year));
    const conf = L.confOf(L.oneLoc('polLoc'));
    const c = (s) => nOf(base, (x) => x.st === s);
    const dsum = (f) => R1(base.filter(f).reduce((a, x) => a + (Number(x.days) || 0), 0));
    const soon = base.filter((x) => x.st === 'Approved' && daysBetween(TODAY, x.expires) >= 0 && daysBetween(TODAY, x.expires) <= 90);
    return pageHead('Carry Forward', 'Approve carry-forward and monitor 3-month expiry', `<button class="btn pri" onclick="LA.cfNew()">${ic('plus')} New request</button>`, 'Leave')
      + statStrip([
        { lbl: 'Pending approval', val: c('Pending'), icon: 'history', tone: c('Pending') ? 'a' : 'g', hint: c('Pending') ? 'Awaiting a decision' : 'Nothing pending' },
        { lbl: 'Days pending', val: dsum((x) => x.st === 'Pending'), icon: 'calendar', tone: 'b', hint: 'Capped at 5 days per request' },
        { lbl: 'Days approved', val: dsum((x) => x.st === 'Approved'), icon: 'check', tone: 'g', hint: `${c('Approved')} approved request(s)` },
        { lbl: 'Expiring within 90 days', val: soon.length, icon: 'alert', tone: soon.length ? 'r' : 'x', hint: soon.length ? `${R1(soon.reduce((a, x) => a + (Number(x.days) || 0), 0))} day(s) at risk` : 'No upcoming expiry' },
      ])
      + note('warn', `Carry-forward workflow (manager only vs manager + HR) and exact three-month expiry date logic are ${phFlag(conf.cfFlow ? 'Set: ' + esc(conf.cfFlow) : 'HR confirmation pending')} (FRS §28).`)
      + SP
      + lcard('Carry-forward requests', lb(L.searchBox('cfQ', 'Search member or year') + chipSet('cfSt', ['All', 'Pending', 'Approved', 'Rejected'], 'All', (s) => (s === 'All' ? base.length : c(s))) + L.fDept('cfDept') + rst(['cfDept', 'cfSt', 'cfQ']), `Showing ${rows.length} of ${base.length}`),
        ['Member', 'Location', '>Carry days', 'Entitlement year', 'Expires', 'Status', 'Action'],
        rows.map((r) => { const dl = daysBetween(TODAY, r.expires); return `<tr><td>${L.empCell(r.emp)}</td><td>${L.locChip(L.locOf(r.emp))}</td><td class="num fw6">${r.days}</td><td class="muted">${esc(r.year)}</td><td>${fmt(r.expires)}${r.st === 'Rejected' ? '' : `<div class="op2-sec">${dl >= 0 ? `in ${dl} day(s)` : 'expired'}</div>`}</td><td>${L.statusPill(r.st)}</td><td>${r.st === 'Pending' ? `<div class="hb"><button class="btn sm ok" onclick="LA.cfDo('${r.id}','approve')">Approve</button><button class="btn sm ghost" onclick="LA.cfDo('${r.id}','reject')">Reject</button></div>` : '<span class="muted">—</span>'}</td></tr>`; }).join('') || noRows(7, base.length, 'requests'));
  }

  /* ---------- encashment ---------- */
  L.encDo = (id, stage) => {
    const e = db().enc.find((x) => x.id === id);
    if (e && e.emp === me()) { toast('You cannot approve your own request'); return; }
    const msg = stage === 'mgr' ? 'Manager approval' : stage === 'hr' ? 'HR approval' : 'Queue to payroll';
    L.confirm(msg, `${msg} for <b>${esc(e.emp)}</b> — ${e.days} day(s)?`, 'Confirm', () => {
      if (stage === 'mgr') e.mgr = 'Approved'; else if (stage === 'hr') { e.hr = 'Approved'; if (e.emp === me() && db().bal[L.annualKey()]) { const b = db().bal[L.annualKey()]; b.avail = R1(Math.max(0, b.avail - e.days)); } } else e.payroll = 'Queued';
      L.audit('Encashment ' + (stage === 'pay' ? 'queued' : 'approved'), `${e.emp} · ${e.days}d`, stage, '', L.locOf(e.emp)); toast(msg + ' recorded'); L.rr();
    });
  };
  L.encNew = () => L.form({
    title: 'Encashment request', size: 'sm', submit: 'Submit',
    fields: [{ k: 'emp', label: 'Employee', req: true, type: 'select', options: empOpts(), full: true }, { k: 'days', label: 'Days', req: true, type: 'number', value: 1, step: '0.5', min: 0.5, max: 10 }, { k: 'reason', label: 'Operational reason', req: true, type: 'text', full: true }],
    validate: (v) => { const e = []; if (v.days > 10) e.push('Encashment is capped at 10 days per request.'); const b = db().bal[L.annualKey()]; if (v.emp === me() && b && v.days > b.avail) e.push(`Only ${b.avail} leave day(s) available.`); return e; },
    onSubmit: (v) => { db().enc.push({ id: 'ENC-' + L.nextId('ENC').split('-')[1], emp: v.emp, days: Number(v.days), reason: v.reason, mgr: 'Pending', hr: '—', payroll: '—' }); L.audit('Encashment requested', `${v.emp} · ${v.days}d`, '— → Pending', v.reason, L.locOf(v.emp)); toast('Encashment request submitted'); L.rr(); },
  });
  function encashment() {
    const q = L.ui('enQ', '');
    const sF = L.ui('enSt', 'All');
    const stage = (r) => (r.mgr !== 'Approved' ? 'Awaiting manager' : r.hr !== 'Approved' ? 'Awaiting HR' : r.payroll === '—' ? 'Ready for payroll' : 'Queued');
    const base = sc(db().enc);
    const rows = base.filter((r) => L.deptOk(r.emp, 'enDept') && (sF === 'All' || stage(r) === sF) && L.matches(q, r.emp, r.reason));
    const conf = L.confOf(L.oneLoc('polLoc'));
    const c = (s) => nOf(base, (r) => stage(r) === s);
    const dd = (s) => R1(base.filter((r) => stage(r) === s).reduce((a, r) => a + (Number(r.days) || 0), 0));
    const none = (v) => `<span class="muted">${v}</span>`;
    return pageHead('Leave Encashment', 'Operational-reason encashment · Manager and HR approval', `<button class="btn pri" onclick="LA.encNew()">${ic('plus')} New request</button>`, 'Leave')
      + statStrip([
        { lbl: 'Awaiting manager', val: c('Awaiting manager'), icon: 'usercheck', tone: c('Awaiting manager') ? 'a' : 'g', hint: `${dd('Awaiting manager')} day(s)` },
        { lbl: 'Awaiting HR', val: c('Awaiting HR'), icon: 'shield', tone: c('Awaiting HR') ? 'b' : 'g', hint: `${dd('Awaiting HR')} day(s)` },
        { lbl: 'Ready for payroll', val: c('Ready for payroll'), icon: 'wallet', tone: c('Ready for payroll') ? 'p' : 'x', hint: `${dd('Ready for payroll')} day(s) to queue` },
        { lbl: 'Queued to payroll', val: c('Queued'), icon: 'check', tone: 'g', hint: `${dd('Queued')} day(s) · pay within 45 days` },
      ])
      + note('warn', `Encashment formula (gross / basic / approved salary component) is ${phFlag(conf.encFormula ? 'Set: ' + esc(conf.encFormula) : 'HR confirmation pending')}. Payment within 45 days after approval.`)
      + SP
      + lcard('Encashment requests', lb(L.searchBox('enQ', 'Search member or reason') + chipSet('enSt', ['All', 'Awaiting manager', 'Awaiting HR', 'Ready for payroll', 'Queued'], 'All', (s) => (s === 'All' ? base.length : c(s))) + L.fDept('enDept') + rst(['enDept', 'enSt', 'enQ']), `Showing ${rows.length} of ${base.length}`),
        ['Member', 'Location', '>Days', 'Reason', 'Manager', 'HR', 'Payroll', 'Action'],
        rows.map((r) => `<tr><td>${L.empCell(r.emp)}</td><td>${L.locChip(L.locOf(r.emp))}</td><td class="num fw6">${r.days}</td><td class="muted">${esc(r.reason)}</td><td>${r.mgr === 'Approved' ? bdg('s-g', 'Approved') : bdg('s-a', 'Pending')}</td><td>${r.hr === 'Approved' ? bdg('s-g', 'Approved') : r.hr === 'Pending' ? bdg('s-a', 'Pending') : none('—')}</td><td>${r.payroll !== '—' ? bdg('s-b', esc(r.payroll)) : none('—')}</td>
        <td>${r.mgr !== 'Approved' ? `<button class="btn sm ok" onclick="LA.encDo('${r.id}','mgr')">Manager ✓</button>` : r.hr !== 'Approved' ? `<button class="btn sm ok" onclick="LA.encDo('${r.id}','hr')">HR ✓</button>` : r.payroll === '—' ? `<button class="btn sm" onclick="LA.encDo('${r.id}','pay')">Queue to payroll</button>` : none('—')}</td></tr>`).join('') || noRows(8, base.length, 'requests'));
  }

  /* ---------- maternity / parental ---------- */
  L.matNew = (kind) => L.form({
    title: kind === 'par' ? 'Parental / paternity leave case' : 'Maternity case', size: 'sm', submit: 'Add case',
    fields: kind === 'par' ? [{ k: 'emp', label: 'Employee', req: true, type: 'select', options: empOpts(), full: true }, { k: 'doc', label: 'Birth certificate', type: 'select', options: ['Uploaded', 'Missing'] }]
      : [{ k: 'emp', label: 'Employee', req: true, type: 'select', options: empOpts(), full: true }, { k: 'type', label: 'Type', type: 'select', options: ['Standard maternity', 'Newborn illness', 'Statutory maternity (26 weeks)'] }, { k: 'unpaid', label: 'Unpaid days', type: 'number', value: 0, min: 0, max: 30 }],
    validate: (v) => (db().mat.some((m) => m.emp === v.emp) && kind !== 'par' ? ['This employee already has a maternity case.'] : db().par.some((p) => p.emp === v.emp) && kind === 'par' ? ['This employee already has a parental case.'] : []),
    onSubmit: (v) => { if (kind === 'par') db().par.push({ id: 'PAR-' + Date.now(), emp: v.emp, ent: '5 working days', window: 'Birth → 6 months', doc: v.doc, st: v.doc === 'Uploaded' ? 'Approved' : 'Pending' }); else db().mat.push({ id: 'MAT-' + L.nextId('MAT').split('-')[1], emp: v.emp, type: v.type, full: v.type === 'Standard maternity' ? 45 : v.type === 'Newborn illness' ? 30 : 182, half: v.type === 'Standard maternity' ? 15 : 0, unpaid: Number(v.unpaid) || 0, st: 'Approved' }); L.audit('Maternity/parental case added', v.emp, '—', '', L.locOf(v.emp)); toast('Case added'); L.rr(); },
  });
  function maternity() {
    const q = L.ui('maQ', '');
    const vw = L.ui('maView', 'All');
    const matB = sc(db().mat);
    const parB = sc(db().par);
    const mat = matB.filter((m) => L.deptOk(m.emp, 'maDept') && L.matches(q, m.emp, m.type));
    const par = parB.filter((m) => L.deptOk(m.emp, 'maDept') && L.matches(q, m.emp));
    const showM = vw === 'All' || vw === 'Maternity';
    const showP = vw === 'All' || vw === 'Parental';
    const shown = (showM ? mat.length : 0) + (showP ? par.length : 0);
    const total = matB.length + parB.length;
    const miss = nOf(parB, (p) => p.doc === 'Missing');
    const pend = nOf(matB, (m) => m.st !== 'Approved') + nOf(parB, (p) => p.st !== 'Approved');
    return pageHead('Maternity & Parental Leave', 'Track entitlement, pay tiers and supporting cases', `<button class="btn" onclick="LA.matNew('par')">${ic('plus')} Parental case</button><button class="btn pri" onclick="LA.matNew('mat')">${ic('plus')} Maternity case</button>`, 'Leave')
      + statStrip([
        { lbl: 'Maternity cases', val: matB.length, icon: 'baby', tone: 'p', hint: `${nOf(matB, (m) => m.st === 'Approved')} approved` },
        { lbl: 'Parental cases', val: parB.length, icon: 'users', tone: 'b', hint: '5 working days each' },
        { lbl: 'Documents missing', val: miss, icon: 'doc', tone: miss ? 'r' : 'g', hint: miss ? 'Birth certificate outstanding' : 'All supporting documents in' },
        { lbl: 'Pending approval', val: pend, icon: 'clock', tone: pend ? 'a' : 'g', hint: pend ? 'Cases not yet approved' : 'Nothing pending' },
      ])
      + `<div class="card op2-solo">${lb(L.searchBox('maQ', 'Search member or type') + chipSet('maView', ['All', 'Maternity', 'Parental'], 'All', (s) => (s === 'All' ? total : s === 'Maternity' ? matB.length : parB.length)) + L.fDept('maDept') + rst(['maDept', 'maQ', 'maView']), `Showing ${shown} of ${vw === 'All' ? total : vw === 'Maternity' ? matB.length : parB.length} cases`)}</div>`
      + (showM ? lcard('Maternity cases', '', ['Member', 'Location', 'Type', '>Full-pay', '>Half-pay', '>Unpaid', 'Status', ''], mat.map((r) => `<tr><td>${L.empCell(r.emp)}</td><td>${L.locChip(L.locOf(r.emp))}</td><td>${esc(r.type)}</td><td class="num">${r.full}</td><td class="num">${r.half}</td><td class="num">${r.unpaid}</td><td>${bdg(r.st === 'Approved' ? 's-g' : 's-a', esc(r.st))}</td><td class="tr"><button class="btn sm ghost" title="Remove case" onclick="LA.matDel('${r.id}','mat')">${ic('x')}</button></td></tr>`).join('') || noRows(8, matB.length, 'maternity cases'), { sub: `${mat.length} of ${matB.length}` }) : '')
      + (showM && showP ? SP : '')
      + (showP ? lcard('Parental / paternity leave', '', ['Member', 'Location', 'Entitlement', 'Document', 'Status', ''], par.map((r) => `<tr><td>${L.empCell(r.emp)}</td><td>${L.locChip(L.locOf(r.emp))}</td><td>${esc(r.ent)}</td><td>${r.doc === 'Uploaded' ? bdg('s-g', 'Uploaded') : bdg('s-r', 'Missing')}</td><td>${r.st === 'Approved' ? bdg('s-g', 'Approved') : bdg('s-a', esc(r.st))}</td><td class="tr"><button class="btn sm ghost" title="Remove case" onclick="LA.matDel('${r.id}','par')">${ic('x')}</button></td></tr>`).join('') || noRows(6, parB.length, 'parental cases'), { sub: `${par.length} of ${parB.length}` }) : '')
      + SP + note('info', 'UAE: 45 full-pay + 15 half-pay days (60 total), nursing break of 2 h/day. India: 26 weeks statutory maternity leave (182 days). Annual-leave combination follows each location’s policy.');
  }
  L.matDel = (id, k) => L.confirm('Remove case', 'Remove this case record?', 'Remove', () => { if (k === 'par') db().par = db().par.filter((x) => x.id !== id); else db().mat = db().mat.filter((x) => x.id !== id); L.audit('Maternity/parental case removed', id, '—', ''); L.rr(); }, true);

  /* ---------- holiday settings (per location) ---------- */
  const holForm = (h) => L.form({
    title: h ? 'Edit holiday' : 'Add holiday', size: 'sm', submit: h ? 'Save' : 'Add holiday',
    fields: [{ k: 'n', label: 'Holiday name', req: true, type: 'text', value: h ? h.n : '', full: true }, { k: 'loc', label: 'Applies to', req: true, type: 'select', options: L.locOptions(), value: h ? (!h.locs || h.locs.includes('all') ? 'all' : h.locs[0]) : L.loc(), full: true }, { k: 'd', label: 'Date', req: true, type: 'date', value: h ? h.d : '' }, { k: 'to', label: 'End date (optional)', type: 'date', value: h ? h.to : '' }, { k: 'type', label: 'Type', type: 'select', options: ['Public', 'Optional', 'Company'], value: h ? h.type : 'Public' }],
    validate: (v) => { const e = []; if (v.to && v.to < v.d) e.push('End date is before the start date.'); const mine = v.loc === 'all' ? L.locs().map((l) => l.id) : [v.loc]; if (db().hol.some((x) => (!h || x.id !== h.id) && !((v.to || v.d) < x.d || v.d > (x.to || x.d)) && (!x.locs || x.locs.includes('all') || x.locs.some((i) => mine.includes(i))))) e.push('Overlaps an existing holiday for that location.'); return e; },
    onSubmit: (v) => { const locs = v.loc === 'all' ? ['all'] : [v.loc]; if (h) { Object.assign(h, { n: v.n, d: v.d, to: v.to, type: v.type, locs }); L.audit('Holiday updated', v.n, '—', v.loc === 'all' ? 'All locations' : L.locCity(v.loc), v.loc === 'all' ? undefined : v.loc); } else { db().hol.push({ id: 'H' + Date.now(), n: v.n, d: v.d, to: v.to, type: v.type, locs }); L.audit('Holiday added', v.n, '—', fmt(v.d), v.loc === 'all' ? undefined : v.loc); } toast(`Holiday “${v.n}” saved`); L.rr(); },
  });
  L.holNew = () => holForm(null);
  L.holEdit = (id) => holForm(db().hol.find((x) => x.id === id));
  L.holDel = (id) => { const h = db().hol.find((x) => x.id === id); L.confirm('Remove holiday', `Remove <b>${esc(h.n)}</b>?`, 'Remove', () => { db().hol = db().hol.filter((x) => x.id !== id); L.audit('Holiday removed', h.n, '—', ''); L.rr(); }, true); };
  function setHolidays() {
    const y = L.ui('hsYear', Number(TODAY.slice(0, 4)));
    const tF = L.ui('hsType', 'All types');
    const q = L.ui('hsQ', '');
    const base = db().hol.filter((h) => h.d.slice(0, 4) === String(y) && L.hasLoc(h.locs));
    const rows = base.filter((h) => (tF === 'All types' || h.type === tF) && L.matches(q, h.n)).sort((a, b) => (a.d < b.d ? -1 : 1));
    const upc = db().hol.filter((h) => L.hasLoc(h.locs) && (h.to || h.d) >= TODAY).sort((a, b) => (a.d < b.d ? -1 : 1))[0];
    const wd = (d) => { try { return DOWL[L.parse(d).getDay()]; } catch { return ''; } };
    const dur = (h) => (h.to ? daysBetween(h.d, h.to) + 1 : 1);
    const c = (t) => nOf(base, (h) => h.type === t);
    return pageHead('Holiday Calendar Settings', 'Maintain public holidays for each location', `<div class="daterange"><button class="dr-nav" onclick="LA.setUi('hsYear',${y - 1})">${ic('chevL')}</button><span class="dr-lbl">${y}</span><button class="dr-nav" onclick="LA.setUi('hsYear',${y + 1})">${ic('chevR')}</button></div><button class="btn pri" onclick="LA.holNew()">${ic('plus')} Add holiday</button>`, 'Leave')
      + statStrip([
        { lbl: `Holidays in ${y}`, val: base.length, icon: 'calendar', tone: 'b', hint: L.locLabel() },
        { lbl: 'Public holidays', val: c('Public'), icon: 'gift', tone: 'p', hint: `${nOf(base, (h) => h.type === 'Public' && dur(h) > 1)} multi-day` },
        { lbl: 'Optional / company', val: c('Optional') + c('Company'), icon: 'sun', tone: 'a', hint: `${c('Optional')} optional · ${c('Company')} company` },
        { lbl: 'Next holiday', val: upc ? fmt(upc.d) : '—', icon: 'chevR', tone: 'g', hint: upc ? esc(upc.n) : 'None scheduled' },
      ])
      + lcard(`${y} · ${L.locLabel()}`, lb(L.searchBox('hsQ', 'Search holiday name') + chipSet('hsType', ['All types', 'Public', 'Optional', 'Company'], 'All types', (t) => (t === 'All types' ? base.length : c(t))) + rst(['hsType', 'hsQ']), `Showing ${rows.length} of ${base.length}`),
        ['Date', 'Holiday', '>Days', 'Applies to', 'Type', 'Action'],
        rows.map((h) => `<tr><td><div class="fw6">${fmt(h.d)}${h.to ? ' → ' + fmt(h.to) : ''}</div><div class="op2-sec">${wd(h.d)}</div></td><td>${esc(h.n)}</td><td class="num">${dur(h)}</td><td class="muted">${!h.locs || h.locs.includes('all') ? 'All locations' : h.locs.map((i) => esc(L.locCity(i))).join(', ')}</td><td>${bdg(h.type === 'Public' ? 's-p' : h.type === 'Optional' ? 's-a' : 's-b', esc(h.type))}</td><td class="tr"><div class="hb" style="justify-content:flex-end"><button class="btn sm ghost" title="Edit" onclick="LA.holEdit('${h.id}')">${ic('edit')}</button><button class="btn sm ghost" title="Remove" onclick="LA.holDel('${h.id}')">${ic('x')}</button></div></td></tr>`).join('') || noRows(6, base.length, 'holidays'));
  }

  /* ---------- workflows ---------- */
  L.wfForm = (i) => {
    const w = i == null ? null : db().workflows[i];
    L.form({
      title: w ? 'Edit workflow' : 'Add workflow', submit: 'Save workflow',
      fields: [{ k: 'n', label: 'Request type', req: true, type: 'text', value: w ? w[0] : '', full: true }, { k: 'tpl', label: 'Applies to', type: 'select', options: [{ v: 'all', l: 'All locations' }, { v: 'uae', l: 'UAE locations' }, { v: 'india', l: 'India locations' }], value: w ? w[2] || 'all' : 'all', full: true }, { k: 's', label: 'Approval steps', req: true, type: 'textarea', value: w ? w[1] : 'Employee → Reporting Manager → HR', full: true, hint: 'Separate steps with →. Must start with Employee.' }],
      validate: (v) => { const e = []; const steps = v.s.split('→').map((x) => x.trim()).filter(Boolean); if (!/^Employee/.test(steps[0] || '')) e.push('The first step must be Employee.'); if (steps.length < 2) e.push('Add at least one approver.'); if (db().workflows.some((x, k) => x[0].toLowerCase() === v.n.toLowerCase() && (x[2] || 'all') === v.tpl && k !== i)) e.push('A workflow for that request type already exists.'); return e; },
      onSubmit: (v) => { const s = v.s.split('→').map((x) => x.trim()).filter(Boolean).join(' → '); if (w) { L.audit('Workflow updated', v.n, w[1] + ' ⇒ ' + s, ''); db().workflows[i] = [v.n, s, v.tpl]; } else { db().workflows.push([v.n, s, v.tpl]); L.audit('Workflow added', v.n, '—', s); } toast('Workflow saved'); L.rr(); },
    });
  };
  L.wfDel = (i) => L.confirm('Delete workflow', `Delete the <b>${esc(db().workflows[i][0])}</b> workflow?`, 'Delete', () => { L.audit('Workflow deleted', db().workflows[i][0], '—', ''); db().workflows.splice(i, 1); L.rr(); }, true);
  function setWorkflows() {
    const tpls = scopeTpls();
    const q = L.ui('wfQ', '');
    const tF = L.ui('wfTpl', 'All');
    const base = db().workflows.map((r, i) => ({ r, i })).filter(({ r }) => (r[2] || 'all') === 'all' || tpls.includes(r[2]));
    const rows = base.filter(({ r }) => (tF === 'All' || (r[2] || 'all') === tF) && L.matches(q, r[0], r[1]));
    const steps = (r) => String(r[1] || '').split('→').map((s) => s.trim()).filter(Boolean);
    const avg = base.length ? R1(base.reduce((a, { r }) => a + Math.max(0, steps(r).length - 1), 0) / base.length) : 0;
    const tc = (t) => nOf(base, ({ r }) => (r[2] || 'all') === t);
    return pageHead('Approval Workflows', 'Configure per-request approval routing (FRS §18 · Table 14)', `<button class="btn pri" onclick="LA.wfForm()">${ic('plus')} Add workflow</button>`, 'Compliance')
      + statStrip([
        { lbl: 'Workflows', val: base.length, icon: 'swap', tone: 'b', hint: L.locLabel() },
        { lbl: 'Require HR approval', val: nOf(base, ({ r }) => /HR/.test(r[1] || '')), icon: 'shield', tone: 'p', hint: 'HR is an approval step' },
        { lbl: 'Avg. approval steps', val: avg, icon: 'check', tone: 'g', hint: 'Excluding the requester' },
        { lbl: 'Location-specific', val: nOf(base, ({ r }) => (r[2] || 'all') !== 'all'), icon: 'location', tone: 'a', hint: 'UAE or India only' },
      ])
      + lcard('Request workflows', lb(L.searchBox('wfQ', 'Search request type or step') + L.chips('wfTpl', [{ v: 'All', l: 'All', n: base.length }, { v: 'all', l: 'All locations', n: tc('all') }, { v: 'uae', l: 'UAE', n: tc('uae') }, { v: 'india', l: 'India', n: tc('india') }], 'All') + rst(['wfTpl', 'wfQ']), `Showing ${rows.length} of ${base.length}`),
        ['Request type', 'Applies to', 'Workflow', ''],
        rows.map(({ r, i }) => `<tr><td class="fw6">${esc(r[0])}</td><td>${bdg('s-gray', tplLabel(r[2] || 'all'))}</td><td><div class="op2-flow">${steps(r).map((s) => `<span class="chip">${esc(s)}</span>`).join('<i>→</i>')}</div></td><td class="tr"><div class="hb" style="justify-content:flex-end"><button class="btn sm ghost" title="Edit" onclick="LA.wfForm(${i})">${ic('edit')}</button><button class="btn sm ghost" title="Delete" onclick="LA.wfDel(${i})">${ic('x')}</button></div></td></tr>`).join('') || noRows(4, base.length, 'workflows'));
  }

  /* ---------- HR overtime ---------- */
  function hrOt() {
    const q = L.ui('otQ', '');
    const sF = L.ui('otStH', 'All');
    const cF = L.ui('otCatH', 'All categories');
    const base = sc(db().ots);
    const rows = base.filter((o) => L.deptOk(o.emp, 'otDept') && (sF === 'All' || o.st === sF) && (cF === 'All categories' || o.cat === cF) && L.dateOk(o.date, 'otFromH', 'otToH') && L.matches(q, o.emp, o.cat, o.comp, o.st)).sort((a, b) => (a.date < b.date ? 1 : -1));
    const tot = (c) => R1(base.filter((o) => o.st === 'Approved' && o.cat.startsWith(c)).reduce((a, o) => a + o.hours, 0));
    const pend = base.filter((o) => o.st === 'Pending');
    const c = (s) => nOf(base, (o) => o.st === s);
    return pageHead('Overtime & Comp-Off (HR)', 'Approve, calculate and track overtime and compensatory off', `<button class="btn" onclick="LA.otExport()">${ic('download')} Export</button>`, 'Payroll & Output')
      + statStrip([
        { lbl: 'Pending approval', val: pend.length, icon: 'clock2', tone: pend.length ? 'a' : 'g', hint: pend.length ? `${R1(pend.reduce((a, o) => a + o.hours, 0))} hour(s) to decide` : 'Nothing pending' },
        { lbl: 'Normal hours', val: tot('Normal'), icon: 'clock', tone: 'g', hint: 'Approved · +25%' },
        { lbl: 'Night hours', val: tot('Night'), icon: 'sun', tone: 'p', hint: 'Approved · 10 PM–4 AM, +50%' },
        { lbl: 'Weekend / holiday hours', val: tot('Weekend'), icon: 'gift', tone: 'b', hint: 'Approved · day off or +50%' },
      ])
      + lcard('Overtime records', lb(L.searchBox('otQ', 'Search member, category or method') + chipSet('otStH', ['All', 'Pending', 'Approved', 'Rejected', 'Withdrawn'], 'All', (s) => (s === 'All' ? base.length : c(s))) + L.fSel('otCatH', 'Category', ['All categories', 'Normal (+25%)', 'Night 10PM–4AM (+50%)', 'Weekend / holiday'], 'All categories') + L.fDept('otDept') + L.fDate('otFromH', 'From') + L.fDate('otToH', 'To') + rst(['otDept', 'otStH', 'otCatH', 'otFromH', 'otToH', 'otQ']), `Showing ${rows.length} of ${base.length}`),
        ['Ref', 'Member', 'Location', 'Date', '>Hours', 'Category', 'Method', 'Status', 'Action'],
        rows.map((r) => `<tr><td class="mono fw6">${r.id}</td><td>${L.empCell(r.emp)}</td><td>${L.locChip(L.locOf(r.emp))}</td><td>${fmt(r.date)}</td><td class="num fw6">${r.hours.toFixed(1)}</td><td>${esc(r.cat)}</td><td class="muted">${esc(r.comp)}</td><td>${L.statusPill(r.st)}</td><td>${r.st === 'Pending' ? `<div class="hb"><button class="btn sm ok" onclick="LA.otHr('${r.id}','Approved')">Approve</button><button class="btn sm ghost" onclick="LA.otHr('${r.id}','Rejected')">Reject</button></div>` : `<span class="muted">${esc(r.by || '—')}</span>`}</td></tr>`).join('') || noRows(9, base.length, 'overtime records'), { sub: 'Latest first' })
      + SP + tableCard('Overtime calculation rules (FRS §19)', ['Category', 'Calculation rule'], [['Normal overtime', 'Basic hourly wage + at least 25%'], ['10:00 PM–4:00 AM', 'Basic hourly wage + at least 50% (shift-worker exclusion configurable)'], ['Weekend work', 'Alternative day off, or normal day wage + at least 50% of basic wage'], ['Compensation method', 'OT payment, special allowance, comp-off, alternative day off, or none with reason']].map((r) => `<tr><td class="fw6">${r[0]}</td><td class="muted">${r[1]}</td></tr>`).join(''))
      + SP + note('warn', 'Unapproved additional time must <b>not</b> automatically become payable overtime. Eligibility applies only to configured employee categories.');
  }
  L.otExport = () => L.csv('overtime.csv', ['Ref', 'Member', 'Location', 'Date', 'Hours', 'Category', 'Method', 'Status'], sc(db().ots).map((o) => [o.id, o.emp, L.locName(L.locOf(o.emp)), o.date, o.hours, o.cat, o.comp, o.st]));
  L.otHr = (id, out) => { const o = db().ots.find((x) => x.id === id); if (!o || o.st !== 'Pending') return; L.otSettle(o, out, 'HR decision'); toast(`${id} ${out.toLowerCase()}`); L.rr(); };

  /* ---------- policy (per location) ---------- */
  const PFIELDS = [['name', 'Policy name'], ['year', 'Effective year'], ['country', 'Country'], ['applicable', 'Applicable employees'], ['week', 'Working week'], ['off', 'Weekly off'], ['hours', 'Standard weekly hours'], ['probation', 'Probation period'], ['monitor', 'Monitoring period'], ['cycles', 'Payroll cycles'], ['approval', 'Primary approval authority'], ['override', 'Override authority']];
  const CONF = [['halfDay', 'Half-day minimum hours', 'Exact threshold', 'number'], ['fullDay', 'Full-day minimum hours', 'Exact threshold', 'number'], ['lateMin', 'Late-minute treatment', 'Warning / leave / salary deduction', 'text'], ['earlyDep', 'Early-departure treatment', 'Warning / leave / LOP', 'text'], ['partialAccrual', 'Partial-month leave accrual', 'Eligible-payday formula', 'text'], ['cfFlow', 'Carry-forward workflow', 'Manager only or +HR', 'text'], ['cfExpiry', 'Carry-forward expiry', '3-month date logic', 'text'], ['encFormula', 'Encashment formula', 'Gross / basic / component', 'text'], ['compRatio', 'Comp-off ratio', 'Hours per comp-off day', 'number'], ['compExpiry', 'Comp-off expiry', 'Days / months', 'text'], ['otRound', 'Overtime rounding', 'Minute increment', 'number'], ['specAllow', 'Special allowance', 'Fixed / formula', 'text'], ['unpaid7', '7-day unpaid conversion', 'Auto / HR-confirmed', 'text'], ['nursing', 'Nursing-break period', 'Eligibility duration', 'text'], ['reset', 'Occurrence reset', 'Reset / cumulative', 'text'], ['warnValid', 'Warning validity', '12 mo / separate', 'text']];
  L.polSave = (loc) => {
    const p = L.policyOf(loc); const next = {}; const e = [];
    PFIELDS.forEach(([k, l]) => { const v = __$('pol_' + k).value.trim(); if (!v) e.push(`${l} is required.`); next[k] = v; });
    if (!e.length && !/^\d{4}$/.test(next.year)) e.push('Effective year must be a 4-digit year.');
    if (e.length) { __$('polErr').innerHTML = `<div class="note warn" style="margin-bottom:14px">${ic('alert')}<div>${e.map(esc).join('<br>')}</div></div>`; return; }
    const changed = PFIELDS.filter(([k]) => p[k] !== next[k]);
    if (!changed.length) { toast('No changes to save'); return; }
    changed.forEach(([k, l]) => L.audit('Policy change', l, `${p[k]} → ${next[k]}`, 'Policy settings · ' + L.locCity(loc), loc));
    Object.assign(p, next); toast(`Policy saved for ${L.locCity(loc)} (${changed.length} change${changed.length > 1 ? 's' : ''})`); L.rr();
  };
  L.confSet = (loc, k) => {
    const c = CONF.find((x) => x[0] === k);
    const conf = L.confOf(loc);
    L.form({
      title: `${c[1]} · ${L.locCity(loc)}`, size: 'sm', submit: 'Confirm value', pre: `<p class="muted" style="margin-bottom:12px">${esc(c[2])}</p>`,
      fields: [{ k: 'v', label: 'Confirmed value', req: true, type: c[3], value: conf[k] || '', full: true, ...(c[3] === 'number' ? { step: '0.5', min: 0 } : {}) }],
      validate: (v) => (c[3] === 'number' && !(Number(v.v) > 0) ? ['Enter a number greater than zero.'] : []),
      onSubmit: (v) => { conf[k] = c[3] === 'number' ? Number(v.v) : v.v; L.audit('HR confirmation set', c[1], '— → ' + v.v, L.locCity(loc), loc); toast(`${c[1]} confirmed for ${L.locCity(loc)}`); L.rr(); },
    });
  };
  function setPolicy() {
    const loc = L.oneLoc('polLoc');
    const p = L.policyOf(loc);
    const conf = L.confOf(loc);
    const setN = nOf(CONF, ([k]) => conf[k] != null);
    return pageHead('Policy Settings', 'Configuration-driven attendance & leave policy — one policy per location', `<button class="btn" onclick="LA.rr()">Cancel</button><button class="btn pri" onclick="LA.polSave('${loc}')">Save policy</button>`, 'Configuration')
      + statStrip([
        { lbl: 'HR confirmations set', val: `${setN} / ${CONF.length}`, icon: 'check', tone: setN === CONF.length ? 'g' : 'a', hint: setN === CONF.length ? 'All values confirmed' : `${CONF.length - setN} still pending` },
        { lbl: 'Effective year', val: esc(p.year), icon: 'calendar', tone: 'b', hint: esc(p.name) },
        { lbl: 'Standard weekly hours', val: esc(p.hours), icon: 'clock', tone: 'p', hint: esc(p.week) },
        { lbl: 'Probation period', val: esc(p.probation), icon: 'shield', tone: 'x', hint: `Monitoring: ${esc(p.monitor)}` },
      ])
      + `<div class="card op2-solo">${lb(L.fSel('polLoc', 'Policy for location', L.locOptions(false), loc), `${esc(L.locCity(loc))} · ${esc(L.workLabel(loc))}`)}</div>`
      + `<div class="row"><div style="flex:1.3">${card('Company policy — ' + esc(L.locName(loc)) + ' (FRS §2)', `<div id="polErr"></div>${note('info', `Work week and hours for this location come from Settings: <b>${esc(L.workLabel(loc))}</b>.`)}<div class="form-row two" style="margin-top:12px">${PFIELDS.map(([k, l]) => `<div class="field"><label>${l}</label><input id="pol_${k}" type="text" value="${esc(p[k])}"></div>`).join('')}</div>`)}</div>
        <div style="flex:1">${card('HR confirmations required', note('warn', 'These policy values are <b>undefined in the FRS</b> and must be confirmed before final calculations. Click a row to set its value (FRS §28).') + `<div style="margin-top:12px">${CONF.map(([k, l, s]) => `<div class="lrow" style="padding:9px 0;cursor:pointer" onclick="LA.confSet('${loc}','${k}')"><div><div class="li-t" style="font-size:12.5px">${l}</div><div class="li-s">${conf[k] != null ? 'Confirmed: ' + esc(conf[k]) : s}</div></div><div class="li-r">${conf[k] != null ? bdg('s-g', '✓ Set') : phFlag('Pending')}</div></div>`).join('')}</div>`, { sub: `${setN} of ${CONF.length} confirmed` })}</div></div>`;
  }

  /* ---------- administration ---------- */
  L.coForm = (c) => L.form({
    title: c ? 'Edit company' : 'Add company', size: 'sm', submit: c ? 'Save' : 'Add company',
    fields: [{ k: 'name', label: 'Company name', req: true, type: 'text', value: c ? c.name : '', full: true }, { k: 'loc', label: 'Location', req: true, type: 'select', options: L.locOptions(), value: c ? c.loc : 'all' }, { k: 'branches', label: 'Branches', type: 'number', value: c ? c.branches : 1, min: 1 }, { k: 'policy', label: 'Policy version', type: 'text', value: c ? c.policy : 'Draft' }, { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Setup', 'Suspended'], value: c ? c.status : 'Setup' }],
    validate: (v) => (db().companies.some((x) => x.name.toLowerCase() === v.name.toLowerCase() && (!c || x.id !== c.id)) ? ['A company with that name exists.'] : []),
    onSubmit: (v) => { if (c) { Object.assign(c, { name: v.name, loc: v.loc, branches: Number(v.branches), policy: v.policy, status: v.status }); L.audit('Company updated', v.name, '—', ''); } else { db().companies.push({ id: 'C' + Date.now(), name: v.name, code: v.name.slice(0, 3).toUpperCase(), loc: v.loc, branches: Number(v.branches) || 1, policy: v.policy, status: v.status }); L.audit('Company added', v.name, '—', ''); } toast(`Company “${v.name}” saved`); L.rr(); },
  });
  function companies() {
    const q = L.ui('coQ', '');
    const sF = L.ui('coSt', 'All');
    const base = db().companies.filter((c) => L.loc() === 'all' || c.loc === 'all' || c.loc === L.loc());
    const rows = base.filter((c) => (sF === 'All' || c.status === sF) && L.matches(q, c.name, c.code));
    const heads = (c) => EMP.filter((e) => e.company === c.name && L.inLoc(e.n)).length;
    const c = (s) => nOf(base, (x) => x.status === s);
    return pageHead('Companies & Branches', 'Multi-company structure with company-level data separation', `<button class="btn pri" onclick="LA.coForm()">${ic('plus')} Add company</button>`, 'Administration')
      + statStrip([
        { lbl: 'Companies', val: base.length, icon: 'building', tone: 'b', hint: L.locLabel() },
        { lbl: 'Active', val: c('Active'), icon: 'check', tone: 'g', hint: `${c('Setup')} in setup · ${c('Suspended')} suspended` },
        { lbl: 'Branches', val: base.reduce((a, x) => a + (Number(x.branches) || 0), 0), icon: 'location', tone: 'p', hint: 'Across companies in view' },
        { lbl: 'Employees in view', val: base.reduce((a, x) => a + heads(x), 0), icon: 'users', tone: 'a', hint: 'Mapped to a company' },
      ])
      + lcard('Companies', lb(L.searchBox('coQ', 'Search company name or code') + chipSet('coSt', ['All', 'Active', 'Setup', 'Suspended'], 'All', (s) => (s === 'All' ? base.length : c(s))) + rst(['coSt', 'coQ']), `Showing ${rows.length} of ${base.length}`),
        ['Company', 'Location', '>Branches', '>Employees', 'Policy version', 'Status', ''],
        rows.map((r) => `<tr><td>${personCell(esc(r.name), esc(r.code || ''))}</td><td class="muted">${r.loc === 'all' ? 'All locations' : esc(L.locName(r.loc))}</td><td class="num">${r.branches}</td><td class="num">${heads(r) || '—'}</td><td>${bdg('s-b', esc(r.policy))}</td><td>${r.status === 'Active' ? bdg('s-g', 'Active') : r.status === 'Suspended' ? bdg('s-r', 'Suspended') : bdg('s-a', esc(r.status))}</td><td class="tr"><button class="btn sm ghost" title="Edit" onclick="LA.coForm(LA.db().companies.find(c=>c.id==='${r.id}'))">${ic('edit')}</button></td></tr>`).join('') || noRows(7, base.length, 'companies'), { actions: `<button class="btn sm ghost" onclick="LA.openApp('/admin/companies')">Manage in Administration ↗</button>` })
      + SP + note('info', 'Companies and locations are maintained in the main Administration area; this view shows how attendance policy is applied to them.');
  }
  L.roleTog = (i, c) => { const r = db().roles[i]; const cyc = { y: 'n', n: 'partial', partial: 'y' }; const before = r[c]; r[c] = cyc[before] || 'y'; L.audit('Permission changed', r[0], `${['', 'Employee', 'Manager', 'HR Admin', 'Super Admin'][c]}: ${before} → ${r[c]}`, ''); toast('Permission updated'); L.rr(); };
  function rolesPerms() {
    const q = L.ui('rlQ', '');
    const fF = L.ui('rlF', 'All');
    const base = db().roles.map((r, i) => ({ r, i }));
    const scoped = ({ r }) => [1, 2, 3].some((c) => r[c] === 'partial');
    const adminOnly = ({ r }) => [1, 2, 3].every((c) => r[c] === 'n') && r[4] === 'y';
    const rows = base.filter((x) => (fF === 'All' || (fF === 'Has scoped access' ? scoped(x) : adminOnly(x))) && L.matches(q, x.r[0]));
    const scopedCells = base.reduce((a, { r }) => a + [1, 2, 3].filter((c) => r[c] === 'partial').length, 0);
    return pageHead('Roles & Permissions', 'Role-based access control across the module (FRS §3)', '', 'Administration')
      + statStrip([
        { lbl: 'Capabilities', val: base.length, icon: 'key', tone: 'b', hint: 'Rows in the permission matrix' },
        { lbl: 'Open to employees', val: nOf(base, ({ r }) => r[1] === 'y'), icon: 'users', tone: 'g', hint: 'Self-service capabilities' },
        { lbl: 'Scoped permissions', val: scopedCells, icon: 'filter', tone: 'a', hint: 'Limited to own team or location' },
        { lbl: 'Admin-only', val: nOf(base, adminOnly), icon: 'lock', tone: 'p', hint: 'Super Admin exclusive' },
      ])
      + note('info', 'Click a cell to change a role’s access (✓ → scoped → none). The Super Admin column is locked.')
      + SP
      + lcard('Permission matrix', lb(L.searchBox('rlQ', 'Search capability') + chipSet('rlF', ['All', 'Has scoped access', 'Admin-only'], 'All', (s) => (s === 'All' ? base.length : s === 'Admin-only' ? nOf(base, adminOnly) : nOf(base, scoped))) + rst(['rlF', 'rlQ']), `Showing ${rows.length} of ${base.length}`),
        ['Capability', 'Employee', 'Manager', 'HR Admin', 'Super Admin'],
        rows.map(({ r, i }) => `<tr><td class="fw6">${r[0]}</td>${[1, 2, 3, 4].map((c) => `<td ${c < 4 ? `class="op2-cell" title="Click to change" onclick="LA.roleTog(${i},${c})"` : 'title="Locked"'}>${r[c] === 'y' ? bdg('s-g', '✓') : r[c] === 'partial' ? bdg('s-a', 'Scoped') : bdg('s-gray', '—')}</td>`).join('')}</tr>`).join('') || noRows(5, base.length, 'capabilities'))
      + SP + note('info', 'Access includes company-level data separation, encryption, session timeout, device authorization and restricted access to medical information (FRS §25).');
  }
  L.devNew = () => L.form({
    title: 'Register device', size: 'sm', submit: 'Register',
    fields: [{ k: 'loc', label: 'Location', req: true, type: 'select', options: L.locOptions(false), value: L.loc() === 'all' ? L.myLoc() : L.loc(), full: true }, { k: 'id', label: 'Device ID', req: true, type: 'text', ph: 'BIO-DXB-04', full: true }, { k: 'place', label: 'Placement', req: true, type: 'text', full: true }, { k: 'mapped', label: 'Mapped employees', type: 'number', value: 0, min: 0 }],
    validate: (v) => (db().devices.some((d) => d.id.toLowerCase() === v.id.toLowerCase()) ? ['That device ID is already registered.'] : !/^[A-Za-z0-9-]{4,}$/.test(v.id) ? ['Device ID may contain letters, numbers and dashes.'] : []),
    onSubmit: (v) => { db().devices.push({ id: v.id.toUpperCase(), loc: v.loc, place: v.place, mapped: Number(v.mapped) || 0, sync: 'Never', online: true }); L.audit('Device registered', v.id.toUpperCase(), '—', v.place, v.loc); toast('Device registered'); L.rr(); },
  });
  L.devTog = (id) => { const d = db().devices.find((x) => x.id === id); d.online = !d.online; L.audit(d.online ? 'Device online' : 'Device offline', id, '—', '', d.loc); toast(`${id} ${d.online ? 'online' : 'offline'}`); L.rr(); };
  L.devSync = (id) => { const d = db().devices.find((x) => x.id === id); if (!d.online) { toast('Device is offline'); return; } const n = new Date(); d.sync = `${L.fmtS(TODAY)} ${pad(n.getHours())}:${pad(n.getMinutes())}`; L.audit('Device synced', id, '—', '', d.loc); toast(`${id} synced`); L.rr(); };
  L.devDel = (id) => { const d = db().devices.find((x) => x.id === id); L.confirm('Remove device', `Remove <b>${esc(id)}</b> from the registry?`, 'Remove', () => { db().devices = db().devices.filter((x) => x.id !== id); L.audit('Device removed', id, '—', '', d.loc); L.rr(); }, true); };
  L.punchRe = (i) => { const p = db().rawPunches[i]; if (!p.st.startsWith('Failed')) return; p.st = 'Processed'; L.audit('Punch reprocessed', p.emp, 'Failed → Processed', '', p.loc); toast('Punch reprocessed'); L.rr(); };
  function biometric() {
    const q = L.ui('bdQ', '');
    const sF = L.ui('bdSt', 'All');
    const pq = L.ui('pnQ', '');
    const pF = L.ui('pnSt', 'All');
    const base = db().devices.filter((d) => L.hasLoc([d.loc]));
    const devs = base.filter((d) => (sF === 'All' || (sF === 'Online') === d.online) && L.matches(q, d.id, d.place));
    const pAll = db().rawPunches.map((r, i) => ({ r, i })).filter(({ r }) => L.hasLoc([r.loc]));
    const failed = (r) => String(r.st).includes('Failed');
    const punches = pAll.filter(({ r }) => (pF === 'All' || (pF === 'Failed') === failed(r)) && L.matches(pq, r.ts, r.emp, r.dev, r.type));
    const on = nOf(base, (d) => d.online);
    const nFail = nOf(pAll, ({ r }) => failed(r));
    return pageHead('Biometric Devices', 'Device registry, employee mapping and raw punch logs', `<button class="btn pri" onclick="LA.devNew()">${ic('plus')} Register device</button>`, 'Administration')
      + statStrip([
        { lbl: 'Registered devices', val: base.length, icon: 'device', tone: 'b', hint: L.locLabel() },
        { lbl: 'Online', val: on, icon: 'check', tone: 'g', hint: `${base.length ? Math.round((on / base.length) * 100) : 0}% availability` },
        { lbl: 'Offline', val: base.length - on, icon: 'alert', tone: base.length - on ? 'r' : 'x', hint: base.length - on ? 'Check connectivity' : 'All devices reachable' },
        { lbl: 'Failed punches', val: nFail, icon: 'refresh', tone: nFail ? 'a' : 'g', hint: nFail ? 'Can be reprocessed' : 'All punches processed' },
      ])
      + lcard('Registered devices', lb(L.searchBox('bdQ', 'Search device or placement') + chipSet('bdSt', ['All', 'Online', 'Offline'], 'All', (s) => (s === 'All' ? base.length : nOf(base, (d) => d.online === (s === 'Online')))) + rst(['bdSt', 'bdQ']), `Showing ${devs.length} of ${base.length}`),
        ['Device', 'Location', '>Mapped employees', 'Last sync', 'Status', ''],
        devs.map((r) => `<tr><td><div class="op2-dev"><span class="op2-dev-i ${r.online ? '' : 'off'}">${ic('device')}</span><div><div class="fw6 mono">${esc(r.id)}</div><div class="op2-sec">${esc(r.place || r.loc)}</div></div></div></td><td>${L.locChip(r.loc)}</td><td class="num">${r.mapped}</td><td class="mono muted" style="font-size:12px">${esc(r.sync)}</td><td><span style="cursor:pointer" title="Click to toggle" onclick="LA.devTog('${r.id}')">${r.online ? bdg('s-g', 'Online') : bdg('s-r', 'Offline')}</span></td><td class="tr"><div class="hb" style="justify-content:flex-end"><button class="btn sm ghost" onclick="LA.devSync('${r.id}')">${ic('refresh')} Sync</button><button class="btn sm ghost" title="Remove" onclick="LA.devDel('${r.id}')">${ic('x')}</button></div></td></tr>`).join('') || noRows(6, base.length, 'devices'))
      + SP
      + lcard('Recent raw punches (immutable)', lb(L.searchBox('pnQ', 'Search time, employee ID or device') + chipSet('pnSt', ['All', 'Failed', 'Processed'], 'All', (s) => (s === 'All' ? pAll.length : nOf(pAll, ({ r }) => failed(r) === (s === 'Failed')))) + rst(['pnSt', 'pnQ']), `Showing ${punches.length} of ${pAll.length}`),
        ['Timestamp', 'Employee ID', 'Location', 'Device', 'Type', 'Processing', ''],
        punches.map(({ r, i }) => `<tr><td class="mono" style="font-size:12px">${esc(r.ts)}</td><td class="mono">${esc(r.emp)}</td><td>${L.locChip(r.loc)}</td><td class="mono muted">${esc(r.dev)}</td><td>${bdg(r.type === 'IN' ? 's-g' : 's-a', r.type)}</td><td>${r.st.includes('Failed') ? bdg('s-r', esc(r.st)) : bdg('s-g', esc(r.st))}</td><td class="tr">${r.st.includes('Failed') ? `<button class="btn sm" onclick="LA.punchRe(${i})">Reprocess</button>` : ''}</td></tr>`).join('') || noRows(7, pAll.length, 'punches'), { sub: 'Raw records are never overwritten' });
  }
  const rand = () => Array.from({ length: 24 }, () => 'abcdef0123456789'[Math.floor(Math.random() * 16)]).join('');
  L.keyRotate = () => L.confirm('Rotate API key', 'The current key stops working immediately. Update every integration with the new key.', 'Rotate key', () => {
    const k = 'gsit_live_' + rand();
    db().apiKey = { masked: k.slice(0, 10) + '••••••••' + k.slice(-4), rotated: TODAY };
    L.audit('API key rotated', 'Attendance API', '—', 'Manual');
    window.__newKey = k;
    openModal(modalShell('New API key', `<p class="muted" style="margin-bottom:10px">Copy it now — it will not be shown again.</p><div class="mono" id="newKey" style="background:var(--bg);padding:12px;border-radius:9px;word-break:break-all;font-size:13px">${k}</div>`, `<button class="btn" onclick="closeModal();LA.rr()">Done</button><button class="btn pri" onclick="LA.copyKey()">Copy key</button>`, 'sm'));
  }, true);
  L.copyKey = () => { try { navigator.clipboard.writeText(window.__newKey); toast('Key copied'); } catch { toast('Copy failed — select the key manually'); } };
  L.syncSet = (i, v) => { const s = db().sync[i]; L.audit('Sync schedule changed', s[0], `${s[1]} → ${v}`, ''); s[1] = v; toast(`${s[0]}: ${v}`); L.rr(); };
  L.syncRun = (i) => { const n = new Date(); db().sync[i][2] = `${pad(n.getHours())}:${pad(n.getMinutes())}`; L.audit('Sync job run', db().sync[i][0], '—', 'Manual'); toast(`${db().sync[i][0]} completed`); L.rr(); };
  function integrations() {
    const k = db().apiKey || {};
    const age = k.rotated ? daysBetween(k.rotated, TODAY) : null;
    const jobs = db().sync || [];
    const ran = nOf(jobs, (s) => !!s[2]);
    return pageHead('API & Integrations', 'Punch submission, employee/shift sync and webhooks', '', 'Administration')
      + statStrip([
        { lbl: 'API status', val: 'Connected', icon: 'plug', tone: 'g', hint: 'Bearer token authentication' },
        { lbl: 'Key age', val: age == null ? '—' : `${age} day${age === 1 ? '' : 's'}`, icon: 'key', tone: age != null && age > 90 ? 'a' : 'b', hint: age != null && age > 90 ? 'Consider rotating the key' : k.rotated ? `Rotated ${fmt(k.rotated)}` : 'Not yet rotated' },
        { lbl: 'Sync jobs', val: jobs.length, icon: 'refresh', tone: 'p', hint: ran ? `${ran} with a recorded run` : 'No runs recorded' },
        { lbl: 'Rate limit', val: '600 / min', icon: 'chart', tone: 'x', hint: 'Per API key' },
      ])
      + `<div class="grid g-2">${card('API access', `<div class="dl"><dt>Endpoint</dt><dd class="mono" style="font-size:12px">/api/v1/attendance/punch</dd><dt>Auth</dt><dd>Bearer token (secure)</dd><dt>Key</dt><dd class="mono" style="font-size:12px">${esc(k.masked)}</dd><dt>Last rotated</dt><dd>${fmt(k.rotated)}</dd><dt>Rate limit</dt><dd>600 / min</dd><dt>Status</dt><dd>${bdg('s-g', 'Connected')}</dd></div><div class="divider"></div><button class="btn" onclick="LA.keyRotate()">${ic('key')} Rotate key</button>`, { sub: 'Punch submission' })}
      ${card('Sync jobs', jobs.map((s, i) => `<div class="lrow"><span class="li-ic" style="background:var(--b-bg);color:var(--b)">${ic('refresh')}</span><div><div class="li-t">${esc(s[0])}</div><div class="li-s">${s[2] ? `Last run ${esc(s[2])}` : 'Not run yet'}</div></div><div class="li-r hb"><select onchange="LA.syncSet(${i},this.value)" style="height:30px">${['Hourly', '06:00 daily', 'Weekly', 'Monthly · manual'].map((o) => `<option ${o === s[1] ? 'selected' : ''}>${o}</option>`).join('')}</select><button class="btn sm ghost" onclick="LA.syncRun(${i})">Run now</button></div></div>`).join('') || L.empty('No sync jobs configured'), { sub: `${jobs.length} job(s)` })}</div>`
      + SP + note('info', 'API-based punch submission preserves raw records and supports error handling and reprocessing. Secure APIs, device authorization and session timeout apply (FRS §5, §25).');
  }

  /* ---------- wire up + retire legacy toasts ---------- */
  Object.assign(VIEWS, { 'set-status': setStatus, 'set-shift': setShift, 'set-ramadan': setRamadan, 'set-leavetypes': setLeaveTypes, 'doc-verify': docVerify, 'balance-adj': balanceAdj, 'carry-forward': carryForward, encashment, maternity, 'set-holidays': setHolidays, 'set-workflows': setWorkflows, 'hr-ot': hrOt, 'set-policy': setPolicy, companies, 'roles-perms': rolesPerms, biometric, integrations });
  const baseGo = window.go;
  window.go = (k) => { if (SVC_INDEX[k] || ['my-attendance', 'checkin', 'regularization', 'ee-requests', 'leave-balances', 'apply-leave', 'al-plan', 'leave-history', 'ot-compoff', 'holidays', 'team-attendance', 'team-leave-cal', 'approvals', 'reports'].includes(k) || Object.keys(SVC_INDEX).some((s) => SVC_INDEX[s].view === k)) baseGo(k); };
  window.openSettings = () => { MODULE = 'operations'; SCOPE = null; TAB = null; OPS = 'policy'; renderAll(); };
  window.openQuickAdd = function () {
    const acts = [['clock', L.isIn() ? 'Check-out' : 'Check-in', () => { closeModal(); LA.punch(); }], ['plus', 'Apply leave', () => { closeModal(); LA.applyLeave(); }], ['edit', 'Regularize', () => { closeModal(); LA.regNew(''); }], ['clock2', 'Request overtime', () => { closeModal(); LA.otNew(); }]];
    window.__qa = acts;
    openModal(modalShell('Quick actions', `<div class="grid g-2">${acts.map((a, i) => `<div class="card" style="cursor:pointer" onclick="window.__qa[${i}][2]()"><div class="card-b" style="text-align:center;padding:20px"><div style="margin:0 auto 8px;width:40px;height:40px;background:var(--brand-050);color:var(--brand);border-radius:11px;display:grid;place-items:center">${ic(a[0])}</div><div class="fw6" style="font-size:13px">${a[1]}</div></div></div>`).join('')}</div>`, false, 'sm'));
  };
  void addD;
})();
