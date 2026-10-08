'use client';

import Link from 'next/link';
import { EMPLOYEES } from '@/lib/data';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { useOrg } from '@/context/OrgContext';
import { ENTITY_NAME, ENTITY_WEBSITE } from '@/lib/org';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { StatusBadge } from '@/components/ui/Badge';
import { ArrowRightIcon, BuildingIcon, FolderIcon, InboxIcon, JoinIcon, MapPinIcon, PeopleIcon, ShieldIcon, TreeIcon } from '@/components/icons';

const TILES = [
  { href: '/directory', label: 'Employee Directory', desc: 'Every employee record and profile', color: '#2f6fd6', icon: PeopleIcon },
  { href: '/org-chart', label: 'Organisational Structure', desc: 'Reporting lines, departments and roles', color: '#7a4bd0', icon: TreeIcon },
  { href: '/onboarding', label: 'Onboarding', desc: 'New joiners and their progress', color: '#1f9d63', icon: JoinIcon },
  { href: '/visa', label: 'Visa Management', desc: 'Residence visas and Emirates ID', color: '#c6851b', icon: ShieldIcon },
  { href: '/documents', label: 'Files', desc: 'Company and employee documents', color: '#2f6fd6', icon: FolderIcon },
  { href: '/requests', label: 'Requests', desc: 'Employee requests awaiting action', color: '#d5493f', icon: InboxIcon },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function OrganizationOverviewPage() {
  const { companies, departments, locations, locationName } = useOrg();
  useEmployeeVersion();

  const people = EMPLOYEES.filter((e) => e.employmentStatus !== 'Inactive');

  return (
    <div>
      <PageHeader eyebrow="Organization" title="Organization overview" description="Company services, structure and directory — the shared HR & Admin surface." />

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Active people', value: people.length, icon: <PeopleIcon />, tone: 'blue', href: '/directory' },
            { label: 'Companies', value: companies.length, icon: <BuildingIcon />, tone: 'purple', href: '/admin/companies' },
            { label: 'Departments', value: departments.length, icon: <TreeIcon />, tone: 'green', href: '/org-chart' },
            { label: 'Locations', value: locations.length, icon: <MapPinIcon />, tone: 'amber', href: '/admin/settings' },
          ]}
        />
      </div>

      <div className="org-grid">
        <Card>
          <div className="ad-co-ban" />
          <div className="ad-co-body">
            <div className="ad-co-logo">GS</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12 }}>{ENTITY_NAME}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2, marginBottom: 12 }}>Kerala, India · Dubai, UAE</div>
            <div className="ad-co-row">
              <MapPinIcon />
              {locations.map((l) => l.name).join(' · ') || 'No locations'}
            </div>
            <div className="ad-co-row">
              <BuildingIcon />
              {ENTITY_WEBSITE}
            </div>
          </div>
        </Card>
        <div className="ad-tiles">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href} className="ad-tile">
                <div className="ad-ic" style={{ background: `${t.color}18`, color: t.color }}>
                  <Icon />
                </div>
                <div className="tx">
                  <div className="t">{t.label}</div>
                  <div className="d">{t.desc}</div>
                </div>
                <span className="go">
                  <ArrowRightIcon />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <Card className="row-gap">
        <CardHeader
          title="Companies"
          sub={`${plural(companies.length, 'legal entity', 'legal entities')} in the group`}
          action={
            <Link href="/admin/companies" className="lnk">
              Manage
            </Link>
          }
        />
        {companies.length === 0 ? (
          <EmptyState icon={<BuildingIcon />} title="No companies yet" description="Add a company in Administration to see it listed here." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Location</th>
                <th>Departments</th>
                <th>People</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="person">
                      <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)', width: 32, height: 32, fontSize: 11 }}>
                        {c.shortCode.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="nm">{c.name}</div>
                        <div className="sb">{c.shortCode}</div>
                      </div>
                    </div>
                  </td>
                  <td>{c.location === 'Both' ? 'All locations' : locationName(c.location)}</td>
                  <td>{departments.filter((d) => d.companyId === c.id).length}</td>
                  <td>{people.filter((e) => e.company === c.name).length}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {companies.length > 0 && <div className="ad-foot">{plural(companies.length, 'company', 'companies')}</div>}
      </Card>
    </div>
  );
}
