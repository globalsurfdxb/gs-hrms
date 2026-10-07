import { OPS, resolveLocation } from '@/lib/nav';

export interface HubBack {
  href: string;
  label: string;
}

const HUBS: Record<string, string> = {
  '/operations': 'Operations',
  '/reports': 'Reports',
};

/* Last hub card the user clicked. Pages such as /directory also sit under Home tabs, so the
   route alone can't say where the user came from. Module state survives client-side navigation. */
let origin: { hub: string; target: string } | null = null;

export function rememberHub(hub: string, target: string) {
  origin = { hub, target };
}

/** Forget the remembered hub once the user has moved on to a page unrelated to it. */
export function clearStaleHub(pathname: string) {
  if (!origin || pathname in HUBS) return;
  if (pathname !== origin.target && !pathname.startsWith(`${origin.target}/`)) origin = null;
}

// Exact matches only: detail pages such as /directory/GS-119 are not hub pages and get no hub back button.
const inSections = (sections: typeof OPS, pathname: string) => sections.some((s) => s.items.some((i) => pathname === i.href));

/** The hub to offer a "back" link to for this page, or null when the page isn't reached from one. */
export function hubBackFor(pathname: string): HubBack | null {
  if (pathname in HUBS || pathname === '/administration' || pathname.startsWith('/admin/')) return null; // Administration pages have no back button
  if (origin && origin.target === pathname && HUBS[origin.hub]) return { href: origin.hub, label: HUBS[origin.hub] };
  const { module } = resolveLocation(pathname);
  if (module === 'operations' || (module === 'home' && inSections(OPS, pathname) && origin?.hub === '/operations')) return { href: '/operations', label: HUBS['/operations'] };
  return null;
}
