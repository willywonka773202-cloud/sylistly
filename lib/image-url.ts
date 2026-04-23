export function proxiedImageUrl(
  url: string | undefined,
  options?: { cutout?: boolean },
): string {
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  const params = new URLSearchParams({ url });
  if (options?.cutout) {
    params.set('cutout', '1');
  }
  return `/api/image?${params.toString()}`;
}
