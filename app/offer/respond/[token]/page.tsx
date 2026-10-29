'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { CareersFrame } from '@/components/hiring/Careers';
import { PagedLetter } from '@/components/hiring/PagedLetter';
import { SignaturePad } from '@/components/hiring/SignaturePad';
import { appById, candById, jobById, nameProblem, offerByToken, recordOfferEvent, respondToOffer, useHiring } from '@/lib/hiringStore';
import { companyOfOffer, downloadLetterPdf, withSignature } from '@/lib/hiringLetters';
import { COMPANIES } from '@/lib/data';
import { daysBetween, todayISO } from '@/lib/dates';
import { ENTITY_NAME } from '@/lib/org';

const long = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

const Icon = ({ d, extra }: { d: string; extra?: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

/** The candidate's offer page, reached from the emailed link. No sign-in: the link itself is the key. The candidate
    reads the letter, downloads it, and only then can sign and accept, or decline. */
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
  const [signature, setSignature] = useState('');
  // The signed copy offered once, on the screen where they sign. After a reload it is gone: the link no longer opens the letter.
  const [signedCopy, setSignedCopy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [today] = useState(() => todayISO());

  useEffect(() => {
    if (offer?.status === 'Sent') recordOfferEvent(token, 'viewed');
  }, [token, offer?.status]);

  const foot = `${ENTITY_NAME} · This page is private to you. Please do not forward the link.`;
  const plain = (children: React.ReactNode) => (
    <CareersFrame landing minimal title="Your offer" foot={foot}>
      <div className="cr2-wrap of2-center">{children}</div>
    </CareersFrame>
  );

  if (!mounted) return <CareersFrame landing minimal title="Your offer" foot={foot}>{null}</CareersFrame>;

  if (!offer || !offer.letterHtml) {
    return plain(
      <>
        <div className="cr2-empty">
          <h3>This offer link is not valid</h3>
          <p>The link may have been withdrawn or mistyped. Please contact the HR team at {ENTITY_NAME}, who can send you a new one.</p>
        </div>
      </>,
    );
  }

  const a = appById(s, offer.applicationId);
  const c = a && candById(s, a.candidateId);
  const j = a && jobById(s, a.jobId);
  const company = COMPANIES.find((x) => x.id === companyOfOffer(s, offer))?.name ?? ENTITY_NAME;
  const first = c?.name.split(/\s+/)[0] ?? 'there';
  const html = offer.letterHtml;
  const expired = offer.status === 'Sent' && offer.expiryDate < today;
  const downloaded = !!offer.downloadedAt;
  const daysLeft = daysBetween(today, offer.expiryDate);
  const place = offer.location === 'Kochi' ? 'Kochi, India' : 'Dubai, UAE';

  const getCopy = async () => {
    setSaving(true);
    setError('');
    try {
      await downloadLetterPdf(html, `Offer letter ${offer.code}`, offer.location, companyOfOffer(s, offer));
      recordOfferEvent(token, 'downloaded');
    } catch {
      setError('The PDF could not be created. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const submit = (decision: 'Accepted' | 'Declined') => {
    const r = respondToOffer(token, decision, { name, reason, signature });
    if (!r.ok) return setError(r.error);
    if (decision === 'Accepted') setSignedCopy(withSignature(html, { signature, signedName: c?.name ?? name.replace(/\s+/g, ' ').trim(), signedAt: new Date().toISOString() }));
  };
  const getSignedCopy = async () => {
    if (!signedCopy) return;
    setSaving(true);
    try {
      await downloadLetterPdf(signedCopy, `Signed offer letter ${offer.code}`, offer.location, companyOfOffer(s, offer));
    } catch {
      setError('The PDF could not be created. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (offer.status === 'Accepted' || offer.status === 'Declined') {
    const yes = offer.status === 'Accepted';
    return plain(
      <>
        <div className="of2-done">
          <div className={`of2-done-ic ${yes ? 'yes' : 'no'}`} aria-hidden>
            {yes ? '✓' : '–'}
          </div>
          <h1>{yes ? `Welcome aboard, ${first}` : 'You have declined the offer'}</h1>
          <p>
            {yes
              ? `Thank you for accepting. Your acceptance${offer.signedName ? `, signed by ${offer.signedName},` : ''} was recorded${offer.respondedAt ? ` on ${long(offer.respondedAt)}` : ''}. Our HR team will contact you about the joining formalities for ${long(offer.joiningDate)}.`
              : `We are sorry it is not the right moment, ${first}. Your reply was recorded${offer.respondedAt ? ` on ${long(offer.respondedAt)}` : ''}, and we wish you every success.`}
          </p>
          {yes && signedCopy ? (
            <>
              <button type="button" className="cr2-btn primary" disabled={saving} onClick={() => void getSignedCopy()}>
                {saving ? 'Preparing your PDF…' : 'Download your signed copy (PDF)'}
              </button>
              <p className="of-once">Please save it now. For your security this link closes once you leave or refresh this page, and the letter cannot be opened again from it.</p>
            </>
          ) : (
            <p className="of-once">This link is now closed. If you need another copy of your letter, please ask the HR team.</p>
          )}
          {error && <div className="of-err" role="alert">{error}</div>}
        </div>
      </>,
    );
  }

  if (offer.status !== 'Sent') {
    return plain(
      <>
        <div className="cr2-empty">
          <h3>This offer is not open for a response</h3>
          <p>Please contact the HR team at {ENTITY_NAME}.</p>
        </div>
      </>,
    );
  }

  if (expired) {
    return plain(
      <>
        <div className="cr2-empty">
          <h3>This offer has expired</h3>
          <p>
            The offer was valid until {long(offer.expiryDate)}. If you are still interested, please contact the HR team at {ENTITY_NAME} and they will arrange a fresh offer.
          </p>
        </div>
      </>,
    );
  }

  const steps = [
    { t: 'Read your letter', d: 'Scroll through every page.', done: true },
    { t: 'Download your copy', d: 'Keep the terms in hand.', done: downloaded },
    { t: 'Sign and respond', d: 'Accept with your signature, or decline.', done: false },
  ];
  const current = downloaded ? 2 : 1;

  return (
    <CareersFrame
      landing
      minimal
      title="Your offer"
      foot={foot}
      hero={
        <section className="cr3-hero" style={{ ['--a' as string]: '#28469a' }}>
          <div className="cr2-blob b1" aria-hidden />
          <div className="cr2-wrap">
            <div className="cr3-badges">
              <span className="cr2-co">{company}</span>
              <span className="cr3-dept">
                <i /> Offer of employment
              </span>
            </div>
            <h1 style={{ marginTop: 14 }}>Your offer, {first}</h1>
            <p className="cr3-sub">
              {j?.title} · {j?.department} · {place}
              {daysLeft <= 7 && <b className="cr3-urgent"> · {daysLeft === 0 ? 'valid until today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left to respond`}</b>}
            </p>
          </div>
        </section>
      }
    >
      <div className="cr2-wrap cr3-facts" style={{ ['--a' as string]: '#28469a' }}>
        <div className="cr3-fact">
          <span>
            <Icon d="M3 7h18v13H3zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
          </span>
          <div>
            <small>Role</small>
            <b>{j?.title}</b>
          </div>
        </div>
        <div className="cr3-fact">
          <span>
            <Icon d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" extra="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          </span>
          <div>
            <small>Location</small>
            <b>{place}</b>
          </div>
        </div>
        <div className="cr3-fact">
          <span>
            <Icon d="M8 2v4M16 2v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          </span>
          <div>
            <small>Joining date</small>
            <b>{long(offer.joiningDate)}</b>
          </div>
        </div>
        <div className="cr3-fact">
          <span>
            <Icon d="M12 8v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          </span>
          <div>
            <small>Respond by</small>
            <b>{long(offer.expiryDate)}</b>
          </div>
        </div>
      </div>

      <div className="cr2-wrap cr3-layout">
        <div className="cr3-main">
          <section className="of2-letter" id="letter">
            <header>
              <div>
                <h2>Your offer letter</h2>
                <p>Read it in full, then download your copy to unlock your answer.</p>
              </div>
              <button type="button" className="cr2-btn primary" disabled={saving} onClick={() => void getCopy()}>
                {saving ? 'Preparing your PDF…' : downloaded ? '✓ Download again' : 'Download (PDF)'}
              </button>
            </header>
            {!downloaded && error && <div className="of-err" role="alert" style={{ padding: '0 24px 12px' }}>{error}</div>}
            <div className="of2-stage">
              <PagedLetter fit html={html} title={`Offer letter ${offer.code}`} location={offer.location} companyId={companyOfOffer(s, offer)} />
            </div>
          </section>

          <section className={`of2-answer ${downloaded ? '' : 'locked'}`} id="answer">
            <h2>Your answer</h2>
            {!downloaded ? (
              <div className="of2-lock">
                <span aria-hidden>🔒</span>
                <p>Download the letter above first. Your answer unlocks as soon as you have your copy, so you always have the terms in hand.</p>
              </div>
            ) : (
              <>
                <div className="of-choice" role="group" aria-label="Your answer">
                  <button type="button" className={`of-pick yes ${mode === 'accept' ? 'on' : ''}`} onClick={() => { setMode('accept'); setError(''); }}>
                    <b>I accept this offer</b>
                    <small>Sign and confirm</small>
                  </button>
                  <button type="button" className={`of-pick no ${mode === 'decline' ? 'on' : ''}`} onClick={() => { setMode('decline'); setError(''); }}>
                    <b>I decline this offer</b>
                    <small>Tell us why</small>
                  </button>
                </div>

                {mode === 'accept' && (
                  <form
                    className="of-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const bad = c ? nameProblem(name, c.name) : name.trim() ? '' : 'Type your full name to accept.';
                      if (bad) {
                        setNameError(bad);
                        return setError(bad);
                      }
                      if (!agree) return setError('Please tick the box to confirm you have read the letter.');
                      if (!signature) return setError('Please add your signature.');
                      setError('');
                      submit('Accepted');
                    }}
                  >
                    <label>
                      Your full name
                      <input
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setNameError('');
                        }}
                        onBlur={() => c && name.trim() && setNameError(nameProblem(name, c.name))}
                        placeholder={c?.name}
                        autoComplete="name"
                        aria-invalid={!!nameError}
                        style={nameError ? { borderColor: '#b3281d' } : undefined}
                      />
                      <small className={nameError ? 'of-name-bad' : 'of-name-hint'}>{nameError || 'As it appears on your offer letter.'}</small>
                    </label>
                    <div>
                      <div className="of-lbl">Your signature</div>
                      <SignaturePad onChange={setSignature} />
                    </div>
                    <label className="of-check">
                      <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                      <span>I have read the offer letter and accept the position and terms in it, with a joining date of {long(offer.joiningDate)}.</span>
                    </label>
                    {error && <div className="of-err" role="alert">{error}</div>}
                    <button type="submit" className="cr2-btn primary of2-submit">
                      Sign and accept the offer
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
                    <button type="submit" className="btn danger of2-submit">
                      Confirm decline
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="cr3-aside" aria-label="Progress">
          <div className="cr3-card">
            <h3>Where you are</h3>
            <ol className="of2-steps">
              {steps.map((st, i) => (
                <li key={st.t} className={st.done ? 'done' : i === current ? 'now' : ''}>
                  <span>{st.done ? '✓' : i + 1}</span>
                  <div>
                    <b>{st.t}</b>
                    <small>{st.d}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="cr3-card">
            <h3>Key dates</h3>
            <dl className="cr3-keyd">
              <div>
                <dt>Respond by</dt>
                <dd>{long(offer.expiryDate)}</dd>
              </div>
              <div>
                <dt>Joining</dt>
                <dd>{long(offer.joiningDate)}</dd>
              </div>
              <div>
                <dt>Probation</dt>
                <dd>{offer.probationMonths ? `${offer.probationMonths} months` : 'None'}</dd>
              </div>
            </dl>
          </div>
          <div className="cr3-card cr3-help">
            <h3>Questions about the offer?</h3>
            <p>
              Write to <a href="mailto:hr@globalsurf.ae">hr@globalsurf.ae</a> and mention {offer.code}.
            </p>
          </div>
        </aside>
      </div>

      <div className="cr3-bar">
        <span>
          <b>{downloaded ? 'Ready to answer' : 'Your offer letter'}</b>
          <small>{downloaded ? 'Sign to accept, or decline' : 'Download it to unlock your answer'}</small>
        </span>
        {downloaded ? (
          <a href="#answer" className="cr2-btn primary">
            Answer
          </a>
        ) : (
          <button type="button" className="cr2-btn primary" disabled={saving} onClick={() => void getCopy()}>
            Download
          </button>
        )}
      </div>
    </CareersFrame>
  );
}
