'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { EMPLOYEES, directReports, matchesEmployee } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { EmploymentStatus } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmpId } from '@/components/ui/EmployeeBits';
import { GridIcon, ListIcon, PeopleIcon, PlusIcon, SearchIcon } from '@/components/icons';

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

  const teamMode = forceTeam || role === 'Team Lead';

  const scopeBase = useMemo(() => {
    if (teamMode) return directReports(me.id);
    return EMPLOYEES;
  }, [teamMode, me.id]);

  const inLocation = scopeBase.filter((e) => loc === 'All' || e.location === loc);
  const rows = inLocation.filter((e) => {
    if (dept !== 'All' && e.department !== dept) return false;
    if (status !== 'All' && statusOf(e) !== status) return false;
    if (!matchesEmployee(e, q)) return false;
    return true;
  });

  const depts = [...new Set(departments.filter((d) => loc === 'All' || d.locations.includes(loc)).map((d) => d.name))];

  return (
    <div>
      <PageHeader
        eyebrow={teamMode ? 'Team · Directory' : 'Module 01 · Foundation'}
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

      <Card>
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
          <span className="sp" />
          <button onClick={() => setView('list')} className={`icon-act ${view === 'list' ? 'active' : ''}`} style={view === 'list' ? { color: 'var(--primary)', background: 'var(--primary-50)' } : undefined}>
            <ListIcon />
          </button>
          <button onClick={() => setView('grid')} className={`icon-act ${view === 'grid' ? 'active' : ''}`} style={view === 'grid' ? { color: 'var(--primary)', background: 'var(--primary-50)' } : undefined}>
            <GridIcon />
          </button>
        </div>

        {!rows.length && (
          <EmptyState icon={<PeopleIcon />} title="No employees match" description="No employees found for the current filters." />
        )}

        {!!rows.length && view === 'list' && (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Location</th>
                <th>Reporting Manager</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const mgr = EMPLOYEES.find((m) => m.id === e.reportingManagerId);
                return (
                  <tr key={e.id} className="clickable">
                    <td>
                      <Link href={`/directory/${e.employeeCode}`} className="person">
                        <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                          {e.avatarInitials}
                        </div>
                        <div>
                          <div className="nm">{e.name}</div>
                          <div className="sb">
                            {e.employeeCode} · {e.designation}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>{e.department}</td>
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
                      <StatusBadge status={statusOf(e)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!!rows.length && view === 'grid' && (
          <div className="g3" style={{ padding: 16 }}>
            {rows.map((e) => (
              <Link key={e.id} href={`/directory/${e.employeeCode}`} className="ops-card" style={{ textAlign: 'left', padding: 16 }}>
                <div className="person" style={{ marginBottom: 12 }}>
                  <div className="av" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-100)', color: 'var(--primary)' }}>
                    {e.avatarInitials}
                  </div>
                  <div>
                    <div className="nm">{e.name}</div>
                    <div className="sb">
                      {e.employeeCode} · {e.designation}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{e.department}</span>
                  <StatusBadge status={statusOf(e)} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {!!rows.length && (
          <div className="tfoot">
            <span>
              Showing {rows.length} of {inLocation.length}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
