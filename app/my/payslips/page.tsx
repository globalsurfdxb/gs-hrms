'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { PAYSLIPS } from '@/lib/data';
import { Payslip } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { DownloadIcon, ListIcon, ReceiptIcon, SearchIcon, TagIcon, UserIcon } from '@/components/icons';

type StatusFilter = 'all' | Payslip['status'];

export default function MyPayslipsPage() {
  const me = useCurrentEmployee();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const mine = PAYSLIPS.filter((p) => p.employeeId === me.id).slice().reverse();
  const latest = mine[0];
  const money = (p: Payslip, n: number) => `${p.currency} ${n.toLocaleString()}`;
  const countOf = (s: Payslip['status']) => mine.filter((p) => p.status === s).length;

  const needle = q.trim().toLowerCase();
  const shown = mine.filter((p) => (status === 'all' || p.status === status) && (!needle || p.month.toLowerCase().includes(needle)));

  return (
    <div>
      <PageHeader eyebrow="My Space" title="My Payslips" description="Your monthly payslips and salary statements." />

      {latest && (
        <div className="ss-strip">
          <StatStrip
            items={[
              { label: 'Latest net pay', value: money(latest, latest.net), icon: <ReceiptIcon />, tone: 'blue', hint: latest.month },
              { label: 'Gross', value: money(latest, latest.gross), icon: <UserIcon />, tone: 'green', hint: latest.month },
              { label: 'Deductions', value: money(latest, latest.deductions), icon: <TagIcon />, tone: 'red', hint: `${Math.round((latest.deductions / latest.gross) * 100)}% of gross` },
              { label: 'Payslips on file', value: mine.length, icon: <ListIcon />, tone: 'purple', hint: `${countOf('Paid')} paid · ${countOf('Processing')} processing` },
            ]}
          />
        </div>
      )}

      <Card>
        <CardHeader title="Payslip history" sub={`${mine.length} on file`} />
        {!mine.length ? (
          <EmptyState icon={<ReceiptIcon />} title="No payslips yet" description="Payslips will appear here once the first payroll run completes." />
        ) : (
          <>
            <div className="tbar">
              <div className="tsearch">
                <SearchIcon />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by month, e.g. June…" />
              </div>
              <FilterChips
                value={status}
                onChange={setStatus}
                options={[
                  { key: 'all', label: 'All', count: mine.length },
                  { key: 'Paid', label: 'Paid', count: countOf('Paid') },
                  { key: 'Processing', label: 'Processing', count: countOf('Processing') },
                ]}
              />
            </div>
            <div className="ss-list">
              {!shown.length && <EmptyState icon={<SearchIcon />} title="No matches" description="No payslips match your search or filter." />}
              {shown.map((p) => (
                <div key={p.id} className="doc">
                  <span className={`ss-ic ss-tone-${p.status === 'Paid' ? 'green' : 'amber'}`}>
                    <ReceiptIcon />
                  </span>
                  <div className="ss-body">
                    <div className="ss-nm">{p.month}</div>
                    <div className="ss-mt">
                      Gross {money(p, p.gross)} · Deductions {money(p, p.deductions)}
                    </div>
                  </div>
                  <div className="rt" style={{ gap: 14 }}>
                    <div className="ss-amt">
                      <b>{money(p, p.net)}</b>
                      <span>Net pay</span>
                    </div>
                    <Badge tone={p.status === 'Paid' ? 'active' : 'pending'}>{p.status}</Badge>
                    <Button variant="ghost" size="sm">
                      <DownloadIcon /> PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="ss-foot">
              <span>
                Showing {shown.length} of {mine.length} payslip(s)
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
