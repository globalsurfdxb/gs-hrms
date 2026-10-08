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
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { routeAllowed } from '@/lib/guard';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { role } = useApp();
  const me = useCurrentEmployee();
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

  // Decided while rendering, so a page this role may not open is never drawn before the redirect.
  const allowed = isLogin || auth.status !== 'in' || routeAllowed(role, pathname, me);

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (isLogin) return <>{children}</>;
  if (auth.status !== 'in' || !allowed) return <div className="boot" aria-busy="true" />;

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
