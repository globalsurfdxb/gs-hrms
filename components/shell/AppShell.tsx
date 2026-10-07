'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/icons';
import { clearStaleHub, hubBackFor } from '@/lib/hubBack';
import { trackModule } from '@/lib/lastModule';
import { useAuth } from '@/lib/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Rail } from './Rail';
import { TopBar } from './TopBar';
import { SubTabs } from './SubTabs';
import { useApp } from '@/context/AppContext';
import { PERS, resolveLocation } from '@/lib/nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { role } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const back = hubBackFor(pathname);
  const auth = useAuth();
  const isLogin = pathname === '/login';

  useEffect(() => {
    clearStaleHub(pathname);
    trackModule(pathname);
  }, [pathname]);

  useEffect(() => {
    if (auth.status === 'out' && !isLogin) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [auth.status, isLogin, pathname, router]);

  useEffect(() => {
    if (isLogin || auth.status !== 'in') return;
    const loc = resolveLocation(pathname);
    const persona = PERS[role];
    if (loc.module !== 'modules' && (!persona.modules.includes(loc.module) || (loc.scope && !persona.scopes.includes(loc.scope)))) {
      router.replace('/dashboard');
    }
  }, [role, pathname, router, isLogin, auth.status]);

  if (isLogin) return <>{children}</>;
  if (auth.status !== 'in') return <div className="boot" aria-busy="true" />;

  return (
    <div className="app">
      <Rail open={open} onClose={() => setOpen(false)} />
      <div className="zmain">
        <TopBar onMenu={() => setOpen(true)} />
        <SubTabs />
        <main className="zbody">
          {back && (
            <Link href={back.href} className="hub-back">
              <ArrowLeftIcon />
              Back to {back.label}
            </Link>
          )}
          <div id="app">{children}</div>
        </main>
      </div>
    </div>
  );
}
