'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { EMPLOYEES, PERFORMANCE_CYCLE, REFERENCE_TODAY, directReports, employeeById, matchesEmployee } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { useOrg } from '@/context/OrgContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useSeparation } from '@/context/SeparationContext';
import { PerformanceReview } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { EmpId } from '@/components/ui/EmployeeBits';
import { Avatar } from '@/components/ui/Avatar';
import { StatStrip } from '@/components/ui/StatStrip';
import { CheckIcon, ClockIcon, PeopleIcon, PlusIcon, SearchIcon, StarIcon, XIcon } from '@/components/icons';

const TONE: Record<PerformanceReview['status'], 'inactive' | 'info' | 'pending' | 'active'> = {
  'Not Started': 'inactive',
  'Self Assessment': 'info',
  'Manager Review': 'pending',
  Completed: 'active',
};

const STATUSES: ('All' | PerformanceReview['status'])[] = ['All', 'Not Started', 'Self Assessment', 'Manager Review', 'Completed'];
const STEPS: PerformanceReview['status'][] = ['Not Started', 'Self Assessment', 'Manager Review', 'Completed'];
const RATING_LABEL = ['', 'Needs improvement', 'Below expectations', 'Meets expectations', 'Exceeds expectations', 'Outstanding'];
const ACTION_LABEL: Record<PerformanceReview['status'], string> = {
  'Not Started': 'Start review',
  'Self Assessment': 'Self assessment',
  'Manager Review': 'Manager review',
  Completed: 'View',
};

function Stars({ rating }: { rating: number | null | undefined }) {
  if (!rating) return <span style={{ color: 'var(--faint)' }} aria-label="Not rated">—</span>;
  return (
    <span role="img" aria-label={`Rated ${rating} out of 5`} style={{ display: 'inline-flex', gap: 2, color: '#f59e0b' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} style={{ width: 13, height: 13, fill: i < rating ? '#f59e0b' : 'none' }} />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} style={{ color: '#f59e0b', padding: 2, lineHeight: 0 }}>
          <StarIcon style={{ width: 24, height: 24, fill: n <= value ? '#f59e0b' : 'none' }} />
        </button>
      ))}
      <span style={{ marginLeft: 8, fontSize: 12.5, color: 'var(--muted)' }}>{value ? RATING_LABEL[value] : 'Select a rating'}</span>
    </div>
  );
}

function Fg({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="fg full">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

const textareaStyle = { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' as const };

function ReadBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

export default function PerformancePage() {
  const { role } = useApp();
  const me = useCurrentEmployee();
  const { locations, locationName } = useOrg();
  const { statusOf } = useSeparation();
  const { reviews, cycles, createCycle, startReview, submitSelf, completeReview, removeReview } = usePerformance();
  const teamMode = role === 'Team Lead';

  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('All');
  const [cycle, setCycle] = useState(PERFORMANCE_CYCLE);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('All');

  const [openId, setOpenId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [goals, setGoals] = useState('');
  const [reviewError, setReviewError] = useState('');

  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleName, setCycleName] = useState('H2 2026');
  const [dueDate, setDueDate] = useState(addDays(REFERENCE_TODAY, 60));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickQ, setPickQ] = useState('');
  const [cycleError, setCycleError] = useState('');

  const base = teamMode ? directReports(me.id) : undefined;
  const allRows = reviews.filter((r) => {
    const e = employeeById(r.employeeId);
    if (!e || r.cycle !== cycle) return false;
    if (loc !== 'All' && e.location !== loc) return false;
    if (base && !base.some((b) => b.id === r.employeeId)) return false;
    return true;
  });
  const rows = allRows.filter((r) => (statusFilter === 'All' || r.status === statusFilter) && matchesEmployee(employeeById(r.employeeId)!, q));

  const completed = allRows.filter((r) => r.status === 'Completed');
  const inProgress = allRows.filter((r) => r.status === 'Self Assessment' || r.status === 'Manager Review').length;
  const notStarted = allRows.filter((r) => r.status === 'Not Started').length;
  const rated = completed.filter((r) => r.rating);
  const avg = rated.length ? (rated.reduce((n, r) => n + (r.rating ?? 0), 0) / rated.length).toFixed(1) : null;
  const doneRate = allRows.length ? Math.round((completed.length / allRows.length) * 100) : 0;
  const filtersOn = !!q.trim() || loc !== 'All' || statusFilter !== 'All';

  const open = reviews.find((r) => r.id === openId);
  const openEmp = open ? employeeById(open.employeeId) : undefined;

  const openReview = (r: PerformanceReview) => {
    setOpenId(r.id);
    setRating(0);
    setComments('');
    setGoals('');
    setReviewError('');
  };

  const submitReview = () => {
    if (!open) return;
    if (!rating) {
      setReviewError('Choose a rating before continuing.');
      return;
    }
    if (open.status === 'Self Assessment') submitSelf(open.id, { rating, comments });
    else if (open.status === 'Manager Review') completeReview(open.id, { rating, comments, goals });
    setOpenId(null);
  };

  const eligible = EMPLOYEES.filter((e) => statusOf(e) === 'Active' && !reviews.some((r) => r.cycle === cycleName.trim() && r.employeeId === e.id));
  const shown = eligible.filter((e) => matchesEmployee(e, pickQ));

  const openCycle = () => {
    setCycleName('H2 2026');
    setDueDate(addDays(REFERENCE_TODAY, 60));
    setPicked(new Set());
    setPickQ('');
    setCycleError('');
    setCycleOpen(true);
  };

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submitCycle = () => {
    const name = cycleName.trim();
    if (!name) {
      setCycleError('Give the review cycle a name, e.g. H2 2026.');
      return;
    }
    const ids = [...picked].filter((id) => eligible.some((e) => e.id === id));
    if (!ids.length) {
      setCycleError('Select at least one employee to review.');
      return;
    }
    if (!dueDate || dueDate < REFERENCE_TODAY) {
      setCycleError('Choose a due date that is today or later.');
      return;
    }
    createCycle({ cycle: name, employeeIds: ids, dueDate });
    setCycle(name);
    setStatusFilter('All');
    setCycleOpen(false);
  };

  const stepIndex = open ? STEPS.indexOf(open.status) : 0;

  return (
    <div>
      <PageHeader
        eyebrow={teamMode ? 'Team · Performance' : 'Employee Lifecycle'}
        title="Performance Management"
        description={`${cycle} review cycle — self assessment, manager review and final rating.`}
        actions={
          !teamMode && (
            <Button variant="primary" onClick={openCycle}>
              <PlusIcon /> Start review cycle
            </Button>
          )
        }
      />

      <StatStrip
        items={[
          { label: teamMode ? 'Team members' : 'In this cycle', value: allRows.length, icon: <PeopleIcon />, tone: 'blue', hint: `${notStarted} not started` },
          { label: 'In progress', value: inProgress, icon: <ClockIcon />, tone: 'amber', hint: 'Self assessment or manager review' },
          { label: 'Completed', value: completed.length, icon: <CheckIcon />, tone: 'green', hint: `${doneRate}% of the cycle` },
          { label: 'Average rating', value: avg ?? '—', icon: <StarIcon />, tone: 'purple', hint: rated.length ? `From ${rated.length} final rating${rated.length === 1 ? '' : 's'}` : 'No final ratings yet' },
        ]}
      />

      <Card className="row-gap">
        <CardHeader title={`${cycle} reviews`} sub={`${allRows.length} employee(s)${avg ? ` · average rating ${avg}` : ''}`} />
        <div className="tbar">
          <div className="tsearch" style={{ width: 260 }}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or employee ID…" />
          </div>
          <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="chip">
            {cycles.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="chip">
            <option value="All">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
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
              icon={<StarIcon />}
              title={allRows.length ? 'No matching reviews' : 'No reviews in this cycle'}
              description={allRows.length ? 'Try a different search or filter.' : 'Start a review cycle and choose which employees take part.'}
            />
            {!allRows.length && !teamMode && (
              <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
                <Button variant="primary" onClick={openCycle}>
                  <PlusIcon /> Start review cycle
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
                <th>Status</th>
                <th>Self rating</th>
                <th>Final rating</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = employeeById(r.employeeId)!;
                const overdue = r.status !== 'Completed' && r.dueDate < REFERENCE_TODAY;
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
                            {e.designation} · {locationName(e.location)}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <Badge tone={TONE[r.status]}>{r.status}</Badge>
                    </td>
                    <td>
                      <Stars rating={r.selfRating} />
                    </td>
                    <td>
                      <Stars rating={r.rating} />
                    </td>
                    <td className="mono">
                      {r.dueDate}
                      {overdue && <span className="lc-over">Overdue</span>}
                    </td>
                    <td className="lc-right">
                      <Button size="sm" variant={r.status === 'Completed' ? 'ghost' : 'primary'} onClick={() => openReview(r)}>
                        {ACTION_LABEL[r.status]}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="tfoot lc-foot">
            <span>
              Showing {rows.length} of {allRows.length} review{allRows.length === 1 ? '' : 's'}
            </span>
            <span>{cycle} cycle</span>
          </div>
          </>
        )}
      </Card>

      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={openEmp ? `${openEmp.name} · ${openEmp.employeeCode}` : 'Review'}
        description={open ? `${open.cycle} review · due ${open.dueDate}` : undefined}
        footer={
          open && (
            <>
              <Button variant="ghost" onClick={() => setOpenId(null)}>
                {open.status === 'Completed' ? 'Close' : 'Cancel'}
              </Button>
              {open.status === 'Not Started' && (
                <>
                  <Button
                    onClick={() => {
                      removeReview(open.id);
                      setOpenId(null);
                    }}
                  >
                    Remove from cycle
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      startReview(open.id);
                      setOpenId(null);
                    }}
                  >
                    Start self-assessment
                  </Button>
                </>
              )}
              {open.status === 'Self Assessment' && (
                <Button variant="primary" onClick={submitReview}>
                  Submit to manager
                </Button>
              )}
              {open.status === 'Manager Review' && (
                <Button variant="primary" onClick={submitReview}>
                  Complete review
                </Button>
              )}
            </>
          )
        }
      >
        {open && openEmp && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ flex: 1 }}>
                  <div style={{ height: 4, borderRadius: 4, background: i <= stepIndex ? 'var(--primary)' : 'var(--border)' }} />
                  <div style={{ fontSize: 10.5, marginTop: 4, fontWeight: i === stepIndex ? 700 : 500, color: i === stepIndex ? 'var(--text)' : 'var(--faint)' }}>{s}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
              {openEmp.designation} · {openEmp.department} · {locationName(openEmp.location)}
            </div>

            {open.status === 'Not Started' && (
              <div className="note-box">
                <div>This review hasn&apos;t started. Starting it opens the self-assessment for the employee, then passes it to their manager for the final rating.</div>
              </div>
            )}

            {open.status === 'Self Assessment' && (
              <div className="form-grid">
                <Fg label="Self rating" required>
                  <StarPicker value={rating} onChange={(n) => { setRating(n); setReviewError(''); }} />
                </Fg>
                <Fg label="Key achievements & comments">
                  <textarea rows={5} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="What went well this period? What did you deliver?" style={textareaStyle} />
                </Fg>
              </div>
            )}

            {open.status === 'Manager Review' && (
              <>
                <ReadBlock label="Employee self-assessment">
                  {open.selfRating ? (
                    <>
                      <Stars rating={open.selfRating} /> <span style={{ marginLeft: 6, color: 'var(--muted)' }}>{RATING_LABEL[open.selfRating]}</span>
                      <div style={{ marginTop: 6 }}>{open.selfComments || 'No comments provided.'}</div>
                    </>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>No self-assessment was recorded.</span>
                  )}
                </ReadBlock>
                <div className="form-grid">
                  <Fg label="Final rating" required>
                    <StarPicker value={rating} onChange={(n) => { setRating(n); setReviewError(''); }} />
                  </Fg>
                  <Fg label="Manager feedback">
                    <textarea rows={4} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Strengths, areas to improve, overall assessment…" style={textareaStyle} />
                  </Fg>
                  <Fg label="Goals for next cycle">
                    <textarea rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Key objectives for the next review period…" style={textareaStyle} />
                  </Fg>
                </div>
              </>
            )}

            {open.status === 'Completed' && (
              <>
                <ReadBlock label="Self vs manager rating">
                  {open.selfRating && open.rating ? (
                    <span>
                      Self {open.selfRating}/5 · Manager {open.rating}/5 ·{' '}
                      <span style={{ color: 'var(--muted)' }}>{open.rating === open.selfRating ? 'Aligned' : open.rating > open.selfRating ? `Manager rated ${open.rating - open.selfRating} higher` : `Manager rated ${open.selfRating - open.rating} lower`}</span>
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>No self rating on file for this review.</span>
                  )}
                </ReadBlock>
                <ReadBlock label="Final rating">
                  <Stars rating={open.rating} /> <span style={{ marginLeft: 6, color: 'var(--muted)' }}>{open.rating ? RATING_LABEL[open.rating] : ''}</span>
                </ReadBlock>
                <ReadBlock label="Self rating">
                  <Stars rating={open.selfRating} />
                  <div style={{ marginTop: 4 }}>{open.selfComments || (open.selfRating ? 'No comments provided.' : 'No self assessment was recorded.')}</div>
                </ReadBlock>
                <ReadBlock label="Manager feedback">{open.managerComments || '—'}</ReadBlock>
                <ReadBlock label="Goals for next cycle">{open.goals || '—'}</ReadBlock>
                <ReadBlock label="Completed on">{open.completedOn ?? open.dueDate}</ReadBlock>
              </>
            )}

            {reviewError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{reviewError}</div>}
          </>
        )}
      </Drawer>

      <Drawer
        open={cycleOpen}
        onClose={() => setCycleOpen(false)}
        title="Start review cycle"
        description="Create a review cycle and choose which employees take part. Each starts as Not Started."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCycleOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitCycle}>
              Start cycle{picked.size ? ` · ${picked.size} employee(s)` : ''}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="fg">
            <label>
              Cycle name <span className="req">*</span>
            </label>
            <input value={cycleName} onChange={(e) => { setCycleName(e.target.value); setCycleError(''); }} placeholder="e.g. H2 2026" />
          </div>
          <div className="fg">
            <label>
              Due date <span className="req">*</span>
            </label>
            <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setCycleError(''); }} />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>
            Employees · {picked.size} selected
          </div>
          <div className="tsearch" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '7px 11px', marginBottom: 8 }}>
            <SearchIcon style={{ width: 15, height: 15, color: 'var(--faint)' }} />
            <input value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="Search by name or employee ID…" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Button size="sm" onClick={() => setPicked(new Set(shown.map((e) => e.id)))}>
              Select all{pickQ.trim() ? ' shown' : ''}
            </Button>
            <Button size="sm" onClick={() => setPicked(new Set())} disabled={!picked.size}>
              Clear
            </Button>
          </div>
          {!eligible.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Every active employee already has a review in {cycleName.trim() || 'this cycle'}.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map((e) => (
              <label key={e.id} className="perm-item" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => togglePick(e.id)} style={{ marginTop: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="nm">
                    {e.name}
                    <EmpId code={e.employeeCode} />
                  </div>
                  <div className="ds">
                    {e.designation} · {e.department} · {locationName(e.location)}
                  </div>
                </div>
              </label>
            ))}
            {!!eligible.length && !shown.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No employees match your search.</div>}
          </div>
        </div>
        {cycleError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{cycleError}</div>}
      </Drawer>
    </div>
  );
}
