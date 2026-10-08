import { ReminderInfo } from '@/context/ExpiryContext';

export function DaysLeft({ days }: { days: number | null }) {
  if (days === null) return <span style={{ color: 'var(--faint)' }}>—</span>;
  if (days < 0) return <span style={{ color: '#B91C1C', fontWeight: 700 }}>Expired {-days}d ago</span>;
  return <span style={{ color: days <= 30 ? '#C2410C' : days <= 90 ? '#B45309' : 'var(--muted)', fontWeight: days <= 90 ? 600 : 400 }}>{days} days</span>;
}

const TONE: Record<ReminderInfo['tone'], { color: string; weight: number }> = {
  due: { color: '#B45309', weight: 600 },
  escalated: { color: '#B91C1C', weight: 600 },
  sent: { color: 'var(--muted)', weight: 400 },
  next: { color: 'var(--faint)', weight: 400 },
  off: { color: 'var(--faint)', weight: 400 },
  none: { color: 'var(--faint)', weight: 400 },
};

/** The "Reminder" cell: what is due, what was sent, or the escalation state once a document has expired. */
export function ReminderCell({ info }: { info: ReminderInfo }) {
  const t = TONE[info.tone];
  return (
    <div style={{ fontSize: 12 }}>
      <span style={{ color: t.color, fontWeight: t.weight }}>{info.text}</span>
      {info.sub && <div className="ex-sub">{info.sub}</div>}
    </div>
  );
}

/** Red pill shown wherever an employee has an expired mandatory document. */
export function ComplianceFlag({ text, title, dot = false }: { text: string; title?: string; dot?: boolean }) {
  if (!text) return null;
  return dot ? (
    <span className="ex-dot" title={title ?? text} role="img" aria-label={text} />
  ) : (
    <span className="ex-pill" title={title ?? text}>
      <span className="ex-dot" />
      {text}
    </span>
  );
}
