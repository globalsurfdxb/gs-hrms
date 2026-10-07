'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { directReports, employeeById, matchesEmployee } from '@/lib/data';
import { useSeparation } from '@/context/SeparationContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmpId, ListSearch } from '@/components/ui/EmployeeBits';
import { ExitIcon } from '@/components/icons';

export default function TeamSeparationPage() {
  const me = useCurrentEmployee();
  const [q, setQ] = useState('');
  const { cases: allSeparations } = useSeparation();
  const team = directReports(me.id);
  const teamIds = new Set(team.map((t) => t.id));
  const allCases = allSeparations.filter((r) => teamIds.has(r.employeeId));
  const cases = allCases.filter((r) => matchesEmployee(employeeById(r.employeeId)!, q));

  return (
    <div>
      <PageHeader eyebrow="Team · Separation" title="Team Separation" description="Resignation and separation cases among your direct reports." />
      <Card>
        <CardHeader title="Separation cases" sub={`${allCases.length} case(s) among your reports`} />
        <ListSearch value={q} onChange={setQ} shown={cases.length} total={allCases.length} />
        {!cases.length ? (
          <EmptyState icon={<ExitIcon />} title={q ? 'No matches' : 'No separations in progress'} description={q ? 'No separation cases match your search.' : 'None of your direct reports have an active separation case.'} />
        ) : (
          cases.map((r) => {
            const e = employeeById(r.employeeId)!;
            const doneCount = r.clearance.filter((c) => c.done).length;
            return (
              <div key={r.id} style={{ padding: '16px 18px', borderTop: '1px solid var(--border-soft)' }}>
                <div className="person" style={{ marginBottom: 8 }}>
                  <Link href={`/directory/${e.employeeCode}`} className="person">
                    <div className="av" style={{ background: 'var(--gray-50)', color: 'var(--text-2)' }}>
                      {e.avatarInitials}
                    </div>
                    <div>
                      <div className="nm">
                        {e.name}
                        <EmpId code={e.employeeCode} />
                      </div>
                      <div className="sb">
                        {r.reason} · Last working day {r.lastWorkingDay}
                      </div>
                    </div>
                  </Link>
                  <div className="rt" style={{ marginLeft: 'auto' }}>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {doneCount} of {r.clearance.length} clearance items complete
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
