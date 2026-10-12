'use client';

import Link from 'next/link';
import { CareersFrame, Pay, acceptingApplications, careersPath } from '@/components/hiring/Careers';
import { useHiring } from '@/lib/hiringStore';

/** Public list of open roles. No sign-in needed. */
export default function CareersPage() {
  const s = useHiring();
  const open = s.jobs.filter(acceptingApplications);
  return (
    <CareersFrame>
      <h1 className="cr-h1">Join our team</h1>
      <p className="cr-lead">Open roles across Dubai and Kochi. Pick one to read the details and apply.</p>
      {!open.length ? (
        <div className="cr-card">
          <p style={{ margin: 0 }}>There are no open roles right now. Please check back soon.</p>
        </div>
      ) : (
        <div className="cr-list">
          {open.map((j) => (
            <Link key={j.id} href={careersPath(j)} className="cr-job">
              <div>
                <b>{j.title}</b>
                <small>
                  {j.department} · <Pay job={j} />
                </small>
              </div>
              <span className="lnk">View and apply →</span>
            </Link>
          ))}
        </div>
      )}
    </CareersFrame>
  );
}
