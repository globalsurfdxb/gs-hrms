'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Card';
import { StatStrip, TONES, Tone } from '@/components/ui/StatStrip';
import { Toggle } from '@/components/ui/Toggle';
import { BellIcon, CheckIcon, ClockIcon, ExitIcon, FileTextIcon, IdIcon, InboxIcon, JoinIcon, ReceiptIcon, SearchIcon, WarnIcon } from '@/components/icons';

interface Rule {
  key: string;
  event: string;
  email: boolean;
  inApp: boolean;
  recipients: string[];
  on: boolean;
}

const RULES: Rule[] = [
  { key: 'visa', event: 'Visa / Emirates ID expiring', email: true, inApp: true, recipients: ['Employee', 'HR'], on: true },
  { key: 'onboarding', event: 'New onboarding request', email: true, inApp: false, recipients: ['HR'], on: true },
  { key: 'offboarding', event: 'Separation case started', email: true, inApp: false, recipients: ['HR', 'Manager'], on: true },
  { key: 'request-stale', event: 'Request pending over 48 hours', email: true, inApp: false, recipients: ['Manager'], on: true },
  { key: 'document', event: 'Document expiring', email: false, inApp: true, recipients: ['Employee'], on: true },
  { key: 'expense', event: 'Expense claim submitted', email: true, inApp: false, recipients: ['Approver'], on: true },
  { key: 'expense-over', event: 'Expense claim exceeds policy limit', email: true, inApp: true, recipients: ['HR', 'Approver'], on: false },
];

const META: Record<string, { icon: React.ReactNode; tone: Tone }> = {
  visa: { icon: <IdIcon />, tone: 'blue' },
  onboarding: { icon: <JoinIcon />, tone: 'green' },
  offboarding: { icon: <ExitIcon />, tone: 'purple' },
  'request-stale': { icon: <ClockIcon />, tone: 'amber' },
  document: { icon: <FileTextIcon />, tone: 'teal' },
  expense: { icon: <ReceiptIcon />, tone: 'blue' },
  'expense-over': { icon: <WarnIcon />, tone: 'red' },
};

type Filter = 'all' | 'on' | 'off';

export default function AdminNotificationsPage() {
  const [rules, setRules] = useState(RULES);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const patch = (key: string, p: Partial<Rule>) => setRules((prev) => prev.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const enabled = rules.filter((r) => r.on).length;
  const needle = q.trim().toLowerCase();
  const shown = rules.filter(
    (r) => (filter === 'all' || (filter === 'on' ? r.on : !r.on)) && (!needle || `${r.event} ${r.recipients.join(' ')}`.toLowerCase().includes(needle))
  );

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Notification Rules" description="Which events trigger a notification, over which channel, and who receives it." />

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Rules configured', value: rules.length, icon: <BellIcon />, tone: 'blue' },
            { label: 'Enabled', value: enabled, icon: <CheckIcon />, tone: 'green' },
            { label: 'Paused', value: rules.length - enabled, icon: <ClockIcon />, tone: rules.length - enabled ? 'amber' : 'gray' },
            { label: 'Send email', value: rules.filter((r) => r.on && r.email).length, icon: <InboxIcon />, tone: 'purple', hint: 'Enabled rules' },
          ]}
        />
      </div>

      <div className="card">
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an event or recipient…" />
          </div>
          <div className="subseg" style={{ margin: 0 }} role="group" aria-label="Rule status">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
              All
            </button>
            <button className={filter === 'on' ? 'on' : ''} onClick={() => setFilter('on')}>
              Enabled
            </button>
            <button className={filter === 'off' ? 'on' : ''} onClick={() => setFilter('off')}>
              Paused
            </button>
          </div>
          <span className="ad-tb-ct">
            {shown.length} of {rules.length} rules
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card row-gap">
          <EmptyState icon={<BellIcon />} title="No rules match" description="Try a different word or switch the status filter back to All." />
        </div>
      ) : (
        <div className="ad-rules row-gap">
          {shown.map((r) => {
            const m = META[r.key] ?? { icon: <BellIcon />, tone: 'gray' as Tone };
            const c = TONES[m.tone];
            const channels: { id: 'email' | 'inApp'; label: string }[] = [
              { id: 'email', label: 'Email' },
              { id: 'inApp', label: 'In-app' },
            ];
            const active = channels.filter((ch) => r[ch.id]).length;
            return (
              <div key={r.key} className={`ad-rule ${r.on ? '' : 'off'}`}>
                <div className="ad-rule-h">
                  <span className="ad-ic" style={{ background: c.bg, color: c.fg }}>
                    {m.icon}
                  </span>
                  <div className="ad-rule-t">
                    {r.event}
                    <div className="ad-rule-s">{r.on ? 'Enabled' : 'Paused — no notifications are sent'}</div>
                  </div>
                  <Toggle checked={r.on} onChange={(v) => patch(r.key, { on: v })} />
                </div>
                <div className="ad-rule-r">
                  <span className="lb">Channels</span>
                  {channels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      className={`ad-ch ${r[ch.id] ? 'on' : ''}`}
                      aria-pressed={r[ch.id]}
                      disabled={!r.on || (r[ch.id] && active === 1)}
                      title={r[ch.id] && active === 1 ? 'At least one channel is required' : undefined}
                      onClick={() => patch(r.key, { [ch.id]: !r[ch.id] })}
                    >
                      <span className="sw" />
                      {ch.label}
                    </button>
                  ))}
                </div>
                <div className="ad-rule-r">
                  <span className="lb">Sent to</span>
                  {r.recipients.map((x) => (
                    <span key={x} className="ad-pill">
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
