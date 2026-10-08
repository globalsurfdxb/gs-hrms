'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { EMPLOYEES, REFERENCE_TODAY, directReports, employeeById, matchesEmployee } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { DocRow, useExpiry } from '@/context/ExpiryContext';
import { EID, VISA } from '@/lib/expiryRegister';
import { Employee, ExpiryState } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { ExpiryBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { EmpId } from '@/components/ui/EmployeeBits';
import { Avatar } from '@/components/ui/Avatar';
import { StatTiles } from '@/components/ui/StatTiles';
import { DaysLeft, ReminderCell } from '@/components/expiry/ExpiryBits';
import { BellIcon, CheckIcon, ClockIcon, PeopleIcon, SearchIcon, ShieldIcon, WarnIcon, XIcon } from '@/components/icons';

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

/** One UAE employee with their residence-visa and Emirates ID rows from the shared expiry register. */
interface Entry {
  e: Employee;
  visa: DocRow;
  eid?: DocRow;
}

export function VisaView({ forceTeam = false }: { forceTeam?: boolean }) {
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { locations } = useOrg();
  const { statusOf } = useSeparation();
  const { reminders, renewals, rowsFor, daysOf, stateOf, ladderOf, windowOf, dueRung, isReminded, reminderInfo, sendReminder, sendDue, renew } = useExpiry();
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
  const scoped: Entry[] = base
    .filter((e) => uaeIds.has(e.location) && statusOf(e) !== 'Inactive')
    .flatMap((e) => {
      const rows = rowsFor([e]);
      const visa = rows.find((r) => r.type === VISA);
      return visa ? [{ e, visa, eid: rows.find((r) => r.type === EID) }] : [];
    });

  const visaLadder = [...new Set(scoped.flatMap((x) => ladderOf(x.visa)))].sort((a, b) => b - a);
  const count = (s: ExpiryState) => scoped.filter((x) => stateOf(x.visa) === s).length;
  const dueList = scoped.filter((x) => {
    const r = dueRung(x.visa);
    return r !== null && !isReminded(x.visa, r);
  });

  const rows = scoped
    .filter((x) => (statusFilter === 'All' || stateOf(x.visa) === statusFilter) && (rungFilter === null || windowOf(x.visa) === rungFilter) && matchesEmployee(x.e, q))
    .sort((a, b) => daysOf(a.visa) - daysOf(b.visa));

  const renewing = renewId ? scoped.find((x) => x.e.id === renewId) : undefined;

  const remind = (x: Entry) => {
    const r = dueRung(x.visa);
    sendReminder(x.visa, r);
    setNotice(`Reminder sent to ${x.e.name} (${x.e.employeeCode}) — ${r ? `${r}-day notice` : daysOf(x.visa) < 0 ? 'overdue follow-up' : 'manual notice'} to ${(r === null || r <= 30 ? ['Employee', 'HR', 'Reporting manager'] : ['Employee', 'HR']).join(', ')}.`);
  };

  const sendAllDue = () => {
    const n = sendDue(dueList.map((x) => x.visa));
    setNotice(n ? `Sent ${n} scheduled reminder${n > 1 ? 's' : ''} to the employees and HR.` : 'No reminders are due right now.');
  };

  const openRenew = (x: Entry) => {
    setRenewId(x.e.id);
    setNewExpiry('');
    setEidExpiry('');
    setReference('');
    setRenewError('');
  };

  const submitRenew = () => {
    if (!renewing) return;
    const current = renewing.visa.expiry;
    if (!newExpiry) {
      setRenewError('Enter the new visa expiry date.');
      return;
    }
    if (newExpiry <= current || newExpiry <= REFERENCE_TODAY) {
      setRenewError('The new expiry must be later than the current expiry and in the future.');
      return;
    }
    if (eidExpiry && eidExpiry <= REFERENCE_TODAY) {
      setRenewError('The new Emirates ID expiry must be in the future.');
      return;
    }
    renew(renewing.visa, { newExpiry, eidExpiry: eidExpiry || undefined, reference });
    setNotice(`Visa renewed for ${renewing.e.name} (${renewing.e.employeeCode}) — now valid until ${newExpiry}.`);
    setRenewId(null);
  };

  const quickBase = renewing && renewing.visa.expiry > REFERENCE_TODAY ? renewing.visa.expiry : REFERENCE_TODAY;
  const visaReminders = reminders.filter((r) => r.type === VISA);
  const visaRenewals = renewals.filter((r) => r.type === VISA);

  return (
    <div>
      <PageHeader
        eyebrow={teamMode ? 'Team · Visa' : 'Documents & Compliance'}
        title={teamMode ? 'Team Visa' : 'Visa & Expiry Management'}
        description={
          teamMode
            ? 'Residence-visa and Emirates ID status for your UAE direct reports.'
            : `Residence-visa, work-permit and Emirates ID lifecycle for UAE staff — automated notification ${visaLadder.length ? visaLadder.join(' / ') : 'on the configured schedule'} days before expiry, escalated to HR and the manager once expired.`
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

      <StatTiles
        items={[
          { label: 'Expired', value: count('expired'), icon: <WarnIcon />, tone: 'red', hint: 'Renew immediately', active: statusFilter === 'expired', onClick: () => setStatusFilter(statusFilter === 'expired' ? 'All' : 'expired') },
          { label: 'Expiring soon', value: count('soon'), icon: <ClockIcon />, tone: 'amber', hint: 'Inside the notice windows', active: statusFilter === 'soon', onClick: () => setStatusFilter(statusFilter === 'soon' ? 'All' : 'soon') },
          { label: 'Valid', value: count('ok'), icon: <CheckIcon />, tone: 'green', hint: 'No action needed', active: statusFilter === 'ok', onClick: () => setStatusFilter(statusFilter === 'ok' ? 'All' : 'ok') },
          teamMode
            ? { label: 'Team members', value: scoped.length, icon: <PeopleIcon />, tone: 'blue', hint: 'UAE direct reports with a visa' }
            : { label: 'Reminders due', value: dueList.length, icon: <BellIcon />, tone: 'blue', hint: `${scoped.length} UAE employee${scoped.length === 1 ? '' : 's'} tracked` },
        ]}
      />

      {!teamMode && (
        <Card className="row-gap">
          <CardHeader title="Reminder ladder" sub="Follows the visa schedule in Administration → Reminders. Click a window to filter the register. Green = every employee in the window has been reminded." />
          <div className="ladder" style={{ padding: '18px 22px' }}>
            {[...visaLadder, 0].map((r) => {
              const inWin = scoped.filter((x) => windowOf(x.visa) === r);
              const reminded = r === 0 ? inWin.length : inWin.filter((x) => isReminded(x.visa, r)).length;
              const cls = inWin.length && reminded === inWin.length ? 'sent' : inWin.length ? 'now' : '';
              return (
                <button
                  key={r}
                  type="button"
                  className={`ladder-step ${cls}`}
                  onClick={() => setRungFilter(rungFilter === r ? null : r)}
                  style={{ cursor: 'pointer', font: 'inherit', background: rungFilter === r ? 'var(--primary-50)' : 'transparent', borderRadius: 10, paddingTop: 6, paddingBottom: 6 }}
                >
                  <div className="cap">{r === 0 ? 'Expired' : `${r}d`}</div>
                  <div className="lt">{r === 0 ? 'Escalated' : `${r} days notice`}</div>
                  <div className="ls">{inWin.length ? (r === 0 ? `${inWin.length} employee(s) · escalated to HR / manager` : `${inWin.length} employee(s) · ${reminded} reminded`) : 'No one in this window'}</div>
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
            <button type="button" className="chip lc-chip-on" onClick={() => setRungFilter(null)}>
              {rungFilter === 0 ? 'Expired' : `${rungFilter}-day window`} <XIcon />
            </button>
          )}
          {(!!q.trim() || statusFilter !== 'All' || rungFilter !== null) && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setQ('');
                setStatusFilter('All');
                setRungFilter(null);
              }}
            >
              <XIcon /> Clear filters
            </button>
          )}
          <span className="sp" />
          <span className="lc-count">
            {rows.length} of {scoped.length}
          </span>
        </div>

        {!rows.length ? (
          <EmptyState icon={<ShieldIcon />} title={scoped.length ? 'No matching records' : 'No records'} description={scoped.length ? 'Try a different search or filter.' : 'No UAE employees with visa records.'} />
        ) : (
          <>
          <div className="lc-scroll">
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
              {rows.map((x) => {
                const { e, visa, eid } = x;
                const st = stateOf(visa);
                const eidExpired = eid ? stateOf(eid) === 'expired' : false;
                return (
                  <tr key={e.id} className={`lc-row ${st}`}>
                    <td>
                      <Link href={`/directory/${e.employeeCode}`} className="person">
                        <Avatar initials={e.avatarInitials} seed={e.department} />
                        <div>
                          <div className="nm">
                            {e.name}
                            <EmpId code={e.employeeCode} />
                          </div>
                          <div className="sb">
                            {e.designation} · {e.department}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <div className="mono">{e.emiratesId}</div>
                      {eid && (
                        <div className="sb" style={eidExpired ? { color: '#B91C1C', fontWeight: 600 } : undefined}>
                          {eidExpired ? `EID expired ${eid.expiry}` : `EID expires ${eid.expiry}`}
                        </div>
                      )}
                    </td>
                    <td className="mono">{visa.expiry}</td>
                    <td>
                      <DaysLeft days={daysOf(visa)} />
                    </td>
                    <td>
                      <ExpiryBadge state={st} />
                    </td>
                    {!teamMode && (
                      <td>
                        <ReminderCell info={reminderInfo(visa)} />
                      </td>
                    )}
                    {!teamMode && (
                      <td className="lc-right">
                        <span className="lc-acts">
                          <Button size="sm" onClick={() => remind(x)} title="Send a reminder now">
                            <BellIcon /> Remind
                          </Button>
                          <Button size="sm" variant={st === 'ok' ? 'ghost' : 'primary'} onClick={() => openRenew(x)}>
                            Renew
                          </Button>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="tfoot lc-foot">
            <span>
              Showing {rows.length} of {scoped.length} UAE employee{scoped.length === 1 ? '' : 's'}
            </span>
            <span>Sorted by days left</span>
          </div>
          </>
        )}
      </Card>

      {!teamMode && (
        <div className="g2 row-gap">
          <Card>
            <CardHeader title="Reminder log" sub={`${visaReminders.length} sent this session`} />
            {!visaReminders.length ? (
              <div className="lc-hint">No reminders sent yet. Use “Send due reminders” or “Remind” on a row.</div>
            ) : (
              <div className="lc-list">
                {[...visaReminders]
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
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Renewal history" sub={`${visaRenewals.length} renewal(s) this session`} />
            {!visaRenewals.length ? (
              <div className="lc-hint">No renewals recorded yet. Use “Renew” on a row to update a visa.</div>
            ) : (
              <div className="lc-list">
                {[...visaRenewals]
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
              </div>
            )}
          </Card>
        </div>
      )}

      <Drawer
        open={!!renewing}
        onClose={() => setRenewId(null)}
        title="Renew visa"
        description={renewing ? `${renewing.e.name} · ${renewing.e.employeeCode}` : undefined}
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
                {renewing.e.designation} · {renewing.e.department}
              </div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                Current visa expiry <b>{renewing.visa.expiry}</b> · <DaysLeft days={daysOf(renewing.visa)} />
              </div>
              <div style={{ color: 'var(--muted)', marginTop: 2 }}>Emirates ID {renewing.e.emiratesId}</div>
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
