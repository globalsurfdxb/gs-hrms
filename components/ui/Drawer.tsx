'use client';

import { useEffect, useState } from 'react';
import { XIcon } from '@/components/icons';

export function Drawer({
  open,
  onClose,
  title,
  description,
  footer,
  wide,
  variant = 'drawer',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  wide?: boolean;
  /** "drawer" slides in from the right (the default); "modal" opens as a centred popup. */
  variant?: 'drawer' | 'modal';
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const t = setTimeout(() => setMounted(false), 280);
    return () => clearTimeout(t);
  }, [open]);

  // A popup can also be closed with Escape.
  useEffect(() => {
    if (!open || variant !== 'modal') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, variant, onClose]);

  if (!mounted) return null;

  return (
    <>
      <div className={`drawer-scrim ${entered ? 'open' : ''}`} onClick={onClose} />
      <div className={`drawer ${variant === 'modal' ? 'modal' : ''} ${wide ? 'wide' : ''} ${entered ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>
  );
}
