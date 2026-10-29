'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XIcon } from '@/components/icons';
import { ViewNotice, useNotifications } from '@/components/notifications/useNotifications';
import { iconFor } from '@/components/notifications/NotificationBell';

/** A small pop-up when something new arrives while the app is open, so it is seen at once. It does not pop up for what
    was already waiting when the page loaded. */
export function NoticeToaster() {
  const { items, markRead } = useNotifications('both');
  const router = useRouter();
  const seen = useRef<Set<string>>(new Set());
  const [born] = useState(() => Date.now());
  const [toasts, setToasts] = useState<ViewNotice[]>([]);

  useEffect(() => {
    const fresh = items.filter((n) => !seen.current.has(n.id));
    fresh.forEach((n) => seen.current.add(n.id));
    // Whatever is there while the page is still loading is not news.
    if (Date.now() - born < 2500) return;
    // Your own pending requests are not news; everything else that arrives is.
    const show = fresh.filter((n) => n.unread && !n.id.startsWith('rq-mine-')).slice(0, 3);
    if (show.length) setToasts((t) => [...show, ...t].slice(0, 4));
  }, [items, born]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((cur) => cur.slice(0, -1)), 7000);
    return () => clearTimeout(t);
  }, [toasts]);

  if (!toasts.length) return null;
  return (
    <div className="nt-toasts" role="status" aria-live="polite">
      {toasts.map((n) => (
        <div key={n.id} className="nt-toast">
          <button
            type="button"
            className="nt-toast-body"
            onClick={() => {
              markRead([n.id]);
              setToasts((c) => c.filter((x) => x.id !== n.id));
              if (n.href) router.push(n.href);
            }}
          >
            <span className={`da-ic t-${n.tone}`}>{iconFor(n)}</span>
            <span className="nt-tx">
              <b>{n.title}</b>
              <small>{n.sub}</small>
            </span>
          </button>
          <button type="button" className="icon-act" aria-label="Dismiss" onClick={() => setToasts((c) => c.filter((x) => x.id !== n.id))}>
            <XIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
