'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { CareersFrame } from '@/components/hiring/Careers';
import { LetterFrame } from '@/components/hiring/LetterFrame';
import { appById, candById, jobById, offerByToken, recordOfferEvent, respondToOffer, useHiring } from '@/lib/hiringStore';
import { downloadLetterPdf } from '@/lib/hiringLetters';
import { ENTITY_NAME } from '@/lib/org';

const long = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** The candidate's offer page, reached from the emailed link. No sign-in: the link itself is the key. The candidate
    reads the letter, downloads it, and only then can accept or decline. */
export default function OfferRespondPage() {
  const { token } = useParams<{ token: string }>();
  const s = useHiring();
  const mounted = useMounted();
  const offer = mounted ? offerByToken(s, token) : undefined;
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'accept' | 'decline' | null>(null);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (offer?.status === 'Sent') recordOfferEvent(token, 'viewed');
  }, [token, offer?.status]);

  const foot = `${ENTITY_NAME} · This page is private to you. Please do not forward the link.`;

  if (!mounted) return <CareersFrame title="Your offer" foot={foot}>{null}</CareersFrame>;

  if (!offer || !offer.letterHtml) {
    return (
      <CareersFrame title="Your offer" foot={foot}>
        <div className="cr-card">
          <h2>This offer link is not valid</h2>
          <p>The link may have been withdrawn or mistyped. Please contact the HR team at {ENTITY_NAME}, who can send you a new one.</p>
        </div>
      </CareersFrame>
    );
  }

  const a = appById(s, offer.applicationId);
  const c = a && candById(s, a.candidateId);
  const j = a && jobById(s, a.jobId);
  const first = c?.name.split(/\s+/)[0] ?? 'there';
  const html = offer.letterHtml;
  const expired = offer.status === 'Sent' && offer.expiryDate < today;
  const downloaded = !!offer.downloadedAt;

  const getCopy = async () => {
    setSaving(true);
    setError('');
    try {
      await downloadLetterPdf(html, `Offer letter ${offer.code}`, offer.location);
      recordOfferEvent(token, 'downloaded');
    } catch {
      setError('The PDF could not be created. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const submit = (decision: 'Accepted' | 'Declined') => {
    const r = respondToOffer(token, decision, { name, reason });
    if (!r.ok) setError(r.error);
  };

  if (offer.status === 'Accepted' || offer.status === 'Declined') {
    const yes = offer.status === 'Accepted';
    return (
      <CareersFrame title="Your offer" foot={foot}>
        <div className="cr-card cr-done">
          <div className="cr-done-ic" aria-hidden>
            {yes ? '✓' : '–'}
          </div>
          <h2>{yes ? 'Thank you, you have accepted the offer' : 'You have declined the offer'}</h2>
          <p>
            {yes
              ? `Welcome to ${ENTITY_NAME}, ${first}. Your acceptance${offer.signedName ? `, signed as ${offer.signedName},` : ''} was recorded${offer.respondedAt ? ` on ${long(offer.respondedAt)}` : ''}. Our HR team will contact you about the joining formalities for ${long(offer.joiningDate)}.`
              : `We are sorry it is not the right moment, ${first}. Your reply was recorded${offer.respondedAt ? ` on ${long(offer.respondedAt)}` : ''}, and we wish you every success.`}
          </p>
          {yes && (
            <button type="button" className="btn ghost" disabled={saving} onClick={() => void getCopy()}>
              Download your letter again (PDF)
            </button>
          )}
        </div>
      </CareersFrame>
    );
  }

  if (offer.status !== 'Sent') {
    return (
      <CareersFrame title="Your offer" foot={foot}>
        <div className="cr-card">
          <h2>This offer is not open for a response</h2>
          <p>Please contact the HR team at {ENTITY_NAME}.</p>
        </div>
      </CareersFrame>
    );
  }

  if (expired) {
    return (
      <CareersFrame title="Your offer" foot={foot}>
        <div className="cr-card">
          <h2>This offer has expired</h2>
          <p>
            The offer was valid until {long(offer.expiryDate)}. If you are still interested, please contact the HR team at {ENTITY_NAME} and they will arrange a fresh offer.
          </p>
        </div>
      </CareersFrame>
    );
  }

  return (
    <CareersFrame title="Your offer" foot={foot}>
      <h1 className="cr-h1">Your offer, {first}</h1>
      <p className="cr-lead">
        {j?.title} · {j?.department} · valid until {long(offer.expiryDate)}
      </p>

      <ol className="of-steps" aria-label="Steps">
        <li className="on">1 · Read your letter</li>
        <li className={downloaded ? 'on' : ''}>2 · Download it</li>
        <li className={downloaded ? 'on' : ''}>3 · Accept or decline</li>
      </ol>

      <div className="cr-card">
        <h2>Offer letter</h2>
        <LetterFrame html={html} title={`Offer letter ${offer.code}`} height={620} location={offer.location} />
        <div className="of-act">
          <button type="button" className="btn primary" disabled={saving} onClick={() => void getCopy()}>
            {saving ? 'Preparing your PDF…' : 'Download the letter (PDF)'}
          </button>
          {downloaded && <span className="of-ok">✓ You have your copy</span>}
          {!downloaded && error && <span className="of-err" role="alert">{error}</span>}
        </div>
      </div>

      <div className={`cr-card ${downloaded ? '' : 'of-locked'}`}>
        <h2>Your answer</h2>
        {!downloaded ? (
          <p style={{ margin: 0 }}>Please download the letter above first. Your answer unlocks as soon as you have your copy, so you always have the terms in hand.</p>
        ) : (
          <>
            <div className="of-choice" role="group" aria-label="Your answer">
              <button type="button" className={`of-pick yes ${mode === 'accept' ? 'on' : ''}`} onClick={() => { setMode('accept'); setError(''); }}>
                I accept this offer
              </button>
              <button type="button" className={`of-pick no ${mode === 'decline' ? 'on' : ''}`} onClick={() => { setMode('decline'); setError(''); }}>
                I decline this offer
              </button>
            </div>

            {mode === 'accept' && (
              <form
                className="of-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return setError('Type your full name to accept.');
                  if (!agree) return setError('Please tick the box to confirm you have read the letter.');
                  setError('');
                  submit('Accepted');
                }}
              >
                <label>
                  Your full name
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={c?.name} autoComplete="name" />
                </label>
                <label className="of-check">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>I have read the offer letter and accept the position and terms in it, with a joining date of {long(offer.joiningDate)}.</span>
                </label>
                {error && <div className="of-err" role="alert">{error}</div>}
                <button type="submit" className="btn primary">
                  Confirm acceptance
                </button>
              </form>
            )}

            {mode === 'decline' && (
              <form
                className="of-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reason.trim()) return setError('Tell us briefly why you are declining.');
                  setError('');
                  submit('Declined');
                }}
              >
                <label>
                  Reason for declining
                  <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example, I accepted another offer" />
                </label>
                {error && <div className="of-err" role="alert">{error}</div>}
                <button type="submit" className="btn danger">
                  Confirm decline
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </CareersFrame>
  );
}
