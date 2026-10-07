import { APP_MODULES, resolveLocation } from '@/lib/nav';

export interface LastModule {
  slug: string;
  /** Exact page the user was on, so "back to module" returns them to it. */
  href: string;
}

/* Administration is shared by every module, so it must not look like part of any of them. We remember the
   module the user was in (module-level state survives client-side navigation) to offer a way back. */
let last: LastModule | null = null;

export function trackModule(pathname: string) {
  const loc = resolveLocation(pathname);
  if (loc.module === 'administration') return;
  if (loc.module === 'modules') {
    const m = APP_MODULES.find((x) => x.slug !== 'employee' && (pathname === x.href || pathname.startsWith(`${x.href}/`)));
    if (m) last = { slug: m.slug, href: pathname };
    return;
  }
  last = { slug: 'employee', href: pathname };
}

export const lastModule = (): LastModule => last ?? { slug: 'employee', href: '/dashboard' };
