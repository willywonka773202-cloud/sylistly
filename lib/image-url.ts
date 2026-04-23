export function proxiedImageUrl(
  url: string | undefined,
  options?: { cutout?: boolean; category?: string },
): string {
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  const params = new URLSearchParams({ url });
  if (options?.cutout) {
    params.set('cutout', '1');
  }
  if (options?.category) {
    params.set('category', options.category);
  }
  return `/api/image?${params.toString()}`;
}
