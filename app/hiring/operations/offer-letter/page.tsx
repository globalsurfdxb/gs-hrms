'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ArrowLeftIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Banner, Fg, fmtDateTime, useActor } from '@/components/hiring/HiringBits';
import { LetterFrame } from '@/components/hiring/LetterFrame';
import {
  LETTER_FIELDS,
  importTemplateFile,
  renderLetter,
  resetLetterSlot,
  sampleLetterValues,
  saveLetterSlot,
  saveSignatory,
  signatoryFor,
  templateFor,
  useLetterState,
} from '@/lib/hiringLetters';

const KNOWN = new Set(LETTER_FIELDS.map((f) => f.key));
const SLOTS = [
  { id: 'Dubai', label: 'United Arab Emirates' },
  { id: 'Kochi', label: 'India' },
];

/** The offer letter template. HR uploads a Word, HTML or text file once; each offer merges it with the candidate's
    details and the result is what the candidate reads, downloads and answers on their link. */
export default function OfferLetterSetupPage() {
  const ls = useLetterState();
  const actor = useActor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState('Dubai');
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const own = ls.slots[slot];
  const active = templateFor(ls, slot);
  const showing = edit ?? active.html;
  const unknown = useMemo(() => [...new Set([...showing.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))].filter((k) => !KNOWN.has(k)), [showing]);
  const previewLocation = slot;
  const preview = useMemo(() => renderLetter(showing, sampleLetterValues(previewLocation, signatoryFor(ls, previewLocation))).html, [showing, previewLocation, ls]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importTemplateFile(file);
      saveLetterSlot(slot, r.html, 'upload', actor.name, file.name);
      setEdit(null);
      setNotice({ text: `${file.name} is now the offer letter for ${SLOTS.find((x) => x.id === slot)?.label.toLowerCase()}. ${r.note} Check the preview below.`, tone: 'info' });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'That file could not be read.', tone: 'warn' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const copy = (key: string) => {
    void navigator.clipboard?.writeText(`{{${key}}}`);
    setNotice({ text: `{{${key}}} copied. Paste it where the letter should show that detail.`, tone: 'info' });
  };

  return (
    <div className="hm-page">
      <Link href="/hiring/operations" className="hub-back">
        <ArrowLeftIcon />
        Back to Operations
      </Link>
      <PageHeader eyebrow="Operations" title="Offer letter" description="Upload the offer letter template. Every offer is merged with the candidate’s details, then shared by an emailed link so the candidate can read it, download it and accept or decline." />
      {notice && <Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Banner>}

      <Card>
        <div className="hm-lt-body">
          <div className="hm-lt-flow" aria-label="How an offer letter reaches the candidate">
            <span>1 · Upload the template</span>→<span>2 · Prepare the letter on the offer</span>→<span>3 · Email the link</span>→<span>4 · Candidate reads and downloads</span>→<span>5 · Accept or decline</span>
          </div>
        </div>
      </Card>

      <div className="hm-lt-grid" style={{ marginTop: 16 }}>
        <Card>
          <CardHeader title="Letter template" sub="One letter for each work location" />
          <div className="hm-lt-slots" role="tablist" aria-label="Location">
            {SLOTS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={slot === x.id}
                className={`hm-lt-slot ${slot === x.id ? 'on' : ''}`}
                onClick={() => {
                  setSlot(x.id);
                  setEdit(null);
                }}
              >
                {x.label}
                {ls.slots[x.id] ? ' ●' : ''}
              </button>
            ))}
          </div>
          <div className="hm-lt-body">
            <div className="hm-lt-meta">
              <span>
                <b>{active.source}</b>
                {own && <> · saved {fmtDateTime(own.updatedAt)} by {own.updatedBy}</>}
              </span>
              <Badge tone={own ? 'active' : 'inactive'}>{own ? (own.source === 'upload' ? 'Uploaded' : 'Edited') : 'Built-in'}</Badge>
            </div>

            <div className="hm-lt-act">
              <input ref={fileRef} type="file" accept=".docx,.html,.htm,.txt,.md" hidden onChange={(e) => void upload(e.target.files?.[0])} />
              <Button variant="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? 'Reading the file…' : own ? 'Upload a new file' : 'Upload template'}
              </Button>
              {edit === null ? (
                <Button onClick={() => setEdit(active.html)}>Edit the text</Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    onClick={() => {
                      saveLetterSlot(slot, edit, 'edited', actor.name, own?.fileName);
                      setEdit(null);
                      setNotice({ text: 'Template saved. New letters use it; letters already prepared keep the text they were prepared with.', tone: 'info' });
                    }}
                  >
                    Save changes
                  </Button>
                  <Button variant="ghost" onClick={() => setEdit(null)}>
                    Cancel
                  </Button>
                </>
              )}
              {own && edit === null && (
                <Button variant="ghost" onClick={() => setResetting(true)}>
                  Back to the built-in letter
                </Button>
              )}
            </div>
            <div className="tx-s faint">Accepted: Word (.docx), HTML and text files up to 5 MB. The India letter of employment is built in already; upload a Word file only to replace it. A PDF cannot be filled in per candidate, so keep the Word version for the template. Put merge fields such as {'{{candidate.fullName}}'} where each detail belongs.</div>

            {edit !== null && (
              <textarea className="hm-lt-code" value={edit} onChange={(e) => setEdit(e.target.value)} spellCheck={false} aria-label="Letter template HTML" />
            )}

            {unknown.length > 0 && (
              <div className="note-box hm-warn" role="status">
                <div>
                  These fields are not recognised and will show as written in every letter: <b>{unknown.map((k) => `{{${k}}}`).join(', ')}</b>. Check the spelling against the field list.
                </div>
              </div>
            )}

            <div>
              <div className="tx-s faint" style={{ marginBottom: 6 }}>
                Preview with sample details
              </div>
              <LetterFrame html={preview} title="Offer letter preview" height={640} location={previewLocation} />
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <CardHeader title="Signatories" sub="Printed at the end of each letter, by work location" />
            <div className="hm-lt-body">
              <SignatoryForm key={`Dubai-${signatoryFor(ls, 'Dubai').name}-${signatoryFor(ls, 'Dubai').title}`} location="Dubai" label="United Arab Emirates" value={signatoryFor(ls, 'Dubai')} onSaved={(t) => setNotice({ text: t, tone: 'info' })} />
              <SignatoryForm key={`Kochi-${signatoryFor(ls, 'Kochi').name}-${signatoryFor(ls, 'Kochi').title}`} location="Kochi" label="India" value={signatoryFor(ls, 'Kochi')} onSaved={(t) => setNotice({ text: t, tone: 'info' })} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Merge fields" sub="Click one to copy it" />
            <div className="hm-lt-fields">
              {LETTER_FIELDS.map((f) => (
                <button key={f.key} type="button" className="hm-lt-field" onClick={() => copy(f.key)} title={`Example: ${f.html ? 'table' : f.sample}`}>
                  <span>{f.label}</span>
                  <code>{`{{${f.key}}}`}</code>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={resetting}
        title="Back to the built-in letter?"
        message={`The uploaded template for ${SLOTS.find((x) => x.id === slot)?.label.toLowerCase()} is removed and the built-in letter is used for new offers. Letters already prepared are not changed.`}
        confirmLabel="Use built-in letter"
        onCancel={() => setResetting(false)}
        onConfirm={() => {
          resetLetterSlot(slot, actor.name);
          setResetting(false);
          setEdit(null);
          setNotice({ text: 'The built-in letter is in use again.', tone: 'info' });
        }}
      />
    </div>
  );
}

function SignatoryForm({ location, label, value, onSaved }: { location: string; label: string; value: { name: string; title: string }; onSaved: (text: string) => void }) {
  const actor = useActor();
  const [sig, setSig] = useState(value);
  const [error, setError] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <b style={{ fontSize: 13 }}>{label}</b>
      <Fg label="Name" required error={error && !sig.name.trim() ? error : ''}>
        <input value={sig.name} onChange={(e) => setSig({ ...sig, name: e.target.value })} />
      </Fg>
      <Fg label="Title" required error={error && !sig.title.trim() ? error : ''}>
        <input value={sig.title} onChange={(e) => setSig({ ...sig, title: e.target.value })} />
      </Fg>
      <div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (!sig.name.trim() || !sig.title.trim()) return setError('Enter the name and title.');
            setError('');
            saveSignatory(location, sig.name, sig.title, actor.name);
            onSaved(`Signatory for ${label} saved. New letters use it.`);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
