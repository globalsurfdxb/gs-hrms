'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { ArrowLeftIcon, PeopleIcon, XIcon } from '@/components/icons';
import { Banner, Hero, RejectDialog, StageBadge, TEXTAREA_STYLE, fmtDate, money, payUnit, useHiringLocation } from '@/components/hiring/HiringBits';
import { ApiError, errorMessage } from '@/lib/api';
import { can } from '@/lib/access';
import { usePermissions } from '@/lib/auth';
import { EXITS, Exit, STAGES, Stage } from '@/lib/hiringTypes';
import { type ServerJob, jobsApi } from '@/lib/jobsApi';
import { MODE_OF, type ServerInterview, interviewsApi } from '@/lib/interviewsApi';
import {
  EXIT_CODE,
  EXIT_OF,
  ROUND_OF,
  SOURCE_OF,
  STAGE_CODE,
  STAGE_OF,
  type Money,
  type ServerApplicationDetail,
  type ServerCandidateDetail,
  type ServerStage,
  asCandidateApplication,
  candidatesApi,
  pipelineApi,
  stepLabel,
} from '@/lib/candidatesApi';

/* A candidate's profile from the backend (local development). The same page as app/hiring/candidates/[id], over
   GET /hiring/candidates/:id: without full hiring access only candidates on your own jobs, with only those
   applications (BR-HIR-022); anyone else is "not found". Salary shows only when the server sends it
   (viewer.canSeeSalary). Tags, notes and moves need Candidates → Edit (viewer.canEdit); "Apply to another job" needs
   Candidates → Add. Scheduled interviews come from /hiring/interviews (Interviews → View). Emails, pre-offer
   documents, offers and the employee link stay hidden until those parts are connected. */

type CandidateApp = ServerCandidateDetail['applications'][number];
type Target = Stage | Exit | '__reopen';

const MAX_TAGS = 20;

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
/** Server instants, in the viewer's local time. */
const day = (iso: string) => fmtDate(new Date(iso).toLocaleDateString('en-CA'));
const stamp = (iso: string) => `${day(iso)}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

interface Event {
  id: string;
  at: string;
  text: React.ReactNode;
  kind: 'stage' | 'interview' | 'note' | 'system';
}

export function ServerCandidateProfile({ id }: { id: string }) {
  const perms = usePermissions() ?? [];
  const { locations } = useHiringLocation();
  const seesCandidates = can(perms, 'hiring:recruiting:candidates');
  const seesInterviews = can(perms, 'hiring:recruiting:interviews');
  const seesJobs = can(perms, 'hiring:recruiting:jobs');
  const [c, setC] = useState<ServerCandidateDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [interviews, setInterviews] = useState<ServerInterview[]>([]);
  const [openJobs, setOpenJobs] = useState<ServerJob[]>([]);
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');
  const [applyJob, setApplyJob] = useState('');
  const [busy, setBusy] = useState(false);
  const notify = (text: string, tone: 'info' | 'warn' = 'info') => setMsg({ text, tone });

  useEffect(() => {
    let live = true;
    candidatesApi
      .get(id)
      .then((x) => {
        if (!live) return;
        setC(x);
        setLoadError('');
      })
      .catch((e) => {
        if (!live) return;
        // Not there, not a candidate id, or not yours to see: all the same to the viewer.
        if (e instanceof ApiError && [400, 403, 404].includes(e.status)) setMissing(true);
        else setLoadError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [id, reload]);

  // Interviews of each application (asked again when an application is added).
  const appKey = c ? c.applications.map((a) => a.id).join(',') : '';
  useEffect(() => {
    if (!seesInterviews || !appKey) return;
    let live = true;
    Promise.all(appKey.split(',').map((a) => interviewsApi.forApplication(a)))
      .then((lists) => live && setInterviews(lists.flat()))
      .catch(() => live && setInterviews([]));
    return () => {
      live = false;
    };
  }, [appKey, seesInterviews]);

  // Open jobs in the candidate's location, for "Apply to another job".
  const canApply = !!c?.viewer.canAddApplication && seesJobs;
  const candidateLocation = c?.location.id;
  useEffect(() => {
    if (!canApply || !candidateLocation) return;
    let live = true;
    jobsApi
      .open(candidateLocation)
      .then((j) => live && setOpenJobs(j))
      .catch(() => live && setOpenJobs([]));
    return () => {
      live = false;
    };
  }, [canApply, candidateLocation]);

  const back = seesCandidates ? { href: '/hiring/candidates', label: 'Back to candidates' } : { href: '/my/interviews', label: 'Back to my interviews' };

  if (missing) {
    return (
      <div className="hm-page">
        <Card>
          <EmptyState icon={<PeopleIcon />} title="Candidate not found" description="They may have been removed, or you are not on the panel or hiring team for them." />
          <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
            <Link href={back.href} className="btn ghost">
              {back.label}
            </Link>
          </div>
        </Card>
      </div>
    );
  }
  if (!c) {
    return (
      <div className="hm-page">
        <Link href={back.href} className="hub-back">
          <ArrowLeftIcon />
          {back.label}
        </Link>
        {loadError ? (
          <Banner tone="warn">
            The candidate could not be loaded: {loadError}{' '}
            <button type="button" className="btn sm ghost" onClick={() => setReload((n) => n + 1)}>
              Try again
            </button>
          </Banner>
        ) : (
          <Card>
            <div className="hm-col-empty" style={{ padding: '18px 20px' }}>
              Loading…
            </div>
          </Card>
        )}
      </div>
    );
  }

  const apps = c.applications;
  const canEdit = c.viewer.canEdit;
  const applied = new Set(apps.map((a) => a.job.id));
  const jobsToApply = canApply ? openJobs.filter((j) => !applied.has(j.id)) : [];
  const cur = c.currentSalary?.currency ?? c.expectedSalary?.currency ?? locations.find((l) => l.id === c.location.id)?.currency ?? 'AED';
  const pay = (m?: Money | null) => money(m ? Number(m.amount) : undefined, m?.currency ?? cur);

  const events: Event[] = [
    { id: 'added', at: c.createdAt, kind: 'system' as const, text: <>Added by <b>{c.createdBy.name}</b> from {SOURCE_OF[c.source]}</> },
    ...apps.flatMap((a) =>
      a.history.map<Event>((h) => ({
        id: h.id,
        at: h.at,
        kind: 'stage',
        text:
          h.from === null ? (
            <>
              Applied to <b>{a.job.title}</b>
            </>
          ) : (
            <>
              {a.job.title}: {stepLabel(h.from)} → <b>{stepLabel(h.to)}</b> by {h.by}
              {h.note ? <span className="faint"> · {h.note}</span> : null}
            </>
          ),
      })),
    ),
    ...interviews.map<Event>((i) => ({
      id: i.id,
      at: i.createdAt,
      kind: 'interview',
      text: (
        <>
          {ROUND_OF[i.round]} scheduled for{' '}
          <b>
            {fmtDate(i.date)} {i.time}
          </b>{' '}
          with {i.panel.map((p) => p.name).join(', ')}
          {i.status !== 'SCHEDULED' ? <span className="faint"> · {i.status.toLowerCase()}</span> : null}
        </>
      ),
    })),
    ...c.notes.map<Event>((n) => ({
      id: n.id,
      at: n.at,
      kind: 'note',
      text: (
        <>
          <b>{n.by.name}</b>: {n.text}
        </>
      ),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  /** One call at a time; the answer replaces what it changed, a refusal is shown as it came. */
  const run = async (call: () => Promise<void>, done?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await call();
      if (done) notify(done);
    } catch (e) {
      notify(errorMessage(e), 'warn');
    } finally {
      setBusy(false);
    }
  };
  const patch = (d: ServerApplicationDetail) => setC((p) => (p ? { ...p, applications: p.applications.map((a) => (a.id === d.id ? asCandidateApplication(d) : a)) } : p));

  const move = (a: CandidateApp, to: Target) => {
    if (to === '__reopen') return run(async () => patch(await pipelineApi.reopen(a.id)), 'Candidate reopened.');
    if (to === 'Rejected') return setRejecting(a.id);
    if ((EXITS as readonly string[]).includes(to)) {
      const exit = to as Exit;
      return run(async () => patch(await pipelineApi.exit(a.id, EXIT_CODE[exit], exit === 'Withdrawn' ? 'Withdrawn by candidate' : 'Paused')), `Marked ${exit.toLowerCase()}.`);
    }
    return run(async () => patch(await pipelineApi.move(a.id, STAGE_CODE[to as Stage] as Exclude<ServerStage, 'HIRED'>)), `Moved to ${to}.`);
  };

  const saveTags = (tags: string[]) => run(async () => setC(await candidatesApi.setTags(c.id, tags)));
  const addTag = () => {
    const t = tag.trim();
    setTag('');
    if (!t || c.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (c.tags.length >= MAX_TAGS) return notify(`A candidate can have at most ${MAX_TAGS} tags.`, 'warn');
    saveTags([...c.tags, t]);
  };

  const addNote = () =>
    run(async () => {
      setC(await candidatesApi.addNote(c.id, note.trim()));
      setNote('');
    });

  const apply = () =>
    run(async () => {
      const d = await candidatesApi.apply(c.id, applyJob);
      setC((p) => (p ? { ...p, applications: [asCandidateApplication(d), ...p.applications] } : p));
      setApplyJob('');
    }, 'Added to the job at Applied.');

  return (
    <div className="hm-page">
      <Link href={back.href} className="hub-back">
        <ArrowLeftIcon />
        {back.label}
      </Link>
      <Hero
        icon={<Avatar initials={initials(c.name)} seed={c.name} size={56} />}
        title={c.name}
        badges={
          <>
            {apps.slice(0, 3).map((a) => (
              <StageBadge key={a.id} stage={STAGE_OF[a.stage]} exit={a.exit ? EXIT_OF[a.exit] : undefined} />
            ))}
          </>
        }
        meta={[c.currentTitle || 'No current title', c.currentCompany, c.currentCity, c.email, c.phone].filter(Boolean)}
        stats={[
          { label: 'Experience', value: `${c.experienceYears} yrs`, hint: `Notice ${c.noticeDays} days` },
          { label: 'Applications', value: apps.length, hint: apps.length === 1 ? '1 job' : `${apps.length} jobs` },
          { label: 'Source', value: SOURCE_OF[c.source], hint: c.referrer ? `by ${c.referrer.name}` : (c.agency ?? undefined) },
          { label: 'Added', value: day(c.createdAt), hint: `by ${c.createdBy.name}` },
        ]}
      />
      {msg && (
        <Banner tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Banner>
      )}

      <div className="hm-grid hm-grid-wide">
        <div className="hm-stack">
          <Card>
            <CardHeader title="Profile details" />
            <div style={{ padding: '0 20px 18px' }}>
              <div className="tx-read">
                <div className="l">Source</div>
                <div className="v">
                  {SOURCE_OF[c.source]}
                  {c.referrer ? ` · ${c.referrer.name}` : ''}
                  {c.agency ? ` · ${c.agency}` : ''}
                </div>
              </div>
              {c.location.id !== 'Kochi' && (
                <div className="tx-read">
                  <div className="l">Visa / work permit</div>
                  <div className="v">{c.visaStatus || '—'}</div>
                </div>
              )}
              {c.viewer.canSeeSalary ? (
                <>
                  <div className="tx-read">
                    <div className="l">Current salary ({payUnit(cur)})</div>
                    <div className="v">{pay(c.currentSalary)}</div>
                  </div>
                  <div className="tx-read">
                    <div className="l">Expected salary ({payUnit(cur)})</div>
                    <div className="v">{pay(c.expectedSalary)}</div>
                  </div>
                </>
              ) : (
                <div className="tx-read">
                  <div className="l">Salary</div>
                  <div className="v faint">Visible to HR and the hiring manager only</div>
                </div>
              )}
              <div className="tx-read">
                <div className="l">CV</div>
                <div className="v">{c.cvName ? <span className="hm-file">{c.cvName}</span> : '—'}</div>
              </div>
              <div className="tx-read">
                <div className="l">Links</div>
                <div className="v">{c.links || '—'}</div>
              </div>
              <div className="tx-read">
                <div className="l">Data consent</div>
                <div className="v">Given · {day(c.consentGivenAt)}</div>
              </div>
              <div className="tx-read">
                <div className="l">Tags</div>
                <div className="v">
                  <div className="hm-tags big">
                    {c.tags.map((t) => (
                      <span key={t}>
                        {t}
                        {canEdit && (
                          <button type="button" aria-label={`Remove tag ${t}`} disabled={busy} onClick={() => saveTags(c.tags.filter((x) => x !== t))}>
                            <XIcon />
                          </button>
                        )}
                      </span>
                    ))}
                    {!c.tags.length && <span className="faint">None</span>}
                  </div>
                  {canEdit && (
                    <form
                      className="hm-tagform"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addTag();
                      }}
                    >
                      <input value={tag} maxLength={40} onChange={(e) => setTag(e.target.value)} placeholder="Add a tag" aria-label="Add a tag" />
                      <Button size="sm" type="submit" disabled={!tag.trim() || busy}>
                        Add
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="hm-stack">
          <Card>
            <CardHeader title="Applications" sub={`${apps.length} job${apps.length === 1 ? '' : 's'}`} />
            {!apps.length && <EmptyState icon={<PeopleIcon />} title="In the talent pool" description="Not applied to any job yet." />}
            <div className="hm-appcards">
              {apps.map((a) => {
                const stage = STAGE_OF[a.stage];
                const at = STAGES.indexOf(stage);
                return (
                  <div key={a.id} className="hm-appcard">
                    <div className="hm-appcard-top">
                      <div>
                        <Link href={`/hiring/jobs/${a.job.id}`} className="lnk">
                          <b>{a.job.title}</b>
                        </Link>
                        <div className="sb">
                          {a.job.code} · applied {day(a.appliedAt)}
                        </div>
                      </div>
                      <StageBadge stage={stage} exit={a.exit ? EXIT_OF[a.exit] : undefined} />
                    </div>
                    {a.exit && a.exitReason && (
                      <div className="hm-card-note">
                        {EXIT_OF[a.exit]}: {a.exitReason}
                        {a.exitNote ? ` — ${a.exitNote}` : ''}
                      </div>
                    )}
                    <div className="hm-stagebar" aria-label="Stage progress">
                      {STAGES.map((st, i) => (
                        <span key={st} className={i <= at && !a.exit ? 'on' : i <= at ? 'was' : ''} title={st} />
                      ))}
                    </div>
                    {interviews
                      .filter((i) => i.application.id === a.id && i.status === 'SCHEDULED')
                      .map((i) => (
                        <div key={i.id} className="hm-card-note">
                          {ROUND_OF[i.round]}: {fmtDate(i.date)} {i.time} · {MODE_OF[i.mode]}
                        </div>
                      ))}
                    {canEdit && a.stage !== 'HIRED' && (
                      <div className="hm-card-act" style={{ marginTop: 10 }}>
                        <select className="hm-move" aria-label={`Move ${a.job.title} application`} value="" disabled={busy} onChange={(e) => e.target.value && move(a, e.target.value as Target)}>
                          <option value="">Move to…</option>
                          <optgroup label="Stage">
                            {STAGES.filter((st) => st !== 'Hired' && (st !== stage || a.exit)).map((st) => (
                              <option key={st}>{st}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Close out">
                            {EXITS.filter((x) => !a.exit || x !== EXIT_OF[a.exit]).map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </optgroup>
                          {a.exit && <option value="__reopen">Reopen at {a.exitFrom ? STAGE_OF[a.exitFrom] : 'Applied'}</option>}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {jobsToApply.length > 0 && (
              <div className="hm-apply">
                <select value={applyJob} onChange={(e) => setApplyJob(e.target.value)} aria-label="Apply to another job">
                  <option value="">Apply to another job…</option>
                  {jobsToApply.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.code} · {j.title} · {j.location.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!applyJob || busy} onClick={apply}>
                  Apply
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Notes" />
            {canEdit && (
              <form
                className="hm-noteform"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) addNote();
                }}
              >
                <textarea rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the hiring team…" style={TEXTAREA_STYLE} aria-label="New note" />
                <Button size="sm" type="submit" disabled={!note.trim() || busy}>
                  Add note
                </Button>
              </form>
            )}
            {!c.notes.length ? (
              <div className="hm-col-empty" style={{ padding: '4px 20px 18px' }}>
                No notes yet.
              </div>
            ) : (
              <div className="hm-notes">
                {c.notes.map((n) => (
                  <div key={n.id}>
                    <b>{n.by.name}</b> <small>{stamp(n.at)}</small>
                    <p>{n.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="row-gap">
        <CardHeader title="Activity timeline" sub={seesInterviews ? 'Stage changes, interviews and notes' : 'Stage changes and notes'} />
        <div className="hm-feed">
          {events.map((e) => (
            <div key={e.id} className="hm-feed-row">
              <span className={`dotm ${e.kind}`} />
              <div>
                {e.text}
                <small>{stamp(e.at)}</small>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <RejectDialog
        open={!!rejecting}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason, n) => {
          const appId = rejecting;
          setRejecting(null);
          if (appId) run(async () => patch(await pipelineApi.exit(appId, 'REJECTED', reason, n)), `Rejected: ${reason}.`);
        }}
      />
    </div>
  );
}
