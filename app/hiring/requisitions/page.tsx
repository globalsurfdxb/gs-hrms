'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { InboxIcon, CheckIcon, ClockIcon, JoinIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { Banner, HiringHeader, ReqBadge, empName, fmtDate, money, payUnit } from '@/components/hiring/HiringBits';
import { RequisitionDrawer } from '@/components/hiring/HiringForms';
import { useScoped } from '@/components/hiring/useScoped';
import { jobForRequisition } from '@/lib/hiringStore';
import { RequisitionStatus } from '@/lib/hiringTypes';

const STATUSES: ('All' | RequisitionStatus)[] = ['All', 'Draft', 'Pending Approval', 'Approved', 'On Hold', 'Rejected', 'Closed'];

export default function RequisitionsPage() {
  return (
    <Suspense fallback={null}>
      <Requisitions />
    </Suspense>
  );
}

function Requisitions() {
  const { s, requisitions, currency, loc } = useScoped();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'All' | RequisitionStatus>('All');
  const [drawer, setDrawer] = useState(params.get('new') === '1');
  const [notice, setNotice] = useState('');

  const needle = q.trim().toLowerCase();
  const rows = requisitions.filter((r) => (status === 'All' || r.status === status) && (!needle || `${r.code} ${r.title} ${r.department} ${empName(r.hiringManagerId)}`.toLowerCase().includes(needle)));
  const count = (st: RequisitionStatus) => requisitions.filter((r) => r.status === st).length;
  const waitingJob = requisitions.filter((r) => r.status === 'Approved' && !jobForRequisition(s, r.id));
  const approvedPositions = requisitions.filter((r) => r.status === 'Approved').reduce((n, r) => n + r.positions, 0);

  const closeDrawer = () => {
    setDrawer(false);
    if (params.get('new')) router.replace('/hiring/requisitions');
  };

  return (
    <div className="hm-page">
      <HiringHeader
        title="Requisitions"
        description="Headcount requests. Each goes Hiring Manager → HR → Management; only an approved requisition can become a job."
        actions={
          <>
            <Button variant="primary" onClick={() => setDrawer(true)}>
              <PlusIcon /> New requisition
            </Button>
          </>
        }
      />
      {notice && <Banner onClose={() => setNotice('')}>{notice}</Banner>}

      <StatStrip
        items={[
          { label: 'Requisitions', value: requisitions.length, icon: <InboxIcon />, tone: 'blue', hint: loc === 'Kochi' ? 'India' : 'United Arab Emirates' },
          { label: 'Pending approval', value: count('Pending Approval'), icon: <ClockIcon />, tone: 'amber', hint: 'In the approval chain' },
          { label: 'Approved positions', value: approvedPositions, icon: <CheckIcon />, tone: 'green', hint: `${count('Approved')} requisition${count('Approved') === 1 ? '' : 's'}` },
          { label: 'Waiting for a job', value: waitingJob.length, icon: <JoinIcon />, tone: 'purple', hint: 'Approved, no job yet' },
        ]}
      />

      <Card>
        <CardHeader title="All requisitions" sub={`${rows.length} of ${requisitions.length}`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, role, department or manager…" />
          </div>
          {STATUSES.map((st) => (
            <button key={st} type="button" className={`chip ${status === st ? 'tx-chip-on' : ''}`} onClick={() => setStatus(st)}>
              {st} · {st === 'All' ? requisitions.length : count(st)}
            </button>
          ))}
        </div>

        {!rows.length ? (
          <EmptyState
            icon={<InboxIcon />}
            title={requisitions.length ? 'No requisitions match' : 'No requisitions yet'}
            description={requisitions.length ? 'Try a different search or status.' : 'Raise a requisition to ask for headcount.'}
          />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Requisition</th>
                  <th>Positions</th>
                  <th>Budget</th>
                  <th>Hiring manager</th>
                  <th>Target start</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const job = jobForRequisition(s, r.id);
                  const step = r.approvals.find((a) => a.status === 'Pending');
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/hiring/requisitions/${r.id}`} className="hm-link">
                          <div style={{ fontWeight: 600 }}>{r.title}</div>
                          <div className="tx-s faint">
                            {r.code} · {r.department}{r.designationTitle ? ` · ${r.designationTitle}` : ''} · {r.reason}
                          </div>
                        </Link>
                      </td>
                      <td className="mono">{r.positions}</td>
                      <td className="mono">
                        {money(r.budgetMin, currency)} – {money(r.budgetMax, currency)}
                        <div className="tx-s faint">{payUnit(currency)}</div>
                      </td>
                      <td>{empName(r.hiringManagerId)}</td>
                      <td className="mono">{fmtDate(r.targetStart)}</td>
                      <td>
                        <ReqBadge status={r.status} />
                        {step && <div className="tx-s faint">Waiting on {step.label}</div>}
                        {job && <div className="tx-s faint">{job.code}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/hiring/requisitions/${r.id}`} className="btn sm ghost">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RequisitionDrawer
        open={drawer}
        onClose={closeDrawer}
        onDone={(r, submitted) => {
          setDrawer(false);
          if (params.get('new')) router.replace('/hiring/requisitions');
          setNotice(submitted ? `${r.code} was submitted for approval.` : `${r.code} was saved as a draft.`);
        }}
      />
    </div>
  );
}
