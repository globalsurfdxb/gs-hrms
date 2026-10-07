'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { APP_MODULES, HOME_TABS, PERS, RAIL_LABEL, SCOPE_LABEL, resolveLocation } from '@/lib/nav';
import { laCall, useLaChrome } from '@/lib/laStore';
import { signOut, useAuth } from '@/lib/auth';
import { useLocationName } from '@/components/shell/useLocationName';
import { BellIcon, GearIcon, MenuIcon, PlusIcon } from '@/components/icons';

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { role } = useApp();
  const me = useCurrentEmployee();
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const locName = useLocationName();
  const [menu, setMenu] = useState(false);
  const loc = resolveLocation(pathname);
  const scopes = PERS[role].scopes;
  const la = useLaChrome();

  return (
    <>
      <header className="ztop">
        <button className="zmenu-btn" onClick={onMenu}>
          <MenuIcon />
        </button>

        {la && la.scopes.length > 0 ? (
          <nav className="zscope">
            {la.scopes.map((s) => (
              <button key={s.k} type="button" className={`st ${s.active ? 'active' : ''}`} onClick={() => laCall('navScope', s.k)}>
                {s.label}
              </button>
            ))}
          </nav>
        ) : la ? (
          <div className="ztitle">{la.title}</div>
        ) : loc.module !== 'home' ? (
          <div className="ztitle">{loc.module === 'modules' ? (APP_MODULES.find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`))?.name ?? 'Modules') : RAIL_LABEL[loc.module]}</div>
        ) : (
          <nav className="zscope">
            {scopes.map((s) => (
              <Link key={s} href={HOME_TABS[s][0].href} className={`st ${loc.scope === s ? 'active' : ''}`}>
                {SCOPE_LABEL[s]}
              </Link>
            ))}
          </nav>
        )}

        <div className="zright">
          <button className="ztb add" title="Quick add" onClick={la ? () => laCall('openQuickAdd') : undefined}>
            <PlusIcon />
          </button>
          <button className="ztb" title="Alerts" onClick={la ? () => laCall('openNotifications') : undefined}>
            {(la ? (la.alerts ?? 0) > 0 : true) && <span className="dot">{la ? la.alerts : 4}</span>}
            <BellIcon />
          </button>
          {la ? (
            la.settings && (
              <button className="ztb" title="Settings" onClick={() => laCall('openSettings')}>
                <GearIcon />
              </button>
            )
          ) : (
            PERS[role].modules.includes('administration') && (
              <Link href="/admin/settings" className="ztb" title="Settings">
                <GearIcon />
              </Link>
            )
          )}
          <button type="button" className="ztb" title="Sign out" aria-label="Sign out" onClick={() => { signOut(); router.replace('/login'); }}>
            <LogoutIcon />
          </button>
          <div className="zacct">
            <button type="button" className="zpersona" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>
              <div className="av">{me.avatarInitials}</div>
              <div>
                <div className="pnm">{me.name}</div>
                <div className="prl">{role}</div>
              </div>
            </button>
            {menu && (
              <>
                <div className="zacct-ov" onClick={() => setMenu(false)} />
                <div className="zacct-menu" role="menu">
                  <div className="zacct-head">
                    <div className="zacct-av">{me.avatarInitials}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="zacct-nm">{me.name}</div>
                      <div className="zacct-em">{auth.email ?? me.email}</div>
                      <div className="zacct-rl">
                        {role} · {me.employeeCode} · {locName(me.location)}
                      </div>
                    </div>
                  </div>
                  <Link href={`/directory/${me.employeeCode}`} role="menuitem" className="zacct-it" onClick={() => setMenu(false)}>
                    <UserIcon />
                    My profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="zacct-it out"
                    onClick={() => {
                      setMenu(false);
                      signOut();
                      router.replace('/login');
                    }}
                  >
                    <LogoutIcon />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
