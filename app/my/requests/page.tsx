'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { useRequests } from '@/context/RequestsContext';
import { EmployeeRequest } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { CheckIcon, InboxIcon, ListIcon, SearchIcon, XIcon } from '@/components/icons';

type StatusFilter = 'all' | EmployeeRequest['status'];

const STATUS_TONE: Record<EmployeeRequest['status'], string> = { Pending: 'amber', Approved: 'green', Rejected: 'red' };

export default function MyRequestsPage() {
  const me = useCurrentEmployee();
  const { requests } = useRequests();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const mine = requests.filter((r) => r.employeeId === me.id);
  const countOf = (s: EmployeeRequest['status']) => mine.filter((r) => r.status === s).length;

  const needle = q.trim().toLowerCase();
  const shown = mine.filter((r) => (status === 'all' || r.status === status) && (!needle || `${r.type} ${r.details} ${r.routedTo}`.toLowerCase().includes(needle)));

  return (
    <div>
      <PageHeader eyebrow="My Space" title="My Requests" description="Information updates and document requests you've raised, and their approval status." />

      <div className="ss-strip">
        <StatStrip
          items={[
            { label: 'Total raised', value: mine.length, icon: <ListIcon />, tone: 'blue', hint: 'All time' },
            { label: 'Pending', value: countOf('Pending'), icon: <InboxIcon />, tone: 'amber', hint: 'Awaiting a decision' },
            { label: 'Approved', value: countOf('Approved'), icon: <CheckIcon />, tone: 'green' },
            { label: 'Rejected', value: countOf('Rejected'), icon: <XIcon />, tone: 'red' },
          ]}
        />
      </div>

      <Card>
        <CardHeader title="My requests" sub={`${mine.length} on file`} />
        {!mine.length ? (
          <EmptyState icon={<InboxIcon />} title="No requests yet" description="Anything you raise with HR or your manager will appear here." />
        ) : (
          <>
            <div className="tbar">
              <div className="tsearch">
                <SearchIcon />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests…" />
              </div>
              <FilterChips
                value={status}
                onChange={setStatus}
                options={[
                  { key: 'all', label: 'All', count: mine.length },
                  { key: 'Pending', label: 'Pending', count: countOf('Pending') },
                  { key: 'Approved', label: 'Approved', count: countOf('Approved') },
                  { key: 'Rejected', label: 'Rejected', count: countOf('Rejected') },
                ]}
              />
            </div>
            <div className="ss-list">
              {!shown.length && <EmptyState icon={<SearchIcon />} title="No matches" description="No requests match your search or filter." />}
              {shown.map((r) => (
                <div key={r.id} className="doc">
                  <span className={`ss-ic ss-tone-${STATUS_TONE[r.status]}`}>
                    <InboxIcon />
                  </span>
                  <div className="ss-body">
                    <div className="ss-nm">
                      {r.type}
                      <span className="ss-tag alt">Routed to {r.routedTo}</span>
                    </div>
                    <div className="ss-mt">{r.details}</div>
                    <div className="ss-sub">Raised {r.raisedOn}</div>
                  </div>
                  <div className="rt">
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
            <div className="ss-foot">
              <span>
                Showing {shown.length} of {mine.length} request(s)
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
