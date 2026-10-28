'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { CareersFrame } from '@/components/hiring/Careers';
import { Fg } from '@/components/hiring/HiringBits';
import { ENTITY_NAME } from '@/lib/org';
import { DocFile, DocItem, DocRequest, Referral, declineDocs, docRequestByToken, markDocsOpened, referralProblem, saveDocsDraft, submitDocs, useDocRequests } from '@/lib/hiringDocs';

const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);
const long = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const MAX_BYTES = 10 * 1024 * 1024;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** The candidate's page, reached from the emailed link. No sign-in: the link itself is the key. They confirm they want to
    proceed, send the documents HR asked for, and give a background-verification referral. */
export default function DocumentsPage() {
  const { token } = useParams<{ token: string }>();
  const mounted = useMounted();
  const list = useDocRequests();
  const req = mounted ? docRequestByToken(list, token) : undefined;
  const foot = `${req?.company ?? ENTITY_NAME} · This page is private to you. Please do not forward the link.`;

  useEffect(() => {
    if (req?.status === 'Requested') markDocsOpened(token);
  }, [token, req?.status]);

  if (!mounted) return <CareersFrame minimal title="Your documents" foot={foot}>{null}</CareersFrame>;
  if (!req)
    return (
      <CareersFrame minimal title="Your documents" foot={foot}>
        <div className="cr-card cr-empty">
          <h2>This link is not valid</h2>
          <p>It may be mistyped or no longer active. Please contact the HR team at {ENTITY_NAME}, who can send you a new one.</p>
        </div>
      </CareersFrame>
    );
  const first = req.name.split(/\s+/)[0];

  if (req.status === 'Declined')
    return (
      <CareersFrame minimal title="Your documents" foot={foot}>
        <div className="cr-card cr-done">
          <div className="cr-done-ic" aria-hidden>
            ✓
          </div>
          <h2>Thank you for letting us know, {first}</h2>
          <p>We have noted that you do not want to proceed with the {req.jobTitle} role. If you change your mind, please contact the HR team and we will be glad to continue.</p>
        </div>
      </CareersFrame>
    );

  if (req.status === 'Verified' || req.status === 'Waived')
    return (
      <CareersFrame minimal title="Your documents" foot={foot}>
        <div className="cr-card cr-done">
          <div className="cr-done-ic" aria-hidden>
            ✓
          </div>
          <h2>{req.status === 'Verified' ? 'Your documents are verified' : 'Nothing more is needed from you'}</h2>
          <p>Thank you, {first}. We will now prepare your offer letter for the {req.jobTitle} role and email it to you.</p>
        </div>
      </CareersFrame>
    );

  if (req.status === 'Submitted')
    return (
      <CareersFrame minimal title="Your documents" foot={foot}>
        <div className="cr-card cr-done">
          <div className="cr-done-ic" aria-hidden>
            ✓
          </div>
          <h2>Thank you, {first}. We have your documents</h2>
          <p>Our HR team will check them and write to you. If we need anything again we will email you, and you can use this same link.</p>
          <ul className="dc-recv">
            {req.items.map((i) => (
              <li key={i.key}>
                <span>{i.label}</span>
                <em className={`dc-st ${i.status.toLowerCase()}`}>{i.files.length ? `${i.files.length} file${i.files.length === 1 ? '' : 's'} · ${i.status === 'Verified' ? 'Verified' : 'Received'}` : 'Not sent'}</em>
              </li>
            ))}
          </ul>
        </div>
      </CareersFrame>
    );

  return <DocsForm key={req.id} req={req} foot={foot} />;
}

function DocsForm({ req, foot }: { req: DocRequest; foot: string }) {
  const first = req.name.split(/\s+/)[0];
  const [willing, setWilling] = useState<'yes' | 'no' | undefined>(req.willing);
  const [files, setFiles] = useState<Record<string, DocFile[]>>(() => Object.fromEntries(req.items.map((i) => [i.key, i.files])));
  const [bgv, setBgv] = useState<Referral>(req.bgv);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [fileError, setFileError] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const india = req.location === 'Kochi';

  // Keep what they have chosen, so they can close the page and come back.
  const snapshot = JSON.stringify({ willing, files, bgv });
  useEffect(() => {
    const t = setTimeout(() => {
      const d = JSON.parse(snapshot) as { willing?: 'yes' | 'no'; files: Record<string, DocFile[]>; bgv: Referral };
      saveDocsDraft(req.token, { willing: d.willing === 'yes' ? 'yes' : undefined, files: d.files, bgv: d.bgv });
      setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 700);
    return () => clearTimeout(t);
  }, [snapshot, req.token]);

  const add = (item: DocItem, picked: FileList | null) => {
    if (!picked?.length) return;
    const ok: DocFile[] = [];
    let problem = '';
    [...picked].forEach((f) => {
      if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) problem = `${f.name}: use a PDF, JPG or PNG.`;
      else if (f.size > MAX_BYTES) problem = `${f.name}: larger than 10 MB.`;
      else ok.push({ name: f.name, size: f.size, at: new Date().toISOString() });
    });
    setFileError((e) => ({ ...e, [item.key]: problem }));
    if (!ok.length) return;
    // A sent-back document is replaced by the new copy; otherwise files are added.
    setFiles((p) => ({ ...p, [item.key]: item.status === 'Rejected' && p[item.key] === item.files ? ok : [...(p[item.key] ?? []), ...ok] }));
  };
  const remove = (key: string, n: number) => setFiles((p) => ({ ...p, [key]: (p[key] ?? []).filter((_, i) => i !== n) }));

  const refProblem = referralProblem(bgv);
  const missing = req.items.filter((i) => i.required && i.status !== 'Verified' && !(files[i.key] ?? []).length);
  const unchanged = req.items.filter((i) => i.status === 'Rejected' && JSON.stringify(files[i.key]) === JSON.stringify(i.files));
  const setRef = (k: keyof Referral, v: string) => setBgv((p) => ({ ...p, [k]: v }));
  const shownRef = (k: keyof Referral) => (attempted && !bgv[k].trim() ? 'Required.' : undefined);

  const submit = () => {
    setAttempted(true);
    setError('');
    if (willing !== 'yes') return setError('Please confirm that you want to proceed.');
    if (missing.length || unchanged.length || refProblem) {
      setError(missing.length ? `Please attach: ${missing.map((i) => i.label).join(', ')}.` : unchanged.length ? `Please replace: ${unchanged.map((i) => i.label).join(', ')}.` : refProblem);
      document.querySelector('.dc-bad, .fm-err, [aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const r = submitDocs(req.token, { willing: 'yes', files, bgv });
    if (!r.ok) setError(r.error);
  };

  const decline = () => {
    const r = declineDocs(req.token, reason);
    if (!r.ok) setError(r.error);
  };

  const sentBack = req.items.filter((i) => i.status === 'Rejected').length + (req.bgvStatus === 'Rejected' ? 1 : 0);

  return (
    <CareersFrame
      wide
      minimal
      title="Your documents"
      foot={foot}
      hero={
        <section className="jh">
          <span className="cr2-blob b1" aria-hidden />
          <span className="cr2-blob b2" aria-hidden />
          <div className="jh-in">
            <div className="jh-copy">
              <span className="cr2-pill">
                <i /> Next step · {req.jobTitle}
              </span>
              <h1>
                Confirm and share your documents, <em>{first}</em>
              </h1>
              <p>Tell us you want to proceed, then send the papers we need to prepare your offer letter. Your answers save as you go, so you can come back to this same link.</p>
            </div>
            <dl className="jh-facts">
              <div>
                <dt>Role</dt>
                <dd>{req.jobTitle}</dd>
              </div>
              <div>
                <dt>Please send by</dt>
                <dd>{long(req.dueDate)}</dd>
              </div>
              <div>
                <dt>Work location</dt>
                <dd>{india ? 'Kochi, India' : 'Dubai, UAE'}</dd>
              </div>
            </dl>
          </div>
        </section>
      }
    >
      <div className="jf dc">
        {sentBack > 0 && (
          <div className="tx-err" role="alert">
            <b>HR needs {sentBack} thing{sentBack === 1 ? '' : 's'} sent again.</b> They are marked below with what to fix.
          </div>
        )}
        {error && (
          <div className="tx-err" role="alert">
            {error}
          </div>
        )}

        <section className="cr-card jf-sec">
          <h2>Do you want to proceed?</h2>
          <p className="cr-sub">Please confirm your willingness to proceed with this opportunity.</p>
          <div className="dc-choice" role="radiogroup" aria-label="Willingness to proceed">
            <button type="button" role="radio" aria-checked={willing === 'yes'} className={`dc-opt yes ${willing === 'yes' ? 'on' : ''}`} onClick={() => setWilling('yes')}>
              <b>Yes, I want to proceed</b>
              <small>I will share my documents</small>
            </button>
            <button type="button" role="radio" aria-checked={willing === 'no'} className={`dc-opt no ${willing === 'no' ? 'on' : ''}`} onClick={() => setWilling('no')}>
              <b>No, I am not interested</b>
              <small>Let the team know</small>
            </button>
          </div>
          {willing === 'no' && (
            <div className="dc-decline">
              <Fg label="Would you like to tell us why? (optional)" full>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: I accepted another offer" />
              </Fg>
              <button type="button" className="btn primary" onClick={decline}>
                Confirm and close
              </button>
            </div>
          )}
        </section>

        {willing === 'yes' && (
          <>
            <section className="cr-card jf-sec">
              <h2>Your documents</h2>
              <p className="cr-sub">Attach clear copies (PDF, JPG or PNG, up to 10 MB each). You can add more than one file to a document.</p>
              <div className="dc-docs">
                {req.items.map((it) => {
                  const mine = files[it.key] ?? [];
                  const locked = it.status === 'Verified';
                  const need = attempted && it.required && !locked && !mine.length;
                  return (
                    <div key={it.key} className={`dc-doc ${locked ? 'ok' : ''} ${it.status === 'Rejected' ? 'back' : ''} ${need ? 'dc-bad' : ''}`}>
                      <div className="dc-dh">
                        <div>
                          <b>{it.label}</b>
                          {it.required ? <span className="dc-req">Required</span> : <span className="dc-opt-tag">Optional</span>}
                          <small>{it.hint}</small>
                        </div>
                        {locked && <span className="dc-st verified">✓ Verified</span>}
                      </div>
                      {it.status === 'Rejected' && it.note && (
                        <div className="dc-note">
                          <b>HR asked for this again:</b> {it.note}
                        </div>
                      )}
                      {!!mine.length && (
                        <ul className="dc-files">
                          {mine.map((f, n) => (
                            <li key={`${f.name}-${n}`}>
                              <span>{f.name}</span>
                              <small>{kb(f.size)}</small>
                              {!locked && (
                                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(it.key, n)}>
                                  ×
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!locked && (
                        <label className="dc-up">
                          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => (add(it, e.target.files), (e.target.value = ''))} />
                          <span>{it.status === 'Rejected' && JSON.stringify(mine) === JSON.stringify(it.files) ? 'Choose the corrected file' : mine.length ? '+ Add another file' : 'Choose file'}</span>
                        </label>
                      )}
                      {fileError[it.key] && <div className="dc-err">{fileError[it.key]}</div>}
                      {need && <div className="dc-err">Please attach this document.</div>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="cr-card jf-sec">
              <h2>Background verification referral</h2>
              <p className="cr-sub">Someone who can confirm your employment, such as a manager or HR contact at your current or last company. We will only contact them for background verification.</p>
              {req.bgvStatus === 'Rejected' && req.bgvNote && (
                <div className="dc-note" style={{ marginBottom: 14 }}>
                  <b>HR asked for this again:</b> {req.bgvNote}
                </div>
              )}
              <div className="form-grid hm-form">
                <Fg label="Contact person name" required error={shownRef('name')}>
                  <input value={bgv.name} onChange={(e) => setRef('name', e.target.value)} autoComplete="off" />
                </Fg>
                <Fg label="Designation" required error={shownRef('designation')}>
                  <input value={bgv.designation} onChange={(e) => setRef('designation', e.target.value)} autoComplete="off" />
                </Fg>
                <Fg label="Contact number" required error={shownRef('phone') ?? (attempted && bgv.phone.trim() && refProblem ? refProblem : undefined)} hint={india ? 'e.g. +91 98765 43210' : 'e.g. +971 50 123 4567'}>
                  <input type="tel" value={bgv.phone} onChange={(e) => setRef('phone', e.target.value)} autoComplete="off" />
                </Fg>
              </div>
            </section>

            <section className="cr-card jf-sec jf-confirm">
              <h2>Send to HR</h2>
              <p className="cr-sub">
                {savedAt ? `Saved automatically at ${savedAt}. ` : ''}When you press send, our HR team will check your documents and email you the next step.
              </p>
              <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={submit}>
                Send my documents
              </button>
            </section>
          </>
        )}
      </div>
    </CareersFrame>
  );
}
