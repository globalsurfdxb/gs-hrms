import { useSyncExternalStore } from 'react';

/* Chrome state published by the Leave & Attendance runtime (public/la/la.js) so the
   app's own rail, top bar and sub-tab bar can render the module's menus. */
export interface LaRailItem {
  k: string;
  label: string;
  icon: string;
  active: boolean;
}
export interface LaScope {
  k: string;
  label: string;
  active: boolean;
}
export interface LaTab {
  k: string;
  label: string;
  badge: string;
  active: boolean;
}
export interface LaChrome {
  module: string;
  scope: string | null;
  tab: string | null;
  ops: string | null;
  rail: LaRailItem[];
  scopes: LaScope[];
  tabs: LaTab[];
  title: string;
  settings: boolean;
  alerts?: number;
}

type LaWindow = Window &
  Record<string, ((...args: unknown[]) => void) | undefined> & {
    __laIc?: (name: string) => string;
  };

let state: LaChrome | null = null;
const listeners = new Set<() => void>();

/* The module's rail, kept after the runtime unmounts so shared pages (Administration) can still show it. */
let lastRail: LaRailItem[] = [];
export const getLaLastRail = () => lastRail;

export function setLaChrome(next: LaChrome | null) {
  state = next;
  if (next) lastRail = next.rail;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useLaChrome(): LaChrome | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
}

/** Call one of the runtime's global handlers (navModule, navScope, navTab, …). */
export function laCall(fn: string, ...args: unknown[]) {
  const w = window as unknown as LaWindow;
  w[fn]?.(...args);
}

/** Icon markup from the runtime's own icon map. */
export function laIcon(name: string): string {
  const w = window as unknown as LaWindow;
  return w.__laIc ? w.__laIc(name) : '';
}

/** URL segments (after /modules/leave-attendance) that describe a screen. */
export function laPath(s: Pick<LaChrome, 'module' | 'scope' | 'tab' | 'ops'>): string[] {
  if (s.module === 'operations') return s.ops ? ['operations', s.ops] : ['operations'];
  if (s.module === 'reports') return ['reports'];
  return [s.module, s.scope, s.tab].filter((x): x is string => !!x);
}

/** Where the runtime currently is, as URL segments (empty before it has initialised). */
export function laCurrentPath(): string[] {
  const w = window as unknown as { __chromeState?: () => LaChrome; __laRoot?: unknown };
  return w.__laRoot && w.__chromeState ? laPath(w.__chromeState()) : [];
}
