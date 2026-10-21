'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Card';
import { WarnIcon } from '@/components/icons';
import { LetterFrame } from '@/components/hiring/LetterFrame';
import { OfferBadge, fmtDateTime, useActor } from '@/components/hiring/HiringBits';
import { appById, candById, jobById, revokeOfferLink, saveOfferLetter, sendOffer, useHiring } from '@/lib/hiringStore';
import { Offer } from '@/lib/hiringTypes';
import { buildLetter, companyOfOffer, downloadLetterPdf, useLetterState } from '@/lib/hiringLetters';

export const offerLink = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/offer/respond/${token}`;

/** The offer letter for one offer: prepare it from the template, send the link, and follow what the candidate does. */
export function OfferLetterDrawer({ offerId, onClose, onSent, onNotice }: { offerId: string | null; onClose: () => void; onSent: (offer: Offer) => void; onNotice: (text: string, tone?: 'info' | 'warn') => void }) {
  const s = useHiring();
  const offer = offerId ? s.offers.find((o) => o.id === offerId) : undefined;
  const a = offer && appById(s, offer.applicationId);
  const c = a && candById(s, a.candidateId);
  const j = a && jobById(s, a.jobId);
  return (
    <Drawer open={!!offer} onClose={onClose} title={offer ? `Offer letter · ${offer.code}` : 'Offer letter'} description={offer ? `${c?.name ?? 'Candidate'} · ${j?.title ?? ''}` : undefined}>
      {offer && <Body key={offer.id} offer={offer} onClose={onClose} onSent={onSent} onNotice={onNotice} />}
    </Drawer>
  );
}

function Body({ offer, onClose, onSent, onNotice }: { offer: Offer; onClose: () => void; onSent: (offer: Offer) => void; onNotice: (text: string, tone?: 'info' | 'warn') => void }) {
  const s = useHiring();
  const ls = useLetterState();
  const actor = useActor();
  const answered = offer.status === 'Accepted' || offer.status === 'Declined';
  // An offer marked Sent before letters existed has no letter yet, so it can still be prepared and given a link.
  const locked = answered || (offer.status === 'Sent' && !!offer.letterHtml);
  const built = useMemo(() => buildLetter(s, offer.id, actor.name, ls), [s, ls, offer.id, actor.name]);
  const [html, setHtml] = useState(offer.letterHtml ?? built?.html ?? '');
  const [error, setError] = useState('');
  const missing = locked ? [] : built?.missing ?? [];
  const changed = !locked && !!built && !!offer.letterHtml && offer.letterHtml !== built.html;

  const save = (): boolean => {
    const r = saveOfferLetter(offer.id, html, actor);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  };
  const send = () => {
    if (missing.length) return setError(`The letter still has fields without a value: ${missing.map((k) => `{{${k}}}`).join(', ')}. Fix the template on Operations → Offer letter.`);
    if (!save()) return;
    const r = sendOffer(offer.id, actor);
    if (!r.ok) return setError(r.error);
    const fresh = s.offers.find((o) => o.id === offer.id) ?? offer;
    onClose();
    onSent({ ...fresh, letterHtml: html, status: 'Sent', token: r.token });
  };

  return (
    <div className="hm-lt-body" style={{ padding: 0 }}>
      <div className="hm-lt-meta">
        <span>
          <OfferBadge status={offer.status} />
          {offer.letterAt && <> · prepared {fmtDateTime(offer.letterAt)}</>}
        </span>
        {built && !locked && <span className="tx-s faint">Template: {built.source}</span>}
      </div>

      {error && (
        <div className="note-box hm-warn" role="alert">
          <WarnIcon />
          <div>{error}</div>
        </div>
      )}
      {missing.length > 0 && (
        <div className="note-box hm-warn" role="status">
          <WarnIcon />
          <div>
            The template has fields that cannot be filled: <b>{missing.map((k) => `{{${k}}}`).join(', ')}</b>.{' '}
            <Link href="/hiring/operations/offer-letter" className="hm-link">
              Fix the template
            </Link>
          </div>
        </div>
      )}
      {changed && (
        <div className="note-box" role="status">
          <div>
            The template or the offer has changed since this letter was prepared.{' '}
            <button type="button" className="lnk" onClick={() => built && setHtml(built.html)}>
              Refresh the letter from the template
            </button>
          </div>
        </div>
      )}

      <LetterFrame html={html} title={`Offer letter ${offer.code}`} height={520} location={offer.location} companyId={companyOfOffer(s, offer)} />

      {!locked && (
        <div className="hm-lt-act">
          <Button variant="primary" onClick={send}>
            Save and send to candidate
          </Button>
          <Button
            onClick={() => {
              if (save()) {
                onNotice(`Letter saved on ${offer.code}. Send it when you are ready.`);
                onClose();
              }
            }}
          >
            Save letter
          </Button>
          {built && !offer.letterHtml && (
            <Button variant="ghost" onClick={() => setHtml(built.html)}>
              Reset
            </Button>
          )}
        </div>
      )}

      {offer.status === 'Sent' && offer.token && locked && (
        <div className="hm-lt-act">
          <Button
            variant="primary"
            onClick={() => {
              void navigator.clipboard?.writeText(offerLink(offer.token ?? ''));
              onNotice('Candidate link copied.');
            }}
          >
            Copy candidate link
          </Button>
          <Button onClick={() => onSent(offer)}>Email it again</Button>
          <Button
            variant="ghost"
            onClick={() => {
              const r = revokeOfferLink(offer.id, actor);
              onNotice(r.ok ? `The link for ${offer.code} no longer works. The offer is back to Draft.` : r.error, r.ok ? 'info' : 'warn');
              if (r.ok) onClose();
            }}
          >
            Withdraw link
          </Button>
        </div>
      )}
      {locked && (
        <div className="hm-lt-act">
          <Button onClick={() => void downloadLetterPdf(html, `Offer letter ${offer.code}`, offer.location, companyOfOffer(s, offer))}>Download PDF</Button>
        </div>
      )}

      {(offer.events?.length ?? 0) > 0 && (
        <div>
          <div className="tx-s faint" style={{ marginBottom: 6 }}>
            Activity
          </div>
          <ul className="hm-lt-log">
            {[...(offer.events ?? [])].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span>{e.text}</span>
                <span className="faint">{fmtDateTime(e.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
