'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ArrowLeftIcon, CheckIcon, WarnIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Banner, Fg, TEXTAREA_STYLE, fmtDateTime, useActor } from '@/components/hiring/HiringBits';
import { EMAIL_RE } from '@/lib/options';
import { connectOutlook, connectTeams, disconnectOutlook, disconnectTeams, saveSettings, useHiringMail } from '@/lib/hiringMail';

/** Outlook and Teams connections, and who the emails come from. The connections are recorded here but are not live
    until the server side (Microsoft sign-in and Graph) exists; the page says so. */
export default function IntegrationsPage() {
  const mail = useHiringMail();
  const actor = useActor();
  const s = mail.settings;
  const [connecting, setConnecting] = useState(false);
  const [leaving, setLeaving] = useState<'outlook' | 'teams' | null>(null);
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState({ fromName: s.fromName, fromAddress: s.fromAddress, signature: s.signature });
  const [fromError, setFromError] = useState('');

  return (
    <div className="hm-page">
      <Link href="/hiring/operations" className="hub-back">
        <ArrowLeftIcon />
        Back to Operations
      </Link>
      <PageHeader eyebrow="Operations" title="Outlook and Teams" description="Connect the recruiting mailbox so candidate emails come from Outlook, and Teams so interview meetings can be created from the schedule screen." />
      {notice && <Banner onClose={() => setNotice('')}>{notice}</Banner>}
      <div className="hm-sandbox" role="note">
        <b>Sandbox connection.</b> Signing in with Microsoft needs the server side, which is not built yet. You can set the connections up here now; they are saved, and emails are still only written to the Sent mail log until the live connection is switched on.
      </div>

      <div className="hm-grid">
        <Card>
          <CardHeader title="Microsoft Outlook (email)" sub="Candidate emails are sent from a shared recruiting mailbox" action={<Badge tone={s.outlook.connected ? 'active' : 'inactive'}>{s.outlook.connected ? 'Connected' : 'Not connected'}</Badge>} />
          <div className="hm-int">
            {s.outlook.connected ? (
              <>
                <div className="tx-read">
                  <div className="l">Mailbox</div>
                  <div className="v">{s.outlook.mailbox}</div>
                </div>
                <div className="tx-read">
                  <div className="l">Microsoft 365 tenant</div>
                  <div className="v">{s.outlook.tenant || '—'}</div>
                </div>
                <div className="tx-read">
                  <div className="l">Connected</div>
                  <div className="v">
                    {s.outlook.connectedAt ? fmtDateTime(s.outlook.connectedAt) : '—'} by {s.outlook.by}
                  </div>
                </div>
                <div className="hm-int-act">
                  <Button onClick={() => setConnecting(true)}>Change mailbox</Button>
                  <Button variant="ghost" onClick={() => setLeaving('outlook')}>
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>Connect with Outlook so interview invitations, offers and reminders are sent from your recruiting mailbox (for example careers@globalsurf.ae) instead of the system address.</p>
                <Button variant="primary" onClick={() => setConnecting(true)}>
                  Connect Outlook
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Microsoft Teams (interviews)" sub="Create Teams meeting links when scheduling" action={<Badge tone={s.teams.connected ? 'active' : 'inactive'}>{s.teams.connected ? 'Connected' : 'Not connected'}</Badge>} />
          <div className="hm-int">
            {!s.outlook.connected ? (
              <div className="note-box">
                <WarnIcon />
                <div>Connect Outlook first. Teams meetings are created through the same Microsoft 365 sign-in.</div>
              </div>
            ) : s.teams.connected ? (
              <>
                <label className="hm-check">
                  <input
                    type="checkbox"
                    checked={s.teams.createLinks}
                    onChange={(e) => {
                      saveSettings({ teams: { ...s.teams, createLinks: e.target.checked } }, actor.name, 'Teams meeting links');
                    }}
                  />
                  Offer “Create Teams meeting” when an interview is scheduled
                </label>
                <div className="tx-read">
                  <div className="l">Connected</div>
                  <div className="v">
                    {s.teams.connectedAt ? fmtDateTime(s.teams.connectedAt) : '—'} by {s.teams.by}
                  </div>
                </div>
                <div className="hm-int-act">
                  <Button variant="ghost" onClick={() => setLeaving('teams')}>
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>Add a one-click “Create Teams meeting” on the interview form. Until the live connection exists the link it creates is a sandbox placeholder, clearly marked, and does not open a real meeting.</p>
                <Button
                  variant="primary"
                  onClick={() => {
                    connectTeams(true, actor.name);
                    setNotice('Teams connected (sandbox).');
                  }}
                >
                  Connect Teams
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="row-gap">
        <CardHeader title="Who emails come from" sub="Shown to candidates" />
        <div className="form-grid hm-form" style={{ padding: '4px 20px 20px' }}>
          <Fg label="Sender name" required>
            <input value={from.fromName} onChange={(e) => setFrom({ ...from, fromName: e.target.value })} />
          </Fg>
          <Fg label="Sender address" required error={fromError} hint={s.outlook.connected ? 'While Outlook is connected the mailbox above is used.' : undefined}>
            <input type="email" value={from.fromAddress} onChange={(e) => setFrom({ ...from, fromAddress: e.target.value })} />
          </Fg>
          <Fg label="Email signature" hint="Added to the end of every email." full>
            <textarea rows={4} value={from.signature} onChange={(e) => setFrom({ ...from, signature: e.target.value })} style={TEXTAREA_STYLE} />
          </Fg>
          <div className="fg full">
            <Button
              variant="primary"
              onClick={() => {
                if (!from.fromName.trim() || !EMAIL_RE.test(from.fromAddress.trim())) return setFromError('Enter a valid sender address.');
                setFromError('');
                saveSettings({ fromName: from.fromName.trim(), fromAddress: from.fromAddress.trim(), signature: from.signature }, actor.name, 'Email sender settings');
                setNotice('Sender settings saved.');
              }}
            >
              <CheckIcon /> Save sender settings
            </Button>
          </div>
        </div>
      </Card>

      <ConnectOutlook
        open={connecting}
        initial={{ tenant: s.outlook.tenant, mailbox: s.outlook.mailbox }}
        onClose={() => setConnecting(false)}
        onConnect={(tenant, mailbox) => {
          connectOutlook(tenant, mailbox, actor.name);
          setConnecting(false);
          setNotice(`Outlook connected (sandbox) for ${mailbox}.`);
        }}
      />
      <ConfirmDialog
        open={!!leaving}
        danger
        title={leaving === 'outlook' ? 'Disconnect Outlook?' : 'Disconnect Teams?'}
        message={leaving === 'outlook' ? 'Emails will use the system sender address again. Teams is disconnected too, because it depends on this sign-in.' : 'The “Create Teams meeting” option is removed from the interview form. Links already added stay on their interviews.'}
        confirmLabel="Disconnect"
        onCancel={() => setLeaving(null)}
        onConfirm={() => {
          if (leaving === 'outlook') disconnectOutlook(actor.name);
          else disconnectTeams(actor.name);
          setNotice(leaving === 'outlook' ? 'Outlook and Teams disconnected.' : 'Teams disconnected.');
          setLeaving(null);
        }}
      />
    </div>
  );
}

function ConnectOutlook({ open, initial, onClose, onConnect }: { open: boolean; initial: { tenant: string; mailbox: string }; onClose: () => void; onConnect: (tenant: string, mailbox: string) => void }) {
  if (!open) return null;
  return <ConnectForm initial={initial} onClose={onClose} onConnect={onConnect} />;
}

function ConnectForm({ initial, onClose, onConnect }: { initial: { tenant: string; mailbox: string }; onClose: () => void; onConnect: (tenant: string, mailbox: string) => void }) {
  const [tenant, setTenant] = useState(initial.tenant);
  const [mailbox, setMailbox] = useState(initial.mailbox);
  const [attempted, setAttempted] = useState(false);
  const errors: Record<string, string> = {};
  if (!tenant.trim()) errors.tenant = 'Enter your Microsoft 365 domain, for example globalsurf.ae.';
  if (!EMAIL_RE.test(mailbox.trim())) errors.mailbox = 'Enter the recruiting mailbox address.';
  const shown = (k: string) => (attempted ? errors[k] : undefined);
  return (
    <Drawer
      open
      onClose={onClose}
      title="Connect Outlook"
      description="Sign in with Microsoft to let the hiring module send from the recruiting mailbox."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setAttempted(true);
              if (Object.keys(errors).length) return;
              onConnect(tenant, mailbox);
            }}
          >
            Connect
          </Button>
        </>
      }
    >
      <div className="note-box hm-warn" style={{ marginBottom: 14 }}>
        <WarnIcon />
        <div>Sandbox: no Microsoft sign-in window opens yet. Your entries are saved so the rest of the module behaves as if connected.</div>
      </div>
      <div className="form-grid hm-form">
        <Fg label="Microsoft 365 domain" required error={shown('tenant')} full>
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="globalsurf.ae" />
        </Fg>
        <Fg label="Recruiting mailbox" required error={shown('mailbox')} hint="A shared mailbox such as careers@globalsurf.ae." full>
          <input type="email" value={mailbox} onChange={(e) => setMailbox(e.target.value)} />
        </Fg>
      </div>
    </Drawer>
  );
}
