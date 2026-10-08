'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EMPLOYEES } from '@/lib/data';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { useSeparation } from '@/context/SeparationContext';
import { departmentsMissingFromMaster, designationsMissingFromMaster, headcountByCompany, headcountByDepartment, headcountByDesignation, sameText } from '@/lib/headcount';
import { useOrg } from '@/context/OrgContext';
import { Department, Designation } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState, Button } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { BuildingIcon, ChevronDownIcon, ChevronRightIcon, EditIcon, PeopleIcon, PlusIcon, SearchIcon, TagIcon, TreeIcon, XIcon } from '@/components/icons';

const blankDept = (companyId: string): Department => ({ id: '', companyId, name: '', locations: [], head: 'Unassigned' });
const blankDesig = (departmentId: string): Designation => ({ id: '', departmentId, title: '' });

const PALETTE = [
  { bg: '#e7f0fc', fg: '#2f6fd6' },
  { bg: '#f0eafc', fg: '#7a4bd0' },
  { bg: '#e7f6ee', fg: '#1f9d63' },
  { bg: '#fdf3df', fg: '#c6851b' },
  { bg: '#fce9e7', fg: '#d5493f' },
  { bg: '#e3f4f8', fg: '#0e8fa8' },
];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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

export default function AdminStructurePage() {
  const { companies, departments, designations, locations, locationName, addDepartment, updateDepartment, removeDepartment, addDesignation, updateDesignation, removeDesignation } = useOrg();
  const [selectedId, setSelectedId] = useState('');
  const [q, setQ] = useState('');
  const [locFilter, setLocFilter] = useState('all');
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const [deptOpen, setDeptOpen] = useState(false);
  const [deptMode, setDeptMode] = useState<'add' | 'edit'>('add');
  const [deptDraft, setDeptDraft] = useState<Department>(blankDept(''));
  const [deptError, setDeptError] = useState('');

  const [desOpen, setDesOpen] = useState(false);
  const [desMode, setDesMode] = useState<'add' | 'edit'>('add');
  const [desDraft, setDesDraft] = useState<Designation>(blankDesig(''));
  const [desError, setDesError] = useState('');

  const company = companies.find((c) => c.id === selectedId) ?? companies[0];
  const companyDepts = useMemo(() => (company ? departments.filter((d) => d.companyId === company.id) : []), [company, departments]);
  const companyDesigCount = designations.filter((x) => companyDepts.some((d) => d.id === x.departmentId)).length;

  useEmployeeVersion();
  const { statusOf } = useSeparation();
  // Counted from the employee records (company + department + designation, ignoring case), never from the master list.
  const people = (dept: string, title?: string) =>
    company ? (title === undefined ? headcountByDepartment(company.name, dept, EMPLOYEES, statusOf) : headcountByDesignation(company.name, dept, title, EMPLOYEES, statusOf)).total : 0;
  const companyHc = company ? headcountByCompany(company.name, EMPLOYEES, statusOf) : { active: 0, joining: 0, exiting: 0, inactive: 0, total: 0 };
  const missingDepts = company ? departmentsMissingFromMaster(company.name, companyDepts, EMPLOYEES, statusOf) : [];
  const headRec = (name: string) => (company ? EMPLOYEES.find((e) => sameText(e.company, company.name) && e.name === name) : undefined);

  const needle = q.trim().toLowerCase();
  const shown = companyDepts
    .map((d) => {
      const all = designations.filter((x) => x.departmentId === d.id);
      const deptHit = !needle || d.name.toLowerCase().includes(needle) || d.head.toLowerCase().includes(needle);
      const desigs = deptHit ? all : all.filter((x) => x.title.toLowerCase().includes(needle));
      return { d, all, desigs, hit: deptHit || desigs.length > 0 };
    })
    .filter((x) => x.hit && (locFilter === 'all' || x.d.locations.includes(locFilter)));

  const isClosed = (id: string) => (needle ? false : !!closed[id]);
  const flip = (id: string) => setClosed((c) => ({ ...c, [id]: !c[id] }));
  const setAll = (collapse: boolean) => setClosed(Object.fromEntries(companyDepts.map((d) => [d.id, collapse])));

  const headOptions = (current: string) => {
    const pool = company ? EMPLOYEES.filter((e) => e.company === company.name && e.employmentStatus !== 'Inactive') : [];
    const opts = [{ value: 'Unassigned', label: 'Unassigned' }, ...pool.map((e) => ({ value: e.name, label: e.name, meta: e.employeeCode }))];
    if (current && !opts.some((o) => o.value === current)) opts.push({ value: current, label: current });
    return opts;
  };

  const openAddDept = () => {
    setDeptDraft({ ...blankDept(company.id), locations: locations.map((l) => l.id) });
    setDeptMode('add');
    setDeptError('');
    setDeptOpen(true);
  };
  const openEditDept = (d: Department) => {
    setDeptDraft({ ...d });
    setDeptMode('edit');
    setDeptError('');
    setDeptOpen(true);
  };
  const saveDept = () => {
    const name = deptDraft.name.trim();
    if (!name) return setDeptError('Department name is required.');
    if (companyDepts.some((d) => d.id !== deptDraft.id && d.name.toLowerCase() === name.toLowerCase())) return setDeptError(`${company.name} already has a department called "${name}".`);
    if (deptDraft.locations.length === 0) return setDeptError('Choose at least one work location.');
    const record = { ...deptDraft, name };
    if (deptMode === 'add') addDepartment(record);
    else updateDepartment(record);
    setDeptOpen(false);
  };
  const deleteDept = (d: Department) => {
    const n = designations.filter((x) => x.departmentId === d.id).length;
    if (n > 0 && !window.confirm(`Delete ${d.name}? Its ${n} designation(s) will also be removed.`)) return;
    removeDepartment(d.id);
  };

  const openAddDesig = (d: Department) => {
    setDesDraft(blankDesig(d.id));
    setDesMode('add');
    setDesError('');
    setDesOpen(true);
  };
  const openEditDesig = (x: Designation) => {
    setDesDraft({ ...x });
    setDesMode('edit');
    setDesError('');
    setDesOpen(true);
  };
  const saveDesig = () => {
    const title = desDraft.title.trim();
    if (!title) return setDesError('Designation title is required.');
    if (designations.some((x) => x.departmentId === desDraft.departmentId && x.id !== desDraft.id && x.title.toLowerCase() === title.toLowerCase())) return setDesError(`This department already has a designation called "${title}".`);
    const record = { ...desDraft, title };
    if (desMode === 'add') addDesignation(record);
    else updateDesignation(record);
    setDesOpen(false);
  };
  const deleteDesig = (x: Designation) => {
    const d = departments.find((y) => y.id === x.departmentId);
    const n = d ? people(d.name, x.title) : 0;
    if (n > 0 && !window.confirm(`${n} employee(s) currently hold "${x.title}". Delete it anyway?`)) return;
    removeDesignation(x.id);
  };

  const desDept = departments.find((d) => d.id === desDraft.departmentId);

  return (
    <div>
      <PageHeader
        eyebrow="Administration · Organization"
        title="Departments & Designations"
        description="Pick a company, build its departments, then add the designations under each department."
        actions={
          company && (
            <Button variant="primary" onClick={openAddDept}>
              <PlusIcon /> Add department
            </Button>
          )
        }
      />

      {!company ? (
        <Card>
          <EmptyState icon={<BuildingIcon />} title="No companies yet" description="Departments belong to a company. Add a company first, then come back to build its structure." />
          <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
            <Link href="/admin/companies" className="btn primary">
              Go to Companies
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="st-companies">
            {companies.map((c, i) => {
              const col = PALETTE[i % PALETTE.length];
              const on = c.id === company.id;
              return (
                <button key={c.id} className={`st-co ${on ? 'on' : ''}`} onClick={() => setSelectedId(c.id)}>
                  <span className="st-co-av" style={{ background: col.bg, color: col.fg }}>
                    {initials(c.name)}
                  </span>
                  <span style={{ textAlign: 'left' }}>
                    <span className="st-co-nm">{c.name}</span>
                    <span className="st-co-sub">
                      {plural(departments.filter((d) => d.companyId === c.id).length, 'department')} · {plural(headcountByCompany(c.name, EMPLOYEES, statusOf).total, 'person', 'people')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rp-stats" style={{ marginTop: 16 }}>
            <div className="rp-stat">
              <span className="rp-stat-ic" style={{ background: '#e7f0fc', color: '#2f6fd6' }}>
                <TreeIcon />
              </span>
              <div>
                <div className="rp-stat-n">{companyDepts.length}</div>
                <div className="rp-stat-l">Departments</div>
              </div>
            </div>
            <div className="rp-stat">
              <span className="rp-stat-ic" style={{ background: '#f0eafc', color: '#7a4bd0' }}>
                <TagIcon />
              </span>
              <div>
                <div className="rp-stat-n">{companyDesigCount}</div>
                <div className="rp-stat-l">Designations</div>
              </div>
            </div>
            <div className="rp-stat">
              <span className="rp-stat-ic" style={{ background: '#e7f6ee', color: '#1f9d63' }}>
                <PeopleIcon />
              </span>
              <div>
                <div className="rp-stat-n">{companyHc.total}</div>
                <div className="rp-stat-l">Employees incl. joining</div>
                <div className="rp-stat-h">
                  {companyHc.active} active · {companyHc.joining} joining
                </div>
              </div>
            </div>
            <div className="rp-stat">
              <span className="rp-stat-ic" style={{ background: '#fdf3df', color: '#c6851b' }}>
                <BuildingIcon />
              </span>
              <div>
                <div className="rp-stat-n">{company.location === 'Both' ? locations.length : 1}</div>
                <div className="rp-stat-l">Locations</div>
              </div>
            </div>
          </div>

          <div className="tbar st-bar">
            <div className="tsearch">
              <SearchIcon />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search departments, heads or designations…" />
            </div>
            <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} style={{ height: 36 }}>
              <option value="all">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.city})
                </option>
              ))}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={() => setAll(false)}>
                Expand all
              </Button>
              <Button size="sm" onClick={() => setAll(true)}>
                Collapse all
              </Button>
            </div>
          </div>

          {companyDepts.length === 0 && (
            <Card className="row-gap">
              <EmptyState icon={<TreeIcon />} title={`No departments in ${company.name}`} description="Add the first department, then add designations under it." />
              <div style={{ padding: '0 0 20px', textAlign: 'center' }}>
                <Button variant="primary" onClick={openAddDept}>
                  <PlusIcon /> Add department
                </Button>
              </div>
            </Card>
          )}

          {companyDepts.length > 0 && shown.length === 0 && (
            <Card className="row-gap">
              <EmptyState icon={<SearchIcon />} title="Nothing matches" description="Try a different search, or clear the location filter." />
            </Card>
          )}

          {missingDepts.length > 0 && (
            <Card className="row-gap">
              <div className="note-box warn" style={{ margin: 12 }}>
                <BuildingIcon />
                <div>
                  {missingDepts.map((m) => `${m.name} (${m.headcount.total})`).join(', ')} — employees of {company.name} sit in {missingDepts.length === 1 ? 'a department' : 'departments'} that {missingDepts.length === 1 ? 'is' : 'are'} not in this company&apos;s department list. Add{' '}
                  {missingDepts.length === 1 ? 'it' : 'them'} with Add department.
                </div>
              </div>
            </Card>
          )}

          {shown.map(({ d, all, desigs }, idx) => {
            const col = PALETTE[idx % PALETTE.length];
            const closedNow = isClosed(d.id);
            const head = headRec(d.head);
            return (
              <div key={d.id} className="st-dept">
                <div className="st-dh" role="button" tabIndex={0} aria-expanded={!closedNow} onClick={() => flip(d.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), flip(d.id))}>
                  <span className="acc-chev">{closedNow ? <ChevronRightIcon /> : <ChevronDownIcon />}</span>
                  <span className="st-tile" style={{ background: col.bg, color: col.fg }}>
                    {initials(d.name)}
                  </span>
                  <div className="st-main">
                    <div className="st-nm">{d.name}</div>
                    <div className="st-sub">
                      {d.head === 'Unassigned' ? (
                        <span style={{ color: 'var(--faint)' }}>No department head</span>
                      ) : (
                        <>
                          <span className="st-hav">{initials(d.head)}</span> {d.head}
                          {head && <span style={{ color: 'var(--faint)' }}> · {head.employeeCode}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="st-locs">
                    {d.locations.map((id) => (
                      <span key={id} className="chip" style={{ padding: '3px 9px', fontSize: 11 }}>
                        {locationName(id)}
                      </span>
                    ))}
                  </div>
                  <div className="st-counts">
                    <span>
                      <b>{people(d.name)}</b> {people(d.name) === 1 ? 'person' : 'people'}
                    </span>
                    <span>
                      <b>{all.length}</b> {all.length === 1 ? 'designation' : 'designations'}
                    </span>
                  </div>
                  <div className="st-acts" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-act" onClick={() => openEditDept(d)} title="Edit department">
                      <EditIcon />
                    </button>
                    <button className="icon-act" onClick={() => deleteDept(d)} title="Delete department">
                      <XIcon />
                    </button>
                  </div>
                </div>

                {!closedNow && (
                  <div className="st-body">
                    <div className="st-grid">
                      {desigs.map((x) => (
                        <div key={x.id} className="st-des">
                          <span className="st-des-ic" style={{ background: col.bg, color: col.fg }}>
                            <TagIcon />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="st-des-t">{x.title}</div>
                            <div className="st-des-s">{people(d.name, x.title)} employee(s)</div>
                          </div>
                          <button className="icon-act" onClick={() => openEditDesig(x)} title="Edit designation">
                            <EditIcon />
                          </button>
                          <button className="icon-act" onClick={() => deleteDesig(x)} title="Delete designation">
                            <XIcon />
                          </button>
                        </div>
                      ))}
                      {designationsMissingFromMaster(company.name, d.name, all.map((x) => x.title), EMPLOYEES, statusOf).map((m) => (
                        <div key={`missing-${m.title}`} className="st-des">
                          <span className="st-des-ic" style={{ background: '#fdf3df', color: '#c6851b' }}>
                            <TagIcon />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="st-des-t">
                              {m.title}
                              <span className="rs-flag">not in master list</span>
                            </div>
                            <div className="st-des-s">{m.headcount.total} employee(s)</div>
                          </div>
                          <button className="icon-act" onClick={() => (setDesDraft({ ...blankDesig(d.id), title: m.title }), setDesMode('add'), setDesError(''), setDesOpen(true))} title="Add to the master list">
                            <PlusIcon />
                          </button>
                        </div>
                      ))}
                      <button className="st-add" onClick={() => openAddDesig(d)}>
                        <PlusIcon /> Add designation
                      </button>
                    </div>
                    {all.length === 0 && <div className="st-empty">No designations yet — add the first one.</div>}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <Drawer
        open={deptOpen}
        onClose={() => setDeptOpen(false)}
        title={deptMode === 'add' ? 'Add department' : 'Edit department'}
        description={company ? (deptMode === 'add' ? `New department under ${company.name}.` : `Editing ${deptDraft.name || 'department'} in ${company.name}.`) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeptOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveDept}>
              {deptMode === 'add' ? 'Add department' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Fg label="Company">
            <input value={company?.name ?? ''} readOnly style={{ background: 'var(--bg)' }} />
          </Fg>
          <Fg label="Department name" required>
            <input
              value={deptDraft.name}
              onChange={(e) => {
                setDeptDraft({ ...deptDraft, name: e.target.value });
                if (deptError) setDeptError('');
              }}
              placeholder="e.g. Human Resources"
              style={deptError ? { borderColor: 'var(--danger)' } : undefined}
            />
          </Fg>
          <Fg label="Work locations" required>
            <div className="perm-grid">
              {locations.map((l) => (
                <label key={l.id} className="perm-item">
                  <input
                    type="checkbox"
                    checked={deptDraft.locations.includes(l.id)}
                    onChange={() => {
                      setDeptDraft({ ...deptDraft, locations: deptDraft.locations.includes(l.id) ? deptDraft.locations.filter((x) => x !== l.id) : [...deptDraft.locations, l.id] });
                      if (deptError) setDeptError('');
                    }}
                  />
                  <div>
                    <div className="nm">{l.name}</div>
                    {l.city && <div className="ds">{l.city}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 6 }}>
              <Button size="sm" onClick={() => setDeptDraft({ ...deptDraft, locations: locations.length > 0 && locations.every((l) => deptDraft.locations.includes(l.id)) ? [] : locations.map((l) => l.id) })}>
                {locations.length > 0 && locations.every((l) => deptDraft.locations.includes(l.id)) ? 'Clear all' : 'Select all locations'}
              </Button>
            </div>
          </Fg>
          <Fg label="Department head">
            <SearchSelect options={headOptions(deptDraft.head)} value={deptDraft.head} onChange={(v) => setDeptDraft({ ...deptDraft, head: v })} placeholder="Search by name or employee ID…" emptyText="No employees found" />
          </Fg>
        </div>
        {deptError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{deptError}</div>}
      </Drawer>

      <Drawer
        open={desOpen}
        onClose={() => setDesOpen(false)}
        title={desMode === 'add' ? 'Add designation' : 'Edit designation'}
        description={desDept ? `${desDept.name} · ${company?.name ?? ''}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDesOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveDesig}>
              {desMode === 'add' ? 'Add designation' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Fg label="Department">
            <input value={desDept?.name ?? ''} readOnly style={{ background: 'var(--bg)' }} />
          </Fg>
          <Fg label="Designation title" required>
            <input
              value={desDraft.title}
              onChange={(e) => {
                setDesDraft({ ...desDraft, title: e.target.value });
                if (desError) setDesError('');
              }}
              placeholder="e.g. Senior Accountant"
              style={desError ? { borderColor: 'var(--danger)' } : undefined}
            />
          </Fg>
        </div>
        {desError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{desError}</div>}
      </Drawer>
    </div>
  );
}
