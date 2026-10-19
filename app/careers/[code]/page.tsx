'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ApplyForm, CareersFrame, acceptingApplications } from '@/components/hiring/Careers';
import { fmtDate } from '@/components/hiring/HiringBits';
import { useHiring } from '@/lib/hiringStore';
import { Job } from '@/lib/hiringTypes';

const placeOf = (j: Job) => (j.location === 'Kochi' ? 'Kochi, India' : 'Dubai, United Arab Emirates');

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
  const [copied, setCopied] = useState(false);
  const job = s.jobs.find((j) => j.code.toLowerCase() === decodeURIComponent(code).toLowerCase());

  if (!job || job.status === 'Draft')
    return (
      <CareersFrame>
        <div className="cr-card cr-empty">
          <h2>We could not find that role</h2>
          <p>The link may be wrong, or the role is no longer listed.</p>
          <Link href="/careers" className="btn primary">
            See open roles
          </Link>
        </div>
      </CareersFrame>
    );

  const open = acceptingApplications(job);
  const duties = job.description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const left = Math.max(0, job.positions - job.filled);
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
  const share = () => {
    void navigator.clipboard?.writeText(window.location.href.split('?')[0]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <CareersFrame
      wide
      hero={
        <section className="cr-hero job">
          <div className="cr-hero-in">
            <Link href="/careers" className="cr-hero-back">
              ← All open roles
            </Link>
            <span className="cr-eyebrow">{job.department}</span>
            <h1>{job.title}</h1>
            <div className="cr-hero-chips">
              <span>{placeOf(job)}</span>
              <span>{job.employmentType}</span>
              <span>
                {job.expMin}–{job.expMax} years of experience
              </span>
              {open && <span>Apply by {fmtDate(job.closingDate)}</span>}
            </div>
            {open && (
              <a href="#apply" className="cr-cta">
                Apply for this role
              </a>
            )}
          </div>
        </section>
      }
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="cr-layout">
        <div className="cr-body">
          <section className="cr-card">
            <h2>About the role</h2>
            {duties.length > 1 ? (
              <>
                <p className="cr-sub">What you will do</p>
                <ul className="cr-bullets">
                  {duties.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>{job.description}</p>
            )}
          </section>

          <section className="cr-card">
            <h2>What we are looking for</h2>
            <ul className="cr-bullets">
              <li>
                {job.expMin}–{job.expMax} years of relevant experience
              </li>
              {job.qualifications && <li>{job.qualifications}</li>}
            </ul>
            {job.skills.length > 0 && (
              <>
                <p className="cr-sub">Key skills</p>
                <div className="cr-skills big">
                  {job.skills.map((k) => (
                    <span key={k}>{k}</span>
                  ))}
                </div>
              </>
            )}
          </section>

          <div id="apply" className="cr-anchor">
            {open ? (
              <ApplyForm job={job} refCode={ref} src={src} />
            ) : (
              <div className="cr-card cr-empty">
                <h2>This role is no longer accepting applications</h2>
                <p>Thank you for your interest. Have a look at our other openings.</p>
                <Link href="/careers" className="btn primary">
                  See open roles
                </Link>
              </div>
            )}
          </div>
        </div>

        <aside className="cr-aside" aria-label="Role summary">
          <div className="cr-card">
            <h2>Role summary</h2>
            <dl className="cr-facts">
              <div>
                <dt>Department</dt>
                <dd>{job.department}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{placeOf(job)}</dd>
              </div>
              <div>
                <dt>Employment type</dt>
                <dd>{job.employmentType}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>
                  {job.expMin}–{job.expMax} years
                </dd>
              </div>
              <div>
                <dt>Open positions</dt>
                <dd>{left}</dd>
              </div>
              <div>
                <dt>Apply by</dt>
                <dd>{fmtDate(job.closingDate)}</dd>
              </div>
            </dl>
            {open && (
              <a href="#apply" className="btn primary cr-wide">
                Apply now
              </a>
            )}
            <button type="button" className="btn ghost cr-wide" onClick={share}>
              {copied ? 'Link copied' : 'Copy link to this role'}
            </button>
            <p className="cr-help">
              Questions about the role? Write to <a href="mailto:hr@globalsurf.ae">hr@globalsurf.ae</a>.
            </p>
          </div>
        </aside>
      </div>
    </CareersFrame>
  );
}
