'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { EMPLOYEES, REFERENCE_TODAY, directReports, employeeById, matchesEmployee } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { RUNGS, useVisa } from '@/context/VisaContext';
import { Employee, ExpiryState } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { ExpiryBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { EmpId } from '@/components/ui/EmployeeBits';
import { BellIcon, SearchIcon, ShieldIcon, XIcon } from '@/components/icons';

const SORTED_RUNGS = [...RUNGS].sort((a, b) => b - a);
const FILTERS: { key: 'All' | ExpiryState; label: string }[] = [
  { key: 'All', label: 'All statuses' },
  { key: 'ok', label: 'Valid' },
  { key: 'soon', label: 'Expiring soon' },
  { key: 'expired', label: 'Expired' },
];

const addYears = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
};

function inWindow(days: number | null, rung: number) {
  if (days === null) return false;
  const lower = [...RUNGS].sort((a, b) => a - b).filter((r) => r < rung).pop() ?? -1;
  return days >= 0 && days <= rung && days > lower;
}

function Stat({ label, value, color, active, onClick }: { label: string; value: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="compcard"
      onClick={onClick}
      style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', outline: active ? '2px solid var(--primary)' : undefined, outlineOffset: -1 }}
      title="Click to filter the register"
    >
      <div className="ttl">{label}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color }}>
        {value}
      </div>
    </button>
  );
}

function DaysLeft({ days }: { days: number | null }) {
  if (days === null) return <span style={{ color: 'var(--faint)' }}>—</span>;
  if (days < 0) return <span style={{ color: '#B91C1C', fontWeight: 700 }}>Expired {-days}d ago</span>;
  return <span style={{ color: days <= 30 ? '#C2410C' : days <= 90 ? '#B45309' : 'var(--muted)', fontWeight: days <= 90 ? 600 : 400 }}>{days} days</span>;
}

export function VisaView({ forceTeam = false }: { forceTeam?: boolean }) {
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { locations } = useOrg();
  const { statusOf } = useSeparation();
  const { reminders, renewals, visaExpiryOf, eidExpiryOf, daysLeft, stateOf, dueRung, isReminded, lastReminder, sendReminder, sendDue, renew } = useVisa();
  const teamMode = forceTeam || role === 'Team Lead';

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ExpiryState>('All');
  const [rungFilter, setRungFilter] = useState<number | null>(null);
  const [notice, setNotice] = useState('');

  const [renewId, setRenewId] = useState<string | null>(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [eidExpiry, setEidExpiry] = useState('');
  const [reference, setReference] = useState('');
  const [renewError, setRenewError] = useState('');

  const uaeIds = new Set(locations.filter((l) => l.template === 'uae').map((l) => l.id));
  const base = teamMode ? directReports(me.id) : EMPLOYEES;
  const scoped = base.filter((e) => uaeIds.has(e.location) && visaExpiryOf(e) && statusOf(e) !== 'Inactive');

  const count = (s: ExpiryState) => scoped.filter((e) => stateOf(e) === s).length;
  const dueList = scoped.filter((e) => {
    const r = dueRung(e);
    return r !== null && !isReminded(e, r);
  });

  const rows = scoped
    .filter((e) => (statusFilter === 'All' || stateOf(e) === statusFilter) && (rungFilter === null || inWindow(daysLeft(e), rungFilter)) && matchesEmployee(e, q))
    .sort((a, b) => (daysLeft(a) ?? 9999) - (daysLeft(b) ?? 9999));

  const renewing = renewId ? employeeById(renewId) : undefined;

  const remind = (e: Employee) => {
    const r = dueRung(e);
    sendReminder(e, r);
    setNotice(`Reminder sent to ${e.name} (${e.employeeCode}) — ${r ? `${r}-day notice` : 'manual notice'} to ${(r === null || r <= 30 ? ['Employee', 'HR', 'Reporting manager'] : ['Employee', 'HR']).join(', ')}.`);
  };

  const sendAllDue = () => {
    const n = sendDue(dueList);
    setNotice(n ? `Sent ${n} scheduled reminder${n > 1 ? 's' : ''} to the employees and HR.` : 'No reminders are due right now.');
  };

  const openRenew = (e: Employee) => {
    setRenewId(e.id);
    setNewExpiry('');
    setEidExpiry('');
    setReference('');
    setRenewError('');
  };

  const submitRenew = () => {
    if (!renewing) return;
    const current = visaExpiryOf(renewing) ?? REFERENCE_TODAY;
    if (!newExpiry) {
      setRenewError('Enter the new visa expiry date.');
      return;
    }
    if (newExpiry <= current || newExpiry <= REFERENCE_TODAY) {
      setRenewError('The new expiry must be later than the current expiry and in the future.');
      return;
    }
    renew(renewing, { newExpiry, eidExpiry, reference });
    setNotice(`Visa renewed for ${renewing.name} (${renewing.employeeCode}) — now valid until ${newExpiry}.`);
    setRenewId(null);
  };

  const quickBase = renewing ? (visaExpiryOf(renewing) && visaExpiryOf(renewing)! > REFERENCE_TODAY ? visaExpiryOf(renewing)! : REFERENCE_TODAY) : REFERENCE_TODAY;

  return (
    <div>
      <PageHeader
        eyebrow={teamMode ? 'Team · Visa' : 'Module 06 · Compliance'}
        title={teamMode ? 'Team Visa' : 'Visa & Expiry Management'}
        description={
          teamMode
            ? 'Residence-visa and Emirates ID status for your UAE direct reports.'
            : 'Residence-visa, work-permit and Emirates ID lifecycle for UAE staff — automated notification 90 / 60 / 30 / 7 days before expiry.'
        }
        actions={
          !teamMode && (
            <Button variant="primary" onClick={sendAllDue} disabled={!dueList.length}>
              <BellIcon /> Send due reminders{dueList.length ? ` · ${dueList.length}` : ''}
            </Button>
          )
        }
      />

      {notice && (
        <div className="note-box" style={{ marginBottom: 14, alignItems: 'center' }}>
          <BellIcon />
          <div style={{ flex: 1 }}>{notice}</div>
          <button type="button" className="icon-act" title="Dismiss" onClick={() => setNotice('')}>
            <XIcon />
          </button>
        </div>
      )}

      <div className="g3">
        <Stat label="Valid" value={count('ok')} color="#15803D" active={statusFilter === 'ok'} onClick={() => setStatusFilter(statusFilter === 'ok' ? 'All' : 'ok')} />
        <Stat label="Expiring soon" value={count('soon')} color="#C2410C" active={statusFilter === 'soon'} onClick={() => setStatusFilter(statusFilter === 'soon' ? 'All' : 'soon')} />
        <Stat label="Expired" value={count('expired')} color="#B91C1C" active={statusFilter === 'expired'} onClick={() => setStatusFilter(statusFilter === 'expired' ? 'All' : 'expired')} />
      </div>

      {!teamMode && (
        <Card className="row-gap">
          <CardHeader title="Reminder ladder" sub="Click a notice window to filter the register. Green = every employee in the window has been reminded." />
          <div className="ladder" style={{ padding: '18px 22px' }}>
            {SORTED_RUNGS.map((r) => {
              const inWin = scoped.filter((e) => inWindow(daysLeft(e), r));
              const reminded = inWin.filter((e) => isReminded(e, r)).length;
              const cls = inWin.length && reminded === inWin.length ? 'sent' : inWin.length ? 'now' : '';
              return (
                <button
                  key={r}
                  type="button"
                  className={`ladder-step ${cls}`}
                  onClick={() => setRungFilter(rungFilter === r ? null : r)}
                  style={{ cursor: 'pointer', font: 'inherit', background: rungFilter === r ? 'var(--primary-50)' : 'transparent', borderRadius: 10, paddingTop: 6, paddingBottom: 6 }}
                >
                  <div className="cap">{r}d</div>
                  <div className="lt">{r} days notice</div>
                  <div className="ls">
                    {inWin.length ? `${inWin.length} employee(s) · ${reminded} reminded` : 'No one in this window'}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="row-gap">
        <CardHeader title="Visa & Emirates ID register" sub={`${scoped.length} UAE employee(s)`} />
        <div className="tbar">
          <div className="tsearch" style={{ width: 260 }}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | ExpiryState)} className="chip">
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          {rungFilter !== null && (
            <button type="button" className="chip" onClick={() => setRungFilter(null)} style={{ background: 'var(--primary-50)', borderColor: 'var(--primary-100)', color: 'var(--primary)' }}>
              {rungFilter}-day window <XIcon />
            </button>
          )}
          <span className="sp" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {rows.length} of {scoped.length}
          </span>
        </div>

        {!rows.length ? (
          <EmptyState icon={<ShieldIcon />} title={scoped.length ? 'No matching records' : 'No records'} description={scoped.length ? 'Try a different search or filter.' : 'No UAE employees with visa records.'} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Emirates ID</th>
                <th>Visa expiry</th>
                <th>Days left</th>
                <th>Status</th>
                {!teamMode && <th>Reminder</th>}
                {!teamMode && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const st = stateOf(e);
                const n = daysLeft(e);
                const due = dueRung(e);
                const last = lastReminder(e);
                const lastCurrent = last && last.expiry === visaExpiryOf(e) ? last : undefined;
                return (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/directory/${e.employeeCode}`} className="person">
                        <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                          {e.avatarInitials}
                        </div>
                        <span className="nm">
                          {e.name}
                          <EmpId code={e.employeeCode} />
                        </span>
                      </Link>
                    </td>
                    <td>
                      <div className="mono">{e.emiratesId}</div>
                      {eidExpiryOf(e) && <div className="sb">EID expires {eidExpiryOf(e)}</div>}
                    </td>
                    <td className="mono">{visaExpiryOf(e)}</td>
                    <td>
                      <DaysLeft days={n} />
                    </td>
                    <td>
                      <ExpiryBadge state={st} />
                    </td>
                    {!teamMode && (
                      <td style={{ fontSize: 12 }}>
                        {due !== null && !isReminded(e, due) ? (
                          <span style={{ color: '#B45309', fontWeight: 600 }}>Due: {due}-day notice</span>
                        ) : lastCurrent ? (
                          <span style={{ color: 'var(--muted)' }}>
                            Sent {lastCurrent.sentOn}
                            {lastCurrent.rung ? ` · ${lastCurrent.rung}-day` : ' · manual'}
                          </span>
                        ) : n !== null && n > 90 ? (
                          <span style={{ color: 'var(--faint)' }}>Next: 90-day on {addDays(visaExpiryOf(e)!, -90)}</span>
                        ) : (
                          <span style={{ color: 'var(--faint)' }}>—</span>
                        )}
                      </td>
                    )}
                    {!teamMode && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Button size="sm" onClick={() => remind(e)} title="Send a reminder now">
                          <BellIcon /> Remind
                        </Button>{' '}
                        <Button size="sm" variant={st === 'ok' ? 'ghost' : 'primary'} onClick={() => openRenew(e)}>
                          Renew
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {!teamMode && (
        <div className="g2 row-gap">
          <Card>
            <CardHeader title="Reminder log" sub={`${reminders.length} sent this session`} />
            {!reminders.length && <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--muted)' }}>No reminders sent yet. Use “Send due reminders” or “Remind” on a row.</div>}
            {[...reminders]
              .reverse()
              .slice(0, 8)
              .map((r) => {
                const e = employeeById(r.employeeId)!;
                return (
                  <div key={r.id} className="doc">
                    <div className="fic">
                      <BellIcon />
                    </div>
                    <div>
                      <div className="nm">
                        {e.name}
                        <EmpId code={e.employeeCode} />
                      </div>
                      <div className="mt">
                        {r.rung ? `${r.rung}-day notice` : 'Manual reminder'} · {r.sentOn} · to {r.to.join(', ')}
                      </div>
                    </div>
                  </div>
                );
              })}
          </Card>
          <Card>
            <CardHeader title="Renewal history" sub={`${renewals.length} renewal(s) this session`} />
            {!renewals.length && <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--muted)' }}>No renewals recorded yet. Use “Renew” on a row to update a visa.</div>}
            {[...renewals]
              .reverse()
              .slice(0, 8)
              .map((r) => {
                const e = employeeById(r.employeeId)!;
                return (
                  <div key={r.id} className="doc">
                    <div className="fic">
                      <ShieldIcon />
                    </div>
                    <div>
                      <div className="nm">
                        {e.name}
                        <EmpId code={e.employeeCode} />
                      </div>
                      <div className="mt">
                        {r.previousExpiry} → {r.newExpiry} · renewed {r.renewedOn}
                        {r.reference ? ` · ref ${r.reference}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
          </Card>
        </div>
      )}

      <Drawer
        open={!!renewing}
        onClose={() => setRenewId(null)}
        title="Renew visa"
        description={renewing ? `${renewing.name} · ${renewing.employeeCode}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenewId(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitRenew}>
              Record renewal
            </Button>
          </>
        }
      >
        {renewing && (
          <>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, background: 'var(--bg)', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>
                {renewing.designation} · {renewing.department}
              </div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                Current visa expiry <b>{visaExpiryOf(renewing)}</b> · <DaysLeft days={daysLeft(renewing)} />
              </div>
              <div style={{ color: 'var(--muted)', marginTop: 2 }}>Emirates ID {renewing.emiratesId}</div>
            </div>
            <div className="form-grid">
              <div className="fg full">
                <label>
                  New visa expiry date <span className="req">*</span>
                </label>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => {
                    setNewExpiry(e.target.value);
                    setRenewError('');
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {[1, 2, 3].map((y) => (
                    <button key={y} type="button" className="chip" onClick={() => { setNewExpiry(addYears(quickBase, y)); setRenewError(''); }}>
                      +{y} year{y > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
                <span className="hint">Quick options count from the current expiry (or today if it has already passed).</span>
              </div>
              <div className="fg">
                <label>New Emirates ID expiry</label>
                <input type="date" value={eidExpiry} onChange={(e) => setEidExpiry(e.target.value)} />
              </div>
              <div className="fg">
                <label>Application / reference no.</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. GDRFA-2026-04418" />
              </div>
            </div>
            {renewError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{renewError}</div>}
          </>
        )}
      </Drawer>
    </div>
  );
}
