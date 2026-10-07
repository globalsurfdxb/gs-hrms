'use client';

import { useMemo, useState } from 'react';
import { ROLE_SCOPE } from '@/lib/data';
import { AccessCategory, AccessFeature, AccessModule, SYSTEM_ROLES, buildCatalog, defaultGrants } from '@/lib/access';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, EditIcon, GearIcon, KeyIcon, PackageIcon, PeopleIcon, PlusIcon, ReceiptIcon, RefreshIcon, SearchIcon, ShieldIcon, XIcon } from '@/components/icons';

interface RoleDef {
  id: string;
  name: string;
  description: string;
  system: boolean;
  perms: string[];
}

const MODULE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  administration: GearIcon,
  employee: PeopleIcon,
  'leave-attendance': ClockIcon,
  'asset-management': PackageIcon,
  payroll: ReceiptIcon,
  renewals: RefreshIcon,
};

const MODULE_COLOR: Record<string, { bg: string; fg: string }> = {
  administration: { bg: '#eceff4', fg: '#4b5876' },
  employee: { bg: '#e7f0fc', fg: '#2f6fd6' },
  'leave-attendance': { bg: '#e7f6ee', fg: '#1f9d63' },
  'asset-management': { bg: '#fdf3df', fg: '#c6851b' },
  payroll: { bg: '#f0eafc', fg: '#7a4bd0' },
  renewals: { bg: '#fce9e7', fg: '#d5493f' },
};
const MODULE_SHORT: Record<string, string> = { administration: 'Admin', employee: 'Employee', 'leave-attendance': 'Leave', 'asset-management': 'Asset', payroll: 'Payroll', renewals: 'Renewal' };
const ROLE_COLORS = ['#7a4bd0', '#2f6fd6', '#1f9d63', '#c6851b', '#d5493f', '#0e8fa8', '#6b7690'];

const NEW_CATEGORY = '__new__';
const blankRole = (): RoleDef => ({ id: '', name: '', description: '', system: false, perms: [] });
const ids = (fs: AccessFeature[]) => fs.map((f) => f.id);
const catFeatures = (c: AccessCategory) => c.features;
const modFeatures = (m: AccessModule) => m.categories.flatMap(catFeatures);

function Check({ checked, some, onChange, title }: { checked: boolean; some?: boolean; onChange: () => void; title?: string }) {
  return (
    <input
      type="checkbox"
      title={title}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!some && !checked;
      }}
      onChange={onChange}
      style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }}
    />
  );
}

function Acc({ open, onToggle, level, title, meta, icon, badge, children }: { open: boolean; onToggle: () => void; level: 1 | 2; title: string; meta?: string; icon?: React.ReactNode; badge?: string; children: React.ReactNode }) {
  return (
    <div className={`acc acc-l${level} ${open ? 'open' : ''}`}>
      <button type="button" className="acc-h" onClick={onToggle} aria-expanded={open}>
        <span className="acc-chev">{open ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
        {icon && <span className="acc-ic">{icon}</span>}
        <span className="acc-t">{title}</span>
        {badge && <span className="chip" style={{ padding: '2px 8px', fontSize: 11 }}>{badge}</span>}
        {meta && <span className="acc-m">{meta}</span>}
      </button>
      {open && <div className="acc-b">{children}</div>}
    </div>
  );
}

export default function AdminRolesPage() {
  const [catalog, setCatalog] = useState<AccessModule[]>(buildCatalog);
  const [roles, setRoles] = useState<RoleDef[]>(() => {
    const cat = buildCatalog();
    return SYSTEM_ROLES.map((r) => ({ id: r, name: r, description: ROLE_SCOPE[r], system: true, perms: defaultGrants(r, cat) }));
  });
  const [open, setOpen] = useState<Record<string, boolean>>({ administration: false, employee: true });
  const [q, setQ] = useState('');

  const [roleDrawer, setRoleDrawer] = useState(false);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [draft, setDraft] = useState<RoleDef>(blankRole());
  const [draftOpen, setDraftOpen] = useState<Record<string, boolean>>({});
  const [roleError, setRoleError] = useState('');

  const [featDrawer, setFeatDrawer] = useState(false);
  const [featLabel, setFeatLabel] = useState('');
  const [featModule, setFeatModule] = useState('employee');
  const [featCat, setFeatCat] = useState('');
  const [featNewCat, setFeatNewCat] = useState('');
  const [featRoles, setFeatRoles] = useState<string[]>(['Super Admin']);
  const [featError, setFeatError] = useState('');

  const searching = q.trim().length > 0;
  const match = (f: AccessFeature, c: AccessCategory, m: AccessModule) => `${f.label} ${c.label} ${m.name}`.toLowerCase().includes(q.trim().toLowerCase());
  const view = useMemo(
    () =>
      catalog
        .map((m) => ({ ...m, categories: m.categories.map((c) => ({ ...c, features: searching ? c.features.filter((f) => match(f, c, m)) : c.features })).filter((c) => !searching || c.features.length) }))
        .filter((m) => !searching || m.categories.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, q]
  );

  const totalFeatures = catalog.reduce((n, m) => n + modFeatures(m).length, 0);
  const grantedOf = (r: RoleDef) => catalog.reduce((n, m) => n + modFeatures(m).filter((f) => r.perms.includes(f.id)).length, 0);
  const isOpen = (key: string, dflt = false) => (searching ? true : open[key] ?? dflt);
  const flip = (key: string, dflt = false) => setOpen((o) => ({ ...o, [key]: !(o[key] ?? dflt) }));
  const expandAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    catalog.forEach((m) => {
      next[m.id] = on;
      m.categories.forEach((c) => (next[`${m.id}/${c.id}`] = on));
    });
    setOpen(next);
  };

  const mutate = (roleId: string, fn: (p: string[]) => string[]) => setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, perms: fn(r.perms) } : r)));
  const toggleSet = (roleId: string, list: string[]) =>
    mutate(roleId, (p) => (list.every((id) => p.includes(id)) ? p.filter((x) => !list.includes(x)) : [...new Set([...p, ...list])]));
  const toggleOne = (roleId: string, id: string) => mutate(roleId, (p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stat = (perms: string[], list: AccessFeature[]) => {
    const n = list.filter((f) => perms.includes(f.id)).length;
    return { n, all: n === list.length && list.length > 0, some: n > 0 };
  };

  /* ---------- role drawer ---------- */
  const openAdd = () => {
    setDraft(blankRole());
    setDraftOpen({});
    setMode('add');
    setRoleError('');
    setRoleDrawer(true);
  };
  const openEdit = (r: RoleDef) => {
    setDraft({ ...r, perms: [...r.perms] });
    setDraftOpen({});
    setMode('edit');
    setRoleError('');
    setRoleDrawer(true);
  };
  const draftSet = (list: string[]) =>
    setDraft((d) => ({ ...d, perms: list.every((id) => d.perms.includes(id)) ? d.perms.filter((x) => !list.includes(x)) : [...new Set([...d.perms, ...list])] }));
  const draftOne = (id: string) => setDraft((d) => ({ ...d, perms: d.perms.includes(id) ? d.perms.filter((x) => x !== id) : [...d.perms, id] }));

  const saveRole = () => {
    const name = draft.name.trim();
    if (!name) return setRoleError('Role name is required.');
    if (mode === 'add' && roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) return setRoleError('A role with that name already exists.');
    if (mode === 'add') setRoles((prev) => [...prev, { ...draft, id: `role-${Date.now()}`, name, system: false }]);
    else setRoles((prev) => prev.map((r) => (r.id === draft.id ? { ...draft, name: r.system ? r.name : name } : r)));
    setRoleDrawer(false);
  };

  /* ---------- feature drawer ---------- */
  const featModuleDef = catalog.find((m) => m.id === featModule);
  const openFeature = () => {
    const m = catalog[1] ?? catalog[0];
    setFeatLabel('');
    setFeatModule(m.id);
    setFeatCat(m.categories[0]?.id ?? NEW_CATEGORY);
    setFeatNewCat('');
    setFeatRoles(['Super Admin']);
    setFeatError('');
    setFeatDrawer(true);
  };
  const saveFeature = () => {
    const label = featLabel.trim();
    if (!label) return setFeatError('Feature name is required.');
    const m = catalog.find((x) => x.id === featModule);
    if (!m) return;
    let catId = featCat;
    let newCat: AccessCategory | null = null;
    if (featCat === NEW_CATEGORY) {
      const cl = featNewCat.trim();
      if (!cl) return setFeatError('Category name is required.');
      const existing = m.categories.find((c) => c.label.toLowerCase() === cl.toLowerCase());
      if (existing) catId = existing.id;
      else {
        catId = `custom-${Date.now()}`;
        newCat = { id: catId, label: cl, rank: 5, features: [] };
      }
    }
    const fid = `${m.id}:${catId}:custom-${Date.now()}`;
    setCatalog((prev) =>
      prev.map((x) => {
        if (x.id !== m.id) return x;
        const cats = newCat ? [...x.categories, newCat] : x.categories;
        return { ...x, categories: cats.map((c) => (c.id === catId ? { ...c, features: [...c.features, { id: fid, label, custom: true }] } : c)) };
      })
    );
    setRoles((prev) => prev.map((r) => (featRoles.includes(r.id) ? { ...r, perms: [...r.perms, fid] } : r)));
    setOpen((o) => ({ ...o, [m.id]: true, [`${m.id}/${catId}`]: true }));
    setFeatDrawer(false);
  };
  const removeFeature = (id: string) => {
    setCatalog((prev) => prev.map((m) => ({ ...m, categories: m.categories.map((c) => ({ ...c, features: c.features.filter((f) => f.id !== id) })) })));
    setRoles((prev) => prev.map((r) => ({ ...r, perms: r.perms.filter((p) => p !== id) })));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Roles & Permissions"
        description="One access model for every module. Open a module, then a category, and tick the features each role may use."
        actions={
          <>
            <Button variant="ghost" onClick={() => expandAll(true)}>
              Expand all
            </Button>
            <Button variant="ghost" onClick={() => expandAll(false)}>
              Collapse all
            </Button>
            <Button variant="ghost" onClick={openFeature}>
              <PlusIcon /> Add feature
            </Button>
            <Button variant="primary" onClick={openAdd}>
              <PlusIcon /> Add role
            </Button>
          </>
        }
      />

      <div className="rp-stats">
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#e7f0fc', color: '#2f6fd6' }}>
            <KeyIcon />
          </span>
          <div>
            <div className="rp-stat-n">{roles.length}</div>
            <div className="rp-stat-l">Roles</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#f0eafc', color: '#7a4bd0' }}>
            <PackageIcon />
          </span>
          <div>
            <div className="rp-stat-n">{catalog.length}</div>
            <div className="rp-stat-l">Modules</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#e7f6ee', color: '#1f9d63' }}>
            <ShieldIcon />
          </span>
          <div>
            <div className="rp-stat-n">{totalFeatures}</div>
            <div className="rp-stat-l">Features controlled</div>
          </div>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-ic" style={{ background: '#fdf3df', color: '#c6851b' }}>
            <EditIcon />
          </span>
          <div>
            <div className="rp-stat-n">{roles.filter((r) => !r.system).length}</div>
            <div className="rp-stat-l">Custom roles</div>
          </div>
        </div>
      </div>

      <div className="rp-sec">
        <h3>Roles</h3>
        <span>{roles.length} on file</span>
      </div>
      <div className="role-grid">
        {roles.map((r, i) => {
          const g = grantedOf(r);
          const pct = totalFeatures ? Math.round((g / totalFeatures) * 100) : 0;
          const c = ROLE_COLORS[i % ROLE_COLORS.length];
          return (
            <div key={r.id} className="role-card">
              <div className="rc-top">
                <div className="rc-av" style={{ background: `${c}1f`, color: c }}>
                  {r.name.charAt(0)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="rc-nm">{r.name}</div>
                  <div className="rc-sub">{r.system ? 'System role' : 'Custom role'}</div>
                </div>
                <button className="icon-act" onClick={() => openEdit(r)} title="Edit role">
                  <EditIcon />
                </button>
                {r.system ? (
                  <span className="icon-act" title="System roles can't be deleted" style={{ cursor: 'default', color: 'var(--faint)' }}>
                    <ShieldIcon />
                  </span>
                ) : (
                  <button className="icon-act" onClick={() => setRoles((prev) => prev.filter((x) => x.id !== r.id))} title="Delete role">
                    <XIcon />
                  </button>
                )}
              </div>
              <div className="rc-desc">{r.description || 'No description yet.'}</div>
              <div className="rc-meter">
                <i style={{ width: `${pct}%`, background: c }} />
              </div>
              <div className="rc-pct">
                <b>{g}</b> of {totalFeatures} features · {pct}%
              </div>
              <div className="rc-mods">
                {catalog.map((m) => {
                  const st = stat(r.perms, modFeatures(m));
                  return (
                    <span key={m.id} className={`rc-mod ${st.all ? 'full' : st.some ? 'part' : 'none'}`} title={`${m.name}: ${st.n} of ${modFeatures(m).length}`}>
                      {MODULE_SHORT[m.id] ?? m.name} <b>{st.n}</b>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rp-sec" style={{ marginTop: 26 }}>
        <h3>Access matrix</h3>
        <span>Module → category → feature. Tick a module or category to grant everything inside it.</span>
      </div>
      <div className="rp-card">
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a feature, category or module…" />
          </div>
          <div className="rp-legend">
            <span><i className="lg full" /> All</span>
            <span><i className="lg part" /> Some</span>
            <span><i className="lg none" /> None</span>
          </div>
        </div>

        <div className="rp" style={{ ['--cols' as string]: roles.length } as React.CSSProperties}>
          <div className="rp-row rp-head">
            <div className="rp-c1">
              <b>Features</b>
              <span>
                {totalFeatures} across {catalog.length} modules
              </span>
            </div>
            {roles.map((r, i) => {
              const c = ROLE_COLORS[i % ROLE_COLORS.length];
              const pct = totalFeatures ? Math.round((grantedOf(r) / totalFeatures) * 100) : 0;
              return (
                <div key={r.id} className="rp-rc" title={r.name}>
                  <span className="rp-av" style={{ background: `${c}1f`, color: c }}>
                    {r.name.charAt(0)}
                  </span>
                  <b>{r.name}</b>
                  <small>{pct}%</small>
                </div>
              );
            })}
          </div>

          {!view.length && <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No feature matches “{q}”.</div>}

          {view.map((m) => {
            const mf = modFeatures(m);
            const Icon = MODULE_ICON[m.id] ?? KeyIcon;
            const col = MODULE_COLOR[m.id] ?? { bg: '#eef1fa', fg: '#28469a' };
            const mOpen = isOpen(m.id, m.id === 'employee');
            return (
              <div key={m.id} className={`rp-mod ${mOpen ? 'open' : ''}`}>
                <div className="rp-row rp-mh" role="button" tabIndex={0} aria-expanded={mOpen} onClick={() => flip(m.id, m.id === 'employee')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), flip(m.id, m.id === 'employee'))}>
                  <div className="rp-c1">
                    <span className="acc-chev">{mOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                    <span className="rp-tile" style={{ background: col.bg, color: col.fg }}>
                      <Icon />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="rp-t">
                        {m.name} {m.common && <span className="rp-badge">Common to all modules</span>}
                      </div>
                      <div className="rp-s">
                        {m.categories.length} categor{m.categories.length === 1 ? 'y' : 'ies'} · {mf.length} feature{mf.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  {roles.map((r) => {
                    const st = stat(r.perms, mf);
                    return (
                      <div key={r.id} className="rp-rc" onClick={(e) => e.stopPropagation()}>
                        <Check checked={st.all} some={st.some} onChange={() => toggleSet(r.id, ids(mf))} title={`${r.name}: ${st.n}/${mf.length} in ${m.name}`} />
                        <small>
                          {st.n}/{mf.length}
                        </small>
                      </div>
                    );
                  })}
                </div>

                {mOpen &&
                  m.categories.map((c) => {
                    const key = `${m.id}/${c.id}`;
                    const cOpen = isOpen(key);
                    return (
                      <div key={c.id} className={`rp-cat ${cOpen ? 'open' : ''}`}>
                        <div className="rp-row rp-ch" role="button" tabIndex={0} aria-expanded={cOpen} onClick={() => flip(key)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), flip(key))}>
                          <div className="rp-c1">
                            <span className="acc-chev">{cOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                            <span className="rp-ct">{c.label}</span>
                            <span className="rp-cnt">{c.features.length}</span>
                          </div>
                          {roles.map((r) => {
                            const st = stat(r.perms, c.features);
                            return (
                              <div key={r.id} className="rp-rc" onClick={(e) => e.stopPropagation()}>
                                <Check checked={st.all} some={st.some} onChange={() => toggleSet(r.id, ids(c.features))} title={`${r.name}: ${st.n}/${c.features.length} in ${c.label}`} />
                              </div>
                            );
                          })}
                        </div>
                        {cOpen &&
                          c.features.map((fe) => (
                            <div key={fe.id} className="rp-row rp-fr">
                              <div className="rp-c1 rp-fl">
                                {fe.label}
                                {fe.custom && (
                                  <>
                                    <span className="rp-badge" style={{ marginLeft: 8 }}>custom</span>
                                    <button className="icon-act" style={{ marginLeft: 4 }} onClick={() => removeFeature(fe.id)} title="Remove feature">
                                      <XIcon />
                                    </button>
                                  </>
                                )}
                              </div>
                              {roles.map((r) => (
                                <div key={r.id} className="rp-rc">
                                  <Check checked={r.perms.includes(fe.id)} onChange={() => toggleOne(r.id, fe.id)} title={`${r.name} → ${fe.label}`} />
                                </div>
                              ))}
                            </div>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>

        <div className="note-box" style={{ margin: 16 }}>
          <ShieldIcon />
          <div>
            Changes are held in this browser session. Each module reads its grants from this one catalogue (<code>lib/access.ts</code>); the RBAC backend will persist them and enforce them on every API call.
          </div>
        </div>
      </div>

      <Drawer
        open={roleDrawer}
        onClose={() => setRoleDrawer(false)}
        title={mode === 'add' ? 'Add role' : 'Edit role'}
        description={mode === 'add' ? 'Create a custom role and choose which features it can use in each module.' : `Editing ${draft.name || 'role'}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleDrawer(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveRole}>
              {mode === 'add' ? 'Add role' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="fg full">
            <label>
              Role name <span className="req">*</span>
            </label>
            <input
              value={draft.name}
              disabled={draft.system}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                if (roleError) setRoleError('');
              }}
              placeholder="e.g. Finance Approver"
              style={roleError ? { borderColor: 'var(--danger)' } : undefined}
            />
            {draft.system && <div className="hint">System role names can&apos;t be renamed.</div>}
          </div>
          <div className="fg full">
            <label>Description</label>
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What this role is for" />
          </div>
        </div>
        {roleError && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{roleError}</div>}

        <div style={{ marginTop: 18 }}>
          {catalog.map((m) => {
            const mf = modFeatures(m);
            const ms = stat(draft.perms, mf);
            const Icon = MODULE_ICON[m.id] ?? KeyIcon;
            return (
              <Acc key={m.id} level={1} open={!!draftOpen[m.id]} onToggle={() => setDraftOpen((o) => ({ ...o, [m.id]: !o[m.id] }))} icon={<Icon />} title={m.name} badge={m.common ? 'Common' : undefined} meta={`${ms.n}/${mf.length}`}>
                <label className="perm-item" style={{ marginBottom: 8, background: 'var(--bg)' }}>
                  <Check checked={ms.all} some={ms.some} onChange={() => draftSet(ids(mf))} />
                  <div className="nm">Entire module</div>
                </label>
                {m.categories.map((c) => {
                  const cs = stat(draft.perms, c.features);
                  const key = `${m.id}/${c.id}`;
                  return (
                    <Acc key={c.id} level={2} open={!!draftOpen[key]} onToggle={() => setDraftOpen((o) => ({ ...o, [key]: !o[key] }))} title={c.label} meta={`${cs.n}/${c.features.length}`}>
                      <label className="perm-item" style={{ marginBottom: 6, background: 'var(--bg)' }}>
                        <Check checked={cs.all} some={cs.some} onChange={() => draftSet(ids(c.features))} />
                        <div className="nm">All in {c.label}</div>
                      </label>
                      <div className="perm-grid">
                        {c.features.map((f) => (
                          <label key={f.id} className="perm-item">
                            <input type="checkbox" checked={draft.perms.includes(f.id)} onChange={() => draftOne(f.id)} />
                            <div className="nm">{f.label}</div>
                          </label>
                        ))}
                      </div>
                    </Acc>
                  );
                })}
              </Acc>
            );
          })}
        </div>
      </Drawer>

      <Drawer
        open={featDrawer}
        onClose={() => setFeatDrawer(false)}
        title="Add feature"
        description="Register a new page or section under a module and category so its access can be controlled per role."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFeatDrawer(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveFeature}>
              Add feature
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="fg full">
            <label>
              Feature name <span className="req">*</span>
            </label>
            <input
              value={featLabel}
              onChange={(e) => {
                setFeatLabel(e.target.value);
                if (featError) setFeatError('');
              }}
              placeholder="e.g. Benefits"
              style={featError ? { borderColor: 'var(--danger)' } : undefined}
            />
          </div>
          <div className="fg full">
            <label>Module</label>
            <select
              value={featModule}
              onChange={(e) => {
                const m = catalog.find((x) => x.id === e.target.value);
                setFeatModule(e.target.value);
                setFeatCat(m?.categories[0]?.id ?? NEW_CATEGORY);
              }}
            >
              {catalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fg full">
            <label>Category</label>
            <select value={featCat} onChange={(e) => setFeatCat(e.target.value)}>
              {featModuleDef?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              <option value={NEW_CATEGORY}>＋ New category…</option>
            </select>
          </div>
          {featCat === NEW_CATEGORY && (
            <div className="fg full">
              <label>
                New category name <span className="req">*</span>
              </label>
              <input value={featNewCat} onChange={(e) => setFeatNewCat(e.target.value)} placeholder="e.g. Benefits & Insurance" />
            </div>
          )}
        </div>
        {featError && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{featError}</div>}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>Grant to</div>
          <div className="perm-grid">
            {roles.map((r) => (
              <label key={r.id} className="perm-item">
                <input type="checkbox" checked={featRoles.includes(r.id)} onChange={() => setFeatRoles((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))} />
                <div className="nm">{r.name}</div>
              </label>
            ))}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
