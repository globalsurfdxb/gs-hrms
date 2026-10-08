'use client';

import { useRef, useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { useDocuments } from '@/context/DocumentsContext';
import { VaultDoc, VaultStatus, stateOfDate, useExpiryVersion, vaultDocsFor } from '@/lib/expiryRegister';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { VaultTile } from '@/components/expiry/VaultTile';
import { DocumentViewer, ViewableDoc, documentNumber } from '@/components/profile/DocumentViewer';
import { CheckIcon, ClockIcon, FileTextIcon, FolderIcon, SearchIcon, UploadIcon, WarnIcon } from '@/components/icons';

type DocFilter = 'all' | Extract<VaultStatus, 'ok' | 'soon' | 'expired'>;

export default function MyFilesPage() {
  const me = useCurrentEmployee();
  const { fileFor, upload } = useDocuments();
  const [viewing, setViewing] = useState<ViewableDoc | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<DocFilter>('all');
  const picker = useRef<HTMLInputElement>(null);

  useExpiryVersion();
  // Dated items come from the shared expiry register; a document is Valid only while it is on file and not expired.
  const docs = vaultDocsFor(me, (n) => !!fileFor(me.id, n));
  const open = (d: VaultDoc) => setViewing({ name: d.type, expiryDate: d.expiry, state: d.expiry ? stateOfDate(d.expiry) : undefined, number: documentNumber(me, d.type), onFile: d.uploaded });
  const count = (s: VaultStatus) => docs.filter((d) => d.status === s).length;

  const needle = q.trim().toLowerCase();
  const shown = docs.filter((d) => (filter === 'all' || d.status === filter) && (!needle || d.type.toLowerCase().includes(needle)));

  return (
    <div>
      <PageHeader eyebrow="My Space" title="My Files" description="Your own documents on file — passport, ID proofs, and certificates." />

      <div className="ss-strip">
        <StatStrip
          items={[
            { label: 'Documents on file', value: docs.length, icon: <FileTextIcon />, tone: 'blue', hint: 'Passport, IDs, certificates' },
            { label: 'Valid', value: count('ok'), icon: <CheckIcon />, tone: 'green' },
            { label: 'Expiring soon', value: count('soon'), icon: <ClockIcon />, tone: 'amber', hint: 'Renew in advance' },
            { label: 'Expired', value: count('expired'), icon: <WarnIcon />, tone: 'red', hint: 'Needs action' },
          ]}
        />
      </div>

      <Card>
        <CardHeader
          title="Document vault"
          sub={`${docs.length} document(s)`}
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
        {!docs.length ? (
          <EmptyState icon={<FolderIcon />} title="No documents yet" description="Upload your passport, ID proofs or certificates to keep them on file." />
        ) : (
          <>
            <div className="tbar">
              <div className="tsearch">
                <SearchIcon />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" />
              </div>
              <FilterChips
                value={filter}
                onChange={setFilter}
                options={[
                  { key: 'all', label: 'All', count: docs.length },
                  { key: 'ok', label: 'Valid', count: count('ok') },
                  { key: 'soon', label: 'Expiring soon', count: count('soon') },
                  { key: 'expired', label: 'Expired', count: count('expired') },
                ]}
              />
            </div>
            <div style={{ padding: 16 }}>
              {shown.length ? (
                <div className="ss-docgrid">
                  {shown.map((d) => (
                    <VaultTile key={d.key} name={d.type} expiryDate={d.expiry} status={d.status} onOpen={() => open(d)} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<SearchIcon />} title="No matches" description="No documents match your search or filter." />
              )}
            </div>
            <div className="ss-foot">
              <span>
                Showing {shown.length} of {docs.length} document(s)
              </span>
              <span>Click a document to view or replace it</span>
            </div>
          </>
        )}
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
