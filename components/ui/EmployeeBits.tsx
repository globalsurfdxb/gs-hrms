'use client';

import { SearchIcon } from '@/components/icons';

export function EmpId({ code }: { code?: string }) {
  if (!code) return null;
  return <span style={{ fontWeight: 400, color: 'var(--faint)' }}> · {code}</span>;
}

export function ListSearch({
  value,
  onChange,
  placeholder = 'Search by name or employee ID…',
  shown,
  total,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  shown?: number;
  total?: number;
}) {
  return (
    <div className="tbar">
      <div className="tsearch" style={{ width: 280 }}>
        <SearchIcon />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </div>
      {value.trim() && shown !== undefined && total !== undefined && (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {shown} of {total}
        </span>
      )}
    </div>
  );
}
