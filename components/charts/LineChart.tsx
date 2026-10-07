export function LineChart({ data }: { data: { month: string; amount: number }[] }) {
  const values = data.map((d) => d.amount);
  const max = Math.max(...values) * 1.05;
  const min = Math.min(...values) * 0.95;
  const step = 560 / (data.length - 1);
  const y = (v: number) => 140 - ((v - min) / (max - min)) * 110;
  const pts = data.map((d, i) => `${20 + i * step},${y(d.amount)}`).join(' ');

  return (
    <div style={{ padding: '18px 12px 8px' }}>
      <svg viewBox="0 0 600 160" style={{ width: '100%', height: 'auto' }}>
        <polyline points={`20,150 ${pts} 580,150`} fill="url(#payrollGradient)" opacity={0.12} />
        <polyline points={pts} fill="none" stroke="#28469A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={d.month} cx={20 + i * step} cy={y(d.amount)} r={3.5} fill="#fff" stroke="#28469A" strokeWidth={2} />
        ))}
        <defs>
          <linearGradient id="payrollGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#28469A" />
            <stop offset="1" stopColor="#28469A" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', padding: '0 12px' }}>
        {data.map((d) => (
          <span key={d.month}>{d.month}</span>
        ))}
      </div>
    </div>
  );
}
