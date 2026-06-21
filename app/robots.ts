import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sylistly.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep crawlers off non-content routes: the API (JSON, not pages) and the
      // personal utility pages, which render near-empty server-side (their data
      // lives in on-device localStorage) — indexing them would be thin content.
      // Mirrors the sitemap, which lists only the public content surfaces.
      disallow: ['/api/', '/profile', '/checkout'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
