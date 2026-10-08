'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { PERS } from '@/lib/nav';
import { useVisa } from '@/context/VisaContext';
import { directReports, employeeById } from '@/lib/data';
import { useRequests } from '@/context/RequestsContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { BellIcon, ChevronRightIcon, ClockIcon, IdIcon, InboxIcon, SearchIcon, WarnIcon } from '@/components/icons';

type Kind = 'request' | 'visa';

export interface Notice {
  id: string;
  kind: Kind;
  /** Drives the icon tile colour (matches the dashboard attention rows). */
  tone: 'pending' | 'soon' | 'expired';
  icon: React.ReactNode;
  title: string;
  sub: string;
  href?: string;
}

/** The alerts for one person (their own) or for their direct reports. The notification pages and the top-bar bell both read this. */
export function useNotices(forceTeam: boolean) {
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
      kind: 'request',
      tone: 'pending',
      icon: <InboxIcon />,
      title: forceTeam ? `${e?.name} (${e?.employeeCode}) · ${r.type} pending` : `${r.type} pending approval`,
      sub: r.details,
      href: forceTeam ? undefined : '/my/requests',
    });
  });

  people.forEach((e) => {
    if (stateOf(e) === 'soon' || stateOf(e) === 'expired') {
      const expired = stateOf(e) === 'expired';
      notices.push({
        id: `visa-${e.id}`,
        kind: 'visa',
        tone: expired ? 'expired' : 'soon',
        icon: expired ? <WarnIcon /> : <IdIcon />,
        title: forceTeam ? `${e.name} (${e.employeeCode})'s visa ${expired ? 'has expired' : 'expires soon'}` : `Your visa ${expired ? 'has expired' : 'expires soon'}`,
        sub: `Residence visa — ${visaExpiryOf(e)}`,
        href: forceTeam ? '/team/visa' : '/my/expiry',
      });
    }
  });

  return { notices, people };
}

/** Number on the bell: your own alerts, plus your team's when your role has a Team space. Zero hides the badge. */
export function useNoticeCount() {
  const { role } = useApp();
  const mine = useNotices(false);
  const team = useNotices(true);
  return mine.notices.length + (PERS[role].scopes.includes('team') ? team.notices.length : 0);
}

export function NotificationsView({ forceTeam = false }: { forceTeam?: boolean }) {
  const { notices, people } = useNotices(forceTeam);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | Kind>('all');
  const requestCount = notices.filter((n) => n.kind === 'request').length;
  const visaCount = notices.filter((n) => n.kind === 'visa').length;
  const expiredCount = notices.filter((n) => n.tone === 'expired').length;

  const needle = q.trim().toLowerCase();
  const shown = notices.filter((n) => (kind === 'all' || n.kind === kind) && (!needle || `${n.title} ${n.sub}`.toLowerCase().includes(needle)));

  return (
    <div>
      <PageHeader
        eyebrow={forceTeam ? 'Team' : 'My Space'}
        title="Notifications"
        description={forceTeam ? 'Alerts for your direct reports — pending approvals and expiring documents.' : 'Alerts on your own requests and document expiries.'}
      />

      <div className="ss-strip">
        <StatStrip
          items={[
            { label: 'Notifications', value: notices.length, icon: <BellIcon />, tone: notices.length ? 'blue' : 'gray', hint: forceTeam ? `${people.length} direct report(s)` : 'For you' },
            { label: 'Pending requests', value: requestCount, icon: <InboxIcon />, tone: 'amber', hint: 'Awaiting approval' },
            { label: 'Expiring soon', value: visaCount - expiredCount, icon: <ClockIcon />, tone: 'purple', hint: 'Visa renewals due' },
            { label: 'Expired', value: expiredCount, icon: <WarnIcon />, tone: 'red', hint: 'Needs action' },
          ]}
        />
      </div>

      <Card>
        <CardHeader title="Recent" sub={`${notices.length} notification(s)`} />
        {!notices.length ? (
          <EmptyState icon={<BellIcon />} title="All caught up" description="Nothing needs your attention right now." />
        ) : (
          <>
            <div className="tbar">
              <div className="tsearch">
                <SearchIcon />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notifications…" />
              </div>
              <FilterChips
                value={kind}
                onChange={setKind}
                options={[
                  { key: 'all', label: 'All', count: notices.length },
                  { key: 'request', label: 'Requests', count: requestCount },
                  { key: 'visa', label: 'Visa & expiry', count: visaCount },
                ]}
              />
            </div>
            <div className="da-list">
              {!shown.length && <EmptyState icon={<SearchIcon />} title="No matches" description="No notifications match your search or filter." />}
              {shown.map((n) => {
                const body = (
                  <>
                    <span className={`da-ic t-${n.tone}`}>{n.icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="da-t">{n.title}</div>
                      <div className="da-s">{n.sub}</div>
                    </div>
                    {n.href && (
                      <span className="da-go">
                        <ChevronRightIcon />
                      </span>
                    )}
                  </>
                );
                return n.href ? (
                  <Link key={n.id} href={n.href} className="da-row">
                    {body}
                  </Link>
                ) : (
                  <div key={n.id} className="da-row">
                    {body}
                  </div>
                );
              })}
            </div>
            <div className="ss-foot">
              <span>
                Showing {shown.length} of {notices.length} notification(s)
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
