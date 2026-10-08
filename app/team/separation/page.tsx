'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { directReports, employeeById, matchesEmployee } from '@/lib/data';
import { OffboardingRequest } from '@/lib/types';
import { useSeparation } from '@/context/SeparationContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { EmpId } from '@/components/ui/EmployeeBits';
import { CheckIcon, ClockIcon, ExitIcon, SearchIcon, ShieldIcon } from '@/components/icons';

const STATUSES: ('All' | OffboardingRequest['status'])[] = ['All', 'Clearance Pending', 'Pending Approval', 'Completed'];

export default function TeamSeparationPage() {
  const me = useCurrentEmployee();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'All' | OffboardingRequest['status']>('All');
  const { cases: allSeparations } = useSeparation();
  const team = directReports(me.id);
  const teamIds = new Set(team.map((t) => t.id));
  const allCases = allSeparations.filter((r) => teamIds.has(r.employeeId));
  const cases = allCases.filter((r) => (status === 'All' || r.status === status) && matchesEmployee(employeeById(r.employeeId)!, q));
  const filtered = !!q.trim() || status !== 'All';
  const countOf = (s: OffboardingRequest['status']) => allCases.filter((r) => r.status === s).length;

  return (
    <div className="tx-page">
      <PageHeader eyebrow="Team" title="Team Separation" description="Resignation and separation cases among your direct reports." />

      <StatStrip
        items={[
          { label: 'Total cases', value: allCases.length, icon: <ExitIcon />, tone: 'blue', hint: `Among ${team.length} direct report(s)` },
          { label: 'Clearance pending', value: countOf('Clearance Pending'), icon: <ClockIcon />, tone: 'amber', hint: 'Items still open' },
          { label: 'Pending approval', value: countOf('Pending Approval'), icon: <ShieldIcon />, tone: 'purple', hint: 'Cleared, awaiting sign-off' },
          { label: 'Completed', value: countOf('Completed'), icon: <CheckIcon />, tone: 'green', hint: 'Fully separated' },
        ]}
      />

      <Card>
        <CardHeader title="Separation cases" sub={`${allCases.length} case(s) among your reports`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'All' | OffboardingRequest['status'])} className="chip">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <span className="sp" />
          <span className="tx-count">
            {cases.length} of {allCases.length}
          </span>
        </div>
        {!cases.length ? (
          <EmptyState
            icon={<ExitIcon />}
            title={filtered ? 'No matches' : 'No separations in progress'}
            description={filtered ? 'No separation cases match your search or filter.' : 'None of your direct reports have an active separation case.'}
          />
        ) : (
          <div className="tx-list">
            {cases.map((r) => {
              const e = employeeById(r.employeeId)!;
              const doneCount = r.clearance.filter((c) => c.done).length;
              const pct = r.clearance.length ? Math.round((doneCount / r.clearance.length) * 100) : 0;
              return (
                <div key={r.id} className="tx-item tx-case">
                  <div className="tx-case-top">
                    <Link href={`/directory/${e.employeeCode}`} className="person" style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <div className="tx-av gray">{e.avatarInitials}</div>
                      <div>
                        <div className="tx-t">
                          {e.name}
                          <EmpId code={e.employeeCode} />
                        </div>
                        <div className="tx-s">{r.reason}</div>
                      </div>
                    </Link>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="tx-case-meta">
                    <span>
                      Resigned <b>{r.resignationDate}</b>
                    </span>
                    <span>
                      Last working day <b>{r.lastWorkingDay}</b>
                    </span>
                    {r.noticeDays !== undefined && (
                      <span>
                        Notice <b>{r.noticeDays} day(s)</b>
                      </span>
                    )}
                  </div>
                  <div className="tx-prog">
                    <div className="tx-bar">
                      <i className={pct === 100 ? 'green' : undefined} style={{ width: `${pct}%` }} />
                    </div>
                    <span>
                      {doneCount} of {r.clearance.length} clearance items complete
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!!cases.length && (
          <div className="tfoot">
            <span>
              Showing {cases.length} of {allCases.length}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
