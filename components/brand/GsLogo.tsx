import { BRAND, GS_FLIP, GS_LETTERS, GS_SQUARES, GS_SQUARE_SIZE, GS_VIEWBOX } from '@/lib/brandAssets';

/** The GS Group logo. `tone="light"` turns the letters white for dark backgrounds; the four squares keep their colours. */
export function GsLogo({ tone = 'dark', height = 28, title = 'GS' }: { tone?: 'dark' | 'light'; height?: number; title?: string }) {
  const ink = tone === 'light' ? '#ffffff' : BRAND.ink;
  return (
    <svg viewBox={GS_VIEWBOX} height={height} role="img" aria-label={title} style={{ display: 'block', width: 'auto' }}>
      <g transform={GS_FLIP}>
        {GS_LETTERS.map((l) => (
          <path key={l.at} transform={`translate(${l.at})`} d={l.d} fill={ink} />
        ))}
        {GS_SQUARES.map((q) => (
          <rect key={`${q.x}-${q.y}`} x={q.x} y={q.y} width={GS_SQUARE_SIZE} height={GS_SQUARE_SIZE} fill={q.fill} />
        ))}
      </g>
    </svg>
  );
}
