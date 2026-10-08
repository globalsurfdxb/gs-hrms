'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HubItem } from '@/lib/nav';
import { rememberHub } from '@/lib/hubBack';
import { EmptyState } from '@/components/ui/Card';
import {
  ArrowRightIcon,
  BellIcon,
  BookIcon,
  BuildingIcon,
  CheckIcon,
  ClockIcon,
  ExitIcon,
  FlowIcon,
  FolderIcon,
  GearIcon,
  GridIcon,
  HistoryIcon,
  IdIcon,
  JoinIcon,
  KeyIcon,
  PeopleIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  StarIcon,
  TagIcon,
  TreeIcon,
  UserXIcon,
} from '@/components/icons';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  people: PeopleIcon,
  join: JoinIcon,
  exit: ExitIcon,
  id: IdIcon,
  folder: FolderIcon,
  building: BuildingIcon,
  userx: UserXIcon,
  star: StarIcon,
  book: BookIcon,
  clock: ClockIcon,
  grid: GridIcon,
  receipt: ReceiptIcon,
  plus: PlusIcon,
  tag: TagIcon,
  check: CheckIcon,
  key: KeyIcon,
  flow: FlowIcon,
  bell: BellIcon,
  history: HistoryIcon,
  gear: GearIcon,
  tree: TreeIcon,
};

/** One-line description shown under each hub card title. */
const DESC: Record<string, string> = {
  directory: 'Browse and manage every employee record',
  onboarding: 'Bring new joiners on board, step by step',
  offboarding: 'Resignations, clearance and exit approvals',
  performance: 'Review cycles, ratings and goals',
  learning: 'Training records and certifications',
  visa: 'Residence visas and Emirates ID tracking',
  expiry: 'Documents expiring across the workforce',
  'exp-dashboard': 'Spend overview and claim trends',
  'exp-claims': 'Every expense claim in one list',
  'exp-new': 'Submit a new expense claim',
  'exp-approvals': 'Claims waiting for a decision',
  'exp-cats': 'Expense categories and policy limits',
  'admin-companies': 'Legal entities and their details',
  'admin-structure': 'Departments, heads and designations',
  'admin-roles': 'Who can see and do what',
  'admin-workflow': 'Approval chains and workflow rules',
  'admin-notif': 'Events, channels and recipients',
  'admin-reminders': 'Expiry reminder schedules',
  'admin-audit': 'Who changed what, and when',
  'admin-settings': 'Locations and system configuration',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function HubGrid({ sections, hub }: { sections: { section: string; items: HubItem[] }[]; hub: string }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const shown = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => !needle || `${i.label} ${DESC[i.key] ?? ''} ${s.section}`.toLowerCase().includes(needle)),
    }))
    .filter((s) => s.items.length > 0);
  const shownCount = shown.reduce((n, s) => n + s.items.length, 0);

  return (
    <>
      <div className="ad-hub-bar">
        <div className="tsearch">
          <SearchIcon />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…" aria-label="Search tools" />
        </div>
        <span className="ad-count">{needle ? `${shownCount} of ${total} tools` : plural(total, 'tool')}</span>
      </div>

      {shown.length === 0 && (
        <div className="card row-gap">
          <EmptyState icon={<SearchIcon />} title="No tools match" description={`Nothing matches "${q.trim()}". Try a shorter or different word.`} />
        </div>
      )}

      {shown.map((section) => (
        <div key={section.section}>
          <div className="ad-hub-sec">
            <h2>{section.section}</h2>
            <span>{plural(section.items.length, 'tool')}</span>
          </div>
          <div className="ad-hub-grid">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <Link key={item.key} href={item.href} className="ad-hub-card" onClick={() => rememberHub(hub, item.href)}>
                  <div className="ad-hub-ic" style={{ background: `${item.color}18`, color: item.color }}>
                    <Icon />
                  </div>
                  <div className="ad-hub-tx">
                    <div className="ad-hub-t">
                      {item.label}
                      {item.soon && <span className="soon-tag">Soon</span>}
                    </div>
                    {DESC[item.key] && <div className="ad-hub-d">{DESC[item.key]}</div>}
                  </div>
                  <span className="ad-hub-go">
                    <ArrowRightIcon />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
