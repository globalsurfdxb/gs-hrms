'use client';

import { useMemo } from 'react';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useRequests } from '@/context/RequestsContext';
import { useExpense } from '@/context/ExpenseContext';
import { useExpiry } from '@/context/ExpiryContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useLearning } from '@/context/LearningContext';
import { directReports, employeeById } from '@/lib/data';
import { addDays, daysBetween, todayISO } from '@/lib/dates';
import { hiringLevel } from '@/lib/hiringAccess';
import { canDecideStep, candById, appById, useHiring } from '@/lib/hiringStore';
import { Notice, isRead, markRead, storedFor, useNoticeStore, useNow } from '@/lib/notifications';
import { PERS } from '@/lib/nav';
import { routeAllowed } from '@/lib/guard';

export interface ViewNotice extends Notice {
  unread: boolean;
}

const MANAGEMENT = ['Super Admin', 'HR', 'Office Admin'];
const at8 = (date: string) => `${date}T08:00:00`;
const dayDiff = (iso: string) => daysBetween(todayISO(), iso);

/** Everything that should be in front of the signed-in person right now: events sent to them, plus alerts that are
    worked out from the data and the clock (interviews about to start, offers about to expire, documents due). The
    clock ticks, so an alert appears when its window opens without anyone sending it. */
export function useNotifications(scope: 'me' | 'team' | 'both' = 'me') {
  const me = useCurrentEmployee();
  const { role } = useApp();
  const now = useNow();
  const store = useNoticeStore();
  const { requests, canAct } = useRequests();
  const { claims, canDecide } = useExpense();
  const expiry = useExpiry();
  const { reviews } = usePerformance();
  const { records } = useLearning();
  const hiring = useHiring();

  const hasTeam = PERS[role].scopes.includes('team');
  const wantMe = scope === 'me' || scope === 'both';
  const wantTeam = (scope === 'team' || scope === 'both') && hasTeam;

  const items = useMemo<ViewNotice[]>(() => {
    const out: Notice[] = [];
    const push = (n: Notice) => out.push(n);
    const manage = MANAGEMENT.includes(role);

    if (wantMe) {
      out.push(...storedFor(store, me.id, role));

      requests
        .filter((r) => r.status === 'Pending')
        .forEach((r) => {
          const e = employeeById(r.employeeId);
          if (canAct(r)) push({ id: `rq-act-${r.id}`, kind: 'request', tone: 'pending', title: `${e?.name ?? 'Someone'} · ${r.type} needs your decision`, sub: r.details, href: manage ? '/requests' : '/team/requests', at: r.raisedAt ?? `${r.raisedOn}T09:00:00` });
          else if (r.employeeId === me.id) push({ id: `rq-mine-${r.id}`, kind: 'request', tone: 'info', title: `Your ${r.type.toLowerCase()} is waiting for ${r.routedTo === 'HR' ? 'HR' : 'your manager'}`, sub: r.details, href: '/my/requests', at: r.raisedAt ?? `${r.raisedOn}T09:00:00` });
        });

      claims
        .filter((c) => c.status === 'Pending' && canDecide(c))
        .forEach((c) => {
          const e = employeeById(c.employeeId);
          push({ id: `ex-act-${c.id}`, kind: 'expense', tone: 'pending', title: `${e?.name ?? 'Someone'} · ${c.currency} ${c.amount.toLocaleString('en-US')} ${c.category} claim needs approval`, sub: c.project || c.description, href: '/expense/approvals', at: c.submittedAt ?? `${c.submittedOn ?? c.date}T09:00:00` });
        });

      expiry.rowsFor([me]).forEach((r) => {
        const n = expiry.daysOf(r);
        const due = expiry.dueRung(r);
        if (n >= 0 && due === null) return;
        const tone = n < 0 ? 'expired' : n <= 7 ? 'expired' : 'soon';
        push({
          id: `exp-${r.key}-${n < 0 ? 'x' : due}`,
          kind: 'expiry',
          tone,
          title: n < 0 ? `Your ${r.type} expired ${-n} day${n === -1 ? '' : 's'} ago` : `Your ${r.type} expires in ${n} day${n === 1 ? '' : 's'}`,
          sub: `Expiry date ${r.expiry}. Contact HR to renew it.`,
          href: '/my/expiry',
          at: at8(n < 0 ? r.expiry : addDays(r.expiry, -(due ?? 0))),
        });
      });

      reviews
        .filter((r) => r.employeeId === me.id && r.status !== 'Completed' && !!r.dueDate && dayDiff(r.dueDate) <= 7)
        .forEach((r) => {
          const due = r.dueDate as string;
          const n = dayDiff(due);
          push({ id: `pr-${r.id}`, kind: 'review', tone: n < 0 ? 'expired' : 'soon', title: n < 0 ? `Performance review ${r.cycle} is overdue` : `Performance review ${r.cycle} is due in ${n} day${n === 1 ? '' : 's'}`, sub: `Stage: ${r.status}`, href: manage ? '/performance' : undefined, at: at8(addDays(due, -7)) });
        });

      records
        .filter((r) => r.employeeId === me.id && r.status !== 'Completed' && !!r.dueDate && dayDiff(r.dueDate) <= 7)
        .forEach((r) => {
          const due = r.dueDate as string;
          const n = dayDiff(due);
          push({ id: `lr-${r.id}`, kind: 'learning', tone: n < 0 ? 'expired' : 'soon', title: n < 0 ? `Training “${r.course}” is overdue` : `Training “${r.course}” is due in ${n} day${n === 1 ? '' : 's'}`, sub: r.category, href: manage ? '/learning' : undefined, at: at8(addDays(due, -7)) });
        });

      // Hiring: interviews I am on, approvals waiting for me, offers that need a hand.
      const level = hiringLevel(role);
      hiring.interviews
        .filter((i) => i.status === 'Scheduled')
        .forEach((i) => {
          const start = new Date(`${i.date}T${i.time}:00`).getTime();
          const mins = Math.round((start - now) / 60000);
          const a = appById(hiring, i.applicationId);
          const c = a && candById(hiring, a.candidateId);
          if (i.panelIds.includes(me.id)) {
            if (mins <= 60 && mins >= -120) push({ id: `iv-${i.id}-1h`, kind: 'hiring', tone: 'soon', title: mins > 0 ? `Interview starts in ${mins} min` : 'Interview is under way', sub: `${c?.name ?? 'Candidate'} · ${i.round} · ${i.mode}${i.link ? '' : ''}`, href: c ? `/hiring/candidates/${c.id}` : '/my/interviews', at: new Date(start - 60 * 60000).toISOString() });
            else if (mins > 60 && mins <= 24 * 60) push({ id: `iv-${i.id}-24h`, kind: 'hiring', tone: 'pending', title: `Interview ${new Date(start).toDateString() === new Date(now).toDateString() ? 'today' : 'tomorrow'} at ${i.time}`, sub: `${c?.name ?? 'Candidate'} · ${i.round} · ${i.mode}`, href: c ? `/hiring/candidates/${c.id}` : '/my/interviews', at: new Date(start - 24 * 60 * 60000).toISOString() });
          }
          if (level === 'full' && mins < -120) push({ id: `iv-${i.id}-late`, kind: 'hiring', tone: 'expired', title: 'Interview time has passed and it is still open', sub: `${c?.name ?? 'Candidate'} · ${i.round}: mark it done or reschedule it`, href: '/hiring/interviews', at: new Date(start + 120 * 60000).toISOString() });
        });

      if (level !== 'none') {
        hiring.requisitions
          .filter((r) => r.status === 'Pending Approval')
          .forEach((r) => {
            const step = r.approvals.find((x) => x.status === 'Pending');
            if (step && canDecideStep(step.label, role, me.id, r)) push({ id: `req-act-${r.id}`, kind: 'hiring', tone: 'pending', title: `${r.code} needs your approval`, sub: `${r.title} · ${r.positions} position${r.positions === 1 ? '' : 's'} · ${step.label} step`, href: `/hiring/requisitions/${r.id}`, at: r.updatedAt });
          });
      }
      if (level === 'full') {
        hiring.offers.forEach((o) => {
          const a = appById(hiring, o.applicationId);
          const c = a && candById(hiring, a.candidateId);
          const left = dayDiff(o.expiryDate);
          if (o.status === 'Sent' && left <= 3) push({ id: `off-exp-${o.id}`, kind: 'hiring', tone: left < 0 ? 'expired' : 'soon', title: left < 0 ? `${o.code} has passed its expiry date` : left === 0 ? `${o.code} expires today` : `${o.code} expires in ${left} day${left === 1 ? '' : 's'}`, sub: `${c?.name ?? 'Candidate'} has not answered yet`, href: '/hiring/offers', at: at8(addDays(o.expiryDate, -3)) });
          if (o.status === 'Accepted' && !o.employeeId) push({ id: `off-ready-${o.id}`, kind: 'hiring', tone: 'active', title: 'Accepted offer is ready for onboarding', sub: `${c?.name ?? 'Candidate'} · joins ${o.joiningDate}`, href: '/hiring/offers', at: o.respondedAt ?? o.updatedAt });
        });
      }
    }

    if (wantTeam) {
      const reports = directReports(me.id);
      const ids = new Set(reports.map((p) => p.id));
      requests
        .filter((r) => r.status === 'Pending' && ids.has(r.employeeId))
        .forEach((r) => push({ id: `tm-rq-${r.id}`, kind: 'request', tone: 'pending', title: `${employeeById(r.employeeId)?.name} · ${r.type} pending`, sub: r.details, href: '/team/requests', at: r.raisedAt ?? `${r.raisedOn}T09:00:00` }));
      expiry.rowsFor(reports).forEach((r) => {
        const n = expiry.daysOf(r);
        const due = expiry.dueRung(r);
        if (n >= 0 && due === null) return;
        push({ id: `tm-exp-${r.key}-${n < 0 ? 'x' : due}`, kind: 'expiry', tone: n <= 7 ? 'expired' : 'soon', title: n < 0 ? `${r.employee.name}'s ${r.type} expired ${-n} day${n === -1 ? '' : 's'} ago` : `${r.employee.name}'s ${r.type} expires in ${n} day${n === 1 ? '' : 's'}`, sub: `Expiry date ${r.expiry}`, href: '/team/expiry', at: at8(n < 0 ? r.expiry : addDays(r.expiry, -(due ?? 0))) });
      });
    }

    const seen = new Set<string>();
    // A date-only record (raised "today") can look like it is from later today: never show a time in the future.
    return out
      // A variant (id~mgr) is the same thing sent to someone else with another link: show it once.
      .filter((n) => { const k = n.id.split('~')[0]; return seen.has(k) ? false : (seen.add(k), true); })
      .map((n) => {
        // Records carry local times or UTC ones: put them all on one scale before comparing.
        const t = Math.min(new Date(n.at).getTime() || now, now);
        const href = n.href && routeAllowed(role, n.href, { id: me.id, employeeCode: me.employeeCode }) ? n.href : undefined;
        return { ...n, href, at: new Date(t).toISOString(), unread: !isRead(store, me.id, n.id) };
      })
      .sort((a, b) => b.at.localeCompare(a.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, role, now, store, requests, claims, expiry, reviews, records, hiring, wantMe, wantTeam]);

  const unread = items.filter((n) => n.unread).length;
  return {
    items,
    unread,
    now,
    markRead: (ids: string[]) => markRead(me.id, ids),
    markAllRead: () => markRead(me.id, items.filter((n) => n.unread).map((n) => n.id)),
  };
}
