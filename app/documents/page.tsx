'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { EMPLOYEES, matchesEmployee } from '@/lib/data';
import { Employee } from '@/lib/types';
import { useDocuments } from '@/context/DocumentsContext';
import { DocumentViewer, ViewableDoc, documentNumber } from '@/components/profile/DocumentViewer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ExpiryBadge } from '@/components/ui/Badge';
import { FolderIcon, SearchIcon, UploadIcon } from '@/components/icons';

export default function DocumentsPage() {
  const { location } = useApp();
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<{ emp: Employee; doc: ViewableDoc } | null>(null);
  const { fileFor, upload } = useDocuments();
  const picker = useRef<HTMLInputElement>(null);
  const pickFor = useRef<Employee | null>(null);

  const scoped = EMPLOYEES.filter((e) => e.location === location && matchesEmployee(e, q));
  const totalDocs = scoped.reduce((n, e) => n + e.documents.length, 0);

  return (
    <div>
      <PageHeader eyebrow="Module 05 · Files" title="Employee Documents" description={`Per-employee document storage — ID proofs, contracts and certificates — with expiry tagging, for ${location}.`} />

      <Card>
        <CardHeader title="Document vault" sub={`${totalDocs} document(s) across ${scoped.length} ${location} employee(s)`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
        </div>

        {!scoped.length && <EmptyState icon={<FolderIcon />} title="No records" description="No employees match this search." />}

        {scoped.map((e) => (
          <div key={e.id} style={{ padding: '14px 16px', borderTop: '1px solid var(--border-soft)' }}>
            <div className="person" style={{ marginBottom: 10 }}>
              <Link href={`/directory/${e.employeeCode}`} className="person">
                <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                  {e.avatarInitials}
                </div>
                <div>
                  <div className="nm">{e.name}</div>
                  <div className="sb">{e.employeeCode}</div>
                </div>
              </Link>
              <button
                className="chip"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  pickFor.current = e;
                  picker.current?.click();
                }}
              >
                <UploadIcon /> Upload
              </button>
            </div>
            <div className="g3">
              {e.documents.map((d) => (
                <div
                  key={d.id}
                  className="doc clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewing({ emp: e, doc: { name: d.type, expiryDate: d.expiryDate, state: d.state, number: documentNumber(e, d.type), onFile: true } })}
                  onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), setViewing({ emp: e, doc: { name: d.type, expiryDate: d.expiryDate, state: d.state, number: documentNumber(e, d.type), onFile: true } }))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 12px' }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>{d.type}</div>
                    {d.expiryDate && <div style={{ fontSize: 11, color: 'var(--faint)' }}>Expires {d.expiryDate}</div>}
                  </div>
                  <ExpiryBadge state={d.state} />
                </div>
              ))}
            </div>
          </div>
        ))}
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
            const name = f.name.replace(/.[^.]+$/, '');
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
