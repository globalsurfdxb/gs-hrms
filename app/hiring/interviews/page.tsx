'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { CheckIcon, ClockIcon, PlusIcon, UserIcon } from '@/components/icons';
import { Banner, InterviewBadge, HiringHeader, TZ_LABEL, empName, fmtDate, useActor } from '@/components/hiring/HiringBits';
import { InterviewDrawer } from '@/components/hiring/HiringForms';
import { useStageMail } from '@/components/hiring/Mail';
import { useScoped } from '@/components/hiring/useScoped';
import { addDays, todayISO } from '@/lib/dates';
import { appById, candById, jobById, setInterviewStatus } from '@/lib/hiringStore';
import { Interview } from '@/lib/hiringTypes';

type Filter = 'upcoming' | 'past' | 'all';

export default function InterviewsPage() {
  const { s, interviews, loc, level } = useScoped();
  const actor = useActor();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [notice, setNotice] = useState('');
  const mailer = useStageMail((t) => setNotice(t));
  const today = todayISO();

  const stamp = (i: Interview) => `${i.date}${i.time}`;
  const upcoming = interviews.filter((i) => i.status === 'Scheduled' && i.date >= today);
  const rows = interviews
    .filter((i) => (filter === 'all' ? true : filter === 'upcoming' ? i.status === 'Scheduled' && i.date >= today : !(i.status === 'Scheduled' && i.date >= today)))
    .sort((a, b) => (filter === 'past' ? stamp(b).localeCompare(stamp(a)) : stamp(a).localeCompare(stamp(b))));
  const weekEnd = addDays(today, 6);

  return (
    <div className="hm-page">
      <HiringHeader
        title="Interviews"
        description={`${level === 'manager' ? 'Interviews for your jobs' : 'Every interview for this location'}. Times are in ${TZ_LABEL[loc] ?? 'the local time zone'}.`}
        actions={
          <>
            <Button variant="primary" onClick={() => setScheduling(true)}>
              <PlusIcon /> Schedule interview
            </Button>
          </>
        }
      />
      {notice && <Banner onClose={() => setNotice('')}>{notice}</Banner>}

      <StatStrip
        items={[
          { label: 'Today', value: upcoming.filter((i) => i.date === today).length, icon: <ClockIcon />, tone: 'amber', hint: 'Scheduled today' },
          { label: 'This week', value: upcoming.filter((i) => i.date <= weekEnd).length, icon: <UserIcon />, tone: 'blue', hint: 'Next 7 days' },
          { label: 'Upcoming', value: upcoming.length, icon: <ClockIcon />, tone: 'purple', hint: 'All scheduled' },
          { label: 'Completed', value: interviews.filter((i) => i.status === 'Completed').length, icon: <CheckIcon />, tone: 'green', hint: 'Done so far' },
        ]}
      />

      <Card>
        <CardHeader title="Interview schedule" sub={`${rows.length} shown`} />
        <div className="tbar">
          {(['upcoming', 'past', 'all'] as Filter[]).map((f) => (
            <button key={f} type="button" className={`chip ${filter === f ? 'tx-chip-on' : ''}`} onClick={() => setFilter(f)}>
              {f === 'upcoming' ? 'Upcoming' : f === 'past' ? 'Past & closed' : 'All'}
            </button>
          ))}
        </div>
        {!rows.length ? (
          <EmptyState icon={<ClockIcon />} title="No interviews here" description="Schedule one from a candidate, the pipeline, or the button above." />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Round</th>
                  <th>When</th>
                  <th>Panel</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const a = appById(s, i.applicationId);
                  const c = a && candById(s, a.candidateId);
                  const j = a && jobById(s, a.jobId);
                  const live = i.status === 'Scheduled';
                  return (
                    <tr key={i.id}>
                      <td>
                        <Link href={`/hiring/candidates/${c?.id}`} className="hm-link">
                          <div style={{ fontWeight: 600 }}>{c?.name}</div>
                          <div className="tx-s faint">{j?.title}</div>
                        </Link>
                      </td>
                      <td>
                        {i.round}
                        <div className="tx-s faint">
                          {i.mode} · {i.durationMin} min
                        </div>
                      </td>
                      <td className="mono">
                        {fmtDate(i.date)}
                        <div className="tx-s faint">{i.time}{i.rescheduled ? ` · moved ${i.rescheduled}×` : ''}</div>
                      </td>
                      <td>{i.panelIds.map(empName).join(', ')}</td>
                      <td>
                        <InterviewBadge status={i.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="hm-rowact">
                          {live && i.link && (
                            <a href={i.link} target="_blank" rel="noreferrer" className="btn sm ghost">
                              Join
                            </a>
                          )}
                          {live && (
                            <>
                              <Button size="sm" onClick={() => setEditing(i)}>
                                Reschedule
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setInterviewStatus(i.id, 'Completed', actor);
                                  setNotice(`${c?.name}'s ${i.round.toLowerCase()} was marked completed.`);
                                }}
                              >
                                Mark done
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setInterviewStatus(i.id, 'Cancelled', actor);
                                  setNotice(`${c?.name}'s ${i.round.toLowerCase()} was cancelled.`);
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {mailer.dialog}
      <InterviewDrawer
        open={scheduling || !!editing}
        interview={editing ?? undefined}
        onClose={() => {
          setScheduling(false);
          setEditing(null);
        }}
        onDone={(i, rescheduled) => {
          setScheduling(false);
          setEditing(null);
          mailer.after(i.applicationId, rescheduled ? 'Interview rescheduled' : 'Interview scheduled', { interview: i }, rescheduled ? `Interview moved to ${fmtDate(i.date)} at ${i.time}.` : `${i.round} scheduled for ${fmtDate(i.date)} at ${i.time}.`);
        }}
      />
    </div>
  );
}
