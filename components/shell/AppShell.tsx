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
import { prewarmLa } from '@/lib/laRuntime';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { role } = useApp();
  const me = useCurrentEmployee();
  const pathname = usePathname();
  const router = useRouter();
  const back = hubBackFor(pathname);
  const auth = useAuth();
  const isLogin = pathname === '/login';
  // The careers pages are public: anyone with a job link can read the role and apply, without signing in.
  const isPublic = pathname === '/careers' || pathname.startsWith('/careers/');
  const bare = isLogin || isPublic;

  useEffect(() => {
    clearStaleHub(pathname);
    trackModule(pathname);
  }, [pathname]);

  useEffect(() => {
    if (auth.status === 'out' && !bare) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [auth.status, bare, pathname, router]);

  // Decided while rendering, so a page this role may not open is never drawn before the redirect.
  // Once signed in, fetch the Leave & Attendance files in idle time so opening the module is instant.
  useEffect(() => {
    if (auth.status !== 'in') return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(prewarmLa);
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(prewarmLa, 1500);
    return () => window.clearTimeout(id);
  }, [auth.status]);

  const allowed = bare || auth.status !== 'in' || routeAllowed(role, pathname, me);

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (bare) return <>{children}</>;
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
