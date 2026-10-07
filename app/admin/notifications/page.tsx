'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';


const RULES = [
  { key: 'visa', event: 'Visa / Emirates ID expiring', channel: 'Email + In-app', recipients: 'Employee, HR', on: true },
  { key: 'onboarding', event: 'New onboarding request', channel: 'Email', recipients: 'HR', on: true },
  { key: 'offboarding', event: 'Separation case started', channel: 'Email', recipients: 'HR, Manager', on: true },
  { key: 'request-stale', event: 'Request pending over 48 hours', channel: 'Email', recipients: 'Manager', on: true },
  { key: 'document', event: 'Document expiring', channel: 'In-app', recipients: 'Employee', on: true },
  { key: 'expense', event: 'Expense claim submitted', channel: 'Email', recipients: 'Approver', on: true },
  { key: 'expense-over', event: 'Expense claim exceeds policy limit', channel: 'Email + In-app', recipients: 'HR, Approver', on: false },
];

export default function AdminNotificationsPage() {
  const [rules, setRules] = useState(RULES);

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Notification Rules" description="Which events trigger a notification, over which channel, and who receives it." />
      <Card>
        <CardHeader title="Rules" sub={`${rules.length} configured`} />
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Channel</th>
              <th>Recipients</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.key}>
                <td style={{ fontWeight: 600 }}>{r.event}</td>
                <td>{r.channel}</td>
                <td>{r.recipients}</td>
                <td>
                  <Toggle checked={r.on} onChange={(v) => setRules((prev) => prev.map((x) => (x.key === r.key ? { ...x, on: v } : x)))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
