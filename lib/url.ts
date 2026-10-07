export const normalizeWebsite = (raw: string) => {
  const v = raw.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

export const isValidWebsite = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return host.includes('.') && !host.endsWith('.');
  } catch {
    return false;
  }
};

export const displayWebsite = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
