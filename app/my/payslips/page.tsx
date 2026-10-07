'use client';

import { useCurrentEmployee } from '@/context/AppContext';
import { PAYSLIPS } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DownloadIcon, ReceiptIcon } from '@/components/icons';

export default function MyPayslipsPage() {
  const me = useCurrentEmployee();
  const mine = PAYSLIPS.filter((p) => p.employeeId === me.id).slice().reverse();
  const latest = mine[0];

  return (
    <div>
      <PageHeader eyebrow="My Space · Payslips" title="My Payslips" description="Your monthly payslips and salary statements." />

      {latest && (
        <div className="g3">
          <div className="compcard">
            <div className="ttl">Latest net pay</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
              {latest.currency} {latest.net.toLocaleString()}
            </div>
            <div className="num" style={{ marginTop: 4 }}>
              {latest.month}
            </div>
          </div>
          <div className="compcard">
            <div className="ttl">Gross</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
              {latest.currency} {latest.gross.toLocaleString()}
            </div>
          </div>
          <div className="compcard">
            <div className="ttl">Deductions</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, color: '#B91C1C' }}>
              {latest.currency} {latest.deductions.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <Card className="row-gap">
        <CardHeader title="Payslip history" sub={`${mine.length} on file`} />
        {!mine.length ? (
          <EmptyState icon={<ReceiptIcon />} title="No payslips yet" description="Payslips will appear here once the first payroll run completes." />
        ) : (
          mine.map((p) => (
            <div key={p.id} className="doc">
              <div className="fic">
                <ReceiptIcon />
              </div>
              <div>
                <div className="nm">{p.month}</div>
                <div className="mt">
                  Gross {p.currency} {p.gross.toLocaleString()} · Net {p.currency} {p.net.toLocaleString()}
                </div>
              </div>
              <div className="rt" style={{ gap: 10 }}>
                <Badge tone={p.status === 'Paid' ? 'active' : 'pending'}>{p.status}</Badge>
                <Button variant="ghost" size="sm">
                  <DownloadIcon /> PDF
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
