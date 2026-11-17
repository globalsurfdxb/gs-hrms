'use client';

import { useEffect, useId, useRef } from 'react';
import { PlusIcon, XIcon } from '@/components/icons';

/* Form building blocks shared by the employee edit pages (demo data and the backend-connected one). */

/** A labelled field. When it has an error the message is shown under it and the control inside is marked
    aria-invalid and pointed at the message (set on the DOM node so it works for any control, SearchSelect included). */
export function Fg({ label, required, full, hint, error, children }: { label: string; required?: boolean; full?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  const errId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea');
    if (!el) return;
    if (error) {
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', errId);
    } else {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    }
  }, [error, errId]);
  return (
    <div ref={box} className={`fg ${full ? 'full' : ''}`}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {error ? (
        <span id={errId} className="hint" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

export const Sub = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div className="subhd" style={first ? { marginTop: 0 } : { marginTop: 22 }}>
    {children}
  </div>
);

export const TEXTAREA: React.CSSProperties = { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: 'inherit', fontSize: 13, resize: 'vertical' };

/** A list of repeatable entries, each a small card with a remove button. */
export function RowList<T extends object>({ rows, onChange, blank, title, addLabel, empty, render }: { rows: T[]; onChange: (r: T[]) => void; blank: () => T; title: string; addLabel: string; empty: string; render: (row: T, set: (patch: Partial<T>) => void, i: number) => React.ReactNode }) {
  return (
    <div>
      {!rows.length && <div className="erow-empty">{empty}</div>}
      {rows.map((row, i) => (
        <div key={i} className="erow">
          <div className="erow-h">
            <b>
              {title} #{i + 1}
            </b>
            <button type="button" className="icon-act" title={`Remove ${title.toLowerCase()} #${i + 1}`} aria-label={`Remove ${title.toLowerCase()} #${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <XIcon />
            </button>
          </div>
          <div className="form-grid">{render(row, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))), i)}</div>
        </div>
      ))}
      <button type="button" className="addnew" onClick={() => onChange([...rows, blank()])}>
        <PlusIcon /> {addLabel}
      </button>
    </div>
  );
}
