'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ChevronRightIcon, FileTextIcon, FlowIcon, GridIcon, HistoryIcon } from '@/components/icons';
import { useHiringMail } from '@/lib/hiringMail';
import { useLetterState } from '@/lib/hiringLetters';

/** Operations: the settings behind candidate email and the Microsoft connections. HR and administrators only. */
export default function HiringOperationsPage() {
  const mail = useHiringMail();
  const letters = useLetterState();
  const active = mail.rules.filter((r) => r.mode !== 'off' && r.templateId);
  const s = mail.settings;
  const tiles = [
    { href: '/hiring/operations/templates', icon: <FileTextIcon />, tone: 'blue', title: 'Email templates', desc: 'See, edit and add the emails sent to candidates: subject, message, merge fields and attachments.', status: `${mail.templates.length} templates`, cta: 'See all templates' },
    { href: '/hiring/operations/offer-letter', icon: <FileTextIcon />, tone: 'green', title: 'Offer letter', desc: 'Upload the offer letter template. Each offer is merged with the candidate’s details and shared by link for the candidate to read, download and answer.', status: Object.keys(letters.slots).length ? `${Object.keys(letters.slots).length} custom template${Object.keys(letters.slots).length === 1 ? '' : 's'}` : 'Built-in letter in use', cta: 'Manage the letter' },
    { href: '/hiring/operations/stage-emails', icon: <FlowIcon />, tone: 'purple', title: 'Stage emails', desc: 'Choose which email goes out at each stage, and whether it is sent automatically or you confirm it first.', status: `${active.length} of ${mail.rules.length} moments send an email`, cta: 'Set up stage emails' },
    { href: '/hiring/operations/integrations', icon: <GridIcon />, tone: 'teal', title: 'Outlook and Teams', desc: 'Connect the recruiting mailbox in Outlook and Microsoft Teams for interview meetings.', status: s.outlook.connected ? `Outlook connected${s.teams.connected ? ' · Teams connected' : ''}` : 'Not connected', cta: 'Manage connections' },
    { href: '/hiring/operations/mail-log', icon: <HistoryIcon />, tone: 'amber', title: 'Sent mail log', desc: 'Every email the module has sent, who sent it and when.', status: `${mail.messages.length} message${mail.messages.length === 1 ? '' : 's'}`, cta: 'Open the log' },
  ];
  return (
    <div className="hm-page">
      <PageHeader eyebrow="Hiring Management" title="Operations" description="Set up how the hiring team emails candidates and connects to Outlook and Teams." />
      <div className="hm-sandbox" role="note">
        <b>Email sandbox.</b> No mail server is connected yet, so emails are saved in the log and nothing is delivered to candidates.
      </div>
      <div className="hm-ops">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="hm-ops-card">
            <Card>
              <div className="hm-ops-in">
                <span className={`hm-ops-ic ${t.tone}`}>{t.icon}</span>
                <div>
                  <b>{t.title}</b>
                  <p>{t.desc}</p>
                  <span className="hm-ops-st">{t.status}</span>
                </div>
                <span className="hm-ops-go">
                  {t.cta} <ChevronRightIcon />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
