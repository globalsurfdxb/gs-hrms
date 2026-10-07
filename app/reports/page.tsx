'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { EMPLOYEES } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { DownloadIcon, FileTextIcon, PlusIcon } from '@/components/icons';

type CatKey = 'employee' | 'leave' | 'attendance' | 'performance';

const REPS: Record<CatKey, { label: string; reps: [string, string][] }> = {
  employee: {
    label: 'Employee Information',
    reps: [
      ['Dashboard', 'Live headcount, joiners & leavers at a glance'],
      ['Headcount', 'Headcount by department, location & type'],
      ['Employee addition trend', 'New joiners over time'],
      ['Employee attrition trend', 'Exits & attrition rate over time'],
      ['Distribution', 'Split by department, grade, gender, nationality'],
      ['Diversity', 'Gender & nationality diversity metrics'],
      ['Experience wise exit', 'Attrition analysed by tenure band'],
    ],
  },
  leave: {
    label: 'Leave Tracker',
    reps: [
      ['Daily leave status', 'Who is on leave today'],
      ['Resource availability', 'Available vs on-leave headcount'],
      ['Employee leave balance', 'Remaining balance per employee'],
      ['Leave booked and balance', 'Booked vs remaining by type'],
      ['Leave type wise summary', 'Totals by leave type'],
      ['Leave encashment details', 'Encashable balances & payouts'],
      ['Loss of pay details', 'Unpaid leave (LOP) records'],
      ['Leave data for payroll', 'Export for the payroll run'],
    ],
  },
  attendance: {
    label: 'Attendance',
    reps: [
      ['Daily attendance status', 'Present / absent for the day'],
      ['Early / late check-in & check-out', 'Punch-time exceptions'],
      ['Employee present / absent status', 'Period-wise presence'],
      ['Presence hours break-up', 'Worked-hours breakdown'],
      ['Attendance data for payroll', 'Export for the payroll run'],
      ['Muster roll', 'Statutory muster register'],
      ['Consecutive absences', 'Flag employees absent in a row'],
    ],
  },
  performance: {
    label: 'Performance',
    reps: [
      ['Goals', 'Goal / KPI progress'],
      ['Skill Set', 'Skill matrix & gaps'],
      ['Feedback on employee', '360° feedback received'],
      ['Appraisal status', 'Where each appraisal stands'],
      ['Appraisal Rating', 'Ratings this cycle'],
      ['Appraisal score', 'Scores this cycle'],
      ['Nine-box matrix', 'Performance vs potential grid'],
      ['Feedback on appraisal', 'Feedback given during appraisal'],
      ['Appraisal Rating history', 'Ratings across cycles'],
      ['Appraisal score and rating summary', 'Combined score & rating view'],
      ['Review extension report', 'Reviews extended past due date'],
    ],
  },
};

const CATS = Object.keys(REPS) as CatKey[];

const NINE_BOX: [string, number, string][] = [
  ['Enigma', 1, '#FEF4E2'],
  ['Growth', 3, '#EEF1FA'],
  ['Star', 5, '#E9FAEF'],
  ['Dilemma', 2, '#FDECEC'],
  ['Core', 9, '#EEF1FA'],
  ['High-impact', 7, '#E9FAEF'],
  ['Under-perf.', 1, '#FDECEC'],
  ['Effective', 6, '#FEF4E2'],
  ['Trusted pro', 4, '#EEF1FA'],
];

function ReportCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card" style={{ padding: '15px 16px' }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div className="fic">
          <FileTextIcon />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button variant="ghost" size="sm">
          View
        </Button>
        <Button variant="ghost" size="sm">
          Export
        </Button>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { location } = useApp();
  const [cat, setCat] = useState<CatKey>('employee');

  const scoped = EMPLOYEES.filter((e) => e.location === location);
  const byDept = Object.entries(
    scoped.reduce<Record<string, number>>((acc, e) => {
      acc[e.department] = (acc[e.department] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxDept = Math.max(1, ...byDept.map(([, n]) => n));

  return (
    <div>
      <PageHeader
        eyebrow="Administration · Reports"
        title="Reports"
        description="Operational and analytical reports across Employee Information, Leave, Attendance and Performance. Each report can be viewed on screen or exported."
        actions={
          <>
            <Button variant="ghost">
              <DownloadIcon /> Export all
            </Button>
            <Button variant="primary">
              <PlusIcon /> Schedule report
            </Button>
          </>
        }
      />

      <div className="subseg">
        {CATS.map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
            {REPS[c].label}
          </button>
        ))}
      </div>

      {cat === 'employee' && (
        <Card className="row-gap">
          <CardHeader title="Headcount by department" sub={`Featured · ${scoped.length} employees, ${location}`} />
          <div className="barchart">
            {byDept.map(([dept, n]) => (
              <div key={dept} className="bc-row">
                <div className="bl">{dept}</div>
                <div className="bc-track">
                  <div className="bc-fill" style={{ width: `${(n / maxDept) * 100}%` }}>
                    {n}
                  </div>
                </div>
                <span className="bv" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {cat === 'performance' && (
        <Card className="row-gap">
          <CardHeader title="Nine-box matrix" sub="Featured · performance (→) vs potential (↑)" />
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 420 }}>
              {NINE_BOX.map(([label, n, bg]) => (
                <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, textAlign: 'center', background: bg }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{n}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="g3 row-gap">
        {REPS[cat].reps.map(([title, desc]) => (
          <ReportCard key={title} title={title} desc={desc} />
        ))}
      </div>
    </div>
  );
}
