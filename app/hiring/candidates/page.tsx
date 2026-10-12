'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { Avatar } from '@/components/ui/Avatar';
import { CheckIcon, PeopleIcon, PlusIcon, SearchIcon, UserXIcon, ClockIcon } from '@/components/icons';
import { Banner, HiringHeader, StageBadge, fmtDate } from '@/components/hiring/HiringBits';
import { CandidateDrawer } from '@/components/hiring/HiringForms';
import { useScoped } from '@/components/hiring/useScoped';
import { appsForCandidate, isActiveApp, jobById } from '@/lib/hiringStore';
import { SOURCES, STAGES } from '@/lib/hiringTypes';

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function CandidatesPage() {
  return (
    <Suspense fallback={null}>
      <Candidates />
    </Suspense>
  );
}

function Candidates() {
  const { s, candidates, applications, jobs } = useScoped();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [jobId, setJobId] = useState('All');
  const [stage, setStage] = useState('All');
  const [source, setSource] = useState('All');
  const [adding, setAdding] = useState(params.get('add') === '1');
  const [notice, setNotice] = useState('');

  const needle = q.trim().toLowerCase();
  const rows = candidates.filter((c) => {
    const apps = appsForCandidate(s, c.id).filter((a) => jobs.some((j) => j.id === a.jobId));
    if (jobId !== 'All' && !apps.some((a) => a.jobId === jobId)) return false;
    if (stage !== 'All' && !apps.some((a) => (stage === 'Rejected' || stage === 'Withdrawn' || stage === 'On Hold' ? a.exit === stage : !a.exit && a.stage === stage))) return false;
    if (source !== 'All' && c.source !== source) return false;
    return !needle || `${c.name} ${c.email} ${c.currentCompany} ${c.currentTitle} ${c.tags.join(' ')}`.toLowerCase().includes(needle);
  });
  const active = applications.filter(isActiveApp);
  const closeAdd = () => {
    setAdding(false);
    if (params.get('add')) router.replace('/hiring/candidates');
  };

  return (
    <div className="hm-page">
      <HiringHeader
        title="Candidates"
        description="Everyone in the talent database for this location. A candidate can apply to more than one job."
        actions={
          <>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <PlusIcon /> Add candidate
            </Button>
          </>
        }
      />
      {notice && <Banner onClose={() => setNotice('')}>{notice}</Banner>}

      <StatStrip
        items={[
          { label: 'Candidates', value: candidates.length, icon: <PeopleIcon />, tone: 'blue', hint: 'In the database' },
          { label: 'In the pipeline', value: new Set(active.map((a) => a.candidateId)).size, icon: <ClockIcon />, tone: 'purple', hint: 'Active applications' },
          { label: 'Hired', value: candidates.filter((c) => c.employeeId).length, icon: <CheckIcon />, tone: 'green', hint: 'Became employees' },
          { label: 'Rejected', value: applications.filter((a) => a.exit === 'Rejected').length, icon: <UserXIcon />, tone: 'red', hint: 'Across all jobs' },
        ]}
      />

      <Card>
        <CardHeader title="All candidates" sub={`${rows.length} of ${candidates.length}`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, company or tag…" />
          </div>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="chip" aria-label="Job">
            <option value="All">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="chip" aria-label="Stage">
            <option value="All">All stages</option>
            {[...STAGES, 'Rejected', 'Withdrawn', 'On Hold'].map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="chip" aria-label="Source">
            <option value="All">All sources</option>
            {SOURCES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>

        {!rows.length ? (
          <EmptyState icon={<PeopleIcon />} title={candidates.length ? 'No candidates match' : 'No candidates yet'} description={candidates.length ? 'Try a different search or filter.' : 'Add a candidate to start building a pipeline.'} />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Applications</th>
                  <th>Experience</th>
                  <th>Source</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const apps = appsForCandidate(s, c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/hiring/candidates/${c.id}`} className="person">
                          <Avatar initials={initials(c.name)} seed={c.name} size={36} />
                          <div>
                            <div className="nm">{c.name}</div>
                            <div className="sb">
                              {c.currentTitle || '—'}
                              {c.currentCompany ? ` · ${c.currentCompany}` : ''}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td>
                        {apps.length ? (
                          <div className="hm-apps">
                            {apps.map((a) => (
                              <div key={a.id}>
                                <span>{jobById(s, a.jobId)?.title}</span>
                                <StageBadge stage={a.stage} exit={a.exit} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="faint">Talent pool</span>
                        )}
                      </td>
                      <td className="mono">{c.experienceYears} yrs</td>
                      <td>
                        {c.source}
                        {c.agency && <div className="tx-s faint">{c.agency}</div>}
                      </td>
                      <td className="mono">{fmtDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CandidateDrawer
        open={adding}
        onClose={closeAdd}
        onDone={(c, a) => {
          closeAdd();
          setNotice(a ? `${c.name} was added and applied to ${jobById(s, a.jobId)?.title ?? 'the job'}.` : `${c.name} was added to the talent pool.`);
          router.push(`/hiring/candidates/${c.id}`);
        }}
      />
    </div>
  );
}
