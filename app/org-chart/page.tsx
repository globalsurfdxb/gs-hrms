'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { EMPLOYEES } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { Employee } from '@/lib/types';
import { canEditEmployees, saveEmployee, toForm, useEmployeeVersion } from '@/lib/employeeStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { BuildingIcon, ChevronDownIcon, ChevronRightIcon, PeopleIcon, SearchIcon, TagIcon, TreeIcon, XIcon } from '@/components/icons';

const PALETTE = [
  { bg: '#e7f0fc', fg: '#2f6fd6' },
  { bg: '#f0eafc', fg: '#7a4bd0' },
  { bg: '#e7f6ee', fg: '#1f9d63' },
  { bg: '#fdf3df', fg: '#c6851b' },
  { bg: '#fce9e7', fg: '#d5493f' },
  { bg: '#e3f4f8', fg: '#0e8fa8' },
];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const hashColor = (s: string) => PALETTE[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];

type Tab = 'chart' | 'depts' | 'desig';

export default function OrgStructurePage() {
  const { companies, departments, designations, locations, locationName, locationsLabel } = useOrg();
  const [tab, setTab] = useState<Tab>('chart');
  const [scope, setScope] = useState<string>('all');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const empVersion = useEmployeeVersion();
  const { role } = useApp();
  const me = useCurrentEmployee();
  const canMove = canEditEmployees(role);

  // drag a card onto another to change who someone reports to; drag the background to pan
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; to: string | null } | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; l: number; t: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(id);
  }, [toast]);

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? 'Unknown company';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const people = useMemo(() => EMPLOYEES.filter((e) => e.employmentStatus !== 'Inactive' && (scope === 'all' || e.location === scope)), [scope, empVersion]);
  const byId = useMemo(() => new Map(people.map((e) => [e.id, e])), [people]);
  const kids = useMemo(() => {
    const m = new Map<string, Employee[]>();
    people.forEach((e) => {
      if (e.reportingManagerId && byId.has(e.reportingManagerId)) m.set(e.reportingManagerId, [...(m.get(e.reportingManagerId) ?? []), e]);
    });
    return m;
  }, [people, byId]);
  const roots = people.filter((e) => !e.reportingManagerId || !byId.has(e.reportingManagerId));

  const depthOf = (id: string): number => 1 + Math.max(0, ...(kids.get(id) ?? []).map((k) => depthOf(k.id)));
  const levels = roots.length ? Math.max(...roots.map((r) => depthOf(r.id))) : 0;
  const managers = people.filter((e) => (kids.get(e.id) ?? []).length > 0).length;

  const scopedDepts = departments.filter((d) => scope === 'all' || d.locations.includes(scope));
  const scopedDeptIds = new Set(scopedDepts.map((d) => d.id));
  const scopedDesigs = designations.filter((d) => scopedDeptIds.has(d.departmentId));
  const deptNames = [...new Set(scopedDepts.map((d) => d.name))];

  const needle = q.trim().toLowerCase();
  const active = needle.length > 0 || dept !== 'all';
  const isHit = (e: Employee) =>
    (!needle || `${e.name} ${e.designation} ${e.employeeCode} ${e.department}`.toLowerCase().includes(needle)) && (dept === 'all' || e.department === dept);
  const hits = people.filter(isHit);
  // Anyone above a match stays open so the match is visible.
  const forceOpen = useMemo(() => {
    const s = new Set<string>();
    if (!active) return s;
    hits.forEach((h) => {
      let m = h.reportingManagerId ? byId.get(h.reportingManagerId) : undefined;
      while (m) {
        s.add(m.id);
        m = m.reportingManagerId ? byId.get(m.reportingManagerId) : undefined;
      }
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, needle, dept, people]);

  const isCollapsed = (id: string) => !forceOpen.has(id) && !!collapsed[id];
  const flip = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const setAll = (collapse: boolean) => setCollapsed(Object.fromEntries(people.filter((e) => (kids.get(e.id) ?? []).length).map((e) => [e.id, collapse])));

  const openDeptInChart = (name: string) => {
    setDept(name);
    setQ('');
    setTab('chart');
  };

  const headcount = (companyId: string, deptName: string, title?: string) =>
    people.filter((e) => e.company === companyName(companyId) && e.department === deptName && (title === undefined || e.designation === title)).length;
  const headRec = (name: string) => EMPLOYEES.find((e) => e.name === name);

  const emp = (id: string) => EMPLOYEES.find((x) => x.id === id);
  /** A card can be dropped on anyone except itself, its current manager, or someone below it (that would be a loop). */
  const canDropOn = (dragId: string, targetId: string) => {
    const d = emp(dragId);
    if (!d || dragId === targetId || d.reportingManagerId === targetId) return false;
    const seen = new Set<string>();
    let t = emp(targetId);
    while (t && !seen.has(t.id)) {
      if (t.id === dragId) return false;
      seen.add(t.id);
      t = t.reportingManagerId ? emp(t.reportingManagerId) : undefined;
    }
    return true;
  };
  const setManager = (id: string, to: string | null) => {
    const d = emp(id);
    if (!d) return;
    const form = toForm(d);
    form.v.reportingManagerId = to ?? '';
    saveEmployee(id, form, me.name);
  };
  const confirmMove = () => {
    if (!pending) return;
    const d = emp(pending.id);
    if (!d) return setPending(null);
    const prev = d.reportingManagerId;
    setManager(pending.id, pending.to);
    const target = pending.to ? emp(pending.to)?.name : null;
    setToast({
      text: target ? `${d.name} now reports to ${target}.` : `${d.name} no longer has a manager.`,
      undo: () => {
        setManager(d.id, prev);
        setToast({ text: 'Change undone.' });
      },
    });
    setPending(null);
  };
  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };

  const renderNode = (e: Employee): React.ReactNode => {
    const reports = kids.get(e.id) ?? [];
    const closed = isCollapsed(e.id);
    const col = hashColor(e.department);
    const outside = e.reportingManagerId && !byId.has(e.reportingManagerId) ? EMPLOYEES.find((m) => m.id === e.reportingManagerId) : undefined;
    const hit = active && isHit(e);
    return (
      <li key={e.id}>
        <div
          className={`oc-card ${hit ? 'hit' : ''} ${active && !hit ? 'dim' : ''} ${canMove ? 'movable' : ''} ${drag === e.id ? 'dragging' : ''} ${drag && over === e.id && drag !== e.id ? (canDropOn(drag, e.id) ? 'drop-ok' : 'drop-no') : ''}`}
          draggable={canMove}
          onDragStart={(ev) => {
            ev.dataTransfer.setData('text/plain', e.id);
            ev.dataTransfer.effectAllowed = 'move';
            setTimeout(() => setDrag(e.id), 0);
          }}
          onDragEnd={endDrag}
          onDragEnter={() => drag && setOver(e.id)}
          onDragOver={(ev) => {
            if (drag && canDropOn(drag, e.id)) {
              ev.preventDefault();
              ev.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(ev) => {
            ev.preventDefault();
            if (drag && canDropOn(drag, e.id)) setPending({ id: drag, to: e.id });
            endDrag();
          }}
        >
          <Link href={`/directory/${e.employeeCode}`} className="oc-who" draggable={false}>
            <span className="oc-av" style={{ background: col.bg, color: col.fg }}>
              {e.avatarInitials}
            </span>
            <span className="oc-nm">{e.name}</span>
            <span className="oc-ds">{e.designation}</span>
          </Link>
          <div className="oc-tags">
            <span className="oc-tag" style={{ background: col.bg, color: col.fg }}>
              {e.department}
            </span>
            {scope === 'all' && <span className="oc-tag loc">{e.location}</span>}
            {e.employmentStatus === 'Onboarding' && <span className="oc-tag warn">Onboarding</span>}
          </div>
          {outside && (
            <div className="oc-up" title={`Reports to ${outside.name} (${outside.location})`}>
              ↑ {outside.name} · {outside.location}
            </div>
          )}
          {reports.length > 0 && (
            <button type="button" className="oc-tog" onClick={() => flip(e.id)} aria-expanded={!closed} title={closed ? 'Show reports' : 'Hide reports'}>
              {closed ? <ChevronRightIcon /> : <ChevronDownIcon />} {reports.length}
            </button>
          )}
        </div>
        {reports.length > 0 && !closed && (
          <ul>
            {reports.map((r) => renderNode(r))}
          </ul>
        )}
      </li>
    );
  };

  const stats = [
    { n: people.length, l: 'People', ic: <PeopleIcon />, c: { bg: '#e7f0fc', fg: '#2f6fd6' } },
    { n: scopedDepts.length, l: 'Departments', ic: <BuildingIcon />, c: { bg: '#f0eafc', fg: '#7a4bd0' } },
    { n: scopedDesigs.length, l: 'Designations', ic: <TagIcon />, c: { bg: '#e7f6ee', fg: '#1f9d63' } },
    { n: levels, l: `Reporting level${levels === 1 ? '' : 's'} · ${plural(managers, 'manager')}`, ic: <TreeIcon />, c: { bg: '#fdf3df', fg: '#c6851b' } },
  ];

  const scopeLabel = scope === 'all' ? 'all locations' : locationName(scope);

  return (
    <div>
      <PageHeader
        eyebrow="Organization"
        title="Organisational Structure"
        description={`Who reports to whom, and how departments and designations are laid out — ${scopeLabel}.`}
        actions={
          <Link href="/admin/structure" className="btn ghost">
            Manage in Administration
          </Link>
        }
      />

      <div className="rp-stats">
        {stats.map((s) => (
          <div key={s.l} className="rp-stat">
            <span className="rp-stat-ic" style={{ background: s.c.bg, color: s.c.fg }}>
              {s.ic}
            </span>
            <div>
              <div className="rp-stat-n">{s.n}</div>
              <div className="rp-stat-l">{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="oc-bar">
        <div className="subseg" style={{ margin: 0 }}>
          <button className={tab === 'chart' ? 'on' : ''} onClick={() => setTab('chart')}>
            Organisational chart
          </button>
          <button className={tab === 'depts' ? 'on' : ''} onClick={() => setTab('depts')}>
            Departments
          </button>
          <button className={tab === 'desig' ? 'on' : ''} onClick={() => setTab('desig')}>
            Designations
          </button>
        </div>
        <div className="subseg" style={{ margin: 0 }} role="group" aria-label="Location scope">
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
            All locations
          </button>
          {locations.map((l) => (
            <button key={l.id} className={scope === l.id ? 'on' : ''} onClick={() => setScope(l.id)}>
              {l.name}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="tbar" style={{ padding: '12px 16px' }}>
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'chart' ? 'Find a person, role or ID…' : tab === 'depts' ? 'Find a department or head…' : 'Find a designation…'} />
          </div>
          {tab === 'chart' && (
            <>
              <select className="oc-sel" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
                <option value="all">All departments</option>
                {deptNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {active && (
                <button type="button" className="chip" onClick={() => (setQ(''), setDept('all'))}>
                  <XIcon /> Clear · {plural(hits.length, 'match', 'matches')}
                </button>
              )}
              <span className="sp" />
              <span className="oc-zoom" role="group" aria-label="Zoom">
                <button type="button" onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))} disabled={zoom <= 0.6} aria-label="Zoom out">
                  −
                </button>
                <button type="button" className="oc-zv" onClick={() => setZoom(1)} title="Reset zoom">
                  {Math.round(zoom * 100)}%
                </button>
                <button type="button" onClick={() => setZoom((z) => Math.min(1.4, Math.round((z + 0.1) * 10) / 10))} disabled={zoom >= 1.4} aria-label="Zoom in">
                  +
                </button>
              </span>
              <button type="button" className="chip" onClick={() => setAll(false)}>
                Expand all
              </button>
              <button type="button" className="chip" onClick={() => setAll(true)}>
                Collapse all
              </button>
            </>
          )}
        </div>

        {tab === 'chart' &&
          (!roots.length ? (
            <EmptyState icon={<TreeIcon />} title="No hierarchy to show" description={`No employees found for ${scopeLabel}.`} />
          ) : (
            <div className="oc-stage">
              <div className="oc-hint">{canMove ? 'Drag a card onto another to change who they report to. Drag the background to move around.' : 'Drag the background to move around.'}</div>
              {canMove && drag && emp(drag)?.reportingManagerId && (
                <div
                  className={`oc-rootdrop ${over === '__root' ? 'over' : ''}`}
                  onDragEnter={() => setOver('__root')}
                  onDragOver={(ev) => ev.preventDefault()}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setPending({ id: drag, to: null });
                    endDrag();
                  }}
                >
                  Drop here to remove their manager (top level)
                </div>
              )}
            <div
              ref={wrapRef}
              className={`oc-wrap ${panning ? 'panning' : ''}`}
              onPointerDown={(ev) => {
                if (ev.button !== 0 || (ev.target as HTMLElement).closest('.oc-card, a, button, input, select')) return;
                const w = wrapRef.current;
                if (!w) return;
                pan.current = { x: ev.clientX, y: ev.clientY, l: w.scrollLeft, t: w.scrollTop };
                setPanning(true);
                w.setPointerCapture(ev.pointerId);
              }}
              onPointerMove={(ev) => {
                const p = pan.current;
                const w = wrapRef.current;
                if (!p || !w) return;
                w.scrollLeft = p.l - (ev.clientX - p.x);
                w.scrollTop = p.t - (ev.clientY - p.y);
              }}
              onPointerUp={() => ((pan.current = null), setPanning(false))}
              onPointerCancel={() => ((pan.current = null), setPanning(false))}
            >
              <ul className="oc-tree" style={{ zoom }}>
                {roots.map((r) => renderNode(r))}
              </ul>
              {active && !hits.length && <div className="oc-none">Nobody matches the current search or department filter.</div>}
            </div>
            </div>
          ))}

        {tab === 'depts' && (
          <div className="oc-grid">
            {scopedDepts
              .filter((d) => !needle || `${d.name} ${d.head} ${companyName(d.companyId)}`.toLowerCase().includes(needle))
              .map((d, i) => {
                const col = PALETTE[i % PALETTE.length];
                const head = headRec(d.head);
                const n = headcount(d.companyId, d.name);
                return (
                  <div key={d.id} className="oc-dept">
                    <div className="oc-dept-h">
                      <span className="oc-tile" style={{ background: col.bg, color: col.fg }}>
                        <BuildingIcon />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="oc-dept-n">{d.name}</div>
                        <div className="oc-dept-s">{companyName(d.companyId)}</div>
                      </div>
                      <span className="oc-count">{n}</span>
                    </div>
                    <div className="oc-head">
                      {head ? (
                        <Link href={`/directory/${head.employeeCode}`} className="oc-head-l">
                          <span className="oc-av sm" style={{ background: col.bg, color: col.fg }}>
                            {head.avatarInitials}
                          </span>
                          {head.name}
                        </Link>
                      ) : (
                        <span className="oc-head-l muted">{d.head === 'Unassigned' ? 'No head assigned' : d.head}</span>
                      )}
                      <small>Head</small>
                    </div>
                    <div className="oc-dept-f">
                      <span>{locationsLabel(d.locations)}</span>
                      <button type="button" className="oc-link" onClick={() => openDeptInChart(d.name)} disabled={n === 0}>
                        View in chart
                      </button>
                    </div>
                  </div>
                );
              })}
            {!scopedDepts.length && <EmptyState icon={<BuildingIcon />} title="No departments" description={`None are set up for ${scopeLabel}.`} />}
          </div>
        )}

        {tab === 'desig' && (
          <div className="oc-groups">
            {scopedDepts
              .map((d, i) => ({ d, i, list: scopedDesigs.filter((x) => x.departmentId === d.id && (!needle || x.title.toLowerCase().includes(needle) || d.name.toLowerCase().includes(needle))) }))
              .filter((g) => g.list.length)
              .map(({ d, i, list }) => {
                const col = PALETTE[i % PALETTE.length];
                return (
                  <div key={d.id} className="oc-group">
                    <div className="oc-group-h">
                      <span className="oc-tile sm" style={{ background: col.bg, color: col.fg }}>
                        <BuildingIcon />
                      </span>
                      <b>{d.name}</b>
                      <span>
                        {companyName(d.companyId)} · {plural(list.length, 'designation')}
                      </span>
                    </div>
                    <div className="oc-chips">
                      {list.map((x) => {
                        const n = headcount(d.companyId, d.name, x.title);
                        return (
                          <span key={x.id} className={`oc-chip ${n ? '' : 'vacant'}`} title={n ? `${plural(n, 'person', 'people')}` : 'Nobody holds this designation'}>
                            {x.title}
                            <em>{n}</em>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            {!scopedDesigs.length && <EmptyState icon={<TagIcon />} title="No designations" description={`None are set up for ${scopeLabel}.`} />}
          </div>
        )}
      </Card>

      {pending && (
        <div className="oc-confirm" role="alertdialog" aria-label="Confirm change of manager">
          <div>
            {pending.to ? (
              <>
                Make <b>{emp(pending.id)?.name}</b> report to <b>{emp(pending.to)?.name}</b>?
              </>
            ) : (
              <>
                Remove the manager of <b>{emp(pending.id)?.name}</b> so they sit at the top level?
              </>
            )}
            <small>
              Currently reports to {emp(pending.id)?.reportingManagerId ? emp(emp(pending.id)!.reportingManagerId!)?.name : 'no one'}. Saved to the employee record and logged in Audit Logs.
            </small>
          </div>
          <button type="button" className="btn ghost sm" onClick={() => setPending(null)}>
            Cancel
          </button>
          <button type="button" className="btn primary sm" onClick={confirmMove} autoFocus>
            Move
          </button>
        </div>
      )}
      {toast && (
        <div className="oc-toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" onClick={toast.undo}>
              Undo
            </button>
          )}
          <button type="button" className="x" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
