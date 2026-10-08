'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { EMPLOYEES } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip, TONES, Tone } from '@/components/ui/StatStrip';
import { BuildingIcon, DownloadIcon, FileTextIcon, PeopleIcon, PlusIcon, ReportsIcon, SearchIcon } from '@/components/icons';

type CatKey = 'employee' | 'leave' | 'attendance' | 'performance';

const CAT_TONE: Record<CatKey, Tone> = { employee: 'blue', leave: 'green', attendance: 'amber', performance: 'purple' };

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

function ReportCard({ title, desc, cat, showCat }: { title: string; desc: string; cat: CatKey; showCat: boolean }) {
  const c = TONES[CAT_TONE[cat]];
  return (
    <div className="ad-rep">
      <div className="ad-rep-h">
        <span className="ad-ic" style={{ background: c.bg, color: c.fg }}>
          <FileTextIcon />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="ad-rep-t">{title}</div>
          <div className="ad-rep-d">{desc}</div>
        </div>
      </div>
      <div className="ad-rep-f">
        <Button variant="ghost" size="sm">
          View
        </Button>
        <Button variant="ghost" size="sm">
          <DownloadIcon /> Export
        </Button>
        {showCat && <span className="ad-pill">{REPS[cat].label}</span>}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { location } = useApp();
  const [cat, setCat] = useState<CatKey>('employee');
  const [q, setQ] = useState('');

  const scoped = EMPLOYEES.filter((e) => e.location === location);
  const byDept = Object.entries(
    scoped.reduce<Record<string, number>>((acc, e) => {
      acc[e.department] = (acc[e.department] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxDept = Math.max(1, ...byDept.map(([, n]) => n));

  const total = CATS.reduce((n, c) => n + REPS[c].reps.length, 0);
  const needle = q.trim().toLowerCase();
  // A search looks across every category; otherwise show the selected one.
  const visible = CATS.filter((c) => needle || c === cat).flatMap((c) =>
    REPS[c].reps.filter(([title, desc]) => !needle || `${title} ${desc} ${REPS[c].label}`.toLowerCase().includes(needle)).map(([title, desc]) => ({ cat: c, title, desc }))
  );

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
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

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Reports available', value: total, icon: <ReportsIcon />, tone: 'blue' },
            { label: 'Report categories', value: CATS.length, icon: <FileTextIcon />, tone: 'purple' },
            { label: `Employees in ${location}`, value: scoped.length, icon: <PeopleIcon />, tone: 'green' },
            { label: 'Departments', value: byDept.length, icon: <BuildingIcon />, tone: 'amber', hint: `In ${location}` },
          ]}
        />
      </div>

      <div className="oc-bar" style={{ marginTop: 0 }}>
        <div className="subseg" style={{ margin: 0 }}>
          {CATS.map((c) => (
            <button
              key={c}
              className={!needle && cat === c ? 'on' : ''}
              onClick={() => {
                setCat(c);
                setQ('');
              }}
            >
              {REPS[c].label} ({REPS[c].reps.length})
            </button>
          ))}
        </div>
        <div className="tbar" style={{ padding: 0, border: 'none' }}>
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all reports…" />
          </div>
        </div>
      </div>

      {!needle && cat === 'employee' && (
        <Card>
          <CardHeader title="Headcount by department" sub={`Featured · ${scoped.length} employees, ${location}`} />
          {byDept.length === 0 ? (
            <EmptyState icon={<PeopleIcon />} title="No employees here" description={`There are no employee records for ${location} yet.`} />
          ) : (
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
          )}
        </Card>
      )}

      {!needle && cat === 'performance' && (
        <Card>
          <CardHeader title="Nine-box matrix" sub="Featured · performance (→) vs potential (↑)" />
          <div style={{ padding: '16px 18px' }}>
            <div className="ad-nine">
              <div className="ax-y">Potential →</div>
              {NINE_BOX.map(([label, n, bg]) => (
                <div key={label} className="cell" style={{ background: bg }}>
                  <b>{n}</b>
                  <span>{label}</span>
                </div>
              ))}
              <div className="ax-x">Performance →</div>
            </div>
          </div>
        </Card>
      )}

      <div className="rp-sec">
        <h3>{needle ? 'Search results' : REPS[cat].label}</h3>
        <span>
          {needle ? `${visible.length} of ${total} reports` : `${visible.length} reports`}
        </span>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<SearchIcon />} title="No reports found" description={`Nothing matches "${q.trim()}". Try a broader word such as leave, attendance or appraisal.`} />
        </Card>
      ) : (
        <div className="g3">
          {visible.map((r) => (
            <ReportCard key={`${r.cat}-${r.title}`} title={r.title} desc={r.desc} cat={r.cat} showCat={!!needle} />
          ))}
        </div>
      )}
    </div>
  );
}
