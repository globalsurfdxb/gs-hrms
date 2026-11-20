import { api } from '@/lib/api';

/* Identity, bank and PF details from the backend (GET/PATCH /api/employees/:code/identity-bank, signed in).
   Numbers (passport, Emirates ID, Aadhaar, PAN, UAN, account / IBAN) arrive masked to the last 4 characters; a full
   number comes only from `reveal`, which the server records in Audit Logs. Access is by permission (Employee
   Management → Identity & bank): View reads, Edit changes, "Reveal full numbers" reveals. Anyone reads their own.
   Local development only — see API_ENABLED. */

export const SECRET_KEYS = ['passportNumber', 'emiratesId', 'aadhaar', 'pan', 'uan', 'accountNumber'] as const;
export const TEXT_KEYS = ['passportName', 'aadhaarName', 'panName', 'pfEnrolled', 'uanMobile', 'pfMemberId', 'epsEligibility', 'paymentMode', 'bankName', 'accountName', 'branchCode', 'branchName'] as const;
export const DAY_KEYS = ['passportExpiry', 'emiratesIdExpiry', 'visaExpiry', 'labourCardIssue', 'labourCardExpiry'] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];
export type IbKey = SecretKey | (typeof TEXT_KEYS)[number] | (typeof DAY_KEYS)[number];

export type ServerIdentityBank = Record<IbKey, string | null> & {
  employeeCode: string;
  /** Which fields apply (BR-EMP-001). */
  template: 'UAE' | 'INDIA';
  currency: 'AED' | 'INR';
  canEdit: boolean;
  canReveal: boolean;
};

/** PATCH body: a field left out stays; "" or null clears it. */
export type IdentityBankUpdate = Partial<Record<IbKey, string | null>>;

const path = (code: string) => `/employees/${encodeURIComponent(code)}/identity-bank`;

export const identityBankApi = {
  /** 404 when the person is outside what you may see (or not yours, without the View permission). */
  get: (code: string) => api<ServerIdentityBank>('GET', path(code)),
  update: (code: string, body: IdentityBankUpdate) => api<ServerIdentityBank>('PATCH', path(code), body),
  /** One full number. Show it briefly; never store it. */
  reveal: (code: string, field: SecretKey) => api<{ field: SecretKey; value: string }>('POST', `${path(code)}/reveal`, { field }),
};

export const IB_LABELS: Record<IbKey, string> = {
  passportNumber: 'Passport number',
  passportExpiry: 'Passport expiry',
  passportName: 'Name as per passport',
  emiratesId: 'Emirates ID',
  emiratesIdExpiry: 'Emirates ID expiry',
  visaExpiry: 'Visa expiry',
  labourCardIssue: 'Labour card issue date',
  labourCardExpiry: 'Labour card expiry',
  aadhaar: 'Aadhaar number',
  aadhaarName: 'Name as per Aadhaar',
  pan: 'PAN',
  panName: 'Name as per PAN',
  uan: 'UAN',
  pfEnrolled: 'Already enrolled in PF',
  uanMobile: 'Mobile linked to UAN',
  pfMemberId: 'Previous PF member ID',
  epsEligibility: 'EPS eligibility',
  paymentMode: 'Payment mode',
  bankName: 'Bank name',
  accountName: 'Account holder name',
  accountNumber: 'Account number / IBAN',
  branchCode: 'IFSC / routing code',
  branchName: 'Branch name',
};

/** Fields of the Bank & PF tab; the rest belong to the identity tab. */
export const BANK_TAB_KEYS: readonly IbKey[] = ['paymentMode', 'bankName', 'accountName', 'accountNumber', 'branchCode', 'branchName', 'pfEnrolled', 'uan', 'uanMobile', 'pfMemberId', 'epsEligibility'];
