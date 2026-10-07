'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ASSETS, EMPLOYEES, REFERENCE_TODAY, employeeById, managerOf, matchesEmployee } from '@/lib/data';
import { addDays, daysBetween } from '@/lib/dates';
import { useOrg } from '@/context/OrgContext';
import { ASSET_ITEM, useSeparation } from '@/context/SeparationContext';
import { OffboardingRequest } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { EmpId } from '@/components/ui/EmployeeBits';
import { CheckIcon, DownloadIcon, ExitIcon, InboxIcon, PeopleIcon, PlusIcon, SearchIcon, ShieldIcon } from '@/components/icons';

const REASONS = ['Resignation', 'Termination', 'End of contract', 'Retirement', 'Other'];
const NOTICE = [
  { days: 0, label: 'Immediate' },
  { days: 15, label: '15 days' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
];
const STATUSES: ('All' | OffboardingRequest['status'])[] = ['All', 'Clearance Pending', 'Pending Approval', 'Completed'];

function Fg({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`fg ${full ? 'full' : ''}`}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>{k}</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{v}</div>
    </div>
  );
}

export default function OffboardingPage() {
  const { locations, locationName } = useOrg();
  const { cases, startCase, toggleClearance, toggleAsset, completeCase, withdrawCase, statusOf, assignedAssets } = useSeparation();

  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('All');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('All');
  const [view, setView] = useState<'cases' | 'register'>('cases');

  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [reason, setReason] = useState('Resignation');
  const [resDate, setResDate] = useState(REFERENCE_TODAY);
  const [notice, setNotice] = useState(30);
  const [lwdManual, setLwdManual] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const lwd = lwdManual || addDays(resDate || REFERENCE_TODAY, notice);
  const selected = employeeById(empId);
  const selectedMgr = selected ? managerOf(selected) : undefined;
  const selectedAssets = selected ? assignedAssets(selected.id) : [];

  const eligible = EMPLOYEES.filter((e) => statusOf(e) === 'Active' && !cases.some((c) => c.employeeId === e.id));

  const scopedCases = cases.filter((r) => loc === 'All' || employeeById(r.employeeId)?.location === loc);
  const visibleCases = scopedCases.filter((r) => (statusFilter === 'All' || r.status === statusFilter) && matchesEmployee(employeeById(r.employeeId)!, q));
  const inactive = EMPLOYEES.filter((e) => statusOf(e) === 'Inactive' && (loc === 'All' || e.location === loc) && matchesEmployee(e, q));

  const count = (s: OffboardingRequest['status']) => scopedCases.filter((r) => r.status === s).length;

  const exportRegister = () => {
    const rows = visibleCases.map((r) => {
      const e = employeeById(r.employeeId)!;
      return [e.employeeCode, e.name, e.department, locationName(e.location), r.reason, r.resignationDate, r.noticeDays === undefined ? '' : r.noticeDays, r.lastWorkingDay, `${r.clearance.filter((c) => c.done).length}/${r.clearance.length}`, r.status];
    });
    const csv = [['Employee ID', 'Name', 'Department', 'Location', 'Reason', 'Resigned', 'Notice (days)', 'Last working day', 'Clearance', 'Status'], ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'separation-register.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openStart = () => {
    setEmpId('');
    setReason('Resignation');
    setResDate(REFERENCE_TODAY);
    setNotice(30);
    setLwdManual('');
    setNotes('');
    setError('');
    setOpen(true);
  };

  const submit = () => {
    if (!empId) {
      setError('Select the employee who is leaving.');
      return;
    }
    if (!resDate) {
      setError('Enter the resignation / notice date.');
      return;
    }
    if (lwd < resDate) {
      setError('The last working day cannot be before the resignation date.');
      return;
    }
    startCase({ employeeId: empId, reason, resignationDate: resDate, noticeDays: notice, lastWorkingDay: lwd, notes });
    setStatusFilter('All');
    setOpen(false);
  };

  const approve = (r: OffboardingRequest) => {
    const e = employeeById(r.employeeId)!;
    if (window.confirm(`Complete the separation of ${e.name} (${e.employeeCode})? They will be marked inactive and lose access.`)) completeCase(r.id);
  };

  const withdraw = (r: OffboardingRequest) => {
    const e = employeeById(r.employeeId)!;
    if (window.confirm(`Withdraw the separation case for ${e.name} (${e.employeeCode})? They will return to active status.`)) withdrawCase(r.id);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Module 03 · Separation"
        title="Offboarding"
        description="Structured exit workflow and register — resignation, notice period, clearance checklist and final approval. Completing a case marks the employee inactive while preserving their record."
        actions={
          <Button variant="primary" onClick={openStart}>
            <PlusIcon /> Start offboarding
          </Button>
        }
      />

      <div className="rp-stats">
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#fdf3df', color: '#c6851b' }}>
            <InboxIcon />
          </span>
          <div>
            <div className="rp-stat-n">{count('Clearance Pending') + count('Pending Approval')}</div>
            <div className="rp-stat-l">In progress</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#e7f0fc', color: '#2f6fd6' }}>
            <ShieldIcon />
          </span>
          <div>
            <div className="rp-stat-n">{count('Pending Approval')}</div>
            <div className="rp-stat-l">Awaiting approval · {count('Clearance Pending')} in clearance</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#e7f6ee', color: '#1f9d63' }}>
            <CheckIcon />
          </span>
          <div>
            <div className="rp-stat-n">{count('Completed')}</div>
            <div className="rp-stat-l">Completed</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#f0eafc', color: '#7a4bd0' }}>
            <PeopleIcon />
          </span>
          <div>
            <div className="rp-stat-n">{inactive.length}</div>
            <div className="rp-stat-l">Inactive employees</div>
          </div>
        </div>
      </div>

      <Card className="row-gap">
        <CardHeader
          title="Separation cases"
          sub={`${scopedCases.length} case(s) on file · all locations unless filtered`}
          action={
            <div className="subseg">
              <button className={view === 'cases' ? 'on' : ''} onClick={() => setView('cases')}>
                Workflow
              </button>
              <button className={view === 'register' ? 'on' : ''} onClick={() => setView('register')}>
                Register
              </button>
            </div>
          }
        />
        <div className="tbar">
          <div className="tsearch" style={{ width: 280 }}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="chip">
            <option value="All">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as (typeof STATUSES)[number])} className="chip">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <span className="sp" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {visibleCases.length} of {scopedCases.length}
          </span>
          {view === 'register' && visibleCases.length > 0 && (
            <Button size="sm" onClick={exportRegister}>
              <DownloadIcon /> Export CSV
            </Button>
          )}
        </div>

        {!visibleCases.length && (
          <div>
            <EmptyState
              icon={<ExitIcon />}
              title={scopedCases.length ? 'No matching cases' : 'No separations in progress'}
              description={scopedCases.length ? 'Try a different search or filter.' : 'When someone is leaving, start an offboarding case to track notice, clearance and approval.'}
            />
            {!scopedCases.length && (
              <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
                <Button variant="primary" onClick={openStart}>
                  <PlusIcon /> Start offboarding
                </Button>
              </div>
            )}
          </div>
        )}

        {view === 'register' && visibleCases.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Location</th>
                  <th>Reason</th>
                  <th>Resigned</th>
                  <th>Notice</th>
                  <th>Last working day</th>
                  <th>Clearance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((r) => {
                  const e = employeeById(r.employeeId)!;
                  const done = r.clearance.filter((c) => c.done).length;
                  const left = daysBetween(REFERENCE_TODAY, r.lastWorkingDay);
                  return (
                    <tr
                      key={r.id}
                      className="clickable"
                      title="Open this case in the workflow view"
                      onClick={() => {
                        setQ(e.employeeCode);
                        setView('cases');
                      }}
                    >
                      <td>
                        <Link href={`/directory/${e.employeeCode}`} className="person" onClick={(ev) => ev.stopPropagation()}>
                          <div className="av" style={{ background: 'var(--gray-50)', color: 'var(--text-2)' }}>
                            {e.avatarInitials}
                          </div>
                          <span className="nm">
                            {e.name}
                            <EmpId code={e.employeeCode} />
                          </span>
                        </Link>
                      </td>
                      <td>{locationName(e.location)}</td>
                      <td>{r.reason}</td>
                      <td className="mono">{r.resignationDate}</td>
                      <td>{r.noticeDays === undefined ? '—' : r.noticeDays === 0 ? 'Immediate' : `${r.noticeDays} days`}</td>
                      <td className="mono">
                        {r.lastWorkingDay}
                        {r.status !== 'Completed' && (
                          <div style={{ fontSize: 11, color: left < 0 ? '#B91C1C' : left <= 7 ? '#B45309' : 'var(--muted)' }}>{left > 0 ? `${left} day(s) left` : left === 0 ? 'Last day today' : `${-left} day(s) past`}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 54, height: 6, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(done / r.clearance.length) * 100}%`, background: done === r.clearance.length ? 'var(--success)' : 'var(--primary)' }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {done}/{r.clearance.length}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === 'cases' && visibleCases.map((r) => {
          const e = employeeById(r.employeeId)!;
          const done = r.clearance.filter((c) => c.done).length;
          const allDone = done === r.clearance.length;
          const caseAssets = (r.assets ?? []).map((x) => ({ ...x, asset: ASSETS.find((a) => a.id === x.assetId)! }));
          const assetsBack = caseAssets.filter((x) => x.returned).length;
          const assetsOutstanding = caseAssets.length - assetsBack;
          const completed = r.status === 'Completed';
          const left = daysBetween(REFERENCE_TODAY, r.lastWorkingDay);
          return (
            <div key={r.id} style={{ padding: 20, borderTop: '1px solid var(--border-soft)' }}>
              <div className="person" style={{ marginBottom: 14 }}>
                <div className="av" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--gray-50)', color: 'var(--text-2)' }}>
                  {e.avatarInitials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {e.name}
                    <EmpId code={e.employeeCode} />
                  </div>
                  <div className="sb" style={{ fontSize: 12 }}>
                    {e.designation} · {e.department} · {locationName(e.location)}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 32px', marginBottom: 14 }}>
                <Detail k="Reason" v={r.reason} />
                <Detail k="Notice given" v={r.resignationDate} />
                {r.noticeDays !== undefined && <Detail k="Notice period" v={r.noticeDays === 0 ? 'Immediate' : `${r.noticeDays} days`} />}
                <Detail
                  k="Last working day"
                  v={
                    <>
                      {r.lastWorkingDay}
                      {!completed && (
                        <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 600, color: left < 0 ? '#B91C1C' : left <= 7 ? '#B45309' : 'var(--muted)' }}>
                          {left > 0 ? `${left} day(s) left` : left === 0 ? 'Last day today' : `${-left} day(s) past`}
                        </span>
                      )}
                    </>
                  }
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, maxWidth: 320, height: 6, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(done / r.clearance.length) * 100}%`, background: allDone ? 'var(--success)' : 'var(--primary)', borderRadius: 6 }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {done} of {r.clearance.length} clearance items complete
                </span>
              </div>

              <div className="aflow">
                {r.clearance.map((c, i) => (
                  <label key={c.item} className={`node ${c.done ? 'done' : ''}`} style={{ cursor: completed ? 'default' : 'pointer', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={c.done} disabled={completed || c.item === ASSET_ITEM} title={c.item === ASSET_ITEM ? "Completes automatically once every asset below is returned" : undefined} onChange={() => toggleClearance(r.id, i)} />
                    <span className="role">{c.item}</span>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
                  Company assets{caseAssets.length ? ` · ${assetsBack} of ${caseAssets.length} returned` : ''}
                </div>
                {caseAssets.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No company assets were assigned to this employee.</div>
                ) : (
                  caseAssets.map(({ assetId, returned, asset }) => (
                    <label key={assetId} className="doc" style={{ cursor: completed ? 'default' : 'pointer', margin: '0 0 6px' }}>
                      <input type="checkbox" checked={returned} disabled={completed} onChange={() => toggleAsset(r.id, assetId)} />
                      <div style={{ flex: 1 }}>
                        <div className="nm">
                          {asset.name} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· {asset.type}</span>
                        </div>
                        <div className="mt">
                          Serial {asset.serialNumber} · Assigned {asset.assignedDate}
                          {asset.status === 'In Repair' ? ' · currently in repair' : ''}
                        </div>
                      </div>
                      <Badge tone={returned ? 'active' : 'soon'}>{returned ? 'Returned' : 'Outstanding'}</Badge>
                    </label>
                  ))
                )}
              </div>

              {r.notes && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>Note: {r.notes}</div>}

              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                {completed ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#15803D', fontWeight: 600 }}>
                    <CheckIcon style={{ width: 14, height: 14 }} /> Completed — employee marked inactive
                  </span>
                ) : (
                  <>
                    <Button size="sm" variant="success" disabled={!allDone} onClick={() => approve(r)} title={allDone ? undefined : assetsOutstanding ? 'Return all assets first' : 'Finish every clearance item first'}>
                      <CheckIcon /> Approve &amp; complete
                    </Button>
                    <Button size="sm" onClick={() => withdraw(r)}>
                      Withdraw case
                    </Button>
                    {!allDone && (
                      <span style={{ fontSize: 11.5, color: assetsOutstanding ? '#B45309' : 'var(--faint)' }}>
                        {assetsOutstanding ? `Return the ${assetsOutstanding} outstanding asset(s) and finish every clearance item to approve.` : 'Complete every clearance item to approve.'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="row-gap">
        <CardHeader title="Inactive employees" sub="Historical record preserved" />
        {!inactive.length && <EmptyState icon={<ExitIcon />} title="No inactive employees" description="Employees appear here once their separation is completed." />}
        {inactive.map((e) => {
          const c = cases.find((x) => x.employeeId === e.id && x.status === 'Completed');
          return (
            <div key={e.id} className="doc">
              <div className="fic" style={{ background: 'var(--gray-50)', color: 'var(--text-2)' }}>
                {e.avatarInitials}
              </div>
              <div>
                <div className="nm">
                  {e.name}
                  <EmpId code={e.employeeCode} />
                </div>
                <div className="mt">
                  {c ? `${c.reason} · Last working day ${c.lastWorkingDay}` : `${e.exitReason} · Exited ${e.exitDate}`} · {locationName(e.location)}
                </div>
              </div>
              <div className="rt">
                <StatusBadge status="Inactive" />
              </div>
            </div>
          );
        })}
      </Card>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Start offboarding"
        description="Select the employee and set the notice period. A clearance checklist is created automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit}>
              Start offboarding
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Fg label="Employee" required full>
            <SearchSelect
              options={eligible.map((e) => ({ value: e.id, label: e.name, meta: `${e.employeeCode} · ${e.department}` }))}
              value={empId}
              onChange={(v) => {
                setEmpId(v);
                setError('');
              }}
              placeholder="Search by name or employee ID…"
              emptyText="No eligible employees"
            />
            <span className="hint">Only active employees without an open separation case are listed.</span>
          </Fg>
        </div>

        {selected && (
          <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, background: 'var(--bg)' }}>
            <div className="person">
              <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                {selected.avatarInitials}
              </div>
              <div>
                <div className="nm">
                  {selected.name}
                  <EmpId code={selected.employeeCode} />
                </div>
                <div className="sb">
                  {selected.designation} · {selected.department}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
              <span>{selected.company}</span>
              <span>{locationName(selected.location)}</span>
              <span>Joined {selected.dateOfJoining}</span>
              <span>
                Manager: {selectedMgr ? selectedMgr.name : '—'}
                {selectedMgr && <EmpId code={selectedMgr.employeeCode} />}
              </span>
            </div>
            <div className={selectedAssets.length ? 'note-box warn' : 'note-box'} style={{ marginTop: 10 }}>
              <div>
                {selectedAssets.length
                  ? `${selectedAssets.length} company asset(s) must be returned before this case can be approved: ${selectedAssets.map((a) => a.name).join(', ')}.`
                  : 'No company assets are assigned to this employee.'}
              </div>
            </div>
          </div>
        )}

        <div className="form-grid" style={{ marginTop: 16 }}>
          <Fg label="Reason" required>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Fg>
          <Fg label="Resignation / notice date" required>
            <input
              type="date"
              value={resDate}
              onChange={(e) => {
                setResDate(e.target.value);
                setLwdManual('');
                setError('');
              }}
            />
          </Fg>
          <Fg label="Notice period">
            <select
              value={notice}
              onChange={(e) => {
                setNotice(Number(e.target.value));
                setLwdManual('');
              }}
            >
              {NOTICE.map((n) => (
                <option key={n.days} value={n.days}>
                  {n.label}
                </option>
              ))}
            </select>
          </Fg>
          <Fg label="Last working day" required>
            <input
              type="date"
              value={lwd}
              onChange={(e) => {
                setLwdManual(e.target.value);
                setError('');
              }}
            />
            <span className="hint">Auto-calculated from the notice period — edit it to override.</span>
          </Fg>
          <Fg label="Notes" full>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — handover plan, exit remarks…"
              style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </Fg>
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
      </Drawer>
    </div>
  );
}
