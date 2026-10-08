'use client';

import { useEffect, useId, useRef } from 'react';

/** A small in-app confirmation dialog. Escape and the backdrop cancel, Tab stays inside the dialog, and focus
    returns to whatever opened it. Focus starts on the safe (cancel) button. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelFn = useRef(onCancel);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    cancelFn.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        cancelFn.current();
        return;
      }
      if (ev.key !== 'Tab' || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (ev.shiftKey && (active === first || !ref.current.contains(active))) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && (active === last || !ref.current.contains(active))) {
        ev.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fm-dialog-scrim" onMouseDown={(ev) => ev.target === ev.currentTarget && onCancel()}>
      <div ref={ref} className="fm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
        <h3 id={titleId}>{title}</h3>
        <p id={bodyId}>{message}</p>
        <div className="fm-dialog-act">
          <button ref={cancelRef} type="button" className="btn ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? "danger" : "primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
