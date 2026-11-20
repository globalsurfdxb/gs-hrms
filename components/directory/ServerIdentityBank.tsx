'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { DAY_KEYS, IbKey, IdentityBankUpdate, SECRET_KEYS, SecretKey, ServerIdentityBank, TEXT_KEYS, identityBankApi } from '@/lib/identityBankApi';
import { ibanError, ifscError, indiaAccountError, phoneOk, withCurrent } from '@/lib/options';
import { Fg, Sub } from '@/components/profile/EditBits';
import { DateField } from '@/components/ui/DateField';
import { ShieldIcon } from '@/components/icons';

/* The identity and Bank & PF tabs for a server record (local development): read-only views with an audited Reveal
   for a full number, and the edit fields with the same checks the server makes (BR-EMP-001/008/009). Numbers are
   never put back into a form: a number field starts empty, and typing a new number replaces the stored one. */

export const identityTabName = (ib: Pick<ServerIdentityBank, 'template'>) => (ib.template === 'INDIA' ? 'Passport / Aadhaar / PAN' : 'Passport / Visa / EID');
const PAYMENT_MODES = { UAE: ['WPS Transfer', 'Bank Transfer'], INDIA: ['Bank Transfer', 'Cheque'] } as const;
const REVEAL_FOR_MS = 30_000;

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="field">
      <span className="k">{k}</span>
      <span className="v">{v === null || v === undefined || v === '' ? '—' : v}</span>
    </div>
  );
}

/** A masked number with a Reveal button when allowed. The full number shows for 30 seconds, then hides again. */
function Secret({ ib, field }: { ib: ServerIdentityBank; field: SecretKey }) {
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (shown === null) return;
    const t = setTimeout(() => setShown(null), REVEAL_FOR_MS);
    return () => clearTimeout(t);
  }, [shown]);
  const masked = ib[field];
  if (!masked) return <>—</>;
  const reveal = async () => {
    setBusy(true);
    setError('');
    try {
      setShown((await identityBankApi.reveal(ib.employeeCode, field)).value);
    } catch (x) {
      setError(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{shown ?? masked}</span>
      {ib.canReveal &&
        (shown === null ? (
          <button type="button" className="btn sm" onClick={reveal} disabled={busy} title="Shows the full number for 30 seconds. Recorded in Audit Logs.">
            {busy ? 'Revealing…' : 'Reveal'}
          </button>
        ) : (
          <button type="button" className="btn sm" onClick={() => setShown(null)}>
            Hide
          </button>
        ))}
      {error && <span style={{ color: 'var(--danger, #b42318)', fontSize: 12 }}>{error}</span>}
    </span>
  );
}

const note = (text: React.ReactNode) => (
  <div className="note-box" style={{ marginBottom: 16 }}>
    <ShieldIcon />
    <div>{text}</div>
  </div>
);

export function IdentityView({ ib }: { ib: ServerIdentityBank }) {
  const india = ib.template === 'INDIA';
  return (
    <div>
      {note(<>Numbers are masked{ib.canReveal ? '. Reveal shows one for 30 seconds and is recorded in Audit Logs.' : '.'}</>)}
      <div className="g2">
        <div>
          <Sub first>Passport</Sub>
          {india && <Field k="Name as per passport" v={ib.passportName} />}
          <Field k="Passport number" v={<Secret ib={ib} field="passportNumber" />} />
          <Field k="Passport expiry" v={ib.passportExpiry} />
        </div>
        {india ? (
          <div>
            <Sub first>Statutory identity (India)</Sub>
            <Field k="Name as per Aadhaar" v={ib.aadhaarName} />
            <Field k="Aadhaar number" v={<Secret ib={ib} field="aadhaar" />} />
            <Field k="Name as per PAN" v={ib.panName} />
            <Field k="PAN number" v={<Secret ib={ib} field="pan" />} />
          </div>
        ) : (
          <div>
            <Sub first>Visa, Emirates ID &amp; labour card</Sub>
            <Field k="Visa expiry" v={ib.visaExpiry} />
            <Field k="Emirates ID" v={<Secret ib={ib} field="emiratesId" />} />
            <Field k="Emirates ID expiry" v={ib.emiratesIdExpiry} />
            <Field k="Labour card issued" v={ib.labourCardIssue} />
            <Field k="Labour card expiry" v={ib.labourCardExpiry} />
          </div>
        )}
      </div>
    </div>
  );
}

export function BankView({ ib, locationLabel }: { ib: ServerIdentityBank; locationLabel: string }) {
  const india = ib.template === 'INDIA';
  return (
    <div>
      {note(
        <>
          Shared with Payroll. Format shown for <b>{locationLabel}</b> employees. Restricted to HR / Super Admin.
        </>,
      )}
      <div className="g2">
        <div>
          <Sub first>Bank details</Sub>
          <Field k="Payment mode" v={ib.paymentMode} />
          <Field k="Bank name" v={ib.bankName} />
          <Field k="Account holder name" v={ib.accountName} />
          <Field k={india ? 'Account number' : 'IBAN number'} v={<Secret ib={ib} field="accountNumber" />} />
          <Field k={india ? 'IFSC' : 'Routing / bank code'} v={ib.branchCode} />
          {india && <Field k="Branch name" v={ib.branchName} />}
          <Field k="Currency" v={ib.currency} />
        </div>
        {india && (
          <div>
            <Sub first>PF details (India)</Sub>
            <Field k="Already enrolled in PF" v={ib.pfEnrolled} />
            <Field k="UAN" v={<Secret ib={ib} field="uan" />} />
            {ib.pfEnrolled === 'Yes' && (
              <>
                <Field k="Mobile linked to UAN" v={ib.uanMobile} />
                <Field k="Previous PF member ID" v={ib.pfMemberId} />
                <Field k="EPS eligibility" v={ib.epsEligibility} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- editing ---------------- */

export type IbForm = Record<IbKey, string>;

/** The form starts with every number empty (typing one replaces the stored number). */
export const ibFormOf = (ib: ServerIdentityBank): IbForm =>
  Object.fromEntries([...SECRET_KEYS.map((k) => [k, '']), ...[...TEXT_KEYS, ...DAY_KEYS].map((k) => [k, ib[k] ?? ''])]) as IbForm;

/** Only what changed, ready to PATCH: a typed number, or a text/date field that differs ("" clears it). */
export function ibChanges(orig: IbForm, f: IbForm): IdentityBankUpdate {
  const body: IdentityBankUpdate = {};
  for (const k of SECRET_KEYS) if (f[k].trim()) body[k] = f[k].trim();
  for (const k of [...TEXT_KEYS, ...DAY_KEYS]) if (f[k].trim() !== orig[k].trim()) body[k] = f[k].trim() || null;
  return body;
}

const digits = (s: string) => s.replace(/\s/g, '');

/** The server's checks, so the form can say what to fix before saving. */
export function validateIb(f: IbForm, ib: ServerIdentityBank): Record<string, string> {
  const e: Record<string, string> = {};
  const india = ib.template === 'INDIA';
  const has = (k: SecretKey) => !!f[k].trim() || !!ib[k];
  if (f.passportNumber.trim() && !/^[A-Z0-9]{5,20}$/.test(digits(f.passportNumber).toUpperCase())) e.passportNumber = 'Passport number is 5 to 20 letters or digits.';
  if (!india && f.emiratesId.trim() && !/^784-\d{4}-\d{7}-\d$/.test(f.emiratesId.trim())) e.emiratesId = 'Format: 784-YYYY-NNNNNNN-N.';
  if (india && f.aadhaar.trim() && !/^\d{12}$/.test(digits(f.aadhaar))) e.aadhaar = 'Aadhaar is 12 digits.';
  if (india && f.pan.trim() && !/^[A-Z]{5}\d{4}[A-Z]$/.test(digits(f.pan).toUpperCase())) e.pan = 'PAN looks like ABCDE1234F.';
  if (india && f.uan.trim() && !/^\d{12}$/.test(digits(f.uan))) e.uan = 'UAN is 12 digits.';
  if (f.accountNumber.trim()) {
    const msg = india ? indiaAccountError(f.accountNumber) : ibanError(f.accountNumber);
    if (msg) e.accountNumber = msg;
  }
  if (has('accountNumber')) {
    if (!f.bankName.trim()) e.bankName = 'Bank name is required with an account number.';
    if (india && !f.branchCode.trim()) e.branchCode = 'IFSC is required with an account number.';
  }
  if (india && f.branchCode.trim()) {
    const msg = ifscError(f.branchCode);
    if (msg) e.branchCode = msg;
  }
  if (india && f.pfEnrolled === 'Yes') {
    if (!has('uan')) e.uan = 'Enter the UAN, since they are already enrolled in PF.';
    if (!f.uanMobile.trim()) e.uanMobile = 'Enter the mobile linked to the UAN.';
  }
  if (f.uanMobile.trim() && !phoneOk(f.uanMobile)) e.uanMobile = 'Enter a valid mobile number (7 to 15 digits).';
  if (f.labourCardIssue && f.labourCardExpiry && f.labourCardExpiry < f.labourCardIssue) e.labourCardExpiry = 'Expiry is before the issue date.';
  return e;
}

interface FieldsProps {
  ib: ServerIdentityBank;
  f: IbForm;
  set: (k: IbKey, v: string) => void;
  err: (k: string) => string | undefined;
}

/** A number input: empty keeps the stored number (shown masked in the hint). */
function SecretInput({ ib, f, set, k }: Omit<FieldsProps, 'err'> & { k: SecretKey }) {
  const stored = ib[k];
  return <input value={f[k]} onChange={(ev) => set(k, ev.target.value)} placeholder={stored ? `On file: ${stored} — type to replace` : ''} autoComplete="off" spellCheck={false} />;
}

export function IdentityFields({ ib, f, set, err }: FieldsProps) {
  const india = ib.template === 'INDIA';
  const text = (k: IbKey) => <input value={f[k]} onChange={(ev) => set(k, ev.target.value)} />;
  const day = (k: IbKey) => <DateField value={f[k]} onChange={(ev) => set(k, ev.target.value)} />;
  return (
    <div>
      {note(<>Numbers are never shown here. Leave a number empty to keep the one on file; type a new one to replace it.</>)}
      <Sub first>Passport</Sub>
      <div className="form-grid">
        {india && <Fg label="Name as per passport">{text('passportName')}</Fg>}
        <Fg label="Passport number" required={!india} error={err('passportNumber')}>
          <SecretInput ib={ib} f={f} set={set} k="passportNumber" />
        </Fg>
        <Fg label="Passport expiry">{day('passportExpiry')}</Fg>
      </div>
      {india ? (
        <>
          <Sub>Statutory identity (India)</Sub>
          <div className="form-grid">
            <Fg label="Name as per Aadhaar">{text('aadhaarName')}</Fg>
            <Fg label="Aadhaar number" error={err('aadhaar')} hint="12 digits.">
              <SecretInput ib={ib} f={f} set={set} k="aadhaar" />
            </Fg>
            <Fg label="Name as per PAN">{text('panName')}</Fg>
            <Fg label="PAN number" error={err('pan')} hint="Like ABCDE1234F.">
              <SecretInput ib={ib} f={f} set={set} k="pan" />
            </Fg>
          </div>
        </>
      ) : (
        <>
          <Sub>Visa, Emirates ID &amp; labour card</Sub>
          <div className="form-grid">
            <Fg label="Visa expiry" hint="Drives visa renewal reminders.">
              {day('visaExpiry')}
            </Fg>
            <Fg label="Emirates ID number" error={err('emiratesId')} hint="784-YYYY-NNNNNNN-N">
              <SecretInput ib={ib} f={f} set={set} k="emiratesId" />
            </Fg>
            <Fg label="Emirates ID expiry">{day('emiratesIdExpiry')}</Fg>
            <Fg label="Labour card issue date">{day('labourCardIssue')}</Fg>
            <Fg label="Labour card expiry" error={err('labourCardExpiry')}>
              {day('labourCardExpiry')}
            </Fg>
          </div>
        </>
      )}
    </div>
  );
}

export function BankFields({ ib, f, set, err, locationLabel }: FieldsProps & { locationLabel: string }) {
  const india = ib.template === 'INDIA';
  const text = (k: IbKey, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <input {...props} value={f[k]} onChange={(ev) => set(k, ev.target.value)} />;
  const select = (k: IbKey, options: readonly string[]) => (
    <select value={f[k]} onChange={(ev) => set(k, ev.target.value)}>
      <option value="">{f[k] ? 'Not specified' : 'Select…'}</option>
      {withCurrent([...options], f[k]).map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
  return (
    <div>
      {note(
        <>
          Shared with Payroll, so changes here are logged. Fields shown for <b>{locationLabel}</b>. Leave the account number empty to keep the one on file.
        </>,
      )}
      <Sub first>Bank details</Sub>
      <div className="form-grid">
        <Fg label="Payment mode">{select('paymentMode', PAYMENT_MODES[ib.template])}</Fg>
        <Fg label="Bank name" error={err('bankName')}>
          {text('bankName')}
        </Fg>
        <Fg label="Account holder name">{text('accountName')}</Fg>
        <Fg label={india ? 'Account number' : 'IBAN number'} error={err('accountNumber')} hint={india ? '9 to 18 digits.' : 'AE + 21 digits (23 characters). Spaces are ignored.'}>
          <SecretInput ib={ib} f={f} set={set} k="accountNumber" />
        </Fg>
        <Fg label={india ? 'IFSC' : 'Routing / bank code'} error={err('branchCode')}>
          {text('branchCode')}
        </Fg>
        {india && <Fg label="Branch name">{text('branchName')}</Fg>}
        <Fg label="Currency" hint="Set by the work location.">
          <input value={ib.currency} readOnly style={{ background: 'var(--bg)' }} />
        </Fg>
      </div>
      {india && (
        <>
          <Sub>PF details (India)</Sub>
          <div className="form-grid">
            <Fg label="Already enrolled in PF?">{select('pfEnrolled', ['Yes', 'No'])}</Fg>
            <Fg label="UAN" error={err('uan')} hint="12 digits.">
              <SecretInput ib={ib} f={f} set={set} k="uan" />
            </Fg>
            {f.pfEnrolled === 'Yes' && (
              <>
                <Fg label="Mobile linked to UAN" error={err('uanMobile')}>
                  {text('uanMobile', { type: 'tel' })}
                </Fg>
                <Fg label="Previous PF member ID">{text('pfMemberId')}</Fg>
                <Fg label="EPS eligibility">{select('epsEligibility', ['Eligible', 'Not eligible', 'Not sure'])}</Fg>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

