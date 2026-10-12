'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ApplyForm, CareersFrame, Pay, acceptingApplications } from '@/components/hiring/Careers';
import { useHiring } from '@/lib/hiringStore';

export default function CareersJobPage() {
  return (
    <Suspense fallback={null}>
      <CareersJob />
    </Suspense>
  );
}

/** One open role with its apply form. The link can be shared; ?ref=<employee code> credits a referral. */
function CareersJob() {
  const { code } = useParams<{ code: string }>();
  const params = useSearchParams();
  const ref = params.get('ref');
  const src = params.get('src');
  const s = useHiring();
  const job = s.jobs.find((j) => j.code.toLowerCase() === decodeURIComponent(code).toLowerCase());

  if (!job || job.status === 'Draft')
    return (
      <CareersFrame>
        <div className="cr-card">
          <h2>We could not find that role</h2>
          <p>The link may be wrong, or the role is no longer listed.</p>
          <Link href="/careers" className="btn ghost">
            See open roles
          </Link>
        </div>
      </CareersFrame>
    );

  const open = acceptingApplications(job);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description.replace(/\n/g, '<br/>'),
    datePosted: job.createdAt.slice(0, 10),
    validThrough: job.closingDate,
    employmentType: job.employmentType === 'Contract' ? 'CONTRACTOR' : job.employmentType === 'Intern' ? 'INTERN' : 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', name: 'Global Surf IT' },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location === 'Kochi' ? 'Kochi' : 'Dubai', addressCountry: job.location === 'Kochi' ? 'IN' : 'AE' } },
  };
  return (
    <CareersFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Link href="/careers" className="cr-back">
        ← All open roles
      </Link>
      <h1 className="cr-h1">{job.title}</h1>
      <p className="cr-lead">
        {job.department} · <Pay job={job} />
      </p>

      <div className="cr-card">
        <h2>About the role</h2>
        <p className="hm-pre">{job.description}</p>
        <h3>Skills</h3>
        <div className="hm-tags big">
          {job.skills.map((k) => (
            <span key={k}>{k}</span>
          ))}
        </div>
        <h3>What we are looking for</h3>
        <p style={{ margin: 0 }}>
          {job.expMin}–{job.expMax} years of experience.{job.qualifications ? ` ${job.qualifications}` : ''}
        </p>
      </div>

      {open ? (
        <ApplyForm job={job} refCode={ref} src={src} />
      ) : (
        <div className="cr-card">
          <h2>This role is no longer accepting applications</h2>
          <p style={{ margin: '0 0 12px' }}>Thank you for your interest. Have a look at our other openings.</p>
          <Link href="/careers" className="btn primary">
            See open roles
          </Link>
        </div>
      )}
    </CareersFrame>
  );
}
