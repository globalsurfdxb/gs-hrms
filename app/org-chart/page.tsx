'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { EMPLOYEES, departmentHeadcount, directReports } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { Employee } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { EmpId } from '@/components/ui/EmployeeBits';
import { BuildingIcon, TreeIcon } from '@/components/icons';

function Node({ e, scoped, depth }: { e: Employee; scoped: Employee[]; depth: number }) {
  const reports = directReports(e.id).filter((r) => scoped.includes(r));
  return (
    <div style={depth > 0 ? { marginLeft: 32, borderLeft: '1px solid var(--border)', paddingLeft: 24 } : undefined}>
      <Link
        href={`/directory/${e.employeeCode}`}
        className="person"
        style={{ width: 'fit-content', margin: '10px 0', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', background: '#fff', boxShadow: 'var(--shadow)' }}
      >
        <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
          {e.avatarInitials}
        </div>
        <div>
          <div className="nm">
            {e.name}
            <EmpId code={e.employeeCode} />
          </div>
          <div className="sb">{e.designation}</div>
        </div>
      </Link>
      {reports.map((r) => (
        <Node key={r.id} e={r} scoped={scoped} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function OrgStructurePage() {
  const { location } = useApp();
  const [tab, setTab] = useState<'depts' | 'desig' | 'chart'>('depts');
  const { companies, departments, designations, locationName, locationsLabel } = useOrg();

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? 'Unknown company';
  const scopedDepts = departments.filter((d) => d.locations.includes(location));
  const scopedDeptIds = new Set(scopedDepts.map((d) => d.id));
  const scopedDesigs = designations.filter((d) => scopedDeptIds.has(d.departmentId));

  const scopedEmp = EMPLOYEES.filter((e) => e.location === location && e.employmentStatus !== 'Inactive');
  const roots = scopedEmp.filter((e) => !e.reportingManagerId || !scopedEmp.find((m) => m.id === e.reportingManagerId));

  return (
    <div>
      <PageHeader eyebrow="Module 04 · Structure" title="Organisational Structure" description={`Departments, designations and the reporting chart in one module — ${location}.`} />

      <div className="subseg">
        <button className={tab === 'depts' ? 'on' : ''} onClick={() => setTab('depts')}>
          Departments
        </button>
        <button className={tab === 'desig' ? 'on' : ''} onClick={() => setTab('desig')}>
          Designations
        </button>
        <button className={tab === 'chart' ? 'on' : ''} onClick={() => setTab('chart')}>
          Organisational Chart
        </button>
      </div>

      {tab === 'depts' && (
        <Card>
          <CardHeader
            title="Departments"
            sub={`${scopedDepts.length} in ${locationName(location)}`}
            action={
              <Link href="/admin/structure" className="btn ghost sm">
                Manage in Administration
              </Link>
            }
          />
          {scopedDepts.map((d) => (
            <div key={d.id} className="doc">
              <div className="fic">
                <BuildingIcon />
              </div>
              <div>
                <div className="nm">{d.name}</div>
                <div className="mt">
                  {companyName(d.companyId)} · Head: {d.head} · {departmentHeadcount(companyName(d.companyId), d.name)} employee(s) · {locationsLabel(d.locations)}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === 'desig' && (
        <Card>
          <CardHeader
            title="Designations"
            sub={`${scopedDesigs.length} in ${locationName(location)}`}
            action={
              <Link href="/admin/structure" className="btn ghost sm">
                Manage in Administration
              </Link>
            }
          />
          {scopedDesigs.map((d) => {
            const dept = departments.find((x) => x.id === d.departmentId);
            return (
              <div key={d.id} className="doc">
                <div className="fic">
                  <BuildingIcon />
                </div>
                <div>
                  <div className="nm">{d.title}</div>
                  <div className="mt">
                    {dept?.name} · {dept ? companyName(dept.companyId) : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {tab === 'chart' && (
        <Card>
          <div style={{ padding: 20, overflowX: 'auto' }}>
            {!roots.length ? (
              <EmptyState icon={<TreeIcon />} title="No hierarchy to show" description={`No employees found for ${location}.`} />
            ) : (
              roots.map((r) => <Node key={r.id} e={r} scoped={scopedEmp} depth={0} />)
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
