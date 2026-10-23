'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CareersFrame, acceptingApplications, careersPath } from '@/components/hiring/Careers';
import { fmtDate } from '@/components/hiring/HiringBits';
import { COMPANIES } from '@/lib/data';
import { daysSince, useHiring } from '@/lib/hiringStore';
import { Job } from '@/lib/hiringTypes';

const placeOf = (j: Job) => (j.location === 'Kochi' ? 'Kochi, India' : 'Dubai, UAE');
const companyOf = (j: Job) => COMPANIES.find((c) => c.id === j.companyId)?.name ?? 'Global Surf IT';
const summary = (j: Job) => {
  const first = j.description.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return first.length > 140 ? `${first.slice(0, 137).trimEnd()}…` : first;
};
/** A steady colour for each department, so a card can be recognised at a glance. */
const ACCENTS = ['#2f6fd6', '#7a4bd0', '#0e8fa8', '#1f9d63', '#c6851b', '#d5493f'];
const accentOf = (dept: string) => ACCENTS[[...dept].reduce((n, c) => n + c.charCodeAt(0), 0) % ACCENTS.length];

const PinIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
const BagIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const STEPS = [
  { n: '1', t: 'Apply', d: 'Send your details and CV for the role you like. It takes a few minutes.' },
  { n: '2', t: 'Screening', d: 'Our team reads every application and replies, whatever the outcome.' },
  { n: '3', t: 'Technical interview', d: 'A conversation with the people you would work with, about the role itself.' },
  { n: '4', t: 'HR interview', d: 'We talk about expectations, the team and your questions.' },
  { n: '5', t: 'Offer', d: 'If it is a fit, you get an offer letter by email and answer it online.' },
];

/** Public list of open roles. No sign-in needed. */
export default function CareersPage() {
  const s = useHiring();
  const open = useMemo(() => s.jobs.filter(acceptingApplications), [s.jobs]);
  const [q, setQ] = useState('');
  const [place, setPlace] = useState('All');
  const [dept, setDept] = useState('All');

  const departments = [...new Set(open.map((j) => j.department))].sort();
  const places = [...new Set(open.map((j) => j.location))];
  const needle = q.trim().toLowerCase();
  const rows = open
    .filter((j) => (place === 'All' || j.location === place) && (dept === 'All' || j.department === dept) && (!needle || `${j.title} ${j.department} ${j.skills.join(' ')} ${j.description}`.toLowerCase().includes(needle)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const positions = open.reduce((n, j) => n + Math.max(0, j.positions - j.filled), 0);
  const companies = new Set(open.map((j) => j.companyId)).size;
  const filtered = needle || place !== 'All' || dept !== 'All';
  const preview = open.slice(0, 3);

  return (
    <CareersFrame
      landing
      hero={
        <section className="cr2-hero">
          <div className="cr2-blob b1" aria-hidden />
          <div className="cr2-blob b2" aria-hidden />
          <div className="cr2-wrap cr2-hero-grid">
            <div className="cr2-hero-copy">
              <span className="cr2-pill">
                <i /> {open.length ? `Hiring now in ${places.map((l) => (l === 'Kochi' ? 'Kochi' : 'Dubai')).join(' and ')}` : 'Join our talent list'}
              </span>
              <h1>
                Build your career with <em>Global Surf IT</em>
              </h1>
              <p>We run managed IT, cloud and network services for customers across the UAE and India. See what is open and apply in a few minutes.</p>
              <div className="cr2-cta">
                <a href="#roles" className="cr2-btn primary">
                  See open roles
                </a>
                <a href="#process" className="cr2-btn ghost">
                  How we hire
                </a>
              </div>
              <dl className="cr2-stats">
                <div>
                  <dt>{open.length}</dt>
                  <dd>open role{open.length === 1 ? '' : 's'}</dd>
                </div>
                <div>
                  <dt>{positions}</dt>
                  <dd>position{positions === 1 ? '' : 's'} to fill</dd>
                </div>
                <div>
                  <dt>{places.length || 2}</dt>
                  <dd>offices</dd>
                </div>
                <div>
                  <dt>{companies || 1}</dt>
                  <dd>group compan{companies === 1 ? 'y' : 'ies'} hiring</dd>
                </div>
              </dl>
            </div>
            <div className="cr2-hero-art" aria-hidden>
              {preview.map((j, i) => (
                <div key={j.id} className={`cr2-float f${i + 1}`} style={{ ['--a' as string]: accentOf(j.department) }}>
                  <span className="dot" />
                  <b>{j.title}</b>
                  <small>
                    {j.department} · {placeOf(j)}
                  </small>
                </div>
              ))}
              <div className="cr2-orb" />
            </div>
          </div>
        </section>
      }
    >
      <section id="roles" className="cr2-section">
        <div className="cr2-wrap">
          <div className="cr2-head">
            <div>
              <span className="cr2-eyebrow">Open roles</span>
              <h2>Find your next role</h2>
            </div>
            <div className="cr2-search">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by role, skill or keyword" aria-label="Search roles" />
            </div>
          </div>

          {open.length > 0 && (
            <div className="cr2-filters">
              <div className="cr2-seg" role="group" aria-label="Location">
                <button type="button" className={place === 'All' ? 'on' : ''} onClick={() => setPlace('All')}>
                  Everywhere <b>{open.length}</b>
                </button>
                {places.map((l) => (
                  <button key={l} type="button" className={place === l ? 'on' : ''} onClick={() => setPlace(l)}>
                    {l === 'Kochi' ? 'Kochi' : 'Dubai'} <b>{open.filter((j) => j.location === l).length}</b>
                  </button>
                ))}
              </div>
              <div className="cr2-chips" role="group" aria-label="Department">
                <button type="button" className={dept === 'All' ? 'on' : ''} onClick={() => setDept('All')}>
                  All teams
                </button>
                {departments.map((d) => (
                  <button key={d} type="button" className={dept === d ? 'on' : ''} onClick={() => setDept(d)} style={{ ['--a' as string]: accentOf(d) }}>
                    <i /> {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!open.length ? (
            <div className="cr2-empty">
              <h3>No open roles right now</h3>
              <p>We are not hiring at the moment. Please check back soon, or write to us at hr@globalsurf.ae.</p>
            </div>
          ) : (
            <>
              <div className="cr2-count" role="status">
                {rows.length} role{rows.length === 1 ? '' : 's'}
                {filtered && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ('');
                      setPlace('All');
                      setDept('All');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {!rows.length ? (
                <div className="cr2-empty">
                  <h3>No roles match</h3>
                  <p>Try a different search or remove a filter.</p>
                </div>
              ) : (
                <div className="cr2-grid">
                  {rows.map((j) => {
                    const fresh = daysSince(j.createdAt) <= 7;
                    return (
                      <Link key={j.id} href={careersPath(j)} className="cr2-role" style={{ ['--a' as string]: accentOf(j.department) }}>
                        <div className="cr2-role-top">
                          <span className="cr2-co">{companyOf(j)}</span>
                          {fresh && <span className="cr2-new">New</span>}
                        </div>
                        <h3>{j.title}</h3>
                        <div className="cr2-team">
                          <i /> {j.department}
                        </div>
                        {summary(j) && <p>{summary(j)}</p>}
                        <ul className="cr2-meta">
                          <li>
                            <PinIcon /> {placeOf(j)}
                          </li>
                          <li>
                            <BagIcon /> {j.employmentType}
                          </li>
                          <li>
                            <ClockIcon /> {j.expMin}–{j.expMax} yrs
                          </li>
                        </ul>
                        {j.skills.length > 0 && (
                          <div className="cr2-skills">
                            {j.skills.slice(0, 4).map((k) => (
                              <span key={k}>{k}</span>
                            ))}
                            {j.skills.length > 4 && <span>+{j.skills.length - 4}</span>}
                          </div>
                        )}
                        <div className="cr2-role-foot">
                          <small>Apply by {fmtDate(j.closingDate)}</small>
                          <span className="cr2-go" aria-hidden>
                            →
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section id="process" className="cr2-section alt">
        <div className="cr2-wrap">
          <div className="cr2-head single">
            <div>
              <span className="cr2-eyebrow">How we hire</span>
              <h2>Five steps, and you always hear back</h2>
            </div>
          </div>
          <ol className="cr2-steps">
            {STEPS.map((x) => (
              <li key={x.n}>
                <span className="n">{x.n}</span>
                <h3>{x.t}</h3>
                <p>{x.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </CareersFrame>
  );
}
