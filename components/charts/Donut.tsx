export function Donut({ segments, total, centerLabel }: { segments: { label: string; count: number; color: string }[]; total: number; centerLabel: string }) {
  const R = 52;
  const C = 2 * Math.PI * R;

  const lengths = segments.map((s) => (s.count / total) * C);
  const arcs = segments.map((s, i) => ({
    ...s,
    len: lengths[i],
    offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }));

  return (
    <div className="donut-wrap">
      <svg width={140} height={140} viewBox="0 0 140 140">
        {arcs.map((s) => (
          <circle key={s.label} cx={70} cy={70} r={R} fill="none" stroke={s.color} strokeWidth={18} strokeDasharray={`${s.len} ${C - s.len}`} strokeDashoffset={-s.offset} transform="rotate(-90 70 70)" />
        ))}
        <text x={70} y={66} textAnchor="middle" fontSize={26} fontWeight={700} fill="#111827">
          {total}
        </text>
        <text x={70} y={84} textAnchor="middle" fontSize={11} fill="#6B7280">
          {centerLabel}
        </text>
      </svg>
      <div className="legend" style={{ flex: 1 }}>
        {segments.map((s) => (
          <div key={s.label} className="li">
            <span className="sw" style={{ background: s.color }} />
            {s.label}
            <span className="lv">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
