const GOOGLE_HOSTS = new Set(['google.com', 'www.google.com']);

function safeHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function hasDirectRetailerUrl(url: string): boolean {
  const host = safeHostname(url);
  return Boolean(host) && !GOOGLE_HOSTS.has(host as string);
}

export { safeHostname, GOOGLE_HOSTS };
