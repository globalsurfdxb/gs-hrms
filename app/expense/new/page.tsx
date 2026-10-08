'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { RECEIPT_DEFAULT, claimRoute, useExpense } from '@/context/ExpenseContext';
import { useSeparation } from '@/context/SeparationContext';
import { EMPLOYEES, REFERENCE_TODAY, employeeById } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Button } from '@/components/ui/Card';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { EmpId } from '@/components/ui/EmployeeBits';
import { CheckIcon, ReceiptIcon, UploadIcon, WarnIcon, XIcon } from '@/components/icons';

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
/** Claims older than this many days are not accepted. */
const MAX_AGE_DAYS = 90;
const OLDEST_DATE = addDays(REFERENCE_TODAY, -MAX_AGE_DAYS);

type Field = 'category' | 'amount' | 'date' | 'project' | 'receipt';

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

function Section({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="tx-sec">
      <div className="tx-sec-h">
        <span className="n">{n}</span>
        <div>
          <h3>{title}</h3>
          <span className="d">{desc}</span>
        </div>
      </div>
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
  const [errField, setErrField] = useState<Field | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const claimant = employeeById(claimantId) ?? me;
  const route = claimRoute(claimant);
  const cur = locationDef(claimant.location)?.currency ?? 'AED';
  const category = activeCategories.some((c) => c.name === chosen) ? chosen : (activeCategories[0]?.name ?? '');
  const cat = activeCategories.find((c) => c.name === category);
  const limit = cat?.limits[cur] ?? Infinity;
  const amountNum = Number(amount);
  const overLimit = amountNum > limit;
  // A receipt is needed above the category's policy limit, and above a default amount for any claim.
  const receiptFrom = Math.min(limit, RECEIPT_DEFAULT[cur] ?? Infinity);
  const receiptRequired = amountNum > receiptFrom;
  const receiptWhy = overLimit ? `this claim exceeds the ${cur} ${limit.toLocaleString('en-US')} policy limit for ${category}` : `claims above ${cur} ${receiptFrom.toLocaleString('en-US')} need proof of purchase`;
  const duplicate = !!amount && claims.some((c) => c.employeeId === claimantId && c.category === category && c.amount === amountNum && c.date === date);
  const canPickClaimant = role !== 'Employee';
  const eligibleClaimants = EMPLOYEES.filter((e) => statusOf(e) === 'Active');
  const projects = [...new Set(claims.map((c) => c.project))];
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;
  const bad = (f: Field) => (errField === f ? 'tx-input-err' : undefined);
  const clearError = () => {
    setFormError('');
    setErrField(null);
  };
  const fail = (field: Field, msg: string) => {
    setErrField(field);
    setFormError(msg);
  };

  const reset = () => {
    setSubmittedId(null);
    setAmount('');
    setProject('');
    setDescription('');
    setReceipt(null);
    setDate(REFERENCE_TODAY);
    clearError();
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_RECEIPT_BYTES) {
      fail('receipt', 'The receipt is larger than 5 MB. Choose a smaller file or compress it.');
      return;
    }
    clearError();
    setReceipt({ name: file.name, size: file.size });
  };

  const submit = () => {
    if (!category) return fail('category', 'Choose a category — none are active right now.');
    if (!hasAmount) return fail('amount', 'Enter an amount greater than 0.');
    if (!date) return fail('date', 'Choose the date of the expense.');
    if (date > REFERENCE_TODAY) return fail('date', `The expense date cannot be in the future. Choose ${REFERENCE_TODAY} or earlier.`);
    if (date < OLDEST_DATE) return fail('date', `Claims must be submitted within ${MAX_AGE_DAYS} days of the expense. The earliest date accepted is ${OLDEST_DATE}.`);
    if (!project.trim()) return fail('project', 'Enter the project or cost centre.');
    if (receiptRequired && !receipt) return fail('receipt', `Attach a receipt: ${receiptWhy}.`);
    clearError();
    const id = submitClaim({ employeeId: claimantId, category, amount: amountNum, currency: cur, date, project: project.trim(), description: description.trim(), receipt: receipt?.name });
    setSubmittedId(id);
  };

  if (submittedId) {
    return (
      <div className="tx-page">
        <PageHeader eyebrow="Expense Claims" title="New Claim" />
        <Card>
          <div className="tx-done">
            <div className="ok">
              <CheckIcon style={{ width: 28, height: 28 }} />
            </div>
            <h3>Claim submitted</h3>
            <p>
              {cur} {amountNum.toLocaleString('en-US')} for {category} {claimant.id !== me.id ? `on behalf of ${claimant.name} (${claimant.employeeCode}) ` : ''}has been sent{' '}
              {overLimit ? 'for additional management approval' : `to ${route.label} for approval`}. Reference <b>{submittedId}</b>.
            </p>
            <div className="btns">
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

  const missing = [!hasAmount && 'an amount', !project.trim() && 'a project or cost centre'].filter(Boolean) as string[];

  return (
    <div className="tx-page">
      <PageHeader eyebrow="Expense Claims" title="New Claim" description="Fill in the details of the expense. The claim is routed for approval as soon as you submit it." />

      <div className="tx-layout">
        <Card>
          <Section n={1} title="Claimant" desc="Who is this expense for?">
            <div className="form-grid">
              <Fg label="Claimant" full>
                {canPickClaimant ? (
                  <SearchSelect
                    options={eligibleClaimants.map((e) => ({ value: e.id, label: e.name, meta: `${e.employeeCode} · ${e.department}` }))}
                    value={claimantId}
                    onChange={(v) => {
                      setClaimantId(v);
                      clearError();
                    }}
                    placeholder="Search by name or employee ID…"
                    emptyText="No employees found"
                  />
                ) : (
                  <input value={`${me.name} · ${me.employeeCode}`} readOnly />
                )}
                {canPickClaimant && <span className="hint">Submitting on behalf of another employee is available to HR and administrators. Currency and policy follow the claimant&apos;s location.</span>}
              </Fg>
            </div>
          </Section>

          <Section n={2} title="Expense details" desc="What was spent, how much and when.">
            <div className="form-grid">
              <Fg label="Category" required>
                <select
                  value={category}
                  className={bad('category')}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    clearError();
                  }}
                >
                  {activeCategories.map((c) => (
                    <option key={c.id}>{c.name}</option>
                  ))}
                </select>
                {cat?.description && <span className="hint">{cat.description}</span>}
              </Fg>
              <Fg label="Amount" required>
                <div className="tx-amt-wrap">
                  <span className="tx-amt-cur">{cur}</span>
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    className={bad('amount')}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      clearError();
                    }}
                    placeholder="0"
                  />
                </div>
                <span className="hint">
                  Paid in {cur} — set by {claimant.name.split(' ')[0]}&apos;s location ({locationName(claimant.location)}).
                </span>
              </Fg>
              <Fg label="Expense date" required>
                <input
                  type="date"
                  min={OLDEST_DATE}
                  max={REFERENCE_TODAY}
                  value={date}
                  className={bad('date')}
                  onChange={(e) => {
                    setDate(e.target.value);
                    clearError();
                  }}
                />
              </Fg>
              <Fg label="Project / cost centre" required>
                <input
                  list="claim-projects"
                  value={project}
                  className={bad('project')}
                  onChange={(e) => {
                    setProject(e.target.value);
                    clearError();
                  }}
                  placeholder="e.g. Client onsite — Sales"
                />
                <datalist id="claim-projects">
                  {projects.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Fg>
              <Fg label="Description" full>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What was this expense for?"
                  style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </Fg>
            </div>
          </Section>

          <Section n={3} title="Receipt" desc={receiptRequired ? `Required — ${receiptWhy}.` : `Required above ${cur} ${receiptFrom === Infinity ? 'the policy limit' : receiptFrom.toLocaleString('en-US')} or over the category limit; optional below.`}>
            <input ref={fileRef} type="file" accept="image/*,.pdf" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            {receipt ? (
              <div className="tx-file">
                <span className="tx-av sm">
                  <UploadIcon />
                </span>
                <div style={{ flex: 1, fontSize: 13, minWidth: 0, overflowWrap: 'anywhere' }}>
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
                style={{ cursor: 'pointer', ...(errField === 'receipt' ? { borderColor: 'var(--danger)' } : {}) }}
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
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>Image or PDF, up to 5 MB</div>
              </div>
            )}
          </Section>

          {(duplicate || (overLimit && !!amount) || formError) && (
            <div className="tx-sec" style={{ display: 'grid', gap: 10 }}>
              {duplicate && (
                <div className="note-box warn">
                  <WarnIcon />
                  <div>A claim for the same category, amount and date already exists for {claimant.name}. Check it isn&apos;t a duplicate before submitting.</div>
                </div>
              )}
              {overLimit && !!amount && (
                <div className="note-box warn">
                  <WarnIcon />
                  <div>
                    This claim exceeds the {cur} {limit.toLocaleString('en-US')} policy limit for {category} and will require an additional management approval step.
                  </div>
                </div>
              )}
              {formError && (
                <div className="tx-err" role="alert">
                  <WarnIcon />
                  {formError}
                </div>
              )}
            </div>
          )}

          <div className="wizfoot">
            <Link href="/expense/claims">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button variant="primary" disabled={!amount || !project.trim()} onClick={submit}>
              Submit claim
            </Button>
          </div>
        </Card>

        <div className="tx-side">
          <Card>
            <div className="tx-sum">
              <h3>Claim summary</h3>
              <div className="tx-sum-amt">
                <small>{cur}</small>
                {hasAmount ? amountNum.toLocaleString('en-US') : '0'}
              </div>
              <div className="tx-sum-row">
                <span>Claimant</span>
                <span>
                  {claimant.name}
                  <EmpId code={claimant.employeeCode} />
                </span>
              </div>
              <div className="tx-sum-row">
                <span>Category</span>
                <span>{category || '—'}</span>
              </div>
              <div className="tx-sum-row">
                <span>Expense date</span>
                <span>{date || '—'}</span>
              </div>
              <div className="tx-sum-row">
                <span>Project</span>
                <span>{project.trim() || '—'}</span>
              </div>
              <div className="tx-sum-row">
                <span>Receipt</span>
                <span>{receipt ? 'Attached' : receiptRequired ? 'Required' : 'None'}</span>
              </div>
              <div className="tx-sum-row">
                <span>Policy limit</span>
                <span>{limit === Infinity ? 'No limit configured' : `${cur} ${limit.toLocaleString('en-US')}`}</span>
              </div>
              <div className="tx-sum-row">
                <span>Approval route</span>
                <span>
                  {route.label}
                  {overLimit && amount ? <span style={{ color: '#B45309' }}> → management sign-off</span> : null}
                </span>
              </div>
            </div>
          </Card>
          {missing.length > 0 && (
            <div className="note-box" style={{ marginTop: 12 }}>
              <ReceiptIcon />
              <div>To submit, add {missing.join(' and ')}.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
