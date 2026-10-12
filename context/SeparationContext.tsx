'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { ASSETS, OFFBOARDING_REQUESTS, employeeById } from '@/lib/data';
import { Employee, EmploymentStatus, OffboardingRequest } from '@/lib/types';
import { logTask } from '@/lib/activity';

export const ASSET_ITEM = 'All company assets returned';
export const CLEARANCE_ITEMS = ['Knowledge handover', ASSET_ITEM, 'Access revoked', 'Finance clearance', 'HR exit interview'];

interface NewCase {
  employeeId: string;
  reason: string;
  resignationDate: string;
  noticeDays: number;
  lastWorkingDay: string;
  notes: string;
}

interface SeparationContextValue {
  cases: OffboardingRequest[];
  startCase: (c: NewCase) => void;
  toggleClearance: (caseId: string, index: number) => void;
  toggleAsset: (caseId: string, assetId: string) => void;
  completeCase: (caseId: string) => void;
  withdrawCase: (caseId: string) => void;
  statusOf: (e: Employee) => EmploymentStatus;
  isAssetReturned: (assetId: string) => boolean;
  assignedAssets: (employeeId: string) => typeof ASSETS;
}

const SeparationContext = createContext<SeparationContextValue | null>(null);

const statusFor = (clearance: OffboardingRequest['clearance']): OffboardingRequest['status'] => (clearance.every((c) => c.done) ? 'Pending Approval' : 'Clearance Pending');

export function SeparationProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = useState<OffboardingRequest[]>(OFFBOARDING_REQUESTS);

  const value = useMemo<SeparationContextValue>(
    () => ({
      cases,
      startCase: (c) => {
        const emp = employeeById(c.employeeId);
        logTask('Offboarding', 'Offboarding case started', c.employeeId, `${c.reason} · last working day ${c.lastWorkingDay}`, { employeeId: c.employeeId });
        const assets = ASSETS.filter((a) => emp && a.assignedTo === emp.employeeCode && a.status !== 'Returned').map((a) => ({ assetId: a.id, returned: false }));
        setCases((prev) => [
          {
            id: `off-${Date.now()}`,
            employeeId: c.employeeId,
            reason: c.reason,
            resignationDate: c.resignationDate,
            lastWorkingDay: c.lastWorkingDay,
            noticeDays: c.noticeDays,
            notes: c.notes.trim() || undefined,
            assets,
            clearance: CLEARANCE_ITEMS.map((item) => ({ item, done: item === ASSET_ITEM ? assets.length === 0 : false })),
            status: 'Clearance Pending',
          },
          ...prev,
        ]);
      },
      toggleClearance: (caseId, index) => {
        const t = cases.find((r) => r.id === caseId);
        const it = t?.clearance[index];
        if (t && it && t.status !== 'Completed' && it.item !== ASSET_ITEM) logTask('Offboarding', it.done ? 'Clearance reopened' : 'Clearance completed', t.employeeId, it.item, { employeeId: t.employeeId });
        setCases((prev) =>
          prev.map((r) => {
            if (r.id !== caseId || r.status === 'Completed' || r.clearance[index]?.item === ASSET_ITEM) return r;
            const clearance = r.clearance.map((c, i) => (i === index ? { ...c, done: !c.done } : c));
            return { ...r, clearance, status: statusFor(clearance) };
          })
        );
      },
      toggleAsset: (caseId, assetId) => {
        const t = cases.find((r) => r.id === caseId);
        const a = t?.assets?.find((x) => x.assetId === assetId);
        if (t && a && t.status !== 'Completed') logTask('Offboarding', a.returned ? 'Asset return reversed' : 'Asset returned', t.employeeId, ASSETS.find((x) => x.id === assetId)?.name ?? assetId, { employeeId: t.employeeId });
        setCases((prev) =>
          prev.map((r) => {
            if (r.id !== caseId || r.status === 'Completed') return r;
            const assets = (r.assets ?? []).map((a) => (a.assetId === assetId ? { ...a, returned: !a.returned } : a));
            const allBack = assets.every((a) => a.returned);
            const clearance = r.clearance.map((c) => (c.item === ASSET_ITEM ? { ...c, done: allBack } : c));
            return { ...r, assets, clearance, status: statusFor(clearance) };
          })
        );
      },
      completeCase: (caseId) => {
        const t = cases.find((r) => r.id === caseId);
        if (t && t.clearance.every((c) => c.done) && (t.assets ?? []).every((a) => a.returned) && t.status !== 'Completed') logTask('Offboarding', 'Offboarding completed', t.employeeId, 'All clearances done; employee marked inactive', { employeeId: t.employeeId });
        setCases((prev) =>
          prev.map((r) => (r.id === caseId && r.clearance.every((c) => c.done) && (r.assets ?? []).every((a) => a.returned) ? { ...r, status: 'Completed' } : r))
        );
      },
      withdrawCase: (caseId) => {
        const t = cases.find((r) => r.id === caseId);
        if (t && t.status !== 'Completed') logTask('Offboarding', 'Offboarding case withdrawn', t.employeeId, 'Case removed', { employeeId: t.employeeId });
        setCases((prev) => prev.filter((r) => r.id !== caseId || r.status === 'Completed'));
      },
      statusOf: (e) => {
        const mine = cases.filter((r) => r.employeeId === e.id);
        if (mine.some((r) => r.status === 'Completed')) return 'Inactive';
        if (mine.length) return 'Offboarding';
        return e.employmentStatus;
      },
      isAssetReturned: (assetId) => cases.some((r) => r.assets?.some((a) => a.assetId === assetId && a.returned)),
      assignedAssets: (employeeId) => {
        const emp = employeeById(employeeId);
        return ASSETS.filter((a) => emp && a.assignedTo === emp.employeeCode && a.status !== 'Returned');
      },
    }),
    [cases]
  );

  return <SeparationContext.Provider value={value}>{children}</SeparationContext.Provider>;
}

export function useSeparation() {
  const ctx = useContext(SeparationContext);
  if (!ctx) throw new Error('useSeparation must be used within SeparationProvider');
  return ctx;
}
