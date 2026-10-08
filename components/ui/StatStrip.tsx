import Link from 'next/link';

/** Colour pairs shared by tiles and icons across the app. */
export const TONES = {
  blue: { bg: '#e7f0fc', fg: '#2f6fd6' },
  purple: { bg: '#f0eafc', fg: '#7a4bd0' },
  green: { bg: '#e7f6ee', fg: '#1f9d63' },
  amber: { bg: '#fdf3df', fg: '#c6851b' },
  red: { bg: '#fce9e7', fg: '#d5493f' },
  teal: { bg: '#e3f4f8', fg: '#0e8fa8' },
  gray: { bg: '#eef1f6', fg: '#6b7690' },
} as const;
export type Tone = keyof typeof TONES;

export interface StatItem {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: Tone;
  /** Small line under the label. */
  hint?: string;
  /** Makes the tile a link. */
  href?: string;
}

/** A row of summary tiles used at the top of list pages (same look as the Roles and Org chart pages). */
export function StatStrip({ items }: { items: StatItem[] }) {
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
        return s.href ? (
          <Link key={s.label} href={s.href} className="rp-stat link">
            {body}
          </Link>
        ) : (
          <div key={s.label} className="rp-stat">
            {body}
          </div>
        );
      })}
    </div>
  );
}
