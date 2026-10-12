'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { ArrowLeftIcon } from '@/components/icons';
import { useActor } from '@/components/hiring/HiringBits';
import { RULE_HELP, RuleMode, RuleKey, setRule, useHiringMail } from '@/lib/hiringMail';

const MODES: { id: RuleMode; label: string }[] = [
  { id: 'ask', label: 'Ask me first (Send / Edit / Skip)' },
  { id: 'auto', label: 'Send automatically' },
  { id: 'off', label: 'No email' },
];

/** Which email goes out at each stage, and how. The pipeline reads these rules every time a candidate moves. */
export default function StageEmailsPage() {
  const mail = useHiringMail();
  const actor = useActor();

  return (
    <div className="hm-page">
      <Link href="/hiring/operations" className="hub-back">
        <ArrowLeftIcon />
        Back to Operations
      </Link>
      <PageHeader eyebrow="Operations" title="Stage emails" description="Pick the email for each stage. When a candidate moves, the recruiter either confirms the email first or it is sent automatically." />
      <Card>
        <CardHeader title="Email for each stage" sub="Changes apply from the next move" />
        <div className="tx-scroll wide">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Email template</th>
                <th>How it is sent</th>
              </tr>
            </thead>
            <tbody>
              {mail.rules.map((r) => {
                const tpl = mail.templates.find((t) => t.id === r.templateId);
                const hasInterview = !!tpl && /\{\{\s*interview\./.test(`${tpl.subject}${tpl.body}`);
                const hasOffer = !!tpl && /\{\{\s*offer\./.test(`${tpl.subject}${tpl.body}`);
                const isInterviewEvent = r.key === 'Interview scheduled' || r.key === 'Interview rescheduled';
                const warn = r.mode !== 'off' && ((hasInterview && !isInterviewEvent) || (hasOffer && !['Offer sent', 'Hired'].includes(r.key)));
                return (
                  <tr key={r.key}>
                    <td>
                      <b>{r.key}</b>
                      <div className="tx-s faint">{RULE_HELP[r.key as RuleKey]}</div>
                    </td>
                    <td>
                      <select
                        value={r.templateId}
                        aria-label={`Template for ${r.key}`}
                        onChange={(e) => setRule(r.key, { templateId: e.target.value, mode: e.target.value ? (r.mode === 'off' ? 'ask' : r.mode) : 'off' }, actor.name)}
                      >
                        <option value="">No email</option>
                        {mail.templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {warn && <div className="tx-s" style={{ color: '#B45309', marginTop: 4 }}>This template needs {hasInterview ? 'interview' : 'offer'} details that do not exist at this moment, so the recruiter will be asked to schedule it first or edit the email.</div>}
                    </td>
                    <td>
                      <select value={r.mode} disabled={!r.templateId} aria-label={`How ${r.key} is sent`} onChange={(e) => setRule(r.key, { mode: e.target.value as RuleMode }, actor.name)}>
                        {MODES.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tfoot">
          <span>
            Rejection emails are best sent after a short pause so a recruiter can change their mind: choose “Ask me first”. To change the wording of an email, open{' '}
            <Link href="/hiring/operations/templates" className="lnk">
              Email templates
            </Link>
            .
          </span>
        </div>
      </Card>
    </div>
  );
}
