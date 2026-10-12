'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { employeeById } from '@/lib/data';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Actor } from '@/lib/hiringStore';
import { REJECTION_REASONS, InterviewStatus, JobStatus, OfferStatus, RequisitionStatus, Stage, Exit } from '@/lib/hiringTypes';
import { BellIcon, WarnIcon, XIcon } from '@/components/icons';

/* Small pieces shared by every Hiring Management screen. */

/** The signed-in person as the actor recorded on history and audit entries. */
export function useActor(): Actor {
  const { role } = useApp();
  const me = useCurrentEmployee();
  return { id: me.id, name: me.name, role };
}

/** The UAE / India toggle shared with the dashboard. Everything in the module follows it, including currency. */
export function useHiringLocation() {
  const { location, setLocation } = useApp();
  const { locations, locationDef } = useOrg();
  const loc = locations.some((l) => l.id === location) ? location : (locations[0]?.id ?? 'Dubai');
  const def = locationDef(loc);
  return { loc, def, currency: def?.currency ?? 'AED', setLocation, locations };
}

export function LocationTabs() {
  const { loc, setLocation, locations } = useHiringLocation();
  return (
    <div className="dh-seg hm-loc" role="tablist" aria-label="Location">
      {locations.map((l) => (
        <button key={l.id} type="button" role="tab" aria-selected={loc === l.id} className={loc === l.id ? 'on' : ''} onClick={() => setLocation(l.id)}>
          {l.name}
        </button>
      ))}
    </div>
  );
}

export const empName = (id?: string) => (id ? (employeeById(id)?.name ?? id) : '—');

export const money = (n: number | undefined, cur: string) => (n === undefined || Number.isNaN(n) ? '—' : `${cur} ${n.toLocaleString('en-US')}`);
/** UAE pay is quoted per month and India's per year. */
export const payUnit = (cur: string) => (cur === 'INR' ? 'per year' : 'per month');

export const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${iso.slice(11, 16)}`;

export const TZ_LABEL: Record<string, string> = { Dubai: 'Asia/Dubai (GST)', Kochi: 'Asia/Kolkata (IST)' };

const REQ_TONE: Record<RequisitionStatus, 'active' | 'pending' | 'soon' | 'expired' | 'inactive' | 'info'> = {
  Draft: 'inactive',
  'Pending Approval': 'pending',
  Approved: 'active',
  Rejected: 'expired',
  'On Hold': 'soon',
  Closed: 'inactive',
};
export const ReqBadge = ({ status }: { status: RequisitionStatus }) => <Badge tone={REQ_TONE[status]}>{status}</Badge>;

const JOB_TONE: Record<JobStatus, 'active' | 'pending' | 'soon' | 'expired' | 'inactive' | 'info'> = { Draft: 'inactive', Open: 'active', 'On Hold': 'soon', Closed: 'inactive', Filled: 'info' };
export const JobBadge = ({ status }: { status: JobStatus }) => <Badge tone={JOB_TONE[status]}>{status}</Badge>;

const OFFER_TONE: Record<OfferStatus, 'active' | 'pending' | 'soon' | 'expired' | 'inactive' | 'info'> = {
  Draft: 'inactive',
  'Pending Approval': 'pending',
  Approved: 'info',
  Sent: 'info',
  Accepted: 'active',
  Declined: 'expired',
  Expired: 'soon',
  Revoked: 'inactive',
};
export const OfferBadge = ({ status }: { status: OfferStatus }) => <Badge tone={OFFER_TONE[status]}>{status}</Badge>;

const IV_TONE: Record<InterviewStatus, 'active' | 'pending' | 'soon' | 'expired' | 'inactive' | 'info'> = { Scheduled: 'info', Completed: 'active', Cancelled: 'inactive' };
export const InterviewBadge = ({ status }: { status: InterviewStatus }) => <Badge tone={IV_TONE[status]}>{status}</Badge>;

/** Where a candidate stands: their stage, or how they left the pipeline. */
export function StageBadge({ stage, exit }: { stage: Stage; exit?: Exit }) {
  if (exit) return <Badge tone={exit === 'Rejected' ? 'expired' : exit === 'On Hold' ? 'soon' : 'inactive'}>{exit}</Badge>;
  return <Badge tone={stage === 'Hired' ? 'active' : stage === 'Offer' ? 'pending' : 'info'}>{stage}</Badge>;
}

/** A labelled form field with an inline error. */
export function Fg({ label, required, error, hint, full, children }: { label: string; required?: boolean; error?: string; hint?: string; full?: boolean; children: React.ReactNode }) {
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
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span id={errId} className="hint" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

export const TEXTAREA_STYLE: React.CSSProperties = { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' };

export function Banner({ children, onClose, tone = 'info' }: { children: React.ReactNode; onClose?: () => void; tone?: 'info' | 'warn' }) {
  return (
    <div className={`note-box tx-banner ${tone === 'warn' ? 'hm-warn' : ''}`} role="status">
      {tone === 'warn' ? <WarnIcon /> : <BellIcon />}
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && (
        <button type="button" className="icon-act" title="Dismiss" aria-label="Dismiss" onClick={onClose}>
          <XIcon />
        </button>
      )}
    </div>
  );
}

/** Asks why a candidate is being rejected. A reason is required; the note is optional. */
export function RejectDialog({ open, count = 1, onCancel, onConfirm }: { open: boolean; count?: number; onCancel: () => void; onConfirm: (reason: string, note: string) => void }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const first = useRef<HTMLSelectElement>(null);
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  });
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReason('');
    setNote('');
    setError('');
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fm-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="fm-dialog" role="dialog" aria-modal="true" aria-label="Reject candidate">
        <h3>Reject {count > 1 ? `${count} candidates` : 'candidate'}</h3>
        <p>The reason is kept on the candidate&apos;s history and used in the rejection-reasons report.</p>
        <div className="fg" style={{ marginTop: 10 }}>
          <label>
            Reason <span className="req">*</span>
          </label>
          <select
            ref={first}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            aria-invalid={!!error}
          >
            <option value="">Select a reason…</option>
            {REJECTION_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          {error && (
            <span className="hint" style={{ color: 'var(--danger)' }}>
              {error}
            </span>
          )}
        </div>
        <div className="fg" style={{ marginTop: 10 }}>
          <label>Note</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional detail for the record" style={TEXTAREA_STYLE} />
        </div>
        <div className="fm-dialog-act">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (!reason) return setError('Choose a reason.');
              onConfirm(reason, note);
            }}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

/** Page title and actions, then one toolbar row with the UAE / India toggle (and anything else the page wants beside it). */
export function HiringHeader({ eyebrow = 'Hiring Management', title, description, actions, bar }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode; bar?: React.ReactNode }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      <div className="hm-bar">
        <LocationTabs />
        <span className="sp" />
        {bar}
      </div>
    </>
  );
}

export interface HeroStat {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** 0–100 draws a thin progress bar under the value. */
  progress?: number;
}

/** The top card of a record page (job, requisition, candidate): who it is, its status, the actions, and the key figures. */
export function Hero({ icon, title, badges, meta, actions, stats }: { icon: React.ReactNode; title: string; badges?: React.ReactNode; meta?: React.ReactNode[]; actions?: React.ReactNode; stats?: HeroStat[] }) {
  return (
    <section className="hm-hero">
      <div className="hm-hero-main">
        <span className="hm-hero-ic">{icon}</span>
        <div className="hm-hero-tx">
          <div className="hm-hero-t">
            <h1>{title}</h1>
            {badges}
          </div>
          {meta && meta.length > 0 && (
            <div className="hm-hero-meta">
              {meta.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="hm-hero-act">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="hm-hero-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <span className="l">{s.label}</span>
              <b>{s.value}</b>
              {s.progress !== undefined && (
                <span className="hm-hero-bar" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, Math.max(0, s.progress))}%` }} />
                </span>
              )}
              {s.hint && <small>{s.hint}</small>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
