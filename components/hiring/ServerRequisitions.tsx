'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { InboxIcon, CheckIcon, ClockIcon, JoinIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { Banner, HiringHeader, ReqBadge, fmtDate, payUnit, useHiringLocation } from '@/components/hiring/HiringBits';
import { ServerRequisitionDrawer } from '@/components/hiring/ServerRequisitionForm';
import { errorMessage } from '@/lib/api';
import { can } from '@/lib/access';
import { usePermissions } from '@/lib/auth';
import { RequisitionStatus } from '@/lib/hiringTypes';
import { REQ_STATUS, STEP_LABEL, ServerRequisition, amount, designationOf, requisitionsApi } from '@/lib/requisitionsApi';

/* The Requisitions list from the backend (local development). The server returns only what the caller may see
   (BR-HIR-022) in the chosen location; search and the status chips filter that list here. */

const STATUSES: ('All' | RequisitionStatus)[] = ['All', 'Draft', 'Pending Approval', 'Approved', 'On Hold', 'Rejected', 'Closed'];
const FEATURE = 'hiring:requisitions:requisitions';

export function ServerRequisitions() {
  const { loc } = useHiringLocation();
  const perms = usePermissions() ?? [];
  const router = useRouter();
  const params = useSearchParams();
  const [list, setList] = useState<ServerRequisition[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'All' | RequisitionStatus>('All');
  const [drawer, setDrawer] = useState(params.get('new') === '1');
  const [notice, setNotice] = useState('');
  const canAdd = can(perms, FEATURE, 'add');

  const load = useCallback(() => {
    let live = true;
    requisitionsApi
      .all(loc)
      .then((r) => {
        if (!live) return;
        setList(r);
        setLoadError('');
      })
      .catch((e) => live && setLoadError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [loc]);
  useEffect(load, [load]);

  const requisitions = list ?? [];
  const label = (r: ServerRequisition) => REQ_STATUS[r.status];
  const needle = q.trim().toLowerCase();
  const rows = requisitions.filter(
    (r) => (status === 'All' || label(r) === status) && (!needle || `${r.code} ${r.title} ${r.department.name} ${r.hiringManager.name}`.toLowerCase().includes(needle)),
  );
  const count = (st: RequisitionStatus) => requisitions.filter((r) => label(r) === st).length;
  const approved = requisitions.filter((r) => r.status === 'APPROVED');
  const waitingJob = approved.filter((r) => !r.job);
  const approvedPositions = approved.reduce((n, r) => n + r.positions, 0);

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
          canAdd && (
            <Button variant="primary" onClick={() => setDrawer(true)}>
              <PlusIcon /> New requisition
            </Button>
          )
        }
      />
      {notice && <Banner onClose={() => setNotice('')}>{notice}</Banner>}
      {loadError && (
        <Banner tone="warn">
          Requisitions could not be loaded: {loadError}{' '}
          <button type="button" className="btn sm ghost" onClick={load}>
            Try again
          </button>
        </Banner>
      )}

      <StatStrip
        items={[
          { label: 'Requisitions', value: requisitions.length, icon: <InboxIcon />, tone: 'blue', hint: loc === 'Kochi' ? 'India' : 'United Arab Emirates' },
          { label: 'Pending approval', value: count('Pending Approval'), icon: <ClockIcon />, tone: 'amber', hint: 'In the approval chain' },
          { label: 'Approved positions', value: approvedPositions, icon: <CheckIcon />, tone: 'green', hint: `${approved.length} requisition${approved.length === 1 ? '' : 's'}` },
          { label: 'Waiting for a job', value: waitingJob.length, icon: <JoinIcon />, tone: 'purple', hint: 'Approved, no job yet' },
        ]}
      />

      <Card>
        <CardHeader title="All requisitions" sub={list ? `${rows.length} of ${requisitions.length}` : 'Loading…'} />
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

        {!list ? (
          <p className="sb" style={{ padding: '16px 20px' }}>
            {loadError ? '—' : 'Loading…'}
          </p>
        ) : !rows.length ? (
          <EmptyState
            icon={<InboxIcon />}
            title={requisitions.length ? 'No requisitions match' : 'No requisitions yet'}
            description={requisitions.length ? 'Try a different search or status.' : canAdd ? 'Raise a requisition to ask for headcount.' : 'Requisitions you are part of appear here.'}
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
                  const step = r.steps.find((s) => s.status === 'PENDING');
                  const d = designationOf(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/hiring/requisitions/${r.id}`} className="hm-link">
                          <div style={{ fontWeight: 600 }}>{r.title}</div>
                          <div className="tx-s faint">
                            {r.code} · {r.department.name}
                            {d ? ` · ${d.title}${d.isNew ? ' (new)' : ''}` : ''} · {r.reason === 'REPLACEMENT' ? 'Replacement' : 'New role'}
                          </div>
                        </Link>
                      </td>
                      <td className="mono">{r.positions}</td>
                      <td className="mono">
                        {amount(r.budgetMin)} – {amount(r.budgetMax)}
                        <div className="tx-s faint">{payUnit(r.budgetMin.currency)}</div>
                      </td>
                      <td>{r.hiringManager.name}</td>
                      <td className="mono">{fmtDate(r.targetStart)}</td>
                      <td>
                        <ReqBadge status={label(r)} />
                        {step && <div className="tx-s faint">Waiting on {STEP_LABEL[step.label]}</div>}
                        {r.job && <div className="tx-s faint">{r.job.code}</div>}
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

      <ServerRequisitionDrawer
        open={drawer}
        onClose={closeDrawer}
        onDone={(r, submitted) => {
          closeDrawer();
          setNotice(submitted ? `${r.code} was submitted for approval.` : `${r.code} was saved as a draft.`);
          load();
        }}
      />
    </div>
  );
}
