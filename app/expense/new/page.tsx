'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { useExpense } from '@/context/ExpenseContext';
import { useSeparation } from '@/context/SeparationContext';
import { EMPLOYEES, REFERENCE_TODAY, employeeById, managerOf } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Button } from '@/components/ui/Card';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { EmpId } from '@/components/ui/EmployeeBits';
import { CheckIcon, UploadIcon, XIcon } from '@/components/icons';

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

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

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function NewClaimPage() {
  const { role } = useApp();
  const { locationDef, locationName } = useOrg();
  const me = useCurrentEmployee();
  const { statusOf } = useSeparation();
  const { activeCategories, claims, submitClaim } = useExpense();
  const fileRef = useRef<HTMLInputElement>(null);

  const [claimantId, setClaimantId] = useState(me.id);
  const [chosen, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(REFERENCE_TODAY);
  const [project, setProject] = useState('');
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<{ name: string; size: number } | null>(null);
  const [formError, setFormError] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const claimant = employeeById(claimantId) ?? me;
  const approver = managerOf(claimant);
  const cur = locationDef(claimant.location)?.currency ?? 'AED';
  const category = activeCategories.some((c) => c.name === chosen) ? chosen : (activeCategories[0]?.name ?? '');
  const cat = activeCategories.find((c) => c.name === category);
  const limit = cat?.limits[cur] ?? Infinity;
  const amountNum = Number(amount);
  const overLimit = amountNum > limit;
  const duplicate = !!amount && claims.some((c) => c.employeeId === claimantId && c.category === category && c.amount === amountNum && c.date === date);
  const canPickClaimant = role !== 'Employee';
  const eligibleClaimants = EMPLOYEES.filter((e) => statusOf(e) === 'Active');
  const projects = [...new Set(claims.map((c) => c.project))];

  const reset = () => {
    setSubmittedId(null);
    setAmount('');
    setProject('');
    setDescription('');
    setReceipt(null);
    setDate(REFERENCE_TODAY);
    setFormError('');
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_RECEIPT_BYTES) {
      setFormError('The receipt is larger than 5 MB. Choose a smaller file or compress it.');
      return;
    }
    setFormError('');
    setReceipt({ name: file.name, size: file.size });
  };

  const submit = () => {
    if (!category) return setFormError('Choose a category — none are active right now.');
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setFormError('Enter an amount greater than 0.');
    if (!date || date > REFERENCE_TODAY) return setFormError('Choose the date of the expense (today or earlier).');
    if (!project.trim()) return setFormError('Enter the project or cost centre.');
    setFormError('');
    const id = submitClaim({ employeeId: claimantId, category, amount: amountNum, currency: cur, date, project: project.trim(), description: description.trim(), receipt: receipt?.name });
    setSubmittedId(id);
  };

  if (submittedId) {
    return (
      <div>
        <PageHeader eyebrow="Expense Claims" title="New Claim" />
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-50)', color: '#15803D', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
              <CheckIcon style={{ width: 28, height: 28 }} />
            </div>
            <h3 style={{ marginTop: 16 }}>Claim submitted</h3>
            <p style={{ marginTop: 4, color: 'var(--muted)', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              {cur} {amountNum.toLocaleString('en-US')} for {category} {claimant.id !== me.id ? `on behalf of ${claimant.name} (${claimant.employeeCode}) ` : ''}has been sent{' '}
              {overLimit ? 'for additional management approval' : approver ? `to ${approver.name} (${approver.employeeCode}) for approval` : 'to your approver'}. Reference <b>{submittedId}</b>.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
              <Link href="/expense/claims">
                <Button variant="ghost">View all claims</Button>
              </Link>
              <Button variant="primary" onClick={reset}>
                Submit another
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Expense Claims" title="New Claim" />
      <Card>
        <div className="wizbody">
          <div className="form-grid">
            <Fg label="Claimant" full={canPickClaimant}>
              {canPickClaimant ? (
                <SearchSelect
                  options={eligibleClaimants.map((e) => ({ value: e.id, label: e.name, meta: `${e.employeeCode} · ${e.department}` }))}
                  value={claimantId}
                  onChange={(v) => {
                    setClaimantId(v);
                    setFormError('');
                  }}
                  placeholder="Search by name or employee ID…"
                  emptyText="No employees found"
                />
              ) : (
                <input value={`${me.name} · ${me.employeeCode}`} readOnly />
              )}
              {canPickClaimant && <span className="hint">Submitting on behalf of another employee is available to HR and administrators. Currency and policy follow the claimant&apos;s location.</span>}
            </Fg>
            <Fg label="Category" required>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {activeCategories.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </select>
            </Fg>
            <Fg label="Amount" required>
              <div style={{ display: 'flex' }}>
                <span
                  style={{ display: 'grid', placeItems: 'center', padding: '0 12px', border: '1px solid var(--border)', borderRight: 'none', borderRadius: 'var(--r-sm) 0 0 var(--r-sm)', background: 'var(--bg)', fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}
                >
                  {cur}
                </span>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setFormError('');
                  }}
                  placeholder="0"
                  style={{ flex: 1, minWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                />
              </div>
              <span className="hint">
                Paid in {cur} — set by {claimant.name.split(' ')[0]}&apos;s location ({locationName(claimant.location)}).
              </span>
            </Fg>
            <Fg label="Expense date" required>
              <input type="date" max={REFERENCE_TODAY} value={date} onChange={(e) => setDate(e.target.value)} />
            </Fg>
            <Fg label="Project / cost centre" required>
              <input
                list="claim-projects"
                value={project}
                onChange={(e) => {
                  setProject(e.target.value);
                  setFormError('');
                }}
                placeholder="e.g. Client onsite — Sales"
              />
              <datalist id="claim-projects">
                {projects.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Fg>
            <div className="fg">
              <label>Policy limit for {category || 'category'}</label>
              <div style={{ fontSize: 13, fontWeight: 500, paddingTop: 8 }}>{limit === Infinity ? 'No limit configured' : `${cur} ${limit.toLocaleString('en-US')}`}</div>
            </div>
            <div className="fg">
              <label>Approval route</label>
              <div style={{ fontSize: 13, fontWeight: 500, paddingTop: 8 }}>
                {approver ? (
                  <>
                    {approver.name}
                    <EmpId code={approver.employeeCode} />
                  </>
                ) : (
                  'HR'
                )}
                {overLimit && amount ? <span style={{ color: '#B45309' }}> → management sign-off</span> : null}
              </div>
            </div>
            <Fg label="Description" full>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What was this expense for?"
                style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Fg>
            <Fg label="Receipt" full>
              <input ref={fileRef} type="file" accept="image/*,.pdf" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
              {receipt ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
                  <UploadIcon style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <b>{receipt.name}</b> <span style={{ color: 'var(--muted)' }}>· {kb(receipt.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-act"
                    title="Remove receipt"
                    onClick={() => {
                      setReceipt(null);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                  >
                    <XIcon />
                  </button>
                </div>
              ) : (
                <div
                  className="uploader"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files?.[0]);
                  }}
                >
                  <UploadIcon style={{ margin: '0 auto 8px' }} />
                  Drop a file or click to upload
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>Image or PDF, up to 5 MB · attaching a receipt speeds up approval</div>
                </div>
              )}
            </Fg>
            {duplicate && (
              <div className="fg full note-box warn">
                <div>A claim for the same category, amount and date already exists for {claimant.name}. Check it isn&apos;t a duplicate before submitting.</div>
              </div>
            )}
            {overLimit && amount && (
              <div className="fg full note-box warn">
                <div>
                  This claim exceeds the {cur} {limit.toLocaleString('en-US')} policy limit for {category} and will require an additional management approval step.
                </div>
              </div>
            )}
            {formError && <div className="fg full" style={{ color: 'var(--danger)', fontSize: 12 }}>{formError}</div>}
          </div>
        </div>
        <div className="wizfoot">
          <Link href="/expense/claims">
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button variant="primary" disabled={!amount || !project.trim()} onClick={submit}>
            Submit claim
          </Button>
        </div>
      </Card>
    </div>
  );
}
