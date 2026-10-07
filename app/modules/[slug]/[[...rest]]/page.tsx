'use client';

import { notFound, useParams } from 'next/navigation';
import { AssetManagementView, PayrollView, RenewalsView } from '@/components/modules/ModuleViews';
import { LaHost } from '@/components/la/LaHost';

export default function ModulePage() {
  const { slug, rest } = useParams<{ slug: string; rest?: string[] }>();

  // Leave & Attendance has one URL per screen: /modules/leave-attendance/<module>/<scope>/<tab>
  if (slug === 'leave-attendance') return <LaHost />;
  if (rest?.length) return notFound();

  if (slug === 'asset-management') return <AssetManagementView />;
  if (slug === 'payroll') return <PayrollView />;
  if (slug === 'renewals') return <RenewalsView />;
  return notFound();
}
