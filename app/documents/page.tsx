'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { EMPLOYEES, matchesEmployee } from '@/lib/data';
import { Employee } from '@/lib/types';
import { VaultDoc, VaultStatus, stateOfDate, useExpiryVersion, vaultDocsFor } from '@/lib/expiryRegister';
import { useDocuments } from '@/context/DocumentsContext';
import { DocumentViewer, ViewableDoc, documentNumber } from '@/components/profile/DocumentViewer';
import { VaultTile } from '@/components/expiry/VaultTile';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { FileTextIcon, FolderIcon, PeopleIcon, SearchIcon, UploadIcon, WarnIcon, ClockIcon } from '@/components/icons';

type DocFilter = 'all' | Extract<VaultStatus, 'ok' | 'soon' | 'expired'>;

export default function DocumentsPage() {
  const { location } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<DocFilter>('all');
  const [viewing, setViewing] = useState<{ emp: Employee; doc: ViewableDoc } | null>(null);
  const { fileFor, upload } = useDocuments();
  const picker = useRef<HTMLInputElement>(null);
  const pickFor = useRef<Employee | null>(null);

  useExpiryVersion();

  // Every document comes from the shared expiry register (dated items) plus the undated ones on the record.
  // A document shows Valid only while it is on file and not expired.
  const inLocation = EMPLOYEES.filter((e) => e.location === location);
  const vault = inLocation.map((e) => ({ e, docs: vaultDocsFor(e, (n) => !!fileFor(e.id, n)) }));
  const allDocs = vault.flatMap((v) => v.docs);
  const count = (s: VaultStatus) => allDocs.filter((d) => d.status === s).length;
  const onFile = allDocs.filter((d) => d.uploaded).length;

  // Apply the search, then the state filter (which also trims each employee's documents to the matching ones).
  const rows = vault
    .filter((v) => matchesEmployee(v.e, q))
    .map((v) => ({ e: v.e, total: v.docs.length, docs: filter === 'all' ? v.docs : v.docs.filter((d) => d.status === filter) }))
    .filter((r) => filter === 'all' || r.docs.length > 0);
  const shownDocs = rows.reduce((n, r) => n + r.docs.length, 0);

  const openDoc = (emp: Employee, d: VaultDoc) =>
    setViewing({ emp, doc: { name: d.type, expiryDate: d.expiry, state: d.expiry ? stateOfDate(d.expiry) : undefined, number: documentNumber(emp, d.type), onFile: d.uploaded } });

  return (
    <div>
      <PageHeader eyebrow="Organization" title="Employee Documents" description={`Per-employee document storage — ID proofs, contracts and certificates — with expiry tagging, for ${location}.`} />

      <div className="ss-strip">
        <StatStrip
          items={[
            { label: 'Employees', value: inLocation.length, icon: <PeopleIcon />, tone: 'blue', hint: `${location} office` },
            { label: 'Documents on file', value: onFile, icon: <FileTextIcon />, tone: 'purple', hint: `${count('ok')} valid · ${allDocs.length - onFile} pending upload` },
            { label: 'Expiring soon', value: count('soon'), icon: <ClockIcon />, tone: 'amber', hint: 'Renew in advance' },
            { label: 'Expired', value: count('expired'), icon: <WarnIcon />, tone: 'red', hint: 'Needs action' },
          ]}
        />
      </div>

      <Card>
        <CardHeader title="Document vault" sub={`${allDocs.length} document(s) across ${inLocation.length} ${location} employee(s)`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'All', count: allDocs.length },
              { key: 'ok', label: 'Valid', count: count('ok') },
              { key: 'soon', label: 'Expiring soon', count: count('soon') },
              { key: 'expired', label: 'Expired', count: count('expired') },
            ]}
          />
        </div>

        {!rows.length && <EmptyState icon={<FolderIcon />} title="No records" description={q || filter !== 'all' ? 'No employees or documents match these filters.' : `No employees found for ${location}.`} />}

        {rows.map(({ e, docs, total }) => (
          <div key={e.id} className="ss-group">
            <div className="ss-ghead">
              <Link href={`/directory/${e.employeeCode}`} className="ss-gp">
                <span className="ss-ic av">{e.avatarInitials}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="ss-gn">{e.name}</div>
                  <div className="ss-gs">
                    {e.employeeCode} · {e.designation}
                  </div>
                </div>
              </Link>
              <div className="ss-gtags">
                <span className="ss-tag alt">{total} document(s)</span>
                <button
                  className="chip"
                  onClick={() => {
                    pickFor.current = e;
                    picker.current?.click();
                  }}
                >
                  <UploadIcon /> Upload
                </button>
              </div>
            </div>
            {docs.length ? (
              <div className="ss-docgrid">
                {docs.map((d) => (
                  <VaultTile key={d.key} name={d.type} expiryDate={d.expiry} status={d.status} onOpen={() => openDoc(e, d)} />
                ))}
              </div>
            ) : (
              <div className="ss-none">No documents on file yet.</div>
            )}
          </div>
        ))}

        <div className="ss-foot">
          <span>
            Showing {rows.length} of {inLocation.length} employee(s) · {shownDocs} document(s)
          </span>
          <span>Click a document to view or replace it</span>
        </div>
      </Card>
      <input
        ref={picker}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          const emp = pickFor.current;
          if (f && emp) {
            const name = f.name.replace(/\.[^.]+$/, '');
            upload(emp.id, name, f);
            setViewing({ emp, doc: { name, onFile: true } });
          }
          ev.target.value = '';
        }}
      />
      {viewing && (
        <DocumentViewer
          employee={viewing.emp}
          doc={{ ...viewing.doc, onFile: viewing.doc.onFile || !!fileFor(viewing.emp.id, viewing.doc.name) }}
          file={fileFor(viewing.emp.id, viewing.doc.name)}
          onUpload={(name, file) => upload(viewing.emp.id, name, file)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
