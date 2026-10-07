'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ASSETS, BUSINESS_RENEWALS, EMPLOYEES, PAYROLL_TREND, PAYSLIPS, REFERENCE_TODAY, employeeById, matchesEmployee } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { useExpiry } from '@/context/ExpiryContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge, ExpiryBadge, StatusBadge } from '@/components/ui/Badge';
import { EmpId } from '@/components/ui/EmployeeBits';
import { LineChart } from '@/components/charts/LineChart';
import { PackageIcon, ReceiptIcon, RefreshIcon, SearchIcon } from '@/components/icons';

function Stat({ label, value, color, sub }: { label: string; value: React.ReactNode; color?: string; sub?: string }) {
  return (
    <div className="compcard">
      <div className="ttl">{label}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Person({ id }: { id: string }) {
  const e = employeeById(id);
  if (!e) return <span style={{ color: 'var(--faint)' }}>—</span>;
  return (
    <Link href={`/directory/${e.employeeCode}`} className="person">
      <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
        {e.avatarInitials}
      </div>
      <span className="nm">
        {e.name}
        <EmpId code={e.employeeCode} />
      </span>
    </Link>
  );
}

function Toolbar({ q, setQ, placeholder, children }: { q: string; setQ: (v: string) => void; placeholder: string; children?: React.ReactNode }) {
  return (
    <div className="tbar">
      <div className="tsearch" style={{ width: 260 }}>
        <SearchIcon />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      </div>
      {children}
    </div>
  );
}

const money = (currency: string, n: number) => `${currency} ${n.toLocaleString('en-US')}`;

/* ---------------------------------------------------------------- Asset Management */
export function AssetManagementView() {
  const { isAssetReturned } = useSeparation();
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [status, setStatus] = useState('All');

  const all = ASSETS.map((a) => {
    const returned = a.status === 'Returned' || isAssetReturned(a.id);
    return { a, returned, label: returned ? 'Returned' : a.status, expired: a.warrantyExpiry < REFERENCE_TODAY };
  });
  const rows = all.filter(
    (r) =>
      (type === 'All' || r.a.type === type) &&
      (status === 'All' || r.label === status) &&
      (`${r.a.name} ${r.a.serialNumber} ${r.a.type}`.toLowerCase().includes(q.trim().toLowerCase()) || matchesEmployee(employeeById(r.a.assignedTo)!, q))
  );
  const types = [...new Set(ASSETS.map((a) => a.type))];

  return (
    <div>
      <PageHeader eyebrow="Module" title="Asset Management" description="Company equipment register — who holds what, warranty status and returns from offboarding." />
      <div className="g4">
        <Stat label="Total assets" value={all.length} color="var(--primary)" />
        <Stat label="Assigned" value={all.filter((r) => r.label === 'Active').length} color="#15803D" />
        <Stat label="In repair" value={all.filter((r) => r.label === 'In Repair').length} color="#B45309" />
        <Stat label="Out of warranty" value={all.filter((r) => r.expired && !r.returned).length} color="#B91C1C" sub="still assigned" />
      </div>
      <Card className="row-gap">
        <CardHeader title="Asset register" sub={`${all.length} asset(s)`} action={<Link href="/offboarding" className="lnk">Returns via Offboarding →</Link>} />
        <Toolbar q={q} setQ={setQ} placeholder="Search asset, serial or employee…">
          <select value={type} onChange={(e) => setType(e.target.value)} className="chip">
            <option value="All">All types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="chip">
            <option value="All">All statuses</option>
            <option>Active</option>
            <option>In Repair</option>
            <option>Returned</option>
          </select>
          <span className="sp" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {rows.length} of {all.length}
          </span>
        </Toolbar>
        {!rows.length ? (
          <EmptyState icon={<PackageIcon />} title="No matching assets" description="Try a different search or filter." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Serial number</th>
                <th>Assigned to</th>
                <th>Assigned on</th>
                <th>Warranty until</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, returned, label, expired }) => (
                <tr key={a.id}>
                  <td>
                    <div className="nm">{a.name}</div>
                    <div className="sb">{a.type}</div>
                  </td>
                  <td className="mono">{a.serialNumber}</td>
                  <td>
                    <Person id={a.assignedTo} />
                  </td>
                  <td className="mono">{a.assignedDate}</td>
                  <td className="mono">
                    {a.warrantyExpiry}
                    {expired && !returned && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#B91C1C' }}>Expired</span>}
                  </td>
                  <td>
                    <Badge tone={label === 'Active' ? 'active' : label === 'In Repair' ? 'pending' : 'inactive'}>{label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Payroll Management */
export function PayrollView() {
  const months = [...new Set(PAYSLIPS.map((p) => p.month))];
  const [month, setMonth] = useState(months[months.length - 1]);
  const [q, setQ] = useState('');
  const slips = PAYSLIPS.filter((p) => p.month === month && employeeById(p.employeeId));
  const rows = slips.filter((p) => matchesEmployee(employeeById(p.employeeId)!, q));

  const totals = (key: 'gross' | 'deductions' | 'net') => {
    const by: Record<string, number> = {};
    slips.forEach((p) => (by[p.currency] = (by[p.currency] ?? 0) + p[key]));
    return Object.entries(by).map(([c, n]) => money(c, n)).join(' · ') || '—';
  };

  return (
    <div>
      <PageHeader
        eyebrow="Module"
        title="Payroll Management"
        description="Monthly payroll runs by employee — gross, deductions, net pay and payout status."
        actions={
          <Link href="/my/payslips">
            <Button>My payslips</Button>
          </Link>
        }
      />
      <div className="g4">
        <Stat label="Employees paid" value={slips.length} color="var(--primary)" sub={month} />
        <Stat label="Gross" value={<span style={{ fontSize: 15 }}>{totals('gross')}</span>} />
        <Stat label="Deductions" value={<span style={{ fontSize: 15 }}>{totals('deductions')}</span>} color="#B45309" />
        <Stat label="Net payable" value={<span style={{ fontSize: 15 }}>{totals('net')}</span>} color="#15803D" sub={`${slips.filter((p) => p.status === 'Processing').length} still processing`} />
      </div>

      <div className="g2 row-gap">
        <Card>
          <CardHeader title="Payroll cost trend" sub="Last 6 months · UAE · AED" />
          <LineChart data={PAYROLL_TREND} />
        </Card>
        <Card>
          <CardHeader title="Payroll run" sub={`${month}`} />
          <div style={{ padding: 18, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            <div>
              <b style={{ color: 'var(--text)' }}>{slips.filter((p) => p.status === 'Paid').length}</b> paid · <b style={{ color: 'var(--text)' }}>{slips.filter((p) => p.status === 'Processing').length}</b> processing
            </div>
            <div style={{ marginTop: 6 }}>UAE salaries go out through the WPS file; India salaries through bank transfer with EPF/UAN contributions.</div>
          </div>
        </Card>
      </div>

      <Card className="row-gap">
        <CardHeader title="Payslips" sub={`${rows.length} of ${slips.length} for ${month}`} />
        <Toolbar q={q} setQ={setQ} placeholder="Search by name or employee ID…">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="chip">
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Toolbar>
        {!rows.length ? (
          <EmptyState icon={<ReceiptIcon />} title="No payslips match" description="Try a different search or month." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Net pay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Person id={p.employeeId} />
                  </td>
                  <td className="mono">{money(p.currency, p.gross)}</td>
                  <td className="mono">{money(p.currency, p.deductions)}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {money(p.currency, p.net)}
                  </td>
                  <td>
                    <Badge tone={p.status === 'Paid' ? 'active' : 'pending'}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- Renewal Management */
export function RenewalsView() {
  const { locationName } = useOrg();
  const { statusOf } = useSeparation();
  const { rowsFor, daysOf, stateOf } = useExpiry();
  const [q, setQ] = useState('');
  const [window, setWindow] = useState('90');
  const [kind, setKind] = useState('All');

  const employeeItems = rowsFor(EMPLOYEES.filter((e) => statusOf(e) !== 'Inactive')).map((r) => ({
    id: r.key,
    kind: 'Employee',
    title: r.type,
    owner: r.employee.name,
    ownerId: r.employee.employeeCode,
    place: locationName(r.employee.location),
    due: r.expiry,
    days: daysOf(r),
    state: stateOf(r),
  }));
  const businessItems = BUSINESS_RENEWALS.map((b) => ({
    id: b.id,
    kind: 'Business',
    title: b.label,
    owner: b.owner,
    ownerId: '',
    place: b.location === 'Both' ? 'All locations' : locationName(b.location),
    due: addDays(REFERENCE_TODAY, b.offsetDays),
    days: b.offsetDays,
    state: (b.offsetDays < 0 ? 'expired' : b.offsetDays <= 90 ? 'soon' : 'ok') as 'expired' | 'soon' | 'ok',
  }));
  const all = [...employeeItems, ...businessItems].sort((a, b) => a.days - b.days);
  const limit = window === 'All' ? Infinity : Number(window);
  const rows = all.filter((r) => r.days <= limit && (kind === 'All' || r.kind === kind) && `${r.title} ${r.owner} ${r.ownerId}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <PageHeader
        eyebrow="Module"
        title="Renewal Management"
        description="Every employee document and business licence, lease or subscription due for renewal — in one timeline."
        actions={
          <>
            <Link href="/visa">
              <Button>Visa management</Button>
            </Link>
            <Link href="/employee-expiry">
              <Button variant="primary">Employee expiry</Button>
            </Link>
          </>
        }
      />
      <div className="g4">
        <Stat label="Overdue" value={all.filter((r) => r.days < 0).length} color="#B91C1C" />
        <Stat label="Due within 30 days" value={all.filter((r) => r.days >= 0 && r.days <= 30).length} color="#C2410C" />
        <Stat label="Due within 90 days" value={all.filter((r) => r.days >= 0 && r.days <= 90).length} color="#B45309" />
        <Stat label="Tracked in total" value={all.length} color="var(--primary)" sub={`${employeeItems.length} employee · ${businessItems.length} business`} />
      </div>
      <Card className="row-gap">
        <CardHeader title="Renewal timeline" sub="Sorted by urgency" />
        <Toolbar q={q} setQ={setQ} placeholder="Search renewal, employee or owner…">
          <select value={window} onChange={(e) => setWindow(e.target.value)} className="chip">
            <option value="30">Due within 30 days</option>
            <option value="90">Due within 90 days</option>
            <option value="180">Due within 180 days</option>
            <option value="All">Everything</option>
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="chip">
            <option value="All">All kinds</option>
            <option>Employee</option>
            <option>Business</option>
          </select>
          <span className="sp" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {rows.length} of {all.length}
          </span>
        </Toolbar>
        {!rows.length ? (
          <EmptyState icon={<RefreshIcon />} title="Nothing in this window" description="Widen the window or clear the search." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Renewal</th>
                <th>Kind</th>
                <th>Owner</th>
                <th>Location</th>
                <th>Due</th>
                <th>Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.title}</td>
                  <td>
                    <StatusBadge status={r.kind === 'Employee' ? 'In Progress' : 'Pending'} />
                  </td>
                  <td>
                    {r.owner}
                    {r.ownerId && <EmpId code={r.ownerId} />}
                  </td>
                  <td>{r.place}</td>
                  <td className="mono">{r.due}</td>
                  <td style={{ color: r.days < 0 ? '#B91C1C' : r.days <= 30 ? '#C2410C' : 'var(--muted)', fontWeight: r.days <= 30 ? 700 : 400 }}>{r.days < 0 ? `${-r.days}d overdue` : `${r.days}d`}</td>
                  <td>
                    <ExpiryBadge state={r.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
