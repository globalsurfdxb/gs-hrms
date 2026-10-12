'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ArrowLeftIcon, FileTextIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { Banner, Fg, TEXTAREA_STYLE, fmtDate, useActor } from '@/components/hiring/HiringBits';
import {
  ATTACHMENT_OPTIONS,
  DEFAULT_TEMPLATES,
  EmailTemplate,
  MERGE_FIELDS,
  TEMPLATE_CATEGORIES,
  TemplateCategory,
  deleteTemplate,
  renderText,
  resetTemplate,
  sampleValues,
  saveTemplate,
  useHiringMail,
} from '@/lib/hiringMail';

const LOCATIONS = [
  { id: 'Both', label: 'Both locations' },
  { id: 'Dubai', label: 'United Arab Emirates' },
  { id: 'Kochi', label: 'India' },
];
const locLabel = (id: string) => LOCATIONS.find((l) => l.id === id)?.label ?? id;

interface Draft {
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  location: string;
  attachments: string[];
}
const blank = (): Draft => ({ name: '', category: 'Other', subject: '', body: '', location: 'Both', attachments: [] });

export default function TemplatesPage() {
  const mail = useHiringMail();
  const actor = useActor();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'All' | TemplateCategory>('All');
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [removing, setRemoving] = useState<EmailTemplate | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);

  const needle = q.trim().toLowerCase();
  const rows = mail.templates.filter((t) => (cat === 'All' || t.category === cat) && (!needle || `${t.name} ${t.subject}`.toLowerCase().includes(needle)));
  const usedBy = (id: string) => mail.rules.filter((r) => r.templateId === id && r.mode !== 'off').map((r) => r.key);

  const open = (t: EmailTemplate) => setEditing({ id: t.id, draft: { name: t.name, category: t.category, subject: t.subject, body: t.body, location: t.location, attachments: t.attachments } });

  return (
    <div className="hm-page">
      <Link href="/hiring/operations" className="hub-back">
        <ArrowLeftIcon />
        Back to Operations
      </Link>
      <PageHeader
        eyebrow="Operations"
        title="Email templates"
        description="The emails the hiring team sends to candidates. Merge fields such as {{candidate.firstName}} are filled in for each candidate."
        actions={
          <Button variant="primary" onClick={() => setEditing({ id: null, draft: blank() })}>
            <PlusIcon /> New template
          </Button>
        }
      />
      {notice && <Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Banner>}

      <Card>
        <CardHeader title="All templates" sub={`${rows.length} of ${mail.templates.length}`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or subject…" />
          </div>
          {(['All', ...TEMPLATE_CATEGORIES] as const).map((c) => (
            <button key={c} type="button" className={`chip ${cat === c ? 'tx-chip-on' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        {!rows.length ? (
          <EmptyState icon={<FileTextIcon />} title="No templates match" description="Try a different search or category." />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Sent when</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const used = usedBy(t.id);
                  return (
                    <tr key={t.id}>
                      <td>
                        <button type="button" className="hm-linkbtn" onClick={() => open(t)}>
                          <b>{t.name}</b>
                          <span className="tx-s faint">{t.subject}</span>
                        </button>
                      </td>
                      <td>{t.category}</td>
                      <td>{locLabel(t.location)}</td>
                      <td>{used.length ? used.join(', ') : <span className="faint">Manual use only</span>}</td>
                      <td className="mono">
                        {t.updatedAt ? fmtDate(t.updatedAt) : 'Built in'}
                        {t.updatedBy && t.updatedAt && <div className="tx-s faint">{t.updatedBy}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="hm-rowact">
                          <Button size="sm" variant="primary" onClick={() => open(t)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const copy = saveTemplate(null, { name: `${t.name} (copy)`, category: t.category, subject: t.subject, body: t.body, location: t.location, attachments: t.attachments }, actor.name);
                              setNotice({ text: `Duplicated as “${copy.name}”.`, tone: 'info' });
                            }}
                          >
                            Duplicate
                          </Button>
                          {!t.system && (
                            <Button size="sm" variant="ghost" onClick={() => setRemoving(t)}>
                              Delete
                            </Button>
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
          <span>Built-in templates can be edited and reset to their original wording but not deleted.</span>
        </div>
      </Card>

      {editing && (
        <TemplateEditor
          key={editing.id ?? 'new'}
          id={editing.id}
          initial={editing.draft}
          onClose={() => setEditing(null)}
          onSaved={(t, isNew) => {
            setEditing(null);
            setNotice({ text: isNew ? `Template “${t.name}” created.` : `Template “${t.name}” saved.`, tone: 'info' });
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        danger
        title="Delete template?"
        message={`“${removing?.name}” will be removed. Emails already sent are not affected.`}
        confirmLabel="Delete"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            const r = deleteTemplate(removing.id, actor.name);
            setNotice({ text: r.ok ? `Template “${removing.name}” deleted.` : (r.error ?? 'Could not delete.'), tone: r.ok ? 'info' : 'warn' });
          }
          setRemoving(null);
        }}
      />
    </div>
  );
}

function TemplateEditor({ id, initial, onClose, onSaved }: { id: string | null; initial: Draft; onClose: () => void; onSaved: (t: EmailTemplate, isNew: boolean) => void }) {
  const actor = useActor();
  const mail = useHiringMail();
  const [v, setV] = useState<Draft>(initial);
  const [attempted, setAttempted] = useState(false);
  const [target, setTarget] = useState<'subject' | 'body'>('body');
  const subj = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const t = id ? mail.templates.find((x) => x.id === id) : undefined;
  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => setV((p) => ({ ...p, [k]: val }));

  const known = new Set(MERGE_FIELDS.map((f) => f.key));
  const used = [...new Set([...`${v.subject}\n${v.body}`.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
  const unknown = used.filter((k) => !known.has(k));

  const errors: Record<string, string> = {};
  if (!v.name.trim()) errors.name = 'Name the template.';
  else if (mail.templates.some((x) => x.id !== id && x.name.toLowerCase() === v.name.trim().toLowerCase())) errors.name = 'Another template already has this name.';
  if (!v.subject.trim()) errors.subject = 'Add a subject.';
  if (!v.body.trim()) errors.body = 'Write the message.';
  if (unknown.length) errors.body = `Unknown merge field${unknown.length === 1 ? '' : 's'}: ${unknown.map((k) => `{{${k}}}`).join(', ')}.`;
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const insert = (key: string) => {
    const token = `{{${key}}}`;
    if (target === 'subject' && subj.current) {
      const el = subj.current;
      const a = el.selectionStart ?? v.subject.length;
      const b = el.selectionEnd ?? a;
      set('subject', v.subject.slice(0, a) + token + v.subject.slice(b));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(a + token.length, a + token.length);
      }, 0);
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const a = el.selectionStart ?? v.body.length;
      const b = el.selectionEnd ?? a;
      set('body', v.body.slice(0, a) + token + v.body.slice(b));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(a + token.length, a + token.length);
      }, 0);
    }
  };

  const save = () => {
    setAttempted(true);
    if (Object.keys(errors).length) return;
    const saved = saveTemplate(id, { ...v, name: v.name.trim(), subject: v.subject.trim() }, actor.name);
    onSaved(saved, !id);
  };

  const sample = sampleValues();
  const prevSubject = renderText(v.subject, sample).text;
  const prevBody = renderText(v.body, sample).text;
  const original = id ? DEFAULT_TEMPLATES.find((x) => x.id === id) : undefined;
  const changed = !!original && (original.subject !== v.subject || original.body !== v.body);

  return (
    <Drawer
      open
      onClose={onClose}
      title={id ? `Edit “${t?.name ?? ''}”` : 'New template'}
      description={t?.system ? 'Built-in template. You can change the wording and reset it later.' : 'Merge fields are filled in for each candidate when the email is sent.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {original && (
            <Button
              onClick={() => {
                resetTemplate(id as string, actor.name);
                setV({ name: original.name, category: original.category, subject: original.subject, body: original.body, location: original.location, attachments: original.attachments });
              }}
              disabled={!changed && t?.subject === original.subject && t?.body === original.body}
            >
              Reset to original
            </Button>
          )}
          <Button variant="primary" onClick={save}>
            Save template
          </Button>
        </>
      }
    >
      <div className="form-grid hm-form">
        <Fg label="Template name" required error={shown('name')}>
          <input value={v.name} onChange={(e) => set('name', e.target.value)} />
        </Fg>
        <Fg label="Category">
          <select value={v.category} onChange={(e) => set('category', e.target.value as TemplateCategory)}>
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Fg>
        <Fg label="Location" hint="Used for candidates in this location.">
          <select value={v.location} onChange={(e) => set('location', e.target.value)}>
            {LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Fg>
        <Fg label="Default attachments" hint="Attached when a mail server is connected.">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value && !v.attachments.includes(e.target.value)) set('attachments', [...v.attachments, e.target.value]);
            }}
          >
            <option value="">Add an attachment…</option>
            {ATTACHMENT_OPTIONS.filter((a) => !v.attachments.includes(a)).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Fg>
        {v.attachments.length > 0 && (
          <div className="fg full">
            <div className="hm-chips" style={{ marginTop: 0 }}>
              {v.attachments.map((a) => (
                <span key={a} className="hm-chip">
                  {a}
                  <button type="button" aria-label={`Remove ${a}`} onClick={() => set('attachments', v.attachments.filter((x) => x !== a))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <Fg label="Subject" required error={shown('subject')} full>
          <input ref={subj} value={v.subject} onFocus={() => setTarget('subject')} onChange={(e) => set('subject', e.target.value)} />
        </Fg>
        <Fg label="Message" required error={shown('body')} full>
          <textarea ref={bodyRef} rows={12} value={v.body} onFocus={() => setTarget('body')} onChange={(e) => set('body', e.target.value)} style={TEXTAREA_STYLE} />
        </Fg>
        <div className="fg full">
          <label>Insert a merge field into the {target}</label>
          <div className="hm-fields">
            {MERGE_FIELDS.map((f) => (
              <button key={f.key} type="button" title={`${f.label}, for example “${f.sample}”`} onClick={() => insert(f.key)}>
                {`{{${f.key}}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="fg full">
          <label>Preview with sample details</label>
          <div className="hm-mail-prev">
            <div className="hm-mail-row">
              <span>Subject</span>
              {prevSubject || '—'}
            </div>
            <pre>{prevBody || 'Your message appears here.'}</pre>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
