import { TONES, Tone } from '@/components/ui/StatStrip';

const ORDER: Tone[] = ['blue', 'purple', 'green', 'amber', 'red', 'teal'];

/** Stable colour pair for a seed string (a department, a name…), so the same group always reads the same colour. */
export function toneFor(seed: string) {
  const n = [...seed].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return TONES[ORDER[n % ORDER.length]];
}

/** Initials tile used in lists, tables and profile headers. */
export function Avatar({ initials, seed, size = 34 }: { initials: string; seed?: string; size?: number }) {
  const c = toneFor(seed ?? initials);
  return (
    <span className="lc-av" style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: Math.max(10, Math.round(size * 0.36)), borderRadius: Math.round(size * 0.29) }} aria-hidden="true">
      {initials}
    </span>
  );
}
