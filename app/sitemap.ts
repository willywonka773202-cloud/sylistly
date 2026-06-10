import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sylistly.com';
  const now = new Date();

  // Only the real, public surfaces: the scroll (home), the remix builder,
  // and saved looks. Profile/checkout are personal utility pages.
  return [
    { path: '', changeFrequency: 'daily' as const, priority: 1 },
    { path: '/build', changeFrequency: 'weekly' as const, priority: 0.8 },
    { path: '/saved', changeFrequency: 'weekly' as const, priority: 0.5 },
  ].map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
