import { logAudit } from '@/lib/employeeStore';
import { currentActor } from '@/lib/auth';

/* One way to record "who did what" for every task in the HRMS. It writes to the same log Administration → Audit Logs
   shows, so a task logged anywhere appears there with the person, the area, the change and the time. */

export interface TaskLogOptions {
  /** What it was before. */
  from?: string;
  /** Who did it; defaults to the signed-in person. */
  by?: string;
  /** The employee the task is about, so the log entry links to their profile. */
  employeeId?: string;
}

/** Record a task. `module` is the area (Offboarding, Learning, Organization…), `action` what happened,
    `subject` what it was done to, and `to` the result or detail. */
export function logTask(module: string, action: string, subject: string, to: string, opts: TaskLogOptions = {}) {
  logAudit({
    employeeId: opts.employeeId ?? `${module.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${subject}`,
    field: action,
    from: opts.from,
    to,
    changedBy: opts.by ?? currentActor().name,
    module,
  });
}
