export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Today's date in the user's own time zone, as YYYY-MM-DD. The one clock every screen reads. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The day the sample records were written around. Seed transactions (requests, leave, claims, reviews,
    training) are moved by the gap between this day and today, so they sit around the real date. */
export const SEED_DAY = '2026-07-06';
export const shiftSeed = (iso: string) => addDays(iso, daysBetween(SEED_DAY, todayISO()));
