'use client';

import { useCurrentEmployee } from '@/context/AppContext';
import { ASSETS } from '@/lib/data';
import { useSeparation } from '@/context/SeparationContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PackageIcon } from '@/components/icons';

const STATUS_TONE = { Active: 'active', 'In Repair': 'pending', Returned: 'inactive' } as const;

export default function MyAssetsPage() {
  const me = useCurrentEmployee();
  const { isAssetReturned } = useSeparation();
  const mine = ASSETS.filter((a) => a.assignedTo === me.id);

  return (
    <div>
      <PageHeader
        eyebrow="My Space · Assets"
        title="My Assets"
        description="IT and office equipment assigned to you."
        actions={<Button variant="primary">Request new asset</Button>}
      />
      <Card>
        <CardHeader title="Assigned to me" sub={`${mine.length} asset(s)`} />
        {!mine.length ? (
          <EmptyState icon={<PackageIcon />} title="Nothing assigned" description="No assets are currently checked out to you." />
        ) : (
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
              {mine.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="person">
                      <div className="fic" style={{ width: 32, height: 32 }}>
                        <PackageIcon style={{ width: 16, height: 16 }} />
                      </div>
                      <div>
                        <div className="nm">{a.name}</div>
                        <div className="sb">{a.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{a.serialNumber}</td>
                  <td className="mono">{a.assignedDate}</td>
                  <td className="mono">{a.warrantyExpiry}</td>
                  <td>
                    <Badge tone={STATUS_TONE[isAssetReturned(a.id) ? 'Returned' : a.status]}>{isAssetReturned(a.id) ? 'Returned' : a.status}</Badge>
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
