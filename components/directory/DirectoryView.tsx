'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { EMPLOYEES, directReports, matchesEmployee } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { Employee, EmploymentStatus } from '@/lib/types';
import { canEditEmployees, useEmployeeVersion } from '@/lib/employeeStore';
import { complianceIssues, complianceLabel, complianceShort, useExpiryVersion } from '@/lib/expiryRegister';
import { ComplianceFlag } from '@/components/expiry/ExpiryBits';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmpId } from '@/components/ui/EmployeeBits';
import { API_ENABLED, errorMessage } from '@/lib/api';
import { DataScope, ServerEmployee, employeesApi, initialsOf, statusOfServer, typeOfServer } from '@/lib/employeesApi';
import { Avatar, toneFor } from '@/components/ui/Avatar';
import { StatStrip } from '@/components/ui/StatStrip';
import { BuildingIcon, CheckIcon, EditIcon, FilterIcon, GridIcon, JoinIcon, ListIcon, MapPinIcon, PeopleIcon, PlusIcon, SearchIcon, UserIcon, XIcon } from '@/components/icons';

const ALL = 'All';
const STATUS_FILTERS: ('All' | EmploymentStatus)[] = ['All', 'Active', 'Onboarding', 'Offboarding', 'Inactive'];

/** Every filter the directory can apply. Status has its own tabs, location and department sit in the toolbar, the rest under "More filters". */
type FilterKey = 'loc' | 'dept' | 'status' | 'company' | 'desig' | 'mgr' | 'type' | 'nat' | 'docs';
const FILTER_KEYS: FilterKey[] = ['loc', 'dept', 'status', 'company', 'desig', 'mgr', 'type', 'nat', 'docs'];
const MORE_KEYS: FilterKey[] = ['company', 'desig', 'mgr', 'type', 'nat', 'docs'];
const FILTER_LABEL: Record<FilterKey, string> = { loc: 'Location', dept: 'Department', status: 'Status', company: 'Company', desig: 'Designation', mgr: 'Reports to', type: 'Employment type', nat: 'Nationality', docs: 'Documents' };
const blankFilters = (): Record<FilterKey, string> => ({ loc: ALL, dept: ALL, status: ALL, company: ALL, desig: ALL, mgr: ALL, type: ALL, nat: ALL, docs: ALL });

type SortKey = 'default' | 'name' | 'newest' | 'oldest' | 'dept';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Default order' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'dept', label: 'Department' },
  { key: 'newest', label: 'Newest joiners' },
  { key: 'oldest', label: 'Longest serving' },
];

interface Opt {
  value: string;
  label: string;
}

/** A dropdown whose options show how many people each choice would leave, given the other filters. Choices that would leave nobody are disabled. */
function FacetSelect({ label, value, onChange, options, count, total, allLabel, chip }: { label: string; value: string; onChange: (v: string) => void; options: Opt[]; count: (v: string) => number; total: number; allLabel: string; chip?: boolean }) {
  const select = (
    <select className={chip ? 'chip' : undefined} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value={ALL}>
        {allLabel} ({total})
      </option>
      {options.map((o) => {
        const n = count(o.value);
        return (
          <option key={o.value} value={o.value} disabled={n === 0 && value !== o.value}>
            {o.label} ({n})
          </option>
        );
      })}
    </select>
  );
  return chip ? select : (
    <label className="dv-field">
      <span>{label}</span>
      {select}
    </label>
  );
}

/** One person as the directory shows them, built from the demo records or from the server (local development). */
interface Row {
  id: string;
  employeeCode: string;
  name: string;
  initials: string;
  company: string;
  department: string;
  designation: string;
  location: string;
  seating: string;
  managerId: string | null;
  manager: { name: string; code: string } | null;
  dateOfJoining: string;
  status: EmploymentStatus;
  employmentType: string;
  nationality: string;
  /** Expired passport, visa, Emirates ID or labour card: a red flag next to the status. */
  flag: { short: string; full: string };
}

const fromServer = (e: ServerEmployee): Row => ({
  id: e.id,
  employeeCode: e.employeeCode,
  name: e.name,
  initials: initialsOf(e.name),
  company: e.company.name,
  department: e.department?.name ?? '',
  designation: e.designation?.name ?? '',
  location: e.location.id,
  seating: '',
  managerId: e.reportingManager?.id ?? null,
  manager: e.reportingManager && { name: e.reportingManager.name, code: e.reportingManager.employeeCode },
  dateOfJoining: e.dateOfJoining,
  status: statusOfServer(e),
  employmentType: typeOfServer(e),
  nationality: '',
  flag: { short: '', full: '' },
});

/** The server's directory: everyone in the caller's data scope. */
function useServerDirectory() {
  const [state, setState] = useState<{ scope: DataScope; items: ServerEmployee[] } | { error: string } | null>(null);
  useEffect(() => {
    if (!API_ENABLED) return;
    let cancelled = false;
    employeesApi
      .all()
      .then((r) => !cancelled && setState(r))
      .catch((e) => !cancelled && setState({ error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export function DirectoryView({ forceTeam = false }: { forceTeam?: boolean }) {
  const { role } = useApp();
  const { locations, locationName } = useOrg();
  const { statusOf } = useSeparation();
  const me = useCurrentEmployee();
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [q, setQ] = useState('');
  const [f, setF] = useState<Record<FilterKey, string>>(blankFilters);
  const [more, setMore] = useState(false);
  const [sort, setSort] = useState<SortKey>('default');
  const setFilter = (k: FilterKey, v: string) => setF((p) => ({ ...p, [k]: v }));
  const version = useEmployeeVersion();
  useExpiryVersion();
  const server = useServerDirectory();
  const serverError = server && 'error' in server ? server.error : '';
  const serverData = server && 'items' in server ? server : null;
  // Editing is not on the server yet, so the pencil stays with the demo data.
  const canEdit = !API_ENABLED && canEditEmployees(role);
  const router = useRouter();

  // Connected, the server's data scope decides; a team view lists direct reports only, as in the demo.
  const teamMode = forceTeam || (API_ENABLED ? serverData?.scope === 'TEAM' : role === 'Team Lead');

  const scopeBase = useMemo<Row[]>(() => {
    if (API_ENABLED) {
      const items = serverData?.items ?? [];
      return (teamMode ? items.filter((e) => e.reportingManager?.employeeCode === me.employeeCode) : items).map(fromServer);
    }
    return (teamMode ? directReports(me.id) : EMPLOYEES).map((e: Employee): Row => {
      const status = statusOf(e);
      const issues = status === 'Inactive' ? [] : complianceIssues(e);
      const mgr = EMPLOYEES.find((m) => m.id === e.reportingManagerId);
      return {
        id: e.id,
        employeeCode: e.employeeCode,
        name: e.name,
        initials: e.avatarInitials,
        company: e.company,
        department: e.department,
        designation: e.designation,
        location: e.location,
        seating: e.seatingLocation,
        managerId: e.reportingManagerId,
        manager: mgr ? { name: mgr.name, code: mgr.employeeCode } : null,
        dateOfJoining: e.dateOfJoining,
        status,
        employmentType: e.employmentType,
        nationality: e.nationality,
        flag: { short: complianceShort(issues), full: complianceLabel(issues) },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMode, me.id, me.employeeCode, version, serverData, statusOf]);

  const test = (e: Row, k: FilterKey, v: string): boolean => {
    switch (k) {
      case 'loc':
        return e.location === v;
      case 'dept':
        return e.department === v;
      case 'status':
        return e.status === v;
      case 'company':
        return e.company === v;
      case 'desig':
        return e.designation === v;
      case 'mgr':
        return v === 'none' ? !e.managerId : e.managerId === v;
      case 'type':
        return e.employmentType === v;
      case 'nat':
        return e.nationality === v;
      case 'docs':
        return !!e.flag.short;
    }
  };
  const needle = q.trim().toLowerCase();
  const matchesSearch = (e: Row) => {
    if (!needle) return true;
    const demo = API_ENABLED ? undefined : EMPLOYEES.find((x) => x.id === e.id);
    return demo ? matchesEmployee(demo, q) : `${e.name} ${e.employeeCode} ${e.designation} ${e.department} ${e.company}`.toLowerCase().includes(needle);
  };
  /** The people who pass the search and every filter except the one named, so each dropdown can show what choosing a value would leave. */
  const matching = (skip?: FilterKey) => scopeBase.filter((e) => matchesSearch(e) && FILTER_KEYS.every((k) => k === skip || f[k] === ALL || test(e, k, f[k])));
  const facets = Object.fromEntries(FILTER_KEYS.map((k) => [k, matching(k)])) as Record<FilterKey, Row[]>;
  const countOf = (k: FilterKey) => (v: string) => facets[k].filter((e) => test(e, k, v)).length;

  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  const rows = [...matching()].sort(
    sort === 'name' ? byName : sort === 'dept' ? (a, b) => a.department.localeCompare(b.department) || byName(a, b) : sort === 'newest' ? (a, b) => b.dateOfJoining.localeCompare(a.dateOfJoining) : sort === 'oldest' ? (a, b) => a.dateOfJoining.localeCompare(b.dateOfJoining) : () => 0
  );

  const uniq = (get: (e: Row) => string): Opt[] => [...new Set(scopeBase.map(get).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
  const managers: Opt[] = [
    ...[...new Map(scopeBase.flatMap((e) => (e.managerId && e.manager ? [[e.managerId, e.manager.name] as const] : []))).entries()]
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ...(scopeBase.some((e) => !e.managerId) ? [{ value: 'none', label: 'No manager' }] : []),
  ];
  const valueLabel = (k: FilterKey, v: string) => (k === 'loc' ? locationName(v) : k === 'mgr' ? (managers.find((m) => m.value === v)?.label ?? v) : k === 'docs' ? 'Expired documents' : v);

  const inLocation = scopeBase.filter((e) => f.loc === ALL || e.location === f.loc);
  const countStatus = (s: EmploymentStatus) => inLocation.filter((e) => e.status === s).length;
  const activeN = countStatus('Active');
  const joiningN = countStatus('Onboarding');
  const leavingN = countStatus('Offboarding');
  const deptN = new Set(inLocation.map((e) => e.department)).size;
  const scopeLabel = f.loc === ALL ? (teamMode ? 'your team' : 'all locations') : locationName(f.loc);

  // Filters that are on, shown as removable tags. Status has its own tabs, so it is not repeated here.
  const tags = [
    ...(q.trim() ? [{ key: 'q', label: `Search: “${q.trim()}”`, clear: () => setQ('') }] : []),
    ...FILTER_KEYS.filter((k) => k !== 'status' && f[k] !== ALL).map((k) => ({ key: k, label: `${FILTER_LABEL[k]}: ${valueLabel(k, f[k])}`, clear: () => setFilter(k, ALL) })),
  ];
  const filtersOn = tags.length > 0 || f.status !== ALL;
  const moreOn = MORE_KEYS.filter((k) => f[k] !== ALL).length;
  const clearAll = () => {
    setQ('');
    setF(blankFilters());
  };

  return (
    <div>
      <PageHeader
        eyebrow={teamMode ? 'Team · Directory' : 'People'}
        title={teamMode ? 'Team Directory' : 'Employee Directory'}
        description={
          teamMode
            ? 'Your direct reports.'
            : 'The master database every module references — filter by location, department and status.'
        }
        actions={
          !teamMode && (
            <Link href="/onboarding" className="btn primary">
              <PlusIcon /> Add employee
            </Link>
          )
        }
      />

      <StatStrip
        items={[
          { label: teamMode ? 'Direct reports' : 'People', value: inLocation.length, icon: <PeopleIcon />, tone: 'blue', hint: `In ${scopeLabel}` },
          { label: 'Active', value: activeN, icon: <CheckIcon />, tone: 'green', hint: inLocation.length ? `${Math.round((activeN / inLocation.length) * 100)}% of ${teamMode ? 'your team' : 'the directory'}` : 'No employees' },
          { label: 'Joining', value: joiningN, icon: <JoinIcon />, tone: 'amber', hint: `${leavingN} leaving · ${countStatus('Inactive')} inactive` },
          { label: 'Departments', value: deptN, icon: <BuildingIcon />, tone: 'purple', hint: deptN === 1 ? 'One team' : 'Teams represented' },
        ]}
      />

      <Card className="row-gap">
        {API_ENABLED && (serverError || !serverData) && (
          <div role={serverError ? 'alert' : 'status'} style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: serverError ? 'var(--danger)' : 'var(--muted)', background: serverError ? 'var(--danger-50)' : 'var(--gray-50)' }}>
            {serverError || 'Loading the directory…'}
          </div>
        )}
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, role or department…" aria-label="Search the directory" />
          </div>
          <FacetSelect chip label="Location" allLabel="All locations" value={f.loc} onChange={(v) => setFilter('loc', v)} options={locations.map((l) => ({ value: l.id, label: l.name }))} count={countOf('loc')} total={facets.loc.length} />
          <FacetSelect chip label="Department" allLabel="All departments" value={f.dept} onChange={(v) => setFilter('dept', v)} options={uniq((e) => e.department)} count={countOf('dept')} total={facets.dept.length} />
          <button type="button" className={`chip ${more || moreOn ? 'on' : ''}`} aria-expanded={more} onClick={() => setMore((m) => !m)}>
            <FilterIcon /> More filters {moreOn > 0 && <b className="dv-badge">{moreOn}</b>}
          </button>
          <select className="chip" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key === 'default' ? 'Sort: default' : `Sort: ${o.label}`}
              </option>
            ))}
          </select>
          <span className="sp" />
          <span className="lc-count">
            {rows.length} of {scopeBase.length}
          </span>
          <div className="lc-viewseg" role="group" aria-label="View">
            <button type="button" onClick={() => setView('list')} className={view === 'list' ? 'on' : ''} title="List view" aria-label="List view" aria-pressed={view === 'list'}>
              <ListIcon />
            </button>
            <button type="button" onClick={() => setView('grid')} className={view === 'grid' ? 'on' : ''} title="Card view" aria-label="Card view" aria-pressed={view === 'grid'}>
              <GridIcon />
            </button>
          </div>
        </div>

        <div className="dv-status" role="group" aria-label="Status">
          {STATUS_FILTERS.map((s) => (
            <button key={s} type="button" className={`dv-st ${f.status === s ? 'on' : ''}`} aria-pressed={f.status === s} onClick={() => setFilter('status', s)}>
              {s}
              <b>{s === ALL ? facets.status.length : countOf('status')(s)}</b>
            </button>
          ))}
        </div>

        {more && (
          <div className="dv-panel">
            <FacetSelect label="Company" allLabel="All companies" value={f.company} onChange={(v) => setFilter('company', v)} options={uniq((e) => e.company)} count={countOf('company')} total={facets.company.length} />
            <FacetSelect label="Designation" allLabel="All designations" value={f.desig} onChange={(v) => setFilter('desig', v)} options={uniq((e) => e.designation)} count={countOf('desig')} total={facets.desig.length} />
            {!teamMode && <FacetSelect label="Reports to" allLabel="Anyone" value={f.mgr} onChange={(v) => setFilter('mgr', v)} options={managers} count={countOf('mgr')} total={facets.mgr.length} />}
            <FacetSelect label="Employment type" allLabel="All types" value={f.type} onChange={(v) => setFilter('type', v)} options={uniq((e) => e.employmentType)} count={countOf('type')} total={facets.type.length} />
            {!API_ENABLED && <FacetSelect label="Nationality" allLabel="All nationalities" value={f.nat} onChange={(v) => setFilter('nat', v)} options={uniq((e) => e.nationality)} count={countOf('nat')} total={facets.nat.length} />}
            {!API_ENABLED && <FacetSelect label="Documents" allLabel="Any" value={f.docs} onChange={(v) => setFilter('docs', v)} options={[{ value: 'issues', label: 'Expired documents' }]} count={countOf('docs')} total={facets.docs.length} />}
          </div>
        )}

        {filtersOn && (
          <div className="dv-tags" aria-label="Active filters">
            {tags.map((t) => (
              <button key={t.key} type="button" className="dv-tag" onClick={t.clear} title="Remove this filter">
                {t.label}
                <XIcon />
              </button>
            ))}
            <button type="button" className="dv-clear" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}

        {!rows.length && (
          <>
            <EmptyState icon={<PeopleIcon />} title="No employees match" description="Nobody fits all of the filters you have set." />
            {filtersOn && (
              <div style={{ padding: '0 0 22px', textAlign: 'center' }}>
                <button type="button" className="btn ghost" onClick={clearAll}>
                  Clear all filters
                </button>
              </div>
            )}
          </>
        )}

        {!!rows.length && view === 'list' && (
          <div className="lc-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Reporting Manager</th>
                  <th>Status</th>
                  {canEdit && <th style={{ width: 56 }} aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const mgr = e.manager;
                  const tone = toneFor(e.department);
                  return (
                    <tr key={e.id} className="clickable" onClick={() => router.push(`/directory/${e.employeeCode}`)}>
                      <td>
                        <Link href={`/directory/${e.employeeCode}`} className="person" onClick={(ev) => ev.stopPropagation()}>
                          <Avatar initials={e.initials} seed={e.department} />
                          <div>
                            <div className="nm">{e.name}</div>
                            <div className="sb">
                              {e.employeeCode} · {e.designation}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <span className="lc-dept" style={{ background: tone.bg, color: tone.fg }}>
                          {e.department}
                        </span>
                      </td>
                      <td>
                        <div>{locationName(e.location)}</div>
                        {e.seating && <div className="sb">{e.seating}</div>}
                      </td>
                      <td>
                        {mgr ? (
                          <>
                            {mgr.name}
                            <EmpId code={mgr.code} />
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="ex-statuscell">
                          <StatusBadge status={e.status} />
                          <ComplianceFlag text={e.flag.short} title={e.flag.full} />
                        </div>
                      </td>
                      {canEdit && (
                        <td>
                          <Link href={`/directory/${e.employeeCode}/edit`} className="icon-act" title={`Edit ${e.name}`} aria-label={`Edit ${e.name}`} onClick={(ev) => ev.stopPropagation()}>
                            <EditIcon />
                          </Link>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!!rows.length && view === 'grid' && (
          <div className="lc-pgrid">
            {rows.map((e) => {
              const mgr = e.manager;
              const tone = toneFor(e.department);
              return (
                <Link key={e.id} href={`/directory/${e.employeeCode}`} className="lc-pcard">
                  {canEdit && (
                    <button
                      type="button"
                      className="icon-act edit"
                      title={`Edit ${e.name}`}
                      aria-label={`Edit ${e.name}`}
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        router.push(`/directory/${e.employeeCode}/edit`);
                      }}
                    >
                      <EditIcon />
                    </button>
                  )}
                  <div className="top">
                    <Avatar initials={e.initials} seed={e.department} size={44} />
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{e.name}</div>
                      <div className="ds">
                        {e.designation} · {e.employeeCode}
                      </div>
                    </div>
                  </div>
                  <div className="foot">
                    <span className="lc-dept" style={{ background: tone.bg, color: tone.fg }}>
                      {e.department}
                    </span>
                    <StatusBadge status={e.status} />
                  </div>
                  {e.flag.short && (
                    <div style={{ marginTop: 8 }}>
                      <ComplianceFlag text={e.flag.short} title={e.flag.full} />
                    </div>
                  )}
                  <div className="meta">
                    <div>
                      <MapPinIcon /> {locationName(e.location)}
                      {e.seating && ` · ${e.seating}`}
                    </div>
                    <div>
                      <UserIcon /> {mgr ? `Reports to ${mgr.name}` : 'No reporting manager'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!!rows.length && (
          <div className="tfoot lc-foot">
            <span>
              Showing {rows.length} of {scopeBase.length}
            </span>
            <span>{canEdit ? 'Use the pencil to edit a profile' : 'Select a person to open their profile'}</span>
          </div>
        )}
      </Card>

    </div>
  );
}
