'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useApp } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useLearning } from '@/context/LearningContext';
import { REFERENCE_TODAY } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { downloadText, slug, toCsv } from '@/lib/csv';
import { departmentTotals, employeesInScope, HEADCOUNT_NOTE, headcountInScope } from '@/lib/headcount';
import { CAT_LABEL, CATEGORIES, CatKey, ReportDef, REPORTS, ReportTable, buildReport, reportsIn } from '@/lib/reportEngine';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip, TONES, Tone } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { BuildingIcon, ClockIcon, DownloadIcon, FileTextIcon, PeopleIcon, PlusIcon, ReportsIcon, SearchIcon, XIcon } from '@/components/icons';

const CAT_TONE: Record<CatKey, Tone> = { employee: 'blue', leave: 'green', attendance: 'amber', performance: 'purple' };

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

/* ---------- scheduled reports (kept on this device until a mail service exists) ---------- */

type Frequency = 'Daily' | 'Weekly' | 'Monthly';
type Format = 'CSV' | 'Excel' | 'PDF';
interface Schedule {
  id: string;
  reportId: string;
  title: string;
  cat: CatKey;
  frequency: Frequency;
  recipients: string[];
  format: Format;
  scope: string;
  createdOn: string;
}

const SCHEDULE_KEY = 'gsit.reportSchedules';
const scheduleSubs = new Set<() => void>();
let scheduleRaw: string | null = null;
let scheduleLoaded = false;

const readSchedules = () => {
  if (!scheduleLoaded) {
    scheduleLoaded = true;
    try {
      scheduleRaw = localStorage.getItem(SCHEDULE_KEY);
    } catch {
      scheduleRaw = null;
    }
  }
  return scheduleRaw ?? '[]';
};
const writeSchedules = (list: Schedule[]) => {
  scheduleRaw = JSON.stringify(list);
  scheduleLoaded = true;
  try {
    localStorage.setItem(SCHEDULE_KEY, scheduleRaw);
  } catch {
    // storage unavailable: the schedule lives for this session only
  }
  scheduleSubs.forEach((f) => f());
};
const subscribeSchedules = (cb: () => void) => {
  scheduleSubs.add(cb);
  return () => {
    scheduleSubs.delete(cb);
  };
};

const nextRun = (s: Schedule) => {
  if (s.frequency === 'Daily') return addDays(REFERENCE_TODAY, 1);
  if (s.frequency === 'Weekly') return addDays(REFERENCE_TODAY, 7);
  return `${addDays(`${REFERENCE_TODAY.slice(0, 7)}-01`, 32).slice(0, 7)}-01`;
};
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/* ---------- report card ---------- */

function ReportCard({ r, showCat, onView, onExport }: { r: ReportDef; showCat: boolean; onView: () => void; onExport: () => void }) {
  const c = TONES[CAT_TONE[r.cat]];
  return (
    <div className="ad-rep">
      <div className="ad-rep-h">
        <span className="ad-ic" style={{ background: c.bg, color: c.fg }}>
          <FileTextIcon />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="ad-rep-t">{r.title}</div>
          <div className="ad-rep-d">{r.desc}</div>
        </div>
      </div>
      <div className="ad-rep-f">
        <Button variant="ghost" size="sm" onClick={onView}>
          View
        </Button>
        <Button variant="ghost" size="sm" onClick={onExport}>
          <DownloadIcon /> Export
        </Button>
        {showCat && <span className="ad-pill">{CAT_LABEL[r.cat]}</span>}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { location } = useApp();
  const { locationName } = useOrg();
  const { statusOf } = useSeparation();
  const { reviews } = usePerformance();
  const { records } = useLearning();
  const empVersion = useEmployeeVersion();

  const [cat, setCat] = useState<CatKey>('employee');
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<ReportDef | null>(null);
  const [toast, setToast] = useState('');

  const [schedOpen, setSchedOpen] = useState(false);
  const [sReport, setSReport] = useState(REPORTS[0].id);
  const [sFreq, setSFreq] = useState<Frequency>('Weekly');
  const [sFormat, setSFormat] = useState<Format>('CSV');
  const [sRecipients, setSRecipients] = useState('');
  const [sError, setSError] = useState('');

  const schedulesRaw = useSyncExternalStore(subscribeSchedules, readSchedules, () => '[]');
  const schedules = useMemo<Schedule[]>(() => {
    try {
      const v = JSON.parse(schedulesRaw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }, [schedulesRaw]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const scopeLabel = locationName(location);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scopedAll = useMemo(() => employeesInScope(location), [location, empVersion]);
  const hc = headcountInScope(location, undefined, statusOf);
  const byDept = departmentTotals(scopedAll, statusOf);
  const maxDept = Math.max(1, ...byDept.map(([, n]) => n));

  const input = useMemo(() => ({ employees: scopedAll, scopeLabel, today: REFERENCE_TODAY, statusOf, reviews, records }), [scopedAll, scopeLabel, statusOf, reviews, records]);
  const tableFor = (r: ReportDef): ReportTable => buildReport(r.id, input);
  const viewTable = useMemo(() => (viewing ? buildReport(viewing.id, input) : null), [viewing, input]);

  const needle = q.trim().toLowerCase();
  // A search looks across every category; otherwise show the selected one.
  const visible = REPORTS.filter((r) => (needle ? `${r.title} ${r.desc} ${CAT_LABEL[r.cat]}`.toLowerCase().includes(needle) : r.cat === cat));

  const fileName = (r: ReportDef) => `${slug(r.title)}-${slug(location)}-${REFERENCE_TODAY}.csv`;
  const sectionText = (r: ReportDef) => {
    const t = tableFor(r);
    return [toCsv([`Report: ${r.title} (${CAT_LABEL[r.cat]}) · ${scopeLabel} · ${REFERENCE_TODAY}`], []), t.note ? toCsv([`Note: ${t.note}`], []) : '', toCsv(t.columns, t.rows)].filter(Boolean).join('\r\n');
  };
  const exportOne = (r: ReportDef) => {
    const t = tableFor(r);
    downloadText(fileName(r), toCsv(t.columns, t.rows));
    setToast(`${r.title} exported (${t.rows.length} row${t.rows.length === 1 ? '' : 's'}).`);
  };
  const exportAll = () => {
    if (!visible.length) {
      setToast('There are no reports to export for this search.');
      return;
    }
    const label = needle ? 'search-results' : slug(CAT_LABEL[cat]);
    downloadText(`reports-${label}-${slug(location)}-${REFERENCE_TODAY}.csv`, visible.map(sectionText).join('\r\n\r\n'));
    setToast(`${visible.length} report${visible.length === 1 ? '' : 's'} exported to one CSV file.`);
  };

  const openSchedule = (r?: ReportDef) => {
    setSReport(r?.id ?? visible[0]?.id ?? REPORTS[0].id);
    setSError('');
    setSchedOpen(true);
  };
  const saveSchedule = () => {
    const list = sRecipients
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!list.length) return setSError('Add at least one recipient email.');
    const bad = list.find((x) => !EMAIL.test(x));
    if (bad) return setSError(`"${bad}" is not a valid email address.`);
    const r = REPORTS.find((x) => x.id === sReport) ?? REPORTS[0];
    writeSchedules([...schedules, { id: `sch-${Date.now()}`, reportId: r.id, title: r.title, cat: r.cat, frequency: sFreq, recipients: [...new Set(list)], format: sFormat, scope: location, createdOn: REFERENCE_TODAY }]);
    setSchedOpen(false);
    setSRecipients('');
    setToast(`${r.title} scheduled ${sFreq.toLowerCase()} for ${list.length} recipient${list.length === 1 ? '' : 's'}.`);
  };
  const removeSchedule = (s: Schedule) => {
    writeSchedules(schedules.filter((x) => x.id !== s.id));
    setToast(`Schedule for ${s.title} removed.`);
  };

  useEffect(() => {
    if (!schedOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSchedOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [schedOpen]);

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description={`Operational and analytical reports across Employee Information, Leave, Attendance and Performance — ${scopeLabel}. Each report can be viewed on screen or exported.`}
        actions={
          <>
            <Button variant="ghost" onClick={exportAll}>
              <DownloadIcon /> Export all
            </Button>
            <Button variant="primary" onClick={() => openSchedule()}>
              <PlusIcon /> Schedule report
            </Button>
          </>
        }
      />

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Reports available', value: REPORTS.length, icon: <ReportsIcon />, tone: 'blue' },
            { label: 'Report categories', value: CATEGORIES.length, icon: <FileTextIcon />, tone: 'purple' },
            { label: `Active employees · ${location}`, value: hc.active, icon: <PeopleIcon />, tone: 'green', hint: `${hc.joining} joining · ${hc.total} total incl. joining` },
            { label: 'Departments', value: byDept.length, icon: <BuildingIcon />, tone: 'amber', hint: `With people in ${location}` },
          ]}
        />
      </div>

      <div className="oc-bar" style={{ marginTop: 0 }}>
        <div className="subseg" style={{ margin: 0 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={!needle && cat === c ? 'on' : ''}
              onClick={() => {
                setCat(c);
                setQ('');
              }}
            >
              {CAT_LABEL[c]} ({reportsIn(c).length})
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
          <CardHeader title="Headcount by department" sub={`Featured · ${hc.total} people incl. joining (${hc.active} active), ${location}. ${HEADCOUNT_NOTE}`} />
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
          <CardHeader title="Nine-box matrix" sub="Featured · illustrative grid. Open the report for the live table built from review ratings." />
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
        <h3>{needle ? 'Search results' : CAT_LABEL[cat]}</h3>
        <span>{needle ? `${visible.length} of ${REPORTS.length} reports` : `${visible.length} reports`}</span>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<SearchIcon />} title="No reports found" description={`Nothing matches "${q.trim()}". Try a broader word such as leave, attendance or appraisal.`} />
        </Card>
      ) : (
        <div className="g3">
          {visible.map((r) => (
            <ReportCard key={r.id} r={r} showCat={!!needle} onView={() => setViewing(r)} onExport={() => exportOne(r)} />
          ))}
        </div>
      )}

      <div className="rp-sec">
        <h3>Scheduled reports</h3>
        <span>{schedules.length ? `${schedules.length} scheduled` : 'None yet'}</span>
      </div>
      <Card>
        {schedules.length === 0 ? (
          <EmptyState icon={<ClockIcon />} title="No scheduled reports" description="Use Schedule report to have a report prepared daily, weekly or monthly for your team." />
        ) : (
          <div className="rs-sched">
            {schedules.map((s) => (
              <div key={s.id} className="rs-sched-row">
                <span className="ad-ic" style={{ background: TONES[CAT_TONE[s.cat]].bg, color: TONES[CAT_TONE[s.cat]].fg }}>
                  <ClockIcon />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="rs-sched-t">{s.title}</div>
                  <div className="rs-sched-s">
                    {s.frequency} · {s.format} · {s.scope} · next run {fmtDay(nextRun(s))}
                  </div>
                  <div className="rs-sched-s">To {s.recipients.join(', ')}</div>
                </div>
                <button className="icon-act" onClick={() => removeSchedule(s)} title="Remove schedule" aria-label={`Remove schedule for ${s.title}`}>
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="rs-sched-note">Schedules are saved on this device. Emailed delivery starts once the mail service is connected.</div>
      </Card>

      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? 'Report'}
        description={viewing ? `${CAT_LABEL[viewing.cat]} · ${scopeLabel} · ${fmtDay(REFERENCE_TODAY)}` : undefined}
        footer={
          viewing && (
            <>
              <Button variant="ghost" onClick={() => openSchedule(viewing)}>
                <ClockIcon /> Schedule
              </Button>
              <Button variant="primary" onClick={() => exportOne(viewing)}>
                <DownloadIcon /> Export CSV
              </Button>
            </>
          )
        }
      >
        {viewTable && (
          <div>
            <div className={`rs-basis ${viewTable.basis}`}>{viewTable.basis === 'live' ? 'Computed from live records' : 'Derived from the closest available data'}</div>
            {viewTable.note && <p className="rs-note">{viewTable.note}</p>}
            {viewTable.rows.length === 0 ? (
              <EmptyState icon={<FileTextIcon />} title="No rows" description={`Nothing to report for ${scopeLabel} right now.`} />
            ) : (
              <div className="rs-tbl-wrap">
                <table className="rs-tbl">
                  <thead>
                    <tr>
                      {viewTable.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewTable.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((v, j) => (
                          <td key={j}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="rs-count">
              {viewTable.rows.length} row{viewTable.rows.length === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </Drawer>

      {schedOpen && (
        <div className="scrim" onClick={() => setSchedOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Schedule report" onClick={(e) => e.stopPropagation()}>
            <div className="rs-modal-h">
              <div>
                <h3>Schedule report</h3>
                <p>Prepare a report on a repeating basis for {scopeLabel}.</p>
              </div>
              <button className="drawer-close" onClick={() => setSchedOpen(false)} aria-label="Close">
                <XIcon />
              </button>
            </div>
            <div className="rs-modal-b">
              <div className="fg">
                <label htmlFor="rs-report">Report</label>
                <select id="rs-report" value={sReport} onChange={(e) => setSReport(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <optgroup key={c} label={CAT_LABEL[c]}>
                      {reportsIn(c).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="rs-row2">
                <div className="fg">
                  <label htmlFor="rs-freq">Frequency</label>
                  <select id="rs-freq" value={sFreq} onChange={(e) => setSFreq(e.target.value as Frequency)}>
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
                <div className="fg">
                  <label htmlFor="rs-format">Format</label>
                  <select id="rs-format" value={sFormat} onChange={(e) => setSFormat(e.target.value as Format)}>
                    <option>CSV</option>
                    <option>Excel</option>
                    <option>PDF</option>
                  </select>
                </div>
              </div>
              <div className="fg">
                <label htmlFor="rs-to">
                  Recipients <span className="req">*</span>
                </label>
                <input
                  id="rs-to"
                  value={sRecipients}
                  onChange={(e) => {
                    setSRecipients(e.target.value);
                    if (sError) setSError('');
                  }}
                  placeholder="name@company.com, other@company.com"
                  style={sError ? { borderColor: 'var(--danger)' } : undefined}
                />
                <span className="hint">Separate several addresses with commas.</span>
              </div>
              {sError && <div className="rs-err">{sError}</div>}
            </div>
            <div className="rs-modal-f">
              <Button variant="ghost" onClick={() => setSchedOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveSchedule}>
                Save schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="rs-toast" role="status">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
