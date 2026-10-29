'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellIcon, BookIcon, ClockIcon, InboxIcon, JoinIcon, ReceiptIcon, StarIcon, WarnIcon } from '@/components/icons';
import { NoticeKind, ago } from '@/lib/notifications';
import { ViewNotice, useNotifications } from '@/components/notifications/useNotifications';

export const KIND_ICON: Record<NoticeKind, React.ReactNode> = {
  request: <InboxIcon />,
  expense: <ReceiptIcon />,
  hiring: <JoinIcon />,
  expiry: <ClockIcon />,
  review: <StarIcon />,
  learning: <BookIcon />,
  system: <BellIcon />,
};
export const iconFor = (n: ViewNotice) => (n.kind === 'expiry' && n.tone === 'expired' ? <WarnIcon /> : KIND_ICON[n.kind]);

/** The bell in the top bar: the unread count, and a panel with the latest notifications and their times. */
export function NotificationBell() {
  const { items, unread, now, markRead, markAllRead } = useNotifications('both');
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const latest = items.slice(0, 8);
  const go = (n: ViewNotice) => {
    markRead([n.id]);
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  return (
    <div className="nt-wrap">
      <button type="button" className="ztb" title="Notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
        <BellIcon />
      </button>
      {open && (
        <>
          <div className="nt-ov" onClick={() => setOpen(false)} />
          <div className="nt-pop" role="dialog" aria-label="Notifications">
            <div className="nt-head">
              <b>Notifications</b>
              {unread > 0 && (
                <button type="button" className="nt-link" onClick={markAllRead}>
                  Mark all as read
                </button>
              )}
            </div>
            {!latest.length ? (
              <div className="nt-empty">
                <BellIcon />
                <b>You are all caught up</b>
                <span>New requests, interviews and reminders appear here as they happen.</span>
              </div>
            ) : (
              <div className="nt-list">
                {latest.map((n) => (
                  <button key={n.id} type="button" className={`nt-row ${n.unread ? 'unread' : ''}`} onClick={() => go(n)}>
                    <span className={`da-ic t-${n.tone}`}>{iconFor(n)}</span>
                    <span className="nt-tx">
                      <b>{n.title}</b>
                      <small>{n.sub}</small>
                      <em>{ago(n.at, now)}</em>
                    </span>
                    {n.unread && <i className="nt-dot" aria-label="Unread" />}
                  </button>
                ))}
              </div>
            )}
            <Link href="/my/notifications" className="nt-foot" onClick={() => setOpen(false)}>
              See all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
