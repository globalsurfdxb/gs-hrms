'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { ArrowRightIcon } from '@/components/icons';

const CHAINS = [
  { key: 'onboarding', title: 'Onboarding', steps: ['HR initiates', 'Manager review', 'HR approval', 'Payroll notified'] },
  { key: 'offboarding', title: 'Offboarding', steps: ['Resignation logged', 'Manager clearance', 'IT clearance', 'Finance clearance', 'HR final approval'] },
  { key: 'requests', title: 'Employee Requests', steps: ['Employee raises', 'Routed to HR / Manager', 'Approved or rejected'] },
];

const SETTINGS = [
  { key: 'exp-limit', label: 'Require second approval when an expense claim exceeds its category policy limit', on: true },
  { key: 'onb-payroll', label: 'Auto-notify Payroll when onboarding is approved', on: true },
  { key: 'off-clearance', label: 'Block final offboarding approval until all clearance items are checked', on: true },
  { key: 'req-manager', label: 'Route address/bank-detail change requests to Manager instead of HR', on: false },
];

export default function AdminWorkflowPage() {
  const [settings, setSettings] = useState(SETTINGS);

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Workflow Settings" description="Approval chains for the core employee lifecycle workflows, and the rules that govern them." />

      {CHAINS.map((c) => (
        <Card key={c.key} className="row-gap">
          <CardHeader title={c.title} />
          <div className="aflow" style={{ padding: '16px 18px' }}>
            {c.steps.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className={`node ${i === 0 ? 'done' : ''}`}>
                  <div className="role">{s}</div>
                </div>
                {i < c.steps.length - 1 && (
                  <span className="arrow">
                    <ArrowRightIcon />
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="row-gap">
        <CardHeader title="Workflow rules" sub="Toggle behaviour for these workflows" />
        {settings.map((s) => (
          <div key={s.key} className="field" style={{ padding: '13px 18px' }}>
            <span className="k" style={{ maxWidth: '80%' }}>
              {s.label}
            </span>
            <Toggle checked={s.on} onChange={(v) => setSettings((prev) => prev.map((x) => (x.key === s.key ? { ...x, on: v } : x)))} />
          </div>
        ))}
      </Card>
    </div>
  );
}
