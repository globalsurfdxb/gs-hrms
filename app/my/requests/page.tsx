'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { proposedChanges, useRequests } from '@/context/RequestsContext';
import { EmployeeRequest } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { NewRequestDrawer } from '@/components/profile/NewRequestDrawer';
import { StatusBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { BellIcon, CheckIcon, FileTextIcon, InboxIcon, ListIcon, MapPinIcon, PlusIcon, ReceiptIcon, SearchIcon, UserIcon, XIcon } from '@/components/icons';

type StatusFilter = 'all' | EmployeeRequest['status'];

const TYPE_LOOK: Record<EmployeeRequest['type'], { tone: string; icon: React.ReactNode }> = {
  'Information Update': { tone: 'blue', icon: <UserIcon /> },
  'Address Change': { tone: 'teal', icon: <MapPinIcon /> },
  'Bank Detail Update': { tone: 'green', icon: <ReceiptIcon /> },
  'Document Request': { tone: 'purple', icon: <FileTextIcon /> },
  'Other Request': { tone: 'amber', icon: <InboxIcon /> },
};

export default function MyRequestsPage() {
  const me = useCurrentEmployee();
  const { requests, raise } = useRequests();
  const [drawer, setDrawer] = useState(false);
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const mine = requests.filter((r) => r.employeeId === me.id);
  const countOf = (s: EmployeeRequest['status']) => mine.filter((r) => r.status === s).length;

  const needle = q.trim().toLowerCase();
  const shown = mine.filter((r) => (status === 'all' || r.status === status) && (!needle || `${r.type} ${r.details} ${r.routedTo}`.toLowerCase().includes(needle)));

  return (
    <div>
      <PageHeader
        eyebrow="My Space"
        title="My Requests"
        description="Changes to your details, letters and anything else you've asked for, and where each one stands."
        actions={
          <Button variant="primary" onClick={() => setDrawer(true)}>
            <PlusIcon /> New request
          </Button>
        }
      />
      {notice && (
        <div className="note-box tx-banner" role="status" style={{ marginBottom: 14 }}>
          <BellIcon />
          <div style={{ flex: 1 }}>{notice}</div>
          <button type="button" className="icon-act" aria-label="Dismiss" onClick={() => setNotice('')}>
            <XIcon />
          </button>
        </div>
      )}

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
          <>
            <EmptyState icon={<InboxIcon />} title="No requests yet" description="Ask HR or your manager to update your details, change your bank account or prepare a letter. It will appear here." />
            <div style={{ textAlign: 'center', paddingBottom: 20 }}>
              <Button variant="primary" onClick={() => setDrawer(true)}>
                <PlusIcon /> New request
              </Button>
            </div>
          </>
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
              {shown.map((r) => {
                const look = TYPE_LOOK[r.type];
                return (
                  <div key={r.id} className="rq-card">
                    <span className={`ss-ic ss-tone-${look.tone}`}>{look.icon}</span>
                    <div className="rq-main">
                      <div className="rq-top">
                        <b>{r.type}</b>
                        <span className="ss-tag alt">Routed to {r.routedTo}</span>
                      </div>
                      <div className="rq-details">{r.details}</div>
                      {r.changes && r.status !== 'Rejected' && (
                        <div className="rq-diff">
                          {proposedChanges(r).map((c) => (
                            <div key={c.key} className="rq-diff-row">
                              <span className="l">{c.label}</span>
                              {r.status === 'Pending' ? (
                                <>
                                  <span className="old">{c.from}</span>
                                  <span className="ar">→</span>
                                  <span className="new">{c.to}</span>
                                </>
                              ) : (
                                <span className="new">{c.to}</span>
                              )}
                            </div>
                          ))}
                          <i>{r.status === 'Pending' ? 'Your profile keeps the current value until this is approved.' : 'Applied to your profile.'}</i>
                        </div>
                      )}
                      <div className="rq-meta">
                        <span>Raised {r.raisedOn}</span>
                        <span>{r.status === 'Pending' ? `Waiting for ${r.routedTo === 'HR' ? 'HR' : 'your manager'}` : `${r.status} by ${r.decidedBy ?? '—'}${r.decidedOn ? ` on ${r.decidedOn}` : ''}`}</span>
                      </div>
                    </div>
                    <div className="rq-side">
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ss-foot">
              <span>
                Showing {shown.length} of {mine.length} request(s)
              </span>
            </div>
          </>
        )}
      </Card>
      <NewRequestDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        onRaise={(r) => {
          raise(r);
          setDrawer(false);
          setNotice(`Your request (${r.type}) was sent to ${r.type === 'Information Update' ? 'your manager' : 'HR'}. You will see the decision here.`);
        }}
      />
    </div>
  );
}
