'use client';

import { ADMIN } from '@/lib/nav';
import { useApp } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { HubGrid } from '@/components/shell/HubGrid';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatStrip } from '@/components/ui/StatStrip';
import { BuildingIcon, GearIcon, MapPinIcon, TreeIcon } from '@/components/icons';

export default function AdministrationPage() {
  const { companies, departments, locations } = useOrg();
  const { nav } = useApp();
  // Only the tools this person can open (all of them in the demo build).
  const sections = ADMIN.map((s) => ({ ...s, items: s.items.filter((i) => nav.shows(i.href)) })).filter((s) => s.items.length);
  const tools = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Administration" description="Common to every module — roles, permissions, workflow rules, notifications and system-wide settings." />
      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Companies', value: companies.length, icon: <BuildingIcon />, tone: 'blue', href: '/admin/companies' },
            { label: 'Departments', value: departments.length, icon: <TreeIcon />, tone: 'purple', hint: `${new Set(departments.map((d) => d.name.trim().toLowerCase())).size} distinct names across ${companies.length} companies`, href: '/admin/structure' },
            { label: 'Locations', value: locations.length, icon: <MapPinIcon />, tone: 'green', href: '/admin/settings' },
            { label: 'Admin tools', value: tools, icon: <GearIcon />, tone: 'gray', hint: `${sections.length} sections` },
          ]}
        />
      </div>
      <HubGrid sections={sections} hub="/administration" />
    </div>
  );
}
