'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { EMPLOYEES, directReports, matchesEmployee } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { EmploymentStatus } from '@/lib/types';
import { canEditEmployees, useEmployeeVersion } from '@/lib/employeeStore';
import { complianceIssues, complianceLabel, complianceShort, useExpiryVersion } from '@/lib/expiryRegister';
import { ComplianceFlag } from '@/components/expiry/ExpiryBits';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmpId } from '@/components/ui/EmployeeBits';
import { Avatar, toneFor } from '@/components/ui/Avatar';
import { StatStrip } from '@/components/ui/StatStrip';
import { BuildingIcon, CheckIcon, EditIcon, GridIcon, JoinIcon, ListIcon, MapPinIcon, PeopleIcon, PlusIcon, SearchIcon, UserIcon, XIcon } from '@/components/icons';

const STATUS_FILTERS: ('All' | EmploymentStatus)[] = ['All', 'Active', 'Onboarding', 'Offboarding', 'Inactive'];

export function DirectoryView({ forceTeam = false }: { forceTeam?: boolean }) {
  const { role } = useApp();
  const { departments, locations, locationName } = useOrg();
  const { statusOf } = useSeparation();
  const me = useCurrentEmployee();
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('All');
  const [dept, setDept] = useState('All');
  const [status, setStatus] = useState<'All' | EmploymentStatus>('All');
  const version = useEmployeeVersion();
  useExpiryVersion();
  /** Expired passport, visa, Emirates ID or labour card: shown as a red flag next to the status. */
  const flagFor = (e: (typeof EMPLOYEES)[number]) => {
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

  const inLocation = scopeBase.filter((e) => loc === 'All' || e.location === loc);
  const rows = inLocation.filter((e) => {
    if (dept !== 'All' && e.department !== dept) return false;
    if (status !== 'All' && statusOf(e) !== status) return false;
    if (!matchesEmployee(e, q)) return false;
    return true;
  });

  const depts = [...new Set(departments.filter((d) => loc === 'All' || d.locations.includes(loc)).map((d) => d.name))];

  const countStatus = (s: EmploymentStatus) => inLocation.filter((e) => statusOf(e) === s).length;
  const activeN = countStatus('Active');
  const joiningN = countStatus('Onboarding');
  const leavingN = countStatus('Offboarding');
  const deptN = new Set(inLocation.map((e) => e.department)).size;
  const scopeLabel = loc === 'All' ? (teamMode ? 'your team' : 'all locations') : locationName(loc);
  const filtersOn = !!q.trim() || loc !== 'All' || dept !== 'All' || status !== 'All';

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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          <select
            value={loc}
            onChange={(e) => {
              setLoc(e.target.value);
              setDept('All');
            }}
            className="chip"
          >
            <option value="All">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="chip">
            <option value="All">All departments</option>
            {depts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'All' | EmploymentStatus)} className="chip">
            {STATUS_FILTERS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {filtersOn && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setQ('');
                setLoc('All');
                setDept('All');
                setStatus('All');
              }}
            >
              <XIcon /> Clear filters
            </button>
          )}
          <span className="sp" />
          <span className="lc-count">
            {rows.length} of {inLocation.length}
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

        {!rows.length && (
          <EmptyState icon={<PeopleIcon />} title="No employees match" description="No employees found for the current filters." />
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
              Showing {rows.length} of {inLocation.length}
            </span>
            <span>{canEdit ? 'Use the pencil to edit a profile' : 'Select a person to open their profile'}</span>
          </div>
        )}
      </Card>

    </div>
  );
}
