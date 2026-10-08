'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AUDIT_LOG, employeeById } from '@/lib/data';
import { auditModuleOf, useEmployeeVersion } from '@/lib/employeeStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { ArrowRightIcon, ClockIcon, HistoryIcon, PeopleIcon, SearchIcon, UserIcon } from '@/components/icons';

const fmtDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
/** Events that are not about one employee use an id like 'role:HR' or 'request:lv-1'; show the part after the colon. */
const subjectOf = (id: string) => (id.includes(':') ? id.slice(id.indexOf(':') + 1) : id);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function AuditLogPage() {
  useEmployeeVersion();
  const [q, setQ] = useState('');
  const [field, setField] = useState('all');
  const [mod, setMod] = useState('all');
  const [user, setUser] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const entries = [...AUDIT_LOG].sort((a, b) => b.changedOn.localeCompare(a.changedOn));
  const fields = [...new Set(entries.map((a) => a.field))].sort();
  const modules = [...new Set(entries.map(auditModuleOf))].sort();
  const users = [...new Set(entries.map((a) => a.changedBy))].sort();
  const employeesTouched = new Set(entries.map((a) => a.employeeId).filter((id) => employeeById(id))).size;

  const needle = q.trim().toLowerCase();
  const filtered = entries.filter((a) => {
    const e = employeeById(a.employeeId);
    if (field !== 'all' && a.field !== field) return false;
    if (mod !== 'all' && auditModuleOf(a) !== mod) return false;
    if (user !== 'all' && a.changedBy !== user) return false;
    if (from && a.changedOn < from) return false;
    if (to && a.changedOn > to) return false;
    return !needle || `${e?.name ?? ''} ${e?.employeeCode ?? ''} ${a.employeeId} ${auditModuleOf(a)} ${a.field} ${a.from} ${a.to} ${a.changedBy}`.toLowerCase().includes(needle);
  });
  const filtering = !!needle || field !== 'all' || mod !== 'all' || user !== 'all' || !!from || !!to;

  const dayMap = new Map<string, typeof filtered>();
  filtered.forEach((a) => dayMap.set(a.changedOn, [...(dayMap.get(a.changedOn) ?? []), a]));
  const days = [...dayMap.entries()];

  const clear = () => {
    setQ('');
    setField('all');
    setMod('all');
    setUser('all');
    setFrom('');
    setTo('');
  };

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Audit Logs" description="Who changed what, when — employee record edits, salary and bank changes, role and permission changes, and approvals." />

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Changes logged', value: entries.length, icon: <HistoryIcon />, tone: 'blue' },
            { label: 'Employees affected', value: employeesTouched, icon: <PeopleIcon />, tone: 'purple' },
            { label: 'People who edited', value: users.length, icon: <UserIcon />, tone: 'green' },
            { label: 'Latest change', value: entries[0] ? entries[0].changedOn : '—', icon: <ClockIcon />, tone: 'amber', hint: entries[0]?.field },
          ]}
        />
      </div>

      <Card>
        <CardHeader title="Recent changes" sub={`${entries.length} entries, newest first`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee, field or value…" />
          </div>
          <select className="ad-sel" value={mod} onChange={(e) => setMod(e.target.value)} aria-label="Module">
            <option value="all">All modules</option>
            {modules.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select className="ad-sel" value={field} onChange={(e) => setField(e.target.value)} aria-label="Field">
            <option value="all">All fields</option>
            {fields.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select className="ad-sel" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Changed by">
            <option value="all">Anyone</option>
            {users.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <label className="ad-date">
            From
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="ad-date">
            To
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          {filtering && (
            <Button size="sm" variant="ghost" onClick={clear}>
              Clear
            </Button>
          )}
        </div>

        {days.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon />}
            title={filtering ? 'No changes match' : 'No changes logged yet'}
            description={filtering ? 'Try widening the date range or clearing a filter.' : 'Edits to employee records will appear here with who made them and when.'}
          />
        ) : (
          days.map(([day, rows]) => (
            <div key={day}>
              <div className="ad-day">
                {fmtDay(day)}
                <span>{plural(rows.length, 'change')}</span>
              </div>
              {rows.map((a) => {
                const e = employeeById(a.employeeId);
                const m = auditModuleOf(a);
                const who = (
                  <>
                    <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)', width: 34, height: 34, fontSize: 12, flex: 'none' }}>
                      {e?.avatarInitials ?? m.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{e?.name ?? subjectOf(a.employeeId)}</div>
                      <div className="sb">{e ? `${e.employeeCode} · ${e.designation}` : `${m} event`}</div>
                    </div>
                  </>
                );
                return (
                  <div key={a.id} className="ad-log">
                    {e ? (
                      <Link href={`/directory/${a.employeeId}`} className="ad-log-who">
                        {who}
                      </Link>
                    ) : (
                      <div className="ad-log-who">{who}</div>
                    )}
                    <div className="ad-diff">
                      <span className="sd-mod">{m}</span>
                      <span className="fld">{a.field}</span>
                      <span className="v old">{a.from || '—'}</span>
                      <ArrowRightIcon />
                      <span className="v new">{a.to || '—'}</span>
                    </div>
                    <div className="ad-log-by">
                      <b>{a.changedBy}</b>
                      {m === 'Employee' || m === 'Bank' || m === 'Salary' || m === 'Documents' ? 'edited this field' : 'made this change'}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        {days.length > 0 && (
          <div className="ad-foot">{filtering ? `Showing ${filtered.length} of ${entries.length} entries` : `${plural(entries.length, 'entry', 'entries')}`}</div>
        )}
      </Card>
    </div>
  );
}
