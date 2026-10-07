'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { employeeById, matchesEmployee } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useExpense } from '@/context/ExpenseContext';
import { ExpenseClaim } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { EmpId } from '@/components/ui/EmployeeBits';
import { BellIcon, DownloadIcon, PlusIcon, ReceiptIcon, SearchIcon, XIcon } from '@/components/icons';

const STATUSES: ('All' | ExpenseClaim['status'])[] = ['All', 'Pending', 'Approved', 'Rejected'];

const sums = (list: ExpenseClaim[]) => {
  const by: Record<string, number> = {};
  list.forEach((c) => (by[c.currency] = (by[c.currency] ?? 0) + c.amount));
  const parts = Object.entries(by).map(([cur, n]) => `${cur} ${n.toLocaleString('en-US')}`);
  return parts.length ? parts.join(' · ') : '—';
};

const csvCell = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function Stat({ label, count, amount, color, active, onClick }: { label: string; count: number; amount: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="compcard"
      onClick={onClick}
      title="Click to filter the list"
      style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', outline: active ? '2px solid var(--primary)' : undefined, outlineOffset: -1 }}
    >
      <div className="ttl">{label}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color }}>
        {count}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{amount}</div>
    </button>
  );
}

function ReadBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

export default function AllClaimsPage() {
  const me = useCurrentEmployee();
  const { locations, locationName } = useOrg();
  const { categories, claims, decide, withdrawClaim } = useExpense();

  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('All');
  const [status, setStatus] = useState<'All' | ExpenseClaim['status']>('All');
  const [category, setCategory] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [notice, setNotice] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [decisionError, setDecisionError] = useState('');

  const scoped = claims.filter((c) => {
    const e = employeeById(c.employeeId);
    return !!e && (loc === 'All' || e.location === loc) && (category === 'All' || c.category === category) && (!from || c.date >= from) && (!to || c.date <= to);
  });
  const rows = scoped.filter((c) => (status === 'All' || c.status === status) && (matchesEmployee(employeeById(c.employeeId)!, q) || `${c.project} ${c.description}`.toLowerCase().includes(q.trim().toLowerCase())));

  const byStatus = (s: ExpenseClaim['status']) => scoped.filter((c) => c.status === s);
  const toggleStatus = (s: ExpenseClaim['status']) => setStatus(status === s ? 'All' : s);

  const open = claims.find((c) => c.id === openId);
  const openEmp = open ? employeeById(open.employeeId) : undefined;
  const openLimit = open ? categories.find((c) => c.name === open.category)?.limits[open.currency] : undefined;
  const overLimit = !!open && openLimit !== undefined && open.amount > openLimit;
  const isOwn = !!open && open.employeeId === me.id;

  const openDetail = (c: ExpenseClaim) => {
    setOpenId(c.id);
    setNote('');
    setDecisionError('');
  };

  const approve = () => {
    if (!open) return;
    decide(open.id, 'Approved', me.name, note);
    setNotice(`Claim approved — ${open.currency} ${open.amount.toLocaleString('en-US')} for ${openEmp?.name} (${openEmp?.employeeCode}).`);
    setOpenId(null);
  };

  const reject = () => {
    if (!open) return;
    if (!note.trim()) {
      setDecisionError('Add a short note explaining why the claim is rejected.');
      return;
    }
    decide(open.id, 'Rejected', me.name, note);
    setNotice(`Claim rejected — ${openEmp?.name} (${openEmp?.employeeCode}) will see your note.`);
    setOpenId(null);
  };

  const withdraw = () => {
    if (!open || !window.confirm('Withdraw this pending claim? It will be removed.')) return;
    withdrawClaim(open.id);
    setNotice('Claim withdrawn.');
    setOpenId(null);
  };

  const exportCsv = () => {
    const header = ['Claim ID', 'Employee ID', 'Employee', 'Category', 'Project', 'Currency', 'Amount', 'Expense date', 'Status', 'Submitted', 'Decided on', 'Decided by', 'Note'];
    const lines = rows.map((c) => {
      const e = employeeById(c.employeeId)!;
      return [c.id, e.employeeCode, e.name, c.category, c.project, c.currency, c.amount, c.date, c.status, c.submittedOn, c.decidedOn, c.decidedBy, c.note].map(csvCell).join(',');
    });
    const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expense-claims.csv';
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${rows.length} claim(s) to expense-claims.csv.`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Expense Claims"
        title="All Claims"
        description="Every expense claim — review, approve or reject, filter by date and export."
        actions={
          <>
            <Button onClick={exportCsv} disabled={!rows.length}>
              <DownloadIcon /> Export CSV
            </Button>
            <Link href="/expense/new">
              <Button variant="primary">
                <PlusIcon /> New claim
              </Button>
            </Link>
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

      <div className="g3">
        <Stat label="Pending" count={byStatus('Pending').length} amount={sums(byStatus('Pending'))} color="#B45309" active={status === 'Pending'} onClick={() => toggleStatus('Pending')} />
        <Stat label="Approved" count={byStatus('Approved').length} amount={sums(byStatus('Approved'))} color="#15803D" active={status === 'Approved'} onClick={() => toggleStatus('Approved')} />
        <Stat label="Rejected" count={byStatus('Rejected').length} amount={sums(byStatus('Rejected'))} color="#B91C1C" active={status === 'Rejected'} onClick={() => toggleStatus('Rejected')} />
      </div>

      <Card className="row-gap">
        <CardHeader title="Claims" sub={`${scoped.length} claim(s) in the current filters`} />
        <div className="tbar">
          <div className="tsearch" style={{ width: 260 }}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, employee ID, project…" />
          </div>
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="chip">
            <option value="All">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="chip">
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'All' | ExpenseClaim['status'])} className="chip">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12.5 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12.5 }} />
          </label>
          {(from || to) && (
            <button type="button" className="chip" onClick={() => { setFrom(''); setTo(''); }}>
              Clear dates <XIcon />
            </button>
          )}
          <span className="sp" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {rows.length} of {scoped.length}
          </span>
        </div>

        {!rows.length ? (
          <EmptyState
            icon={<ReceiptIcon />}
            title={scoped.length ? 'No claims match' : 'No claims yet'}
            description={scoped.length ? 'Try a different search or filter.' : 'Submitted claims appear here for review.'}
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Category</th>
                <th>Project</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const e = employeeById(c.employeeId)!;
                const lim = categories.find((x) => x.name === c.category)?.limits[c.currency];
                const over = lim !== undefined && c.amount > lim;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/directory/${e.employeeCode}`} className="person">
                        <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                          {e.avatarInitials}
                        </div>
                        <div>
                          <div className="nm">
                            {e.name}
                            <EmpId code={e.employeeCode} />
                          </div>
                          <div className="sb">{locationName(e.location)}</div>
                        </div>
                      </Link>
                    </td>
                    <td>{c.category}</td>
                    <td>{c.project}</td>
                    <td className="mono">
                      {c.currency} {c.amount.toLocaleString('en-US')}
                      {over && <span style={{ marginLeft: 6 }}><Badge tone="soon">Over limit</Badge></span>}
                    </td>
                    <td className="mono">{c.date}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" variant={c.status === 'Pending' ? 'primary' : 'ghost'} onClick={() => openDetail(c)}>
                        {c.status === 'Pending' ? 'Review' : 'View'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!!rows.length && (
          <div className="tfoot">
            <span>
              Showing {rows.length} of {scoped.length} · total {sums(rows)}
            </span>
          </div>
        )}
      </Card>

      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? `${open.currency} ${open.amount.toLocaleString('en-US')} · ${open.category}` : 'Claim'}
        description={openEmp ? `${openEmp.name} (${openEmp.employeeCode}) · ${open?.id}` : undefined}
        footer={
          open && (
            <>
              <Button variant="ghost" onClick={() => setOpenId(null)}>
                Close
              </Button>
              {open.status === 'Pending' && (
                <>
                  {isOwn && <Button onClick={withdraw}>Withdraw claim</Button>}
                  <Button variant="danger" onClick={reject}>
                    Reject
                  </Button>
                  <Button variant="success" onClick={approve}>
                    Approve
                  </Button>
                </>
              )}
            </>
          )
        }
      >
        {open && openEmp && (
          <>
            <div style={{ marginBottom: 14 }}>
              <StatusBadge status={open.status} />
            </div>
            <ReadBlock label="Project / cost centre">{open.project}</ReadBlock>
            <ReadBlock label="Expense date">{open.date}</ReadBlock>
            <ReadBlock label="Description">{open.description || '—'}</ReadBlock>
            <ReadBlock label="Submitted">{open.submittedOn ?? open.date}</ReadBlock>
            <ReadBlock label="Receipt">{open.receipt ?? <span style={{ color: 'var(--muted)' }}>No receipt attached</span>}</ReadBlock>
            <ReadBlock label="Policy limit">
              {openLimit === undefined ? (
                <span style={{ color: 'var(--muted)' }}>No limit set for {open.category} in {open.currency}</span>
              ) : (
                <span style={{ color: overLimit ? '#B45309' : '#15803D', fontWeight: 600 }}>
                  {open.currency} {openLimit.toLocaleString('en-US')} — {overLimit ? 'this claim exceeds the limit and needs extra management sign-off' : 'within limit'}
                </span>
              )}
            </ReadBlock>
            {open.status !== 'Pending' && (
              <>
                <ReadBlock label={open.status === 'Approved' ? 'Approved by' : 'Rejected by'}>
                  {open.decidedBy ?? '—'} {open.decidedOn && <span style={{ color: 'var(--muted)' }}>· {open.decidedOn}</span>}
                </ReadBlock>
                <ReadBlock label="Decision note">{open.note ?? '—'}</ReadBlock>
              </>
            )}
            {open.status === 'Pending' && (
              <div className="fg full">
                <label>Decision note {note.trim() ? '' : <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(required to reject)</span>}</label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setDecisionError('');
                  }}
                  placeholder="Optional for approval — reason or comments"
                  style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
            )}
            {decisionError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{decisionError}</div>}
          </>
        )}
      </Drawer>
    </div>
  );
}
