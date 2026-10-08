'use client';

import { useState } from 'react';
import { useOrg } from '@/context/OrgContext';
import { useExpense } from '@/context/ExpenseContext';
import { ExpenseCategory } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { CheckIcon, EditIcon, PlusIcon, ReceiptIcon, SearchIcon, TagIcon, WarnIcon, XIcon } from '@/components/icons';

const blank = (): ExpenseCategory => ({ id: '', name: '', description: '', limits: {}, active: true });

export default function ExpenseCategoriesPage() {
  const { locations } = useOrg();
  const { categories, claims, addCategory, updateCategory, toggleCategory, removeCategory } = useExpense();

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [draft, setDraft] = useState<ExpenseCategory>(blank());
  const [limitText, setLimitText] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const currencies = [...new Set([...locations.map((l) => l.currency), ...categories.flatMap((c) => Object.keys(c.limits))])];
  const claimCount = (name: string) => claims.filter((c) => c.category === name).length;

  const rows = categories.filter(
    (c) => (statusFilter === 'All' || (statusFilter === 'Active' ? c.active : !c.active)) && `${c.name} ${c.description}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  const openAdd = () => {
    setDraft(blank());
    setLimitText({});
    setMode('add');
    setError('');
    setOpen(true);
  };

  const openEdit = (c: ExpenseCategory) => {
    setDraft({ ...c, limits: { ...c.limits } });
    setLimitText(Object.fromEntries(Object.entries(c.limits).map(([k, v]) => [k, String(v)])));
    setMode('edit');
    setError('');
    setOpen(true);
  };

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Category name is required.');
      return;
    }
    if (categories.some((c) => c.id !== draft.id && c.name.toLowerCase() === name.toLowerCase())) {
      setError(`A category called "${name}" already exists.`);
      return;
    }
    const limits: Record<string, number> = {};
    for (const cur of currencies) {
      const raw = (limitText[cur] ?? '').trim();
      if (raw === '') continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        setError(`The ${cur} limit must be a number greater than 0 (or leave it blank for no limit).`);
        return;
      }
      limits[cur] = n;
    }
    const record = { ...draft, name, description: draft.description.trim(), limits };
    if (mode === 'add') {
      const { id: _unused, ...rest } = record;
      void _unused;
      addCategory(rest);
    } else updateCategory(record);
    setOpen(false);
  };

  const remove = (c: ExpenseCategory) => {
    if (window.confirm(`Delete the "${c.name}" category? This can't be undone.`)) removeCategory(c.id);
  };

  const editingClaims = mode === 'edit' ? claimCount(draft.name) : 0;
  const totalClaims = claims.length;
  const activeCount = categories.filter((c) => c.active).length;

  return (
    <div className="tx-page">
      <PageHeader
        eyebrow="Expense Claims"
        title="Categories & Policy"
        description="Claim categories and their per-claim policy limits for each currency. Claims above the limit require an additional management approval step."
        actions={
          <Button variant="primary" onClick={openAdd}>
            <PlusIcon /> Add category
          </Button>
        }
      />

      <StatStrip
        items={[
          { label: 'Categories', value: categories.length, icon: <TagIcon />, tone: 'blue', hint: `Limits in ${currencies.join(', ')}` },
          { label: 'Active', value: activeCount, icon: <CheckIcon />, tone: 'green', hint: 'Available for new claims' },
          { label: 'Inactive', value: categories.length - activeCount, icon: <XIcon />, tone: 'gray', hint: 'Hidden from new claims' },
          { label: 'Claims on file', value: totalClaims, icon: <ReceiptIcon />, tone: 'purple', hint: 'Across all categories', href: '/expense/claims' },
        ]}
      />

      <Card>
        <CardHeader title="Categories" sub={`${categories.length} on file · limits in ${currencies.join(', ')}`} />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories…" />
          </div>
          {(['All', 'Active', 'Inactive'] as const).map((s) => (
            <button key={s} type="button" className={`chip ${statusFilter === s ? 'tx-chip-on' : ''}`} onClick={() => setStatusFilter(s)}>
              {s} · {s === 'All' ? categories.length : s === 'Active' ? activeCount : categories.length - activeCount}
            </button>
          ))}
          <span className="sp" />
          <span className="tx-count">
            {rows.length} of {categories.length}
          </span>
        </div>

        {!rows.length ? (
          <EmptyState icon={<TagIcon />} title={categories.length ? 'No matching categories' : 'No categories yet'} description={categories.length ? 'Try a different search or filter.' : 'Add a category so employees can file claims against it.'} />
        ) : (
          <div className="tx-scroll wide">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  {currencies.map((cur) => (
                    <th key={cur}>Limit ({cur})</th>
                  ))}
                  <th>Claims</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const n = claimCount(c.name);
                  return (
                    <tr key={c.id} style={c.active ? undefined : { opacity: 0.65 }}>
                      <td>
                        <span className="person">
                          <span className="tx-cat-ic">
                            <TagIcon />
                          </span>
                          <span>
                            <span className="nm" style={{ display: 'block' }}>
                              {c.name}
                            </span>
                            <span className="sb" style={{ display: 'block' }}>
                              {c.description || 'No description'}
                            </span>
                          </span>
                        </span>
                      </td>
                      {currencies.map((cur) => (
                        <td key={cur} className="mono">
                          {c.limits[cur] !== undefined ? c.limits[cur].toLocaleString('en-US') : <span style={{ color: 'var(--faint)' }}>No limit</span>}
                        </td>
                      ))}
                      <td>{n ? <span className="tx-pill">{n}</span> : <span style={{ color: 'var(--faint)' }}>0</span>}</td>
                      <td>
                        <Badge tone={c.active ? 'active' : 'inactive'}>{c.active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="icon-act" onClick={() => openEdit(c)} title="Edit">
                          <EditIcon />
                        </button>{' '}
                        <Button size="sm" onClick={() => toggleCategory(c.id)} title={c.active ? 'Hide from new claims' : 'Allow in new claims'}>
                          {c.active ? 'Deactivate' : 'Activate'}
                        </Button>{' '}
                        <button
                          className="icon-act"
                          onClick={() => remove(c)}
                          disabled={n > 0}
                          title={n > 0 ? `Used by ${n} claim(s) — deactivate it instead` : 'Delete'}
                          style={n > 0 ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                        >
                          <XIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!!rows.length && (
          <div className="tfoot">
            <span>
              Showing {rows.length} of {categories.length} · claims above a limit need extra management approval
            </span>
          </div>
        )}
      </Card>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === 'add' ? 'Add category' : 'Edit category'}
        description={mode === 'add' ? 'Create a claim category and set its per-claim policy limits.' : `Editing ${draft.name || 'category'}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {mode === 'add' ? 'Add category' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="fg full">
            <label>
              Category name <span className="req">*</span>
            </label>
            <input
              value={draft.name}
              disabled={editingClaims > 0}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                setError('');
              }}
              placeholder="e.g. Training & Certification"
              className={error && !draft.name.trim() ? 'tx-input-err' : undefined}
            />
            {editingClaims > 0 && <span className="hint">The name is locked because {editingClaims} existing claim(s) use it.</span>}
          </div>
          <div className="fg full">
            <label>Description</label>
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What this category covers" />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>Policy limit per claim</div>
          <div className="form-grid">
            {currencies.map((cur) => (
              <div key={cur} className="fg">
                <label>Limit ({cur})</label>
                <input
                  type="number"
                  min={1}
                  value={limitText[cur] ?? ''}
                  onChange={(e) => {
                    setLimitText({ ...limitText, [cur]: e.target.value });
                    setError('');
                  }}
                  placeholder="No limit"
                />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>Claims above a limit need extra management approval. Leave a field blank for no limit in that currency.</span>
        </div>
        {error && (
          <div className="tx-err" style={{ marginTop: 14 }}>
            <WarnIcon />
            {error}
          </div>
        )}
      </Drawer>
    </div>
  );
}
