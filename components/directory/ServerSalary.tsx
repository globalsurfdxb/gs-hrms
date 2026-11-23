'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { can } from '@/lib/access';
import { SALARY_AMOUNT, SALARY_LABEL_MAX, SALARY_MAX_LINES, SalaryLine, SalaryUpdate, ServerSalary, salaryApi } from '@/lib/salaryApi';
import { Sub } from '@/components/profile/EditBits';
import { PlusIcon, ShieldIcon, XIcon } from '@/components/icons';

/* The Salary tab for a server record (local development): a read-only view, and the edit lines with the same checks
   the server makes (BR-EMP-011). Amounts are kept as typed strings and added up in fils / paise, so totals are exact. */

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="field">
      <span className="k">{k}</span>
      <span className="v">{v === null || v === undefined || v === '' ? '—' : v}</span>
    </div>
  );
}

const note = (text: React.ReactNode) => (
  <div className="note-box" style={{ marginBottom: 16 }}>
    <ShieldIcon />
    <div>{text}</div>
  </div>
);

/** "9000.50" → 900050; anything that is not an amount counts as 0. */
const minor = (s: string) => {
  const t = s.trim();
  if (!SALARY_AMOUNT.test(t)) return 0;
  const [w, f = ''] = t.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
};
const total = (rows: SalaryLine[]) => rows.reduce((n, r) => n + minor(r.amount), 0);
/** 900050 → "AED 9,000.50" (negative shown with a minus). */
export const money = (currency: string, m: number) =>
  `${currency} ${m < 0 ? '−' : ''}${(Math.abs(m) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SalaryView({ s, locationLabel }: { s: ServerSalary; locationLabel: string }) {
  const india = s.template === 'INDIA';
  const m = (a: string) => money(s.currency, minor(a));
  const empty = !s.earnings.length && !s.deductions.length;
  return (
    <div>
      {note(
        <>
          Salary structure for <b>{locationLabel}</b>, in {s.currency}. Restricted to HR / Super Admin; employees see their own.
        </>,
      )}
      {empty ? (
        <p className="sb">No salary structure on file yet.</p>
      ) : (
        <div className="g2">
          <div>
            <Sub first>Earnings</Sub>
            {s.earnings.map((x) => (
              <Field key={x.label} k={x.label} v={m(x.amount)} />
            ))}
            <Field k={india ? 'Total earnings' : 'Total salary'} v={<b>{m(s.totalEarnings)}</b>} />
          </div>
          <div>
            {s.deductions.length > 0 && (
              <>
                <Sub first>Deductions</Sub>
                {s.deductions.map((x) => (
                  <Field key={x.label} k={x.label} v={m(x.amount)} />
                ))}
                <Field k="Total deductions" v={m(s.totalDeductions)} />
              </>
            )}
            <Sub first={s.deductions.length === 0}>Take home</Sub>
            <Field k="Net pay" v={<b>{m(s.netPay)}</b>} />
          </div>
        </div>
      )}
    </div>
  );
}

export const SALARY_FEATURE = 'employee:sensitive:salary';
/** Whether to offer the Salary tab: your own record, or Salary → View. The server decides; this only hides the tab. */
export const mayViewSalary = (user: { employeeCode: string; permissions: string[] } | null, code: string) =>
  !!user && (user.employeeCode.toUpperCase() === code.toUpperCase() || can(user.permissions, SALARY_FEATURE));
/** Salary → Edit, never on your own record (the server refuses it). */
export const mayEditSalary = (user: { employeeCode: string; permissions: string[] } | null, code: string) =>
  !!user && user.employeeCode.toUpperCase() !== code.toUpperCase() && can(user.permissions, SALARY_FEATURE, 'edit');

/** Hook: loads the salary once `active` turns true (opening the tab), because reading someone else's salary is audited. */
export function useSalary(code: string, active: boolean) {
  const [state, setState] = useState<{ code: string; s?: ServerSalary; error?: string } | null>(null);
  useEffect(() => {
    if (!active || state?.code === code) return;
    let cancelled = false;
    salaryApi
      .get(code)
      .then((s) => !cancelled && setState({ code, s }))
      .catch((x) => !cancelled && setState({ code, error: errorMessage(x) }));
    return () => {
      cancelled = true;
    };
  }, [code, active, state?.code]);
  const mine = state?.code === code ? state : null;
  return { salary: mine?.s ?? null, error: mine?.error ?? null, loading: active && !mine, set: (s: ServerSalary) => setState({ code, s }) };
}

/** The Salary tab of the profile page. */
export function SalaryPanel({ code, locationLabel }: { code: string; locationLabel: string }) {
  const { salary, error, loading } = useSalary(code, true);
  if (loading) return <p className="sb">Loading…</p>;
  if (error || !salary) return <p className="sb">Could not load the salary: {error}</p>;
  return <SalaryView s={salary} locationLabel={locationLabel} />;
}

/* ---------- edit ---------- */

export type SalaryForm = SalaryUpdate;

export const salaryFormOf = (s: ServerSalary): SalaryForm => ({
  earnings: s.earnings.map((x) => ({ ...x })),
  deductions: s.deductions.map((x) => ({ ...x })),
});

/** Rows left completely empty don't count; labels trimmed, amounts as typed (blank = 0). */
const clean = (rows: SalaryLine[]) =>
  rows
    .filter((r) => r.label.trim() || r.amount.trim())
    .map((r) => ({ label: r.label.trim().replace(/\s+/g, ' '), amount: r.amount.trim() || '0' }));

/** The PUT body, or null when nothing differs from what is saved. */
export function salaryBody(orig: SalaryForm, f: SalaryForm): SalaryUpdate | null {
  const next = { earnings: clean(f.earnings), deductions: clean(f.deductions) };
  const key = (x: SalaryForm) => JSON.stringify([x.earnings.map((r) => [r.label, minor(r.amount)]), x.deductions.map((r) => [r.label, minor(r.amount)])]);
  return key(next) === key({ earnings: clean(orig.earnings), deductions: clean(orig.deductions) }) ? null : next;
}

/** Same checks as the server, keyed like the form ("earnings.0.label"). */
export function validateSalary(f: SalaryForm): Record<string, string> {
  const out: Record<string, string> = {};
  const list = (key: 'earnings' | 'deductions', rows: SalaryLine[]) => {
    const seen = new Set<string>();
    if (rows.filter((r) => r.label.trim() || r.amount.trim()).length > SALARY_MAX_LINES) out[key] = `At most ${SALARY_MAX_LINES} lines.`;
    rows.forEach((r, i) => {
      if (!r.label.trim() && !r.amount.trim()) return;
      const label = r.label.trim().replace(/\s+/g, ' ');
      if (!label) out[`${key}.${i}.label`] = 'Enter the component name.';
      else if (label.length > SALARY_LABEL_MAX) out[`${key}.${i}.label`] = `At most ${SALARY_LABEL_MAX} characters.`;
      else if (seen.has(label.toLowerCase())) out[`${key}.${i}.label`] = 'This component is listed twice.';
      seen.add(label.toLowerCase());
      if (r.amount.trim() && !SALARY_AMOUNT.test(r.amount.trim())) out[`${key}.${i}.amount`] = 'Enter an amount like 9000 or 9000.50.';
    });
  };
  list('earnings', f.earnings);
  list('deductions', f.deductions);
  if (total(f.deductions) > total(f.earnings)) out.deductions = 'Deductions cannot be more than the earnings.';
  return out;
}

export const SALARY_LABELS = { earnings: 'Salary earnings', deductions: 'Salary deductions' } as const;

function Lines({
  rows,
  onChange,
  currency,
  addLabel,
  err,
  prefix,
}: {
  rows: SalaryLine[];
  onChange: (r: SalaryLine[]) => void;
  currency: string;
  addLabel: string;
  err: (k: string) => string | undefined;
  prefix: string;
}) {
  const up = (i: number, p: Partial<SalaryLine>) => onChange(rows.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div>
      {rows.map((r, i) => {
        const le = err(`${prefix}.${i}.label`);
        const ae = err(`${prefix}.${i}.amount`);
        return (
          <div key={i} className="mrow">
            <div>
              <input
                value={r.label}
                maxLength={SALARY_LABEL_MAX}
                placeholder="Component, e.g. Basic salary"
                onChange={(e) => up(i, { label: e.target.value })}
                aria-label="Component name"
                aria-invalid={le ? true : undefined}
                aria-describedby={le ? `${prefix}-${i}-label-err` : undefined}
              />
              {le && (
                <span id={`${prefix}-${i}-label-err`} className="hint" style={{ color: 'var(--danger)' }}>
                  {le}
                </span>
              )}
            </div>
            <div>
              <div className="mamt">
                <span>{currency}</span>
                <input
                  inputMode="decimal"
                  value={r.amount}
                  placeholder="0"
                  onChange={(e) => up(i, { amount: e.target.value })}
                  aria-label="Amount"
                  aria-invalid={ae ? true : undefined}
                  aria-describedby={ae ? `${prefix}-${i}-amount-err` : undefined}
                />
              </div>
              {ae && (
                <span id={`${prefix}-${i}-amount-err`} className="hint" style={{ color: 'var(--danger)' }}>
                  {ae}
                </span>
              )}
            </div>
            <button type="button" className="icon-act" title="Remove line" aria-label="Remove line" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <XIcon />
            </button>
          </div>
        );
      })}
      {rows.length < SALARY_MAX_LINES && (
        <button type="button" className="addnew" onClick={() => onChange([...rows, { label: '', amount: '' }])}>
          <PlusIcon /> {addLabel}
        </button>
      )}
    </div>
  );
}

export function SalaryFields({
  s,
  f,
  set,
  err,
}: {
  s: ServerSalary;
  f: SalaryForm;
  set: (k: keyof SalaryForm, rows: SalaryLine[]) => void;
  err: (k: string) => string | undefined;
}) {
  const india = s.template === 'INDIA';
  const e = total(f.earnings);
  const d = total(f.deductions);
  return (
    <div>
      {note(<>Salary structure in {s.currency}. Totals are calculated for you. Every change is recorded in the Audit Log (names only, never amounts).</>)}
      <div className="g2">
        <div>
          <Sub first>Earnings</Sub>
          <Lines rows={f.earnings} onChange={(r) => set('earnings', r)} currency={s.currency} addLabel="Add earning" err={err} prefix="earnings" />
          {err('earnings') && (
            <span className="hint" style={{ color: 'var(--danger)' }}>
              {err('earnings')}
            </span>
          )}
          <div className="mtotal">
            <span>{india ? 'Total earnings' : 'Total salary'}</span>
            <b>{money(s.currency, e)}</b>
          </div>
        </div>
        <div>
          <Sub first>Deductions</Sub>
          <Lines rows={f.deductions} onChange={(r) => set('deductions', r)} currency={s.currency} addLabel="Add deduction" err={err} prefix="deductions" />
          {err('deductions') && (
            <span className="hint" style={{ color: 'var(--danger)' }}>
              {err('deductions')}
            </span>
          )}
          <div className="mtotal">
            <span>Total deductions</span>
            <b>{money(s.currency, d)}</b>
          </div>
        </div>
      </div>
      <div className="mtotal net">
        <span>Net pay</span>
        <b>{money(s.currency, e - d)}</b>
      </div>
    </div>
  );
}
