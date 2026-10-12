'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HOME_TABS, resolveLocation } from '@/lib/nav';
import { laCall, useLaChrome } from '@/lib/laStore';

export function SubTabs() {
  const pathname = usePathname();
  const loc = resolveLocation(pathname);
  const la = useLaChrome();

  if (!la && (pathname === '/modules/leave-attendance' || pathname.startsWith('/modules/leave-attendance/'))) {
    return (
      <nav className="zsub zsk-sub" aria-hidden="true">
        <span />
        <span />
        <span />
      </nav>
    );
  }

  if (la) {
    if (!la.tabs.length) return null;
    return (
      <nav className="zsub">
        {la.tabs.map((t) => (
          <button key={t.k} type="button" className={`zct ${t.active ? 'active' : ''}`} onClick={() => laCall('navTab', t.k)}>
            {t.label}
            {t.badge && <span className="zcb">{t.badge}</span>}
          </button>
        ))}
      </nav>
    );
  }

  if (loc.module === 'hiring') return null;

  if (loc.module !== 'home' || !loc.scope) return null;
  const tabs = HOME_TABS[loc.scope];

  return (
    <nav className="zsub">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`zct ${loc.tab === t.key ? 'active' : ''}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
