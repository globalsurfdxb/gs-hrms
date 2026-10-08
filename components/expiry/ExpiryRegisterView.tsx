'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { useExpiry } from '@/context/ExpiryContext';
import { directReports, matchesEmployee } from '@/lib/data';
import { DATED_TYPES } from '@/lib/expiryRegister';
import { ExpiryState } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ExpiryBadge } from '@/components/ui/Badge';
import { EmpId } from '@/components/ui/EmployeeBits';
import { StatTiles } from '@/components/ui/StatTiles';
import { DaysLeft, ReminderCell } from '@/components/expiry/ExpiryBits';
import { CheckIcon, ClockIcon, FileTextIcon, SearchIcon, WarnIcon, XIcon } from '@/components/icons';

const FILTERS: { key: 'All' | ExpiryState; label: string }[] = [
  { key: 'All', label: 'All statuses' },
  { key: 'expired', label: 'Expired' },
  { key: 'soon', label: 'Expiring soon' },
  { key: 'ok', label: 'Valid' },
];

/** Read-only expiry register for one person (My Expiry) or the manager's direct reports (Team Expiry),
    drawn from the same register as Employee Expiry and Visa Management. */
export function ExpiryRegisterView({ forceTeam = false }: { forceTeam?: boolean }) {
  const me = useCurrentEmployee();
  const { rowsFor, daysOf, stateOf, reminderInfo } = useExpiry();
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ExpiryState>('All');

  const people = forceTeam ? directReports(me.id) : [me];
  const all = rowsFor(people);
  const types = [...new Set([...DATED_TYPES, ...all.map((r) => r.type)])];
  const count = (s: ExpiryState) => all.filter((r) => stateOf(r) === s).length;

  const needle = q.trim().toLowerCase();
  const rows = all
    .filter((r) => (type === 'All' || r.type === type) && (statusFilter === 'All' || stateOf(r) === statusFilter))
    .filter((r) => !needle || matchesEmployee(r.employee, q) || r.type.toLowerCase().includes(needle))
    .sort((a, b) => daysOf(a) - daysOf(b));
  const filtersOn = !!needle || type !== 'All' || statusFilter !== 'All';

  return (
    <div>
      <PageHeader
        eyebrow={forceTeam ? 'Team · Expiry' : 'My Space · Expiry'}
        title={forceTeam ? 'Team Expiry' : 'My Expiry'}
        description={forceTeam ? 'Dated documents across your direct reports — passports, visas, Emirates IDs, labour cards and licences.' : 'Your own passport, visa, Emirates ID, labour card and other dated documents.'}
      />

      <StatTiles
        items={[
          { label: 'Expired', value: count('expired'), icon: <WarnIcon />, tone: 'red', hint: 'Needs renewal now', active: statusFilter === 'expired', onClick: () => setStatusFilter(statusFilter === 'expired' ? 'All' : 'expired') },
          { label: 'Expiring soon', value: count('soon'), icon: <ClockIcon />, tone: 'amber', hint: 'Within 90 days', active: statusFilter === 'soon', onClick: () => setStatusFilter(statusFilter === 'soon' ? 'All' : 'soon') },
          { label: 'Valid', value: count('ok'), icon: <CheckIcon />, tone: 'green', hint: 'No action needed', active: statusFilter === 'ok', onClick: () => setStatusFilter(statusFilter === 'ok' ? 'All' : 'ok') },
          { label: 'Documents tracked', value: all.length, icon: <FileTextIcon />, tone: 'blue', hint: forceTeam ? `${people.length} direct report${people.length === 1 ? '' : 's'}` : 'On your record' },
        ]}
      />

      <Card className="row-gap">
        <CardHeader title="Expiry register" sub={`${all.length} tracked document(s)`} />
        <div className="tbar">
          <div className="tsearch" style={{ width: 260 }}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={forceTeam ? 'Search name, employee ID or document…' : 'Search documents…'} />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="chip">
            <option value="All">All document types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | ExpiryState)} className="chip">
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          {filtersOn && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setQ('');
                setType('All');
                setStatusFilter('All');
              }}
            >
              <XIcon /> Clear filters
            </button>
          )}
          <span className="sp" />
          <span className="lc-count">
            {rows.length} of {all.length}
          </span>
        </div>

        {!rows.length ? (
          <EmptyState icon={<ClockIcon />} title={all.length ? 'No matches' : 'Nothing tracked'} description={all.length ? 'No documents match your search or filters.' : 'No dated documents on file.'} />
        ) : (
          <>
            <div className="lc-scroll">
              <table>
                <thead>
                  <tr>
                    {forceTeam && <th>Employee</th>}
                    <th>Document</th>
                    <th>Expiry date</th>
                    <th>Days left</th>
                    <th>Status</th>
                    <th>Reminder</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = stateOf(r);
                    return (
                      <tr key={r.key} className={`lc-row ${st}`}>
                        {forceTeam && (
                          <td>
                            <span className="person">
                              <span className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                                {r.employee.avatarInitials}
                              </span>
                              <span className="nm">
                                {r.employee.name}
                                <EmpId code={r.employee.employeeCode} />
                              </span>
                            </span>
                          </td>
                        )}
                        <td>{r.type}</td>
                        <td className="mono">{r.expiry}</td>
                        <td>
                          <DaysLeft days={daysOf(r)} />
                        </td>
                        <td>
                          <ExpiryBadge state={st} />
                        </td>
                        <td>
                          <ReminderCell info={reminderInfo(r)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="tfoot lc-foot">
              <span>
                Showing {rows.length} of {all.length} document{all.length === 1 ? '' : 's'}
              </span>
              <span>Sorted by urgency</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
