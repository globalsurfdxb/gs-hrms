type IconProps = { className?: string; style?: React.CSSProperties };

const base = (path: React.ReactNode) =>
  function Icon({ className, style }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        {path}
      </svg>
    );
  };

export const HomeIcon = base(<path d="M4 11.5 12 4l8 7.5M6 10v9h12v-9" />);
export const PeopleIcon = base(<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2S15.5 16.4 15.5 20" /><circle cx="17" cy="8.5" r="2.6" /><path d="M15.5 13.9c2.9.3 5 2.7 5 6.1" /></>);
export const JoinIcon = base(<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2S15.5 16.4 15.5 20" /><path d="M18 8v6M15 11h6" /></>);
export const ExitIcon = base(<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2S15.5 16.4 15.5 20" /><path d="M15 11h6M21 11l-2.5-2.5M21 11l-2.5 2.5" /></>);
export const TreeIcon = base(<><circle cx="12" cy="5" r="2.2" /><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="19" r="2.2" /><path d="M12 7.2V12M12 12H6v4.8M12 12h6v4.8" /></>);
export const BuildingIcon = base(<><rect x="4" y="3" width="10" height="18" rx="1" /><path d="M14 8h6v13h-6M7.5 7h1M7.5 10.5h1M7.5 14h1M7.5 17.5h1" /></>);
export const FolderIcon = base(<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z" />);
export const IdIcon = base(<><rect x="2.5" y="5" width="19" height="14" rx="2" /><circle cx="8.5" cy="12" r="2.2" /><path d="M6 16.5c.6-1.4 1.6-2 2.5-2s1.9.6 2.5 2M14 9.5h5M14 13h5M14 16.5h3.5" /></>);
export const InboxIcon = base(<><path d="M3 12.5 5.5 5h13L21 12.5" /><path d="M3 12.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18v-5.5M3 12.5h5.2c.3 1.2 1.4 2 3.3 2s3-.8 3.3-2H21" /></>);
export const UserIcon = base(<><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" /></>);
export const MapPinIcon = base(<><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.6" /></>);
export const SearchIcon = base(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>);
export const BellIcon = base(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>);
export const ChevronRightIcon = base(<path d="m9 6 6 6-6 6" />);
export const ChevronDownIcon = base(<path d="m6 9 6 6 6-6" />);
export const PlusIcon = base(<path d="M12 5v14M5 12h14" />);
export const MenuIcon = base(<path d="M4 6h16M4 12h16M4 18h16" />);
export const ArrowLeftIcon = base(<path d="M19 12H5M12 19l-7-7 7-7" />);
export const ArrowRightIcon = base(<path d="M5 12h14M12 5l7 7-7 7" />);
export const CheckIcon = base(<path d="M20 6 9 17l-5-5" />);
export const XIcon = base(<path d="M18 6 6 18M6 6l12 12" />);
export const UploadIcon = base(<path d="M12 16V4M7 9l5-5 5 5M4 20h16" />);
export const GridIcon = base(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>);
export const ListIcon = base(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>);
export const ClockIcon = base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>);
export const WarnIcon = base(<><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>);
export const ShieldIcon = base(<path d="M12 2 3 7v6c0 5 3.5 8 9 9 5.5-1 9-4 9-9V7Z" />);
export const DownloadIcon = base(<path d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14" />);
export const EditIcon = base(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />);
export const GearIcon = base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.8a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.2 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.2 1.6 1.6 0 0 0 10 2.7V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 4.2a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>);
export const OpsIcon = base(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);
export const ReportsIcon = base(<><path d="M4 20V10M12 20V4M20 20v-7" /></>);
export const UserXIcon = base(<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2S15.5 16.4 15.5 20" /><path d="M15 8l6 6M21 8l-6 6" /></>);
export const StarIcon = base(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z" />);
export const BookIcon = base(<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5V5.5" /></>);
export const ReceiptIcon = base(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>);
export const TagIcon = base(<><path d="M3 12 12 3h6a2 2 0 0 1 2 2v6l-9 9a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8Z" /><circle cx="15.5" cy="7.5" r="1.3" /></>);
export const KeyIcon = base(<><circle cx="8" cy="15" r="3.5" /><path d="M10.5 12.5 19 4M17 6l2 2M14.5 8.5l2 2" /></>);
export const FlowIcon = base(<><rect x="3" y="3" width="6" height="6" rx="1.4" /><rect x="15" y="15" width="6" height="6" rx="1.4" /><path d="M9 6h6a3 3 0 0 1 3 3v6" /></>);
export const HistoryIcon = base(<><path d="M3 12a9 9 0 1 0 2.6-6.3L3 8" /><path d="M3 3v5h5M12 7v5l3.5 2" /></>);
export const FileTextIcon = base(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>);
export const PackageIcon = base(<><path d="m21 8-9-5-9 5 9 5 9-5ZM3 8v8l9 5 9-5V8" /><path d="M12 13v8M3 8l9 5 9-5" /></>);
export const RefreshIcon = base(<path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v4h-4" />);
