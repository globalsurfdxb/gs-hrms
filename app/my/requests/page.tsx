'use client';

import { useCurrentEmployee } from '@/context/AppContext';
import { useRequests } from '@/context/RequestsContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { InboxIcon } from '@/components/icons';

export default function MyRequestsPage() {
  const me = useCurrentEmployee();
  const { requests } = useRequests();
  const mine = requests.filter((r) => r.employeeId === me.id);

  return (
    <div>
      <PageHeader eyebrow="My Space · Requests" title="My Requests" description="Information updates and document requests you've raised, and their approval status." />
      <Card>
        <CardHeader title="My requests" sub={`${mine.length} on file`} />
        {!mine.length ? (
          <EmptyState icon={<InboxIcon />} title="No requests yet" description="Anything you raise with HR or your manager will appear here." />
        ) : (
          mine.map((r) => (
            <div key={r.id} className="doc">
              <div className="fic">
                <InboxIcon />
              </div>
              <div>
                <div className="nm">
                  {r.type} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· routed to {r.routedTo}</span>
                </div>
                <div className="mt">{r.details}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>Raised {r.raisedOn}</div>
              </div>
              <div className="rt">
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
