'use client';

import { useEffect, useState } from 'react';
import { DateField } from '@/components/ui/DateField';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { ArrowRightIcon, ClockIcon, DownloadIcon, GridIcon, HistoryIcon, SearchIcon, UserIcon } from '@/components/icons';
import { errorMessage } from '@/lib/api';
import { AuditActor, AuditEvent, AuditFilter, actionLabel, auditApi, changeText } from '@/lib/auditApi';

/* Audit Logs read from the backend (local development): every change the server made, newest first, 50 at a time.
   Filtering and the CSV export happen on the server, so they cover the whole log, not just the loaded page. */

const PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dayOf = (at: string) => new Date(at).toLocaleDateString('en-CA'); // YYYY-MM-DD where the viewer is
const fmtDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeOf = (at: string) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const initials = (s: string) =>
  s
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

/** What the event is about: the person for sign-ins, otherwise the record (generated ids name only the kind). */
const subjectOf = (e: AuditEvent) => {
  if (e.action.startsWith('auth.')) return e.actor.label;
  if (!e.entityId) return e.module;
  return UUID.test(e.entityId) ? `${cap(e.entityType)} record` : `${cap(e.entityType)} ${e.entityId}`;
};

interface Loaded {
  key: string;
  items: AuditEvent[];
  total: number;
  page: number;
  error: string;
}

export function ServerAuditLog() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [mod, setMod] = useState('');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [options, setOptions] = useState<{ modules: string[]; actions: string[]; actors: AuditActor[] }>({ modules: [], actions: [], actors: [] });
  const [data, setData] = useState<Loaded>({ key: '', items: [], total: 0, page: 0, error: '' });
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');

  const filter: AuditFilter = { q: search, module: mod || undefined, action: action || undefined, actorId: actor || undefined, fromDay: from || undefined, toDay: to || undefined };
  const key = JSON.stringify(filter);
  const loading = data.key !== key;
  const filtering = !!search || !!mod || !!action || !!actor || !!from || !!to;

  // Search after the typing stops, so each keystroke is not a request.
  useEffect(() => {
    const id = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    auditApi
      .filters()
      .then(setOptions)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const f: AuditFilter = JSON.parse(key);
    auditApi
      .list(f, 1, PAGE)
      .then((r) => !cancelled && setData({ key, items: r.items, total: r.total, page: 1, error: '' }))
      .catch((e) => !cancelled && setData({ key, items: [], total: 0, page: 0, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const loadMore = async () => {
    setMore(true);
    try {
      const r = await auditApi.list(filter, data.page + 1, PAGE);
      setData((d) => (d.key === key ? { ...d, items: [...d.items, ...r.items], total: r.total, page: d.page + 1 } : d));
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setMore(false);
    }
  };

  const exportCsv = async () => {
    setNotice('');
    setExporting(true);
    try {
      const { text, filename } = await auditApi.exportCsv(filter);
      // The byte-order mark lets Excel open UTF-8 text (names, dashes) correctly.
      const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename ?? 'audit-log.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // 400 audit.export_too_large: more than 10,000 rows match.
      setNotice(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const clear = () => {
    setQ('');
    setSearch('');
    setMod('');
    setAction('');
    setActor('');
    setFrom('');
    setTo('');
  };

  const items = loading ? [] : data.items;
  const days = [...items.reduce((m, e) => m.set(dayOf(e.at), [...(m.get(dayOf(e.at)) ?? []), e]), new Map<string, AuditEvent[]>()).entries()];
  const latest = items[0];

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Audit Logs" description="Every change recorded by the server: who did what, when and to what — organization, access, sign-ins and data exports." />

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: filtering ? 'Matching events' : 'Events logged', value: loading ? '…' : data.total, icon: <HistoryIcon />, tone: 'blue' },
            { label: 'Areas covered', value: options.modules.length, icon: <GridIcon />, tone: 'teal' },
            { label: 'People who acted', value: options.actors.length, icon: <UserIcon />, tone: 'green' },
            { label: 'Latest event', value: latest ? dayOf(latest.at) : '—', icon: <ClockIcon />, tone: 'amber', hint: latest ? actionLabel(latest.action) : undefined },
          ]}
        />
      </div>

      <Card>
        <CardHeader
          title="Activity log"
          sub={loading ? 'Loading…' : `${plural(data.total, 'event')}, newest first`}
          action={
            <Button size="sm" onClick={exportCsv} disabled={loading || !data.total || exporting}>
              <DownloadIcon /> {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          }
        />
        {(notice || data.error) && (
          <div role="alert" style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: 'var(--danger)', background: 'var(--danger-50)' }}>
            {notice || data.error}
          </div>
        )}
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person, area, action or record…" />
          </div>
          <select className="ad-sel" value={mod} onChange={(e) => setMod(e.target.value)} aria-label="Area">
            <option value="">All areas</option>
            {options.modules.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select className="ad-sel" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action">
            <option value="">All actions</option>
            {options.actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
          <select className="ad-sel" value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Changed by">
            <option value="">Anyone</option>
            {options.actors
              .filter((a) => a.id)
              .map((a) => (
                <option key={a.id} value={a.id!}>
                  {a.label}
                </option>
              ))}
          </select>
          <label className="ad-date">
            From
            <DateField value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="ad-date">
            To
            <DateField value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          {(filtering || q) && (
            <Button size="sm" variant="ghost" onClick={clear}>
              Clear
            </Button>
          )}
        </div>

        {loading ? (
          <div className="ad-foot">Loading…</div>
        ) : days.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon />}
            title={filtering ? 'No events match' : 'No events logged yet'}
            description={filtering ? 'Try widening the date range or clearing a filter.' : 'Changes made through the server appear here with who made them and when.'}
          />
        ) : (
          days.map(([day, rows]) => (
            <div key={day}>
              <div className="ad-day">
                {fmtDay(day)}
                <span>{plural(rows.length, 'event')}</span>
              </div>
              {rows.map((e) => {
                const subject = subjectOf(e);
                return (
                  <div key={e.id} className="ad-log">
                    <div className="ad-log-who">
                      <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)', width: 34, height: 34, fontSize: 12, flex: 'none' }}>
                        {initials(subject)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="nm">{subject}</div>
                        <div className="sb">{`${e.module} event`}</div>
                      </div>
                    </div>
                    <div className="ad-diff">
                      <span className="sd-mod">{e.module}</span>
                      <span className="fld">{actionLabel(e.action)}</span>
                      <span className="v old">{changeText(e.before) || '—'}</span>
                      <ArrowRightIcon />
                      <span className="v new">{changeText(e.after) || '—'}</span>
                    </div>
                    <div className="ad-log-by">
                      <b>{e.actor.label}</b> at {timeOf(e.at)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        {!loading && days.length > 0 && (
          <div className="ad-foot">
            Showing {items.length} of {data.total} events
            {items.length < data.total && (
              <>
                {' · '}
                <Button size="sm" variant="ghost" onClick={loadMore} disabled={more}>
                  {more ? 'Loading…' : 'Load more'}
                </Button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
