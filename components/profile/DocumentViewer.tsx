'use client';

import { useRef, useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Badge, ExpiryBadge } from '@/components/ui/Badge';
import { DownloadIcon, UploadIcon } from '@/components/icons';
import { Employee, ExpiryState } from '@/lib/types';

export interface UploadedFile {
  name: string;
  url: string;
  mime: string;
  size: number;
  uploadedOn: string;
}

export interface ViewableDoc {
  /** Display name, also the key uploads are stored under. */
  name: string;
  expiryDate?: string;
  state?: ExpiryState;
  /** Document / ID number when the profile holds one. */
  number?: string;
  /** Whether a file is on record (uploaded in the system or in this session). */
  onFile: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** ID number held on the profile for a document, where there is one. */
export function documentNumber(e: Employee, name: string): string | undefined {
  const p = e.profile;
  const n = name.toLowerCase();
  if (n.includes('passport') && !n.includes('photo') && !n.includes('size')) return p.passportNumber;
  if (n.includes('aadhaar')) return p.aadhaar;
  if (n.includes('pan')) return p.pan;
  return undefined;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function specimenHtml(e: Employee, d: ViewableDoc) {
  const rows = [
    ['Document', d.name],
    ['Holder', e.name],
    ['Employee ID', e.employeeCode],
    ['Company', e.company],
    ...(d.number ? [['Document number', d.number]] : []),
    ...(d.expiryDate ? [['Expiry date', d.expiryDate]] : []),
  ];
  return `<!doctype html><meta charset="utf-8"><title>${esc(d.name)} · ${esc(e.employeeCode)}</title>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;color:#1f2937">
<h2 style="margin:0 0 4px">${esc(d.name)}</h2><p style="color:#6b7280;margin:0 0 20px">GSIT document record — copy on file</p>
<table style="width:100%;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:40%">${esc(k)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">${esc(v)}</td></tr>`).join('')}</table></body>`;
}

export function DocumentViewer({
  employee,
  doc,
  file,
  onUpload,
  onClose,
}: {
  employee: Employee;
  doc: ViewableDoc | null;
  file?: UploadedFile;
  onUpload: (name: string, f: File) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  // Keep the last document while the drawer slides closed so the content doesn't blank mid-animation.
  const [last, setLast] = useState<ViewableDoc | null>(doc);
  if (doc && doc !== last) setLast(doc);
  const d = doc ?? last;

  const pick = (list: FileList | null) => {
    const f = list?.[0];
    if (!f || !d) return;
    if (!/^image\//.test(f.type) && f.type !== 'application/pdf') return setError('Upload a PDF or an image (PNG, JPG).');
    if (f.size > MAX_BYTES) return setError('File is larger than 10 MB.');
    setError('');
    onUpload(d.name, f);
  };

  const download = () => {
    if (!d) return;
    const a = document.createElement('a');
    if (file) {
      a.href = file.url;
      a.download = file.name;
    } else {
      const url = URL.createObjectURL(new Blob([specimenHtml(employee, d)], { type: 'text/html' }));
      a.href = url;
      a.download = `${employee.employeeCode}-${d.name.replace(/[^\w]+/g, '-')}.html`;
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    a.click();
  };

  const status = d?.state ? <ExpiryBadge state={d.state} /> : <Badge tone={d?.onFile ? 'active' : 'pending'}>{d?.onFile ? 'Uploaded' : 'Pending'}</Badge>;

  return (
    <Drawer
      open={!!doc}
      onClose={() => {
        setError('');
        onClose();
      }}
      title={d?.name ?? 'Document'}
      description={`${employee.name} · ${employee.employeeCode}`}
      footer={
        <>
          <button className="chip" onClick={() => input.current?.click()}>
            <UploadIcon /> {d?.onFile ? 'Replace file' : 'Upload file'}
          </button>
          {d?.onFile && (
            <button className="chip" onClick={download}>
              <DownloadIcon /> Download
            </button>
          )}
          <input ref={input} type="file" accept="application/pdf,image/*" hidden onChange={(ev) => { pick(ev.target.files); ev.target.value = ''; }} />
        </>
      }
    >
      {d && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {status}
            {file && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {file.name} · {kb(file.size)} · added {file.uploadedOn}
              </span>
            )}
          </div>
          {error && <div style={{ color: 'var(--danger, #b91c1c)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#f8fafc', minHeight: 260 }}>
            {file && file.mime.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.url} alt={d.name} style={{ display: 'block', width: '100%', height: 'auto' }} />
            ) : file ? (
              <iframe src={file.url} title={d.name} style={{ display: 'block', width: '100%', height: 480, border: 0 }} />
            ) : d.onFile ? (
              <div style={{ padding: 22 }}>
                <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--faint)' }}>Copy on file</div>
                <div style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 14px' }}>{d.name}</div>
                {[
                  ['Holder', employee.name],
                  ['Employee ID', employee.employeeCode],
                  ['Company', employee.company],
                  ...(d.number ? [['Document number', d.number]] : []),
                  ...(d.expiryDate ? [['Expiry date', d.expiryDate]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="field">
                    <span className="k">{k}</span>
                    <span className="v">{v}</span>
                  </div>
                ))}
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>The scanned copy is held by HR. Upload a file to preview it here.</p>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>Not uploaded yet</div>
                <div style={{ fontSize: 13 }}>Use “Upload file” to add a PDF or image of this document.</div>
              </div>
            )}
          </div>

          {file && (d.number || d.expiryDate) && (
            <div style={{ marginTop: 16 }}>
              {d.number && (
                <div className="field">
                  <span className="k">Document number</span>
                  <span className="v">{d.number}</span>
                </div>
              )}
              {d.expiryDate && (
                <div className="field">
                  <span className="k">Expiry date</span>
                  <span className="v">{d.expiryDate}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
