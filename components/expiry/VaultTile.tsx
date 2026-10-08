import { VaultStatus } from '@/lib/expiryRegister';
import { Badge } from '@/components/ui/Badge';
import { FileTextIcon } from '@/components/icons';

const TONE: Record<VaultStatus, string> = { ok: 'green', soon: 'amber', expired: 'red', onfile: 'blue', pending: 'amber' };
const BADGE: Record<VaultStatus, { tone: 'active' | 'soon' | 'expired' | 'info' | 'pending'; label: string }> = {
  ok: { tone: 'active', label: 'Valid' },
  soon: { tone: 'soon', label: 'Expiring soon' },
  expired: { tone: 'expired', label: 'Expired' },
  onfile: { tone: 'active', label: 'On file' },
  pending: { tone: 'pending', label: 'Pending upload' },
};

/** Document status: an expired document shows Expired, and only an uploaded one can show Valid or On file. */
export function VaultBadge({ status }: { status: VaultStatus }) {
  const b = BADGE[status];
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

/** A clickable document card for the vault pages. */
export function VaultTile({ name, expiryDate, status, onOpen }: { name: string; expiryDate?: string; status: VaultStatus; onOpen: () => void }) {
  return (
    <div
      className="ss-dt"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onOpen();
        }
      }}
    >
      <span className={`ss-ic sm ss-tone-${TONE[status]}`}>
        <FileTextIcon />
      </span>
      <div className="ss-dtb">
        <div className="ss-dtn" title={name}>
          {name}
        </div>
        <div className="ss-dts">{expiryDate ? `Expires ${expiryDate}` : 'No expiry'}</div>
      </div>
      <VaultBadge status={status} />
    </div>
  );
}
