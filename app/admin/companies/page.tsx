'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { companyHeadcount } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { Company } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState, Button } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { displayWebsite, isValidWebsite, normalizeWebsite } from '@/lib/url';
import { BuildingIcon, CheckIcon, EditIcon, MapPinIcon, PeopleIcon, PlusIcon, SearchIcon, TreeIcon, XIcon } from '@/components/icons';

const deriveShortCode = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);

const PALETTE = [
  { bg: '#e7f0fc', fg: '#2f6fd6' },
  { bg: '#f0eafc', fg: '#7a4bd0' },
  { bg: '#e7f6ee', fg: '#1f9d63' },
  { bg: '#fdf3df', fg: '#c6851b' },
  { bg: '#fce9e7', fg: '#d5493f' },
  { bg: '#e3f4f8', fg: '#0e8fa8' },
];
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const blankCompany = (): Company => ({
  id: '',
  name: '',
  shortCode: '',
  description: '',
  website: '',
  location: 'Both',
  established: String(new Date().getFullYear()),
  status: 'Active',
});

function Fg({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="fg">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function AdminCompaniesPage() {
  const { companies, departments, locations, locationName, addCompany, updateCompany, removeCompany } = useOrg();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [draft, setDraft] = useState<Company>(blankCompany());
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locFilter, setLocFilter] = useState('all');

  const shown = useMemo(
    () =>
      companies.filter(
        (c) =>
          (statusFilter === 'all' || c.status === statusFilter) &&
          (locFilter === 'all' || c.location === locFilter || c.location === 'Both') &&
          (!q.trim() || `${c.name} ${c.shortCode} ${c.description} ${c.website}`.toLowerCase().includes(q.trim().toLowerCase()))
      ),
    [companies, q, statusFilter, locFilter]
  );

  const totalHeadcount = companies.reduce((n, c) => n + companyHeadcount(c.name), 0);

  const toggleStatus = (c: Company) => updateCompany({ ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' });
  const deptCount = (c: Company) => departments.filter((d) => d.companyId === c.id).length;

  const remove = (c: Company) => {
    const n = departments.filter((d) => d.companyId === c.id).length;
    if (n > 0 && !window.confirm(`Delete ${c.name}? Its ${n} department(s) and their designations will also be removed.`)) return;
    removeCompany(c.id);
  };

  const openAdd = () => {
    setDraft(blankCompany());
    setMode('add');
    setError('');
    setDrawerOpen(true);
  };

  const openEdit = (c: Company) => {
    setDraft({ ...c });
    setMode('edit');
    setError('');
    setDrawerOpen(true);
  };

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Company name is required.');
      return;
    }
    const website = normalizeWebsite(draft.website);
    if (website && !isValidWebsite(website)) {
      setError('Enter a valid website, e.g. www.example.com.');
      return;
    }
    const record: Company = { ...draft, name, website, shortCode: draft.shortCode.trim() || deriveShortCode(name) };
    if (mode === 'add') {
      addCompany(record);
    } else {
      updateCompany(record);
    }
    setDrawerOpen(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration · Organization"
        title="Companies"
        description="The legal entities under Global Surf IT — each employee record belongs to one."
        actions={
          <Button variant="primary" onClick={openAdd}>
            <PlusIcon /> Add company
          </Button>
        }
      />

      <div className="rp-stats">
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#e7f0fc', color: '#2f6fd6' }}>
            <BuildingIcon />
          </span>
          <div>
            <div className="rp-stat-n">{companies.length}</div>
            <div className="rp-stat-l">Companies</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#e7f6ee', color: '#1f9d63' }}>
            <CheckIcon />
          </span>
          <div>
            <div className="rp-stat-n">{companies.filter((c) => c.status === 'Active').length}</div>
            <div className="rp-stat-l">Active</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#f0eafc', color: '#7a4bd0' }}>
            <PeopleIcon />
          </span>
          <div>
            <div className="rp-stat-n">{totalHeadcount}</div>
            <div className="rp-stat-l">Total headcount</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#fdf3df', color: '#c6851b' }}>
            <TreeIcon />
          </span>
          <div>
            <div className="rp-stat-n">{departments.length}</div>
            <div className="rp-stat-l">Departments</div>
          </div>
        </div>
      </div>

      <div className="tbar st-bar">
        <div className="tsearch">
          <SearchIcon />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, code, website…" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 36 }}>
          <option value="all">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} style={{ height: 36 }}>
          <option value="all">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.city})
            </option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>
          {shown.length} of {companies.length} compan{companies.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {shown.length === 0 ? (
        <Card className="row-gap">
          <EmptyState icon={<BuildingIcon />} title={companies.length ? 'No company matches' : 'No companies yet'} description={companies.length ? 'Try a different search or clear the filters.' : 'Add the first legal entity under Global Surf IT.'} />
        </Card>
      ) : (
        <div className="co-grid">
          {shown.map((c, i) => {
            const col = PALETTE[companies.findIndex((x) => x.id === c.id) % PALETTE.length];
            const heads = companyHeadcount(c.name);
            const share = totalHeadcount ? Math.round((heads / totalHeadcount) * 100) : 0;
            const inactive = c.status !== 'Active';
            return (
              <div key={c.id} className={`co-card ${inactive ? 'off' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
                <div className="co-top" style={{ background: `linear-gradient(135deg, ${col.bg}, #fff 85%)` }}>
                  <span className="co-av" style={{ background: '#fff', color: col.fg, boxShadow: `0 0 0 1px ${col.fg}33` }}>
                    {initials(c.name)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="co-nm">{c.name}</div>
                    <div className="co-code">{c.shortCode}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="co-body">
                  <p className="co-desc">{c.description || 'No description yet.'}</p>
                  <div className="co-web">
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noopener noreferrer">
                        {displayWebsite(c.website)} ↗
                      </a>
                    ) : (
                      <span style={{ color: 'var(--faint)' }}>Website not set</span>
                    )}
                  </div>

                  <div className="co-meta">
                    <div>
                      <MapPinIcon />
                      <span>{locationName(c.location)}</span>
                    </div>
                    <div>
                      <BuildingIcon />
                      <span>Established {c.established}</span>
                    </div>
                  </div>

                  <div className="co-heads">
                    <div className="co-heads-t">
                      <span>
                        <b>{heads}</b> employee{heads === 1 ? '' : 's'}
                      </span>
                      <span>{share}% of workforce</span>
                    </div>
                    <div className="rc-meter">
                      <i style={{ width: `${share}%`, background: col.fg }} />
                    </div>
                  </div>
                </div>

                <div className="co-foot">
                  <Link href="/admin/structure" className="co-link">
                    <TreeIcon /> {deptCount(c)} department{deptCount(c) === 1 ? '' : 's'} · Manage structure
                  </Link>
                  <div className="co-acts">
                    <button className="icon-act" onClick={() => toggleStatus(c)} title={inactive ? 'Activate company' : 'Deactivate company'} style={inactive ? undefined : { color: '#15803D' }}>
                      <CheckIcon />
                    </button>
                    <button className="icon-act" onClick={() => openEdit(c)} title="Edit">
                      <EditIcon />
                    </button>
                    <button className="icon-act" onClick={() => remove(c)} title="Delete">
                      <XIcon />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button className="co-add" onClick={openAdd}>
            <span>
              <PlusIcon />
            </span>
            Add company
          </button>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={mode === 'add' ? 'Add company' : 'Edit company'}
        description={mode === 'add' ? 'Register a new legal entity under Global Surf IT.' : `Editing ${draft.name || 'company'}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {mode === 'add' ? 'Add company' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="fg full">
            <Fg label="Company name" required>
              <input
                value={draft.name}
                onChange={(e) => {
                  setDraft({ ...draft, name: e.target.value });
                  if (error) setError('');
                }}
                placeholder="e.g. GS Facilities"
                style={error ? { borderColor: 'var(--danger)' } : undefined}
              />
            </Fg>
          </div>
          <Fg label="Short code">
            <input value={draft.shortCode} onChange={(e) => setDraft({ ...draft, shortCode: e.target.value.toUpperCase() })} placeholder="Auto-generated if left blank" />
          </Fg>
          <Fg label="Established">
            <input value={draft.established} onChange={(e) => setDraft({ ...draft, established: e.target.value })} placeholder="e.g. 2024" />
          </Fg>
          <div className="fg full">
            <Fg label="Website">
              <input
                value={draft.website}
                onChange={(e) => {
                  setDraft({ ...draft, website: e.target.value });
                  if (error) setError('');
                }}
                placeholder="e.g. www.globalsurf.ae"
                inputMode="url"
              />
            </Fg>
          </div>
          <div className="fg full">
            <Fg label="Description">
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What this entity does" />
            </Fg>
          </div>
          <Fg label="Location">
            <select value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })}>
              <option value="Both">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Fg>
          <Fg label="Status">
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Company['status'] })}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </Fg>
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
        {mode === 'edit' && (
          <div className="note-box" style={{ marginTop: 16 }}>
            <BuildingIcon style={{ color: 'var(--primary)' }} />
            <div>
              {companyHeadcount(draft.name)} employee(s) are currently assigned to {draft.name || 'this company'}.
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
