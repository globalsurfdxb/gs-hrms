/* Option lists shared by every screen that captures or edits an employee record (onboarding wizard, the full edit
   page, self-service profile), so the same field offers the same choices everywhere. */

export const NATIONALITIES = ['India', 'UAE', 'Pakistan', 'Egypt', 'Jordan', 'Philippines', 'Bangladesh', 'Nepal', 'Sri Lanka', 'UK', 'USA', 'Brazil', 'Other'];
export const GENDERS = ['Male', 'Female', 'Other'];
export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
export const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
export const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Probation'];
export const WORK_MODES = ['Onsite', 'Remote', 'Hybrid'];

/** Keep a stored value that is not in the list selectable, so editing never silently drops it. */
export const withCurrent = (options: string[], current: string) => (current && !options.includes(current) ? [current, ...options] : options);

/* ---------- shared field checks ---------- */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A phone number typed with an optional country code, spaces, dashes or brackets: 7 to 15 digits. */
export const phoneOk = (s: string) => /^[+\d][\d\s\-()]*$/.test(s.trim()) && s.replace(/\D/g, '').length >= 7 && s.replace(/\D/g, '').length <= 15;

const ibanClean = (s: string) => s.replace(/\s/g, '').toUpperCase();

/** UAE IBAN: AE + 21 digits (23 characters), with a valid mod-97 checksum. Spaces are ignored. */
export function ibanError(raw: string): string {
  const s = ibanClean(raw);
  if (!s) return 'IBAN is required.';
  if (!/^AE/.test(s)) return 'A UAE IBAN starts with AE.';
  if (!/^AE\d+$/.test(s)) return 'After AE, a UAE IBAN has digits only.';
  if (s.length !== 23) return `A UAE IBAN has 23 characters (AE + 21 digits); this has ${s.length}.`;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= 'A' ? ch.charCodeAt(0) - 55 : Number(ch);
    rem = (rem * (v >= 10 ? 100 : 10) + v) % 97;
  }
  return rem === 1 ? '' : 'This IBAN fails the checksum. Check the digits against the bank letter.';
}

/** Indian bank account: 9 to 18 digits. */
export function indiaAccountError(raw: string): string {
  const s = raw.replace(/\s/g, '');
  if (!s) return 'Account number is required.';
  if (!/^\d{9,18}$/.test(s)) return 'An Indian account number is 9 to 18 digits.';
  return '';
}

/** IFSC: four letters, a zero, then six letters or digits. */
export function ifscError(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return 'IFSC is required.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(s)) return 'IFSC looks like HDFC0001234 (4 letters, 0, then 6 letters or digits).';
  return '';
}
