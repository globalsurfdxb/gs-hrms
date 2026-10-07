export function StatCard({
  icon,
  bg,
  fg,
  value,
  label,
  foot,
}: {
  icon: React.ReactNode;
  bg: string;
  fg: string;
  value: React.ReactNode;
  label: string;
  foot?: string;
}) {
  return (
    <div className="widget">
      <div className="top">
        <div>
          <div className="val tnum">{value}</div>
          <div className="lbl">{label}</div>
        </div>
        <div className="ic" style={{ background: bg, color: fg }}>
          {icon}
        </div>
      </div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}
