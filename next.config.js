// Safe on every route, no allowlisting needed.
const baseSecurityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // The app is the PARENT that iframes retailers (components/InAppBrowser.tsx); it
  // is never meant to be framed itself.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

// Content-Security-Policy. Shipped REPORT-ONLY first (see headers() below): it
// logs violations to the console without blocking, so we can watch every surface
// — feed/discover/build/drop/saved/profile/checkout/look/style + the in-app
// browser — before flipping the header name to enforce.
//
// Allowlist rationale:
//  - script/style 'unsafe-inline': Next App Router injects an inline bootstrap +
//    hydration scripts, and framer-motion + Next write inline styles. Nonces
//    would need middleware.ts; revisit if we want to drop 'unsafe-inline'.
//    (Dev adds eval via react-refresh — harmless under Report-Only; prod needs none.)
//  - img-src https:: product/cutout photos come from many retailer CDNs. The feed
//    serves them same-origin via the /api/image proxy + /assets/cutouts, but
//    next/image and remote fallbacks can hit CDNs directly; img-src is low-risk.
//  - connect-src: PostHog analytics (host is configurable via NEXT_PUBLIC_POSTHOG_HOST).
//    Watch Report-Only for any browser→Supabase call and add NEXT_PUBLIC_SUPABASE_URL if it appears.
//  - frame-src https:: InAppBrowser embeds arbitrary RAW retailer URLs; a domain
//    allowlist would break any retailer not enumerated. The iframe is sandboxed.
//  - The 3D crate (react-three-fiber) needs no external origins — its environment
//    is built from in-scene Lightformers, and WebGL is not gated by CSP.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.posthog.com https://*.i.posthog.com",
  "frame-src https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  'upgrade-insecure-requests',
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A parent-level package-lock.json exists on the development machine. Pin
  // tracing to this repository so Next never infers the workspace root from
  // that unrelated lockfile (and production bundle evidence stays stable).
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...baseSecurityHeaders,
          // Flip to 'Content-Security-Policy' to enforce once Report-Only is clean.
          { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
        ],
      },
    ];
  },
  // Retired surfaces from the pre-scroll era — keep old links working.
  async redirects() {
    return [
      { source: '/feed', destination: '/', permanent: false },
      { source: '/swipe', destination: '/', permanent: false },
      { source: '/stylist', destination: '/', permanent: false },
      { source: '/wardrobe', destination: '/saved', permanent: false },
      { source: '/canvas', destination: '/build', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'cdn.sylistly.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Retailer CDNs (used for first-load before our pipeline caches them)
      { protocol: 'https', hostname: '**.ssense.com' },
      { protocol: 'https', hostname: '**.nordstrom.com' },
      { protocol: 'https', hostname: '**.nike.com' },
      { protocol: 'https', hostname: '**.adidas.com' },
      { protocol: 'https', hostname: '**.shopify.com' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  // Cutout PNGs are large static assets served from /public — they must never be
  // traced into serverless function bundles (that blew past Vercel's 250MB limit).
  outputFileTracingExcludes: {
    '*': [
      'public/assets/cutouts/**',
      './public/assets/cutouts/**',
      '**/public/assets/cutouts/**',
    ],
  },
};

module.exports = nextConfig;
