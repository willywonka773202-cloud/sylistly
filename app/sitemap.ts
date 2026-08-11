import type { MetadataRoute } from 'next';
import { listAiLookIds } from '@/lib/ai-look-library';
import { IDENTITIES } from '@/lib/style-identity';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sylistly.com';
  const now = new Date();

  // Public, content-rich surfaces (server-rendered, so crawlers see the content):
  // the scroll (home), the Discover look-wall, the catalog, the remix builder,
  // and saved looks. Profile/checkout are personal utility pages → excluded;
  // /privacy + /terms are draft legal pages → excluded until reviewed.
  const staticRoutes = [
    { path: '', changeFrequency: 'daily' as const, priority: 1 },
    { path: '/discover', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/browse', changeFrequency: 'weekly' as const, priority: 0.7 },
    { path: '/build', changeFrequency: 'weekly' as const, priority: 0.7 },
    { path: '/saved', changeFrequency: 'weekly' as const, priority: 0.5 },
    { path: '/affiliate-disclosure', changeFrequency: 'yearly' as const, priority: 0.3 },
  ].map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // The unique, OG-imaged share surfaces — the real SEO content. Every baked look
  // (/look/[id]) and style identity (/style/[id]) is a server-rendered page with a
  // distinct outfit + note, so each is its own indexable URL with stable ids.
  // Without these the curated catalogue is invisible to crawlers.
  const lookRoutes = listAiLookIds().map((id) => ({
    url: `${siteUrl}/look/${id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const styleRoutes = Object.keys(IDENTITIES).map((id) => ({
    url: `${siteUrl}/style/${id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...lookRoutes, ...styleRoutes];
}
