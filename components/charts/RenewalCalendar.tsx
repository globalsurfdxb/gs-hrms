interface RenewalItem {
  id: string;
  label: string;
  sub: string;
  offsetDays: number;
}

function colorFor(offsetDays: number) {
  if (offsetDays < 0) return '#EF4444';
  if (offsetDays <= 30) return '#F97316';
  return '#22C55E';
}

export function RenewalCalendar({ items }: { items: RenewalItem[] }) {
  return (
    <div style={{ padding: '16px 18px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10.5,
          color: 'var(--faint)',
          borderBottom: '1px dashed var(--border)',
          paddingBottom: 6,
          marginBottom: 2,
          fontWeight: 600,
        }}
      >
        <span>TODAY</span>
        <span>+30d</span>
        <span>+60d</span>
        <span>+90d</span>
      </div>
      {items.map((it) => {
        const pos = it.offsetDays < 0 ? 2 : Math.min(96, (it.offsetDays / 90) * 100);
        const color = colorFor(it.offsetDays);
        const label = it.offsetDays < 0 ? `${it.offsetDays}d` : `+${it.offsetDays}d`;
        return (
          <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {it.label}
              <div style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 500 }}>{it.sub}</div>
            </div>
            <div style={{ position: 'relative', height: 22 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'var(--border-soft)', borderRadius: 2 }} />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  left: `${pos}%`,
                  background: color,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 5,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
