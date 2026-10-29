'use client';

import { useMemo, useState } from 'react';
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
  /** Expired passport, visa, Emirates ID or labour card: shown as a red flag next to the status. */
  const flagFor = (e: Employee) => {
    const issues = statusOf(e) === 'Inactive' ? [] : complianceIssues(e);
    return { short: complianceShort(issues), full: complianceLabel(issues) };
  };
  const canEdit = canEditEmployees(role);
  const router = useRouter();

  const teamMode = forceTeam || role === 'Team Lead';

  const scopeBase = useMemo(() => {
    if (teamMode) return directReports(me.id);
    return EMPLOYEES;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMode, me.id, version]);

  const hasDocIssue = (e: Employee) => statusOf(e) !== 'Inactive' && complianceIssues(e).length > 0;
  const test = (e: Employee, k: FilterKey, v: string): boolean => {
    switch (k) {
      case 'loc':
        return e.location === v;
      case 'dept':
        return e.department === v;
      case 'status':
        return statusOf(e) === v;
      case 'company':
        return e.company === v;
      case 'desig':
        return e.designation === v;
      case 'mgr':
        return v === 'none' ? !e.reportingManagerId : e.reportingManagerId === v;
      case 'type':
        return e.employmentType === v;
      case 'nat':
        return e.nationality === v;
      case 'docs':
        return hasDocIssue(e);
    }
  };
  /** The people who pass the search and every filter except the one named, so each dropdown can show what choosing a value would leave. */
  const matching = (skip?: FilterKey) => scopeBase.filter((e) => matchesEmployee(e, q) && FILTER_KEYS.every((k) => k === skip || f[k] === ALL || test(e, k, f[k])));
  const facets = Object.fromEntries(FILTER_KEYS.map((k) => [k, matching(k)])) as Record<FilterKey, Employee[]>;
  const countOf = (k: FilterKey) => (v: string) => facets[k].filter((e) => test(e, k, v)).length;

  const byName = (a: Employee, b: Employee) => a.name.localeCompare(b.name);
  const rows = [...matching()].sort(
    sort === 'name' ? byName : sort === 'dept' ? (a, b) => a.department.localeCompare(b.department) || byName(a, b) : sort === 'newest' ? (a, b) => b.dateOfJoining.localeCompare(a.dateOfJoining) : sort === 'oldest' ? (a, b) => a.dateOfJoining.localeCompare(b.dateOfJoining) : () => 0
  );

  const uniq = (get: (e: Employee) => string): Opt[] => [...new Set(scopeBase.map(get).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
  const managers: Opt[] = [
    ...[...new Set(scopeBase.map((e) => e.reportingManagerId).filter((id): id is string => !!id))]
      .map((id) => ({ value: id, label: EMPLOYEES.find((m) => m.id === id)?.name ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ...(scopeBase.some((e) => !e.reportingManagerId) ? [{ value: 'none', label: 'No manager' }] : []),
  ];
  const valueLabel = (k: FilterKey, v: string) => (k === 'loc' ? locationName(v) : k === 'mgr' ? (managers.find((m) => m.value === v)?.label ?? v) : k === 'docs' ? 'Expired documents' : v);

  const inLocation = scopeBase.filter((e) => f.loc === ALL || e.location === f.loc);
  const countStatus = (s: EmploymentStatus) => inLocation.filter((e) => statusOf(e) === s).length;
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
            <FacetSelect label="Nationality" allLabel="All nationalities" value={f.nat} onChange={(v) => setFilter('nat', v)} options={uniq((e) => e.nationality)} count={countOf('nat')} total={facets.nat.length} />
            <FacetSelect label="Documents" allLabel="Any" value={f.docs} onChange={(v) => setFilter('docs', v)} options={[{ value: 'issues', label: 'Expired documents' }]} count={countOf('docs')} total={facets.docs.length} />
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
                  const mgr = EMPLOYEES.find((m) => m.id === e.reportingManagerId);
                  const tone = toneFor(e.department);
                  return (
                    <tr key={e.id} className="clickable" onClick={() => router.push(`/directory/${e.employeeCode}`)}>
                      <td>
                        <Link href={`/directory/${e.employeeCode}`} className="person" onClick={(ev) => ev.stopPropagation()}>
                          <Avatar initials={e.avatarInitials} seed={e.department} />
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
                        <div className="sb">{e.seatingLocation}</div>
                      </td>
                      <td>
                        {mgr ? (
                          <>
                            {mgr.name}
                            <EmpId code={mgr.employeeCode} />
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="ex-statuscell">
                          <StatusBadge status={statusOf(e)} />
                          <ComplianceFlag text={flagFor(e).short} title={flagFor(e).full} />
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
              const mgr = EMPLOYEES.find((m) => m.id === e.reportingManagerId);
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
                    <Avatar initials={e.avatarInitials} seed={e.department} size={44} />
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
                    <StatusBadge status={statusOf(e)} />
                  </div>
                  {flagFor(e).short && (
                    <div style={{ marginTop: 8 }}>
                      <ComplianceFlag text={flagFor(e).short} title={flagFor(e).full} />
                    </div>
                  )}
                  <div className="meta">
                    <div>
                      <MapPinIcon /> {locationName(e.location)} · {e.seatingLocation}
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
