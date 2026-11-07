// Always validate at the navigation boundary, including for legacy stored URLs.
export function websiteUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

export function hostname(value) {
  const url = websiteUrl(value);
  return url ? new URL(url).hostname.replace(/^www\./, '') : 'Edit website URL';
}
