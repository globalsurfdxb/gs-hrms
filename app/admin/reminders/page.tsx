'use client';

import { useState } from 'react';
import { setScheduleOn, useReminderSchedules } from '@/lib/reminderRules';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { StatStrip, TONES, Tone } from '@/components/ui/StatStrip';
import { Toggle } from '@/components/ui/Toggle';
import { BellIcon, CheckIcon, ClockIcon, FileTextIcon, IdIcon, ShieldIcon, WarnIcon } from '@/components/icons';

const META: Record<string, { icon: React.ReactNode; tone: Tone }> = {
  visa: { icon: <IdIcon />, tone: 'blue' },
  passport: { icon: <FileTextIcon />, tone: 'purple' },
  labour: { icon: <ShieldIcon />, tone: 'green' },
  licence: { icon: <FileTextIcon />, tone: 'amber' },
  contract: { icon: <FileTextIcon />, tone: 'teal' },
  general: { icon: <FileTextIcon />, tone: 'gray' },
};

type Filter = 'all' | 'on' | 'off';

export default function AdminRemindersPage() {
  // Shared with the Expiry, Visa and Documents pages, which apply these schedules to each document type.
  const schedules = useReminderSchedules();
  const [filter, setFilter] = useState<Filter>('all');

  const active = schedules.filter((s) => s.on);
  const notices = active.reduce((n, s) => n + s.rungs.length, 0);
  const earliest = active.length ? Math.max(...active.flatMap((s) => s.rungs)) : 0;
  const shown = schedules.filter((s) => filter === 'all' || (filter === 'on' ? s.on : !s.on));

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Reminders" description="System-wide reminder schedules — how many days before expiry each document type sends a notice." />

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Schedules', value: schedules.length, icon: <BellIcon />, tone: 'blue' },
            { label: 'Active', value: active.length, icon: <CheckIcon />, tone: 'green' },
            { label: 'Notices per document', value: notices, icon: <WarnIcon />, tone: 'amber', hint: 'Across active schedules' },
            { label: 'Earliest notice', value: earliest ? `${earliest}d` : '—', icon: <ClockIcon />, tone: 'purple', hint: 'Before expiry' },
          ]}
        />
      </div>

      <div className="subseg" role="group" aria-label="Schedule status">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
          All ({schedules.length})
        </button>
        <button className={filter === 'on' ? 'on' : ''} onClick={() => setFilter('on')}>
          Active ({active.length})
        </button>
        <button className={filter === 'off' ? 'on' : ''} onClick={() => setFilter('off')}>
          Disabled ({schedules.length - active.length})
        </button>
      </div>

      {shown.length === 0 && (
        <Card>
          <EmptyState icon={<BellIcon />} title="No schedules here" description="Nothing matches this filter. Switch back to All to see every reminder schedule." />
        </Card>
      )}

      {shown.map((s) => {
        const m = META[s.key] ?? { icon: <BellIcon />, tone: 'gray' as Tone };
        const c = TONES[m.tone];
        const rungs = [...s.rungs].sort((a, b) => b - a);
        return (
          <Card key={s.key} className="row-gap">
            <div className="card-head">
              <div className={`ad-card-ic ${s.on ? '' : 'off'}`}>
                <span className="ad-ic" style={{ background: c.bg, color: c.fg }}>
                  {m.icon}
                </span>
                <div>
                  <h3>{s.title}</h3>
                  <div className="sub">{s.on ? `${s.rungs.length} notices · first at ${rungs[0]} days before expiry` : 'Disabled — no reminders are sent'}</div>
                  <div className="sub">{s.types.length ? `Applies to: ${s.types.join(', ')}` : 'Applies to: any other dated document (medical insurance, driving licence and so on)'}</div>
                </div>
              </div>
              <Toggle checked={s.on} onChange={(v) => setScheduleOn(s.key, v)} />
            </div>
            {s.on ? (
              <div className="ad-tl">
                {rungs.map((r, i) => (
                  <div key={r} className="ad-tl-s">
                    <div className="ad-tl-d">{r}d</div>
                    <div className="ad-tl-l">{r} days before</div>
                    <div className="ad-tl-m">Notice {i + 1}</div>
                  </div>
                ))}
                <div className="ad-tl-s end">
                  <div className="ad-tl-d">
                    <ClockIcon />
                  </div>
                  <div className="ad-tl-l">Expiry</div>
                  <div className="ad-tl-m">Document lapses</div>
                </div>
              </div>
            ) : (
              <div className="ad-off">Turn this schedule on to send notices at {rungs.map((r) => `${r}d`).join(', ')} before expiry.</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
