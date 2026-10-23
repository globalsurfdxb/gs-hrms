'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Card';
import { WarnIcon, XIcon } from '@/components/icons';
import { LetterFrame, formatEdited, readEditedBody } from '@/components/hiring/LetterFrame';
import { PagedLetter } from '@/components/hiring/PagedLetter';
import { OfferBadge, fmtDate, fmtDateTime, money, payUnit, useActor } from '@/components/hiring/HiringBits';
import { appById, candById, jobById, revokeOfferLink, saveOfferLetter, sendOffer, useHiring } from '@/lib/hiringStore';
import { Offer } from '@/lib/hiringTypes';
import { buildLetter, cleanHtml, companiesAt, companyOfOffer, downloadLetterPdf, perCompany, useLetterState, withSignature } from '@/lib/hiringLetters';

export const offerLink = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/offer/respond/${token}`;

/** The offer letter for one offer, in a large workspace: the letter on the right as a page, and on the left who it is
    for, which company issues it, what is wrong with it, and what has happened to it. Prepare it from the template,
    send the candidate their link, and follow what they do. */
export function OfferLetterDrawer({ offerId, onClose, onSent, onNotice }: { offerId: string | null; onClose: () => void; onSent: (offer: Offer) => void; onNotice: (text: string, tone?: 'info' | 'warn') => void }) {
  const s = useHiring();
  const offer = offerId ? s.offers.find((o) => o.id === offerId) : undefined;
  const open = !!offer;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!offer) return null;
  return <Workspace key={offer.id} offer={offer} onClose={onClose} onSent={onSent} onNotice={onNotice} />;
}

function Workspace({ offer, onClose, onSent, onNotice }: { offer: Offer; onClose: () => void; onSent: (offer: Offer) => void; onNotice: (text: string, tone?: 'info' | 'warn') => void }) {
  const s = useHiring();
  const ls = useLetterState();
  const actor = useActor();
  const app = appById(s, offer.applicationId);
  const cand = app && candById(s, app.candidateId);
  const job = app && jobById(s, app.jobId);
  const answered = offer.status === 'Accepted' || offer.status === 'Declined';
  // An offer marked Sent before letters existed has no letter yet, so it can still be prepared and given a link.
  const locked = answered || (offer.status === 'Sent' && !!offer.letterHtml);
  // In the UAE the letter comes from one of the group companies: it starts as the job's company and can be changed.
  const [companyId, setCompanyId] = useState<string | undefined>(() => companyOfOffer(s, offer));
  const perCo = perCompany(offer.location);
  const companies = perCo ? companiesAt(offer.location) : [];
  const built = useMemo(() => buildLetter(s, offer.id, actor.name, ls, companyId), [s, ls, offer.id, actor.name, companyId]);
  const [html, setHtml] = useState(offer.letterHtml ?? built?.html ?? '');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  // True once the text was changed by hand for this candidate; choosing another company or refreshing would replace it.
  const [handEdited, setHandEdited] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // Fields still showing as {{field}} in the letter as it reads now, so a hand edit can fix or add one.
  const missing = locked ? [] : [...new Set([...html.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
  const changed = !locked && !!built && !!offer.letterHtml && offer.letterHtml !== built.html;
  const companyName = companies.find((c) => c.id === companyId)?.name;
  // Once accepted, the letter is shown and downloaded with the candidate's signature at the end.
  const shownHtml = offer.signature ? withSignature(html, offer) : html;

  const save = (): boolean => {
    const r = saveOfferLetter(offer.id, html, actor, companyId);
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
    <div className="olm-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="olm" role="dialog" aria-modal="true" aria-label={`Offer letter ${offer.code}`}>
        <header className="olm-head">
          <div>
            <h3>
              Offer letter · {offer.code} <OfferBadge status={offer.status} />
            </h3>
            <p>
              {cand?.name ?? 'Candidate'} · {job?.title ?? ''}
              {companyName ? ` · ${companyName}` : ''}
            </p>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </header>

        <div className="olm-body">
          <aside className="olm-side">
            {error && (
              <div className="note-box hm-warn" role="alert">
                <WarnIcon />
                <div>{error}</div>
              </div>
            )}

            {perCo && (
              <section className="olm-card">
                <h4>Issuing company</h4>
                {locked ? (
                  <p className="olm-company">{companyName ?? '—'}</p>
                ) : (
                  <>
                    <div className="olm-cos" role="radiogroup" aria-label="Issuing company">
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={companyId === c.id}
                          className={`olm-co ${companyId === c.id ? 'on' : ''}`}
                          onClick={() => {
                            if (c.id === companyId) return;
                            if (handEdited && !window.confirm('Choosing another company replaces the text you edited with that company’s template. Continue?')) return;
                            setHandEdited(false);
                            setCompanyId(c.id);
                            const next = buildLetter(s, offer.id, actor.name, ls, c.id);
                            if (next) setHtml(next.html);
                            setError('');
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                    <small>The letter uses this company&apos;s template, name and footer.</small>
                  </>
                )}
              </section>
            )}

            <section className="olm-card">
              <h4>Offer</h4>
              <dl className="olm-dl">
                <div>
                  <dt>Candidate</dt>
                  <dd>{cand?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>
                    {job?.title ?? '—'}
                    {job?.department ? <small> · {job.department}</small> : null}
                  </dd>
                </div>
                <div>
                  <dt>Package</dt>
                  <dd>
                    {money(offer.total, offer.currency)} <small>{payUnit(offer.currency)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Joining</dt>
                  <dd>{fmtDate(offer.joiningDate)}</dd>
                </div>
                <div>
                  <dt>Probation</dt>
                  <dd>{offer.probationMonths ? `${offer.probationMonths} months` : 'None'}</dd>
                </div>
                <div>
                  <dt>Valid until</dt>
                  <dd>{fmtDate(offer.expiryDate)}</dd>
                </div>
              </dl>
            </section>

            <section className="olm-card">
              <h4>Letter</h4>
              <dl className="olm-dl">
                <div>
                  <dt>Template</dt>
                  <dd>{built?.source ?? '—'}</dd>
                </div>
                <div>
                  <dt>Prepared</dt>
                  <dd>{offer.letterAt ? fmtDateTime(offer.letterAt) : 'Not yet'}</dd>
                </div>
                {offer.signature && (
                  <div>
                    <dt>E-signed</dt>
                    <dd>{offer.signedName}</dd>
                  </div>
                )}
                {offer.sentAt && (
                  <div>
                    <dt>Sent</dt>
                    <dd>{fmtDateTime(offer.sentAt)}</dd>
                  </div>
                )}
              </dl>
              {handEdited && !locked && (
                <div className="note-box" role="status">
                  <div>
                    This letter was edited for this candidate.{' '}
                    <button
                      type="button"
                      className="lnk"
                      onClick={() => {
                        if (built) setHtml(built.html);
                        setHandEdited(false);
                      }}
                    >
                      Restore the template version
                    </button>
                  </div>
                </div>
              )}
              {missing.length > 0 && (
                <div className="note-box hm-warn" role="status">
                  <WarnIcon />
                  <div>
                    These fields are still empty in the letter: <b>{missing.map((k) => `{{${k}}}`).join(', ')}</b>. Edit the letter to fill or remove them, or{' '}
                    <Link href="/hiring/operations/offer-letter" className="hm-link">
                      fix the template
                    </Link>
                  </div>
                </div>
              )}
              {changed && (
                <div className="note-box" role="status">
                  <div>
                    The template or the offer has changed since this letter was prepared.{' '}
                    <button
                      type="button"
                      className="lnk"
                      onClick={() => {
                        if (handEdited && !window.confirm('This replaces the text you edited with the current template. Continue?')) return;
                        setHandEdited(false);
                        if (built) setHtml(built.html);
                      }}
                    >
                      Refresh the letter
                    </button>
                  </div>
                </div>
              )}
            </section>

            {(offer.events?.length ?? 0) > 0 && (
              <section className="olm-card">
                <h4>Activity</h4>
                <ul className="hm-lt-log">
                  {[...(offer.events ?? [])].reverse().map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      <span>{e.text}</span>
                      <span className="faint">{fmtDateTime(e.at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>

          <section className="olm-main" aria-label="Letter preview">
            <div className="olm-toolbar">
              {editing ? (
                <>
                  <div className="olm-tools" role="toolbar" aria-label="Formatting">
                    <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => formatEdited(frame.current, 'bold')}>
                      <b>B</b>
                    </button>
                    <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => formatEdited(frame.current, 'italic')}>
                      <i>I</i>
                    </button>
                    <button type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => formatEdited(frame.current, 'underline')}>
                      <u>U</u>
                    </button>
                    <button type="button" title="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => formatEdited(frame.current, 'insertUnorderedList')}>
                      • List
                    </button>
                    <button type="button" title="Undo" onMouseDown={(e) => e.preventDefault()} onClick={() => formatEdited(frame.current, 'undo')}>
                      Undo
                    </button>
                    <button type="button" title="Redo" onMouseDown={(e) => e.preventDefault()} onClick={() => formatEdited(frame.current, 'redo')}>
                      Redo
                    </button>
                  </div>
                  <span className="sp" />
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const body = readEditedBody(frame.current);
                      if (body !== null) {
                        const next = cleanHtml(body);
                        if (next !== html) {
                          setHtml(next);
                          setHandEdited(true);
                        }
                      }
                      setEditing(false);
                    }}
                  >
                    Done editing
                  </Button>
                </>
              ) : (
                <>
                  <span>{locked ? 'The letter as sent, page by page' : 'Preview, page by page: this is what the candidate will read'}</span>
                  <span className="sp" />
                  {!locked && (
                    <Button size="sm" variant="primary" onClick={() => setEditing(true)}>
                      Edit letter
                    </Button>
                  )}
                  <Button size="sm" onClick={() => void downloadLetterPdf(shownHtml, `${offer.signature ? 'Signed offer letter' : 'Offer letter'} ${offer.code}`, offer.location, companyId)}>
                    Download PDF
                  </Button>
                </>
              )}
            </div>
            <div className="olm-stage">
              {editing ? (
                <div className="olm-paper">
                  <LetterFrame key="edit" frameRef={frame} html={html} title={`Offer letter ${offer.code}`} autoHeight editable location={offer.location} companyId={companyId} />
                </div>
              ) : (
                <PagedLetter html={shownHtml} title={`Offer letter ${offer.code}`} location={offer.location} companyId={companyId} />
              )}
            </div>
          </section>
        </div>

        <footer className="olm-foot">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <span className="sp" />
          {!locked && (
            <>
              {built && !offer.letterHtml && (
                <Button
                  variant="ghost"
                  disabled={editing}
                  onClick={() => {
                    setHtml(built.html);
                    setHandEdited(false);
                  }}
                >
                  Reset
                </Button>
              )}
              <Button
                disabled={editing}
                onClick={() => {
                  if (save()) {
                    onNotice(`Letter saved on ${offer.code}. Send it when you are ready.`);
                    onClose();
                  }
                }}
              >
                Save letter
              </Button>
              <Button variant="primary" disabled={editing} title={editing ? 'Finish editing first' : undefined} onClick={send}>
                Save and send to candidate
              </Button>
            </>
          )}
          {offer.status === 'Sent' && offer.token && locked && (
            <>
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
              <Button onClick={() => onSent(offer)}>Email it again</Button>
              <Button
                variant="primary"
                onClick={() => {
                  void navigator.clipboard?.writeText(offerLink(offer.token ?? ''));
                  onNotice('Candidate link copied.');
                }}
              >
                Copy candidate link
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
