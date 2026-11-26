'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SearchIcon } from '@/components/icons';
import { Button } from '@/components/ui/Card';
import { StageBadge, RejectDialog, fmtDate } from '@/components/hiring/HiringBits';
import { errorMessage } from '@/lib/api';
import { can } from '@/lib/access';
import { usePermissions } from '@/lib/auth';
import { daysBetween, todayISO } from '@/lib/dates';
import { EXITS, Exit, SOURCES, STAGES, Stage } from '@/lib/hiringTypes';
import type { ServerJobDetail as JobData } from '@/lib/jobsApi';
import { EXIT_CODE, EXIT_OF, ROUND_OF, SOURCE_OF, STAGE_CODE, STAGE_OF, ServerApplication, ServerApplicationDetail, candidatesApi, pipelineApi } from '@/lib/candidatesApi';

/* One job's pipeline from the backend (local development): the board and the list, as in Pipeline.tsx. Every
   application on the job is loaded once (the server allows 200 a page; a job has far fewer), so the stage strip,
   filters, sort and paging work on that list here. Moves, close-outs and reopening go to the server one candidate at a
   time; its answer replaces the row. Who may move comes from each row's `viewer.canEdit`. Scheduling interviews, offers,
   pre-offer documents and stage emails are connected in later steps, so their buttons are not shown here. */

type Target = Stage | Exit;
const isExitTarget = (t: Target): t is Exit => (EXITS as readonly string[]).includes(t);

type Scope = 'Active' | 'Closed' | 'All';
type SortKey = 'applied' | 'name' | 'exp' | 'stage' | 'notice';

interface Filters {
  q: string;
  scope: Scope;
  stage: Stage | 'All';
  exit: Exit | 'All';
  source: string;
  tag: string;
  expMin: string;
  expMax: string;
  notice: string;
  applied: string;
  inStage: string;
  interview: 'Any' | 'Scheduled' | 'None';
}

const NO_FILTERS: Filters = { q: '', scope: 'Active', stage: 'All', exit: 'All', source: 'All', tag: 'All', expMin: '', expMax: '', notice: 'Any', applied: 'Any', inStage: 'Any', interview: 'Any' };

const SORTS: { value: string; label: string; key: SortKey; dir: 'asc' | 'desc' }[] = [
  { value: 'applied:desc', label: 'Newest first', key: 'applied', dir: 'desc' },
  { value: 'applied:asc', label: 'Oldest first', key: 'applied', dir: 'asc' },
  { value: 'stage:desc', label: 'Longest in stage', key: 'stage', dir: 'desc' },
  { value: 'exp:desc', label: 'Most experience', key: 'exp', dir: 'desc' },
  { value: 'notice:asc', label: 'Shortest notice', key: 'notice', dir: 'asc' },
  { value: 'name:asc', label: 'Name A to Z', key: 'name', dir: 'asc' },
];

const PAGE_SIZES = [20, 50, 100];
const BOARD_LIMIT = 8;

/** Whole days since an instant, by the calendar (as the local pipeline counts). */
const daysSince = (iso: string) => daysBetween(new Date(iso).toLocaleDateString('en-CA'), todayISO());
const stageOf = (a: ServerApplication) => STAGE_OF[a.stage];
const exitOf = (a: ServerApplication) => (a.exit ? EXIT_OF[a.exit] : undefined);
const plural = (n: number) => `${n} candidate${n === 1 ? '' : 's'}`;

export function ServerPipeline({
  job,
  apps,
  onApps,
  notify,
}: {
  job: JobData;
  apps: ServerApplication[];
  /** Change the loaded rows after a server answer. */
  onApps: (change: (rows: ServerApplication[]) => ServerApplication[]) => void;
  notify: (msg: string, tone?: 'info' | 'warn') => void;
}) {
  const perms = usePermissions() ?? [];
  const canEdit = can(perms, 'hiring:recruiting:candidates', 'edit');
  // Without Interviews → View the server leaves out the next interview, so its filter and column would mislead.
  const seesInterviews = can(perms, 'hiring:recruiting:interviews');
  const [view, setView] = useState<'board' | 'list'>(() => (apps.length > 30 ? 'list' : 'board'));
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'applied', dir: 'desc' });
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [over, setOver] = useState<Target | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [tagText, setTagText] = useState('');
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setPage(0);
  };
  const clearFilters = () => {
    setF(NO_FILTERS);
    setPage(0);
  };

  const allTags = useMemo(() => [...new Set(apps.flatMap((a) => a.candidate.tags))].sort(), [apps]);
  const sources = useMemo(() => SOURCES.filter((src) => apps.some((a) => SOURCE_OF[a.candidate.source] === src)), [apps]);
  const byId = (id: string) => apps.find((a) => a.id === id);

  const matches = (a: ServerApplication, skip?: 'scope' | 'stage'): boolean => {
    const c = a.candidate;
    if (skip !== 'scope') {
      if (f.scope === 'Active' && a.exit) return false;
      if (f.scope === 'Closed' && !a.exit) return false;
    }
    if (skip !== 'stage' && f.stage !== 'All' && (a.exit || stageOf(a) !== f.stage)) return false;
    if (f.exit !== 'All' && exitOf(a) !== f.exit) return false;
    const needle = f.q.trim().toLowerCase();
    if (needle && !`${c.name} ${c.email} ${c.phone} ${c.currentCompany} ${c.currentTitle} ${c.currentCity} ${c.tags.join(' ')}`.toLowerCase().includes(needle)) return false;
    if (f.source !== 'All' && SOURCE_OF[c.source] !== f.source) return false;
    if (f.tag !== 'All' && !c.tags.includes(f.tag)) return false;
    if (f.expMin !== '' && c.experienceYears < Number(f.expMin)) return false;
    if (f.expMax !== '' && c.experienceYears > Number(f.expMax)) return false;
    if (f.notice !== 'Any' && c.noticeDays > Number(f.notice)) return false;
    const age = daysSince(a.appliedAt);
    if (f.applied === 'today' && age > 0) return false;
    if (f.applied === '7' && age > 7) return false;
    if (f.applied === '30' && age > 30) return false;
    if (f.applied === 'older' && age <= 30) return false;
    if (f.inStage !== 'Any' && daysSince(a.stageChangedAt) < Number(f.inStage)) return false;
    if (f.interview !== 'Any' && (f.interview === 'Scheduled') !== !!a.nextInterview) return false;
    return true;
  };

  const sorted = (list: ServerApplication[]) =>
    [...list].sort((a, b) => {
      const ca = a.candidate;
      const cb = b.candidate;
      let r = 0;
      if (sort.key === 'name') r = ca.name.localeCompare(cb.name);
      else if (sort.key === 'exp') r = ca.experienceYears - cb.experienceYears;
      else if (sort.key === 'notice') r = ca.noticeDays - cb.noticeDays;
      else if (sort.key === 'stage') r = daysSince(a.stageChangedAt) - daysSince(b.stageChangedAt);
      else r = a.appliedAt.localeCompare(b.appliedAt);
      return sort.dir === 'asc' ? r : -r;
    });

  const shown = sorted(apps.filter((a) => matches(a)));
  // Counts for the stage strip follow every filter except the stage itself.
  const stageCount = (st: Stage) => apps.filter((a) => matches(a, 'stage') && !a.exit && stageOf(a) === st).length;
  const activeTotal = apps.filter((a) => !a.exit).length;
  const closedTotal = apps.filter((a) => a.exit).length;
  const closed = job.status === 'CLOSED' || job.status === 'FILLED';

  const lastPage = Math.max(0, Math.ceil(shown.length / pageSize) - 1);
  const pageNow = Math.min(page, lastPage);
  const pageRows = shown.slice(pageNow * pageSize, pageNow * pageSize + pageSize);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (f.q.trim()) chips.push({ key: 'q', label: `“${f.q.trim()}”`, clear: () => set('q', '') });
  if (f.scope === 'All') chips.push({ key: 'scope', label: 'Including closed out', clear: () => set('scope', 'Active') });
  if (f.scope === 'Closed') chips.push({ key: 'scope', label: 'Closed out only', clear: () => set('scope', 'Active') });
  if (f.stage !== 'All') chips.push({ key: 'stage', label: f.stage, clear: () => set('stage', 'All') });
  if (f.exit !== 'All') chips.push({ key: 'exit', label: f.exit, clear: () => set('exit', 'All') });
  if (f.source !== 'All') chips.push({ key: 'source', label: `Source: ${f.source}`, clear: () => set('source', 'All') });
  if (f.tag !== 'All') chips.push({ key: 'tag', label: `Tag: ${f.tag}`, clear: () => set('tag', 'All') });
  if (f.expMin !== '' || f.expMax !== '') chips.push({ key: 'exp', label: `Experience ${f.expMin || '0'}–${f.expMax || 'any'} yrs`, clear: () => setF((p) => ({ ...p, expMin: '', expMax: '' })) });
  if (f.notice !== 'Any') chips.push({ key: 'notice', label: `Notice up to ${f.notice} days`, clear: () => set('notice', 'Any') });
  if (f.applied !== 'Any') chips.push({ key: 'applied', label: { today: 'Applied today', '7': 'Applied in 7 days', '30': 'Applied in 30 days', older: 'Applied over 30 days ago' }[f.applied] ?? f.applied, clear: () => set('applied', 'Any') });
  if (f.inStage !== 'Any') chips.push({ key: 'inStage', label: `${f.inStage}+ days in stage`, clear: () => set('inStage', 'Any') });
  if (f.interview !== 'Any') chips.push({ key: 'interview', label: f.interview === 'Scheduled' ? 'Interview scheduled' : 'No interview scheduled', clear: () => set('interview', 'Any') });
  const advancedCount = ['source', 'tag', 'exp', 'notice', 'applied', 'inStage', 'interview', 'exit'].filter((k) => chips.some((c) => c.key === k)).length;

  /** Calls the server for each application in turn; each answer replaces its row. Reports the first refusal. */
  const run = async (ids: string[], call: (a: ServerApplication) => Promise<ServerApplicationDetail>, done: (count: number) => string) => {
    if (busy) return;
    setBusy(true);
    let ok = 0;
    let firstError = '';
    for (const id of ids) {
      const a = byId(id);
      if (!a) continue;
      try {
        // The answer is the row plus its stage history.
        const row: ServerApplication = await call(a);
        onApps((rows) => rows.map((x) => (x.id === row.id ? row : x)));
        ok++;
      } catch (e) {
        firstError ||= errorMessage(e);
      }
    }
    setBusy(false);
    if (!firstError) notify(done(ok));
    else notify(ids.length === 1 ? firstError : `${ok} of ${ids.length} done. ${firstError}`, 'warn');
  };

  const exitWhy = (to: Exit) => (to === 'Withdrawn' ? 'Withdrawn by candidate' : 'Paused');

  const move = (appId: string, to: Target) => {
    const a = byId(appId);
    if (!a) return;
    if (to === 'Rejected') return setRejecting([appId]);
    if (isExitTarget(to)) {
      if (exitOf(a) === to) return;
      return run([appId], (x) => pipelineApi.exit(x.id, EXIT_CODE[to], exitWhy(to)), () => `${a.candidate.name} marked ${to.toLowerCase()}.`);
    }
    if (stageOf(a) === to && !a.exit) return;
    const stage = STAGE_CODE[to];
    if (stage === 'HIRED') return;
    run([appId], (x) => pipelineApi.move(x.id, stage), () => `${a.candidate.name} moved to ${to}.`);
  };

  const bulkMove = (to: Target) => {
    const ids = [...picked];
    if (to === 'Rejected') return setRejecting(ids);
    setPicked(new Set());
    if (isExitTarget(to)) return run(ids, (x) => pipelineApi.exit(x.id, EXIT_CODE[to], exitWhy(to)), (n) => `${plural(n)} moved to ${to}.`);
    const stage = STAGE_CODE[to];
    if (stage === 'HIRED') return;
    run(ids, (x) => pipelineApi.move(x.id, stage), (n) => `${plural(n)} moved to ${to}.`);
  };

  const confirmReject = (reason: string, note: string) => {
    const ids = rejecting ?? [];
    setRejecting(null);
    setPicked(new Set());
    run(ids, (x) => pipelineApi.exit(x.id, 'REJECTED', reason, note), (n) => `${plural(n)} rejected: ${reason}.`);
  };

  const reopen = (a: ServerApplication) => run([a.id], (x) => pipelineApi.reopen(x.id), () => `${a.candidate.name} reopened at ${STAGE_OF[a.exitFrom ?? 'APPLIED']}.`);

  /** Tags belong to the candidate: the whole list is sent, then every row of that candidate shows it. */
  const addTag = async () => {
    const t = tagText.trim();
    if (!t || busy) return;
    const people = [...new Map(apps.filter((a) => picked.has(a.id)).map((a) => [a.candidate.id, a.candidate])).values()];
    setBusy(true);
    let firstError = '';
    for (const c of people) {
      if (c.tags.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
      try {
        const saved = await candidatesApi.setTags(c.id, [...c.tags, t]);
        onApps((rows) => rows.map((x) => (x.candidate.id === saved.id ? { ...x, candidate: { ...x.candidate, tags: saved.tags } } : x)));
      } catch (e) {
        firstError ||= errorMessage(e);
      }
    }
    setBusy(false);
    if (firstError) return notify(firstError, 'warn');
    notify(`Tagged ${plural(people.length)} “${t}”.`);
    setTagText('');
    setPicked(new Set());
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const sortBy = (key: SortKey) => {
    setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'notice' ? 'asc' : 'desc' }));
    setPage(0);
  };
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '');

  const locked = (a: ServerApplication) => busy || closed || a.stage === 'HIRED' || !a.viewer.canEdit;

  const moveMenu = (a: ServerApplication) => (
    <select
      className="hm-move"
      aria-label={`Move ${a.candidate.name} to a stage`}
      value=""
      disabled={locked(a)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '__reopen') reopen(a);
        else if (v) move(a.id, v as Target);
      }}
    >
      <option value="">Move to…</option>
      <optgroup label="Stage">
        {STAGES.filter((st) => st !== 'Hired' && (st !== stageOf(a) || a.exit)).map((st) => (
          <option key={st}>{st}</option>
        ))}
      </optgroup>
      <optgroup label="Close out">
        {EXITS.filter((x) => x !== exitOf(a)).map((x) => (
          <option key={x}>{x}</option>
        ))}
      </optgroup>
      {a.exit && <option value="__reopen">Reopen at {STAGE_OF[a.exitFrom ?? 'APPLIED']}</option>}
    </select>
  );

  const nextStep = (a: ServerApplication) => {
    const iv = a.nextInterview;
    return iv ? `${ROUND_OF[iv.round]} · ${fmtDate(iv.date)} ${iv.time}` : '—';
  };

  const renderCard = (a: ServerApplication) => {
    const c = a.candidate;
    const days = daysSince(a.stageChangedAt);
    return (
      <div
        className={`hm-card ${dragging === a.id ? 'drag' : ''}`}
        draggable={!locked(a)}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', a.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragging(a.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
      >
        <Link href={`/hiring/candidates/${c.id}`} className="hm-card-nm">
          {c.name}
        </Link>
        <div className="hm-card-sb">
          {c.currentTitle || '—'}
          {c.currentCompany ? ` · ${c.currentCompany}` : ''}
        </div>
        <div className="hm-card-meta">
          <span>{c.experienceYears} yrs</span>
          <span>{SOURCE_OF[c.source]}</span>
          <span>{days === 0 ? 'today' : `${days}d in stage`}</span>
        </div>
        {c.tags.length > 0 && (
          <div className="hm-tags">
            {c.tags.slice(0, 3).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
        {a.nextInterview && <div className="hm-card-note">{nextStep(a)}</div>}
        {a.viewer.canEdit && <div className="hm-card-act">{moveMenu(a)}</div>}
      </div>
    );
  };

  const columns: { key: Target; exit: boolean }[] = [
    ...STAGES.map((st) => ({ key: st as Target, exit: false })),
    ...EXITS.map((x) => ({ key: x as Target, exit: true })),
  ].filter((c) => (c.exit ? f.scope !== 'Active' : f.scope !== 'Closed'));
  const inColumn = (t: Target) => shown.filter((a) => (isExitTarget(t) ? exitOf(a) === t : !a.exit && stageOf(a) === t));

  return (
    <div className="hm-wrap" data-view={view}>
      <div className="pl-bar">
        <div className="tbar pl-top">
          <div className="tsearch pl-search">
            <SearchIcon />
            <input value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Search name, email, phone, company, title, city or tag…" aria-label="Search candidates" />
          </div>
          <button type="button" className={`chip pl-fbtn ${showFilters || advancedCount ? 'tx-chip-on' : ''}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            Filters{advancedCount ? ` · ${advancedCount}` : ''}
          </button>
          <select
            className="chip"
            aria-label="Sort by"
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const o = SORTS.find((x) => x.value === e.target.value);
              if (o) {
                setSort({ key: o.key, dir: o.dir });
                setPage(0);
              }
            }}
          >
            {!SORTS.some((x) => x.value === `${sort.key}:${sort.dir}`) && <option value={`${sort.key}:${sort.dir}`}>Custom order</option>}
            {SORTS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
          <div className="subseg hm-viewtoggle" role="group" aria-label="View" style={{ margin: 0 }}>
            <button type="button" className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>
              Board
            </button>
            <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
              List
            </button>
          </div>
        </div>

        <div className="pl-strip" role="group" aria-label="Filter by stage">
          <button type="button" className={f.scope === 'Active' && f.stage === 'All' ? 'on' : ''} onClick={() => setF((p) => ({ ...p, scope: 'Active', stage: 'All', exit: 'All' }))}>
            All active <b>{activeTotal}</b>
          </button>
          {STAGES.map((st) => (
            <button key={st} type="button" className={f.stage === st && f.scope !== 'Closed' ? 'on' : ''} onClick={() => setF((p) => ({ ...p, scope: p.scope === 'Closed' ? 'Active' : p.scope, stage: p.stage === st ? 'All' : st, exit: 'All' }))}>
              {st} <b>{stageCount(st)}</b>
            </button>
          ))}
          <span className="pl-sep" />
          <button type="button" className={f.scope === 'Closed' ? 'on' : ''} onClick={() => setF((p) => ({ ...p, scope: p.scope === 'Closed' ? 'Active' : 'Closed', stage: 'All', exit: 'All' }))}>
            Closed out <b>{closedTotal}</b>
          </button>
        </div>

        {showFilters && (
          <div className="pl-panel">
            <label>
              Show
              <select value={f.scope} onChange={(e) => setF((p) => ({ ...p, scope: e.target.value as Scope, stage: e.target.value === 'Closed' ? 'All' : p.stage, exit: e.target.value === 'Active' ? 'All' : p.exit }))}>
                <option value="Active">Active candidates</option>
                <option value="Closed">Closed out only</option>
                <option value="All">Everyone</option>
              </select>
            </label>
            {f.scope !== 'Active' && (
              <label>
                Closed out as
                <select value={f.exit} onChange={(e) => set('exit', e.target.value as Exit | 'All')}>
                  <option value="All">Any</option>
                  {EXITS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Source
              <select value={f.source} onChange={(e) => set('source', e.target.value)}>
                <option value="All">Any source</option>
                {sources.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Experience (years)
              <span className="pl-pair">
                <input type="number" min={0} placeholder="From" value={f.expMin} onChange={(e) => set('expMin', e.target.value)} aria-label="Experience from" />
                <input type="number" min={0} placeholder="To" value={f.expMax} onChange={(e) => set('expMax', e.target.value)} aria-label="Experience to" />
              </span>
            </label>
            <label>
              Notice period
              <select value={f.notice} onChange={(e) => set('notice', e.target.value)}>
                <option value="Any">Any</option>
                <option value="15">Up to 15 days</option>
                <option value="30">Up to 30 days</option>
                <option value="60">Up to 60 days</option>
                <option value="90">Up to 90 days</option>
              </select>
            </label>
            <label>
              Applied
              <select value={f.applied} onChange={(e) => set('applied', e.target.value)}>
                <option value="Any">Any time</option>
                <option value="today">Today</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="older">More than 30 days ago</option>
              </select>
            </label>
            <label>
              Time in stage
              <select value={f.inStage} onChange={(e) => set('inStage', e.target.value)}>
                <option value="Any">Any</option>
                <option value="3">3 days or more</option>
                <option value="7">7 days or more</option>
                <option value="14">14 days or more</option>
                <option value="30">30 days or more</option>
              </select>
            </label>
            {seesInterviews && (
              <label>
                Interview
                <select value={f.interview} onChange={(e) => set('interview', e.target.value as Filters['interview'])}>
                  <option value="Any">Any</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="None">Not scheduled</option>
                </select>
              </label>
            )}
            {allTags.length > 0 && (
              <label>
                Tag
                <select value={f.tag} onChange={(e) => set('tag', e.target.value)}>
                  <option value="All">Any tag</option>
                  {allTags.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <div className="pl-result" role="status">
          <span>
            Showing <b>{shown.length}</b> of {apps.length} candidate{apps.length === 1 ? '' : 's'}
          </span>
          {chips.map((c) => (
            <button key={c.key} type="button" className="pl-chip" onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
              {c.label} <span aria-hidden>×</span>
            </button>
          ))}
          {chips.length > 0 && (
            <button type="button" className="lnk" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="hm-board" role="group" aria-label="Pipeline board">
        {columns.map(({ key, exit }) => {
          const list = inColumn(key);
          const open = expanded.has(key);
          const visible = open ? list : list.slice(0, BOARD_LIMIT);
          return (
            <section
              key={key}
              className={`hm-col ${exit ? 'exit' : ''} ${over === key ? 'over' : ''}`}
              onDragOver={(e) => {
                if (!dragging || closed) return;
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                setOver(null);
                setDragging(null);
                if (id) move(id, key);
              }}
            >
              <header>
                <b>{key}</b>
                <span>{list.length}</span>
              </header>
              <div className="hm-col-body">
                {visible.map((a) => (
                  <div key={a.id}>{renderCard(a)}</div>
                ))}
                {!list.length && <div className="hm-col-empty">{exit ? 'Drop here' : f.q || chips.length ? 'No match' : 'No candidates'}</div>}
                {list.length > BOARD_LIMIT && (
                  <button
                    type="button"
                    className="pl-more"
                    onClick={() =>
                      setExpanded((p) => {
                        const n = new Set(p);
                        if (n.has(key)) n.delete(key);
                        else n.add(key);
                        return n;
                      })
                    }
                  >
                    {open ? 'Show fewer' : `Show ${list.length - BOARD_LIMIT} more`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="hm-list">
        {picked.size > 0 && (
          <div className="hm-bulk" role="toolbar" aria-label="Bulk actions">
            <b>{picked.size} selected</b>
            <select aria-label="Move selected to" value="" disabled={busy || closed} onChange={(e) => e.target.value && bulkMove(e.target.value as Target)} className="chip">
              <option value="">Move to…</option>
              {STAGES.filter((st) => st !== 'Hired').map((st) => (
                <option key={st}>{st}</option>
              ))}
              {EXITS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setRejecting([...picked])}>
              Reject
            </Button>
            <input className="hm-tag-in" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Tag…" aria-label="Tag to add" maxLength={40} onKeyDown={(e) => e.key === 'Enter' && addTag()} />
            <Button size="sm" onClick={addTag} disabled={busy || !tagText.trim()}>
              Add tag
            </Button>
            <button type="button" className="chip" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </div>
        )}
        {!shown.length ? (
          <div className="hm-col-empty" style={{ padding: 24 }}>
            {apps.length ? 'No candidates match these filters.' : 'No candidates yet.'}{' '}
            {chips.length > 0 && (
              <button type="button" className="lnk" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="tx-scroll wide">
              <table>
                <thead>
                  <tr>
                    {canEdit && (
                      <th style={{ width: 34 }}>
                        <input
                          type="checkbox"
                          aria-label={`Select all ${shown.length} candidates`}
                          checked={shown.length > 0 && shown.every((a) => picked.has(a.id))}
                          onChange={(e) => setPicked(e.target.checked ? new Set(shown.map((a) => a.id)) : new Set())}
                        />
                      </th>
                    )}
                    <th>
                      <button type="button" className="pl-th" onClick={() => sortBy('name')}>
                        Candidate{arrow('name')}
                      </button>
                    </th>
                    <th>Stage</th>
                    <th>
                      <button type="button" className="pl-th" onClick={() => sortBy('exp')}>
                        Experience{arrow('exp')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="pl-th" onClick={() => sortBy('notice')}>
                        Notice{arrow('notice')}
                      </button>
                    </th>
                    <th>Source</th>
                    <th>
                      <button type="button" className="pl-th" onClick={() => sortBy('applied')}>
                        Applied{arrow('applied')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="pl-th" onClick={() => sortBy('stage')}>
                        In stage{arrow('stage')}
                      </button>
                    </th>
                    {seesInterviews && <th>Next</th>}
                    {canEdit && <th>Move</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((a) => {
                    const c = a.candidate;
                    return (
                      <tr key={a.id} className={picked.has(a.id) ? 'hm-row-on' : ''}>
                        {canEdit && (
                          <td>
                            <input type="checkbox" aria-label={`Select ${c.name}`} checked={picked.has(a.id)} onChange={() => toggle(a.id)} />
                          </td>
                        )}
                        <td>
                          <Link href={`/hiring/candidates/${c.id}`} className="hm-link">
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            <div className="tx-s faint">
                              {c.currentTitle}
                              {c.currentCompany ? ` · ${c.currentCompany}` : ''}
                            </div>
                          </Link>
                          {c.tags.length > 0 && (
                            <div className="hm-tags" style={{ marginTop: 4 }}>
                              {c.tags.slice(0, 3).map((t) => (
                                <span key={t}>{t}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <StageBadge stage={stageOf(a)} exit={exitOf(a)} />
                          {a.exitReason && <div className="tx-s faint">{a.exitReason}</div>}
                        </td>
                        <td className="mono">{c.experienceYears} yrs</td>
                        <td className="mono">{c.noticeDays ? `${c.noticeDays} d` : 'Immediate'}</td>
                        <td>{SOURCE_OF[c.source]}</td>
                        <td className="mono">{fmtDate(a.appliedAt)}</td>
                        <td className="mono">{daysSince(a.stageChangedAt)} d</td>
                        {seesInterviews && <td className="tx-s">{nextStep(a)}</td>}
                        {canEdit && <td>{a.viewer.canEdit ? moveMenu(a) : null}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pl-pager">
              <span className="tx-s faint">
                {pageNow * pageSize + 1}–{Math.min(shown.length, pageNow * pageSize + pageSize)} of {shown.length}
              </span>
              <span className="sp" />
              <label className="tx-s">
                Per page{' '}
                <select
                  className="chip"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="chip" disabled={pageNow === 0} onClick={() => setPage(pageNow - 1)}>
                ← Previous
              </button>
              <span className="tx-s">
                Page {pageNow + 1} of {lastPage + 1}
              </span>
              <button type="button" className="chip" disabled={pageNow >= lastPage} onClick={() => setPage(pageNow + 1)}>
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      <RejectDialog open={!!rejecting} count={rejecting?.length ?? 1} onCancel={() => setRejecting(null)} onConfirm={confirmReject} />
    </div>
  );
}
