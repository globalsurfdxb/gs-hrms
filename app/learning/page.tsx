'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EMPLOYEES, REFERENCE_TODAY, employeeById, matchesEmployee } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { useOrg } from '@/context/OrgContext';
import { useLearning } from '@/context/LearningContext';
import { useSeparation } from '@/context/SeparationContext';
import { LearningRecord } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { EmpId } from '@/components/ui/EmployeeBits';
import { Avatar } from '@/components/ui/Avatar';
import { StatStrip } from '@/components/ui/StatStrip';
import { BookIcon, CheckIcon, ClockIcon, PlusIcon, ReportsIcon, SearchIcon, WarnIcon, XIcon } from '@/components/icons';

const TONE: Record<LearningRecord['status'], 'inactive' | 'pending' | 'active'> = {
  'Not Started': 'inactive',
  'In Progress': 'pending',
  Completed: 'active',
};
const STATUSES: ('All' | LearningRecord['status'])[] = ['All', 'Not Started', 'In Progress', 'Completed'];

function Fg({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`fg ${full ? 'full' : ''}`}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

function ReadBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

const textareaStyle = { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' as const };

export default function LearningPage() {
  const { locations, locationName } = useOrg();
  const { statusOf } = useSeparation();
  const { records, courses, categories, assign, start, complete, reopen, unassign } = useLearning();

  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('All');
  const [category, setCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('All');

  const [openId, setOpenId] = useState<string | null>(null);
  const [doneOn, setDoneOn] = useState(REFERENCE_TODAY);
  const [score, setScore] = useState('');
  const [notes, setNotes] = useState('');
  const [detailError, setDetailError] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [courseName, setCourseName] = useState('');
  const [newCategory, setNewCategory] = useState('Compliance');
  const [due, setDue] = useState(addDays(REFERENCE_TODAY, 30));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickQ, setPickQ] = useState('');
  const [assignError, setAssignError] = useState('');

  const withEmp = records.filter((r) => employeeById(r.employeeId));
  const allRows = withEmp.filter((r) => (loc === 'All' || employeeById(r.employeeId)!.location === loc) && (category === 'All' || r.category === category));
  const rows = allRows.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    return matchesEmployee(employeeById(r.employeeId)!, q) || r.course.toLowerCase().includes(q.trim().toLowerCase());
  });

  const completed = allRows.filter((r) => r.status === 'Completed').length;
  const inProgress = allRows.filter((r) => r.status === 'In Progress').length;
  const notStarted = allRows.filter((r) => r.status === 'Not Started').length;
  const rate = allRows.length ? Math.round((completed / allRows.length) * 100) : 0;
  const overdueCount = allRows.filter((r) => r.status !== 'Completed' && !!r.dueDate && r.dueDate < REFERENCE_TODAY).length;
  const filtersOn = !!q.trim() || loc !== 'All' || category !== 'All' || statusFilter !== 'All';

  const open = records.find((r) => r.id === openId);
  const openEmp = open ? employeeById(open.employeeId) : undefined;

  const openDetail = (r: LearningRecord) => {
    setOpenId(r.id);
    setDoneOn(REFERENCE_TODAY);
    setScore('');
    setNotes('');
    setDetailError('');
  };

  const finish = () => {
    if (!open) return;
    if (!doneOn || doneOn > REFERENCE_TODAY) {
      setDetailError('Enter a completion date that is today or earlier.');
      return;
    }
    const n = score.trim() === '' ? undefined : Number(score);
    if (n !== undefined && (!Number.isFinite(n) || n < 0 || n > 100)) {
      setDetailError('Score must be a number between 0 and 100.');
      return;
    }
    complete(open.id, { completedOn: doneOn, score: n, notes });
    setOpenId(null);
  };

  const chosenCourse = mode === 'existing' ? courseName : courseName.trim();
  const chosenCategory = mode === 'existing' ? courses.find((c) => c.name === courseName)?.category ?? '' : newCategory;
  const eligible = EMPLOYEES.filter((e) => statusOf(e) === 'Active' && !(chosenCourse && records.some((r) => r.course.toLowerCase() === chosenCourse.toLowerCase() && r.employeeId === e.id)));
  const shown = eligible.filter((e) => matchesEmployee(e, pickQ));
  /** Training can't be assigned before the person's joining date. */
  const notJoined = (e: (typeof EMPLOYEES)[number]) => e.dateOfJoining > REFERENCE_TODAY;

  const openAssign = () => {
    setMode('existing');
    setCourseName('');
    setNewCategory('Compliance');
    setDue(addDays(REFERENCE_TODAY, 30));
    setPicked(new Set());
    setPickQ('');
    setAssignError('');
    setAssignOpen(true);
  };

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submitAssign = () => {
    if (!chosenCourse) {
      setAssignError(mode === 'existing' ? 'Choose a course to assign.' : 'Enter the new course name.');
      return;
    }
    const ids = [...picked].filter((id) => eligible.some((e) => e.id === id));
    if (!ids.length) {
      setAssignError('Select at least one employee.');
      return;
    }
    const early = ids.map((id) => employeeById(id)).filter((e): e is NonNullable<typeof e> => !!e && notJoined(e));
    if (early.length) {
      setAssignError(`${early.map((e) => `${e.name} (joins ${e.dateOfJoining})`).join(', ')} cannot be assigned training before their joining date.`);
      return;
    }
    if (!due || due < REFERENCE_TODAY) {
      setAssignError('Choose a due date that is today or later.');
      return;
    }
    assign({ course: chosenCourse, category: chosenCategory || newCategory, employeeIds: ids, dueDate: due, assignedOn: REFERENCE_TODAY });
    setStatusFilter('All');
    setAssignOpen(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Employee Lifecycle"
        title="Learning & Development"
        description="Assign training, track progress and record completions across your employees."
        actions={
          <Button variant="primary" onClick={openAssign}>
            <PlusIcon /> Assign course
          </Button>
        }
      />

      <StatStrip
        items={[
          { label: 'Completion rate', value: `${rate}%`, icon: <ReportsIcon />, tone: 'blue', hint: `${allRows.length} assignment${allRows.length === 1 ? '' : 's'}` },
          { label: 'Completed', value: completed, icon: <CheckIcon />, tone: 'green', hint: 'Finished courses' },
          { label: 'In progress', value: inProgress, icon: <ClockIcon />, tone: 'amber', hint: `${notStarted} not started` },
          { label: 'Overdue', value: overdueCount, icon: <WarnIcon />, tone: overdueCount ? 'red' : 'gray', hint: overdueCount ? 'Past their due date' : 'Nothing overdue' },
        ]}
      />

      <Card className="row-gap">
        <CardHeader title="Course assignments" sub={`${allRows.length} assignment(s) · ${rate}% complete`} />
        <div className="tbar">
          <div className="tsearch" style={{ width: 260 }}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee, ID or course…" />
          </div>
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="chip">
            <option value="All">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="chip">
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as (typeof STATUSES)[number])} className="chip">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          {filtersOn && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setQ('');
                setLoc('All');
                setCategory('All');
                setStatusFilter('All');
              }}
            >
              <XIcon /> Clear filters
            </button>
          )}
          <span className="sp" />
          <span className="lc-count">
            {rows.length} of {allRows.length}
          </span>
        </div>

        {!rows.length ? (
          <div>
            <EmptyState
              icon={<BookIcon />}
              title={allRows.length ? 'No matching assignments' : 'No courses assigned'}
              description={allRows.length ? 'Try a different search or filter.' : 'Assign a course to one or more employees to start tracking training.'}
            />
            {!allRows.length && (
              <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
                <Button variant="primary" onClick={openAssign}>
                  <PlusIcon /> Assign course
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
          <div className="lc-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Course</th>
                <th>Status</th>
                <th>Due</th>
                <th>Completed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = employeeById(r.employeeId)!;
                const overdue = r.status !== 'Completed' && !!r.dueDate && r.dueDate < REFERENCE_TODAY;
                return (
                  <tr key={r.id} className={`lc-row ${overdue ? 'expired' : ''}`}>
                    <td>
                      <Link href={`/directory/${e.employeeCode}`} className="person">
                        <Avatar initials={e.avatarInitials} seed={e.department} />
                        <div>
                          <div className="nm">
                            {e.name}
                            <EmpId code={e.employeeCode} />
                          </div>
                          <div className="sb">
                            {e.department} · {locationName(e.location)}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <div className="lc-cell">
                        <span className="lc-ic">
                          <BookIcon />
                        </span>
                        <div>
                          <div className="nm">{r.course}</div>
                          <div className="sb">{r.category}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={TONE[r.status]}>{r.status}</Badge>
                    </td>
                    <td className="mono">
                      {r.dueDate ?? '—'}
                      {overdue && <span className="lc-over">Overdue</span>}
                    </td>
                    <td className="mono">
                      {r.completedOn ?? '—'}
                      {r.score !== undefined && <span style={{ marginLeft: 6, color: 'var(--muted)' }}>· {r.score}%</span>}
                    </td>
                    <td className="lc-right">
                      {r.status === 'Not Started' && (
                        <>
                          <Button size="sm" variant="primary" onClick={() => start(r.id)}>
                            Start
                          </Button>
                          <button
                            className="icon-act"
                            title="Unassign"
                            style={{ marginLeft: 6, verticalAlign: 'middle' }}
                            onClick={() => window.confirm(`Unassign "${r.course}" from ${e.name} (${e.employeeCode})?`) && unassign(r.id)}
                          >
                            <XIcon />
                          </button>
                        </>
                      )}
                      {r.status === 'In Progress' && (
                        <Button size="sm" variant="success" onClick={() => openDetail(r)}>
                          Mark complete
                        </Button>
                      )}
                      {r.status === 'Completed' && (
                        <Button size="sm" onClick={() => openDetail(r)}>
                          Details
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="tfoot lc-foot">
            <span>
              Showing {rows.length} of {allRows.length} assignment{allRows.length === 1 ? '' : 's'}
            </span>
            <span>{rate}% complete</span>
          </div>
          </>
        )}
      </Card>

      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? open.course : 'Course'}
        description={openEmp ? `${openEmp.name} · ${openEmp.employeeCode} · ${open?.category}` : undefined}
        footer={
          open && (
            <>
              <Button variant="ghost" onClick={() => setOpenId(null)}>
                {open.status === 'Completed' ? 'Close' : 'Cancel'}
              </Button>
              {open.status === 'Completed' && (
                <Button
                  onClick={() => {
                    reopen(open.id);
                    setOpenId(null);
                  }}
                >
                  Reopen
                </Button>
              )}
              {open.status === 'In Progress' && (
                <Button variant="primary" onClick={finish}>
                  Mark complete
                </Button>
              )}
            </>
          )
        }
      >
        {open && openEmp && (
          <>
            <ReadBlock label="Assigned">
              {open.assignedOn ?? '—'} {open.dueDate && <span style={{ color: 'var(--muted)' }}>· due {open.dueDate}</span>}
            </ReadBlock>
            {open.status === 'In Progress' && (
              <div className="form-grid">
                <Fg label="Completion date" required>
                  <input type="date" max={REFERENCE_TODAY} value={doneOn} onChange={(e) => { setDoneOn(e.target.value); setDetailError(''); }} />
                </Fg>
                <Fg label="Score (%)">
                  <input type="number" min={0} max={100} value={score} onChange={(e) => { setScore(e.target.value); setDetailError(''); }} placeholder="Optional" />
                </Fg>
                <Fg label="Notes" full>
                  <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — certificate number, feedback…" style={textareaStyle} />
                </Fg>
              </div>
            )}
            {open.status === 'Completed' && (
              <>
                <ReadBlock label="Completed on">{open.completedOn ?? '—'}</ReadBlock>
                <ReadBlock label="Score">{open.score !== undefined ? `${open.score}%` : '—'}</ReadBlock>
                <ReadBlock label="Notes">{open.notes ?? '—'}</ReadBlock>
              </>
            )}
            {detailError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{detailError}</div>}
          </>
        )}
      </Drawer>

      <Drawer
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign course"
        description="Pick a course (or create a new one) and choose who should take it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitAssign}>
              Assign{picked.size ? ` · ${picked.size} employee(s)` : ''}
            </Button>
          </>
        }
      >
        <div className="subseg" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={mode === 'existing' ? 'on' : ''}
            onClick={() => {
              setMode('existing');
              setCourseName('');
              setAssignError('');
            }}
          >
            Existing course
          </button>
          <button
            type="button"
            className={mode === 'new' ? 'on' : ''}
            onClick={() => {
              setMode('new');
              setCourseName('');
              setAssignError('');
            }}
          >
            New course
          </button>
        </div>

        <div className="form-grid">
          {mode === 'existing' ? (
            <Fg label="Course" required full>
              <SearchSelect
                options={courses.map((c) => ({ value: c.name, label: c.name, meta: c.category }))}
                value={courseName}
                onChange={(v) => {
                  setCourseName(v);
                  setAssignError('');
                }}
                placeholder="Search courses…"
                emptyText="No courses found"
              />
            </Fg>
          ) : (
            <>
              <Fg label="Course name" required>
                <input value={courseName} onChange={(e) => { setCourseName(e.target.value); setAssignError(''); }} placeholder="e.g. Fire Safety Basics" />
              </Fg>
              <Fg label="Category">
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Fg>
            </>
          )}
          <Fg label="Due date" required>
            <input type="date" value={due} onChange={(e) => { setDue(e.target.value); setAssignError(''); }} />
          </Fg>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>
            Employees · {picked.size} selected
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '7px 11px', marginBottom: 8 }}>
            <SearchIcon style={{ width: 15, height: 15, color: 'var(--faint)' }} />
            <input value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="Search by name or employee ID…" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Button size="sm" onClick={() => setPicked(new Set(shown.filter((e) => !notJoined(e)).map((e) => e.id)))}>
              Select all{pickQ.trim() ? ' shown' : ''}
            </Button>
            <Button size="sm" onClick={() => setPicked(new Set())} disabled={!picked.size}>
              Clear
            </Button>
          </div>
          {!eligible.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Every active employee already has this course.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map((e) => (
              <label key={e.id} className="perm-item" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={picked.has(e.id)} disabled={notJoined(e)} onChange={() => togglePick(e.id)} style={{ marginTop: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="nm">
                    {e.name}
                    <EmpId code={e.employeeCode} />
                  </div>
                  <div className="ds">
                    {e.designation} · {e.department} · {locationName(e.location)}
                    {notJoined(e) && ` · joins ${e.dateOfJoining}, available from then`}
                  </div>
                </div>
              </label>
            ))}
            {!!eligible.length && !shown.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No employees match your search.</div>}
          </div>
        </div>
        {assignError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{assignError}</div>}
      </Drawer>
    </div>
  );
}
