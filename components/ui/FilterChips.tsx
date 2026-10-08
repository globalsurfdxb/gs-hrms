export interface ChipOption<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/** A row of filter pills for list toolbars; the active one is highlighted and may show a count. */
export function FilterChips<K extends string>({ options, value, onChange }: { options: ChipOption<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <>
      {options.map((o) => (
        <button key={o.key} type="button" className={`chip ${value === o.key ? 'ss-on' : ''}`} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
          {o.count !== undefined && <span className="ss-chipn">{o.count}</span>}
        </button>
      ))}
    </>
  );
}
