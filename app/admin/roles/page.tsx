'use client';

import { useMemo, useState } from 'react';
import { ROLE_SCOPE } from '@/lib/data';
import { logAudit } from '@/lib/employeeStore';
import { useCurrentEmployee } from '@/context/AppContext';
import { ACTIONS, AccessAction, AccessCategory, AccessFeature, AccessModule, EXTRA_ACTIONS, ExtraAction, SYSTEM_ROLES, buildCatalog, defaultGrants, permKey } from '@/lib/access';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, EditIcon, GearIcon, JoinIcon, KeyIcon, PackageIcon, PeopleIcon, PlusIcon, ReceiptIcon, RefreshIcon, SearchIcon, ShieldIcon, XIcon } from '@/components/icons';

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
  hiring: JoinIcon,
  'leave-attendance': ClockIcon,
  'asset-management': PackageIcon,
  payroll: ReceiptIcon,
  renewals: RefreshIcon,
};

const MODULE_COLOR: Record<string, { bg: string; fg: string }> = {
  administration: { bg: '#eceff4', fg: '#4b5876' },
  employee: { bg: '#e7f0fc', fg: '#2f6fd6' },
  hiring: { bg: '#e3f4f8', fg: '#0e8fa8' },
  'leave-attendance': { bg: '#e7f6ee', fg: '#1f9d63' },
  'asset-management': { bg: '#fdf3df', fg: '#c6851b' },
  payroll: { bg: '#f0eafc', fg: '#7a4bd0' },
  renewals: { bg: '#fce9e7', fg: '#d5493f' },
};
const MODULE_SHORT: Record<string, string> = { administration: 'Admin', employee: 'Employee', hiring: 'Hiring', 'leave-attendance': 'Leave', 'asset-management': 'Asset', payroll: 'Payroll', renewals: 'Renewal' };
const ROLE_COLORS = ['#7a4bd0', '#2f6fd6', '#1f9d63', '#c6851b', '#d5493f', '#0e8fa8', '#6b7690'];

/** Plain-English list of permission keys ("Directory (Edit), Leave Requests (View) +2 more") for the audit log. */
const describePerms = (keys: string[], catalog: AccessModule[]) => {
  const labels = new Map<string, string>();
  catalog.forEach((m) => m.categories.forEach((c) => c.features.forEach((f) => labels.set(f.id, f.label))));
  const names = keys.map((k) => {
    const [id, a] = k.split('#');
    return `${labels.get(id) ?? id} (${a ? a.charAt(0).toUpperCase() + a.slice(1) : 'View'})`;
  });
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3} more` : names.join(', ');
};

const NEW_CATEGORY = '__new__';
const blankRole = (): RoleDef => ({ id: '', name: '', description: '', system: false, perms: [] });
const catFeatures = (c: AccessCategory) => c.features;
const modFeatures = (m: AccessModule) => m.categories.flatMap(catFeatures);

/** Every permission key a feature can have: View plus whichever of Add/Edit/Delete apply. */
const fullKeys = (f: AccessFeature) => [f.id, ...(f.actions ?? []).map((a) => permKey(f.id, a))];
/** Add/Edit/Delete need View, so ticking one ticks View and clearing View clears them all. */
const flipAction = (perms: string[], f: AccessFeature, a: AccessAction): string[] => {
  if (a === 'view') return perms.includes(f.id) ? perms.filter((p) => p !== f.id && !p.startsWith(`${f.id}#`)) : [...perms, f.id];
  const k = permKey(f.id, a);
  return perms.includes(k) ? perms.filter((p) => p !== k) : [...new Set([...perms, f.id, k])];
};
const countAction = (perms: string[], list: AccessFeature[], a: ExtraAction) => list.filter((f) => perms.includes(permKey(f.id, a))).length;

/** How many of the features that support an action have it ticked (View applies to every feature). */
const groupStat = (perms: string[], list: AccessFeature[], a: AccessAction) => {
  const sup = list.filter((f) => a === 'view' || (f.actions ?? []).includes(a as ExtraAction));
  const n = sup.filter((f) => perms.includes(permKey(f.id, a))).length;
  return { n, total: sup.length, all: sup.length > 0 && n === sup.length, some: n > 0 };
};
const flipGroup = (perms: string[], list: AccessFeature[], a: AccessAction): string[] => {
  const sup = list.filter((f) => a === 'view' || (f.actions ?? []).includes(a as ExtraAction));
  if (!sup.length) return perms;
  const all = sup.every((f) => perms.includes(permKey(f.id, a)));
  return sup.reduce((p, f) => (all ? (a === 'view' ? flipAction(p, f, 'view') : p.filter((x) => x !== permKey(f.id, a))) : p.includes(permKey(f.id, a)) ? p : flipAction(p, f, a)), perms);
};

/** One View / Add / Edit / Delete button per action for a whole module or category (all, some or none ticked). */
function GroupActs({ list, perms, who, onToggle }: { list: AccessFeature[]; perms: string[]; who: string; onToggle: (a: AccessAction) => void }) {
  return (
    <span className="acts">
      {ACTIONS.map((a) => {
        const g = groupStat(perms, list, a.key);
        if (!g.total) return <span key={a.key} className="act-gap" />;
        return (
          <button key={a.key} type="button" className={`act act-${a.key} ${g.all ? 'on' : g.some ? 'part' : ''}`} aria-pressed={g.all} title={`${who}: ${a.label} — ${g.n} of ${g.total} features`} onClick={() => onToggle(a.key)}>
            {a.short}
          </button>
        );
      })}
    </span>
  );
}

/** View / Add / Edit / Delete toggles for one feature and one role. */
function Acts({ f, perms, who, onToggle }: { f: AccessFeature; perms: string[]; who: string; onToggle: (a: AccessAction) => void }) {
  return (
    <span className="acts">
      {ACTIONS.map((a) => {
        const applies = a.key === 'view' || (f.actions ?? []).includes(a.key as ExtraAction);
        if (!applies) return <span key={a.key} className="act-gap" />;
        const on = perms.includes(permKey(f.id, a.key));
        return (
          <button key={a.key} type="button" className={`act act-${a.key} ${on ? 'on' : ''}`} aria-pressed={on} title={`${who}: ${a.label} — ${a.hint}`} onClick={() => onToggle(a.key)}>
            {a.short}
          </button>
        );
      })}
    </span>
  );
}

/* ---------- role editor ---------- */
type Level = 'none' | 'view' | 'edit' | 'full';
const LEVELS: { key: Level; label: string; hint: string }[] = [
  { key: 'none', label: 'No access', hint: 'Cannot open these screens' },
  { key: 'view', label: 'View only', hint: 'Can open and read, nothing else' },
  { key: 'edit', label: 'View & edit', hint: 'Can view, add and edit, but not delete' },
  { key: 'full', label: 'Full access', hint: 'Can view, add, edit and delete' },
];
const keysAt = (f: AccessFeature, level: Level): string[] => {
  if (level === 'none') return [];
  if (level === 'view') return [f.id];
  if (level === 'full') return fullKeys(f);
  return [f.id, ...(f.actions ?? []).filter((a) => a !== 'delete').map((a) => permKey(f.id, a))];
};
/** Which preset a set of features matches, or 'custom' when it is a mix. */
const levelOf = (perms: string[], list: AccessFeature[]): Level | 'custom' => {
  if (!list.length) return 'none';
  const have = new Set(list.flatMap(fullKeys).filter((k) => perms.includes(k)));
  for (const lv of ['none', 'view', 'edit', 'full'] as const) {
    const want = new Set(list.flatMap((f) => keysAt(f, lv)));
    if (want.size === have.size && [...want].every((k) => have.has(k))) return lv;
  }
  return 'custom';
};
const applyLevel = (perms: string[], list: AccessFeature[], level: Level): string[] => {
  const all = new Set(list.flatMap(fullKeys));
  return [...perms.filter((p) => !all.has(p)), ...list.flatMap((f) => keysAt(f, level))];
};
/** What a role can do with one feature, in plain words. */
const describeFeature = (perms: string[], f: AccessFeature): string => {
  if (!perms.includes(f.id)) return 'No access';
  const extra = (f.actions ?? []).filter((a) => perms.includes(permKey(f.id, a)));
  if (!extra.length) return f.actions?.length ? 'Can view only' : 'Can view';
  if (extra.length === (f.actions ?? []).length) return 'Full access';
  return `Can view, ${extra.join(', ')}`;
};

function LevelSelect({ value, onChange, label }: { value: Level | 'custom'; onChange: (l: Level) => void; label: string }) {
  return (
    <select className={`re-level lv-${value}`} value={value} onChange={(e) => onChange(e.target.value as Level)} aria-label={label} title={LEVELS.find((l) => l.key === value)?.hint ?? 'A mix of access levels'}>
      {value === 'custom' && (
        <option value="custom" disabled>
          Custom mix
        </option>
      )}
      {LEVELS.map((l) => (
        <option key={l.key} value={l.key}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

/** Edit what a role can do: start from a preset, then adjust a module, a section or a single feature. */
function RoleEditor({ catalog, perms, onChange, open, onOpen }: { catalog: AccessModule[]; perms: string[]; onChange: (p: string[]) => void; open: Record<string, boolean>; onOpen: (key: string) => void }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const searching = needle.length > 0;
  const everything = catalog.flatMap(modFeatures);
  const total = everything.length;
  const allLevel = levelOf(perms, everything);
  const countOf = (a: AccessAction) => everything.filter((f) => perms.includes(permKey(f.id, a))).length;

  return (
    <div className="re">
      <div className="re-sum">
        <div className="re-sum-t">
          <b>{countOf('view')}</b> of {total} features can be opened
        </div>
        <div className="re-meter">
          <i style={{ width: `${total ? (countOf('view') / total) * 100 : 0}%` }} />
        </div>
        <div className="re-sum-s">
          <span><i className="act-key act-add">+</i> {countOf('add')} can add</span>
          <span><i className="act-key act-edit">✎</i> {countOf('edit')} can edit</span>
          <span><i className="act-key act-delete">×</i> {countOf('delete')} can delete</span>
        </div>
      </div>

      <div className="re-step">
        <span className="re-n">1</span>
        <div>
          <b>Pick a starting point</b>
          <small>Applies to every module. You can fine-tune below.</small>
        </div>
      </div>
      <div className="re-presets" role="group" aria-label="Starting point">
        {LEVELS.map((l) => (
          <button key={l.key} type="button" className={`re-preset ${allLevel === l.key ? 'on' : ''}`} aria-pressed={allLevel === l.key} onClick={() => onChange(applyLevel(perms, everything, l.key))}>
            <b>{l.label}</b>
            <small>{l.hint}</small>
          </button>
        ))}
      </div>

      <div className="re-step">
        <span className="re-n">2</span>
        <div>
          <b>Adjust by module</b>
          <small>Open a module to set a section or one feature. The buttons are View, Add, Edit and Delete.</small>
        </div>
      </div>
      <div className="re-find">
        <SearchIcon />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a feature…" aria-label="Find a feature" />
      </div>

      {catalog.map((m) => {
        const cats = m.categories
          .map((c) => ({ ...c, features: searching ? c.features.filter((f) => `${f.label} ${c.label} ${m.name}`.toLowerCase().includes(needle)) : c.features }))
          .filter((c) => c.features.length);
        if (searching && !cats.length) return null;
        const mf = modFeatures(m);
        const granted = mf.filter((f) => perms.includes(f.id)).length;
        const isOpen = searching || !!open[m.id];
        const Icon = MODULE_ICON[m.id] ?? KeyIcon;
        return (
          <section key={m.id} className={`re-mod ${isOpen ? 'open' : ''}`}>
            <div className="re-mh">
              <button type="button" className="re-toggle" onClick={() => onOpen(m.id)} aria-expanded={isOpen}>
                <span className="re-chev">{isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                <span className="re-ic">
                  <Icon />
                </span>
                <span className="re-mt">
                  <b>{m.name}</b>
                  <small>
                    {granted} of {mf.length} features open{m.common ? ' · shared by every module' : ''}
                  </small>
                </span>
              </button>
              <LevelSelect value={levelOf(perms, mf)} onChange={(l) => onChange(applyLevel(perms, mf, l))} label={`Access to all of ${m.name}`} />
            </div>
            {isOpen && (
              <div className="re-mb">
                {cats.map((c) => (
                  <div key={c.id} className="re-cat">
                    <div className="re-ch">
                      <span>{c.label}</span>
                      <LevelSelect value={levelOf(perms, c.features)} onChange={(l) => onChange(applyLevel(perms, c.features, l))} label={`Access to all of ${c.label}`} />
                    </div>
                    {c.features.map((f) => (
                      <div key={f.id} className={`re-feat ${perms.includes(f.id) ? 'on' : ''}`}>
                        <div className="re-ft">
                          <b>{f.label}</b>
                          <small>{describeFeature(perms, f)}</small>
                        </div>
                        <div className="re-chips">
                          {ACTIONS.filter((a) => a.key === 'view' || (f.actions ?? []).includes(a.key as ExtraAction)).map((a) => {
                            const on = perms.includes(permKey(f.id, a.key));
                            return (
                              <button key={a.key} type="button" className={`re-chip act-${a.key} ${on ? 'on' : ''}`} aria-pressed={on} title={a.hint} onClick={() => onChange(flipAction(perms, f, a.key))}>
                                {on ? '✓ ' : ''}
                                {a.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {searching && !catalog.some((m) => m.categories.some((c) => c.features.some((f) => `${f.label} ${c.label} ${m.name}`.toLowerCase().includes(needle)))) && <div className="re-none">No feature matches “{q.trim()}”.</div>}
    </div>
  );
}

export default function AdminRolesPage() {
  const me = useCurrentEmployee();
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
  const [featActs, setFeatActs] = useState<ExtraAction[]>(['add', 'edit', 'delete']);
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

  /** Write grant and revoke entries to the audit log for one role's permission change. */
  const auditPerms = (roleName: string, before: string[], after: string[]) => {
    const granted = after.filter((k) => !before.includes(k));
    const revoked = before.filter((k) => !after.includes(k));
    if (granted.length) logAudit({ employeeId: `role:${roleName}`, field: 'Permission granted', to: describePerms(granted, catalog), changedBy: me.name, module: 'Access' });
    if (revoked.length) logAudit({ employeeId: `role:${roleName}`, field: 'Permission revoked', from: describePerms(revoked, catalog), to: 'Removed', changedBy: me.name, module: 'Access' });
  };
  const mutate = (roleId: string, fn: (p: string[]) => string[]) => {
    const r = roles.find((x) => x.id === roleId);
    if (r) auditPerms(r.name, r.perms, fn(r.perms));
    setRoles((prev) => prev.map((x) => (x.id === roleId ? { ...x, perms: fn(x.perms) } : x)));
  };
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

  const saveRole = () => {
    const name = draft.name.trim();
    if (!name) return setRoleError('Role name is required.');
    if (mode === 'add' && roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) return setRoleError('A role with that name already exists.');
    if (mode === 'add') {
      logAudit({ employeeId: `role:${name}`, field: 'Role created', to: `${name} · ${draft.perms.length} permissions`, changedBy: me.name, module: 'Access' });
      setRoles((prev) => [...prev, { ...draft, id: `role-${Date.now()}`, name, system: false }]);
    } else {
      const before = roles.find((r) => r.id === draft.id);
      if (before) {
        auditPerms(before.name, before.perms, draft.perms);
        if (!before.system && before.name !== name) logAudit({ employeeId: `role:${name}`, field: 'Role renamed', from: before.name, to: name, changedBy: me.name, module: 'Access' });
        if (before.description !== draft.description) logAudit({ employeeId: `role:${before.name}`, field: 'Role description changed', from: before.description || '—', to: draft.description || '—', changedBy: me.name, module: 'Access' });
      }
      setRoles((prev) => prev.map((r) => (r.id === draft.id ? { ...draft, name: r.system ? r.name : name } : r)));
    }
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
    setFeatActs(['add', 'edit', 'delete']);
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
    logAudit({ employeeId: `feature:${label}`, field: 'Feature added', to: `${label} · ${m.name}${featRoles.length ? ` · granted to ${roles.filter((r) => featRoles.includes(r.id)).map((r) => r.name).join(', ')}` : ''}`, changedBy: me.name, module: 'Access' });
    setCatalog((prev) =>
      prev.map((x) => {
        if (x.id !== m.id) return x;
        const cats = newCat ? [...x.categories, newCat] : x.categories;
        return { ...x, categories: cats.map((c) => (c.id === catId ? { ...c, features: [...c.features, { id: fid, label, custom: true, actions: featActs }] } : c)) };
      })
    );
    setRoles((prev) => prev.map((r) => (featRoles.includes(r.id) ? { ...r, perms: [...r.perms, fid, ...featActs.map((a) => permKey(fid, a))] } : r)));
    setOpen((o) => ({ ...o, [m.id]: true, [`${m.id}/${catId}`]: true }));
    setFeatDrawer(false);
  };
  const removeFeature = (id: string) => {
    const label = catalog.flatMap(modFeatures).find((f) => f.id === id)?.label ?? id;
    logAudit({ employeeId: `feature:${label}`, field: 'Feature removed', from: label, to: 'Removed', changedBy: me.name, module: 'Access' });
    setCatalog((prev) => prev.map((m) => ({ ...m, categories: m.categories.map((c) => ({ ...c, features: c.features.filter((f) => f.id !== id) })) })));
    setRoles((prev) => prev.map((r) => ({ ...r, perms: r.perms.filter((p) => p !== id && !p.startsWith(`${id}#`)) })));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Roles & Permissions"
        description="One access model for every module. For each feature choose exactly what a role can do: View, Add, Edit or Delete."
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
                  <button
                    className="icon-act"
                    onClick={() => {
                      logAudit({ employeeId: `role:${r.name}`, field: 'Role deleted', from: r.name, to: 'Removed', changedBy: me.name, module: 'Access' });
                      setRoles((prev) => prev.filter((x) => x.id !== r.id));
                    }}
                    title="Delete role"
                  >
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
              <div className="rc-acts">
                <span title={`Features ${r.name} can view`}>
                  <b>{g}</b>
                  <em>View</em>
                </span>
                {EXTRA_ACTIONS.map((a) => (
                  <span key={a} title={`Features where ${r.name} can ${a}`}>
                    <b>{catalog.reduce((n, m) => n + countAction(r.perms, modFeatures(m), a), 0)}</b>
                    <em>{ACTIONS.find((x) => x.key === a)?.label}</em>
                  </span>
                ))}
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
        <span>Module → category → feature. Add, Edit and Delete include View. The V A E D buttons on a module or category set that action for everything inside it.</span>
      </div>
      <div className="rp-card">
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a feature, category or module…" />
          </div>
          <div className="rp-legend">
            {ACTIONS.map((a) => (
              <span key={a.key} title={a.hint}>
                <i className={`act-key act-${a.key}`}>{a.short}</i> {a.label}
              </span>
            ))}
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
                  <span className="acts cap" aria-hidden="true">
                    <i>V</i>
                    <i>A</i>
                    <i>E</i>
                    <i>D</i>
                  </span>
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
                    return (
                      <div key={r.id} className="rp-rc" onClick={(e) => e.stopPropagation()}>
                        <GroupActs list={mf} perms={r.perms} who={`${r.name} · ${m.name}`} onToggle={(a) => mutate(r.id, (p) => flipGroup(p, mf, a))} />
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
                            return (
                              <div key={r.id} className="rp-rc" onClick={(e) => e.stopPropagation()}>
                                <GroupActs list={c.features} perms={r.perms} who={`${r.name} · ${c.label}`} onToggle={(a) => mutate(r.id, (p) => flipGroup(p, c.features, a))} />
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
                                  <Acts f={fe} perms={r.perms} who={r.name} onToggle={(a) => mutate(r.id, (p) => flipAction(p, fe, a))} />
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
        wide
        onClose={() => setRoleDrawer(false)}
        title={mode === 'add' ? 'Add role' : 'Edit role'}
        description={mode === 'add' ? 'Name the role, then choose what it can do. Nothing is saved until you press the button below.' : `Editing ${draft.name || 'role'}. Nothing is saved until you press Save changes.`}
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

        <RoleEditor catalog={catalog} perms={draft.perms} onChange={(perms) => setDraft((d) => ({ ...d, perms }))} open={draftOpen} onOpen={(key) => setDraftOpen((p) => ({ ...p, [key]: !p[key] }))} />
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
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>Actions this feature supports</div>
          <div className="perm-grid">
            <label className="perm-item">
              <input type="checkbox" checked disabled />
              <div className="nm">View</div>
            </label>
            {EXTRA_ACTIONS.map((a) => (
              <label key={a} className="perm-item">
                <input type="checkbox" checked={featActs.includes(a)} onChange={() => setFeatActs((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))} />
                <div className="nm">{ACTIONS.find((x) => x.key === a)?.label}</div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>Grant to (all selected actions)</div>
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
