'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { Avatar } from '@/components/ui/Avatar';
import { CheckIcon, ClockIcon, PeopleIcon, PlusIcon, SearchIcon, UserXIcon } from '@/components/icons';
import { Banner, HiringHeader, StageBadge, fmtDate, useHiringLocation } from '@/components/hiring/HiringBits';
import { ServerCandidateDrawer } from '@/components/hiring/ServerCandidateForm';
import { errorMessage } from '@/lib/api';
import { can } from '@/lib/access';
import { usePermissions } from '@/lib/auth';
import { EXITS, Exit, SOURCES, STAGES, Source, Stage } from '@/lib/hiringTypes';
import { type ServerJob, jobsApi } from '@/lib/jobsApi';
import { type CandidateListQuery, type CandidateSummary, EXIT_CODE, EXIT_OF, SOURCE_CODE, SOURCE_OF, STAGE_CODE, STAGE_OF, type ServerCandidate, candidatesApi } from '@/lib/candidatesApi';

/* The Candidates page from the backend (local development). The same screen as app/hiring/candidates/page.tsx, but
   the server searches, filters and pages the list and counts the strip at the top, over the candidates the caller
   may see in the chosen location: everyone with full hiring access, otherwise those on their own jobs with only
   those applications (BR-HIR-022). */

const PAGE_SIZE = 50;

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
const day = (iso: string) => fmtDate(new Date(iso).toLocaleDateString('en-CA'));
const isExit = (x: Stage | Exit): x is Exit => (EXITS as readonly string[]).includes(x);

export function ServerCandidates() {
  const { loc } = useHiringLocation();
  // Another location has other jobs: start its filters afresh.
  return <CandidateList key={loc} loc={loc} />;
}

function CandidateList({ loc }: { loc: string }) {
  const perms = usePermissions() ?? [];
  const router = useRouter();
  const params = useSearchParams();
  const canAdd = can(perms, 'hiring:recruiting:candidates', 'add');
  const seesJobs = can(perms, 'hiring:recruiting:jobs');
  const [q, setQ] = useState('');
  const [needle, setNeedle] = useState('');
  const [jobId, setJobId] = useState('All');
  const [stage, setStage] = useState<'All' | Stage | Exit>('All');
  const [source, setSource] = useState<'All' | Source>('All');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<{ items: ServerCandidate[]; total: number } | null>(null);
  const [summary, setSummary] = useState<CandidateSummary | null>(null);
  const [jobs, setJobs] = useState<ServerJob[]>([]);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(params.get('add') === '1');

  // Search once the typing pauses.
  useEffect(() => {
    const t = setTimeout(() => {
      setNeedle(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let live = true;
    const query: CandidateListQuery = {
      locationId: loc,
      page,
      pageSize: PAGE_SIZE,
      q: needle || undefined,
      jobId: jobId === 'All' ? undefined : jobId,
      source: source === 'All' ? undefined : SOURCE_CODE[source],
      ...(stage === 'All' ? {} : isExit(stage) ? { exit: EXIT_CODE[stage] } : { stage: STAGE_CODE[stage] }),
    };
    candidatesApi
      .list(query)
      .then((r) => {
        if (!live) return;
        setRows(r);
        setLoadError('');
      })
      .catch((e) => live && setLoadError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [loc, needle, jobId, stage, source, page, reload]);

  useEffect(() => {
    let live = true;
    candidatesApi
      .summary(loc)
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [loc, reload]);

  // The job filter lists the jobs the caller may see here (Jobs → View).
  useEffect(() => {
    if (!seesJobs) return;
    let live = true;
    jobsApi
      .all(loc)
      .then((j) => live && setJobs(j))
      .catch(() => live && setJobs([]));
    return () => {
      live = false;
    };
  }, [loc, seesJobs]);

  const filtered = !!needle || jobId !== 'All' || stage !== 'All' || source !== 'All';
  const lastPage = rows ? Math.max(1, Math.ceil(rows.total / PAGE_SIZE)) : 1;
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
          canAdd ? (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <PlusIcon /> Add candidate
            </Button>
          ) : undefined
        }
      />
      {loadError && (
        <Banner tone="warn">
          Candidates could not be loaded: {loadError}{' '}
          <button type="button" className="btn sm ghost" onClick={() => setReload((n) => n + 1)}>
            Try again
          </button>
        </Banner>
      )}

      <StatStrip
        items={[
          { label: 'Candidates', value: summary?.total ?? '—', icon: <PeopleIcon />, tone: 'blue', hint: 'In the database' },
          { label: 'In the pipeline', value: summary?.inPipeline ?? '—', icon: <ClockIcon />, tone: 'purple', hint: 'Active applications' },
          { label: 'Hired', value: summary?.hired ?? '—', icon: <CheckIcon />, tone: 'green', hint: 'Became employees' },
          { label: 'Rejected', value: summary?.rejected ?? '—', icon: <UserXIcon />, tone: 'red', hint: 'Across all jobs' },
        ]}
      />

      <Card>
        <CardHeader title="All candidates" sub={rows ? `${rows.total} of ${summary?.total ?? rows.total}` : 'Loading…'} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} placeholder="Search name, email, company or tag…" />
          </div>
          {seesJobs && (
            <select
              value={jobId}
              onChange={(e) => {
                setJobId(e.target.value);
                setPage(1);
              }}
              className="chip"
              aria-label="Job"
            >
              <option value="All">All jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          )}
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value as Stage | Exit);
              setPage(1);
            }}
            className="chip"
            aria-label="Stage"
          >
            <option value="All">All stages</option>
            {[...STAGES, ...EXITS].map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value as Source);
              setPage(1);
            }}
            className="chip"
            aria-label="Source"
          >
            <option value="All">All sources</option>
            {SOURCES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>

        {!rows ? (
          !loadError && <div className="hm-col-empty" style={{ padding: '4px 20px 18px' }}>Loading…</div>
        ) : !rows.items.length ? (
          <EmptyState icon={<PeopleIcon />} title={filtered ? 'No candidates match' : 'No candidates yet'} description={filtered ? 'Try a different search or filter.' : 'Add a candidate to start building a pipeline.'} />
        ) : (
          <>
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
                  {rows.items.map((c) => (
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
                        {c.applications.length ? (
                          <div className="hm-apps">
                            {c.applications.map((a) => (
                              <div key={a.id}>
                                <span>{a.job.title}</span>
                                <StageBadge stage={STAGE_OF[a.stage]} exit={a.exit ? EXIT_OF[a.exit] : undefined} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="faint">Talent pool</span>
                        )}
                      </td>
                      <td className="mono">{c.experienceYears} yrs</td>
                      <td>
                        {SOURCE_OF[c.source]}
                        {c.agency && <div className="tx-s faint">{c.agency}</div>}
                      </td>
                      <td className="mono">{day(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.total > PAGE_SIZE && (
              <div className="pl-pager">
                <span className="tx-s faint">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(rows.total, page * PAGE_SIZE)} of {rows.total}
                </span>
                <span className="sp" />
                <button type="button" className="chip" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ← Previous
                </button>
                <span className="tx-s">
                  Page {page} of {lastPage}
                </span>
                <button type="button" className="chip" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      <ServerCandidateDrawer
        open={adding && canAdd}
        onClose={closeAdd}
        onDone={(_text, id) => {
          setAdding(false);
          router.push(`/hiring/candidates/${id}`);
        }}
      />
    </div>
  );
}
