'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { todayISO } from '@/lib/dates';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const POP_W = 312;
const POP_H = 372;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Monday = 0. */
const firstDow = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;

function parse(v: string): { y: number; m: number; d: number } | null {
  const hit = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);
  if (!hit) return null;
  return { y: Number(hit[1]), m: Number(hit[2]) - 1, d: hit[3] ? Number(hit[3]) : 1 };
}

function show(v: string, mode: 'date' | 'month'): string {
  const p = parse(v);
  if (!p) return '';
  const mon = MONTHS[p.m].slice(0, 3);
  return mode === 'month' ? `${mon} ${p.y}` : `${p.d} ${mon} ${p.y}`;
}

/** The text a person types and sees while editing: DD/MM/YYYY, or MM/YYYY in month mode. */
function typed(v: string, mode: 'date' | 'month'): string {
  const p = parse(v);
  if (!p) return '';
  return mode === 'month' ? `${pad(p.m + 1)}/${p.y}` : `${pad(p.d)}/${pad(p.m + 1)}/${p.y}`;
}

/** Digits laid out as DD/MM/YYYY (MM/YYYY), adding the slashes as they are typed. */
function mask(digits: string, mode: 'date' | 'month'): string {
  const parts = mode === 'month' ? [digits.slice(0, 2), digits.slice(2, 6)] : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  return parts.filter(Boolean).join('/');
}

/** A complete, real date from typed text, as an ISO string; null while it is incomplete or not a real date. */
function fromTyped(text: string, mode: 'date' | 'month'): string | null {
  const d = text.replace(/\D/g, '');
  if (mode === 'month') {
    if (d.length !== 6) return null;
    const m = Number(d.slice(0, 2));
    const y = Number(d.slice(2));
    return m >= 1 && m <= 12 && y >= 1900 ? `${y}-${pad(m)}` : null;
  }
  if (d.length !== 8) return null;
  const day = Number(d.slice(0, 2));
  const m = Number(d.slice(2, 4));
  const y = Number(d.slice(4));
  if (m < 1 || m > 12 || y < 1900 || day < 1 || day > daysIn(y, m - 1)) return null;
  return iso(y, m - 1, day);
}

type Panel = 'days' | 'months' | 'years';

export interface DateFieldProps {
  value?: string;
  /** Called with the new value in `e.target.value`, the same shape as a native input, so existing handlers keep working. */
  onChange?: (e: { target: { value: string } }) => void;
  min?: string;
  max?: string;
  mode?: 'date' | 'month';
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  'aria-label'?: string;
}

/** A date box that opens a calendar. Pick a day, or jump straight to another month or year. Values are ISO strings
    (YYYY-MM-DD, or YYYY-MM in month mode), like a native date input. */
export function DateField({ value = '', onChange, min, max, mode = 'date', disabled, required, placeholder, id, name, className, style, autoFocus, ...aria }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('days');
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [yearBase, setYearBase] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [focusDay, setFocusDay] = useState(1);
  /** What is being typed, while the box has focus; null otherwise (the box then shows the readable date). */
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const quiet = useRef(false);
  /** Set while the arrow keys move through the days, so focus follows them (and does not leave a typing box). */
  const keyNav = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const popId = useId();
  const today = todayISO();
  const selected = parse(value);
  const sheet = typeof window !== 'undefined' && window.innerWidth < 560;

  const place = useCallback(() => {
    const r = input.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const top = below >= POP_H + 12 || r.top < POP_H + 12 ? r.bottom + 6 : r.top - POP_H - 6;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8));
    setPos({ top: Math.max(8, Math.min(top, window.innerHeight - POP_H - 8)), left });
  }, []);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus && input.current) {
      if (document.activeElement !== input.current) quiet.current = true;
      input.current.focus({ preventScroll: true });
    }
  }, []);

  const openPicker = () => {
    if (disabled) return;
    keyNav.current = false;
    const base = selected ?? parse(today) ?? { y: new Date().getFullYear(), m: 0, d: 1 };
    setView({ y: base.y, m: base.m });
    setFocusDay(selected?.d ?? (base.y === parse(today)?.y && base.m === parse(today)?.m ? parse(today)!.d : 1));
    setPanel(mode === 'month' ? 'months' : 'days');
    setYearBase(base.y - (base.y % 12));
    place();
    setOpen(true);
  };

  // Keep the calendar attached to its box while the page or a drawer scrolls, and close it on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (pop.current?.contains(t) || wrap.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place, close]);

  // Move keyboard focus onto the day being browsed.
  useEffect(() => {
    if (open && panel === 'days' && keyNav.current) pop.current?.querySelector<HTMLButtonElement>(`button[data-day="${focusDay}"]`)?.focus({ preventScroll: true });
  }, [open, panel, focusDay, view]);

  const commit = (v: string) => {
    onChange?.({ target: { value: v } });
    setDraft(null);
    setBad(false);
    close();
  };

  const maxDigits = mode === 'month' ? 6 : 8;

  /** Typed text changed: keep the layout, and apply the date as soon as it is complete and allowed. */
  const typeIn = (digitsIn: string) => {
    const digits = digitsIn.slice(0, maxDigits);
    const text = mask(digits, mode);
    setDraft(text);
    const v = fromTyped(text, mode);
    if (v && !outOfRange(v)) {
      setBad(false);
      onChange?.({ target: { value: v } });
      const p = parse(v)!;
      setView({ y: p.y, m: p.m });
      setFocusDay(p.d);
      setYearBase(p.y - (p.y % 12));
    } else if (!digits && !required) {
      setBad(false);
      if (value) onChange?.({ target: { value: '' } });
    } else setBad(digits.length === maxDigits);
  };

  const outOfRange = (v: string) => (!!min && v < (mode === 'month' ? min.slice(0, 7) : min)) || (!!max && v > (mode === 'month' ? max.slice(0, 7) : max));
  const monthBlocked = (y: number, m: number) => (!!min && `${y}-${pad(m + 1)}` < min.slice(0, 7)) || (!!max && `${y}-${pad(m + 1)}` > max.slice(0, 7));
  const yearBlocked = (y: number) => (!!min && y < Number(min.slice(0, 4))) || (!!max && y > Number(max.slice(0, 4)));

  const step = (delta: number) => {
    if (panel === 'years') return setYearBase((b) => b + delta * 12);
    if (panel === 'months') return setView((v) => ({ ...v, y: v.y + delta }));
    setView((v) => {
      const t = v.y * 12 + v.m + delta;
      return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });
  };

  const onDayKey = (e: React.KeyboardEvent, d: number) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!move) return;
    e.preventDefault();
    keyNav.current = true;
    const next = d + move;
    const len = daysIn(view.y, view.m);
    if (next < 1) {
      const t = view.y * 12 + view.m - 1;
      const y = Math.floor(t / 12);
      const m = ((t % 12) + 12) % 12;
      setView({ y, m });
      setFocusDay(daysIn(y, m) + next);
    } else if (next > len) {
      const t = view.y * 12 + view.m + 1;
      setView({ y: Math.floor(t / 12), m: t % 12 });
      setFocusDay(next - len);
    } else setFocusDay(next);
  };

  const title = panel === 'days' ? `${MONTHS[view.m]} ${view.y}` : panel === 'months' ? String(view.y) : `${yearBase} – ${yearBase + 11}`;
  const lead = firstDow(view.y, view.m);
  const total = daysIn(view.y, view.m);

  const calendar = open && (sheet || pos) && (
    <>
      {sheet && <div className="dp-scrim" onPointerDown={() => setOpen(false)} />}
      <div ref={pop} id={popId} className={`dp-pop ${sheet ? 'sheet' : ''}`} role="dialog" aria-modal="false" aria-labelledby={titleId} style={sheet ? undefined : { top: pos!.top, left: pos!.left, width: POP_W }}>
        <div className="dp-head">
          <button type="button" className="dp-nav" aria-label={panel === 'days' ? 'Previous month' : panel === 'months' ? 'Previous year' : 'Previous years'} onClick={() => step(-1)}>
            ‹
          </button>
          <button
            type="button"
            id={titleId}
            className="dp-title"
            aria-live="polite"
            onClick={() => {
              if (panel === 'days') setPanel('months');
              else if (panel === 'months') {
                setYearBase(view.y - (view.y % 12));
                setPanel('years');
              } else setPanel(mode === 'month' ? 'months' : 'days');
            }}
          >
            {title}
            <span aria-hidden>{panel === 'days' ? '▾' : ''}</span>
          </button>
          <button type="button" className="dp-nav" aria-label={panel === 'days' ? 'Next month' : panel === 'months' ? 'Next year' : 'Next years'} onClick={() => step(1)}>
            ›
          </button>
        </div>

        {panel === 'days' && (
          <div className="dp-grid" role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`}>
            {WEEKDAYS.map((w) => (
              <span key={w} className="dp-dow" aria-hidden>
                {w}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: total }, (_, i) => {
              const d = i + 1;
              const v = iso(view.y, view.m, d);
              const blocked = outOfRange(v);
              const cls = ['dp-day', v === value ? 'sel' : '', v === today ? 'today' : '', (lead + i) % 7 >= 5 ? 'we' : ''].filter(Boolean).join(' ');
              return (
                <button key={d} type="button" data-day={d} className={cls} disabled={blocked} tabIndex={d === focusDay ? 0 : -1} aria-pressed={v === value} aria-label={`${d} ${MONTHS[view.m]} ${view.y}`} onClick={() => commit(v)} onKeyDown={(e) => onDayKey(e, d)}>
                  {d}
                </button>
              );
            })}
          </div>
        )}

        {panel === 'months' && (
          <div className="dp-pick">
            {MONTHS.map((n, m) => {
              const on = selected?.y === view.y && selected.m === m;
              return (
                <button
                  key={n}
                  type="button"
                  className={`dp-cell ${on ? 'sel' : ''}`}
                  disabled={monthBlocked(view.y, m)}
                  onClick={() => {
                    if (mode === 'month') return commit(`${view.y}-${pad(m + 1)}`);
                    setView({ y: view.y, m });
                    setFocusDay(selected && selected.y === view.y && selected.m === m ? selected.d : 1);
                    setPanel('days');
                  }}
                >
                  {n.slice(0, 3)}
                </button>
              );
            })}
          </div>
        )}

        {panel === 'years' && (
          <div className="dp-pick">
            {Array.from({ length: 12 }, (_, i) => yearBase + i).map((y) => (
              <button
                key={y}
                type="button"
                className={`dp-cell ${selected?.y === y ? 'sel' : ''}`}
                disabled={yearBlocked(y)}
                onClick={() => {
                  setView((v) => ({ ...v, y }));
                  setPanel('months');
                }}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        <div className="dp-foot">
          {!required && value ? (
            <button type="button" className="dp-link" onClick={() => commit('')}>
              Clear
            </button>
          ) : (
            <span />
          )}
          {!outOfRange(mode === 'month' ? today.slice(0, 7) : today) && (
            <button type="button" className="dp-link" onClick={() => commit(mode === 'month' ? today.slice(0, 7) : today)}>
              {mode === 'month' ? 'This month' : 'Today'}
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div ref={wrap} className={`dp ${disabled ? 'off' : ''}`}>
      <input
        ref={input}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        className={[className, bad ? 'dp-bad' : ''].filter(Boolean).join(' ') || undefined}
        style={style}
        value={draft ?? show(value, mode)}
        placeholder={placeholder ?? (mode === 'month' ? 'MM/YYYY' : 'DD/MM/YYYY')}
        title={bad ? 'Enter a real date' + (min || max ? ' within the allowed range' : '') : undefined}
        role="combobox"
        aria-haspopup="dialog"
        aria-controls={popId}
        aria-expanded={open}
        aria-required={required || undefined}
        onFocus={() => {
          if (quiet.current) {
            quiet.current = false;
            return;
          }
          setDraft(typed(value, mode));
        }}
        onBlur={() => {
          setDraft(null);
          setBad(false);
        }}
        onClick={(e) => {
          e.currentTarget.select();
          if (!open) openPicker();
        }}
        onChange={(e) => {
          const data = (e.nativeEvent as InputEvent).data;
          const had = (draft ?? typed(value, mode)).replace(/\D/g, '');
          if (draft === null) typeIn(data ? data.replace(/\D/g, '') : had.slice(0, -1));
          else {
            let digits = e.target.value.replace(/\D/g, '');
            // Deleting a slash removes the digit before it.
            if (digits.length === had.length && e.target.value.length < draft.length) digits = digits.slice(0, -1);
            typeIn(digits);
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const t = e.clipboardData.getData('text').trim();
          const isoHit = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
          typeIn(isoHit ? (mode === 'month' ? `${isoHit[2]}${isoHit[1]}` : `${isoHit[3]}${isoHit[2]}${isoHit[1]}`) : t.replace(/\D/g, ''));
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) {
              openPicker();
              keyNav.current = true;
            } else {
              keyNav.current = true;
              pop.current?.querySelector<HTMLButtonElement>('.dp-day[tabindex="0"], .dp-cell.sel, .dp-cell')?.focus({ preventScroll: true });
            }
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open) close();
            else if (!fromTyped(draft ?? '', mode)) {
              openPicker();
              keyNav.current = true;
            }
          } else if (e.key === 'Escape' && !open) setDraft(null);
        }}
        {...aria}
      />
      <button type="button" className="dp-ic" tabIndex={-1} disabled={disabled} aria-label="Open calendar" onClick={() => (open ? setOpen(false) : (input.current?.focus({ preventScroll: true }), openPicker()))}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>
      {typeof document !== 'undefined' && calendar && createPortal(calendar, document.body)}
    </div>
  );
}
