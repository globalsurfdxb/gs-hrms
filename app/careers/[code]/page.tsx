'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ApplyForm, CareersFrame, acceptingApplications, careersPath } from '@/components/hiring/Careers';
import { fmtDate } from '@/components/hiring/HiringBits';
import { COMPANIES } from '@/lib/data';
import { daysBetween, todayISO } from '@/lib/dates';
import { daysSince, useHiring } from '@/lib/hiringStore';
import { Job } from '@/lib/hiringTypes';

const placeOf = (j: Job) => (j.location === 'Kochi' ? 'Kochi, India' : 'Dubai, United Arab Emirates');
const shortPlace = (j: Job) => (j.location === 'Kochi' ? 'Kochi, India' : 'Dubai, UAE');
const companyOf = (j: Job) => COMPANIES.find((c) => c.id === j.companyId)?.name ?? 'Global Surf IT';
const ACCENTS = ['#2f6fd6', '#7a4bd0', '#0e8fa8', '#1f9d63', '#c6851b', '#d5493f'];
const accentOf = (dept: string) => ACCENTS[[...dept].reduce((n, c) => n + c.charCodeAt(0), 0) % ACCENTS.length];

const Icon = ({ d, extra }: { d: string; extra?: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

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
  const [active, setActive] = useState('about');
  const [atForm, setAtForm] = useState(false);
  const job = s.jobs.find((j) => j.code.toLowerCase() === decodeURIComponent(code).toLowerCase());

  const found = !!job && job.status !== 'Draft';
  // The tab for the section being read follows the scroll; the mobile bar steps aside while the form is on screen.
  useEffect(() => {
    if (!found) return;
    const ids = ['about', 'requirements', 'apply'];
    const onScroll = () => {
      const line = 170;
      let cur = ids[0];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      });
      // at the very bottom the last section is the one being read
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = ids[ids.length - 1];
      setActive(cur);
      const form = document.getElementById('apply');
      const r = form?.getBoundingClientRect();
      setAtForm(!!r && r.top < window.innerHeight * 0.8 && r.bottom > 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [found]);

  if (!job || job.status === 'Draft')
    return (
      <CareersFrame landing>
        <div className="cr2-wrap cr3-missing">
          <div className="cr2-empty">
            <h3>We could not find that role</h3>
            <p>The link may be wrong, or the role is no longer listed. Here is everything that is open right now.</p>
            <Link href="/careers#roles" className="cr2-btn primary" style={{ marginTop: 18 }}>
              See open roles
            </Link>
          </div>
        </div>
      </CareersFrame>
    );

  const open = acceptingApplications(job);
  const accent = accentOf(job.department);
  const lines = job.description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // One long paragraph is easier to scan as a list, so split it into its sentences.
  const sentences = lines.length === 1 ? (lines[0].match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? []).map((x) => x.trim()).filter(Boolean) : [];
  const duties = lines.length > 1 ? lines : sentences.length >= 3 ? sentences : lines;
  const left = Math.max(0, job.positions - job.filled);
  const daysLeft = daysBetween(todayISO(), job.closingDate);
  const fresh = daysSince(job.createdAt) <= 7;
  const others = s.jobs
    .filter((j) => j.id !== job.id && acceptingApplications(j))
    .sort((a, b) => Number(b.department === job.department) - Number(a.department === job.department) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const pageUrl = typeof window === 'undefined' ? '' : window.location.href.split('?')[0];
  const share = () => {
    void navigator.clipboard?.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const text = encodeURIComponent(`${job.title} at ${companyOf(job)}`);
  const link = encodeURIComponent(pageUrl);
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
    <CareersFrame
      landing
      hero={
        <section className="cr3-hero" style={{ ['--a' as string]: accent }}>
          <div className="cr2-blob b1" aria-hidden />
          <div className="cr2-wrap">
            <nav className="cr3-crumbs" aria-label="Breadcrumb">
              <Link href="/careers">Careers</Link>
              <span aria-hidden>/</span>
              <Link href="/careers#roles">Open roles</Link>
              <span aria-hidden>/</span>
              <b>{job.title}</b>
            </nav>
            <div className="cr3-hero-row">
              <div>
                <div className="cr3-badges">
                  <span className="cr2-co">{companyOf(job)}</span>
                  <span className="cr3-dept">
                    <i /> {job.department}
                  </span>
                  {fresh && <span className="cr2-new">New</span>}
                  {!open && <span className="cr3-closed">Closed</span>}
                </div>
                <h1>{job.title}</h1>
                <p className="cr3-sub">
                  {shortPlace(job)} · {job.employmentType}
                  {open && daysLeft >= 0 && daysLeft <= 7 && <b className="cr3-urgent"> · {daysLeft === 0 ? 'closes today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</b>}
                </p>
              </div>
              <div className="cr3-hero-cta">
                {open && (
                  <a href="#apply" className="cr2-btn primary">
                    Apply now
                  </a>
                )}
                <button type="button" className="cr2-btn ghost" onClick={share}>
                  {copied ? 'Link copied' : 'Copy link'}
                </button>
              </div>
            </div>
          </div>
        </section>
      }
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="cr2-wrap cr3-facts" style={{ ['--a' as string]: accent }}>
        <div className="cr3-fact">
          <span>
            <Icon d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" extra="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          </span>
          <div>
            <small>Location</small>
            <b>{placeOf(job)}</b>
          </div>
        </div>
        <div className="cr3-fact">
          <span>
            <Icon d="M3 7h18v13H3zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
          </span>
          <div>
            <small>Employment</small>
            <b>{job.employmentType}</b>
          </div>
        </div>
        <div className="cr3-fact">
          <span>
            <Icon d="M12 3 2 8l10 5 10-5-10-5ZM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" />
          </span>
          <div>
            <small>Experience</small>
            <b>
              {job.expMin}–{job.expMax} years
            </b>
          </div>
        </div>
        <div className="cr3-fact">
          <span>
            <Icon d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
          </span>
          <div>
            <small>Open positions</small>
            <b>{left}</b>
          </div>
        </div>
        <div className="cr3-fact">
          <span>
            <Icon d="M8 2v4M16 2v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          </span>
          <div>
            <small>Apply by</small>
            <b>{fmtDate(job.closingDate)}</b>
          </div>
        </div>
      </div>

      <div className="cr3-tabs" role="navigation" aria-label="On this page">
        <div className="cr2-wrap cr3-tabs-in">
          {[
            ['about', 'About the role'],
            ['requirements', 'Requirements'],
            ['apply', 'Apply'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
              {label}
            </a>
          ))}
          <span className="sp" />
          {open && (
            <a href="#apply" className="cr3-tabs-cta">
              Apply now
            </a>
          )}
        </div>
      </div>

      <div className="cr2-wrap cr3-layout">
        <div className="cr3-main">
          <section className="cr3-sec" id="about">
            <h2>About the role</h2>
            {duties.length > 1 ? (
              <ul className="cr3-duties">
                {duties.map((d) => (
                  <li key={d}>
                    <i aria-hidden>✓</i>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cr3-lead">{job.description}</p>
            )}
          </section>

          <section className="cr3-sec" id="requirements">
            <h2>What we are looking for</h2>
            <div className="cr3-req">
              <div>
                <small>Experience</small>
                <b>
                  {job.expMin}–{job.expMax} years in a similar role
                </b>
              </div>
              {job.qualifications && (
                <div>
                  <small>Qualifications</small>
                  <b>{job.qualifications}</b>
                </div>
              )}
            </div>
            {job.skills.length > 0 && (
              <>
                <h3 className="cr3-h3">Skills that matter</h3>
                <div className="cr3-skills">
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
              <div className="cr2-empty">
                <h3>This role is no longer accepting applications</h3>
                <p>Thank you for your interest. Have a look at our other openings.</p>
                <Link href="/careers#roles" className="cr2-btn primary" style={{ marginTop: 18 }}>
                  See open roles
                </Link>
              </div>
            )}
          </div>
        </div>

        <aside className="cr3-aside" aria-label="Apply and share">
          {open && (
            <div className="cr3-card cr3-apply">
              <h3>Ready to apply?</h3>
              <p className={daysLeft <= 7 ? 'warn' : ''}>
                {daysLeft < 0 ? 'Closing soon' : daysLeft === 0 ? 'Closes today' : daysLeft === 1 ? '1 day left to apply' : `${daysLeft} days left to apply`}
              </p>
              <a href="#apply" className="cr2-btn primary">
                Apply for this role
              </a>
            </div>
          )}

          <div className="cr3-card">
            <h3>Share this role</h3>
            <div className="cr3-share">
              <button type="button" onClick={share}>
                {copied ? '✓ Copied' : 'Copy link'}
              </button>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${link}`} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
              <a href={`https://wa.me/?text=${text}%20${link}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a href={`mailto:?subject=${text}&body=${link}`}>Email</a>
            </div>
          </div>

          {others.length > 0 && (
            <div className="cr3-card">
              <h3>More open roles</h3>
              <ul className="cr3-more">
                {others.map((j) => (
                  <li key={j.id}>
                    <Link href={careersPath(j)} style={{ ['--a' as string]: accentOf(j.department) }}>
                      <i aria-hidden />
                      <span>
                        <b>{j.title}</b>
                        <small>
                          {j.department} · {shortPlace(j)}
                        </small>
                      </span>
                      <em aria-hidden>→</em>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/careers#roles" className="cr3-all">
                See all open roles
              </Link>
            </div>
          )}

          <div className="cr3-card cr3-help">
            <h3>Questions?</h3>
            <p>
              Write to <a href="mailto:hr@globalsurf.ae">hr@globalsurf.ae</a> and mention {job.code}.
            </p>
          </div>
        </aside>
      </div>
      {open && !atForm && (
        <div className="cr3-bar">
          <span>
            <b>{job.title}</b>
            <small>{daysLeft <= 7 && daysLeft >= 0 ? (daysLeft === 0 ? 'Closes today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`) : `Apply by ${fmtDate(job.closingDate)}`}</small>
          </span>
          <a href="#apply" className="cr2-btn primary">
            Apply now
          </a>
        </div>
      )}
    </CareersFrame>
  );
}
