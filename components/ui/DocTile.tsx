import { ExpiryState } from '@/lib/types';
import { ExpiryBadge } from '@/components/ui/Badge';
import { FileTextIcon } from '@/components/icons';

const STATE_TONE: Record<ExpiryState, string> = { ok: 'green', soon: 'amber', expired: 'red', na: 'gray' };

/** A clickable document card (icon, name, expiry, state badge) that opens the document viewer. */
export function DocTile({ name, expiryDate, state, onOpen }: { name: string; expiryDate?: string; state: ExpiryState; onOpen: () => void }) {
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
      <span className={`ss-ic sm ss-tone-${STATE_TONE[state]}`}>
        <FileTextIcon />
      </span>
      <div className="ss-dtb">
        <div className="ss-dtn" title={name}>
          {name}
        </div>
        <div className="ss-dts">{expiryDate ? `Expires ${expiryDate}` : 'No expiry'}</div>
      </div>
      <ExpiryBadge state={state} />
    </div>
  );
}
