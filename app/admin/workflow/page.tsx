'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatStrip, TONES, Tone } from '@/components/ui/StatStrip';
import { Toggle } from '@/components/ui/Toggle';
import { WORKFLOW_CHAINS } from '@/lib/workflow';
import { ArrowRightIcon, CheckIcon, ExitIcon, FlowIcon, InboxIcon, JoinIcon, ReceiptIcon, ShieldIcon, TreeIcon } from '@/components/icons';

/* The steps live in lib/workflow.ts (shared with the onboarding wizard); this page only adds the icon and colour. */
const CHAIN_STYLE: Record<string, { icon: React.ReactNode; tone: Tone }> = {
  onboarding: { icon: <JoinIcon />, tone: 'green' },
  offboarding: { icon: <ExitIcon />, tone: 'purple' },
  requests: { icon: <InboxIcon />, tone: 'blue' },
};

const CHAINS: { key: string; title: string; steps: string[]; icon: React.ReactNode; tone: Tone }[] = WORKFLOW_CHAINS.map((c) => ({ ...c, ...(CHAIN_STYLE[c.key] ?? { icon: <FlowIcon />, tone: 'blue' as Tone }) }));

const SETTINGS: { key: string; label: string; on: boolean; icon: React.ReactNode; tone: Tone }[] = [
  { key: 'exp-limit', label: 'Require second approval when an expense claim exceeds its category policy limit', on: true, icon: <ReceiptIcon />, tone: 'amber' },
  { key: 'onb-payroll', label: 'Auto-notify Payroll when onboarding is approved', on: true, icon: <JoinIcon />, tone: 'green' },
  { key: 'off-clearance', label: 'Block final offboarding approval until all clearance items are checked', on: true, icon: <ShieldIcon />, tone: 'purple' },
  { key: 'req-manager', label: 'Route address/bank-detail change requests to Manager instead of HR', on: false, icon: <InboxIcon />, tone: 'blue' },
];

export default function AdminWorkflowPage() {
  const [settings, setSettings] = useState(SETTINGS);

  const totalSteps = CHAINS.reduce((n, c) => n + c.steps.length, 0);
  const on = settings.filter((s) => s.on).length;

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Workflow Settings" description="Approval chains for the core employee lifecycle workflows, and the rules that govern them." />

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Approval chains', value: CHAINS.length, icon: <FlowIcon />, tone: 'blue' },
            { label: 'Approval steps', value: totalSteps, icon: <TreeIcon />, tone: 'purple', hint: 'Across all chains' },
            { label: 'Rules enabled', value: on, icon: <CheckIcon />, tone: 'green' },
            { label: 'Rules off', value: settings.length - on, icon: <ShieldIcon />, tone: settings.length - on ? 'amber' : 'gray' },
          ]}
        />
      </div>

      {CHAINS.map((c) => {
        const col = TONES[c.tone];
        return (
          <Card key={c.key} className="row-gap">
            <div className="card-head">
              <div className="ad-card-ic">
                <span className="ad-ic" style={{ background: col.bg, color: col.fg }}>
                  {c.icon}
                </span>
                <div>
                  <h3>{c.title}</h3>
                  <div className="sub">{c.steps.length} steps, in order</div>
                </div>
              </div>
            </div>
            <div className="ad-flow">
              {c.steps.map((s, i) => {
                const last = i === c.steps.length - 1;
                return (
                  <div key={s} className="ad-fs">
                    <div className={`ad-fn ${i === 0 ? 'start' : last ? 'end' : ''}`}>
                      <span className="no">{last ? <CheckIcon style={{ width: 13, height: 13 }} /> : i + 1}</span>
                      <div className="tx">
                        <span className="tg">{i === 0 ? 'Start' : last ? 'Final' : `Step ${i + 1}`}</span>
                        {s}
                      </div>
                    </div>
                    {!last && (
                      <span className="ad-fa">
                        <ArrowRightIcon />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Card className="row-gap">
        <CardHeader title="Workflow rules" sub={`${on} of ${settings.length} enabled · toggle behaviour for these workflows`} />
        {settings.map((s) => {
          const col = TONES[s.tone];
          return (
            <div key={s.key} className="ad-wrow">
              <span className="ad-ic" style={{ background: col.bg, color: col.fg, opacity: s.on ? 1 : 0.55 }}>
                {s.icon}
              </span>
              <div className="tx">
                {s.label}
                <div className="st">{s.on ? 'Enabled' : 'Off'}</div>
              </div>
              <Toggle checked={s.on} onChange={(v) => setSettings((prev) => prev.map((x) => (x.key === s.key ? { ...x, on: v } : x)))} />
            </div>
          );
        })}
      </Card>
    </div>
  );
}
