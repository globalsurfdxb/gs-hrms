'use client';

import { useId, useState } from 'react';
import { ChevronDownIcon } from '@/components/icons';

export interface SearchOption {
  value: string;
  label: string;
  meta?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  emptyText = 'No matches',
  disabled,
}: {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => `${o.label} ${o.meta ?? ''}`.toLowerCase().includes(q)) : options;

  const openList = () => {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (o: SearchOption) => {
    onChange(o.value);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      openList();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selected?.label ?? ''}
        placeholder={open && selected ? selected.label : placeholder}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={() => {
          setOpen(false);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        style={{ width: '100%', paddingRight: 34, cursor: disabled ? 'not-allowed' : 'text' }}
      />
      <ChevronDownIcon style={{ position: 'absolute', right: 11, top: 12, width: 15, height: 15, color: 'var(--faint)', pointerEvents: 'none' }} />
      {open && (
        <div
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 30,
            maxHeight: 240,
            overflowY: 'auto',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
          }}
        >
          {filtered.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--muted)' }}>{emptyText}</div>}
          {filtered.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
                background: i === active ? 'var(--primary-50)' : undefined,
                fontWeight: o.value === value ? 700 : 500,
                color: 'var(--text)',
              }}
            >
              <span>{o.label}</span>
              {o.meta && <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{o.meta}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
