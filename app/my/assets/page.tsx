'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { ASSETS, REFERENCE_TODAY } from '@/lib/data';
import { Asset, ExpiryState } from '@/lib/types';
import { useSeparation } from '@/context/SeparationContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge, ExpiryBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { FilterChips } from '@/components/ui/FilterChips';
import { CheckIcon, PackageIcon, RefreshIcon, SearchIcon, WarnIcon } from '@/components/icons';

const STATUS_TONE = { Active: 'active', 'In Repair': 'pending', Returned: 'inactive' } as const;
type AssetStatus = Asset['status'];
type StatusFilter = 'all' | AssetStatus;

/** Warranty is expired once past the reference date, and "soon" within 90 days of it. */
function warrantyState(expiry: string): ExpiryState {
  if (expiry < REFERENCE_TODAY) return 'expired';
  const days = (new Date(expiry).getTime() - new Date(REFERENCE_TODAY).getTime()) / 86400000;
  return days <= 90 ? 'soon' : 'ok';
}

export default function MyAssetsPage() {
  const me = useCurrentEmployee();
  const { isAssetReturned } = useSeparation();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const mine = ASSETS.filter((a) => a.assignedTo === me.id).map((a) => ({ ...a, shownStatus: (isAssetReturned(a.id) ? 'Returned' : a.status) as AssetStatus }));
  const countOf = (s: AssetStatus) => mine.filter((a) => a.shownStatus === s).length;
  const warrantyAlerts = mine.filter((a) => a.shownStatus !== 'Returned' && warrantyState(a.warrantyExpiry) !== 'ok').length;

  const needle = q.trim().toLowerCase();
  const shown = mine.filter((a) => (status === 'all' || a.shownStatus === status) && (!needle || `${a.name} ${a.type} ${a.serialNumber}`.toLowerCase().includes(needle)));

  return (
    <div>
      <PageHeader
        eyebrow="My Space"
        title="My Assets"
        description="IT and office equipment assigned to you."
        actions={<Button variant="primary">Request new asset</Button>}
      />

      <div className="ss-strip">
        <StatStrip
          items={[
            { label: 'Assigned to me', value: mine.length, icon: <PackageIcon />, tone: 'blue', hint: 'All equipment' },
            { label: 'In use', value: countOf('Active'), icon: <CheckIcon />, tone: 'green' },
            { label: 'In repair', value: countOf('In Repair'), icon: <RefreshIcon />, tone: 'amber' },
            { label: 'Warranty alerts', value: warrantyAlerts, icon: <WarnIcon />, tone: warrantyAlerts ? 'red' : 'gray', hint: 'Expired or expiring in 90 days' },
          ]}
        />
      </div>

      <Card>
        <CardHeader title="Assigned to me" sub={`${mine.length} asset(s)`} />
        {!mine.length ? (
          <EmptyState icon={<PackageIcon />} title="Nothing assigned" description="No assets are currently checked out to you." />
        ) : (
          <>
            <div className="tbar">
              <div className="tsearch">
                <SearchIcon />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by asset, type or serial…" />
              </div>
              <FilterChips
                value={status}
                onChange={setStatus}
                options={[
                  { key: 'all', label: 'All', count: mine.length },
                  { key: 'Active', label: 'Active', count: countOf('Active') },
                  { key: 'In Repair', label: 'In repair', count: countOf('In Repair') },
                  { key: 'Returned', label: 'Returned', count: countOf('Returned') },
                ]}
              />
            </div>
            {!shown.length ? (
              <EmptyState icon={<SearchIcon />} title="No matches" description="No assets match your search or filter." />
            ) : (
              <div className="ss-tscroll">
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Serial number</th>
                      <th>Assigned on</th>
                      <th>Warranty until</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="person">
                            <span className="ss-ic sm ss-tone-blue">
                              <PackageIcon />
                            </span>
                            <div>
                              <div className="nm">{a.name}</div>
                              <div className="sb">{a.type}</div>
                            </div>
                          </div>
                        </td>
                        <td className="mono">{a.serialNumber}</td>
                        <td className="mono">{a.assignedDate}</td>
                        <td>
                          <div className="mono">{a.warrantyExpiry}</div>
                          {a.shownStatus !== 'Returned' && <ExpiryBadge state={warrantyState(a.warrantyExpiry)} />}
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[a.shownStatus]}>{a.shownStatus}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="ss-foot">
              <span>
                Showing {shown.length} of {mine.length} asset(s)
              </span>
              <span>Warranty status as of {REFERENCE_TODAY}</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
