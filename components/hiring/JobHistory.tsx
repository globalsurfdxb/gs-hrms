'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { HistoryIcon } from '@/components/icons';
import { empName, fmtDate, fmtDateTime } from '@/components/hiring/HiringBits';
import { appsForJob, candById, interviewsForApp, useHiring } from '@/lib/hiringStore';
import { useHiringMail } from '@/lib/hiringMail';
import { Job } from '@/lib/hiringTypes';

type Kind = 'job' | 'candidate' | 'interview' | 'offer' | 'email';

interface Entry {
  id: string;
  at: string;
  by: string;
  kind: Kind;
  text: React.ReactNode;
}

const KIND_LABEL: Record<Kind, string> = { job: 'Job', candidate: 'Candidates', interview: 'Interviews', offer: 'Offers', email: 'Emails' };

/** Everything that has happened on a job, newest first: changes to the job, candidates joining and moving, interviews,
    offers and the emails sent about them. Built from the records themselves, so nothing is entered twice. */
export function JobHistory({ job }: { job: Job }) {
  const s = useHiring();
  const mail = useHiringMail();
  const [kind, setKind] = useState<'all' | Kind>('all');

  const entries = useMemo(() => {
    const out: Entry[] = [];
    // The job's own changes. Jobs saved before history was kept start from their creation.
    const own = job.history?.length ? job.history : [{ id: 'created', at: job.createdAt, by: job.createdBy, text: 'Job created' }];
    own.forEach((h) => out.push({ id: `j-${h.id}`, at: h.at, by: h.by, kind: 'job', text: h.text }));

    const apps = appsForJob(s, job.id);
    const appIds = new Set(apps.map((a) => a.id));
    apps.forEach((a) => {
      const c = candById(s, a.candidateId);
      const who = c ? (
        <Link href={`/hiring/candidates/${c.id}`} className="lnk">
          {c.name}
        </Link>
      ) : (
        'Candidate'
      );
      a.history.forEach((h) =>
        out.push({
          id: `s-${h.id}`,
          at: h.at,
          by: h.by,
          kind: 'candidate',
          text:
            h.from === '—' ? (
              <>
                {who} applied{c ? ` (${c.source})` : ''}
              </>
            ) : (
              <>
                {who}: {h.from} → <b>{h.to}</b>
                {h.note ? <span className="faint"> · {h.note}</span> : null}
              </>
            ),
        }),
      );
      interviewsForApp(s, a.id).forEach((i) =>
        out.push({
          id: `i-${i.id}`,
          at: i.createdAt,
          by: i.scheduledBy,
          kind: 'interview',
          text: (
            <>
              {i.round} for {who} scheduled for <b>{fmtDate(i.date)} {i.time}</b> ({i.mode}) with {i.panelIds.map(empName).join(', ')}
              {i.status !== 'Scheduled' ? <span className="faint"> · now {i.status.toLowerCase()}</span> : null}
            </>
          ),
        }),
      );
    });
    s.offers
      .filter((o) => appIds.has(o.applicationId))
      .forEach((o) => {
        const a = apps.find((x) => x.id === o.applicationId);
        const c = a && candById(s, a.candidateId);
        out.push({ id: `o-${o.id}`, at: o.createdAt, by: o.createdBy, kind: 'offer', text: <>Offer {o.code} created for {c?.name}</> });
        if (o.respondedAt) out.push({ id: `or-${o.id}`, at: o.respondedAt, by: c?.name ?? 'Candidate', kind: 'offer', text: <>Offer {o.code} {o.status.toLowerCase()}</> });
        else if (o.status !== 'Draft') out.push({ id: `os-${o.id}`, at: o.updatedAt, by: o.createdBy, kind: 'offer', text: <>Offer {o.code} marked {o.status.toLowerCase()}</> });
      });
    mail.messages
      .filter((m) => m.applicationId && appIds.has(m.applicationId))
      .forEach((m) => out.push({ id: `m-${m.id}`, at: m.at, by: m.by, kind: 'email', text: <>Email “{m.subject}” to {candById(s, m.candidateId)?.name ?? m.to} <span className="faint">· {m.trigger}</span></> }));
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [s, mail.messages, job]);

  const shown = entries.filter((e) => kind === 'all' || e.kind === kind);
  const count = (k: Kind) => entries.filter((e) => e.kind === k).length;
  // Group by day so a long history stays readable.
  const days = [...new Set(shown.map((e) => e.at.slice(0, 10)))];

  return (
    <Card>
      <CardHeader title="Job history" sub={`${entries.length} event${entries.length === 1 ? '' : 's'} since ${fmtDate(job.createdAt)}`} />
      <div className="tbar">
        <button type="button" className={`chip ${kind === 'all' ? 'tx-chip-on' : ''}`} onClick={() => setKind('all')}>
          All · {entries.length}
        </button>
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button key={k} type="button" className={`chip ${kind === k ? 'tx-chip-on' : ''}`} onClick={() => setKind(k)}>
            {KIND_LABEL[k]} · {count(k)}
          </button>
        ))}
      </div>
      {!shown.length ? (
        <EmptyState icon={<HistoryIcon />} title="Nothing here yet" description="Changes to the job, its candidates, interviews, offers and emails are listed here as they happen." />
      ) : (
        <div className="hm-hist">
          {days.map((d) => (
            <section key={d}>
              <h4>{fmtDate(d)}</h4>
              {shown
                .filter((e) => e.at.slice(0, 10) === d)
                .map((e) => (
                  <div key={e.id} className="hm-feed-row">
                    <span className={`dotm ${e.kind}`} />
                    <div>
                      {e.text}
                      <small>
                        {e.by} · {fmtDateTime(e.at).split(', ')[1]}
                      </small>
                    </div>
                    <span className="hm-hist-k">{KIND_LABEL[e.kind]}</span>
                  </div>
                ))}
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
