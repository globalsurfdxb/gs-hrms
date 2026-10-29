'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { BellIcon, CheckIcon, ChevronRightIcon, ClockIcon, SearchIcon, WarnIcon } from '@/components/icons';
import { NoticeKind, ago } from '@/lib/notifications';
import { iconFor } from '@/components/notifications/NotificationBell';
import { ViewNotice, useNotifications } from '@/components/notifications/useNotifications';

type Group = 'all' | 'unread' | 'request' | 'expense' | 'hiring' | 'expiry' | 'work';
const GROUP_OF: Record<NoticeKind, Group> = { request: 'request', expense: 'expense', hiring: 'hiring', expiry: 'expiry', review: 'work', learning: 'work', system: 'work' };

/** The full list of notifications for the signed-in person (or, on the Team page, for their direct reports), with the
    time of each, what is unread, and what needs action. */
export function NotificationsView({ forceTeam = false }: { forceTeam?: boolean }) {
  const { items, unread, now, markRead, markAllRead } = useNotifications(forceTeam ? 'team' : 'me');
  const router = useRouter();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<Group>('all');

  const count = (g: Group) => items.filter((n) => (g === 'all' ? true : g === 'unread' ? n.unread : GROUP_OF[n.kind] === g)).length;
  const needle = q.trim().toLowerCase();
  const shown = items.filter((n) => (group === 'all' ? true : group === 'unread' ? n.unread : GROUP_OF[n.kind] === group) && (!needle || `${n.title} ${n.sub}`.toLowerCase().includes(needle)));
  const action = items.filter((n) => n.tone === 'pending' || n.tone === 'soon' || n.tone === 'expired').length;
  const overdue = items.filter((n) => n.tone === 'expired').length;

  const open = (n: ViewNotice) => {
    if (n.unread) markRead([n.id]);
    if (n.href) router.push(n.href);
  };

  const options: { key: Group; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'request', label: 'Requests' },
    { key: 'expense', label: 'Expense' },
    { key: 'hiring', label: 'Hiring' },
    { key: 'expiry', label: 'Expiry' },
    { key: 'work', label: 'Reviews & training' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={forceTeam ? 'Team' : 'My Space'}
        title="Notifications"
        description={forceTeam ? 'What needs attention for your direct reports: pending requests and documents about to expire.' : 'Requests, approvals, interviews, reminders and expiries for you, with the time each one arrived.'}
        actions={
          unread > 0 && !forceTeam ? (
            <Button onClick={markAllRead}>
              <CheckIcon /> Mark all as read
            </Button>
          ) : undefined
        }
      />

      <div className="ss-strip">
        <StatStrip
          items={[
            { label: 'Notifications', value: items.length, icon: <BellIcon />, tone: items.length ? 'blue' : 'gray', hint: forceTeam ? 'For your team' : `${unread} unread` },
            { label: 'Needs action', value: action, icon: <ClockIcon />, tone: 'amber', hint: 'Waiting on you or due soon' },
            { label: 'Overdue or urgent', value: overdue, icon: <WarnIcon />, tone: 'red', hint: 'Needs attention now' },
            { label: 'Unread', value: unread, icon: <BellIcon />, tone: 'purple', hint: 'Not opened yet' },
          ]}
        />
      </div>

      <Card>
        <CardHeader title="Recent" sub={`${items.length} notification${items.length === 1 ? '' : 's'}, newest first`} />
        {!items.length ? (
          <EmptyState icon={<BellIcon />} title="All caught up" description="Nothing needs your attention right now. New ones appear here the moment they happen." />
        ) : (
          <>
            <div className="tbar">
              <div className="tsearch">
                <SearchIcon />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notifications…" />
              </div>
              <FilterChips value={group} onChange={setGroup} options={options.filter((o) => o.key === 'all' || count(o.key) > 0 || o.key === group).map((o) => ({ ...o, count: count(o.key) }))} />
            </div>
            <div className="da-list">
              {!shown.length && <EmptyState icon={<SearchIcon />} title="No matches" description="No notifications match your search or filter." />}
              {shown.map((n) => {
                const body = (
                  <>
                    <span className={`da-ic t-${n.tone}`}>{iconFor(n)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="da-t">
                        {n.title}
                        {n.unread && <i className="nt-dot inline" aria-label="Unread" />}
                      </div>
                      <div className="da-s">{n.sub}</div>
                    </div>
                    <span className="nt-when">{ago(n.at, now)}</span>
                    {n.href && (
                      <span className="da-go">
                        <ChevronRightIcon />
                      </span>
                    )}
                  </>
                );
                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    className={`da-row ${n.unread ? 'nt-unread' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      open(n);
                    }}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={n.id} className={`da-row ${n.unread ? 'nt-unread' : ''}`} onClick={() => n.unread && markRead([n.id])} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && n.unread && markRead([n.id])}>
                    {body}
                  </div>
                );
              })}
            </div>
            <div className="ss-foot">
              <span>
                Showing {shown.length} of {items.length} notification{items.length === 1 ? '' : 's'}
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
