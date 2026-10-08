import { StatItem, TONES } from '@/components/ui/StatStrip';

export interface FilterStatItem extends StatItem {
  /** Makes the tile a toggle button, e.g. to filter the table below. */
  onClick?: () => void;
  /** Highlights the tile as the active filter. */
  active?: boolean;
}

/** Same tiles as StatStrip, but a tile can act as a filter toggle for the register beneath it. */
export function StatTiles({ items }: { items: FilterStatItem[] }) {
  return (
    <div className="rp-stats">
      {items.map((s) => {
        const c = TONES[s.tone ?? 'blue'];
        const body = (
          <>
            <span className="rp-stat-ic" style={{ background: c.bg, color: c.fg }}>
              {s.icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="rp-stat-n">{s.value}</div>
              <div className="rp-stat-l">{s.label}</div>
              {s.hint && <div className="rp-stat-h">{s.hint}</div>}
            </div>
          </>
        );
        return s.onClick ? (
          <button key={s.label} type="button" className={`rp-stat link lc-stat-btn ${s.active ? 'on' : ''}`} onClick={s.onClick} aria-pressed={!!s.active} title="Click to filter the register">
            {body}
          </button>
        ) : (
          <div key={s.label} className="rp-stat">
            {body}
          </div>
        );
      })}
    </div>
  );
}
