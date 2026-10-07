'use client';

import { useRef, useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { useDocuments } from '@/context/DocumentsContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { ExpiryBadge } from '@/components/ui/Badge';
import { DocumentViewer, ViewableDoc, documentNumber } from '@/components/profile/DocumentViewer';
import { UploadIcon } from '@/components/icons';

export default function MyFilesPage() {
  const me = useCurrentEmployee();
  const { fileFor, upload } = useDocuments();
  const [viewing, setViewing] = useState<ViewableDoc | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const open = (d: (typeof me.documents)[number]) => setViewing({ name: d.type, expiryDate: d.expiryDate, state: d.state, number: documentNumber(me, d.type), onFile: true });

  return (
    <div>
      <PageHeader eyebrow="My Space · Files" title="My Files" description="Your own documents on file — passport, ID proofs, and certificates." />
      <Card>
        <CardHeader
          title="Document vault"
          sub={`${me.documents.length} document(s)`}
          action={
            <button className="chip" onClick={() => picker.current?.click()}>
              <UploadIcon /> Upload
            </button>
          }
        />
        <input
          ref={picker}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) {
              upload(me.id, f.name.replace(/\.[^.]+$/, ''), f);
              setViewing({ name: f.name.replace(/\.[^.]+$/, ''), onFile: true });
            }
            ev.target.value = '';
          }}
        />
        <div className="g3" style={{ padding: 16 }}>
          {me.documents.map((d) => (
            <div
              key={d.id}
              className="doc clickable"
              role="button"
              tabIndex={0}
              onClick={() => open(d)}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), open(d))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 12px' }}
            >
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>{d.type}</div>
                {d.expiryDate && <div style={{ fontSize: 11, color: 'var(--faint)' }}>Expires {d.expiryDate}</div>}
              </div>
              <ExpiryBadge state={d.state} />
            </div>
          ))}
        </div>
      </Card>
      <DocumentViewer
        employee={me}
        doc={viewing ? { ...viewing, onFile: viewing.onFile || !!fileFor(me.id, viewing.name) } : null}
        file={viewing ? fileFor(me.id, viewing.name) : undefined}
        onUpload={(name, file) => upload(me.id, name, file)}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
