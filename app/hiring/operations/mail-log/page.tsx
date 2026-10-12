'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeftIcon, HistoryIcon, SearchIcon } from '@/components/icons';
import { fmtDateTime } from '@/components/hiring/HiringBits';
import { MailMessage, useHiringMail } from '@/lib/hiringMail';
import { candById, useHiring } from '@/lib/hiringStore';

/** Every email the module has "sent". In sandbox mode this is the only place they exist. */
export default function MailLogPage() {
  const mail = useHiringMail();
  const s = useHiring();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<MailMessage | null>(null);
  const needle = q.trim().toLowerCase();
  const rows = mail.messages.filter((m) => !needle || `${m.subject} ${m.to} ${m.trigger} ${m.templateName ?? ''}`.toLowerCase().includes(needle));

  return (
    <div className="hm-page">
      <Link href="/hiring/operations" className="hub-back">
        <ArrowLeftIcon />
        Back to Operations
      </Link>
      <PageHeader eyebrow="Operations" title="Sent mail log" description="Every email sent from Hiring Management: who it went to, why, and who triggered it." />
      <div className="hm-sandbox" role="note">
        <b>Email sandbox.</b> These messages were not delivered. They are kept here so you can check the wording and the triggers.
      </div>
      <Card>
        <CardHeader title="Messages" sub={`${rows.length} of ${mail.messages.length}`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, recipient or trigger…" />
          </div>
        </div>
        {!rows.length ? (
          <EmptyState icon={<HistoryIcon />} title={mail.messages.length ? 'No messages match' : 'Nothing sent yet'} description={mail.messages.length ? 'Try a different search.' : 'Move a candidate to a stage with a stage email, or write one from a candidate profile.'} />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>To</th>
                  <th>Trigger</th>
                  <th>Sent by</th>
                  <th>When</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <button type="button" className="hm-linkbtn" onClick={() => setOpen(m)}>
                        <b>{m.subject}</b>
                        <span className="tx-s faint">{m.templateName ?? 'Written by hand'}</span>
                      </button>
                    </td>
                    <td>
                      {candById(s, m.candidateId) ? (
                        <Link href={`/hiring/candidates/${m.candidateId}`} className="lnk">
                          {candById(s, m.candidateId)?.name}
                        </Link>
                      ) : (
                        m.to
                      )}
                      <div className="tx-s faint">{m.to}</div>
                    </td>
                    <td>{m.trigger}</td>
                    <td>{m.by}</td>
                    <td className="mono">{fmtDateTime(m.at)}</td>
                    <td>
                      <Badge tone={m.status === 'Sent' ? 'info' : 'expired'}>{m.status === 'Sent' ? 'Logged' : 'Failed'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.subject ?? ''} description={open ? `${open.trigger} · ${fmtDateTime(open.at)}` : undefined}>
        {open && (
          <div className="hm-mail-prev" style={{ margin: 0 }}>
            <div className="hm-mail-row">
              <span>From</span>
              {open.from}
            </div>
            <div className="hm-mail-row">
              <span>To</span>
              {open.to}
              {open.cc ? ` · cc ${open.cc}` : ''}
            </div>
            <div className="hm-mail-row">
              <span>Via</span>
              {open.provider}
            </div>
            <pre>{open.body}</pre>
          </div>
        )}
      </Drawer>
    </div>
  );
}
