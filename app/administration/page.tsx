'use client';

import { ADMIN } from '@/lib/nav';
import { useOrg } from '@/context/OrgContext';
import { HubGrid } from '@/components/shell/HubGrid';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatStrip } from '@/components/ui/StatStrip';
import { BuildingIcon, GearIcon, MapPinIcon, TreeIcon } from '@/components/icons';

export default function AdministrationPage() {
  const { companies, departments, locations } = useOrg();
  const tools = ADMIN.reduce((n, s) => n + s.items.length, 0);

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Administration" description="Common to every module — roles, permissions, workflow rules, notifications and system-wide settings." />
      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Companies', value: companies.length, icon: <BuildingIcon />, tone: 'blue', href: '/admin/companies' },
            { label: 'Departments', value: departments.length, icon: <TreeIcon />, tone: 'purple', href: '/admin/structure' },
            { label: 'Locations', value: locations.length, icon: <MapPinIcon />, tone: 'green', href: '/admin/settings' },
            { label: 'Admin tools', value: tools, icon: <GearIcon />, tone: 'gray', hint: `${ADMIN.length} sections` },
          ]}
        />
      </div>
      <HubGrid sections={ADMIN} hub="/administration" />
    </div>
  );
}
