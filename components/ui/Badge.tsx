import { ExpiryState } from '@/lib/types';

const CLASS: Record<string, string> = {
  active: 'b-active',
  pending: 'b-pending',
  soon: 'b-soon',
  expired: 'b-expired',
  inactive: 'b-archived',
  info: 'b-info',
};

export function Badge({ tone, children }: { tone: keyof typeof CLASS; children: React.ReactNode }) {
  return (
    <span className={`badge ${CLASS[tone]}`}>
      <span className="d" />
      {children}
    </span>
  );
}

const EXPIRY_LABEL: Record<ExpiryState, string> = {
  ok: 'Valid',
  soon: 'Expiring soon',
  expired: 'Expired',
  na: 'Not applicable',
};

const EXPIRY_TONE: Record<ExpiryState, keyof typeof CLASS> = {
  ok: 'active',
  soon: 'soon',
  expired: 'expired',
  na: 'inactive',
};

export function ExpiryBadge({ state }: { state: ExpiryState }) {
  return <Badge tone={EXPIRY_TONE[state]}>{EXPIRY_LABEL[state]}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, keyof typeof CLASS> = {
    Active: 'active',
    Onboarding: 'pending',
    Offboarding: 'soon',
    Inactive: 'inactive',
    Completed: 'active',
    Pending: 'pending',
    'Pending Approval': 'pending',
    'In Progress': 'info',
    Approved: 'active',
    Rejected: 'expired',
    'Clearance Pending': 'soon',
  };
  return <Badge tone={map[status] ?? 'info'}>{status}</Badge>;
}
