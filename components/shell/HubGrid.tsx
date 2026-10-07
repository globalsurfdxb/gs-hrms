'use client';

import { useRouter } from 'next/navigation';
import { HubItem } from '@/lib/nav';
import { rememberHub } from '@/lib/hubBack';
import {
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

export function HubGrid({ sections, hub }: { sections: { section: string; items: HubItem[] }[]; hub: string }) {
  const router = useRouter();

  return (
    <>
      {sections.map((section) => (
        <div key={section.section}>
          <div className="ops-sec">{section.section}</div>
          <div className="ops-grid">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <div key={item.key} className="ops-card" onClick={() => {
                    rememberHub(hub, item.href);
                    router.push(item.href);
                  }}>
                  <div className="ops-ic" style={{ background: `${item.color}18`, color: item.color }}>
                    <Icon />
                  </div>
                  <div className="ops-t">{item.label}</div>
                  {item.soon && <span className="soon-tag">Soon</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
