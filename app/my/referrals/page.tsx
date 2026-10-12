'use client';

import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { CheckIcon, JoinIcon, PeopleIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { fmtDate } from '@/components/hiring/HiringBits';
import { acceptingApplications } from '@/components/hiring/Careers';
import { LinkBox } from '@/components/hiring/ShareJob';
import { careersPath } from '@/components/hiring/Careers';
import { appsForCandidate, jobById, useHiring } from '@/lib/hiringStore';
import { useEffect, useState } from 'react';

/** Where a referral stands, in plain words; the details of the candidate stay with the hiring team. */
const statusOf = (a: { stage: string; exit?: string }) => (a.exit === 'Rejected' ? 'Not selected' : a.exit ? 'Closed' : a.stage === 'Hired' ? 'Hired' : a.stage === 'Offer' ? 'Offer stage' : a.stage === 'Applied' ? 'Received' : 'In process');

export default function MyReferralsPage() {
  const s = useHiring();
  const me = useCurrentEmployee();
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const jobs = s.jobs.filter((j) => acceptingApplications(j) && j.referralEligible);
  const mine = s.candidates.filter((c) => c.referrerId === me.id);
  const hired = mine.filter((c) => c.employeeId).length;

  return (
    <div className="hm-page">
      <PageHeader eyebrow="My Space" title="Referrals" description="Know someone for an open role? Share your personal link. When they apply through it, the referral is credited to you." />
      <StatStrip
        items={[
          { label: 'Open roles', value: jobs.length, icon: <JoinIcon />, tone: 'blue', hint: 'Taking referrals' },
          { label: 'My referrals', value: mine.length, icon: <PeopleIcon />, tone: 'purple', hint: 'People you referred' },
          { label: 'Hired', value: hired, icon: <CheckIcon />, tone: 'green', hint: 'Joined the company' },
        ]}
      />

      <Card>
        <CardHeader title="Roles you can refer for" sub="Copy the link and send it to your contact." />
        {!jobs.length ? (
          <EmptyState icon={<JoinIcon />} title="No open roles right now" description="Roles open for referrals appear here." />
        ) : (
          <div className="hm-refs">
            {jobs.map((j) => (
              <div key={j.id} className="hm-ref">
                <div className="hm-ref-top">
                  <div>
                    <b>{j.title}</b>
                    <small>
                      {j.department} · {j.location === 'Kochi' ? 'Kochi, India' : 'Dubai, UAE'} · closes {fmtDate(j.closingDate)}
                    </small>
                  </div>
                  <Link href={careersPath(j)} className="lnk" target="_blank">
                    View job →
                  </Link>
                </div>
                <LinkBox label="Your referral link" url={`${origin}${careersPath(j, me.employeeCode)}`} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="row-gap">
        <CardHeader title="My referrals" sub="Status only. The hiring team keeps candidate details private." />
        {!mine.length ? (
          <EmptyState icon={<PeopleIcon />} title="No referrals yet" description="People who apply through your link show up here." />
        ) : (
          <div className="tx-scroll">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Referred on</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mine.flatMap((c) =>
                  appsForCandidate(s, c.id).map((a) => {
                    const st = statusOf(a);
                    return (
                      <tr key={a.id}>
                        <td>{c.name}</td>
                        <td>{jobById(s, a.jobId)?.title}</td>
                        <td className="mono">{fmtDate(a.appliedAt)}</td>
                        <td>
                          <Badge tone={st === 'Hired' ? 'active' : st === 'Not selected' ? 'expired' : st === 'Closed' ? 'inactive' : 'info'}>{st}</Badge>
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
