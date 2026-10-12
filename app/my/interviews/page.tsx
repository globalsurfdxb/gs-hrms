'use client';

import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { CheckIcon, ClockIcon, UserIcon } from '@/components/icons';
import { InterviewBadge, TZ_LABEL, empName, fmtDate } from '@/components/hiring/HiringBits';
import { hiringLevel } from '@/lib/hiringAccess';
import { appById, canViewCandidate, candById, jobById, useHiring } from '@/lib/hiringStore';
import { todayISO } from '@/lib/dates';

/** Interviews the signed-in person is on the panel for, whatever their role. */
export default function MyInterviewsPage() {
  const s = useHiring();
  const me = useCurrentEmployee();
  const { role } = useApp();
  const level = hiringLevel(role);
  const today = todayISO();

  const mine = s.interviews.filter((i) => i.panelIds.includes(me.id)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const upcoming = mine.filter((i) => i.status === 'Scheduled' && i.date >= today);
  const past = mine.filter((i) => !(i.status === 'Scheduled' && i.date >= today)).reverse();

  const rows = (list: typeof mine) => (
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
          {list.map((i) => {
            const a = appById(s, i.applicationId);
            const c = a && candById(s, a.candidateId);
            const j = a && jobById(s, a.jobId);
            const open = !!c && canViewCandidate(s, level, me.id, c.id);
            return (
              <tr key={i.id}>
                <td>
                  {open ? (
                    <Link href={`/hiring/candidates/${c.id}`} className="hm-link">
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div className="tx-s faint">{j?.title}</div>
                    </Link>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600 }}>{c?.name}</div>
                      <div className="tx-s faint">{j?.title}</div>
                    </>
                  )}
                </td>
                <td>
                  {i.round}
                  <div className="tx-s faint">
                    {i.mode} · {i.durationMin} min
                  </div>
                </td>
                <td className="mono">
                  {fmtDate(i.date)}
                  <div className="tx-s faint">
                    {i.time} · {TZ_LABEL[i.location] ?? ''}
                  </div>
                </td>
                <td>{i.panelIds.filter((p) => p !== me.id).map(empName).join(', ') || 'Just you'}</td>
                <td>
                  <InterviewBadge status={i.status} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  {i.status === 'Scheduled' && i.link && (
                    <a href={i.link} target="_blank" rel="noreferrer" className="btn sm primary">
                      Join
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="hm-page">
      <PageHeader eyebrow="My Space" title="My Interviews" description="Interviews you are on the panel for. You can open the profile and CV of the candidates you are assigned to." />
      <StatStrip
        items={[
          { label: 'Today', value: upcoming.filter((i) => i.date === today).length, icon: <ClockIcon />, tone: 'amber', hint: 'Scheduled today' },
          { label: 'Upcoming', value: upcoming.length, icon: <UserIcon />, tone: 'blue', hint: 'Still to do' },
          { label: 'Completed', value: mine.filter((i) => i.status === 'Completed').length, icon: <CheckIcon />, tone: 'green', hint: 'Done so far' },
        ]}
      />
      <Card>
        <CardHeader title="Upcoming" sub={`${upcoming.length} interview${upcoming.length === 1 ? '' : 's'}`} />
        {upcoming.length ? rows(upcoming) : <EmptyState icon={<ClockIcon />} title="Nothing scheduled" description="Interviews you are assigned to appear here." />}
      </Card>
      {past.length > 0 && (
        <Card className="row-gap">
          <CardHeader title="Past and closed" sub={`${past.length} interview${past.length === 1 ? '' : 's'}`} />
          {rows(past)}
        </Card>
      )}
    </div>
  );
}
