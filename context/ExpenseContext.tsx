'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { EXPENSE_CATEGORIES, EXPENSE_CLAIMS, REFERENCE_TODAY, employeeById, managerOf } from '@/lib/data';
import { Employee, ExpenseCategory, ExpenseClaim, Role } from '@/lib/types';
import { useApp } from '@/context/AppContext';
import { logAudit } from '@/lib/employeeStore';

/** Where a claim is routed for approval. The General Manager, and anyone with no manager on record, route to Super Admin, never HR. */
export function claimRoute(claimant: Employee): { label: string; seniorOnly: boolean } {
  const mgr = managerOf(claimant);
  if (!mgr || /general manager/i.test(claimant.designation)) return { label: 'Super Admin', seniorOnly: true };
  return { label: mgr.name, seniorOnly: false };
}

/** Who may decide a claim. Nobody decides their own; senior claims need a Super Admin; a Team Lead decides their direct reports'. */
export function canDecideClaim(role: Role, meId: string, claimant: Employee): boolean {
  if (claimant.id === meId) return false;
  if (claimRoute(claimant).seniorOnly) return role === 'Super Admin';
  if (role === 'Super Admin' || role === 'HR' || role === 'Office Admin') return true;
  return role === 'Team Lead' && claimant.reportingManagerId === meId;
}

/** Receipts are required above the category's policy limit, and above this amount for any claim. */
export const RECEIPT_DEFAULT: Record<string, number> = { AED: 200, INR: 2000 };

interface NewClaim {
  employeeId: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  project: string;
  description: string;
  receipt?: string;
}

interface ExpenseContextValue {
  categories: ExpenseCategory[];
  activeCategories: ExpenseCategory[];
  addCategory: (c: Omit<ExpenseCategory, 'id'>) => void;
  updateCategory: (c: ExpenseCategory) => void;
  toggleCategory: (id: string) => void;
  removeCategory: (id: string) => void;
  claims: ExpenseClaim[];
  submitClaim: (c: NewClaim) => string;
  /** Approve or reject a pending claim. Ignored when the signed-in user may not decide it (see canDecide). */
  decide: (id: string, status: 'Approved' | 'Rejected', by: string, note: string) => void;
  /** Whether the signed-in user may decide this claim (never their own). */
  canDecide: (c: ExpenseClaim) => boolean;
  withdrawClaim: (id: string) => void;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const { role, currentEmployeeId } = useApp();
  const [categories, setCategories] = useState<ExpenseCategory[]>(EXPENSE_CATEGORIES);
  const [claims, setClaims] = useState<ExpenseClaim[]>(EXPENSE_CLAIMS);

  const value = useMemo<ExpenseContextValue>(() => {
    const canDecide = (c: ExpenseClaim) => {
      const e = employeeById(c.employeeId);
      return !!e && canDecideClaim(role, currentEmployeeId, e);
    };
    return {
      categories,
      activeCategories: categories.filter((c) => c.active),
      addCategory: (c) => setCategories((p) => [...p, { ...c, id: `cat-${Date.now()}` }]),
      updateCategory: (c) => setCategories((p) => p.map((x) => (x.id === c.id ? c : x))),
      toggleCategory: (id) => setCategories((p) => p.map((x) => (x.id === id ? { ...x, active: !x.active } : x))),
      removeCategory: (id) => setCategories((p) => p.filter((x) => x.id !== id)),
      claims,
      submitClaim: (c) => {
        const id = `exp-${Date.now()}`;
        setClaims((p) => [{ ...c, id, status: 'Pending', submittedOn: REFERENCE_TODAY }, ...p]);
        return id;
      },
      canDecide,
      decide: (id, status, by, note) => {
        const target = claims.find((x) => x.id === id);
        if (!target || target.status !== 'Pending' || !canDecide(target)) return;
        logAudit({ employeeId: `expense:${id}`, field: `Expense claim ${status === 'Approved' ? 'approved' : 'rejected'}`, from: 'Pending', to: status, changedBy: by, module: 'Expense' });
        setClaims((p) => p.map((x) => (x.id === id && x.status === 'Pending' ? { ...x, status, decidedOn: REFERENCE_TODAY, decidedBy: by, note: note.trim() || undefined } : x)));
      },
      withdrawClaim: (id) => {
        const target = claims.find((x) => x.id === id);
        if (!target || target.status !== 'Pending') return;
        logAudit({ employeeId: `expense:${id}`, field: 'Expense claim withdrawn', from: 'Pending', to: 'Withdrawn', changedBy: employeeById(currentEmployeeId)?.name ?? role, module: 'Expense' });
        setClaims((p) => p.filter((x) => x.id !== id || x.status !== 'Pending'));
      },
    };
  }, [categories, claims, role, currentEmployeeId]);

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpense() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpense must be used within ExpenseProvider');
  return ctx;
}
