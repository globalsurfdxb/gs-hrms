'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { FolderIcon, InboxIcon, JoinIcon, PeopleIcon, ShieldIcon, TreeIcon } from '@/components/icons';

const TILES = [
  { href: '/directory', label: 'Employee Directory', color: '#2f6fd6', icon: PeopleIcon },
  { href: '/org-chart', label: 'Organisational Structure', color: '#7a4bd0', icon: TreeIcon },
  { href: '/onboarding', label: 'Onboarding', color: '#1f9d63', icon: JoinIcon },
  { href: '/visa', label: 'Visa Management', color: '#c6851b', icon: ShieldIcon },
  { href: '/documents', label: 'Files', color: '#2f6fd6', icon: FolderIcon },
  { href: '/requests', label: 'Requests', color: '#d5493f', icon: InboxIcon },
];

export default function OrganizationOverviewPage() {
  const router = useRouter();

  return (
    <div>
      <PageHeader eyebrow="Organization" title="Organization overview" description="Company services, structure and directory — the shared HR & Admin surface." />
      <div className="org-grid">
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 110, background: 'linear-gradient(120deg,#12351f,#0c2718)' }} />
          <div style={{ padding: '18px 20px', marginTop: -46 }}>
            <div style={{ width: 76, height: 76, borderRadius: 16, background: '#fff', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 20 }}>
              GS
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12 }}>GLOBAL SURF IT PVT LTD</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kerala, India · Dubai, UAE</div>
            <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 8 }}>globalsurf.in</div>
          </div>
        </Card>
        <div className="zsvc-grid">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.href} className="zsvc" onClick={() => router.push(t.href)}>
                <div className="zsvc-ic" style={{ background: `${t.color}18`, color: t.color }}>
                  <Icon />
                </div>
                <div style={{ fontWeight: 600 }}>{t.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
