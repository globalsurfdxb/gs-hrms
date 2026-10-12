'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { LEARNING_RECORDS } from '@/lib/data';
import { LearningRecord } from '@/lib/types';
import { logTask } from '@/lib/activity';

export const DEFAULT_CATEGORIES = ['Compliance', 'Sales', 'Management', 'Finance', 'Culture', 'Technical', 'Safety', 'Soft Skills'];

interface Course {
  name: string;
  category: string;
}

interface LearningContextValue {
  records: LearningRecord[];
  courses: Course[];
  categories: string[];
  assign: (a: { course: string; category: string; employeeIds: string[]; dueDate: string; assignedOn: string }) => number;
  start: (id: string) => void;
  complete: (id: string, input: { completedOn: string; score?: number; notes: string }) => void;
  reopen: (id: string) => void;
  unassign: (id: string) => void;
}

const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<LearningRecord[]>(LEARNING_RECORDS);

  const value = useMemo<LearningContextValue>(() => {
    const patch = (id: string, fn: (r: LearningRecord) => LearningRecord) => setRecords((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));
    const courses = [...new Map(records.map((r) => [r.course.toLowerCase(), { name: r.course, category: r.category }])).values()];
    return {
      records,
      courses,
      categories: [...new Set([...DEFAULT_CATEGORIES, ...records.map((r) => r.category)])],
      assign: ({ course, category, employeeIds, dueDate, assignedOn }) => {
        const has = new Set(records.filter((r) => r.course.toLowerCase() === course.toLowerCase()).map((r) => r.employeeId));
        const fresh = employeeIds.filter((id) => !has.has(id));
        const stamp = Date.now();
        logTask('Learning', 'Course assigned', course, `${fresh.length} employee${fresh.length === 1 ? '' : 's'}, due ${dueDate}`);
        setRecords((prev) => [
          ...prev,
          ...fresh.map((employeeId, i) => ({ id: `lr-${stamp}-${i}`, employeeId, course, category, status: 'Not Started' as const, dueDate, assignedOn })),
        ]);
        return fresh.length;
      },
      start: (id) => {
        const r = records.find((x) => x.id === id);
        if (r?.status === 'Not Started') logTask('Learning', 'Course started', r.course, 'In progress', { employeeId: r.employeeId });
        patch(id, (x) => (x.status === 'Not Started' ? { ...x, status: 'In Progress' } : x));
      },
      complete: (id, { completedOn, score, notes }) => {
        const r = records.find((x) => x.id === id);
        if (r && r.status !== 'Completed') logTask('Learning', 'Course completed', r.course, `Completed ${completedOn}${score !== undefined ? ` · score ${score}` : ''}`, { employeeId: r.employeeId });
        patch(id, (x) => (x.status === 'Completed' ? x : { ...x, status: 'Completed', completedOn, score, notes: notes.trim() || undefined }));
      },
      reopen: (id) => {
        const r = records.find((x) => x.id === id);
        if (r?.status === 'Completed') logTask('Learning', 'Course reopened', r.course, 'Completed → In progress', { employeeId: r.employeeId });
        patch(id, (x) => (x.status === 'Completed' ? { ...x, status: 'In Progress', completedOn: undefined, score: undefined, notes: undefined } : x));
      },
      unassign: (id) => {
        const r = records.find((x) => x.id === id);
        if (r?.status === 'Not Started') logTask('Learning', 'Course unassigned', r.course, 'Assignment removed', { employeeId: r.employeeId });
        setRecords((prev) => prev.filter((x) => x.id !== id || x.status !== 'Not Started'));
      },
    };
  }, [records]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used within LearningProvider');
  return ctx;
}
