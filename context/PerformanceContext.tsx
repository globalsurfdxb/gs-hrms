'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { PERFORMANCE_CYCLE, PERFORMANCE_REVIEWS, REFERENCE_TODAY } from '@/lib/data';
import { PerformanceReview } from '@/lib/types';

interface PerformanceContextValue {
  reviews: PerformanceReview[];
  cycles: string[];
  createCycle: (c: { cycle: string; employeeIds: string[]; dueDate: string }) => number;
  startReview: (id: string) => void;
  submitSelf: (id: string, input: { rating: number; comments: string }) => void;
  completeReview: (id: string, input: { rating: number; comments: string; goals: string }) => void;
  removeReview: (id: string) => void;
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const [reviews, setReviews] = useState<PerformanceReview[]>(PERFORMANCE_REVIEWS);

  const value = useMemo<PerformanceContextValue>(() => {
    const patch = (id: string, fn: (r: PerformanceReview) => PerformanceReview) => setReviews((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));
    return {
      reviews,
      cycles: [...new Set([PERFORMANCE_CYCLE, ...reviews.map((r) => r.cycle)])],
      createCycle: ({ cycle, employeeIds, dueDate }) => {
        const existing = new Set(reviews.filter((r) => r.cycle === cycle).map((r) => r.employeeId));
        const fresh = employeeIds.filter((id) => !existing.has(id));
        const stamp = Date.now();
        setReviews((prev) => [
          ...prev,
          ...fresh.map((employeeId, i) => ({ id: `pr-${stamp}-${i}`, employeeId, cycle, status: 'Not Started' as const, rating: null, dueDate })),
        ]);
        return fresh.length;
      },
      startReview: (id) => patch(id, (r) => (r.status === 'Not Started' ? { ...r, status: 'Self Assessment' } : r)),
      submitSelf: (id, { rating, comments }) =>
        patch(id, (r) => (r.status === 'Self Assessment' ? { ...r, status: 'Manager Review', selfRating: rating, selfComments: comments.trim() } : r)),
      completeReview: (id, { rating, comments, goals }) =>
        patch(id, (r) =>
          r.status === 'Manager Review'
            ? { ...r, status: 'Completed', rating, managerComments: comments.trim(), goals: goals.trim(), completedOn: REFERENCE_TODAY }
            : r
        ),
      removeReview: (id) => setReviews((prev) => prev.filter((r) => r.id !== id || r.status !== 'Not Started')),
    };
  }, [reviews]);

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

export function usePerformance() {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error('usePerformance must be used within PerformanceProvider');
  return ctx;
}
