/* Small CSV helpers shared by the reports. A backend export will replace these; the row shape stays the same. */

export type CsvCell = string | number | null | undefined;

const cell = (v: CsvCell) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Guard against spreadsheet formula injection from free text.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Rows to CSV text (header row first). */
export function toCsv(columns: string[], rows: CsvCell[][]): string {
  return [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Saves text as a file in the browser. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8;') {
  // The byte-order mark lets Excel open UTF-8 text (names, dashes) correctly.
  const url = URL.createObjectURL(new Blob(['﻿', text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads one table as a CSV file. */
export function downloadCsv(filename: string, columns: string[], rows: CsvCell[][]) {
  downloadText(filename, toCsv(columns, rows));
}

/** A file-name-safe slug. */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
