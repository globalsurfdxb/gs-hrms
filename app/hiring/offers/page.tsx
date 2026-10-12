'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { CheckIcon, ClockIcon, FileTextIcon, JoinIcon, PlusIcon, WarnIcon } from '@/components/icons';
import { Banner, HiringHeader, OfferBadge, fmtDate, money, payUnit, useActor } from '@/components/hiring/HiringBits';
import { OfferDrawer } from '@/components/hiring/HiringForms';
import { useStageMail } from '@/components/hiring/Mail';
import { useScoped } from '@/components/hiring/useScoped';
import { daysBetween, todayISO } from '@/lib/dates';
import { Application } from '@/lib/hiringTypes';
import { appById, candById, jobById, offerForApp, setOfferStatus } from '@/lib/hiringStore';

export default function OffersPage() {
  const { s, level, offers, applications } = useScoped();
  const actor = useActor();
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  const [picker, setPicker] = useState(false);
  const [offerFor, setOfferFor] = useState<Application | null>(null);
  const today = todayISO();
  const mailer = useStageMail((text, tone = 'info') => setNotice({ text, tone }));

  const ready = applications.filter((a) => a.stage === 'Offer' && !a.exit && !offerForApp(s, a.id));
  const rows = [...offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const waitingOnboarding = offers.filter((o) => o.status === 'Accepted' && !o.employeeId);
  const out = offers.filter((o) => o.status === 'Sent');
  const canManage = level === 'full';

  const set = (id: string, st: 'Sent' | 'Accepted' | 'Declined', text: string) => {
    const r = setOfferStatus(id, st, actor);
    if (!r.ok) return setNotice({ text: r.error, tone: 'warn' });
    const offer = s.offers.find((o) => o.id === id);
    // Marking an offer as sent offers the offer-letter email.
    if (st === 'Sent' && offer) mailer.after(offer.applicationId, 'Offer sent', { offer: { ...offer, status: 'Sent' } }, text);
    else setNotice({ text, tone: 'info' });
  };

  return (
    <div className="hm-page">
      <HiringHeader
        title="Offers"
        description="Salary offers for candidates at the Offer stage. An accepted offer can start onboarding with the candidate's details already filled in."
        actions={
          <>
            {canManage && (
              <Button variant="primary" onClick={() => setPicker(true)}>
                <PlusIcon /> New offer
              </Button>
            )}
          </>
        }
      />
      {notice && <Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Banner>}

      <StatStrip
        items={[
          { label: 'Offers', value: offers.length, icon: <FileTextIcon />, tone: 'blue', hint: 'In this location' },
          { label: 'Awaiting reply', value: out.length, icon: <ClockIcon />, tone: 'amber', hint: 'Sent to candidates' },
          { label: 'Accepted', value: offers.filter((o) => o.status === 'Accepted').length, icon: <CheckIcon />, tone: 'green', hint: `${waitingOnboarding.length} ready for onboarding` },
          { label: 'Waiting for an offer', value: ready.length, icon: <JoinIcon />, tone: 'purple', hint: 'At the Offer stage' },
        ]}
      />

      <Card>
        <CardHeader title="All offers" sub={`${rows.length} offer${rows.length === 1 ? '' : 's'}`} />
        {!rows.length ? (
          <EmptyState icon={<FileTextIcon />} title="No offers yet" description="Move a candidate to the Offer stage, then create their offer." />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Package</th>
                  <th>Joining</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const a = appById(s, o.applicationId);
                  const c = a && candById(s, a.candidateId);
                  const j = a && jobById(s, a.jobId);
                  const left = daysBetween(today, o.expiryDate);
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/hiring/candidates/${c?.id}`} className="hm-link">
                          <div style={{ fontWeight: 600 }}>{c?.name}</div>
                          <div className="tx-s faint">
                            {o.code} · {j?.title}
                          </div>
                        </Link>
                      </td>
                      <td className="mono">
                        {money(o.total, o.currency)}
                        <div className="tx-s faint">{payUnit(o.currency)}</div>
                        {o.overBudget && <div className="tx-s" style={{ color: '#B45309' }}>Above budget</div>}
                      </td>
                      <td className="mono">
                        {fmtDate(o.joiningDate)}
                        <div className="tx-s faint">{o.probationMonths ? `${o.probationMonths}-month probation` : 'No probation'}</div>
                      </td>
                      <td className="mono">
                        {fmtDate(o.expiryDate)}
                        {o.status === 'Sent' && left <= 3 && (
                          <div className="tx-s" style={{ color: left < 0 ? '#B91C1C' : '#B45309' }}>
                            {left < 0 ? 'Past expiry' : left === 0 ? 'Expires today' : `${left} day${left === 1 ? '' : 's'} left`}
                          </div>
                        )}
                      </td>
                      <td>
                        <OfferBadge status={o.status} />
                        {o.employeeId && <div className="tx-s faint">Onboarded as {o.employeeId}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="hm-rowact">
                          {canManage && o.status === 'Draft' && (
                            <Button size="sm" variant="primary" onClick={() => set(o.id, 'Sent', `${o.code} marked as sent to ${c?.name}.`)}>
                              Mark sent
                            </Button>
                          )}
                          {canManage && o.status === 'Sent' && (
                            <>
                              <Button size="sm" variant="success" onClick={() => set(o.id, 'Accepted', `${c?.name} accepted ${o.code}. You can start onboarding now.`)}>
                                Accepted
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => set(o.id, 'Declined', `${c?.name} declined ${o.code}. The candidate was withdrawn from the pipeline.`)}>
                                Declined
                              </Button>
                            </>
                          )}
                          {canManage && o.status === 'Accepted' && !o.employeeId && (
                            <Link href={`/onboarding?hire=${o.id}`} className="btn sm primary">
                              Start onboarding
                            </Link>
                          )}
                          {o.employeeId && (
                            <Link href={`/directory/${o.employeeId}`} className="btn sm ghost">
                              Employee record
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="tfoot">
          <span>Approval of offers, the offer-letter PDF and email delivery arrive in the next phases; today an offer moves Draft → Sent → Accepted or Declined.</span>
        </div>
      </Card>

      {mailer.dialog}
      <Drawer open={picker} onClose={() => setPicker(false)} title="New offer" description="Choose a candidate who is at the Offer stage.">
        {!ready.length ? (
          <div className="note-box">
            <WarnIcon />
            <div>No candidate is waiting for an offer. Move a candidate to the Offer stage on a job&apos;s pipeline first.</div>
          </div>
        ) : (
          <div className="hm-pick">
            {ready.map((a) => (
              <button
                key={a.id}
                type="button"
                className="hm-pick-row"
                onClick={() => {
                  setPicker(false);
                  setOfferFor(a);
                }}
              >
                <span>
                  <b>{candById(s, a.candidateId)?.name}</b>
                  <small>{jobById(s, a.jobId)?.title}</small>
                </span>
                <span className="lnk">Create →</span>
              </button>
            ))}
          </div>
        )}
      </Drawer>
      <OfferDrawer
        application={offerFor}
        onClose={() => setOfferFor(null)}
        onDone={() => {
          setOfferFor(null);
          setNotice({ text: 'Offer saved as a draft. Mark it sent when it goes to the candidate.', tone: 'info' });
        }}
      />
    </div>
  );
}
