'use client';

import { useCurrentEmployee } from '@/context/AppContext';
import { useVisa } from '@/context/VisaContext';
import { directReports, employeeById } from '@/lib/data';
import { useRequests } from '@/context/RequestsContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { BellIcon, IdIcon, InboxIcon } from '@/components/icons';

interface Notice {
  id: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}

export function NotificationsView({ forceTeam = false }: { forceTeam?: boolean }) {
  const me = useCurrentEmployee();
  const { stateOf, visaExpiryOf } = useVisa();
  const { requests } = useRequests();
  const people = forceTeam ? directReports(me.id) : [me];
  const peopleIds = new Set(people.map((p) => p.id));

  const notices: Notice[] = [];

  requests.filter((r) => r.status === 'Pending' && peopleIds.has(r.employeeId)).forEach((r) => {
    const e = employeeById(r.employeeId);
    notices.push({
      id: `req-${r.id}`,
      icon: <InboxIcon />,
      title: forceTeam ? `${e?.name} (${e?.employeeCode}) · ${r.type} pending` : `${r.type} pending approval`,
      sub: r.details,
    });
  });

  people.forEach((e) => {
    if (e.location === 'Dubai' && (stateOf(e) === 'soon' || stateOf(e) === 'expired')) {
      notices.push({
        id: `visa-${e.id}`,
        icon: <IdIcon />,
        title: forceTeam ? `${e.name} (${e.employeeCode})'s visa ${stateOf(e) === 'expired' ? 'has expired' : 'expires soon'}` : `Your visa ${stateOf(e) === 'expired' ? 'has expired' : 'expires soon'}`,
        sub: `Residence visa — ${visaExpiryOf(e)}`,
      });
    }
  });

  return (
    <div>
      <PageHeader
        eyebrow={forceTeam ? 'Team · Notifications' : 'My Space · Notifications'}
        title="Notifications"
        description={forceTeam ? 'Alerts for your direct reports — pending approvals and expiring documents.' : 'Alerts on your own requests and document expiries.'}
      />
      <Card>
        <CardHeader title="Recent" sub={`${notices.length} notification(s)`} />
        {!notices.length ? (
          <EmptyState icon={<BellIcon />} title="All caught up" description="Nothing needs your attention right now." />
        ) : (
          notices.map((n) => (
            <div key={n.id} className="doc">
              <div className="fic">{n.icon}</div>
              <div>
                <div className="nm">{n.title}</div>
                <div className="mt">{n.sub}</div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
