'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EMPLOYEES, REFERENCE_TODAY, employeeById, matchesEmployee } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { DocRow, useExpiry } from '@/context/ExpiryContext';
import { DATED_TYPES } from '@/lib/expiryRegister';
import { ExpiryState } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { ExpiryBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { EmpId } from '@/components/ui/EmployeeBits';
import { Avatar } from '@/components/ui/Avatar';
import { StatTiles } from '@/components/ui/StatTiles';
import { DaysLeft, ReminderCell } from '@/components/expiry/ExpiryBits';
import { BellIcon, CheckIcon, ClockIcon, FileTextIcon, PlusIcon, SearchIcon, WarnIcon, XIcon } from '@/components/icons';

const DOC_TYPES = ['Passport', 'Emirates ID', 'Residence Visa', 'Labour Card', 'UAE Driving Licence', 'Medical Insurance', 'Professional Licence', 'Insurance Document', 'Other'];
const FILTERS: { key: 'All' | ExpiryState; label: string }[] = [
  { key: 'All', label: 'All statuses' },
  { key: 'expired', label: 'Expired' },
  { key: 'soon', label: 'Expiring soon' },
  { key: 'ok', label: 'Valid' },
];

const addYears = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
};

export default function EmployeeExpiryPage() {
  const { locations, locationName } = useOrg();
  const { statusOf } = useSeparation();
  const { reminders, renewals, rowsFor, daysOf, stateOf, dueRung, isReminded, sendReminder, sendDue, renew, addDoc, ladderOf, windowOf, reminderInfo } = useExpiry();

  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('All');
  const [type, setType] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ExpiryState>('All');
  const [rungFilter, setRungFilter] = useState<number | null>(null);
  const [notice, setNotice] = useState('');

  const [renewKey, setRenewKey] = useState<string | null>(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [reference, setReference] = useState('');
  const [renewError, setRenewError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addEmp, setAddEmp] = useState('');
  const [addType, setAddType] = useState('UAE Driving Licence');
  const [addCustom, setAddCustom] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addError, setAddError] = useState('');

  const employees = EMPLOYEES.filter((e) => statusOf(e) !== 'Inactive');
  const all = rowsFor(employees).filter((r) => loc === 'All' || r.employee.location === loc);
  const types = [...new Set([...DATED_TYPES, ...all.map((r) => r.type)])];
  const steps = [...new Set(all.flatMap(ladderOf))].sort((a, b) => b - a);

  const count = (s: ExpiryState) => all.filter((r) => stateOf(r) === s).length;
  const dueList = all.filter((r) => {
    const x = dueRung(r);
    return x !== null && !isReminded(r, x);
  });

  const rows = all
    .filter((r) => (type === 'All' || r.type === type) && (statusFilter === 'All' || stateOf(r) === statusFilter) && (rungFilter === null || windowOf(r) === rungFilter))
    .filter((r) => matchesEmployee(r.employee, q) || r.type.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => daysOf(a) - daysOf(b));

  const filtersOn = !!q.trim() || loc !== 'All' || type !== 'All' || statusFilter !== 'All' || rungFilter !== null;

  const renewing: DocRow | undefined = renewKey ? all.find((r) => r.key === renewKey) ?? rowsFor(employees).find((r) => r.key === renewKey) : undefined;
  const quickBase = renewing && renewing.expiry > REFERENCE_TODAY ? renewing.expiry : REFERENCE_TODAY;

  const remind = (r: DocRow) => {
    const x = dueRung(r);
    sendReminder(r, x);
    setNotice(`Reminder sent to ${r.employee.name} (${r.employee.employeeCode}) about the ${r.type}${x ? ` — ${x}-day notice` : daysOf(r) < 0 ? ' — overdue follow-up' : ''}.`);
  };

  const sendAll = () => {
    const n = sendDue(dueList);
    setNotice(n ? `Sent ${n} scheduled reminder${n > 1 ? 's' : ''} to the employees and HR.` : 'No reminders are due right now.');
  };

  const openRenew = (r: DocRow) => {
    setRenewKey(r.key);
    setNewExpiry('');
    setReference('');
    setRenewError('');
  };

  const submitRenew = () => {
    if (!renewing) return;
    if (!newExpiry) {
      setRenewError('Enter the new expiry date.');
      return;
    }
    if (newExpiry <= renewing.expiry || newExpiry <= REFERENCE_TODAY) {
      setRenewError('The new expiry must be later than the current expiry and in the future.');
      return;
    }
    renew(renewing, { newExpiry, reference });
    setNotice(`${renewing.type} updated for ${renewing.employee.name} (${renewing.employee.employeeCode}) — now valid until ${newExpiry}.`);
    setRenewKey(null);
  };

  const openAdd = () => {
    setAddEmp('');
    setAddType('UAE Driving Licence');
    setAddCustom('');
    setAddDate('');
    setAddError('');
    setAddOpen(true);
  };

  const submitAdd = () => {
    const finalType = addType === 'Other' ? addCustom.trim() : addType;
    if (!addEmp) {
      setAddError('Select the employee this document belongs to.');
      return;
    }
    if (!finalType) {
      setAddError('Enter the document type.');
      return;
    }
    if (!addDate) {
      setAddError('Enter the expiry date.');
      return;
    }
    if (rowsFor([employeeById(addEmp)!]).some((r) => r.type.toLowerCase() === finalType.toLowerCase())) {
      setAddError(`${finalType} is already tracked for this employee — use Update expiry on its row instead.`);
      return;
    }
    addDoc({ employeeId: addEmp, type: finalType, expiryDate: addDate });
    const e = employeeById(addEmp)!;
    setNotice(`${finalType} added for ${e.name} (${e.employeeCode}) — expires ${addDate}.`);
    setAddOpen(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Documents & Compliance"
        title="Employee Expiry"
        description="Every dated document across your employees — passports, visas, Emirates IDs and licences — sorted by urgency, with reminders and renewals."
        actions={
          <>
            <Button onClick={openAdd}>
              <PlusIcon /> Add document
            </Button>
            <Button variant="primary" onClick={sendAll} disabled={!dueList.length}>
              <BellIcon /> Send due reminders{dueList.length ? ` · ${dueList.length}` : ''}
            </Button>
          </>
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
          { label: 'Expired', value: count('expired'), icon: <WarnIcon />, tone: 'red', hint: 'Needs renewal now', active: statusFilter === 'expired', onClick: () => setStatusFilter(statusFilter === 'expired' ? 'All' : 'expired') },
          { label: 'Expiring soon', value: count('soon'), icon: <ClockIcon />, tone: 'amber', hint: 'Within the notice windows', active: statusFilter === 'soon', onClick: () => setStatusFilter(statusFilter === 'soon' ? 'All' : 'soon') },
          { label: 'Valid', value: count('ok'), icon: <CheckIcon />, tone: 'green', hint: 'No action needed', active: statusFilter === 'ok', onClick: () => setStatusFilter(statusFilter === 'ok' ? 'All' : 'ok') },
          { label: 'Reminders due', value: dueList.length, icon: <BellIcon />, tone: 'blue', hint: `${all.length} document${all.length === 1 ? '' : 's'} tracked` },
        ]}
      />

      <Card className="row-gap">
        <CardHeader title="Reminder ladder" sub="Each document type follows its own schedule from Administration → Reminders. Click a window to filter the register. Green = every document in the window has been reminded." />
        <div className="ladder" style={{ padding: '18px 22px' }}>
          {[...steps.filter((s) => s !== 0), 0].map((r) => {
            const inWin = all.filter((d) => windowOf(d) === r);
            const reminded = r === 0 ? inWin.length : inWin.filter((d) => isReminded(d, r)).length;
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
                <div className="ls">{inWin.length ? (r === 0 ? `${inWin.length} document(s) · escalated to HR / manager` : `${inWin.length} document(s) · ${reminded} reminded`) : 'Nothing in this window'}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="row-gap">
        <CardHeader title="Expiry register" sub={`${all.length} tracked document(s)`} />
        <div className="tbar">
          <div className="tsearch" style={{ width: 260 }}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, employee ID or document…" />
          </div>
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="chip">
            <option value="All">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="chip">
            <option value="All">All document types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | ExpiryState)} className="chip">
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          {rungFilter !== null && (
            <button type="button" className="chip lc-chip-on" onClick={() => setRungFilter(null)}>
              {rungFilter}-day window <XIcon />
            </button>
          )}
          {filtersOn && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setQ('');
                setLoc('All');
                setType('All');
                setStatusFilter('All');
                setRungFilter(null);
              }}
            >
              <XIcon /> Clear filters
            </button>
          )}
          <span className="sp" />
          <span className="lc-count">
            {rows.length} of {all.length}
          </span>
        </div>

        {!rows.length ? (
          <EmptyState icon={<ClockIcon />} title={all.length ? 'No matching documents' : 'Nothing tracked'} description={all.length ? 'Try a different search or filter.' : 'Add a dated document to start tracking its expiry.'} />
        ) : (
          <>
          <div className="lc-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Document</th>
                <th>Expiry date</th>
                <th>Days left</th>
                <th>Status</th>
                <th>Reminder</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = stateOf(r);
                const n = daysOf(r);
                return (
                  <tr key={r.key} className={`lc-row ${st}`}>
                    <td>
                      <Link href={`/directory/${r.employee.employeeCode}`} className="person">
                        <Avatar initials={r.employee.avatarInitials} seed={r.employee.department} />
                        <div>
                          <div className="nm">
                            {r.employee.name}
                            <EmpId code={r.employee.employeeCode} />
                          </div>
                          <div className="sb">
                            {r.employee.department} · {locationName(r.employee.location)}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <div className="lc-cell">
                        <span className="lc-ic">
                          <FileTextIcon />
                        </span>
                        <div>
                          <div className="nm">{r.type}</div>
                          {r.custom && <div className="sb">Custom document</div>}
                        </div>
                      </div>
                    </td>
                    <td className="mono">{r.expiry}</td>
                    <td>
                      <DaysLeft days={n} />
                    </td>
                    <td>
                      <ExpiryBadge state={st} />
                    </td>
                    <td>
                      <ReminderCell info={reminderInfo(r)} />
                    </td>
                    <td className="lc-right">
                      <span className="lc-acts">
                        <Button size="sm" onClick={() => remind(r)} title="Send a reminder now">
                          <BellIcon /> Remind
                        </Button>
                        <Button size="sm" variant={st === 'ok' ? 'ghost' : 'primary'} onClick={() => openRenew(r)}>
                          Update expiry
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="tfoot lc-foot">
            <span>
              Showing {rows.length} of {all.length} document{all.length === 1 ? '' : 's'}
            </span>
            <span>Sorted by urgency</span>
          </div>
          </>
        )}
      </Card>

      <div className="g2 row-gap">
        <Card>
          <CardHeader title="Reminder log" sub={`${reminders.length} sent this session`} />
          {!reminders.length ? (
            <div className="lc-hint">No reminders sent yet. Use “Send due reminders” or “Remind” on a row.</div>
          ) : (
            <div className="lc-list">
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
                          <EmpId code={e.employeeCode} /> · {r.type}
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
          <CardHeader title="Update history" sub={`${renewals.length} update(s) this session`} />
          {!renewals.length ? (
            <div className="lc-hint">No expiry dates updated yet. Use “Update expiry” on a row after a document is renewed.</div>
          ) : (
            <div className="lc-list">
              {[...renewals]
                .reverse()
                .slice(0, 8)
                .map((r) => {
                  const e = employeeById(r.employeeId)!;
                  return (
                    <div key={r.id} className="doc">
                      <div className="fic">
                        <ClockIcon />
                      </div>
                      <div>
                        <div className="nm">
                          {e.name}
                          <EmpId code={e.employeeCode} /> · {r.type}
                        </div>
                        <div className="mt">
                          {r.previousExpiry} → {r.newExpiry} · {r.renewedOn}
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

      <Drawer
        open={!!renewing}
        onClose={() => setRenewKey(null)}
        title="Update expiry"
        description={renewing ? `${renewing.type} · ${renewing.employee.name} (${renewing.employee.employeeCode})` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenewKey(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitRenew}>
              Save new expiry
            </Button>
          </>
        }
      >
        {renewing && (
          <>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, background: 'var(--bg)', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>
                {renewing.employee.designation} · {renewing.employee.department}
              </div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                Current expiry <b>{renewing.expiry}</b> · <DaysLeft days={daysOf(renewing)} />
              </div>
            </div>
            <div className="form-grid">
              <div className="fg full">
                <label>
                  New expiry date <span className="req">*</span>
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
                  {[1, 2, 5].map((y) => (
                    <button key={y} type="button" className="chip" onClick={() => { setNewExpiry(addYears(quickBase, y)); setRenewError(''); }}>
                      +{y} year{y > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
                <span className="hint">Quick options count from the current expiry (or today if it has already passed).</span>
              </div>
              <div className="fg full">
                <label>Reference / application no.</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="note-box" style={{ marginTop: 12 }}>
              <div>This updates the employee record, so Visa Management, Documents and the profile show the same date.</div>
            </div>
            {renewError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{renewError}</div>}
          </>
        )}
      </Drawer>

      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add dated document"
        description="Start tracking another expiring document so it appears in the register and gets reminders."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitAdd}>
              Add document
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="fg full">
            <label>
              Employee <span className="req">*</span>
            </label>
            <SearchSelect
              options={employees.map((e) => ({ value: e.id, label: e.name, meta: `${e.employeeCode} · ${e.department}` }))}
              value={addEmp}
              onChange={(v) => {
                setAddEmp(v);
                setAddError('');
              }}
              placeholder="Search by name or employee ID…"
              emptyText="No employees found"
            />
          </div>
          <div className="fg">
            <label>
              Document type <span className="req">*</span>
            </label>
            <select value={addType} onChange={(e) => { setAddType(e.target.value); setAddError(''); }}>
              {DOC_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>
              Expiry date <span className="req">*</span>
            </label>
            <input type="date" value={addDate} onChange={(e) => { setAddDate(e.target.value); setAddError(''); }} />
          </div>
          {addType === 'Other' && (
            <div className="fg full">
              <label>
                Document name <span className="req">*</span>
              </label>
              <input value={addCustom} onChange={(e) => { setAddCustom(e.target.value); setAddError(''); }} placeholder="e.g. Forklift Operator Certificate" />
            </div>
          )}
        </div>
        {addError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{addError}</div>}
      </Drawer>
    </div>
  );
}
