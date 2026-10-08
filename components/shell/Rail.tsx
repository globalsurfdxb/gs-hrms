'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { APP_MODULES, PERS, RAIL_LABEL, RailModule, resolveLocation } from '@/lib/nav';
import { getLaLastRail, laCall, laIcon, useLaChrome } from '@/lib/laStore';
import { lastModule } from '@/lib/lastModule';
import { CheckIcon, ChevronRightIcon, ClockIcon, GearIcon, GridIcon, HomeIcon, OpsIcon, PackageIcon, PeopleIcon, ReceiptIcon, RefreshIcon, ReportsIcon } from '@/components/icons';

const MODULE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  employee: PeopleIcon,
  'asset-management': PackageIcon,
  'leave-attendance': ClockIcon,
  payroll: ReceiptIcon,
  renewals: RefreshIcon,
};

const MODULE_TONE: Record<string, { bg: string; fg: string }> = {
  employee: { bg: '#e7f0fc', fg: '#2f6fd6' },
  'asset-management': { bg: '#fdf3df', fg: '#c6851b' },
  'leave-attendance': { bg: '#e7f6ee', fg: '#1f9d63' },
  payroll: { bg: '#f0eafc', fg: '#7a4bd0' },
  renewals: { bg: '#fce9e7', fg: '#d5493f' },
};

const RAIL_ICON: Record<RailModule, React.ComponentType<{ className?: string }>> = {
  home: HomeIcon,
  operations: OpsIcon,
  reports: ReportsIcon,
  administration: GearIcon,
};

const RAIL_HREF: Record<RailModule, string> = {
  home: '/dashboard',
  operations: '/operations',
  reports: '/reports',
  administration: '/administration',
};

function RailLink({ m, active, onClick }: { m: RailModule; active: boolean; onClick: () => void }) {
  const Icon = RAIL_ICON[m];
  return (
    <Link href={RAIL_HREF[m]} onClick={onClick} className={`zrail-i ${active ? 'active' : ''}`}>
      <div className="rc">
        <Icon />
      </div>
      <span>{RAIL_LABEL[m]}</span>
    </Link>
  );
}

export function Rail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { role } = useApp();
  const modules = PERS[role].modules;
  const activeModule = resolveLocation(pathname).module;
  const la = useLaChrome();

  const mainModules = modules.filter((m) => m !== 'administration');
  const hasAdmin = modules.includes('administration');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Administration is shared by every module: its pages keep the menu of the module the user came from
  // (Leave & Attendance shows its own menu, Employee Management shows its own) and only the content is common.
  const onAdmin = activeModule === 'administration';
  const from = lastModule();
  const laMenu = onAdmin && from.slug === 'leave-attendance' ? getLaLastRail() : [];
  const currentModule = onAdmin
    ? (APP_MODULES.find((m) => m.slug === from.slug) ?? APP_MODULES[0])
    : (APP_MODULES.find((m) => m.slug !== 'employee' && (pathname === m.href || pathname.startsWith(`${m.href}/`))) ?? APP_MODULES[0]);
  const onModulePage = !onAdmin && currentModule.slug !== 'employee';

  useEffect(() => {
    if (!switcherOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSwitcherOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [switcherOpen]);

  return (
    <>
      {open && <div className="zrail-ov show" onClick={onClose} />}
      <aside className={`zrail ${open ? 'open' : ''}`}>
        <div className="zrail-logo">
          <div>GS</div>
        </div>
        <div className="zrail-scroll">
          {la
            ? la.rail.map((it) => (
                <button
                  key={it.k}
                  type="button"
                  className={`zrail-i ${it.active ? 'active' : ''}`}
                  onClick={() => {
                    laCall('navModule', it.k);
                    onClose();
                  }}
                >
                  <div className="rc" dangerouslySetInnerHTML={{ __html: laIcon(it.icon) }} />
                  <span>{it.label}</span>
                </button>
              ))
            : laMenu.length
              ? laMenu.map((it) => (
                  <Link key={it.k} href={`/modules/leave-attendance/${it.k}`} className="zrail-i" onClick={onClose}>
                    <div className="rc" dangerouslySetInnerHTML={{ __html: laIcon(it.icon) }} />
                    <span>{it.label}</span>
                  </Link>
                ))
              : mainModules.map((m) => <RailLink key={m} m={m} active={activeModule === m} onClick={onClose} />)}
        </div>
        <div className="zrail-bottom">
          <button type="button" className={`zrail-i ${onModulePage || switcherOpen ? 'active' : ''}`} onClick={() => setSwitcherOpen((v) => !v)} aria-haspopup="menu" aria-expanded={switcherOpen}>
            <div className="rc">
              <GridIcon />
            </div>
            <span>Modules</span>
          </button>
          {hasAdmin && <RailLink m="administration" active={activeModule === 'administration'} onClick={onClose} />}
        </div>
      </aside>

      {switcherOpen && (
        <>
          <div className="zmod-ov" onClick={() => setSwitcherOpen(false)} />
          <div className="zmod-pop" role="menu" aria-label="Switch module">
            <div className="zmod-head">
              <span>Switch module</span>
              <kbd>Esc</kbd>
            </div>
            {APP_MODULES.map((m) => {
              const Icon = MODULE_ICON[m.slug];
              const current = m.slug === currentModule.slug;
              const tone = MODULE_TONE[m.slug] ?? { bg: '#eef1fa', fg: '#28469a' };
              if (m.soon)
                return (
                  <div key={m.slug} role="menuitem" aria-disabled="true" className="zmod-item off" title={`${m.name} isn't available yet`}>
                    <span className="zmod-ic">
                      <Icon />
                    </span>
                    <span style={{ flex: 1 }}>
                      <span className="zmod-nm">{m.name}</span>
                      <span className="zmod-ds">{m.desc}</span>
                    </span>
                    <span className="zmod-soon">Coming soon</span>
                  </div>
                );
              return (
                <Link
                  key={m.slug}
                  href={m.href}
                  role="menuitem"
                  className={`zmod-item ${current ? 'cur' : ''}`}
                  onClick={() => {
                    setSwitcherOpen(false);
                    onClose();
                  }}
                >
                  <span className="zmod-ic" style={{ background: tone.bg, color: tone.fg }}>
                    <Icon />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span className="zmod-nm">{m.name}</span>
                    <span className="zmod-ds">{m.desc}</span>
                  </span>
                  {current ? (
                    <span className="zmod-cur">
                      <CheckIcon /> Current
                    </span>
                  ) : (
                    <span className="zmod-go">
                      <ChevronRightIcon />
                    </span>
                  )}
                </Link>
              );
            })}
            <div className="zmod-foot">Modules you can open depend on your role ({role}).</div>
          </div>
        </>
      )}
    </>
  );
}
