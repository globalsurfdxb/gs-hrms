'use client';

import { useState } from 'react';

/** Shows the first `limit` items of a list and lets the person open the rest, so a card grows with what it holds
    instead of cutting the list off or stretching the page. */
export function ShowMore<T>({ items, limit = 5, noun = 'more', children }: { items: T[]; limit?: number; noun?: string; children: (item: T, index: number) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, limit);
  return (
    <>
      {shown.map((it, i) => children(it, i))}
      {items.length > limit && (
        <button type="button" className="sm-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Show fewer' : `Show ${items.length - limit} ${noun}`}
        </button>
      )}
    </>
  );
}
