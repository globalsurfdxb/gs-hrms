'use client';

import { useMemo } from 'react';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { hiringLevel } from '@/lib/hiringAccess';
import { useHiringLocation } from '@/components/hiring/HiringBits';
import { useHiring, visibleJobs, visibleRequisitions } from '@/lib/hiringStore';

/** Hiring data for the signed-in person, narrowed to the chosen location. HR and administrators see everything in
    the location; a hiring manager sees only their own requisitions and jobs, and the candidates, interviews and offers on them. */
export function useScoped() {
  const s = useHiring();
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { loc, currency } = useHiringLocation();
  const level = hiringLevel(role);

  return useMemo(() => {
    const jobs = visibleJobs(s, level, me.id).filter((j) => j.location === loc);
    const jobIds = new Set(jobs.map((j) => j.id));
    const requisitions = visibleRequisitions(s, level, me.id).filter((r) => r.location === loc);
    const applications = s.applications.filter((a) => jobIds.has(a.jobId));
    const appIds = new Set(applications.map((a) => a.id));
    const interviews = s.interviews.filter((i) => appIds.has(i.applicationId));
    const offers = s.offers.filter((o) => appIds.has(o.applicationId));
    const candIds = new Set(applications.map((a) => a.candidateId));
    const candidates = level === 'full' ? s.candidates.filter((c) => c.location === loc || candIds.has(c.id)) : s.candidates.filter((c) => candIds.has(c.id));
    return { s, level, me, loc, currency, jobs, requisitions, applications, interviews, offers, candidates };
  }, [s, level, me, loc, currency]);
}
