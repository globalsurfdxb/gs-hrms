'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { ArrowLeftIcon, PeopleIcon, XIcon } from '@/components/icons';
import { Banner, Hero, OfferBadge, RejectDialog, StageBadge, TEXTAREA_STYLE, empName, fmtDate, fmtDateTime, money, payUnit, useActor } from '@/components/hiring/HiringBits';
import { InterviewDrawer, OfferDrawer } from '@/components/hiring/HiringForms';
import { DocsChip, DocsPanel } from '@/components/hiring/DocCollection';
import { docRequestFor, docsCleared, useDocRequests } from '@/lib/hiringDocs';
import { ComposeDrawer, MailList, useStageMail } from '@/components/hiring/Mail';
import { RuleKey, messagesFor, useHiringMail } from '@/lib/hiringMail';
import { useScoped } from '@/components/hiring/useScoped';
import { canSeeSalary } from '@/lib/hiringAccess';
import {
  addCandidateNote,
  appById,
  appsForCandidate,
  applyToJob,
  canViewCandidate,
  candById,
  exitApplication,
  getHiring,
  interviewsForApp,
  jobById,
  moveStage,
  offerForApp,
  reopenApplication,
  updateCandidateTags,
} from '@/lib/hiringStore';
import { Application, EXITS, Exit, STAGES, Stage } from '@/lib/hiringTypes';

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

interface Event {
  id: string;
  at: string;
  text: React.ReactNode;
  kind: 'stage' | 'interview' | 'note' | 'offer' | 'system';
}

export default function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { s, level, me } = useScoped();
  const actor = useActor();
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Application | null>(null);
  const [offerFor, setOfferFor] = useState<Application | null>(null);
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');
  const [applyJob, setApplyJob] = useState('');
  const notify = (text: string, tone: 'info' | 'warn' = 'info') => setMsg({ text, tone });
  const mailer = useStageMail(notify, (id) => setScheduleFor(appById(getHiring(), id) ?? null));
  const mail = useHiringMail();
  const docReqs = useDocRequests();
  const [composing, setComposing] = useState(false);

  const c = candById(s, id);
  if (!c || !canViewCandidate(s, level, me.id, c.id)) {
    return (
      <div className="hm-page">
        <Card>
          <EmptyState icon={<PeopleIcon />} title="Candidate not found" description="They may have been removed, or you are not on the panel or hiring team for them." />
          <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
            <Link href="/hiring/candidates" className="btn ghost">
              Back to candidates
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const apps = appsForCandidate(s, c.id);
  // HR/Admin may act on everything; a hiring manager only on their own jobs; an interviewer only reads.
  const manages = (a: Application) => level === 'full' || (level === 'manager' && jobById(s, a.jobId)?.hiringManagerId === me.id);
  const seesPay = level === 'full' || apps.some((a) => canSeeSalary(level, me.id, jobById(s, a.jobId)?.hiringManagerId ?? ''));
  const canAct = apps.some(manages) || level === 'full';
  const applied = new Set(apps.map((a) => a.jobId));
  const jobsToApply = s.jobs.filter((j) => j.status === 'Open' && j.location === c.location && !applied.has(j.id) && (level === 'full' || j.hiringManagerId === me.id));

  const events: Event[] = [
    { id: 'added', at: c.createdAt, kind: 'system' as const, text: <>Added by <b>{c.createdBy}</b> from {c.source}</> },
    ...apps.flatMap((a) =>
      a.history.map<Event>((h) => ({
        id: h.id,
        at: h.at,
        kind: 'stage',
        text:
          h.from === '—' ? (
            <>
              Applied to <b>{jobById(s, a.jobId)?.title}</b>
            </>
          ) : (
            <>
              {jobById(s, a.jobId)?.title}: {h.from} → <b>{h.to}</b> by {h.by}
              {h.note ? <span className="faint"> · {h.note}</span> : null}
            </>
          ),
      })),
    ),
    ...apps.flatMap((a) =>
      interviewsForApp(s, a.id).map<Event>((i) => ({
        id: i.id,
        at: i.createdAt,
        kind: 'interview',
        text: (
          <>
            {i.round} scheduled for <b>{fmtDate(i.date)} {i.time}</b> with {i.panelIds.map(empName).join(', ')}
            {i.status !== 'Scheduled' ? <span className="faint"> · {i.status.toLowerCase()}</span> : null}
          </>
        ),
      })),
    ),
    ...apps.flatMap((a) => {
      const o = offerForApp(s, a.id);
      return o ? [{ id: o.id, at: o.respondedAt ?? o.createdAt, kind: 'offer' as const, text: <>Offer {o.code} is <b>{o.status.toLowerCase()}</b></> }] : [];
    }),
    ...messagesFor(mail, c.id).map<Event>((m) => ({ id: m.id, at: m.at, kind: 'offer', text: <>Email “{m.subject}” sent to {m.to}<span className="faint"> · {m.trigger}</span></> })),
    ...c.notes.map<Event>((n) => ({ id: n.id, at: n.at, kind: 'note', text: <><b>{n.by}</b>: {n.text}</> })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const move = (a: Application, to: Stage | Exit | '__reopen') => {
    if (to === '__reopen') {
      const r = reopenApplication(a.id, actor);
      return notify(r.ok ? 'Candidate reopened.' : r.error, r.ok ? 'info' : 'warn');
    }
    if (to === 'Rejected') return setRejecting(a.id);
    if ((EXITS as readonly string[]).includes(to)) {
      const r = exitApplication(a.id, to as Exit, actor, to === 'Withdrawn' ? 'Withdrawn by candidate' : 'Paused');
      return notify(r.ok ? `Marked ${to.toLowerCase()}.` : r.error, r.ok ? 'info' : 'warn');
    }
    mailer.request([a.id], to as RuleKey, () => moveStage(a.id, to as Stage, actor), `Moved to ${to}.`);
  };

  return (
    <div className="hm-page">
      <Link href={level === 'none' ? '/my/interviews' : '/hiring/candidates'} className="hub-back">
        <ArrowLeftIcon />
        {level === 'none' ? 'Back to my interviews' : 'Back to candidates'}
      </Link>
      <Hero
        icon={<Avatar initials={initials(c.name)} seed={c.name} size={56} />}
        title={c.name}
        badges={
          <>
            {apps.slice(0, 3).map((a) => (
              <StageBadge key={a.id} stage={a.stage} exit={a.exit} />
            ))}
          </>
        }
        meta={[c.currentTitle || 'No current title', c.currentCompany, c.currentCity, c.email, c.phone].filter(Boolean)}
        actions={
          <>
            {canAct && <Button onClick={() => setComposing(true)}>Send email</Button>}
            {c.employeeId && (
              <Link href={`/directory/${c.employeeId}`} className="btn primary">
                Employee record {c.employeeId}
              </Link>
            )}
          </>
        }
        stats={[
          { label: 'Experience', value: `${c.experienceYears} yrs`, hint: `Notice ${c.noticeDays} days` },
          { label: 'Applications', value: apps.length, hint: apps.length === 1 ? '1 job' : `${apps.length} jobs` },
          { label: 'Source', value: c.source, hint: c.referrerId ? `by ${empName(c.referrerId)}` : c.agency },
          { label: 'Added', value: fmtDate(c.createdAt), hint: `by ${c.createdBy}` },
        ]}
      />
      {msg && <Banner tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Banner>}

      <div className="hm-grid hm-grid-wide">
        <div className="hm-stack">
          <Card>
            <CardHeader title="Profile details" />
            <div style={{ padding: '0 20px 18px' }}>
              <div className="tx-read"><div className="l">Source</div><div className="v">{c.source}{c.referrerId ? ` · ${empName(c.referrerId)}` : ''}{c.agency ? ` · ${c.agency}` : ''}</div></div>
              {c.location !== 'Kochi' && <div className="tx-read"><div className="l">Visa / work permit</div><div className="v">{c.visaStatus || '—'}</div></div>}
              {seesPay ? (
                <>
                  <div className="tx-read"><div className="l">Current salary ({payUnit(c.currency)})</div><div className="v">{money(c.currentSalary, c.currency)}</div></div>
                  <div className="tx-read"><div className="l">Expected salary ({payUnit(c.currency)})</div><div className="v">{money(c.expectedSalary, c.currency)}</div></div>
                </>
              ) : (
                <div className="tx-read"><div className="l">Salary</div><div className="v faint">Visible to HR and the hiring manager only</div></div>
              )}
              <div className="tx-read"><div className="l">CV</div><div className="v">{c.cvName ? <span className="hm-file">{c.cvName}</span> : '—'}</div></div>
              <div className="tx-read"><div className="l">Links</div><div className="v">{c.links || '—'}</div></div>
              <div className="tx-read"><div className="l">Data consent</div><div className="v">{c.consent.given ? `Given · ${fmtDate(c.consent.at)}` : 'Not recorded'}</div></div>
              <div className="tx-read">
                <div className="l">Tags</div>
                <div className="v">
                  <div className="hm-tags big">
                    {c.tags.map((t) => (
                      <span key={t}>
                        {t}
                        {canAct && (
                          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => updateCandidateTags(c.id, c.tags.filter((x) => x !== t))}>
                            <XIcon />
                          </button>
                        )}
                      </span>
                    ))}
                    {!c.tags.length && <span className="faint">None</span>}
                  </div>
                  {canAct && (
                    <form
                      className="hm-tagform"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = tag.trim();
                        if (t && !c.tags.includes(t)) updateCandidateTags(c.id, [...c.tags, t]);
                        setTag('');
                      }}
                    >
                      <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Add a tag" aria-label="Add a tag" />
                      <Button size="sm" type="submit" disabled={!tag.trim()}>
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
                const j = jobById(s, a.jobId);
                const offer = offerForApp(s, a.id);
                const ivs = interviewsForApp(s, a.id);
                const mine = manages(a);
                return (
                  <div key={a.id} className="hm-appcard">
                    <div className="hm-appcard-top">
                      <div>
                        <Link href={`/hiring/jobs/${a.jobId}`} className="lnk"><b>{j?.title}</b></Link>
                        <div className="sb">{j?.code} · applied {fmtDate(a.appliedAt)}</div>
                      </div>
                      <StageBadge stage={a.stage} exit={a.exit} />
                    </div>
                    {a.exitReason && <div className="hm-card-note">{a.exit}: {a.exitReason}{a.exitNote ? ` — ${a.exitNote}` : ''}</div>}
                    <div className="hm-stagebar" aria-label="Stage progress">
                      {STAGES.map((st, i) => (
                        <span key={st} className={i <= STAGES.indexOf(a.stage) && !a.exit ? 'on' : i <= STAGES.indexOf(a.stage) ? 'was' : ''} title={st} />
                      ))}
                    </div>
                    {ivs.filter((i) => i.status === 'Scheduled').map((i) => (
                      <div key={i.id} className="hm-card-note">{i.round}: {fmtDate(i.date)} {i.time} · {i.mode}</div>
                    ))}
                    {offer && (
                      <div className="hm-card-note">
                        Offer {offer.code} <OfferBadge status={offer.status} /> · {money(offer.total, offer.currency)} {payUnit(offer.currency)}
                      </div>
                    )}
                    {!a.exit && !offer && ['HR Interview', 'Offer'].includes(a.stage) && (
                      <div className="hm-card-note">
                        <DocsChip applicationId={a.id} />
                      </div>
                    )}
                    {mine && a.stage !== 'Hired' && (
                      <div className="hm-card-act" style={{ marginTop: 10 }}>
                        <select
                          className="hm-move"
                          aria-label={`Move ${j?.title} application`}
                          value=""
                          onChange={(e) => e.target.value && move(a, e.target.value as Stage | Exit | '__reopen')}
                        >
                          <option value="">Move to…</option>
                          <optgroup label="Stage">
                            {STAGES.filter((st) => st !== 'Hired' && (st !== a.stage || a.exit)).map((st) => (
                              <option key={st}>{st}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Close out">
                            {EXITS.filter((x) => x !== a.exit).map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </optgroup>
                          {a.exit && <option value="__reopen">Reopen at {a.exitFrom ?? 'Applied'}</option>}
                        </select>
                        {!a.exit && a.stage !== 'Offer' && (
                          <button type="button" className="hm-mini" onClick={() => setScheduleFor(a)}>
                            Schedule interview
                          </button>
                        )}
                        {!a.exit && a.stage === 'Offer' && !offer && (
                          <button type="button" className="hm-mini" onClick={() => setOfferFor(a)} disabled={!docsCleared(docReqs, a.id)} title={docsCleared(docReqs, a.id) ? undefined : 'Collect and verify the documents first (see Pre-offer documents below)'}>
                            Create offer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {canAct && jobsToApply.length > 0 && (
              <div className="hm-apply">
                <select value={applyJob} onChange={(e) => setApplyJob(e.target.value)} aria-label="Apply to another job">
                  <option value="">Apply to another job…</option>
                  {jobsToApply.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.code} · {j.title} · {j.location}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!applyJob}
                  onClick={() => {
                    const r = applyToJob(c.id, applyJob, actor);
                    notify(r.ok ? 'Added to the job at Applied.' : r.error, r.ok ? 'info' : 'warn');
                    setApplyJob('');
                  }}
                >
                  Apply
                </Button>
              </div>
            )}
          </Card>

          {apps
            .filter((a) => !a.exit && a.stage !== 'Hired' && (['HR Interview', 'Offer'].includes(a.stage) || docRequestFor(docReqs, a.id)))
            .map((a) => (
              <DocsPanel key={a.id} application={a} candidate={c} canAct={manages(a)} notify={notify} />
            ))}

          <Card>
            <CardHeader title="Emails" sub={`${messagesFor(mail, c.id).length} sent`} action={canAct ? <button type="button" className="lnk" onClick={() => setComposing(true)}>Write email →</button> : undefined} />
            <MailList messages={messagesFor(mail, c.id)} empty="No emails sent to this candidate yet." />
          </Card>

          <Card>
            <CardHeader title="Notes" />
            {canAct && (
              <form
                className="hm-noteform"
                onSubmit={(e) => {
                  e.preventDefault();
                  addCandidateNote(c.id, note, actor);
                  setNote('');
                }}
              >
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the hiring team…" style={TEXTAREA_STYLE} aria-label="New note" />
                <Button size="sm" type="submit" disabled={!note.trim()}>
                  Add note
                </Button>
              </form>
            )}
            {!c.notes.length ? (
              <div className="hm-col-empty" style={{ padding: '4px 20px 18px' }}>No notes yet.</div>
            ) : (
              <div className="hm-notes">
                {c.notes.map((n) => (
                  <div key={n.id}>
                    <b>{n.by}</b> <small>{fmtDateTime(n.at)}</small>
                    <p>{n.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="row-gap">
        <CardHeader title="Activity timeline" sub="Stage changes, interviews, offers and notes" />
        <div className="hm-feed">
          {events.map((e) => (
            <div key={e.id} className="hm-feed-row">
              <span className={`dotm ${e.kind}`} />
              <div>
                {e.text}
                <small>{fmtDateTime(e.at)}</small>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {mailer.dialog}
      <ComposeDrawer candidate={c} open={composing} onClose={() => setComposing(false)} onSent={(m) => { setComposing(false); notify(`Email “${m.subject}” logged (sandbox, nothing was delivered).`); }} />
      <RejectDialog
        open={!!rejecting}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason, n) => {
          const id = rejecting;
          setRejecting(null);
          if (id)
            mailer.request(
              [id],
              'Rejected',
              () => {
                exitApplication(id, 'Rejected', actor, reason, n);
                return { ok: true };
              },
              `Rejected: ${reason}.`,
            );
        }}
      />
      <InterviewDrawer
        open={!!scheduleFor}
        application={scheduleFor ?? undefined}
        onClose={() => setScheduleFor(null)}
        onDone={(i) => {
          const app = scheduleFor;
          setScheduleFor(null);
          const title = `${i.round} scheduled for ${fmtDate(i.date)} at ${i.time}.`;
          if (app) mailer.after(app.id, 'Interview scheduled', { interview: i }, title);
          else notify(title);
        }}
      />
      <OfferDrawer
        application={offerFor}
        onClose={() => setOfferFor(null)}
        onDone={() => {
          setOfferFor(null);
          notify('Offer saved. Mark it sent from the Offers page.');
        }}
      />
    </div>
  );
}
