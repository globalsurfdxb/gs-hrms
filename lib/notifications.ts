import { useEffect, useState, useSyncExternalStore } from 'react';
import { Role } from '@/lib/types';

/* Notifications. Two kinds reach a person:
   - Events (a request was raised, an interview was added, a claim was decided) are written here the moment they
     happen, addressed to people or roles, with the real time.
   - Time-based alerts (an interview in an hour, an offer about to expire, a document due) are worked out live from
     the data by useNotifications, so they appear at the right moment without anyone sending them.
   Which ones a person has read is kept per person. */

export type NoticeKind = 'request' | 'expense' | 'hiring' | 'expiry' | 'review' | 'learning' | 'system';
export type NoticeTone = 'pending' | 'soon' | 'expired' | 'info' | 'active';

export interface Notice {
  id: string;
  kind: NoticeKind;
  tone: NoticeTone;
  title: string;
  sub: string;
  href?: string;
  /** When it became relevant (ISO). Events: when they happened. Time-based alerts: when their window opened. */
  at: string;
}

interface Stored extends Notice {
  toIds: string[];
  toRoles: Role[];
  /** Who caused it; they are not notified of their own action. */
  by?: string;
}

const KEY = 'gsit.notices.v1';
const READ_KEY = 'gsit.notices.read.v1';
const MAX = 300;

let items: Stored[] = [];
let read: Record<string, string[]> = {};
let loaded = false;
let version = 0;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    items = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Stored[];
    read = JSON.parse(localStorage.getItem(READ_KEY) ?? '{}') as Record<string, string[]>;
  } catch {
    items = [];
    read = {};
  }
}

function persist() {
  version++;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    localStorage.setItem(READ_KEY, JSON.stringify(read));
  } catch {
    /* storage unavailable: notices still work for this visit */
  }
  listeners.forEach((l) => l());
}

export interface NewNotice {
  /** Give an id to replace an earlier notice about the same thing (and to match the live alert for it). */
  id?: string;
  kind: NoticeKind;
  tone: NoticeTone;
  title: string;
  sub: string;
  href?: string;
  toIds?: string[];
  toRoles?: Role[];
  /** The person who caused the event: they are never notified about their own action. */
  by?: string;
}

/** Send a notification now. */
export function pushNotice(n: NewNotice) {
  load();
  const toIds = (n.toIds ?? []).filter((id) => id && id !== n.by);
  const toRoles = n.toRoles ?? [];
  if (!toIds.length && !toRoles.length) return;
  const s: Stored = {
    id: n.id ?? `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    kind: n.kind,
    tone: n.tone,
    title: n.title,
    sub: n.sub,
    href: n.href,
    at: new Date().toISOString(),
    toIds,
    toRoles,
    by: n.by,
  };
  items = [s, ...items.filter((x) => x.id !== s.id)].slice(0, MAX);
  persist();
}

export interface StoreSnapshot {
  items: Stored[];
  read: Record<string, string[]>;
  version: number;
}

let snap: StoreSnapshot = { items: [], read: {}, version: 0 };
const getSnap = (): StoreSnapshot => {
  load();
  if (snap.version !== version || snap.items !== items) snap = { items, read, version };
  return snap;
};
const SERVER: StoreSnapshot = { items: [], read: {}, version: 0 };

export function useNoticeStore(): StoreSnapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        // Another tab pushed or read something: reload and tell this one.
        if (e.key === KEY || e.key === READ_KEY) {
          loaded = false;
          load();
          version++;
          listeners.forEach((l) => l());
        }
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    getSnap,
    () => SERVER,
  );
}

/** Stored events addressed to this person (by id or by role), newest first. */
export function storedFor(s: StoreSnapshot, personId: string, role: Role): Notice[] {
  return s.items
    .filter((n) => (n.toIds.includes(personId) || n.toRoles.includes(role)) && n.by !== personId)
    .map((n) => ({ id: n.id, kind: n.kind, tone: n.tone, title: n.title, sub: n.sub, href: n.href, at: n.at }));
}

export const isRead = (s: StoreSnapshot, personId: string, id: string) => (s.read[personId] ?? []).includes(id);

export function markRead(personId: string, ids: string[]) {
  load();
  const have = new Set(read[personId] ?? []);
  let changed = false;
  ids.forEach((id) => {
    if (!have.has(id)) {
      have.add(id);
      changed = true;
    }
  });
  if (!changed) return;
  // Keep the read list from growing for ever.
  read = { ...read, [personId]: [...have].slice(-600) };
  persist();
}

/** The current time, refreshed every `ms`, so time-based alerts appear and "5 min ago" stays right. */
export function useNow(ms = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    // Coming back to the tab refreshes straight away.
    const vis = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [ms]);
  return now;
}

/** "just now", "5 min ago", "3 h ago", "Yesterday, 14:05", "12 Oct". */
export function ago(atIso: string, now: number): string {
  const t = new Date(atIso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.round((now - t) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff} min ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)} h ago`;
  const d = new Date(t);
  const days = Math.floor(diff / (60 * 24));
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return `Yesterday, ${hm}`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
