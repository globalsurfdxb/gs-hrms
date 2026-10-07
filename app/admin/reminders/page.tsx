'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';


const SCHEDULES = [
  { key: 'visa', title: 'Residence Visa / Emirates ID', rungs: [90, 60, 30, 7], on: true },
  { key: 'passport', title: 'Passport', rungs: [90, 30], on: true },
  { key: 'labour', title: 'Labour Card', rungs: [60, 30, 7], on: true },
  { key: 'licence', title: 'Trade Licence', rungs: [90, 60, 30], on: true },
  { key: 'contract', title: 'Employment Contract Renewal', rungs: [60, 30], on: false },
];

export default function AdminRemindersPage() {
  const [schedules, setSchedules] = useState(SCHEDULES);

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Reminders" description="System-wide reminder schedules — how many days before expiry each document type sends a notice." />
      {schedules.map((s) => (
        <Card key={s.key} className="row-gap">
          <CardHeader
            title={s.title}
            sub={s.on ? `Notices at ${s.rungs.map((r) => `${r}d`).join(' · ')} before expiry` : 'Disabled'}
            action={<Toggle checked={s.on} onChange={(v) => setSchedules((prev) => prev.map((x) => (x.key === s.key ? { ...x, on: v } : x)))} />}
          />
          {s.on && (
            <div className="ladder" style={{ padding: '18px 22px', opacity: s.on ? 1 : 0.4 }}>
              {s.rungs.map((r, i) => (
                <div key={r} className={`ladder-step ${i < s.rungs.length - 1 ? 'sent' : 'now'}`}>
                  <div className="cap">{r}d</div>
                  <div className="lt">{r} days notice</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
