import { api } from '@/lib/api';
import type { InterviewMode } from '@/lib/hiringTypes';
import type { ServerExit, ServerRound, ServerStage } from '@/lib/candidatesApi';
import type { PersonRef, Ref } from '@/lib/requisitionsApi';

/* Interviews from the backend (/api/hiring/interviews). Needs Interviews → View; without full hiring access only the
   interviews on your own jobs (BR-HIR-022). date and time are the job location's local day and time; startsAt and
   endsAt are the instants. Local development only — see API_ENABLED. */

export type ServerMode = 'IN_PERSON' | 'TEAMS' | 'PHONE';
export type ServerInterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export const MODE_OF: Record<ServerMode, InterviewMode> = { IN_PERSON: 'In-person', TEAMS: 'Teams', PHONE: 'Phone' };

export interface ServerInterview {
  id: string;
  application: { id: string; stage: ServerStage; exit: ServerExit | null };
  /** The candidate (id and name). */
  candidate: Ref;
  job: { id: string; code: string; title: string };
  /** `id` is the location id, e.g. Dubai. */
  location: Ref;
  round: ServerRound;
  mode: ServerMode;
  panel: PersonRef[];
  /** Empty when none. */
  link: string;
  notes: string;
  status: ServerInterviewStatus;
  /** How many times it was moved. */
  rescheduleCount: number;
  scheduledBy: PersonRef;
  /** YYYY-MM-DD, local at the location. */
  date: string;
  /** HH:mm, local at the location. */
  time: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  createdAt: string;
  updatedAt: string;
  /** Reschedule, complete or cancel (Interviews → Edit, still scheduled). */
  viewer: { canEdit: boolean };
}

const PAGE = 100; // the server's maximum

export const interviewsApi = {
  /** Every interview of one application, whatever its status (candidate profile). */
  async forApplication(applicationId: string): Promise<ServerInterview[]> {
    const items: ServerInterview[] = [];
    for (let page = 1; ; page++) {
      const r = await api<{ items: ServerInterview[]; total: number }>('GET', '/hiring/interviews', undefined, { applicationId, when: 'all', page, pageSize: PAGE });
      items.push(...r.items);
      if (items.length >= r.total || !r.items.length) return items;
    }
  },
};
