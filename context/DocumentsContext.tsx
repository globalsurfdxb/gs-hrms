'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { REFERENCE_TODAY } from '@/lib/data';
import type { UploadedFile } from '@/components/profile/DocumentViewer';

interface DocumentsContextValue {
  fileFor: (employeeId: string, name: string) => UploadedFile | undefined;
  upload: (employeeId: string, name: string, file: File) => void;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

/** Files uploaded this session, keyed by employee + document name (shared by profile, My Files and Documents). */
export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<Record<string, UploadedFile>>({});

  const fileFor = useCallback((employeeId: string, name: string) => files[`${employeeId}:${name}`], [files]);
  const upload = useCallback((employeeId: string, name: string, file: File) => {
    const key = `${employeeId}:${name}`;
    const entry: UploadedFile = { name: file.name, url: URL.createObjectURL(file), mime: file.type, size: file.size, uploadedOn: REFERENCE_TODAY };
    setFiles((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key].url);
      return { ...prev, [key]: entry };
    });
  }, []);

  const value = useMemo(() => ({ fileFor, upload }), [fileFor, upload]);
  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentsProvider');
  return ctx;
}
