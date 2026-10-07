'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { EXPENSE_CATEGORIES, EXPENSE_CLAIMS, REFERENCE_TODAY } from '@/lib/data';
import { ExpenseCategory, ExpenseClaim } from '@/lib/types';

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
  decide: (id: string, status: 'Approved' | 'Rejected', by: string, note: string) => void;
  withdrawClaim: (id: string) => void;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<ExpenseCategory[]>(EXPENSE_CATEGORIES);
  const [claims, setClaims] = useState<ExpenseClaim[]>(EXPENSE_CLAIMS);

  const value = useMemo<ExpenseContextValue>(
    () => ({
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
      decide: (id, status, by, note) =>
        setClaims((p) => p.map((x) => (x.id === id && x.status === 'Pending' ? { ...x, status, decidedOn: REFERENCE_TODAY, decidedBy: by, note: note.trim() || undefined } : x))),
      withdrawClaim: (id) => setClaims((p) => p.filter((x) => x.id !== id || x.status !== 'Pending')),
    }),
    [categories, claims]
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpense() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpense must be used within ExpenseProvider');
  return ctx;
}
