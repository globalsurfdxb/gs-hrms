'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { EMPLOYEES, defaultScope, employeeById, matchesEmployee } from '@/lib/data';
import { EmployeeRequest } from '@/lib/types';
import { proposedChanges, useRequests } from '@/context/RequestsContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { CheckIcon, InboxIcon, ListIcon, SearchIcon, WarnIcon, XIcon } from '@/components/icons';

type StatusFilter = 'all' | EmployeeRequest['status'];

const REQUEST_TYPES: EmployeeRequest['type'][] = ['Information Update', 'Document Request', 'Address Change', 'Bank Detail Update'];

function Proposed({ r, applied }: { r: EmployeeRequest; applied?: boolean }) {
  if (!r.changes) return null;
  const rows = proposedChanges(r);
  return (
    <div className="rq-prop">
      {rows.map((c) => (
        <div key={c.key}>
          <b>{c.label}</b>: {applied ? c.to : `${c.from} → ${c.to}`}
        </div>
      ))}
      <i>{applied ? 'Applied to the employee record on approval.' : 'The record changes only if you approve.'}</i>
    </div>
  );
}

export default function RequestsPage() {
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { locations, locationName } = useOrg();
  const { statusOf } = useSeparation();
  const { requests, act, canAct } = useRequests();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [type, setType] = useState<'all' | EmployeeRequest['type']>('all');
  const [pick, setPick] = useState<string | null>(null);
  const loc = pick ?? defaultScope(role, me.location);
  const scopeName = loc === 'All' ? 'all locations' : locationName(loc);

  // Same scope rule as the dashboard: people who are not inactive, in the chosen location.
  const scopedIds = new Set(EMPLOYEES.filter((e) => statusOf(e) !== 'Inactive' && (loc === 'All' || e.location === loc)).map((e) => e.id));
  const allScoped = requests.filter((r) => scopedIds.has(r.employeeId));
  const countOf = (s: EmployeeRequest['status']) => allScoped.filter((r) => r.status === s).length;
  const pendingHr = allScoped.filter((r) => r.status === 'Pending' && r.routedTo === 'HR').length;
  const ownPending = allScoped.filter((r) => r.status === 'Pending' && r.employeeId === me.id).length;

  const scoped = allScoped.filter((r) => matchesEmployee(employeeById(r.employeeId)!, q) && (type === 'all' || r.type === type) && (status === 'all' || r.status === status));
  const pending = scoped.filter((r) => r.status === 'Pending' && r.employeeId !== me.id);
  const resolved = scoped.filter((r) => r.status !== 'Pending');
  const filtered = q.trim() !== '' || type !== 'all' || status !== 'all';

  return (
    <div>
      <PageHeader eyebrow="Self-service" title="Employee Requests" description={`Information updates and document requests routed to HR / Manager for approval — ${scopeName}.`} />

      <div className="ss-strip">
        <StatStrip
          items={[
            { label: 'Pending approval', value: countOf('Pending'), icon: <InboxIcon />, tone: 'amber', hint: `${pendingHr} with HR · ${countOf('Pending') - pendingHr} with managers` },
            { label: 'Approved', value: countOf('Approved'), icon: <CheckIcon />, tone: 'green', hint: 'Resolved' },
            { label: 'Rejected', value: countOf('Rejected'), icon: <XIcon />, tone: 'red', hint: 'Resolved' },
            { label: 'Total raised', value: allScoped.length, icon: <ListIcon />, tone: 'blue', hint: loc === 'All' ? 'All locations' : `${locationName(loc)} office` },
          ]}
        />
      </div>

      <Card>
        <CardHeader title="Requests" sub={`${countOf('Pending')} awaiting action · ${allScoped.length - countOf('Pending')} resolved`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          <FilterChips
            value={status}
            onChange={setStatus}
            options={[
              { key: 'all', label: 'All', count: allScoped.length },
              { key: 'Pending', label: 'Pending', count: countOf('Pending') },
              { key: 'Approved', label: 'Approved', count: countOf('Approved') },
              { key: 'Rejected', label: 'Rejected', count: countOf('Rejected') },
            ]}
          />
          <select className="chip sp" value={loc} onChange={(e) => setPick(e.target.value)} aria-label="Filter by location">
            <option value="All">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select className="chip" value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Filter by request type">
            <option value="all">All request types</option>
            {REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {status !== 'Approved' && status !== 'Rejected' && (
          <>
            <div className="ss-sec">
              <h4>Pending approval</h4>
              <span>{pending.length} awaiting action</span>
            </div>
            {ownPending > 0 && (
              <div className="note-box warn" style={{ margin: '0 18px 10px' }}>
                <WarnIcon />
                <div>
                  {ownPending} of your own request{ownPending === 1 ? ' is' : 's are'} not shown here. You cannot approve or reject your own request; it is decided by someone else.
                </div>
              </div>
            )}
            <div className="ss-list">
              {!pending.length && <EmptyState icon={<InboxIcon />} title={filtered ? 'No matches' : 'Inbox zero'} description={filtered ? 'No pending requests match your filters.' : `No pending requests for ${scopeName}.`} />}
              {pending.map((r) => {
                const e = employeeById(r.employeeId)!;
                const allowed = canAct(r);
                return (
                  <div key={r.id} className="doc">
                    <span className="ss-ic av">{e.avatarInitials}</span>
                    <div className="ss-body">
                      <div className="ss-nm">
                        <Link href={`/directory/${e.employeeCode}`}>{e.name}</Link>
                        <span className="ss-code">{e.employeeCode}</span>
                        <span className="ss-tag">{r.type}</span>
                        <span className="ss-tag alt">Routed to {r.routedTo}</span>
                      </div>
                      <div className="ss-mt">{r.details}</div>
                      <Proposed r={r} />
                      <div className="ss-sub">Raised {r.raisedOn}</div>
                    </div>
                    <div className="rt ss-acts">
                      {allowed ? (
                        <>
                          <Button size="sm" variant="success" onClick={() => act(r.id, 'Approved')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => act(r.id, 'Rejected')}>
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="ss-sub">Not yours to decide</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {status !== 'Pending' && (
          <>
            <div className="ss-sec">
              <h4>Resolved</h4>
              <span>{resolved.length} request(s)</span>
            </div>
            <div className="ss-list">
              {!resolved.length && <EmptyState icon={<CheckIcon />} title={filtered ? 'No matches' : 'Nothing resolved yet'} description={filtered ? 'No resolved requests match your filters.' : 'Approved and rejected requests will be listed here.'} />}
              {resolved.map((r) => {
                const e = employeeById(r.employeeId)!;
                return (
                  <div key={r.id} className="doc">
                    <span className="ss-ic av">{e.avatarInitials}</span>
                    <div className="ss-body">
                      <div className="ss-nm">
                        <Link href={`/directory/${e.employeeCode}`}>{e.name}</Link>
                        <span className="ss-code">{e.employeeCode}</span>
                        <span className="ss-tag alt">{r.type}</span>
                      </div>
                      <div className="ss-mt">{r.details}</div>
                      {r.status === 'Approved' && <Proposed r={r} applied />}
                      <div className="ss-sub">
                        Raised {r.raisedOn}
                        {r.decidedBy ? ` · ${r.status} by ${r.decidedBy}${r.decidedOn ? ` on ${r.decidedOn}` : ''}` : ''}
                      </div>
                    </div>
                    <div className="rt">
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="ss-foot">
          <span>
            Showing {scoped.length} of {allScoped.length} request(s)
          </span>
          <span>Approve or reject pending requests inline</span>
        </div>
      </Card>
    </div>
  );
}
