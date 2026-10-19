'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CareersFrame, acceptingApplications, careersPath } from '@/components/hiring/Careers';
import { fmtDate } from '@/components/hiring/HiringBits';
import { daysSince, useHiring } from '@/lib/hiringStore';
import { EMPLOYMENT_KINDS, Job } from '@/lib/hiringTypes';

const placeOf = (j: Job) => (j.location === 'Kochi' ? 'Kochi, India' : 'Dubai, UAE');
const summary = (j: Job) => {
  const first = j.description.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return first.length > 150 ? `${first.slice(0, 147).trimEnd()}…` : first;
};

/** Public list of open roles. No sign-in needed. */
export default function CareersPage() {
  const s = useHiring();
  const open = useMemo(() => s.jobs.filter(acceptingApplications), [s.jobs]);
  const [q, setQ] = useState('');
  const [place, setPlace] = useState('All');
  const [dept, setDept] = useState('All');
  const [kind, setKind] = useState('All');

  const departments = [...new Set(open.map((j) => j.department))].sort();
  const places = [...new Set(open.map((j) => j.location))];
  const needle = q.trim().toLowerCase();
  const rows = open
    .filter((j) => (place === 'All' || j.location === place) && (dept === 'All' || j.department === dept) && (kind === 'All' || j.employmentType === kind) && (!needle || `${j.title} ${j.department} ${j.skills.join(' ')} ${j.description}`.toLowerCase().includes(needle)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const positions = open.reduce((n, j) => n + Math.max(0, j.positions - j.filled), 0);
  const filtered = needle || place !== 'All' || dept !== 'All' || kind !== 'All';

  return (
    <CareersFrame
      wide
      hero={
        <section className="cr-hero">
          <div className="cr-hero-in">
            <span className="cr-eyebrow">Careers</span>
            <h1>Build your career with Global Surf IT</h1>
            <p>Managed IT, cloud and network services for customers across the UAE and India. Join a team that values good engineering and straight talk.</p>
            <div className="cr-hero-stats">
              <span>
                <b>{open.length}</b> open role{open.length === 1 ? '' : 's'}
              </span>
              <span>
                <b>{positions}</b> position{positions === 1 ? '' : 's'} to fill
              </span>
              <span>
                <b>{places.length || 2}</b> locations: Dubai and Kochi
              </span>
            </div>
          </div>
        </section>
      }
    >
      {!open.length ? (
        <div className="cr-card cr-empty">
          <h2>No open roles right now</h2>
          <p>We are not hiring at the moment. Please check back soon, or write to us at hr@globalsurf.ae.</p>
        </div>
      ) : (
        <>
          <div className="cr-filters" role="search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by role, skill or keyword" aria-label="Search roles" />
            <select value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Location">
              <option value="All">All locations</option>
              {places.map((l) => (
                <option key={l} value={l}>
                  {l === 'Kochi' ? 'Kochi, India' : 'Dubai, UAE'}
                </option>
              ))}
            </select>
            <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
              <option value="All">All departments</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Employment type">
              <option value="All">All types</option>
              {EMPLOYMENT_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="cr-count" role="status">
            {rows.length} role{rows.length === 1 ? '' : 's'}
            {filtered && (
              <button
                type="button"
                className="lnk"
                onClick={() => {
                  setQ('');
                  setPlace('All');
                  setDept('All');
                  setKind('All');
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {!rows.length ? (
            <div className="cr-card cr-empty">
              <h2>No roles match</h2>
              <p>Try a different search or remove a filter.</p>
            </div>
          ) : (
            <div className="cr-grid">
              {rows.map((j) => {
                const fresh = daysSince(j.createdAt) <= 7;
                return (
                  <Link key={j.id} href={careersPath(j)} className="cr-role">
                    <div className="cr-role-top">
                      <span className="cr-dept">{j.department}</span>
                      {fresh && <span className="cr-new">New</span>}
                    </div>
                    <h3>{j.title}</h3>
                    <div className="cr-meta">
                      <span>{placeOf(j)}</span>
                      <span>{j.employmentType}</span>
                      <span>
                        {j.expMin}–{j.expMax} yrs
                      </span>
                    </div>
                    {summary(j) && <p>{summary(j)}</p>}
                    {j.skills.length > 0 && (
                      <div className="cr-skills">
                        {j.skills.slice(0, 4).map((k) => (
                          <span key={k}>{k}</span>
                        ))}
                        {j.skills.length > 4 && <span>+{j.skills.length - 4}</span>}
                      </div>
                    )}
                    <div className="cr-role-foot">
                      <small>Apply by {fmtDate(j.closingDate)}</small>
                      <span className="cr-go">View and apply →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </CareersFrame>
  );
}
