'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { directReports, matchesEmployee } from '@/lib/data';
import { ExpiryState } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ExpiryBadge } from '@/components/ui/Badge';
import { EmpId, ListSearch } from '@/components/ui/EmployeeBits';
import { ClockIcon } from '@/components/icons';

const URGENCY: Record<ExpiryState, number> = { expired: 0, soon: 1, ok: 2, na: 3 };

export function PersonalExpiryView({ forceTeam = false }: { forceTeam?: boolean }) {
  const me = useCurrentEmployee();
  const [q, setQ] = useState('');
  const people = forceTeam ? directReports(me.id) : [me];

  const allRows = people
    .flatMap((e) => e.documents.filter((d) => d.expiryDate).map((d) => ({ e, d })))
    .sort((a, b) => URGENCY[a.d.state] - URGENCY[b.d.state] || (a.d.expiryDate ?? '').localeCompare(b.d.expiryDate ?? ''));
  const rows = allRows.filter((r) => matchesEmployee(r.e, q));

  return (
    <div>
      <PageHeader
        eyebrow={forceTeam ? 'Team · Expiry' : 'My Space · Expiry'}
        title={forceTeam ? 'Team Expiry' : 'My Expiry'}
        description={forceTeam ? "Dated documents across your direct reports." : 'Your own passport, visa and identity document expiry status.'}
      />
      <Card>
        <CardHeader title="Expiry register" sub={`${allRows.length} document(s)`} />
        {forceTeam && <ListSearch value={q} onChange={setQ} shown={rows.length} total={allRows.length} />}
        {!rows.length ? (
          <EmptyState icon={<ClockIcon />} title={q ? 'No matches' : 'Nothing tracked'} description={q ? 'No documents match your search.' : 'No dated documents on file.'} />
        ) : (
          <table>
            <thead>
              <tr>
                {forceTeam && <th>Employee</th>}
                <th>Document</th>
                <th>Expiry date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, d }) => (
                <tr key={`${e.id}-${d.id}`}>
                  {forceTeam && (
                    <td>
                      <span className="person">
                        <span className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                          {e.avatarInitials}
                        </span>
                        <span className="nm">
                          {e.name}
                          <EmpId code={e.employeeCode} />
                        </span>
                      </span>
                    </td>
                  )}
                  <td>{d.type}</td>
                  <td className="mono">{d.expiryDate}</td>
                  <td>
                    <ExpiryBadge state={d.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
