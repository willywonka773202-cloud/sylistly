export function proxiedImageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}
