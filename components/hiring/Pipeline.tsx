'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SearchIcon } from '@/components/icons';
import { Button } from '@/components/ui/Card';
import { StageBadge, RejectDialog, fmtDate, useActor } from '@/components/hiring/HiringBits';
import { InterviewDrawer, OfferDrawer } from '@/components/hiring/HiringForms';
import { Application, EXITS, Exit, Job, STAGES, Stage } from '@/lib/hiringTypes';
import { RuleKey } from '@/lib/hiringMail';
import { useStageMail } from '@/components/hiring/Mail';
import { appById, candById, daysSince, exitApplication, interviewsForApp, moveStage, offerForApp, reopenApplication, updateCandidateTags, useHiring } from '@/lib/hiringStore';

type Target = Stage | Exit;
const isExitTarget = (t: Target): t is Exit => (EXITS as readonly string[]).includes(t);

const lastMove = (a: Application) => a.history[a.history.length - 1]?.at ?? a.appliedAt;

/** The kanban board and the list view of one job's candidates. Drag a card to a column, or use the "Move to" menu
    (the keyboard-friendly way). On narrow screens only the list is shown. */
export function Pipeline({ job, apps, notify }: { job: Job; apps: Application[]; notify: (msg: string, tone?: 'info' | 'warn') => void }) {
  const s = useHiring();
  const actor = useActor();
  const mailer = useStageMail(notify);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const [over, setOver] = useState<Target | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [interviewFor, setInterviewFor] = useState<Application | null>(null);
  const [offerFor, setOfferFor] = useState<Application | null>(null);
  const [tagText, setTagText] = useState('');

  const needle = q.trim().toLowerCase();
  const shown = apps.filter((a) => {
    const c = candById(s, a.candidateId);
    return !needle || `${c?.name} ${c?.currentCompany} ${c?.currentTitle} ${c?.tags.join(' ')}`.toLowerCase().includes(needle);
  });
  const closed = job.status === 'Closed' || job.status === 'Filled';

  const move = (appId: string, to: Target) => {
    const a = appById(s, appId);
    const c = a && candById(s, a.candidateId);
    if (!a || !c) return;
    if (to === 'Rejected') return setRejecting([appId]);
    if (isExitTarget(to)) {
      if ((a.exit ?? null) === to) return;
      const r = exitApplication(appId, to, actor, to === 'Withdrawn' ? 'Withdrawn by candidate' : 'Paused');
      return notify(r.ok ? `${c.name} marked ${to.toLowerCase()}.` : r.error, r.ok ? 'info' : 'warn');
    }
    if (a.stage === to && !a.exit) return;
    mailer.request([appId], to as RuleKey, () => moveStage(appId, to, actor), `${c.name} moved to ${to}.`);
  };

  const bulkMove = (to: Target) => {
    const ids = [...picked];
    if (to === 'Rejected') return setRejecting(ids);
    const clear = () => setPicked(new Set());
    if (isExitTarget(to)) {
      let ok = 0;
      let firstError = '';
      ids.forEach((id) => {
        const r = exitApplication(id, to, actor, to === 'Withdrawn' ? 'Withdrawn by candidate' : 'Paused');
        if (r.ok) ok++;
        else firstError ||= r.error;
      });
      clear();
      return notify(firstError ? `${ok} of ${ids.length} moved. ${firstError}` : `${ok} candidate${ok === 1 ? '' : 's'} moved to ${to}.`, firstError ? 'warn' : 'info');
    }
    mailer.request(
      ids,
      to as RuleKey,
      () => {
        const moved: string[] = [];
        let firstError = '';
        ids.forEach((id) => {
          const r = moveStage(id, to, actor);
          if (r.ok) moved.push(id);
          else firstError ||= r.error;
        });
        clear();
        return { ok: moved.length > 0, error: firstError || undefined, moved };
      },
      (r) => (r.error ? `${r.moved?.length ?? 0} of ${ids.length} moved. ${r.error}` : `${ids.length} candidate${ids.length === 1 ? '' : 's'} moved to ${to}.`),
    );
  };

  const confirmReject = (reason: string, note: string) => {
    const ids = rejecting ?? [];
    setRejecting(null);
    setPicked(new Set());
    mailer.request(
      ids,
      'Rejected',
      () => {
        ids.forEach((id) => exitApplication(id, 'Rejected', actor, reason, note));
        return { ok: true };
      },
      `${ids.length} candidate${ids.length === 1 ? '' : 's'} rejected: ${reason}.`,
    );
  };

  const addTag = () => {
    const t = tagText.trim();
    if (!t) return;
    picked.forEach((id) => {
      const a = appById(s, id);
      const c = a && candById(s, a.candidateId);
      if (c && !c.tags.includes(t)) updateCandidateTags(c.id, [...c.tags, t]);
    });
    notify(`Tagged ${picked.size} candidate${picked.size === 1 ? '' : 's'} “${t}”.`);
    setTagText('');
    setPicked(new Set());
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const moveMenu = (a: Application) => (
    <select
      className="hm-move"
      aria-label={`Move ${candById(s, a.candidateId)?.name ?? 'candidate'} to a stage`}
      value=""
      disabled={closed || a.stage === 'Hired'}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '__reopen') {
          const r = reopenApplication(a.id, actor);
          notify(r.ok ? 'Candidate reopened.' : r.error, r.ok ? 'info' : 'warn');
        } else if (v) move(a.id, v as Target);
      }}
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
  );

  const renderCard = (a: Application) => {
    const c = candById(s, a.candidateId);
    if (!c) return null;
    const days = daysSince(lastMove(a));
    const ivs = interviewsForApp(s, a.id).filter((i) => i.status === 'Scheduled');
    const offer = offerForApp(s, a.id);
    return (
      <div
        className={`hm-card ${dragging === a.id ? 'drag' : ''}`}
        draggable={!closed && a.stage !== 'Hired'}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', a.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragging(a.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
      >
        <Link href={`/hiring/candidates/${c.id}`} className="hm-card-nm">
          {c.name}
        </Link>
        <div className="hm-card-sb">
          {c.currentTitle || '—'}
          {c.currentCompany ? ` · ${c.currentCompany}` : ''}
        </div>
        <div className="hm-card-meta">
          <span>{c.experienceYears} yrs</span>
          <span>{c.source}</span>
          <span>{days === 0 ? 'today' : `${days}d in stage`}</span>
        </div>
        {c.tags.length > 0 && (
          <div className="hm-tags">
            {c.tags.slice(0, 3).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
        {ivs[0] && (
          <div className="hm-card-note">
            {ivs[0].round}: {fmtDate(ivs[0].date)} {ivs[0].time}
          </div>
        )}
        {offer && <div className="hm-card-note">Offer {offer.code} · {offer.status}</div>}
        <div className="hm-card-act">
          {moveMenu(a)}
          {!a.exit && a.stage !== 'Hired' && a.stage !== 'Offer' && (
            <button type="button" className="hm-mini" onClick={() => setInterviewFor(a)} disabled={closed}>
              Interview
            </button>
          )}
          {a.stage === 'Offer' && !a.exit && !offer && (
            <button type="button" className="hm-mini" onClick={() => setOfferFor(a)} disabled={closed}>
              Create offer
            </button>
          )}
        </div>
      </div>
    );
  };

  const columns: { key: Target; exit: boolean }[] = [...STAGES.map((st) => ({ key: st as Target, exit: false })), ...EXITS.map((x) => ({ key: x as Target, exit: true }))];
  const inColumn = (t: Target) => shown.filter((a) => (isExitTarget(t) ? a.exit === t : !a.exit && a.stage === t));

  return (
    <div className="hm-wrap" data-view={view}>
      <div className="tbar">
        <div className="tsearch">
          <SearchIcon />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidates, companies or tags…" />
        </div>
        <span className="sp" />
        <div className="subseg hm-viewtoggle" role="group" aria-label="View" style={{ margin: 0 }}>
          <button type="button" className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>
            Board
          </button>
          <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
            List
          </button>
        </div>
      </div>

      <div className="hm-board" role="group" aria-label="Pipeline board">
        {columns.map(({ key, exit }) => {
          const list = inColumn(key);
          return (
            <section
              key={key}
              className={`hm-col ${exit ? 'exit' : ''} ${over === key ? 'over' : ''}`}
              onDragOver={(e) => {
                if (!dragging || closed) return;
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                setOver(null);
                setDragging(null);
                if (id) move(id, key);
              }}
            >
              <header>
                <b>{key}</b>
                <span>{list.length}</span>
              </header>
              <div className="hm-col-body">
                {list.map((a) => (
                  <div key={a.id}>{renderCard(a)}</div>
                ))}
                {!list.length && <div className="hm-col-empty">{exit ? 'Drop here' : 'No candidates'}</div>}
              </div>
            </section>
          );
        })}
      </div>

      <div className="hm-list">
        {picked.size > 0 && (
          <div className="hm-bulk" role="toolbar" aria-label="Bulk actions">
            <b>{picked.size} selected</b>
            <select
              aria-label="Move selected to"
              value=""
              onChange={(e) => e.target.value && bulkMove(e.target.value as Target)}
              className="chip"
            >
              <option value="">Move to…</option>
              {STAGES.filter((st) => st !== 'Hired').map((st) => (
                <option key={st}>{st}</option>
              ))}
              {EXITS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <Button size="sm" variant="danger" onClick={() => setRejecting([...picked])}>
              Reject
            </Button>
            <input className="hm-tag-in" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Tag…" aria-label="Tag to add" onKeyDown={(e) => e.key === 'Enter' && addTag()} />
            <Button size="sm" onClick={addTag} disabled={!tagText.trim()}>
              Add tag
            </Button>
            <button type="button" className="chip" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </div>
        )}
        {!shown.length ? (
          <div className="hm-col-empty" style={{ padding: 24 }}>
            No candidates yet.
          </div>
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={shown.length > 0 && shown.every((a) => picked.has(a.id))}
                      onChange={(e) => setPicked(e.target.checked ? new Set(shown.map((a) => a.id)) : new Set())}
                    />
                  </th>
                  <th>Candidate</th>
                  <th>Stage</th>
                  <th>Experience</th>
                  <th>Source</th>
                  <th>Applied</th>
                  <th>Move</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => {
                  const c = candById(s, a.candidateId);
                  if (!c) return null;
                  return (
                    <tr key={a.id}>
                      <td>
                        <input type="checkbox" aria-label={`Select ${c.name}`} checked={picked.has(a.id)} onChange={() => toggle(a.id)} />
                      </td>
                      <td>
                        <Link href={`/hiring/candidates/${c.id}`} className="hm-link">
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div className="tx-s faint">
                            {c.currentTitle}
                            {c.currentCompany ? ` · ${c.currentCompany}` : ''}
                          </div>
                        </Link>
                      </td>
                      <td>
                        <StageBadge stage={a.stage} exit={a.exit} />
                        {a.exitReason && <div className="tx-s faint">{a.exitReason}</div>}
                      </td>
                      <td className="mono">{c.experienceYears} yrs</td>
                      <td>{c.source}</td>
                      <td className="mono">{fmtDate(a.appliedAt)}</td>
                      <td>
                        {moveMenu(a)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mailer.dialog}
      <RejectDialog open={!!rejecting} count={rejecting?.length ?? 1} onCancel={() => setRejecting(null)} onConfirm={confirmReject} />
      <InterviewDrawer
        open={!!interviewFor}
        application={interviewFor ?? undefined}
        onClose={() => setInterviewFor(null)}
        onDone={(i) => {
          const app = interviewFor;
          setInterviewFor(null);
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
