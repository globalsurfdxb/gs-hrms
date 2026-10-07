'use client';

import Link from 'next/link';
import { AUDIT_LOG, employeeById } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';


export default function AuditLogPage() {
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Audit Logs" description="Who changed what, when — every tracked field change on an employee record." />
      <Card>
        <CardHeader title="Recent changes" sub={`${AUDIT_LOG.length} entries`} />
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Field</th>
              <th>From</th>
              <th>To</th>
              <th>Changed by</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {AUDIT_LOG.map((a) => {
              const e = employeeById(a.employeeId);
              return (
                <tr key={a.id}>
                  <td>
                    <Link href={`/directory/${a.employeeId}`} className="person">
                      <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)', width: 28, height: 28, fontSize: 11 }}>
                        {e?.avatarInitials}
                      </div>
                      <span className="nm">{e?.name}</span>
                    </Link>
                  </td>
                  <td>{a.field}</td>
                  <td className="mono">{a.from}</td>
                  <td className="mono">{a.to}</td>
                  <td>{a.changedBy}</td>
                  <td className="mono">{a.changedOn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
