'use client';

import { DateField } from '@/components/ui/DateField';
import { useMemo, useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { NewRequest, routeFor } from '@/context/RequestsContext';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Card';
import { toForm } from '@/lib/employeeStore';
import { BLOOD_GROUPS, EMAIL_RE, GENDERS, MARITAL_STATUSES, NATIONALITIES, ibanError, ifscError, indiaAccountError, phoneOk } from '@/lib/options';
import { EmployeeRequest } from '@/lib/types';
import { FileTextIcon, InboxIcon, MapPinIcon, ReceiptIcon, UserIcon } from '@/components/icons';

/** A field with a label, the control, and an inline error. */
function Fg({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="fg full">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span className="hint" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

const TYPES: { type: EmployeeRequest['type']; title: string; desc: string; icon: React.ReactNode; tone: string }[] = [
  { type: 'Information Update', title: 'Update my details', desc: 'Mobile, email, marital status, blood group and similar.', icon: <UserIcon />, tone: 'blue' },
  { type: 'Address Change', title: 'Change my address', desc: 'Your current or permanent address.', icon: <MapPinIcon />, tone: 'teal' },
  { type: 'Bank Detail Update', title: 'Change my bank details', desc: 'The account your salary is paid into.', icon: <ReceiptIcon />, tone: 'green' },
  { type: 'Document Request', title: 'Request a letter', desc: 'Salary certificate, employment letter, NOC and more.', icon: <FileTextIcon />, tone: 'purple' },
  { type: 'Other Request', title: 'Something else', desc: 'Anything not listed here. Describe it in your own words.', icon: <InboxIcon />, tone: 'amber' },
];

/** The personal details an employee may ask to change, with how each is entered. */
const FIELD_OPTIONS: { key: string; label: string; kind: 'text' | 'tel' | 'email' | 'date' | 'select'; options?: string[] }[] = [
  { key: 'personalMobile', label: 'Personal mobile', kind: 'tel' },
  { key: 'personalEmail', label: 'Personal email', kind: 'email' },
  { key: 'maritalStatus', label: 'Marital status', kind: 'select', options: MARITAL_STATUSES },
  { key: 'bloodGroup', label: 'Blood group', kind: 'select', options: BLOOD_GROUPS },
  { key: 'gender', label: 'Gender', kind: 'select', options: GENDERS },
  { key: 'nationality', label: 'Nationality', kind: 'select', options: NATIONALITIES },
  { key: 'name', label: 'Full name (as per passport)', kind: 'text' },
  { key: 'dob', label: 'Date of birth', kind: 'date' },
];

const LETTERS = ['Salary certificate', 'Employment letter', 'Experience letter', 'No objection certificate (NOC)', 'Visa support letter', 'Bank letter'];

export function NewRequestDrawer({ open, onClose, onRaise }: { open: boolean; onClose: () => void; onRaise: (r: NewRequest) => void }) {
  return open ? <Form onClose={onClose} onRaise={onRaise} /> : null;
}

function Form({ onClose, onRaise }: { onClose: () => void; onRaise: (r: NewRequest) => void }) {
  const me = useCurrentEmployee();
  const { locationDef } = useOrg();
  const india = locationDef(me.location)?.template === 'india';
  const current = useMemo(() => toForm(me).v, [me]);

  const [type, setType] = useState<EmployeeRequest['type']>('Information Update');
  const [attempted, setAttempted] = useState(false);
  const [field, setField] = useState(FIELD_OPTIONS[0].key);
  const [value, setValue] = useState('');
  const [which, setWhich] = useState<'currentAddress' | 'permanentAddress'>('currentAddress');
  const [address, setAddress] = useState('');
  const [bank, setBank] = useState({ bankName: '', accountNumber: '', branchCode: '' });
  const [subject, setSubject] = useState('');
  const [needBy, setNeedBy] = useState('');
  const [letter, setLetter] = useState(LETTERS[0]);
  const [purpose, setPurpose] = useState('');
  const [note, setNote] = useState('');

  const def = FIELD_OPTIONS.find((f) => f.key === field) ?? FIELD_OPTIONS[0];
  const errors: Record<string, string> = {};
  if (type === 'Information Update') {
    if (!value.trim()) errors.value = 'Enter the new value.';
    else if (value.trim() === (current[field] ?? '')) errors.value = 'This is the same as what is on your record.';
    else if (def.kind === 'email' && !EMAIL_RE.test(value.trim())) errors.value = 'That does not look like an email address.';
    else if (def.kind === 'tel' && !phoneOk(value)) errors.value = 'Enter a valid number (7 to 15 digits).';
  }
  if (type === 'Address Change') {
    if (!address.trim()) errors.address = 'Enter the new address.';
    else if (address.trim() === (current[which] ?? '').trim()) errors.address = 'This is the same as the address on your record.';
  }
  if (type === 'Bank Detail Update') {
    if (!bank.bankName.trim()) errors.bankName = 'Enter the bank name.';
    const acc = india ? indiaAccountError(bank.accountNumber) : ibanError(bank.accountNumber);
    if (acc) errors.accountNumber = acc;
    if (india) {
      const ifsc = ifscError(bank.branchCode);
      if (ifsc) errors.branchCode = ifsc;
    }
  }
  if (type === 'Document Request' && !purpose.trim()) errors.purpose = 'Say what the letter is for.';
  if (type === 'Other Request') {
    if (!subject.trim()) errors.subject = 'Give your request a short title.';
    if (!purpose.trim()) errors.purpose = 'Describe what you need.';
  }
  const shown = (k: string) => (attempted ? errors[k] : undefined);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(errors).length) return;
    const extra = note.trim() ? ` ${note.trim()}` : '';
    if (type === 'Information Update') onRaise({ type, details: `Change ${def.label.toLowerCase()} to ${value.trim()}.${extra}`, changes: { [field]: value.trim() } });
    else if (type === 'Address Change') onRaise({ type, details: `Update ${which === 'currentAddress' ? 'current' : 'permanent'} address.${extra}`, changes: { [which]: address.trim() } });
    else if (type === 'Bank Detail Update')
      onRaise({
        type,
        details: `Change salary account to ${bank.bankName.trim()}${india && bank.branchCode ? ` (IFSC ${bank.branchCode.trim().toUpperCase()})` : ''}.${extra}`,
        changes: { bankName: bank.bankName.trim(), accountNumber: bank.accountNumber.replace(/\s/g, '').toUpperCase(), ...(bank.branchCode.trim() ? { branchCode: bank.branchCode.trim().toUpperCase() } : {}) },
      });
    else if (type === 'Other Request') onRaise({ type, details: `${subject.trim()}: ${purpose.trim()}${needBy ? ` Needed by ${needBy}.` : ''}${extra}` });
    else onRaise({ type, details: `${letter}: ${purpose.trim()}${extra}` });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="New request"
      description="Ask HR or your manager to change something on your record or to prepare a letter."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Submit request
          </Button>
        </>
      }
    >
      <div className="rq-types" role="radiogroup" aria-label="Request type">
        {TYPES.map((t) => (
          <button key={t.type} type="button" role="radio" aria-checked={type === t.type} className={`rq-type ${type === t.type ? 'on' : ''}`} onClick={() => { setType(t.type); setAttempted(false); }}>
            <span className={`rq-type-ic ss-tone-${t.tone}`}>{t.icon}</span>
            <span className="rq-type-tx">
              <b>{t.title}</b>
              <small>{t.desc}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="rq-route">
        <span>
          Goes to <b>{routeFor(type)}</b>
        </span>
        <small>{type === 'Document Request' ? 'You are told when the letter is ready.' : type === 'Other Request' ? 'They reply here with a decision.' : 'Your record keeps the current value until it is approved.'}</small>
      </div>

      <div className="form-grid">
        {type === 'Information Update' && (
          <>
            <Fg label="What to change" required>
              <select
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setValue('');
                  setAttempted(false);
                }}
              >
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Fg>
            <Fg label={`New ${def.label.toLowerCase()}`} required error={shown('value')} hint={`On your record now: ${current[field] || '—'}`}>
              {def.kind === 'select' ? (
                <select value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Select…</option>
                  {def.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                def.kind === 'date' ? <DateField value={value} onChange={(e) => setValue(e.target.value)} /> : <input type={def.kind} value={value} onChange={(e) => setValue(e.target.value)} />
              )}
            </Fg>
          </>
        )}

        {type === 'Address Change' && (
          <>
            <Fg label="Which address" required>
              <select value={which} onChange={(e) => setWhich(e.target.value as typeof which)}>
                <option value="currentAddress">Current address</option>
                <option value="permanentAddress">Permanent address (home country)</option>
              </select>
            </Fg>
            <Fg label="New address" required error={shown('address')} hint={`On your record now: ${(current[which] ?? '').split('\n')[0] || '—'}`}>
              <textarea rows={5} value={address} onChange={(e) => setAddress(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
            </Fg>
          </>
        )}

        {type === 'Bank Detail Update' && (
          <>
            <Fg label="Bank name" required error={shown('bankName')}>
              <input value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
            </Fg>
            <Fg label={india ? 'Account number' : 'IBAN'} required error={shown('accountNumber')} hint={india ? 'Digits only.' : 'A UAE IBAN starts with AE.'}>
              <input value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} />
            </Fg>
            <Fg label={india ? 'IFSC code' : 'Branch / routing code (optional)'} required={india} error={shown('branchCode')}>
              <input value={bank.branchCode} onChange={(e) => setBank({ ...bank, branchCode: e.target.value })} />
            </Fg>
          </>
        )}

        {type === 'Document Request' && (
          <>
            <Fg label="Which letter" required>
              <select value={letter} onChange={(e) => setLetter(e.target.value)}>
                {LETTERS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Fg>
            <Fg label="What it is for" required error={shown('purpose')} hint="For example: visa application for my spouse.">
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </Fg>
          </>
        )}

        {type === 'Other Request' && (
          <>
            <Fg label="Title" required error={shown('subject')} hint="A few words, for example: Parking card for the new office.">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Fg>
            <Fg label="What do you need?" required error={shown('purpose')}>
              <textarea rows={4} value={purpose} onChange={(e) => setPurpose(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
            </Fg>
            <Fg label="Needed by" hint="Optional.">
              <DateField value={needBy} onChange={(e) => setNeedBy(e.target.value)} />
            </Fg>
          </>
        )}

        <Fg label="Note for the approver">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
        </Fg>
      </div>
    </Drawer>
  );
}
